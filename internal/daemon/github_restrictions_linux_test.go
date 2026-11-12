//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"os/user"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/nativegh"
	"github.com/open-habitat/open-habitat/internal/testpython"
	"github.com/open-habitat/open-habitat/internal/transport"
)

func TestOrgRestrictionSignals(t *testing.T) {
	for _, c := range []struct {
		name, head, body, want string
	}{
		{"sso header", "HTTP/2.0 403 Forbidden\r\nX-GitHub-SSO: required; url=https://github.com/orgs/example-org/sso?authorization_request=x\r\n", `{"message":"Forbidden"}`, "saml"},
		{"sso header case", "HTTP/2.0 403 Forbidden\r\nx-github-sso: required; url=x\r\n", `{}`, "saml"},
		// A partial-results header names organisations, it does not refuse.
		{"sso partial", "HTTP/2.0 403 Forbidden\r\nX-GitHub-SSO: partial-results; organizations=1\r\n", `{"message":"Forbidden"}`, ""},
		{"saml message", "HTTP/2.0 403 Forbidden\r\n", `{"message":"Resource protected by organization SAML enforcement. You must grant your OAuth token access to this organization."}`, "saml"},
		{"oauth app", "HTTP/2.0 403 Forbidden\r\n", "{\"message\":\"Although you appear to have the correct authorization credentials, the `example-org` organization has enabled OAuth App access restrictions, meaning that data access to third-parties is limited.\"}", "oauth_app"},
		{"rate limit", "HTTP/2.0 403 Forbidden\r\n", `{"message":"API rate limit exceeded"}`, ""},
		{"not json", "HTTP/2.0 403 Forbidden\r\n", `has enabled OAuth App access restrictions`, ""},
	} {
		if got := orgRestriction([]byte(c.head), []byte(c.body)); got != c.want {
			t.Fatalf("%s: %q want %q", c.name, got, c.want)
		}
	}
}

// A restricted organisation is remembered from the answer that showed it and
// forgotten only when GitHub answers otherwise about that same repository:
// the organisation's public repositories stay readable meanwhile.
func TestRestrictedOrgsFollowGitHubsAnswers(t *testing.T) {
	g := newGitHubOrgs(nil)
	var told int
	g.changed = func() { told++ }
	g.noteLookup("example-org/private", "restricted_oauth_app")
	g.noteLookup("example-org/private", "restricted_oauth_app")
	g.noteLookup("Example-Org/public-site", "found")
	g.noteLookup("example-org/private", "unavailable")
	if got := g.list(); len(got) != 1 || got[0].Owner != "example-org" || got[0].Kind != "oauth_app" || got[0].Repo != "example-org/private" || told != 1 {
		t.Fatalf("remembered: %+v, told %d", got, told)
	}
	g.noteLookup("example-org/private", "restricted_saml")
	if got := g.list(); got[0].Kind != "saml" || told != 2 {
		t.Fatalf("a changed restriction: %+v, told %d", got, told)
	}
	g.noteLookup("EXAMPLE-ORG/PRIVATE", "found")
	if got := g.list(); len(got) != 0 || told != 3 {
		t.Fatalf("lifted: %+v, told %d", got, told)
	}
	for i := range maxRestrictedOrgs + 3 {
		g.noteLookup("org"+strings.Repeat("x", i)+"/repo", "restricted_saml")
	}
	if got := g.list(); len(got) != maxRestrictedOrgs {
		t.Fatalf("bounded: %d", len(got))
	}
	var none *githubOrgs
	none.noteLookup("example-org/private", "restricted_saml")
	if none.list() != nil {
		t.Fatal("no memory, nothing told")
	}
}

// A remembered restriction is asked about again by itself, with no page
// reading: an owner's approval clears it, and a rate limit on the way says
// nothing and keeps it.
func TestRestrictedOrgIsRecheckedByItself(t *testing.T) {
	var mu sync.Mutex
	var asked []string
	answers := []string{"rate", "403", "200"}
	g := newGitHubOrgs(func(_ context.Context, args ...string) ([]byte, error) {
		mu.Lock()
		defer mu.Unlock()
		asked = append(asked, strings.Join(args, " "))
		answer := answers[0]
		if len(answers) > 1 {
			answers = answers[1:]
		}
		switch answer {
		case "rate":
			return []byte("HTTP/2.0 403 Forbidden\r\nX-RateLimit-Remaining: 0\r\n\r\n" + `{"message":"API rate limit exceeded for user ID 42."}`), &nativeCommandExit{Code: 1}
		case "403":
			return []byte("HTTP/2.0 403 Forbidden\r\n\r\n" + `{"message":"Resource protected by organization SAML enforcement."}`), &nativeCommandExit{Code: 1}
		}
		return []byte("HTTP/2.0 200 OK\r\n\r\n" + `{"owner":{"login":"example-org","type":"Organization"},"name":"private","full_name":"example-org/private","html_url":"https://github.com/example-org/private","private":true,"description":"","pushed_at":null,"size":1,"default_branch":"main"}`), nil
	})
	g.every = 20 * time.Millisecond
	cleared := make(chan struct{})
	var once sync.Once
	g.changed = func() {
		if len(g.list()) == 0 {
			once.Do(func() { close(cleared) })
		}
	}
	g.noteLookup("example-org/private", "restricted_saml")
	select {
	case <-cleared:
	case <-time.After(5 * time.Second):
		t.Fatal("approval did not clear the restriction")
	}
	mu.Lock()
	defer mu.Unlock()
	if len(asked) != 3 || asked[0] != "api --include --method GET /repos/example-org/private" {
		t.Fatalf("asked %q", asked)
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	if len(g.orgs) != 0 {
		t.Fatal("a cleared entry stays")
	}
}

func TestGitHubFailureHint(t *testing.T) {
	for _, c := range []struct {
		name         string
		text         string
		hit, refused bool
		repos        []string
	}{
		{"push refused", "To https://github.com/example-org/app.git\nremote: Permission to example-org/app.git denied to alice.\nfatal: unable to access 'https://github.com/example-org/app.git/': The requested URL returned error: 403\n\nCommand exited with code 128", true, true, []string{"example-org/app"}},
		{"rejected credential", "fatal: Authentication failed for 'https://github.com/example-org/app/'\n", true, false, []string{"example-org/app"}},
		{"no network", "fatal: unable to access 'https://github.com/example-org/app.git/': Could not resolve host: github.com\n", true, false, []string{"example-org/app"}},
		{"no credential", "fatal: could not read Username for 'https://github.com': No such device or address\n", true, false, nil},
		{"gh outage", "error connecting to api.github.com\ncheck your internet connection or https://githubstatus.com\n", true, false, nil},
		{"gh rejected", "HTTP 401: Bad credentials (https://api.github.com/graphql)\n", true, false, nil},
		{"gh org", "GraphQL: Although you appear to have the correct authorization credentials, the `example-org` organization has enabled OAuth App access restrictions, meaning that data access to third-parties is limited. (repository)\n", true, true, nil},
		{"gh 5xx", "gh: Server Error (HTTP 502)\n", true, false, nil},
		// Other hosts, and remote text alone, are not GitHub's answer.
		{"other host", "fatal: unable to access 'https://gitlab.example.test/a/b.git/': The requested URL returned error: 403\n", false, false, nil},
		{"remote only", "remote: Permission to example-org/app.git denied to alice.\n", false, false, nil},
		{"test failure", "FAIL: TestSomething\nexit status 1\n", false, false, nil},
	} {
		hit, refused, repos := githubFailureHint(c.text)
		if hit != c.hit || refused != c.refused || !reflect.DeepEqual(repos, c.repos) {
			t.Fatalf("%s: %v %v %q", c.name, hit, refused, repos)
		}
	}
}

// An agent's failed push asks for a connection check now, and a refusal
// looks at the repository Git named; an unrelated failure asks nothing.
func TestAgentFailureAsksForACheck(t *testing.T) {
	var mu sync.Mutex
	var rechecks int
	var asked []string
	orgs := newGitHubOrgs(func(_ context.Context, args ...string) ([]byte, error) {
		mu.Lock()
		asked = append(asked, args[len(args)-1])
		mu.Unlock()
		return []byte("HTTP/2.0 403 Forbidden\r\n\r\n" + "{\"message\":\"Although you appear to have the correct authorization credentials, the `example-org` organization has enabled OAuth App access restrictions.\"}"), &nativeCommandExit{Code: 1}
	})
	// Pi's own tool results, as the conversation's drain sees them: a test
	// that failed, a push GitHub refused, and a push that worked.
	const id = "12345678-1234-4123-8123-123456789abc"
	rpc := &piRPC{events: make(chan json.RawMessage, 3)}
	s := &conversation{id: id, rpc: rpc, state: "idle", events: []json.RawMessage{}}
	c := &ConversationController{sessions: map[string]*conversation{id: s}, journal: newEventJournal(), github: &githubWatch{recheck: func() { mu.Lock(); rechecks++; mu.Unlock() }, orgs: orgs}}
	for _, r := range []struct {
		failed bool
		text   string
	}{
		{true, "FAIL: TestSomething\nexit status 1\n\nCommand exited with code 1"},
		{true, "fatal: unable to access 'https://github.com/example-org/app.git/': The requested URL returned error: 403\n\nCommand exited with code 128"},
		{false, "fatal: unable to access 'https://github.com/example-org/other.git/': The requested URL returned error: 403"},
	} {
		raw, _ := json.Marshal(map[string]any{"type": "tool_execution_end", "toolCallId": "call", "toolName": "bash", "isError": r.failed, "result": map[string]any{"content": []map[string]string{{"type": "text", "text": r.text}}}})
		rpc.events <- raw
	}
	close(rpc.events)
	c.drain(s)
	deadline := time.Now().Add(5 * time.Second)
	for len(orgs.list()) == 0 {
		if time.Now().After(deadline) {
			t.Fatal("the refusal was not looked at")
		}
		time.Sleep(5 * time.Millisecond)
	}
	mu.Lock()
	defer mu.Unlock()
	if rechecks != 1 || !reflect.DeepEqual(asked, []string{"/repos/example-org/app"}) {
		t.Fatalf("rechecks %d, asked %q", rechecks, asked)
	}
	if got := orgs.list(); got[0].Owner != "example-org" || got[0].Kind != "oauth_app" {
		t.Fatalf("%+v", got)
	}
}

// The browser's lookup tells the restriction and teaches the daemon; an
// agent's lookup keeps its two answers.
func TestLookupNotesRestrictionAndAgentReplyKeepsItsShape(t *testing.T) {
	cfg := repoFixtureConfig(t)
	run := func(_ context.Context, args ...string) ([]byte, error) {
		if args[len(args)-1] == "/user" {
			return []byte(`{"id":42}`), nil
		}
		return []byte("HTTP/2.0 403 Forbidden\r\nX-GitHub-SSO: required; url=https://github.com/orgs/raine/sso\r\n\r\n{}"), &nativeCommandExit{Code: 1}
	}
	orgs := newGitHubOrgs(run)
	w := httptest.NewRecorder()
	repoLookupHandlerAt(cfg, func(*http.Request) bool { return true }, run, RepoLookupPath, orgs).ServeHTTP(w, repoGet(RepoLookupPath+"?full_name=raine%2Fworkmux"))
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"restriction":"saml"`) || strings.Contains(w.Body.String(), "sso?") {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
	if got := orgs.list(); len(got) != 1 || got[0].Owner != "raine" {
		t.Fatalf("%+v", got)
	}
	w = httptest.NewRecorder()
	repoLookupHandlerAt(cfg, func(*http.Request) bool { return true }, run, AgentRepositoryPath, orgs).ServeHTTP(w, repoGet(AgentRepositoryPath+"?full_name=raine%2Fworkmux"))
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"state":"not_found"`) {
		t.Fatalf("agent: %d %s", w.Code, w.Body.String())
	}
}

// The snapshot tells an outage's retry and the restricted organisations in
// the contract's shape, and nothing about a retry beside another state.
func TestSnapshotTellsOutageRetryAndRestrictedOrgs(t *testing.T) {
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, _ := strconv.Atoi(u.Uid)
	cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Provider: "github", Subject: "42", Socket: "/run/open-habitat/users/" + u.Username + "/daemon.sock"}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c := newConversationController(ctx, cfg, nil, func(*http.Request) bool { return true }, func(context.Context) string { return "usable" })
	defer c.shutdown()
	orgs := newGitHubOrgs(nil)
	orgs.noteLookup("example-org/private", "restricted_oauth_app")
	c.github = &githubWatch{orgs: orgs}
	since := time.Date(2026, 10, 28, 10, 0, 0, 0, time.UTC)
	obs := nativegh.Observation{State: "unreachable", Login: "alice", Since: since, Attempt: 2, NextAt: since.Add(time.Minute)}
	h := snapshotHandlerWithController(cfg, func(*http.Request) bool { return true }, func(transport.Config) Discovery { return Discovery{State: "empty"} }, func(transport.Config) ([]nativeSession, error) { return nil, nil }, t.TempDir(), func(context.Context) nativegh.Observation { return obs }, nil, c)
	read := func() map[string]any {
		r := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
		r.RequestURI = SnapshotPath
		r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:42"))
		r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 200 {
			t.Fatalf("%d %s", w.Code, w.Body.String())
		}
		python := testpython.Validator(t)
		cmd := exec.Command(python, "-c", `import sys,runpy,json; m=runpy.run_path('../../scripts/validate-contracts.py'); m['Draft202012Validator'](m['schemas']['snapshot.schema.json'],registry=m['registry'],format_checker=m['format_checker']).validate(json.load(sys.stdin))`)
		cmd.Stdin = bytes.NewReader(w.Body.Bytes())
		if out, e := cmd.CombinedOutput(); e != nil {
			t.Fatalf("schema: %s: %v", out, e)
		}
		var doc struct {
			Auth struct {
				NativeGitHub map[string]any `json:"native_github"`
			} `json:"auth"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &doc); err != nil {
			t.Fatal(err)
		}
		return doc.Auth.NativeGitHub
	}
	want := map[string]any{
		"state":           "unreachable",
		"retry":           map[string]any{"attempt": 2.0, "attempts": 4.0, "since": "2026-10-28T10:00:00Z", "next_at": "2026-10-28T10:01:00Z"},
		"restricted_orgs": []any{map[string]any{"owner": "example-org", "restriction": "oauth_app"}},
	}
	if got := read(); !reflect.DeepEqual(got, want) {
		t.Fatalf("%v", got)
	}
	obs = nativegh.Observation{State: "verifying", Since: since, Attempt: 2, NextAt: since}
	orgs.noteLookup("example-org/private", "found")
	if got := read(); !reflect.DeepEqual(got, map[string]any{"state": "verifying"}) {
		t.Fatalf("%v", got)
	}
}
