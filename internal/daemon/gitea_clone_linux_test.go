//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/daemon/integrations"
	"github.com/open-habitat/open-habitat/internal/nativegitea"
	"github.com/open-habitat/open-habitat/internal/nativegitea/giteafake"
	"github.com/open-habitat/open-habitat/internal/testgitenv"
)

// TestMain lets Git run this test binary as the registered Gitea helper:
// invoked as `<binary> gitea git-credential <op>` it answers as the product
// helper does. As a test binary it first drops the caller's repository-bound
// Git variables, so no fixture's git reaches the checkout it was run from.
func TestMain(m *testing.M) {
	if len(os.Args) == 4 && os.Args[1] == "gitea" && os.Args[2] == "git-credential" {
		os.Exit(giteaHelperForTest(os.Args[3]))
	}
	if len(os.Args) == 4 && os.Args[1] == "gitlab" && os.Args[2] == "git-credential" {
		os.Exit(gitlabHelperForTest(os.Args[3]))
	}
	testgitenv.Scrub()
	os.Exit(m.Run())
}

// giteaHelperForTest makes the nativegitea calls internal/cli's `gitea
// git-credential` makes, from the environment Git gives it. The CLI's own
// tests cover its argument and error surface with real Git; this package
// cannot import it.
func giteaHelperForTest(op string) int {
	if op != "get" {
		_, _ = io.Copy(io.Discard, os.Stdin)
		return 0
	}
	req, err := nativegitea.ParseCredentialRequest(os.Stdin)
	if err != nil {
		return 1
	}
	store, err := nativegitea.StoreFromEnvironment()
	if err != nil {
		return 2
	}
	c, err := store.Credential(req, "")
	if err != nil {
		// As the CLI: no match is an ordinary empty answer, an unreadable
		// tea state a failure.
		var ge *nativegitea.Error
		if errors.As(err, &ge) && (ge.Code() == "no_match" || ge.Code() == "ambiguous") {
			return 0
		}
		return 2
	}
	if nativegitea.WriteCredential(os.Stdout, c) != nil {
		return 2
	}
	return 0
}

type giteaWalk struct {
	t       *testing.T
	home    string
	srv     *giteafake.Server
	adapter *integrations.GiteaAdapter
	routes  *httptest.Server
	agent   *httptest.Server
	clones  *cloneJobsFixture
	tools   map[string]string
	exe     string
}

func newGiteaWalk(t *testing.T) *giteaWalk {
	t.Helper()
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	return newGiteaWalkAt(t, exe)
}

// newGiteaWalkAt registers exe, a copy of this test binary or a path that
// reaches one, as the Git helper.
func newGiteaWalkAt(t *testing.T, exe string) *giteaWalk {
	t.Helper()
	if _, err := os.Stat("/usr/lib/git-core/git-http-backend"); err != nil {
		t.Skip("git-http-backend unavailable")
	}
	home := t.TempDir()
	if err := os.Chmod(home, 0o700); err != nil {
		t.Fatal(err)
	}
	srv, err := giteafake.Start(t.TempDir(), []giteafake.Account{{ID: 7, Login: "ada", Token: "tok-ada-0001"}, {ID: 8, Login: "bob", Token: "tok-bob-0002"}}, []giteafake.Repo{
		{ID: 101, Owner: "ada", Name: "notes", Private: true},
		{ID: 102, Owner: "ada", Name: "blank", Private: true, Empty: true},
		{ID: 103, Owner: "bob", Name: "notes", Private: true},
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(srv.Close)
	// The operator's CA is an OS trust prerequisite; the synthetic one is
	// trusted only for this server, in this disposable home.
	if err := os.WriteFile(filepath.Join(home, ".gitconfig"), []byte("[http \""+srv.URL+"\"]\n\tsslCAInfo = "+srv.CAFile+"\n[credential \"https://github.com\"]\n\thelper = \n\thelper = !/usr/bin/gh auth git-credential\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	w := &giteaWalk{t: t, home: home, srv: srv, exe: exe, tools: map[string]string{"tea": "/usr/bin/true"}}
	env := integrations.Env{Home: home, FixtureTools: true, LoadConfig: func() (integrations.Config, error) { return integrations.Config{Tools: w.tools}, nil }}
	w.adapter, err = integrations.NewGitea(env, nativegitea.NewClientWithRoots(srv.Roots), "/usr/bin/git", exe)
	if err != nil {
		t.Fatal(err)
	}
	catalog := integrations.New(env, nil, nil, integrations.WithGitea(w.adapter))
	w.routes = httptest.NewServer(catalog.Handler(func(*http.Request) bool { return true }))
	t.Cleanup(w.routes.Close)
	w.agent = httptest.NewServer(catalog.AgentHandler(func(*http.Request) bool { return true }, AgentIntegrationsPath, AgentIntegrationAccountsPath, AgentIntegrationLoginPath, AgentGiteaPath, AgentGitLabPath))
	t.Cleanup(w.agent.Close)
	w.clones = newCloneJobsFixture(t, home, "/usr/bin/git")
	w.clones.jobs.gitea, w.clones.jobs.forgeGit = w.adapter, "/usr/bin/git"
	return w
}

func (w *giteaWalk) request(method, path, body string) (int, map[string]any, string) {
	w.t.Helper()
	return w.requestAt(w.routes, method, path, body)
}

func (w *giteaWalk) requestAt(srv *httptest.Server, method, path, body string) (int, map[string]any, string) {
	w.t.Helper()
	var r *http.Request
	if body == "" {
		r, _ = http.NewRequest(method, srv.URL+path, nil)
	} else {
		r, _ = http.NewRequest(method, srv.URL+path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
	}
	resp, err := http.DefaultClient.Do(r)
	if err != nil {
		w.t.Fatal(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	return resp.StatusCode, out, string(raw)
}

func (w *giteaWalk) gitea(method, body string) (int, map[string]any, string) {
	return w.request(method, integrations.GiteaPath, body)
}

func code(out map[string]any) string {
	e, _ := out["error"].(map[string]any)
	c, _ := e["code"].(string)
	return c
}

func (w *giteaWalk) connect(base, token string) string {
	w.t.Helper()
	status, out, raw := w.gitea("POST", `{"action":"connect","base_url":"`+base+`","token":"`+token+`"}`)
	conn, _ := out["connection"].(map[string]any)
	if status != 200 || out["api"] != "ok" || conn["git"] != "registered" || conn["kind"] != "pat" || conn["owned"] != true {
		w.t.Fatalf("connect %s: %d %s", token, status, raw)
	}
	if strings.Contains(raw, token) {
		w.t.Fatalf("token in reply: %s", raw)
	}
	return conn["id"].(string)
}

func (w *giteaWalk) clone(connection string, repository int) (int, map[string]any) {
	w.t.Helper()
	return w.clones.action(`{"action":"start","source":"gitea","connection_id":"` + connection + `","repository_id":` + strconv.Itoa(repository) + `,"mode":"full"}`)
}

func (w *giteaWalk) waitJob(id string) map[string]any {
	w.t.Helper()
	for deadline := time.Now().Add(30 * time.Second); time.Now().Before(deadline); time.Sleep(20 * time.Millisecond) {
		for _, j := range w.clones.list()["jobs"].([]any) {
			job := j.(map[string]any)
			if job["job_id"] == id && job["state"] != "running" {
				return job
			}
		}
	}
	w.t.Fatal("clone did not finish")
	return nil
}

func (w *giteaWalk) fetch(name string) string {
	w.t.Helper()
	cfg := w.clones.cfg
	for _, entry := range Discover(cfg).Entries {
		if entry.Name == name {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			return fetchWorkspaceGit(ctx, cfg, workspaceGitTarget(cfg, entry), "/usr/bin/git", 20*time.Second, Forges{Gitea: w.adapter})
		}
	}
	w.t.Fatalf("workspace %s not discovered", name)
	return ""
}

func (w *giteaWalk) git(dir string, args ...string) string {
	w.t.Helper()
	cmd := exec.Command("/usr/bin/git", args...)
	cmd.Dir = dir
	cmd.Env = []string{"HOME=" + w.home, "PATH=/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM=1"}
	out, err := cmd.Output()
	if err != nil {
		w.t.Fatalf("git %v: %v", args, err)
	}
	return strings.TrimSpace(string(out))
}

// The walking path: the form's address and PAT → one native tea entry and
// a secretless helper → the connection's repositories → an ordinary clone
// job into ~/src → a native fetch that reads the same tea entry again.
// Two accounts on one Gitea stay separate grants throughout.
func TestGiteaConnectListCloneFetch(t *testing.T) {
	w := newGiteaWalk(t)
	host := strings.TrimPrefix(w.srv.URL, "https://")

	// Refusals write nothing.
	w.tools = map[string]string{}
	if status, out, _ := w.gitea("POST", `{"action":"connect","base_url":"`+host+`","token":"tok-ada-0001"}`); status != 409 || code(out) != "provider_unavailable" {
		t.Fatalf("unavailable tool: %d %v", status, out)
	}
	w.tools = map[string]string{"tea": "/usr/bin/true"}
	if status, out, _ := w.gitea("POST", `{"action":"connect","base_url":"`+host+`","token":"wrong-token"}`); status != 422 || code(out) != "token_rejected" {
		t.Fatalf("rejected token: %d %v", status, out)
	}
	if status, out, _ := w.gitea("POST", `{"action":"connect","base_url":"http://`+host+`","token":"tok-ada-0001"}`); status != 422 || code(out) != "invalid_address" {
		t.Fatalf("http address: %d %v", status, out)
	}
	tea := filepath.Join(w.home, ".config", "tea", "config.yml")
	if _, err := os.Stat(tea); !os.IsNotExist(err) {
		t.Fatalf("a refused connect wrote tea's file: %v", err)
	}
	for _, bad := range []string{
		`{"action":"check","connection_id":"gitea_0123456789abcdef01234567","token":"x"}`,
		`{"action":"connect","base_url":"` + host + `","token":"x","connection_id":"gitea_0123456789abcdef01234567"}`,
		`{"action":"connect","base_url":"` + host + `","token":"x","user":"ada"}`,
		`{"action":"disconnect","connection_id":"gitea_0123456789abcdef01234567"}`,
	} {
		if status, _, _ := w.gitea("POST", bad); status != 400 {
			t.Fatalf("shape %s: %d", bad, status)
		}
	}

	// "https://" is inferred only when absent.
	ada := w.connect(host, "tok-ada-0001")
	bob := w.connect(w.srv.URL, "tok-bob-0002")
	if status, out, _ := w.gitea("POST", `{"action":"connect","base_url":"`+host+`","token":"tok-ada-0001"}`); status != 200 || out["outcome"] != "unchanged" {
		t.Fatalf("repeated connect is observed, not replayed: %d %v", status, out)
	}
	if b, _ := os.ReadFile(tea); !strings.Contains(string(b), "tok-ada-0001") || !strings.Contains(string(b), "tok-bob-0002") {
		t.Fatal("tokens are not in tea's own file")
	}
	gitconfig, _ := os.ReadFile(filepath.Join(w.home, ".gitconfig"))
	if strings.Contains(string(gitconfig), "tok-") || !strings.Contains(string(gitconfig), w.exe+" gitea git-credential") {
		t.Fatalf("git configuration: %s", gitconfig)
	}

	_, list, raw := w.request("GET", integrations.ListPath, "")
	gitea, _ := list["gitea"].(map[string]any)
	if gitea["state"] != "ok" || len(gitea["connections"].([]any)) != 2 || strings.Contains(raw, "tok-") {
		t.Fatalf("list: %s", raw)
	}

	status, repos, raw := w.request("GET", integrations.GiteaReposPath, "")
	if status != 200 || strings.Contains(raw, "tok-") {
		t.Fatalf("repos: %d %s", status, raw)
	}
	names := map[string][]string{}
	for _, s := range repos["sources"].([]any) {
		source := s.(map[string]any)
		if source["state"] != "ok" || source["complete"] != true {
			t.Fatalf("source: %v", source)
		}
		for _, r := range source["repositories"].([]any) {
			names[source["connection_id"].(string)] = append(names[source["connection_id"].(string)], r.(map[string]any)["full_name"].(string))
		}
	}
	if strings.Join(names[ada], ",") != "ada/notes,ada/blank" || strings.Join(names[bob], ",") != "bob/notes" {
		t.Fatalf("each account lists only its own repositories: %v", names)
	}

	// Empty repositories share the successful native-index finalisation.
	status, empty := w.clone(ada, 102)
	if status != 200 {
		t.Fatalf("empty repository: %d %v", status, empty)
	}
	if done := w.waitJob(empty["job"].(map[string]any)["job_id"].(string)); done["state"] != "confirmed" {
		t.Fatalf("empty clone: %v", done)
	}
	if _, err := os.Stat(filepath.Join(w.home, "src", "blank", ".git", "index")); err != nil {
		t.Fatal(err)
	}
	if status, out := w.clone(ada, 103); status != 503 || code(out) != "native_source_unavailable" {
		t.Fatalf("another account's repository: %d %v", status, out)
	}

	// A personal conditional include that adds a storing helper only inside
	// ~/src is invisible from home; the clone still keeps the token out of it.
	include := filepath.Join(w.home, ".gitconfig-src")
	if err := os.WriteFile(include, []byte("[credential]\n\thelper = store\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	gc, _ := os.OpenFile(filepath.Join(w.home, ".gitconfig"), os.O_APPEND|os.O_WRONLY, 0o600)
	_, _ = gc.WriteString("[includeIf \"gitdir:" + w.home + "/src/\"]\n\tpath = " + include + "\n")
	gc.Close()
	// A running clone holds its connection: disconnect waits for it.
	release := w.srv.Block()
	status, started := w.clone(ada, 101)
	job, _ := started["job"].(map[string]any)
	source, _ := job["source"].(map[string]any)
	if status != 200 || job["full_name"] != "ada/notes" || source["connection_id"] != ada || source["repository_id"] != 101.0 {
		t.Fatalf("start: %d %v", status, started)
	}
	if status, out, _ := w.gitea("DELETE", `{"action":"disconnect","connection_id":"`+ada+`"}`); status != 409 || code(out) != "clone_running" {
		t.Fatalf("disconnect during clone: %d %v", status, out)
	}
	release()
	if done := w.waitJob(job["job_id"].(string)); done["state"] != "confirmed" {
		t.Fatalf("clone: %v", done)
	}
	checkout := filepath.Join(w.home, "src", "notes")
	remote := w.git(checkout, "remote", "get-url", "origin")
	if remote != w.srv.URL+"/ada/notes.git" {
		t.Fatalf("origin %q", remote)
	}
	if got := w.git(checkout, "config", "--get", "credential."+remote+".username"); got != "ada" {
		t.Fatalf("clone's account %q", got)
	}
	// The exact remote is the most specific HTTP scope: a broader personal
	// setting cannot turn TLS checks or redirects back on for it.
	if w.git(checkout, "config", "--get-urlmatch", "http.sslVerify", remote) != "true" || w.git(checkout, "config", "--get-urlmatch", "http.followRedirects", remote) != "false" {
		t.Fatal("clone's HTTP policy is not pinned to its remote")
	}
	if b, _ := os.ReadFile(filepath.Join(checkout, ".git", "config")); strings.Contains(string(b), "tok-") {
		t.Fatal("token in the clone's configuration")
	}
	if _, err := os.Stat(filepath.Join(w.home, ".git-credentials")); !os.IsNotExist(err) {
		t.Fatal("a second credential store appeared")
	}
	// The include stays for the fetches below, which are pinned the same way.
	// The same name from the other account is a name conflict, never an
	// overwrite.
	if status, out := w.clone(bob, 103); status != 409 || code(out) != "checkout_exists" {
		t.Fatalf("same-name clone: %d %v", status, out)
	}

	// Fetch is the workspace's ordinary native fetch.
	if err := w.srv.AddCommit("ada", "notes", "CHANGES.md", "later\n"); err != nil {
		t.Fatal(err)
	}
	before := len(w.srv.GitUsers())
	if got := w.fetch("notes"); got != "" {
		t.Fatalf("fetch: %s", got)
	}
	if users := w.srv.GitUsers()[before:]; len(users) == 0 || users[0] != "ada" {
		t.Fatalf("fetch authenticated as %v", users)
	}
	if w.git(checkout, "rev-list", "--count", "HEAD..origin/main") != "1" {
		t.Fatal("fetch did not bring the upstream commit")
	}

	// A rotated PAT: the old one fails, the replacement is read by the next
	// fetch, and another account's PAT cannot take this connection over.
	w.srv.SetToken(7, "tok-ada-0003")
	if _, out, _ := w.gitea("POST", `{"action":"check","connection_id":"`+ada+`"}`); out["api"] != "token_rejected" || out["outcome"] != "checked" {
		t.Fatalf("check after rotation: %v", out)
	}
	if got := w.fetch("notes"); got != "remote_auth_unavailable" {
		t.Fatalf("fetch with the revoked PAT: %q", got)
	}
	teaBefore, _ := os.ReadFile(tea)
	if status, out, _ := w.gitea("POST", `{"action":"replace","connection_id":"`+ada+`","token":"tok-bob-0002"}`); status != 409 && status != 422 || (code(out) != "account_mismatch" && code(out) != "connection_exists") {
		t.Fatalf("replace with another account's PAT: %d %v", status, out)
	}
	if teaAfter, _ := os.ReadFile(tea); string(teaAfter) != string(teaBefore) {
		t.Fatal("refused replacement changed tea's file")
	}
	if status, out, raw := w.gitea("POST", `{"action":"replace","connection_id":"`+ada+`","token":"tok-ada-0003"}`); status != 200 || out["outcome"] != "written" || strings.Contains(raw, "tok-") {
		t.Fatalf("replace: %d %s", status, raw)
	}
	if got := w.fetch("notes"); got != "" {
		t.Fatalf("fetch after replacement: %q", got)
	}
	if _, err := os.Stat(filepath.Join(w.home, ".git-credentials")); !os.IsNotExist(err) {
		t.Fatal("a fetch gave the storing helper a copy")
	}

	// Disconnect removes the local entry only: the clone stays, the helper
	// stays for bob's account on the same base, and ada's clone does not
	// fall back to bob's token.
	if status, out, _ := w.gitea("DELETE", `{"action":"disconnect","connection_id":"`+ada+`"}`); status != 200 || out["outcome"] != "written" {
		t.Fatalf("disconnect: %d %v", status, out)
	}
	if _, err := os.Stat(checkout); err != nil {
		t.Fatal("disconnect touched the clone")
	}
	before = len(w.srv.GitUsers())
	if got := w.fetch("notes"); got != "remote_auth_unavailable" {
		t.Fatalf("fetch after disconnect: %q", got)
	}
	if users := w.srv.GitUsers()[before:]; len(users) != 0 {
		t.Fatalf("a disconnected clone authenticated as %v", users)
	}
	if b, _ := os.ReadFile(filepath.Join(w.home, ".gitconfig")); !strings.Contains(string(b), w.exe+" gitea git-credential") {
		t.Fatal("helper removed while another account of the base remains")
	}
	if status, out, _ := w.gitea("DELETE", `{"action":"disconnect","connection_id":"`+bob+`"}`); status != 200 || out["outcome"] != "written" {
		t.Fatalf("disconnect bob: %d %v", status, out)
	}
	if b, _ := os.ReadFile(filepath.Join(w.home, ".gitconfig")); strings.Contains(string(b), "git-credential") && strings.Contains(string(b), w.exe) {
		t.Fatalf("helper kept after the base's last account: %s", b)
	}
	if status, out := w.clone(ada, 101); status != 409 || code(out) != "gitea_connection_unavailable" {
		t.Fatalf("clone from a removed connection: %d %v", status, out)
	}
}

// One failing source never empties another, and the failure is a fixed
// code, never native text.
func TestGiteaReposSourcesFailIndependently(t *testing.T) {
	w := newGiteaWalk(t)
	ada := w.connect(w.srv.URL, "tok-ada-0001")
	bob := w.connect(w.srv.URL, "tok-bob-0002")
	w.srv.FailAPI("tok-bob-0002", true)
	status, out, _ := w.request("GET", integrations.GiteaReposPath, "")
	if status != 200 {
		t.Fatalf("repos: %d %v", status, out)
	}
	for _, s := range out["sources"].([]any) {
		source := s.(map[string]any)
		switch source["connection_id"] {
		case ada:
			if source["state"] != "ok" || len(source["repositories"].([]any)) != 2 {
				t.Fatalf("healthy source: %v", source)
			}
		case bob:
			if source["state"] != "failed" || source["failure"] != "not_gitea" || source["complete"] != false || len(source["repositories"].([]any)) != 0 {
				t.Fatalf("failed source: %v", source)
			}
		}
	}
	// An unreadable tea file is unavailable, never an empty list.
	tea := filepath.Join(w.home, ".config", "tea", "config.yml")
	if err := os.Chmod(tea, 0o644); err != nil {
		t.Fatal(err)
	}
	_, list, _ := w.request("GET", integrations.ListPath, "")
	if gitea := list["gitea"].(map[string]any); gitea["state"] != "unavailable" || len(gitea["connections"].([]any)) != 0 {
		t.Fatalf("unsafe tea file: %v", gitea)
	}
	if status, out, _ := w.request("GET", integrations.GiteaReposPath, ""); status != 503 || code(out) != "native_unavailable" {
		t.Fatalf("repos from an unsafe file: %d %v", status, out)
	}
}
