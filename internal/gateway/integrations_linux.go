//go:build linux

package gateway

import "net/http"

const (
	integrationsPath        = "/api/v1/integrations"
	integrationAccountsPath = "/api/v1/integrations/accounts"
	integrationLoginPath    = "/api/v1/integrations/login"
	integrationGiteaPath    = "/api/v1/integrations/gitea"
	integrationGiteaRepos   = "/api/v1/integrations/gitea/repos"
	integrationGitLabPath   = "/api/v1/integrations/gitlab"
	integrationGitLabRepos  = "/api/v1/integrations/gitlab/repos"
	integrationGitLabTokens = "/api/v1/integrations/gitlab/tokens"
	// A Gitea or GitLab write carries at most an address and a token; its
	// reply and the repository list are bounded far below the general proxy
	// cap. GitLab's bounds are Gitea's.
	giteaRequestLimit = 4096
	giteaChangeLimit  = 64 << 10
	giteaReposLimit   = 4 << 20
)

// integrations routes the person's integration requests to their daemon. The
// gateway parses no body here: passwords, pasted redirect addresses and
// folder choices go through unread, and the daemon runs every tool as the
// person (ADR 0026). A login attempt is owned by a hash of the session, as
// the Pi and Claude logins are.
func (a *Auth) integrations(w http.ResponseWriter, r *http.Request) {
	allowed := map[string]map[string]bool{
		integrationsPath:        {http.MethodGet: true},
		integrationAccountsPath: {http.MethodPost: true, http.MethodDelete: true},
		integrationLoginPath:    {http.MethodGet: true, http.MethodPost: true, http.MethodPut: true, http.MethodDelete: true},
		integrationGiteaPath:    {http.MethodPost: true, http.MethodDelete: true},
		integrationGiteaRepos:   {http.MethodGet: true},
		integrationGitLabPath:   {http.MethodPost: true, http.MethodDelete: true},
		integrationGitLabRepos:  {http.MethodGet: true},
		integrationGitLabTokens: {http.MethodGet: true},
	}
	if !allowed[r.URL.Path][r.Method] || !a.exact(r, r.URL.Path) {
		safe(w, 400, "invalid_request")
		return
	}
	// A Gitea or GitLab token passes through unread: the gateway checks only
	// the framing, never parses, logs or keeps the body, and never calls the
	// code host.
	switch r.URL.Path {
	case integrationGiteaPath, integrationGitLabPath:
		if r.ContentLength < 1 || r.ContentLength > giteaRequestLimit || len(r.TransferEncoding) != 0 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 {
			safe(w, 400, "invalid_request")
			return
		}
	case integrationGiteaRepos, integrationGitLabRepos, integrationGitLabTokens:
		if r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			safe(w, 400, "invalid_request")
			return
		}
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if r.Method != http.MethodGet {
		if denied := a.authorizeWrite(r, s); denied != "" {
			safe(w, 403, denied)
			return
		}
	}
	a.proxy(w, r, s, false)
}
