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

// fakeSpeech is one person's daemon as the site Soniox key route sees it:
// the key file's key and source, decided as the daemon does (the real
// decision and file are proven in the daemon package).
type fakeSpeech struct {
	mu       sync.Mutex
	key      string
	source   string
	requests []map[string]any
}

func (f *fakeSpeech) serve(t *testing.T, path string) {
	ln, err := net.Listen("unix", path)
	if err != nil {
		t.Fatal(err)
	}
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if r.URL.Path != speechDaemonPath || r.Method != http.MethodPost || json.NewDecoder(r.Body).Decode(&body) != nil {
			w.WriteHeader(400)
			return
		}
		f.mu.Lock()
		defer f.mu.Unlock()
		f.requests = append(f.requests, body)
		key := body["key"].(string)
		outcome := "seeded"
		switch {
		case f.source == "own":
			outcome = "kept"
		case f.key == key:
			outcome = "already_current"
		case f.key != "":
			outcome = "replaced"
		}
		if outcome == "seeded" || outcome == "replaced" {
			f.key, f.source = key, "site"
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"schema_version": 1, "outcome": outcome})
	})}
	go srv.Serve(ln)
	t.Cleanup(func() { srv.Close() })
}

func (f *fakeSpeech) holds() (string, int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.key, len(f.requests)
}

func speechKeyPost(h http.Handler, c *http.Cookie, csrf, verb, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest("POST", "https://host.test"+siteSpeechKeyPath+"/"+verb, strings.NewReader(body))
	r.AddCookie(c)
	r.Header.Set("Origin", "https://host.test")
	r.Header.Set("X-Agent-Host-CSRF", csrf)
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

const siteSoniox = "SiteSoniox000000000000000000Kq7Z"

// An administrator's Soniox key is stored in its own private file, read
// back only as region and suffix, and offered to every joined person's own
// daemon, which keeps a key the person saved. A person whose account a
// later sign-in creates gets it then. Removing the key recalls nothing.
func TestSiteSpeechKeyIsGivenToJoinedPeople(t *testing.T) {
	x := newAccessHarness(t)
	var logs bytes.Buffer
	x.auth.log = CallbackLogger(&logs)
	uid := uint32(os.Getuid())
	dir, err := os.MkdirTemp("", "sp")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	x.broker.runtime["44"] = "admitted"
	daemons := map[string]*fakeSpeech{}
	sockets := map[string]string{}
	for id, name := range map[string]string{"42": "alice", "43": "bob", "44": "carol"} {
		socket := "/run/open-habitat/users/" + name + "/daemon.sock"
		daemons[id] = &fakeSpeech{}
		sockets[socket] = filepath.Join(dir, name)
		daemons[id].serve(t, sockets[socket])
		if id != "44" {
			x.broker.routes[id] = BrokerRoute{UID: uid, Username: name, Socket: socket}
		}
	}
	x.auth.snapshotDial = func(ctx context.Context, path string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", sockets[path])
	}
	daemons["42"].key, daemons["42"].source = "AliceOwn0000000000000000", "own"

	alice := x.login("42", "alice")
	csrf := x.csrf(alice)
	bob := x.login("43", "bob")
	if w := speechKeyPost(x.h, bob, x.csrf(bob), "set", `{"region":"eu","key":"`+siteSoniox+`"}`); w.Code != 403 {
		t.Fatal("bob set the site key", w.Code)
	}
	if w := speechKeyPost(x.h, alice, "wrong", "set", `{"region":"eu","key":"`+siteSoniox+`"}`); w.Code != 403 {
		t.Fatal("set without the session's proof", w.Code)
	}
	for _, body := range []string{`{"region":"jp","key":"` + siteSoniox + `"}`, `{"region":"eu","key":"$SONIOX_API_KEY"}`, `{"region":"eu"}`} {
		if w := speechKeyPost(x.h, alice, csrf, "set", body); w.Code != 400 {
			t.Fatal("accepted", body, w.Code)
		}
	}
	type reply struct {
		SiteKey *speechKeyView   `json:"site_key"`
		Given   speechGiveCounts `json:"given"`
	}
	w := speechKeyPost(x.h, alice, csrf, "set", `{"region":"eu","key":"`+siteSoniox+`"}`)
	got := decodeInto[reply](t, w.Body.Bytes())
	// carol is admitted but has not joined: she is not offered it yet.
	if w.Code != 200 || got.SiteKey == nil || got.SiteKey.Suffix != "Kq7Z" || got.SiteKey.Region != "eu" || got.Given["seeded"] != 1 || got.Given["kept"] != 1 || len(got.Given) != 2 {
		t.Fatal("set", w.Code, w.Body.String())
	}
	if k, _ := daemons["43"].holds(); k != siteSoniox {
		t.Fatal("bob has no copy")
	}
	if k, _ := daemons["42"].holds(); k != "AliceOwn0000000000000000" {
		t.Fatal("alice's own key replaced")
	}
	// Setting the same key again reaches anyone the first set did not.
	got = decodeInto[reply](t, speechKeyPost(x.h, alice, csrf, "set", `{"region":"eu","key":"`+siteSoniox+`"}`).Body.Bytes())
	if got.Given["already_current"] != 1 || got.Given["kept"] != 1 {
		t.Fatal("second set", got.Given)
	}
	info, err := os.Stat(filepath.Join(x.dir, "site-soniox-key.json"))
	if err != nil || info.Mode().Perm() != 0600 {
		t.Fatal("key file", info, err)
	}
	read := request(x.h, "GET", siteSpeechKeyPath, alice)
	if read.Code != 200 || decodeInto[reply](t, read.Body.Bytes()).SiteKey.Suffix != "Kq7Z" {
		t.Fatal("read", read.Code, read.Body.String())
	}
	if w := request(x.h, "GET", siteSpeechKeyPath, bob); w.Code != 403 {
		t.Fatal("bob read the site key", w.Code)
	}

	// carol's first sign-in creates her account; her daemon is offered the key.
	x.broker.unbound = map[string]bool{"44": true}
	x.broker.routes["44"] = BrokerRoute{UID: uid, Username: "carol", Socket: "/run/open-habitat/users/carol/daemon.sock"}
	if x.login("44", "carol") == nil {
		t.Fatal("carol's sign-in")
	}
	deadline := time.Now().Add(5 * time.Second)
	for k, _ := daemons["44"].holds(); k != siteSoniox; k, _ = daemons["44"].holds() {
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
	if decodeInto[reply](t, request(x.h, "GET", siteSpeechKeyPath, alice).Body.Bytes()).SiteKey == nil {
		t.Fatal("key lost on restart")
	}
	if w := speechKeyPost(x.h, alice, x.csrf(alice), "delete", `{}`); w.Code != 200 || decodeInto[reply](t, w.Body.Bytes()).SiteKey != nil {
		t.Fatal("delete", w.Code, w.Body.String())
	}
	if _, err := os.Stat(filepath.Join(x.dir, "site-soniox-key.json")); !os.IsNotExist(err) {
		t.Fatal("key file kept", err)
	}
	if k, _ := daemons["43"].holds(); k != siteSoniox {
		t.Fatal("delete recalled bob's copy")
	}
	// The daemon is asked with the key and nothing else; no reply or log
	// line carries it.
	for _, r := range daemons["43"].requests {
		if len(r) != 3 || r["region"] != "eu" {
			t.Fatal("request carried more than the daemon needs", r)
		}
	}
	if strings.Contains(logs.String(), siteSoniox[:12]) {
		t.Fatal("log carries the key")
	}
}

// A changed or unreadable key file stops startup, like the AI key's.
func TestSiteSpeechKeyFileFailsClosed(t *testing.T) {
	x := newAccessHarness(t)
	path := filepath.Join(x.dir, "site-soniox-key.json")
	if err := os.WriteFile(path, []byte(`{"version":1,"region":"eu","key":"short","set_at":"2026-10-28T09:00:00Z"}`), 0600); err != nil {
		t.Fatal(err)
	}
	_, err := NewAuth(OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, AuthOptions{Provider: x.provider, Sink: x.sink, Broker: x.broker, SessionFile: filepath.Join(x.dir, "sessions.json"), AdminFile: filepath.Join(x.dir, "administration.json"), SiteKeyFile: filepath.Join(x.dir, "site-ai-key.json")})
	if err != ErrAdministrationState {
		t.Fatal("started with an invalid key file", err)
	}
}
