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
}

// Repo is a repository owned by an account; Readers lists further account
// IDs that may read it (collaborators).
type Repo struct {
	ID          int64
	Owner, Name string
	Private     bool
	Empty       bool
	Description string
	Readers     []int64
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
	apiHits  int
	failing  map[string]bool // tokens whose API reads answer 500
	gate     chan struct{}   // while set, Git requests wait for it to close
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
	return false
}

func (s *Server) view(r Repo) map[string]any {
	full := r.Owner + "/" + r.Name
	branch := "main"
	if r.Empty {
		branch = ""
	}
	return map[string]any{
		"id": r.ID, "name": r.Name, "full_name": full, "owner": map[string]any{"id": 1, "login": r.Owner},
		"private": r.Private, "empty": r.Empty, "archived": false, "description": r.Description,
		"default_branch": branch, "updated_at": "2026-10-20T10:00:00+03:00", "size": 24,
		"html_url": s.URL + "/" + full, "clone_url": s.URL + "/" + full + ".git", "ssh_url": "git@127.0.0.1:" + full + ".git",
		"permissions": map[string]bool{"admin": false, "push": false, "pull": true},
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
				mine = append(mine, s.view(repo))
			}
		}
		start := min((page-1)*limit, len(mine))
		end := min(start+limit, len(mine))
		w.Header().Set("X-Total-Count", strconv.Itoa(len(mine)))
		_ = json.NewEncoder(w).Encode(mine[start:end])
	case strings.HasPrefix(r.URL.Path, "/api/v1/repositories/"):
		id, err := strconv.ParseInt(strings.TrimPrefix(r.URL.Path, "/api/v1/repositories/"), 10, 64)
		for _, repo := range repos {
			if err == nil && repo.ID == id && s.readable(a, repo) {
				_ = json.NewEncoder(w).Encode(s.view(repo))
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
	a, ok := s.account(pass)
	allowed := repo != nil && ok && basic && s.readable(a, *repo)
	if allowed {
		s.gitUsers = append(s.gitUsers, user)
	}
	gate := s.gate
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
	// A read-only grant: Gitea refuses receive-pack for read:repository.
	if rest == "/git-receive-pack" || r.URL.Query().Get("service") == "git-receive-pack" {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	h := &cgi.Handler{
		Path: "/usr/lib/git-core/git-http-backend",
		Root: "/",
		Env:  []string{"GIT_PROJECT_ROOT=" + s.root, "GIT_HTTP_EXPORT_ALL=1", "HOME=" + s.root, "GIT_CONFIG_NOSYSTEM=1", "PATH=/usr/bin:/bin"},
	}
	h.ServeHTTP(w, r)
}
