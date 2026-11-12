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
	"github.com/open-habitat/open-habitat/internal/nativegitlab"
	"github.com/open-habitat/open-habitat/internal/nativegitlab/gitlabfake"
	"github.com/open-habitat/open-habitat/internal/testpython"
)

// gitlabHelperForTest makes the nativegitlab calls internal/cli's `gitlab
// git-credential` makes.
func gitlabHelperForTest(op string) int {
	if op != "get" {
		_, _ = io.Copy(io.Discard, os.Stdin)
		return 0
	}
	req, err := nativegitlab.ParseCredentialRequest(os.Stdin)
	if err != nil {
		return 1
	}
	store, err := nativegitlab.StoreFromEnvironment()
	if err != nil {
		return 2
	}
	c, err := store.Credential(req)
	if err != nil {
		var ge *nativegitlab.Error
		if errors.As(err, &ge) && (ge.Code() == "no_match" || ge.Code() == "ambiguous") {
			return 0
		}
		return 2
	}
	if nativegitlab.WriteCredential(os.Stdout, c) != nil {
		return 2
	}
	return 0
}

// matchesSchema validates a reply against its contract with the
// repository's own validator.
func matchesSchema(t *testing.T, schema, body string) {
	t.Helper()
	python := testpython.Validator(t)
	cmd := exec.Command(python, "-c", `import sys,runpy,json; m=runpy.run_path('../../scripts/validate-contracts.py'); m['Draft202012Validator'](m['schemas'][sys.argv[1]],registry=m['registry'],format_checker=m['format_checker']).validate(json.load(sys.stdin))`, schema)
	cmd.Stdin = strings.NewReader(body)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("%s: %s: %v\n%s", schema, out, err, body)
	}
}

type gitlabWalk struct {
	*giteaWalk
	gl      *gitlabfake.Server
	adapter *integrations.GitLabAdapter
}

func newGitLabWalk(t *testing.T) *gitlabWalk {
	t.Helper()
	if _, err := os.Stat("/usr/lib/git-core/git-http-backend"); err != nil {
		t.Skip("git-http-backend unavailable")
	}
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	home := t.TempDir()
	if err := os.Chmod(home, 0o700); err != nil {
		t.Fatal(err)
	}
	gl, err := gitlabfake.Start(t.TempDir(), []gitlabfake.Account{
		{ID: 7, Username: "ada", Tokens: []gitlabfake.Token{{Value: "glpat-ada-0001", ExpiresAt: "2027-10-27"}}},
		{ID: 8, Username: "bob", Tokens: []gitlabfake.Token{{Value: "glpat-bob-0001"}}},
	}, []gitlabfake.Project{
		{ID: 101, Path: "ada/notes"},
		{ID: 102, Path: "konepaja/verkkokauppa/infra/terraform", Members: []int64{7}, Visibility: "internal"},
		{ID: 103, Path: "konepaja/sisainen/uusi", Members: []int64{7}, Empty: true},
		{ID: 104, Path: "pankki-oy/digi/mobiili", Members: []int64{7}, SSO: true},
		{ID: 105, Path: "bob/notes"},
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(gl.Close)
	if err := os.WriteFile(filepath.Join(home, ".gitconfig"), []byte("[http \""+gl.URL+"\"]\n\tsslCAInfo = "+gl.CAFile+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	w := &gitlabWalk{giteaWalk: &giteaWalk{t: t, home: home, exe: exe, tools: map[string]string{"glab": "/usr/bin/true"}}, gl: gl}
	env := integrations.Env{Home: home, FixtureTools: true, LoadConfig: func() (integrations.Config, error) { return integrations.Config{Tools: w.tools}, nil }}
	w.adapter, err = integrations.NewGitLab(env, nativegitlab.NewClientWithRoots(gl.Roots), "/usr/bin/git", exe)
	if err != nil {
		t.Fatal(err)
	}
	catalog := integrations.New(env, nil, nil, integrations.WithGitLab(w.adapter))
	w.routes = httptest.NewServer(catalog.Handler(func(*http.Request) bool { return true }))
	t.Cleanup(w.routes.Close)
	w.clones = newCloneJobsFixture(t, home, "/usr/bin/git")
	w.clones.jobs.gitlab, w.clones.jobs.forgeGit = w.adapter, "/usr/bin/git"
	return w
}

func (w *gitlabWalk) gitlab(method, body string) (int, map[string]any, string) {
	return w.request(method, integrations.GitLabPath, body)
}

func (w *gitlabWalk) clone(connection string, project int) (int, map[string]any) {
	w.t.Helper()
	return w.clones.action(`{"action":"start","source":"gitlab","connection_id":"` + connection + `","repository_id":` + strconv.Itoa(project) + `,"mode":"full"}`)
}

func (w *gitlabWalk) fetch(name string) string {
	w.t.Helper()
	cfg := w.clones.cfg
	for _, entry := range Discover(cfg).Entries {
		if entry.Name == name {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			return fetchWorkspaceGit(ctx, cfg, workspaceGitTarget(cfg, entry), "/usr/bin/git", 20*time.Second, Forges{GitLab: w.adapter})
		}
	}
	w.t.Fatalf("workspace %s not discovered", name)
	return ""
}

// The walking path: the form's address and token → glab's host entry and a
// secretless helper → the token's description and the person's projects,
// nested groups in full → an ordinary clone job into ~/src → a native fetch
// that reads glab's entry again → disconnect as glab's logout.
func TestGitLabConnectListCloneFetch(t *testing.T) {
	w := newGitLabWalk(t)
	host := strings.TrimPrefix(w.gl.URL, "https://")
	w.tools = map[string]string{}
	if status, out, _ := w.gitlab("POST", `{"action":"connect","base_url":"`+host+`","token":"glpat-ada-0001"}`); status != 409 || code(out) != "provider_unavailable" {
		t.Fatalf("unavailable tool: %d %v", status, out)
	}
	w.tools = map[string]string{"glab": "/usr/bin/true"}
	if status, out, _ := w.gitlab("POST", `{"action":"connect","base_url":"`+host+`","token":"glpat-wrong"}`); status != 422 || code(out) != "token_rejected" {
		t.Fatalf("rejected: %d %v", status, out)
	}
	w.gl.SetToken(7, gitlabfake.Token{Value: "glpat-ada-expired", Expired: true})
	if status, out, _ := w.gitlab("POST", `{"action":"connect","base_url":"`+host+`","token":"glpat-ada-expired"}`); status != 422 || code(out) != "token_expired" {
		t.Fatalf("expired: %d %v", status, out)
	}
	w.gl.SetToken(7, gitlabfake.Token{Value: "glpat-ada-nolist", Scopes: []string{"write_repository"}})
	if status, out, _ := w.gitlab("POST", `{"action":"connect","base_url":"`+host+`","token":"glpat-ada-nolist"}`); status != 422 || code(out) != "insufficient_scope" {
		t.Fatalf("no read_api: %d %v", status, out)
	}
	glab := filepath.Join(w.home, ".config", "glab-cli", "config.yml")
	if _, err := os.Stat(glab); !os.IsNotExist(err) {
		t.Fatal("a refused connect wrote glab's file")
	}
	status, out, raw := w.gitlab("POST", `{"action":"connect","base_url":"`+host+`","token":"glpat-ada-0001"}`)
	conn, _ := out["connection"].(map[string]any)
	token, _ := out["token"].(map[string]any)
	if status != 200 || out["api"] != "ok" || conn["git"] != "registered" || conn["kind"] != "pat" || conn["user"] != "ada" || token["push"] != "yes" || token["expires_at"] != "2027-10-27" || strings.Contains(raw, "glpat-") {
		t.Fatalf("connect: %d %s", status, raw)
	}
	matchesSchema(t, "gitlab-connection-change.schema.json", raw)
	ada := conn["id"].(string)
	if status, out, _ := w.gitlab("POST", `{"action":"connect","base_url":"`+host+`","token":"glpat-bob-0001"}`); status != 409 || code(out) != "connection_exists" {
		t.Fatalf("second account on one server: %d %v", status, out)
	}
	gitconfig, _ := os.ReadFile(filepath.Join(w.home, ".gitconfig"))
	if strings.Contains(string(gitconfig), "glpat-") || !strings.Contains(string(gitconfig), w.exe+" gitlab git-credential") {
		t.Fatalf("git configuration: %s", gitconfig)
	}

	_, list, raw := w.request("GET", integrations.ListPath, "")
	gitlab, _ := list["gitlab"].(map[string]any)
	if gitlab["state"] != "ok" || len(gitlab["connections"].([]any)) != 1 || strings.Contains(raw, "glpat-") {
		t.Fatalf("list: %s", raw)
	}
	matchesSchema(t, "integrations.schema.json", raw)
	_, tokens, raw := w.request("GET", integrations.GitLabTokensPath, "")
	matchesSchema(t, "gitlab-tokens.schema.json", raw)
	states, _ := tokens["connections"].([]any)
	if len(states) != 1 || states[0].(map[string]any)["api"] != "ok" || strings.Contains(raw, "glpat-") {
		t.Fatalf("tokens: %s", raw)
	}

	w.gl.SetHTTPURL(101, "http://gitlab.internal/ada/notes.git")
	status, repos, raw := w.request("GET", integrations.GitLabReposPath, "")
	if status != 200 || strings.Contains(raw, "glpat-") {
		t.Fatalf("repos: %d %s", status, raw)
	}
	matchesSchema(t, "gitlab-repos.schema.json", raw)
	source := repos["sources"].([]any)[0].(map[string]any)
	var names []string
	for _, r := range source["repositories"].([]any) {
		names = append(names, r.(map[string]any)["full_name"].(string))
	}
	elsewhere, _ := source["elsewhere"].(map[string]any)
	if source["state"] != "ok" || source["complete"] != true || strings.Join(names, ",") != "konepaja/verkkokauppa/infra/terraform,konepaja/sisainen/uusi,pankki-oy/digi/mobiili" || elsewhere["count"] != 1.0 || elsewhere["origin"] != "http://gitlab.internal" {
		t.Fatalf("source: %v", source)
	}
	w.gl.SetHTTPURL(101, "")

	status, empty := w.clone(ada, 103)
	if status != 200 {
		t.Fatalf("empty project: %d %v", status, empty)
	}
	if done := w.waitJob(empty["job"].(map[string]any)["job_id"].(string)); done["state"] != "confirmed" {
		t.Fatalf("empty clone: %v", done)
	}
	if _, err := os.Stat(filepath.Join(w.home, "src", "uusi", ".git", "index")); err != nil {
		t.Fatal(err)
	}
	if status, out := w.clone(ada, 105); status != 503 || code(out) != "native_source_unavailable" {
		t.Fatalf("another person's project: %d %v", status, out)
	}
	release := w.gl.Block()
	status, started := w.clone(ada, 102)
	job, _ := started["job"].(map[string]any)
	jobSource, _ := job["source"].(map[string]any)
	if status != 200 || job["full_name"] != "konepaja/verkkokauppa/infra/terraform" || jobSource["provider"] != "gitlab" || jobSource["connection_id"] != ada || jobSource["repository_id"] != 102.0 {
		t.Fatalf("start: %d %v", status, started)
	}
	if status, out, _ := w.gitlab("DELETE", `{"action":"disconnect","connection_id":"`+ada+`"}`); status != 409 || code(out) != "clone_running" {
		t.Fatalf("disconnect during clone: %d %v", status, out)
	}
	release()
	if done := w.waitJob(job["job_id"].(string)); done["state"] != "confirmed" {
		t.Fatalf("clone: %v", done)
	}
	checkout := filepath.Join(w.home, "src", "terraform")
	remote := w.git(checkout, "remote", "get-url", "origin")
	if remote != w.gl.URL+"/konepaja/verkkokauppa/infra/terraform.git" || w.git(checkout, "config", "--get", "credential."+remote+".username") != "ada" {
		t.Fatalf("origin %q", remote)
	}
	if b, _ := os.ReadFile(filepath.Join(checkout, ".git", "config")); strings.Contains(string(b), "glpat-") {
		t.Fatal("token in the clone's configuration")
	}

	// The snapshot names the project in full on the connected base.
	if got := gitlabOriginMatch(remote, gitlabBases(w.adapter)); got["full_name"] != "konepaja/verkkokauppa/infra/terraform" || got["base_url"] != w.gl.URL {
		t.Fatalf("origin match: %v", got)
	}

	// A group that requires SSO for Git refuses the clone; the job says the
	// credential was refused, never Git's text.
	status, started = w.clone(ada, 104)
	job, _ = started["job"].(map[string]any)
	if status != 200 {
		t.Fatalf("sso start: %d %v", status, started)
	}
	if done := w.waitJob(job["job_id"].(string)); done["state"] != "failed" || done["reason"] != "auth_refused" || done["leftover"] != "removed" {
		t.Fatalf("sso clone: %v", done)
	}

	if err := w.gl.AddCommit("konepaja/verkkokauppa/infra/terraform", "CHANGES.md", "later\n"); err != nil {
		t.Fatal(err)
	}
	if got := w.fetch("terraform"); got != "" {
		t.Fatalf("fetch: %s", got)
	}
	if w.git(checkout, "rev-list", "--count", "HEAD..origin/main") != "1" {
		t.Fatal("fetch did not bring the upstream commit")
	}

	// An expired token: check says so, the fetch fails as an auth failure,
	// and a replacement for the same user is read by the next fetch.
	w.gl.SetToken(7, gitlabfake.Token{Value: "glpat-ada-0001", Expired: true})
	if _, out, raw := w.gitlab("POST", `{"action":"check","connection_id":"`+ada+`"}`); out["api"] != "token_expired" || out["outcome"] != "checked" || out["token"] != nil {
		t.Fatalf("check: %v", out)
	} else {
		matchesSchema(t, "gitlab-connection-change.schema.json", raw)
	}
	if got := w.fetch("terraform"); got != "remote_auth_unavailable" {
		t.Fatalf("fetch with an expired token: %q", got)
	}
	if status, out, _ := w.gitlab("POST", `{"action":"replace","connection_id":"`+ada+`","token":"glpat-bob-0001"}`); status != 422 || code(out) != "account_mismatch" {
		t.Fatalf("replace with another user's token: %d %v", status, out)
	}
	w.gl.SetToken(7, gitlabfake.Token{Value: "glpat-ada-0002", Scopes: []string{"read_api"}})
	status, out, raw = w.gitlab("POST", `{"action":"replace","connection_id":"`+ada+`","token":"glpat-ada-0002"}`)
	if token, _ := out["token"].(map[string]any); status != 200 || out["outcome"] != "written" || token["push"] != "no" || strings.Contains(raw, "glpat-") {
		t.Fatalf("replace: %d %s", status, raw)
	}
	w.gl.SetToken(7, gitlabfake.Token{Value: "glpat-ada-0002", Scopes: []string{"read_api", "read_repository"}})
	if got := w.fetch("terraform"); got != "" {
		t.Fatalf("fetch after replacement: %q", got)
	}

	// Disconnect is glab's logout: the clone stays, the helper goes, and
	// the clone no longer authenticates.
	if status, out, _ := w.gitlab("DELETE", `{"action":"disconnect","connection_id":"`+ada+`"}`); status != 200 || out["outcome"] != "written" {
		t.Fatalf("disconnect: %d %v", status, out)
	}
	if b, _ := os.ReadFile(glab); strings.Contains(string(b), "glpat-") || !strings.Contains(string(b), "user: ada") {
		t.Fatalf("glab's file after disconnect: %s", b)
	}
	if b, _ := os.ReadFile(filepath.Join(w.home, ".gitconfig")); strings.Contains(string(b), "gitlab git-credential") {
		t.Fatalf("helper kept: %s", b)
	}
	if _, err := os.Stat(checkout); err != nil {
		t.Fatal("disconnect touched the clone")
	}
	if got := w.fetch("terraform"); got != "remote_auth_unavailable" {
		t.Fatalf("fetch after disconnect: %q", got)
	}
	if status, out := w.clone(ada, 102); status != 409 || code(out) != "gitlab_connection_unavailable" {
		t.Fatalf("clone from a removed connection: %d %v", status, out)
	}
}

// What a GitLab clone job leaves when the daemon stops mid-transfer is an
// interrupted clone named by its full project path while glab holds the
// server; restart needs the connection, remove does not.
func TestGitLabInterruptedCloneIsNamedInFull(t *testing.T) {
	w := newGitLabWalk(t)
	status, out, _ := w.gitlab("POST", `{"action":"connect","base_url":"`+w.gl.URL+`","token":"glpat-ada-0001"}`)
	if status != 200 {
		t.Fatalf("connect: %d %v", status, out)
	}
	ada := out["connection"].(map[string]any)["id"].(string)
	origin := w.gl.URL + "/konepaja/verkkokauppa/infra/terraform.git"
	dest := filepath.Join(w.home, "src", "terraform")
	if err := os.MkdirAll(filepath.Dir(dest), 0o700); err != nil {
		t.Fatal(err)
	}
	w.git(w.home, "init", "-q", dest)
	w.git(dest, "config", "credential."+origin+".username", "ada")
	w.git(dest, "remote", "add", "origin", origin)
	list := w.clones.list()
	items, _ := list["interrupted"].([]any)
	if len(items) != 1 {
		t.Fatalf("interrupted: %v", list)
	}
	listed, _ := json.Marshal(list)
	matchesSchema(t, "github-clone.schema.json", string(listed))
	item := items[0].(map[string]any)
	source, _ := item["source"].(map[string]any)
	if item["full_name"] != "konepaja/verkkokauppa/infra/terraform" || source["provider"] != "gitlab" || source["connection_id"] != ada {
		t.Fatalf("interrupted item: %v", item)
	}
	status, restarted := w.clones.action(`{"action":"restart","source":"gitlab","connection_id":"` + ada + `","repository_id":102,"mode":"full"}`)
	job, _ := restarted["job"].(map[string]any)
	if status != 200 {
		t.Fatalf("restart: %d %v", status, restarted)
	}
	if done := w.waitJob(job["job_id"].(string)); done["state"] != "confirmed" {
		t.Fatalf("restarted clone: %v", done)
	}
	// Remove of an interrupted clone needs only the path its origin ends
	// with, so a clone of a removed connection can still be removed.
	other := filepath.Join(w.home, "src", "mobiili")
	w.git(w.home, "init", "-q", other)
	mob := w.gl.URL + "/pankki-oy/digi/mobiili.git"
	w.git(other, "config", "credential."+mob+".username", "ada")
	w.git(other, "remote", "add", "origin", mob)
	if status, out, _ := w.gitlab("DELETE", `{"action":"disconnect","connection_id":"`+ada+`"}`); status != 200 {
		t.Fatalf("disconnect: %d %v", status, out)
	}
	if status, out := w.clones.action(`{"action":"remove","source":"gitlab","full_name":"pankki-oy/digi/mobiili"}`); status != 200 || out["state"] != "removed" {
		t.Fatalf("remove: %d %v", status, out)
	}
	if _, err := os.Stat(other); !os.IsNotExist(err) {
		t.Fatal("interrupted clone still there")
	}
	// Without a connection, a path no Gitea could have stays a GitLab
	// clone in the list, and a long path is still removable.
	long := strings.Repeat("ryhma", 9) + "/" + strings.Repeat("aliryhma", 20)
	deep := filepath.Join(w.home, "src", "syva")
	w.git(w.home, "init", "-q", deep)
	deepOrigin := w.gl.URL + "/" + long + "/syva.git"
	w.git(deep, "config", "credential."+deepOrigin+".username", "ada")
	w.git(deep, "remote", "add", "origin", deepOrigin)
	listed, _ = json.Marshal(w.clones.list())
	matchesSchema(t, "github-clone.schema.json", string(listed))
	if !strings.Contains(string(listed), `"provider":"gitlab"`) {
		t.Fatalf("orphaned deep clone: %s", listed)
	}
	if status, out := w.clones.action(`{"action":"remove","source":"gitlab","full_name":"` + long + `/syva"}`); status != 200 || out["state"] != "removed" {
		t.Fatalf("remove a long path: %d %v", status, out)
	}
	for _, bad := range []string{
		`{"action":"remove","source":"gitlab","full_name":"single"}`,
		`{"action":"remove","source":"gitlab","full_name":"a/-/b"}`,
		`{"action":"start","source":"gitlab","connection_id":"gitea_0123456789abcdef01234567","repository_id":1,"mode":"full"}`,
		`{"action":"start","source":"gitlab","connection_id":"` + ada + `","repository_id":1,"mode":"blobless"}`,
		`{"action":"start","source":"gitlab","connection_id":"` + ada + `","repository_id":1,"mode":"full","full_name":"a/b"}`,
	} {
		if status, _ := w.clones.action(bad); status != 400 {
			t.Errorf("%s: %d", bad, status)
		}
	}
}
