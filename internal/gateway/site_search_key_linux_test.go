//go:build linux

package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakeWebSearch is one person's daemon as the site search key route sees
// it: the key file's key, service and source, decided as the daemon does,
// and its trial search against a service that takes the keys it lists (the
// real decision, file and trial search are proven in the daemon package).
type fakeWebSearch struct {
	mu       sync.Mutex
	key      string
	backend  string
	source   string
	requests []map[string]any
	checks   []map[string]any
	works    map[string]bool
	// answer, when set, is every check's outcome.
	answer string
}

func (f *fakeWebSearch) serve(t *testing.T, path string) {
	ln, err := net.Listen("unix", path)
	if err != nil {
		t.Fatal(err)
	}
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if r.URL.Path != searchDaemonPath && r.URL.Path != searchCheckDaemonPath || r.Method != http.MethodPost || json.NewDecoder(r.Body).Decode(&body) != nil {
			w.WriteHeader(400)
			return
		}
		f.mu.Lock()
		defer f.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == searchCheckDaemonPath {
			f.checks = append(f.checks, body)
			outcome := "rejected"
			if f.answer != "" {
				outcome = f.answer
			} else if f.works[body["key"].(string)] {
				outcome = "works"
			}
			json.NewEncoder(w).Encode(map[string]any{"schema_version": 1, "outcome": outcome})
			return
		}
		f.requests = append(f.requests, body)
		key, backend := body["key"].(string), body["backend"].(string)
		outcome := "seeded"
		switch {
		case f.source == "own":
			outcome = "kept"
		case f.key == key && f.backend == backend:
			outcome = "already_current"
		case f.key != "":
			outcome = "replaced"
		}
		if outcome == "seeded" || outcome == "replaced" {
			f.key, f.backend, f.source = key, backend, "site"
		}
		json.NewEncoder(w).Encode(map[string]any{"schema_version": 1, "outcome": outcome})
	})}
	go srv.Serve(ln)
	t.Cleanup(func() { srv.Close() })
}

func (f *fakeWebSearch) holds() (string, int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.key, len(f.requests)
}

func searchKeyPost(h http.Handler, c *http.Cookie, csrf, verb, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest("POST", "https://host.test"+siteSearchKeyPath+"/"+verb, strings.NewReader(body))
	r.AddCookie(c)
	r.Header.Set("Origin", "https://host.test")
	r.Header.Set("X-Agent-Host-CSRF", csrf)
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

const siteBrave = "BSAsite0000000000000000000Kq7Z"

// An administrator's search key is stored in its own private file, read
// back only as service and suffix, and offered to every joined person's own
// daemon, which keeps a key the person saved. A person whose account a
// later sign-in creates gets it then. Removing the key recalls nothing.
func TestSiteSearchKeyIsGivenToJoinedPeople(t *testing.T) {
	x := newAccessHarness(t)
	var logs bytes.Buffer
	x.auth.log = CallbackLogger(&logs)
	uid := uint32(os.Getuid())
	dir, err := os.MkdirTemp("", "ws")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	x.broker.runtime["44"] = "admitted"
	daemons := map[string]*fakeWebSearch{}
	sockets := map[string]string{}
	for id, name := range map[string]string{"42": "alice", "43": "bob", "44": "carol"} {
		socket := "/run/open-habitat/users/" + name + "/daemon.sock"
		daemons[id] = &fakeWebSearch{}
		sockets[socket] = filepath.Join(dir, name)
		daemons[id].serve(t, sockets[socket])
		if id != "44" {
			x.broker.routes[id] = BrokerRoute{UID: uid, Username: name, Socket: socket}
		}
	}
	x.auth.snapshotDial = func(ctx context.Context, path string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", sockets[path])
	}
	daemons["42"].key, daemons["42"].backend, daemons["42"].source = "AliceOwn0000000000000000", "brave", "own"
	daemons["42"].works = map[string]bool{siteBrave: true}

	alice := x.login("42", "alice")
	csrf := x.csrf(alice)
	bob := x.login("43", "bob")
	if w := searchKeyPost(x.h, bob, x.csrf(bob), "set", `{"backend":"brave","key":"`+siteBrave+`"}`); w.Code != 403 {
		t.Fatal("bob set the site key", w.Code)
	}
	if w := searchKeyPost(x.h, alice, "wrong", "set", `{"backend":"brave","key":"`+siteBrave+`"}`); w.Code != 403 {
		t.Fatal("set without the session's proof", w.Code)
	}
	// Staan is reserved until its coverage has been checked.
	for _, body := range []string{`{"backend":"staan","key":"` + siteBrave + `"}`, `{"key":"` + siteBrave + `"}`, `{"backend":"brave","key":"$BRAVE_API_KEY"}`, `{"backend":"brave"}`, `{}`} {
		if w := searchKeyPost(x.h, alice, csrf, "set", body); w.Code != 400 {
			t.Fatal("accepted", body, w.Code)
		}
	}
	type reply struct {
		SiteKey *searchKeyView   `json:"site_key"`
		Given   speechGiveCounts `json:"given"`
	}
	// A refused key, a reached limit or a service that cannot be asked
	// stores nothing and gives nothing.
	const refused = "BSArefused0000000000000Xx11"
	for _, c := range []struct{ key, answer, code string }{{refused, "", "search_key_rejected"}, {siteBrave, "limited", "search_limit_reached"}, {siteBrave, "unavailable", "search_unavailable"}, {siteBrave, "garbled", "search_unavailable"}} {
		daemons["42"].answer = c.answer
		w := searchKeyPost(x.h, alice, csrf, "set", `{"backend":"brave","key":"`+c.key+`"}`)
		if w.Code == 200 || !strings.Contains(w.Body.String(), `"`+c.code+`"`) {
			t.Fatal("unchecked key", c, w.Code, w.Body.String())
		}
	}
	daemons["42"].answer = ""
	if _, n := daemons["43"].holds(); n != 0 {
		t.Fatal("an unchecked key was given")
	}
	if _, err := os.Stat(filepath.Join(x.dir, "site-search-key.json")); !os.IsNotExist(err) {
		t.Fatal("an unchecked key was stored", err)
	}
	w := searchKeyPost(x.h, alice, csrf, "set", `{"backend":"brave","key":"`+siteBrave+`"}`)
	got := decodeInto[reply](t, w.Body.Bytes())
	// carol is admitted but has not joined: she is not offered it yet.
	if w.Code != 200 || got.SiteKey == nil || got.SiteKey.Suffix != "Kq7Z" || got.SiteKey.Backend != "brave" || got.Given["seeded"] != 1 || got.Given["kept"] != 1 || len(got.Given) != 2 {
		t.Fatal("set", w.Code, w.Body.String())
	}
	// Only the administrator's own daemon is asked, with the key and service.
	for id, d := range daemons {
		if n := len(d.checks); id == "42" && (n != 5 || len(d.checks[4]) != 3 || d.checks[4]["backend"] != "brave") || id != "42" && n != 0 {
			t.Fatal("check asked of", id, d.checks)
		}
	}
	if k, _ := daemons["43"].holds(); k != siteBrave {
		t.Fatal("bob has no copy")
	}
	if k, _ := daemons["42"].holds(); k != "AliceOwn0000000000000000" {
		t.Fatal("alice's own key replaced")
	}
	// Setting the same key again reaches anyone the first set did not.
	got = decodeInto[reply](t, searchKeyPost(x.h, alice, csrf, "set", `{"backend":"brave","key":"`+siteBrave+`"}`).Body.Bytes())
	if got.Given["already_current"] != 1 || got.Given["kept"] != 1 {
		t.Fatal("second set", got.Given)
	}
	info, err := os.Stat(filepath.Join(x.dir, "site-search-key.json"))
	if err != nil || info.Mode().Perm() != 0600 {
		t.Fatal("key file", info, err)
	}
	read := request(x.h, "GET", siteSearchKeyPath, alice)
	if read.Code != 200 || decodeInto[reply](t, read.Body.Bytes()).SiteKey.Suffix != "Kq7Z" || strings.Contains(read.Body.String(), siteBrave) {
		t.Fatal("read", read.Code, read.Body.String())
	}
	if w := request(x.h, "GET", siteSearchKeyPath, bob); w.Code != 403 {
		t.Fatal("bob read the site key", w.Code)
	}

	// carol's first sign-in creates her account; her daemon is offered the key.
	x.broker.unbound = map[string]bool{"44": true}
	x.broker.routes["44"] = BrokerRoute{UID: uid, Username: "carol", Socket: "/run/open-habitat/users/carol/daemon.sock"}
	if x.login("44", "carol") == nil {
		t.Fatal("carol's sign-in")
	}
	deadline := time.Now().Add(5 * time.Second)
	for k, _ := daemons["44"].holds(); k != siteBrave; k, _ = daemons["44"].holds() {
		if time.Now().After(deadline) {
			t.Fatal("carol was not given the key at her first sign-in")
		}
		time.Sleep(20 * time.Millisecond)
	}
	// A later sign-in gives nothing.
	_, before := daemons["43"].holds()
	x.login("43", "bob")
	time.Sleep(100 * time.Millisecond)
	if _, after := daemons["43"].holds(); after != before {
		t.Fatal("an ordinary sign-in gave the key again")
	}

	// The key survives a restart, and delete recalls nothing.
	x.restart()
	alice = x.login("42", "alice")
	if decodeInto[reply](t, request(x.h, "GET", siteSearchKeyPath, alice).Body.Bytes()).SiteKey == nil {
		t.Fatal("key lost on restart")
	}
	if w := searchKeyPost(x.h, alice, x.csrf(alice), "delete", `{"backend":"brave"}`); w.Code != 400 {
		t.Fatal("delete with a body", w.Code)
	}
	if w := searchKeyPost(x.h, alice, x.csrf(alice), "delete", `{}`); w.Code != 200 || decodeInto[reply](t, w.Body.Bytes()).SiteKey != nil {
		t.Fatal("delete", w.Code, w.Body.String())
	}
	if _, err := os.Stat(filepath.Join(x.dir, "site-search-key.json")); !os.IsNotExist(err) {
		t.Fatal("key file kept", err)
	}
	if k, _ := daemons["43"].holds(); k != siteBrave {
		t.Fatal("delete recalled bob's copy")
	}
	// The daemon is asked with the key and service and nothing else; no
	// reply or log line carries the key.
	for _, r := range daemons["43"].requests {
		if len(r) != 3 || r["backend"] != "brave" {
			t.Fatal("request carried more than the daemon needs", r)
		}
	}
	if strings.Contains(logs.String(), siteBrave[:12]) {
		t.Fatal("log carries the key")
	}
}

// A changed or unreadable key file stops startup, like the other site keys.
func TestSiteSearchKeyFileFailsClosed(t *testing.T) {
	x := newAccessHarness(t)
	path := filepath.Join(x.dir, "site-search-key.json")
	for _, bad := range []string{
		`{"version":1,"backend":"brave","key":"short","set_at":"2026-11-23T09:00:00Z"}`,
		`{"version":1,"backend":"google","key":"` + siteBrave + `","set_at":"2026-11-23T09:00:00Z"}`,
		`{"version":1,"backend":"brave","key":"` + siteBrave + `","set_at":"2026-11-23T09:00:00Z","extra":true}`,
	} {
		if err := os.WriteFile(path, []byte(bad), 0600); err != nil {
			t.Fatal(err)
		}
		_, err := NewAuth(OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, AuthOptions{Provider: x.provider, Sink: x.sink, Broker: x.broker, SessionFile: filepath.Join(x.dir, "sessions.json"), AdminFile: filepath.Join(x.dir, "administration.json"), SiteKeyFile: filepath.Join(x.dir, "site-ai-key.json")})
		if err != ErrAdministrationState {
			t.Fatal("started with an invalid key file", bad, err)
		}
	}
	// A group-readable file is not the gateway's private record.
	if err := os.WriteFile(path, []byte(`{"version":1,"backend":"brave","key":"`+siteBrave+`","set_at":"2026-11-23T09:00:00Z"}`), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(path, 0640); err != nil {
		t.Fatal(err)
	}
	_, err := NewAuth(OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, AuthOptions{Provider: x.provider, Sink: x.sink, Broker: x.broker, SessionFile: filepath.Join(x.dir, "sessions.json"), AdminFile: filepath.Join(x.dir, "administration.json"), SiteKeyFile: filepath.Join(x.dir, "site-ai-key.json")})
	if err != ErrAdministrationState {
		t.Fatal("started with a group-readable key file", err)
	}
}

// The person's own key route reaches only their daemon, with the session's
// write proof for every change.
func TestWebSearchKeyRouteNeedsTheSession(t *testing.T) {
	x := newAccessHarness(t)
	alice := x.login("42", "alice")
	for _, c := range []struct {
		method, path string
		cookie       *http.Cookie
		want         int
	}{
		{"GET", webSearchKeyPath, nil, 401},
		{"PUT", webSearchKeyPath, alice, 400},
		{"POST", webSearchKeyPath, alice, 403},
		{"DELETE", webSearchKeyPath, alice, 403},
	} {
		r := httptest.NewRequest(c.method, "https://host.test"+c.path, nil)
		if c.cookie != nil {
			r.AddCookie(c.cookie)
		}
		w := httptest.NewRecorder()
		x.h.ServeHTTP(w, r)
		if w.Code != c.want {
			t.Fatal(c.method, c.path, w.Code, w.Body.String())
		}
	}
}
