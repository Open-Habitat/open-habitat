// Package gitlabfake is a synthetic GitLab for same-UID tests and the
// synthetic browser host: the few API reads the connector makes, with
// keyset pagination and nested group paths, and real Git smart HTTP through
// git-http-backend, over TLS with a private test certificate, on loopback
// only. Accounts, tokens and projects are invented. It never ships in the
// product's daemon.
package gitlabfake

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
	"slices"
	"strconv"
	"strings"
	"sync"
)

// Token is one personal access token of an account.
type Token struct {
	Value string
	// Scopes are the legacy scopes. nil means the connector's own pair,
	// read_api and write_repository.
	Scopes []string
	// Fine marks a fine-grained token: its legacy scopes are empty and
	// /personal_access_tokens/self lists granular scopes instead. It reads
	// and pushes like read_api + write_repository.
	Fine bool
	// ExpiresAt is YYYY-MM-DD or "" for no expiry.
	ExpiresAt string
	// Expired tokens answer 401 "Token is expired"; Revoked ones a plain
	// 401.
	Expired, Revoked bool
	// NoSelf makes /personal_access_tokens/self answer 404, as an older
	// GitLab does.
	NoSelf bool
}

func (t Token) scopes() []string {
	if t.Fine {
		return []string{"read_api", "write_repository"}
	}
	if t.Scopes == nil {
		return []string{"read_api", "write_repository"}
	}
	return t.Scopes
}

func (t Token) has(any ...string) bool {
	for _, s := range t.scopes() {
		if slices.Contains(any, s) {
			return true
		}
	}
	return false
}

// Account is a GitLab user and its tokens.
type Account struct {
	ID       int64
	Username string
	Tokens   []Token
}

// Project is a project at a path; Members lists the account IDs that are
// members (a project in a user's namespace also has its user).
type Project struct {
	ID          int64
	Path        string // group/subgroup/.../project or user/project
	Visibility  string // private (default), internal or public
	Empty       bool
	Archived    bool
	Description string
	Members     []int64
	// HTTPURL replaces http_url_to_repo, as a GitLab whose external_url
	// names another address would.
	HTTPURL string
	// NoStatistics leaves statistics out, as for a Guest member.
	NoStatistics bool
	// SSO answers every Git request 403, as a group that enforces SSO for
	// Git does without a session.
	SSO bool
}

// GitRequest is one Git request the server received.
type GitRequest struct {
	Path string
	// User is the Basic username, "" when the request carried none.
	User string
}

// Server is a running synthetic GitLab.
type Server struct {
	// URL is the base the person types, https://127.0.0.1:<port>.
	URL string
	// CAFile holds the server's certificate as PEM, for Git's sslCAInfo.
	CAFile string
	// Roots trusts the server's certificate, for the Go client.
	Roots *x509.CertPool

	root string
	srv  *httptest.Server
	git  string

	mu       sync.Mutex
	accounts []Account
	projects []Project
	pageSize int
	requests []GitRequest
	apiPaths []string
	failing  map[string]bool
	gate     chan struct{}
}

// Start serves accounts and projects from fresh bare repositories under dir,
// which the caller owns and removes.
func Start(dir string, accounts []Account, projects []Project) (*Server, error) {
	s := &Server{root: filepath.Join(dir, "repositories"), git: "/usr/bin/git", accounts: accounts, failing: map[string]bool{}}
	if err := os.MkdirAll(s.root, 0o700); err != nil {
		return nil, err
	}
	for _, p := range projects {
		if err := s.AddProject(p); err != nil {
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
	s.CAFile = filepath.Join(dir, "gitlab-ca.pem")
	if err := os.WriteFile(s.CAFile, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: cert.Raw}), 0o600); err != nil {
		s.srv.Close()
		return nil, err
	}
	return s, nil
}

// Close stops the server.
func (s *Server) Close() { s.srv.Close() }

// SetPageSize caps every page at n projects (0 restores per_page).
func (s *Server) SetPageSize(n int) {
	s.mu.Lock()
	s.pageSize = n
	s.mu.Unlock()
}

// FailAPI makes every API read with token answer 500, as an unwell server.
func (s *Server) FailAPI(token string, fail bool) {
	s.mu.Lock()
	s.failing[token] = fail
	s.mu.Unlock()
}

// SetToken replaces or adds an account's token by its value.
func (s *Server) SetToken(id int64, t Token) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.accounts {
		if s.accounts[i].ID != id {
			continue
		}
		for j := range s.accounts[i].Tokens {
			if s.accounts[i].Tokens[j].Value == t.Value {
				s.accounts[i].Tokens[j] = t
				return
			}
		}
		s.accounts[i].Tokens = append(s.accounts[i].Tokens, t)
	}
}

// SetHTTPURL changes the http_url_to_repo GitLab reports for a project.
func (s *Server) SetHTTPURL(id int64, url string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.projects {
		if s.projects[i].ID == id {
			s.projects[i].HTTPURL = url
		}
	}
}

// GitRequests returns every Git request in order, whatever its answer.
func (s *Server) GitRequests() []GitRequest {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]GitRequest(nil), s.requests...)
}

// APIPaths returns the path and query of every API request in order.
func (s *Server) APIPaths() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.apiPaths...)
}

// Block holds every following Git request until the returned release is
// called, as a slow transfer would.
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

func (s *Server) gitCmd(dir string, args ...string) error {
	cmd := exec.Command(s.git, args...)
	cmd.Dir = dir
	cmd.Env = []string{"HOME=" + dir, "PATH=/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM=1", "GIT_CONFIG_GLOBAL=/dev/null", "GIT_AUTHOR_NAME=Fixture", "GIT_AUTHOR_EMAIL=fixture@example.invalid", "GIT_COMMITTER_NAME=Fixture", "GIT_COMMITTER_EMAIL=fixture@example.invalid", "LC_ALL=C"}
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git %s: %v: %s", args[0], err, out)
	}
	return nil
}

func (s *Server) bare(path string) string {
	return filepath.Join(s.root, filepath.FromSlash(path)+".git")
}

// AddProject creates a bare repository, with one commit unless p.Empty.
func (s *Server) AddProject(p Project) error {
	if p.Visibility == "" {
		p.Visibility = "private"
	}
	bare := s.bare(p.Path)
	if err := os.MkdirAll(filepath.Dir(bare), 0o700); err != nil {
		return err
	}
	if err := s.gitCmd(filepath.Dir(bare), "init", "-q", "--bare", "-b", "main", bare); err != nil {
		return err
	}
	s.mu.Lock()
	s.projects = append(s.projects, p)
	s.mu.Unlock()
	if p.Empty {
		return nil
	}
	return s.AddCommit(p.Path, "README.md", "synthetic "+p.Path+"\n")
}

// AddCommit pushes one commit writing file to the project's main branch, as
// another person pushing upstream would.
func (s *Server) AddCommit(path, file, content string) error {
	work, err := os.MkdirTemp(filepath.Dir(s.root), "work-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(work)
	if err := s.gitCmd(work, "clone", "-q", s.bare(path), "w"); err != nil {
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
	for i := range s.projects {
		if s.projects[i].Path == path {
			s.projects[i].Empty = false
		}
	}
	s.mu.Unlock()
	return nil
}

func (s *Server) token(value string) (Account, Token, bool) {
	for _, a := range s.accounts {
		for _, t := range a.Tokens {
			if value != "" && t.Value == value {
				return a, t, true
			}
		}
	}
	return Account{}, Token{}, false
}

func (s *Server) member(a Account, p Project) bool {
	if strings.HasPrefix(p.Path, a.Username+"/") {
		return true
	}
	return slices.Contains(p.Members, a.ID)
}

func (s *Server) view(p Project, accounts []Account) map[string]any {
	ns := p.Path[:strings.LastIndexByte(p.Path, '/')]
	kind := "group"
	for _, a := range accounts {
		if a.Username == ns {
			kind = "user"
		}
	}
	httpURL := s.URL + "/" + p.Path + ".git"
	if p.HTTPURL != "" {
		httpURL = p.HTTPURL
	}
	var branch any = "main"
	if p.Empty {
		branch = nil
	}
	v := map[string]any{
		"id": p.ID, "name": p.Path[strings.LastIndexByte(p.Path, '/')+1:], "path": p.Path[strings.LastIndexByte(p.Path, '/')+1:],
		"path_with_namespace": p.Path, "namespace": map[string]any{"full_path": ns, "kind": kind, "path": ns[strings.LastIndexByte(ns, '/')+1:]},
		"visibility": p.Visibility, "empty_repo": p.Empty, "archived": p.Archived, "description": p.Description,
		"default_branch": branch, "last_activity_at": "2026-10-20T10:00:00.000+03:00",
		"http_url_to_repo": httpURL, "web_url": s.URL + "/" + p.Path, "ssh_url_to_repo": "git@127.0.0.1:" + p.Path + ".git",
	}
	if !p.NoStatistics {
		v["statistics"] = map[string]any{"repository_size": 24 * 1024, "commit_count": 1}
	}
	return v
}

var gitPath = regexp.MustCompile(`^/((?:[A-Za-z0-9_.-]+/)+[A-Za-z0-9_.-]+)\.git(/.*)$`)

func (s *Server) serve(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/v4/") {
		s.api(w, r)
		return
	}
	if m := gitPath.FindStringSubmatch(r.URL.Path); m != nil {
		s.smartHTTP(w, r, m[1], m[2])
		return
	}
	http.NotFound(w, r)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (s *Server) api(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	s.apiPaths = append(s.apiPaths, r.URL.RequestURI())
	value := r.Header.Get("Private-Token")
	a, t, ok := s.token(value)
	failing := s.failing[value]
	projects := append([]Project(nil), s.projects...)
	accounts := append([]Account(nil), s.accounts...)
	pageSize := s.pageSize
	s.mu.Unlock()
	if r.Method != http.MethodGet {
		http.Error(w, "", http.StatusMethodNotAllowed)
		return
	}
	if failing {
		http.Error(w, "", http.StatusInternalServerError)
		return
	}
	switch {
	case !ok || t.Revoked:
		writeJSON(w, 401, map[string]string{"message": "401 Unauthorized"})
		return
	case t.Expired:
		writeJSON(w, 401, map[string]string{"error": "invalid_token", "error_description": "Token is expired. You can either do re-authorization or token refresh."})
		return
	}
	scope := func(any ...string) bool {
		if t.has(any...) {
			return true
		}
		writeJSON(w, 403, map[string]string{"error": "insufficient_scope", "error_description": "The request requires higher privileges than provided by the access token.", "scope": strings.Join(any, " ")})
		return false
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/v4")
	switch {
	case path == "/user":
		if scope("api", "read_api", "read_user") {
			writeJSON(w, 200, map[string]any{"id": a.ID, "username": a.Username, "name": a.Username, "state": "active"})
		}
	case path == "/personal_access_tokens/self":
		if t.NoSelf {
			writeJSON(w, 404, map[string]string{"message": "404 Not Found"})
			return
		}
		var expires any
		if t.ExpiresAt != "" {
			expires = t.ExpiresAt
		}
		v := map[string]any{"id": 1, "name": "Open Habitat", "revoked": false, "active": true, "scopes": t.scopes(), "expires_at": expires, "user_id": a.ID}
		if t.Fine {
			v["scopes"] = []string{}
			v["granular_scopes"] = []map[string]any{{"permission": "download_code"}, {"permission": "push_code"}}
		}
		writeJSON(w, 200, v)
	case path == "/projects":
		if !scope("api", "read_api") {
			return
		}
		q := r.URL.Query()
		if q.Get("membership") != "true" {
			http.Error(w, "the fake lists members' projects only", 400)
			return
		}
		per, _ := strconv.Atoi(q.Get("per_page"))
		if per < 1 || per > 100 {
			per = 20
		}
		if pageSize > 0 && per > pageSize {
			per = pageSize
		}
		after, _ := strconv.ParseInt(q.Get("id_after"), 10, 64)
		keyset := q.Get("pagination") == "keyset"
		mine := []Project{}
		for _, p := range projects {
			if s.member(a, p) && p.ID > after {
				mine = append(mine, p)
			}
		}
		slices.SortFunc(mine, func(x, y Project) int { return int(x.ID - y.ID) })
		page := mine[:min(per, len(mine))]
		out := []map[string]any{}
		for _, p := range page {
			v := s.view(p, accounts)
			if q.Get("simple") == "true" {
				delete(v, "archived")
				delete(v, "empty_repo")
			}
			if q.Get("statistics") != "true" {
				delete(v, "statistics")
			}
			out = append(out, v)
		}
		if keyset && len(mine) > len(page) {
			next := r.URL.Query()
			next.Set("id_after", strconv.FormatInt(page[len(page)-1].ID, 10))
			w.Header().Set("Link", "<"+s.URL+"/api/v4/projects?"+next.Encode()+`>; rel="next"`)
		}
		writeJSON(w, 200, out)
	case strings.HasPrefix(path, "/projects/"):
		if !scope("api", "read_api") {
			return
		}
		id, err := strconv.ParseInt(strings.TrimPrefix(path, "/projects/"), 10, 64)
		for _, p := range projects {
			if err == nil && p.ID == id && s.member(a, p) {
				v := s.view(p, accounts)
				if r.URL.Query().Get("statistics") != "true" {
					delete(v, "statistics")
				}
				writeJSON(w, 200, v)
				return
			}
		}
		writeJSON(w, 404, map[string]string{"message": "404 Project Not Found"})
	default:
		writeJSON(w, 404, map[string]string{"error": "404 Not Found"})
	}
}

func (s *Server) smartHTTP(w http.ResponseWriter, r *http.Request, path, rest string) {
	s.mu.Lock()
	var project *Project
	for i := range s.projects {
		if s.projects[i].Path == path {
			project = &s.projects[i]
		}
	}
	user, pass, basic := r.BasicAuth()
	s.requests = append(s.requests, GitRequest{Path: r.URL.Path, User: user})
	a, t, ok := s.token(pass)
	push := rest == "/git-receive-pack" || r.URL.Query().Get("service") == "git-receive-pack"
	authorized := project != nil && basic && user != "" && ok && !t.Expired && !t.Revoked && s.member(a, *project)
	// GitLab grants download_code to read_api as well (lib/gitlab/auth.rb).
	allowed := authorized && t.has("api", "read_api", "read_repository", "write_repository") && (!push || t.has("api", "write_repository"))
	sso := project != nil && project.SSO
	gate := s.gate
	s.mu.Unlock()
	if gate != nil {
		select {
		case <-gate:
		case <-r.Context().Done():
			return
		}
	}
	if project == nil {
		http.NotFound(w, r)
		return
	}
	switch {
	case !authorized:
		w.Header().Set("WWW-Authenticate", `Basic realm="GitLab"`)
		w.WriteHeader(http.StatusUnauthorized)
		return
	case sso || !allowed:
		w.WriteHeader(http.StatusForbidden)
		return
	}
	h := &cgi.Handler{
		Path: "/usr/lib/git-core/git-http-backend",
		Root: "/",
		Env:  []string{"GIT_PROJECT_ROOT=" + s.root, "GIT_HTTP_EXPORT_ALL=1", "HOME=" + s.root, "GIT_CONFIG_NOSYSTEM=1", "PATH=/usr/bin:/bin", "REMOTE_USER=" + user},
	}
	if push {
		// git-http-backend refuses receive-pack without this per-repository
		// setting; the fake decides authorization itself above.
		h.Env = append(h.Env, "GIT_CONFIG_COUNT=1", "GIT_CONFIG_KEY_0=http.receivepack", "GIT_CONFIG_VALUE_0=true")
	}
	h.ServeHTTP(w, r)
}
