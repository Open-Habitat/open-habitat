package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sync/atomic"

	"github.com/open-habitat/open-habitat/internal/daemon/integrations"
	"github.com/open-habitat/open-habitat/internal/nativegitlab"
	"github.com/open-habitat/open-habitat/internal/nativegitlab/gitlabfake"
)

// The synthetic host's GitLab is a real HTTPS server on loopback with real
// Git smart HTTP and nested group projects (internal/nativegitlab/gitlabfake),
// so the browser path runs the product's daemon routes, glab's file, the Git
// helper, the clone job and the fetch against it unchanged. As for Gitea,
// only its TLS trust is the fixture's, and GitLab is offered only after
// /fixture/gitlab enables it.

const (
	gitlabFixtureToken    = "glpat-synthetic-0001"
	gitlabReadOnlyToken   = "glpat-synthetic-readonly"
	gitlabExpiredToken    = "glpat-synthetic-expired"
	gitlabFixtureUsername = "fixture.person"
)

var gitlabEnabled atomic.Bool

func startGitLabFixture(tmp string) *gitlabfake.Server {
	dir := filepath.Join(tmp, "gitlab")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil
	}
	srv, err := gitlabfake.Start(dir, []gitlabfake.Account{{ID: 4001, Username: gitlabFixtureUsername, Tokens: []gitlabfake.Token{
		{Value: gitlabFixtureToken, ExpiresAt: "2027-10-27"},
		{Value: gitlabReadOnlyToken, Scopes: []string{"read_api", "read_repository"}, ExpiresAt: "2027-10-27"},
		{Value: gitlabExpiredToken, Expired: true},
	}}}, []gitlabfake.Project{
		{ID: 501, Path: "konepaja/verkkokauppa/infra/terraform", Members: []int64{4001}, Visibility: "internal", Description: "Synthetic infrastructure"},
		{ID: 502, Path: "konepaja/verkkokauppa/api", Members: []int64{4001}, Description: "Synthetic shop API"},
		{ID: 503, Path: "konepaja/sisainen/uusi-palvelu", Members: []int64{4001}, Empty: true},
		{ID: 504, Path: "pankki-oy/digi/mobiili", Members: []int64{4001}, SSO: true, Description: "Requires an SSO session for Git"},
		{ID: 505, Path: gitlabFixtureUsername + "/dotfiles", NoStatistics: true},
	})
	if err != nil {
		return nil
	}
	return srv
}

// gitlabFixtureHome trusts the synthetic server's certificate for its own
// address in one synthetic home.
func gitlabFixtureHome(home string, srv *gitlabfake.Server) error {
	f, err := os.OpenFile(filepath.Join(home, ".gitconfig"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.WriteString("[http \"" + srv.URL + "\"]\n\tsslCAInfo = " + srv.CAFile + "\n")
	return err
}

func gitlabFixtureAdapter(env integrations.Env, srv *gitlabfake.Server, self string) *integrations.GitLabAdapter {
	if srv == nil {
		return nil
	}
	g, err := integrations.NewGitLab(env, nativegitlab.NewClientWithRoots(srv.Roots), "/usr/bin/git", self)
	if err != nil {
		return nil
	}
	return g
}

// gitlabFixtureControl serves /fixture/gitlab: enable or disable the
// provider, expire the fixture's token or renew it, or hold and release
// every Git transfer. Each answer names the address and the synthetic
// tokens a test types into the form.
func gitlabFixtureControl(srv *gitlabfake.Server, w http.ResponseWriter, r *http.Request) {
	if srv == nil {
		http.Error(w, "gitlab fixture unavailable", 503)
		return
	}
	switch r.URL.Query().Get("action") {
	case "enable":
		gitlabEnabled.Store(true)
	case "disable":
		gitlabEnabled.Store(false)
	case "expire":
		srv.SetToken(4001, gitlabfake.Token{Value: gitlabFixtureToken, Expired: true})
	case "renew":
		srv.SetToken(4001, gitlabfake.Token{Value: gitlabFixtureToken, ExpiresAt: "2027-10-27"})
	case "elsewhere":
		srv.SetHTTPURL(505, "http://gitlab.internal.example/"+gitlabFixtureUsername+"/dotfiles.git")
	default:
		http.Error(w, "unknown gitlab fixture action", 400)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"url": srv.URL, "token": gitlabFixtureToken, "readonly_token": gitlabReadOnlyToken, "expired_token": gitlabExpiredToken})
}
