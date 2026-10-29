// Package giteafake is a synthetic Gitea for same-UID tests and the
// synthetic browser host: the few API reads the connector makes and real Git
// smart HTTP through git-http-backend, over TLS with a private test
// certificate, on loopback only. Accounts, tokens and repositories are
// invented. It never ships in the product's daemon.
package giteafake

import (
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"net"
	"net/http"
	"net/http/cgi"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
)

// Account is a Gitea user and the one token that authenticates it.
type Account struct {
	ID    int64
	Login string
	Token string
	// Scopes are the token's scopes, as Gitea's scope picker sets them. nil
	// means the read-only pair read:user and read:repository. A read the
	// scopes do not cover answers 403, as Gitea does: /user needs read:user,
	// /user/repos both, the other repository reads and Git read:repository,
	// and Git's receive-pack write:repository. A write scope implies its read
	// scope.
	Scopes []string
}

// has reports whether the token's scopes cover category ("user" or
// "repository") for reading.
func (a Account) has(category string) bool {
	if a.Scopes == nil {
		return true
	}
	for _, s := range a.Scopes {
		if s == "all" || s == "read:"+category || s == "write:"+category {
			return true
		}
	}
	return false
}

// Repo is a repository owned by an account; Readers lists further account
// IDs that may read it and Writers those that may also push (collaborators).
type Repo struct {
	ID          int64
	Owner, Name string
	Private     bool
	Empty       bool
	Description string
	Readers     []int64
	Writers     []int64
	// CloneURL replaces the clone_url the API reports, as a Gitea whose
	// configured root URL names another host would.
	CloneURL string
	// RedirectTo answers an authenticated Git request with a redirect to
	// this URL plus the request's path below the repository.
	RedirectTo string
}

// GitRequest is one Git request the server received.
type GitRequest struct {
	Path string
	// User is the Basic username, "" when the request carried none.
	User string
}

// Server is a running synthetic Gitea.
type Server struct {
	// URL is the base the person types, https://127.0.0.1:<port>.
	URL string
	// CAFile holds the server's certificate as PEM, for Git's sslCAInfo.
	CAFile string
	// Roots trusts the server's certificate, for the Go client.
	Roots *x509.CertPool
	// PageLimit caps the page size the API answers with, as a Gitea's
	// MAX_RESPONSE_ITEMS does; 0 keeps the requested limit.
	PageLimit atomic.Int32

	root string
	srv  *httptest.Server
	git  string

	mu       sync.Mutex
	accounts []Account
	repos    []Repo
	// GitUsers records the Basic usernames of authorized Git requests.
	gitUsers []string
	requests []GitRequest
	apiHits  int
	failing  map[string]bool // tokens whose API reads answer 500
	// httpGitOff refuses receive-pack as a Gitea with DISABLE_HTTP_GIT does.
	httpGitOff bool
	gate       chan struct{} // while set, Git requests wait for it to close
}

// Block holds every following Git request until the returned release is
// called, as a slow transfer would; tests use it to observe a running clone.
func (s *Server) Block() (release func()) {
	gate := make(chan struct{})
	s.mu.Lock()
	s.gate = gate
	s.mu.Unlock()
	var once sync.Once
	return func() {
		once.Do(func() {
			s.mu.Lock()
			if s.gate == gate {
				s.gate = nil
			}
			s.mu.Unlock()
			close(gate)
		})
	}
}

var gitPath = regexp.MustCompile(`^/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)\.git(/.*)$`)

// Start serves accounts and repos from fresh bare repositories under dir,
// which the caller owns and removes.
func Start(dir string, accounts []Account, repos []Repo) (*Server, error) {
	s := &Server{root: filepath.Join(dir, "repositories"), git: "/usr/bin/git", accounts: accounts, failing: map[string]bool{}}
	if err := os.MkdirAll(s.root, 0o700); err != nil {
		return nil, err
	}
	for _, r := range repos {
		if err := s.AddRepo(r); err != nil {
			return nil, err
		}
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, err
	}
	s.srv = httptest.NewUnstartedServer(http.HandlerFunc(s.serve))
	s.srv.Listener.Close()
	s.srv.Listener = ln
	s.srv.StartTLS()
	s.URL = s.srv.URL
	cert := s.srv.Certificate()
	s.Roots = x509.NewCertPool()
	s.Roots.AddCert(cert)
	s.CAFile = filepath.Join(dir, "gitea-ca.pem")
	if err := os.WriteFile(s.CAFile, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: cert.Raw}), 0o600); err != nil {
		s.srv.Close()
		return nil, err
	}
	return s, nil
}

// Close stops the server.
func (s *Server) Close() { s.srv.Close() }

// GitUsers returns the usernames Git authenticated with, in order.
func (s *Server) GitUsers() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.gitUsers...)
}

// GitRequests returns every Git request in order, whatever its answer.
func (s *Server) GitRequests() []GitRequest {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]GitRequest(nil), s.requests...)
}

// SetRedirect makes owner/name's authenticated Git requests redirect to
// target ("" stops it).
func (s *Server) SetRedirect(owner, name, target string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.repos {
		if s.repos[i].Owner == owner && s.repos[i].Name == name {
			s.repos[i].RedirectTo = target
		}
	}
}

// APIHits counts API requests.
func (s *Server) APIHits() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.apiHits
}

// FailAPI makes every API read with token answer 500, as an unwell server.
func (s *Server) FailAPI(token string, fail bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.failing[token] = fail
}

// SetScopes replaces an account's token scopes (nil restores the default
// pair), as a token created anew with other scopes would have.
func (s *Server) SetScopes(id int64, scopes []string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.accounts {
		if s.accounts[i].ID == id {
			s.accounts[i].Scopes = scopes
		}
	}
}

// DisableHTTPPush makes receive-pack answer Gitea's DISABLE_HTTP_GIT
// refusal (403 with its own text) to a write-scoped token.
func (s *Server) DisableHTTPPush() {
	s.mu.Lock()
	s.httpGitOff = true
	s.mu.Unlock()
}

// SetToken replaces an account's token, as rotating a PAT at Gitea does.
func (s *Server) SetToken(id int64, token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.accounts {
		if s.accounts[i].ID == id {
			s.accounts[i].Token = token
		}
	}
}

func (s *Server) gitCmd(dir string, args ...string) error {
	cmd := exec.Command(s.git, args...)
	cmd.Dir = dir
	cmd.Env = []string{"HOME=" + dir, "PATH=/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM=1", "GIT_CONFIG_GLOBAL=/dev/null", "GIT_AUTHOR_NAME=Fixture", "GIT_AUTHOR_EMAIL=fixture@example.invalid", "GIT_COMMITTER_NAME=Fixture", "GIT_COMMITTER_EMAIL=fixture@example.invalid", "LC_ALL=C"}
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git %s: %v: %s", args[0], err, out)
	}
	return nil
}

func (s *Server) bare(owner, name string) string {
	return filepath.Join(s.root, owner, name+".git")
}

// AddRepo creates a bare repository, with one commit unless r.Empty.
func (s *Server) AddRepo(r Repo) error {
	bare := s.bare(r.Owner, r.Name)
	if err := os.MkdirAll(filepath.Dir(bare), 0o700); err != nil {
		return err
	}
	if err := s.gitCmd(filepath.Dir(bare), "init", "-q", "--bare", "-b", "main", bare); err != nil {
		return err
	}
	s.mu.Lock()
	s.repos = append(s.repos, r)
	s.mu.Unlock()
	if r.Empty {
		return nil
	}
	return s.AddCommit(r.Owner, r.Name, "README.md", "synthetic "+r.Name+"\n")
}

// AddCommit pushes one commit writing file to the repository's main branch,
// as another person pushing upstream would.
func (s *Server) AddCommit(owner, name, file, content string) error {
	work, err := os.MkdirTemp(filepath.Dir(s.root), "work-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(work)
	bare := s.bare(owner, name)
	if err := s.gitCmd(work, "clone", "-q", bare, "w"); err != nil {
		return err
	}
	w := filepath.Join(work, "w")
	if err := os.WriteFile(filepath.Join(w, file), []byte(content), 0o600); err != nil {
		return err
	}
	for _, args := range [][]string{{"add", "--", file}, {"commit", "-q", "-m", "synthetic " + file}, {"push", "-q", "origin", "HEAD:main"}} {
		if err := s.gitCmd(w, args...); err != nil {
			return err
		}
	}
	s.mu.Lock()
	for i := range s.repos {
		if s.repos[i].Owner == owner && s.repos[i].Name == name {
			s.repos[i].Empty = false
		}
	}
	s.mu.Unlock()
	return nil
}

func (s *Server) account(token string) (Account, bool) {
	for _, a := range s.accounts {
		if token != "" && a.Token == token {
			return a, true
		}
	}
	return Account{}, false
}

// writes reports whether the token's scopes cover category for writing.
func (a Account) writes(category string) bool {
	for _, s := range a.Scopes {
		if s == "all" || s == "write:"+category {
			return true
		}
	}
	return false
}

// pushable is the account's own right to push to r, whatever its token's
// scopes: the owner and the Writers.
func (s *Server) pushable(a Account, r Repo) bool {
	if a.Login == r.Owner {
		return true
	}
	for _, id := range r.Writers {
		if id == a.ID {
			return true
		}
	}
	return false
}

func (s *Server) readable(a Account, r Repo) bool {
	owner := false
	for _, o := range s.accounts {
		if o.ID == a.ID && o.Login == r.Owner {
			owner = true
		}
	}
	if owner {
		return true
	}
	for _, id := range r.Readers {
		if id == a.ID {
			return true
		}
	}
	return s.pushable(a, r)
}

// view is r as viewer's API answers show it. Its permissions are the
// account's, as Gitea's are: a read-only token still sees push: true.
func (s *Server) view(r Repo, viewer Account, accounts []Account) map[string]any {
	full := r.Owner + "/" + r.Name
	branch := "main"
	if r.Empty {
		branch = ""
	}
	clone := s.URL + "/" + full + ".git"
	if r.CloneURL != "" {
		clone = r.CloneURL
	}
	// An owner that is no account here stands for an organisation.
	ownerID := int64(1000) + r.ID
	for _, a := range accounts {
		if a.Login == r.Owner {
			ownerID = a.ID
		}
	}
	return map[string]any{
		"id": r.ID, "name": r.Name, "full_name": full, "owner": map[string]any{"id": ownerID, "login": r.Owner},
		"private": r.Private, "empty": r.Empty, "archived": false, "description": r.Description,
		"default_branch": branch, "updated_at": "2026-10-20T10:00:00+03:00", "size": 24,
		"html_url": s.URL + "/" + full, "clone_url": clone, "ssh_url": "git@127.0.0.1:" + full + ".git",
		"mirror": false, "permissions": map[string]bool{"admin": false, "push": s.pushable(viewer, r), "pull": true},
	}
}

func (s *Server) serve(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/v1/") {
		s.api(w, r)
		return
	}
	if m := gitPath.FindStringSubmatch(r.URL.Path); m != nil {
		s.smartHTTP(w, r, m[1], m[2], m[3])
		return
	}
	http.NotFound(w, r)
}

func (s *Server) api(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	s.apiHits++
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "token ")
	a, ok := s.account(token)
	failing := s.failing[token]
	repos := append([]Repo(nil), s.repos...)
	accounts := append([]Account(nil), s.accounts...)
	s.mu.Unlock()
	if r.Method != http.MethodGet {
		http.Error(w, "", http.StatusMethodNotAllowed)
		return
	}
	if failing {
		http.Error(w, "", http.StatusInternalServerError)
		return
	}
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	// Gitea 1.25.4 groups /user/repos under /user too, so it needs both.
	scope := "repository"
	if r.URL.Path == "/api/v1/user" || (r.URL.Path == "/api/v1/user/repos" && !a.has("user")) {
		scope = "user"
	}
	if !a.has(scope) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"message":"token does not have at least one of required scope(s): [read:` + scope + `]"}`))
		return
	}
	w.Header().Set("Content-Type", "application/json")
	switch {
	case r.URL.Path == "/api/v1/user":
		_ = json.NewEncoder(w).Encode(map[string]any{"id": a.ID, "login": a.Login, "email": a.Login + "@example.invalid"})
	case r.URL.Path == "/api/v1/user/repos":
		page, _ := strconv.Atoi(r.URL.Query().Get("page"))
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		if cap := int(s.PageLimit.Load()); cap > 0 && (limit <= 0 || limit > cap) {
			limit = cap
		}
		if page < 1 || limit < 1 {
			http.Error(w, "", http.StatusBadRequest)
			return
		}
		mine := []map[string]any{}
		for _, repo := range repos {
			if s.readable(a, repo) {
				mine = append(mine, s.view(repo, a, accounts))
			}
		}
		start := min((page-1)*limit, len(mine))
		end := min(start+limit, len(mine))
		w.Header().Set("X-Total-Count", strconv.Itoa(len(mine)))
		// Gitea links the next page from its configured root URL.
		if end < len(mine) {
			q := r.URL.Query()
			q.Set("page", strconv.Itoa(page+1))
			w.Header().Set("Link", "<"+s.URL+"/api/v1/user/repos?"+q.Encode()+`>; rel="next"`)
		}
		_ = json.NewEncoder(w).Encode(mine[start:end])
	case strings.HasPrefix(r.URL.Path, "/api/v1/repositories/"):
		id, err := strconv.ParseInt(strings.TrimPrefix(r.URL.Path, "/api/v1/repositories/"), 10, 64)
		for _, repo := range repos {
			if err == nil && repo.ID == id && s.readable(a, repo) {
				_ = json.NewEncoder(w).Encode(s.view(repo, a, accounts))
				return
			}
		}
		http.NotFound(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) smartHTTP(w http.ResponseWriter, r *http.Request, owner, name, rest string) {
	s.mu.Lock()
	var repo *Repo
	for i := range s.repos {
		if s.repos[i].Owner == owner && s.repos[i].Name == name {
			repo = &s.repos[i]
		}
	}
	user, pass, basic := r.BasicAuth()
	s.requests = append(s.requests, GitRequest{Path: r.URL.Path, User: user})
	a, ok := s.account(pass)
	allowed := repo != nil && ok && basic && a.has("repository") && s.readable(a, *repo)
	if allowed {
		s.gitUsers = append(s.gitUsers, user)
	}
	redirect := ""
	if allowed {
		redirect = repo.RedirectTo
	}
	gate, gitOff := s.gate, s.httpGitOff
	s.mu.Unlock()
	if gate != nil {
		select {
		case <-gate:
		case <-r.Context().Done():
			return
		}
	}
	if repo == nil {
		http.NotFound(w, r)
		return
	}
	if !allowed {
		w.Header().Set("WWW-Authenticate", `Basic realm="Gitea"`)
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	if redirect != "" {
		target := redirect + rest
		if r.URL.RawQuery != "" {
			target += "?" + r.URL.RawQuery
		}
		http.Redirect(w, r, target, http.StatusFound)
		return
	}
	env := []string{"GIT_PROJECT_ROOT=" + s.root, "GIT_HTTP_EXPORT_ALL=1", "HOME=" + s.root, "GIT_CONFIG_NOSYSTEM=1", "PATH=/usr/bin:/bin"}
	if rest == "/git-receive-pack" || r.URL.Query().Get("service") == "git-receive-pack" {
		// Gitea refuses HTTP Git when it is turned off, then checks the
		// token's scope at write level (a bare 403). The account's own right
		// to push it leaves to the push itself (Git's proc-receive), so the
		// advertisement still answers and only the push is refused.
		if gitOff {
			w.WriteHeader(http.StatusForbidden)
			_, _ = w.Write([]byte("Interacting with repositories by HTTP protocol is not allowed"))
			return
		}
		if !a.writes("repository") {
			http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
			return
		}
		if !s.pushable(a, *repo) && rest == "/git-receive-pack" {
			http.Error(w, "User permission denied", http.StatusForbidden)
			return
		}
		env = append(env, "GIT_CONFIG_COUNT=1", "GIT_CONFIG_KEY_0=http.receivepack", "GIT_CONFIG_VALUE_0=true")
	}
	h := &cgi.Handler{
		Path: "/usr/lib/git-core/git-http-backend",
		Root: "/",
		Env:  env,
	}
	h.ServeHTTP(w, r)
}
