//go:build linux

package gateway

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
)

// fakePi is one person's daemon as the site key route sees it: what their
// Pi holds for the provider, decided with the gateway's fingerprints the way
// the daemon's helper does. The real decision under Pi's lock is proven in
// the daemon package against the pinned Pi SDK.
type fakePi struct {
	mu       sync.Mutex
	entry    string // "" none, "oauth", or a literal key
	fail     bool   // answer 503 after deciding, as a failed settings step does
	requests []map[string]any
	ln       net.Listener
}

func (f *fakePi) serve(t *testing.T, path string) {
	ln, err := net.Listen("unix", path)
	if err != nil {
		t.Fatal(err)
	}
	f.ln = ln
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != siteKeyDaemonPath || r.Method != http.MethodPost {
			w.WriteHeader(404)
			return
		}
		var body map[string]any
		if json.NewDecoder(r.Body).Decode(&body) != nil {
			w.WriteHeader(400)
			return
		}
		f.mu.Lock()
		defer f.mu.Unlock()
		f.requests = append(f.requests, body)
		salt, _ := hex.DecodeString(body["salt"].(string))
		fp := func(k string) string {
			m := hmac.New(sha256.New, salt)
			m.Write([]byte(k))
			return hex.EncodeToString(m.Sum(nil))
		}
		current, _ := body["current"].(string)
		if key, ok := body["key"].(string); ok {
			current = fp(key)
		}
		var earlier []string
		for _, e := range body["earlier"].([]any) {
			earlier = append(earlier, e.(string))
		}
		state := "own"
		switch {
		case f.entry == "":
			state = "absent"
		case f.entry == "oauth":
		case fp(f.entry) == current:
			state = "current"
		case slices.Contains(earlier, fp(f.entry)):
			state = "earlier"
		}
		w.Header().Set("Content-Type", "application/json")
		if body["action"] == "check" {
			json.NewEncoder(w).Encode(map[string]any{"schema_version": 1, "state": state})
			return
		}
		if state == "absent" || state == "earlier" {
			f.entry = body["key"].(string)
		}
		if f.fail {
			w.WriteHeader(503)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"schema_version": 1, "outcome": map[string]string{"absent": "seeded", "earlier": "replaced", "current": "already_current", "own": "kept"}[state]})
	})}
	go srv.Serve(ln)
	t.Cleanup(func() { srv.Close() })
}

func (f *fakePi) holds() string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.entry
}

// siteKeyDesk is the access harness with a site key file and one fake
// daemon per joined person: alice (42, the administrator), bob (43) and
// carol (44).
func siteKeyDesk(t *testing.T) (*accessHarness, map[string]*fakePi) {
	t.Helper()
	x := newAccessHarness(t)
	uid := uint32(os.Getuid())
	dir, err := os.MkdirTemp("", "sk")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	x.broker.runtime["44"] = "admitted"
	daemons := map[string]*fakePi{}
	sockets := map[string]string{}
	for id, name := range map[string]string{"42": "alice", "43": "bob", "44": "carol"} {
		x.broker.routes[id] = BrokerRoute{UID: uid, Username: name, Socket: "/run/open-habitat/users/" + name + "/daemon.sock"}
		daemons[id] = &fakePi{}
		sockets["/run/open-habitat/users/"+name+"/daemon.sock"] = filepath.Join(dir, name)
		daemons[id].serve(t, filepath.Join(dir, name))
	}
	x.auth.snapshotDial = func(ctx context.Context, path string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", sockets[path])
	}
	return x, daemons
}

func (x *accessHarness) csrf(c *http.Cookie) string {
	return extractCSRF(x.t, request(x.h, "GET", "/auth/session", c).Body.String())
}

func decodeInto[T any](t *testing.T, b []byte) T {
	t.Helper()
	var v T
	if e := json.Unmarshal(b, &v); e != nil {
		t.Fatal(e, string(b))
	}
	return v
}

// An administrator gives the site key to people who joined before it
// existed: the person's daemon answers one word, writes only where their Pi
// has nothing for the provider or exactly an earlier site copy, and never
// over their own credential. A new key replaces every recorded copy. No
// reply, log line or record outside the key file carries the key.
func TestSiteKeyGiveAndReplaceCopies(t *testing.T) {
	x, pi := siteKeyDesk(t)
	var logs bytes.Buffer
	x.auth.log = CallbackLogger(&logs)
	alice := x.login("42", "alice")
	csrf := x.csrf(alice)
	pi["42"].entry = "oauth"
	pi["44"].entry = "sk-ant-" + strings.Repeat("M", 30) + "mine"

	w := siteKeyPost(x.h, alice, csrf, "set", `{"provider":"anthropic","key":"`+anthropicKey+`"}`)
	if w.Code != 200 || strings.Contains(w.Body.String(), "rotation") {
		t.Fatal("first set", w.Code, w.Body.String())
	}
	k1 := decodeInto[onboardingReply](t, w.Body.Bytes()).SiteKey

	type copies struct {
		SiteKey *siteKeyView  `json:"site_key"`
		People  []copiesEntry `json:"people"`
		Waiting int           `json:"waiting"`
	}
	read := func() copies {
		t.Helper()
		w := request(x.h, "GET", siteKeyPath+"/copies", alice)
		if w.Code != 200 {
			t.Fatal("copies", w.Code, w.Body.String())
		}
		return decodeInto[copies](t, w.Body.Bytes())
	}
	c := read()
	if len(c.People) != 3 || c.SiteKey == nil || c.SiteKey.Suffix != "wxyz" {
		t.Fatalf("copies %+v", c)
	}
	for _, p := range c.People {
		if p.Copy != nil {
			t.Fatal("a copy before any was given", p)
		}
	}
	check := func(subject string) (int, string) {
		w := siteKeyPost(x.h, alice, csrf, "check", `{"subject":"`+subject+`"}`)
		if w.Code != 200 {
			return w.Code, errorCode(t, w)
		}
		return 200, decodeInto[struct{ State string }](t, w.Body.Bytes()).State
	}
	for subject, want := range map[string]string{"42": "own", "43": "absent", "44": "own"} {
		if code, got := check(subject); code != 200 || got != want {
			t.Fatal(subject, code, got)
		}
	}
	if code, got := check("99"); code != 404 || got != "subject_unavailable" {
		t.Fatal("unbound subject", code, got)
	}
	if pi["43"].holds() != "" {
		t.Fatal("a check wrote")
	}
	give := func(subject string, k *siteKeyView) (int, string) {
		b, _ := json.Marshal(map[string]string{"subject": subject, "provider": k.Provider, "suffix": k.Suffix, "set_at": k.SetAt})
		w := siteKeyPost(x.h, alice, csrf, "seed", string(b))
		if w.Code != 200 {
			return w.Code, errorCode(t, w)
		}
		return 200, decodeInto[struct{ Outcome string }](t, w.Body.Bytes()).Outcome
	}
	if code, got := give("43", k1); code != 200 || got != "seeded" || pi["43"].holds() != anthropicKey {
		t.Fatal("give bob", code, got)
	}
	if code, got := give("44", k1); code != 200 || got != "kept" || !strings.HasSuffix(pi["44"].holds(), "mine") {
		t.Fatal("carol's own key", code, got)
	}
	stale := *k1
	stale.Suffix = "zzzz"
	if code, got := give("43", &stale); code != 409 || got != "site_key_changed" {
		t.Fatal("stale key", code, got)
	}
	// The daemon gets no identity and the check no key.
	for _, r := range pi["43"].requests {
		if _, ok := r["subject"]; ok || r["action"] == "check" && r["key"] != nil {
			t.Fatal("request carried more than the daemon needs", r)
		}
	}

	// Bob's own read says the key is the site's; carol's says nothing.
	bob := x.login("43", "bob")
	site := decodeInto[siteOnboarding](t, request(x.h, "GET", "/api/v1/onboarding/site", bob).Body.Bytes())
	if site.SiteKeyCopy == nil || !site.SiteKeyCopy.Current || site.SiteKeyCopy.Suffix != "wxyz" {
		t.Fatalf("bob's read %+v", site.SiteKeyCopy)
	}
	carol := x.login("44", "carol")
	if strings.Contains(request(x.h, "GET", "/api/v1/onboarding/site", carol).Body.String(), "site_key_copy") {
		t.Fatal("carol's own key read as the site's")
	}
	// Only administrators reach the copies.
	if w := request(x.h, "GET", siteKeyPath+"/copies", bob); w.Code != 403 {
		t.Fatal("bob read the copies", w.Code)
	}
	if w := siteKeyPost(x.h, bob, x.csrf(bob), "check", `{"subject":"44"}`); w.Code != 403 {
		t.Fatal("bob checked carol", w.Code)
	}

	// A new key of the same provider replaces bob's copy, and only it.
	k2 := "sk-ant-" + strings.Repeat("T", 30) + "7Q2x"
	w = siteKeyPost(x.h, alice, csrf, "set", `{"provider":"anthropic","key":"`+k2+`"}`)
	rotated := decodeInto[struct {
		Rotation []rotationResult `json:"rotation"`
	}](t, w.Body.Bytes())
	if w.Code != 200 || len(rotated.Rotation) != 1 || rotated.Rotation[0] != (rotationResult{"43", "replaced"}) || pi["43"].holds() != k2 || pi["42"].holds() != "oauth" {
		t.Fatal("rotation", w.Code, w.Body.String())
	}
	// A person the next change cannot reach stays on the record with the
	// earlier key, and the administrator sees it.
	pi["43"].ln.Close()
	k3 := "sk-ant-" + strings.Repeat("U", 30) + "k3k3"
	w = siteKeyPost(x.h, alice, csrf, "set", `{"provider":"anthropic","key":"`+k3+`"}`)
	rotated = decodeInto[struct {
		Rotation []rotationResult `json:"rotation"`
	}](t, w.Body.Bytes())
	if len(rotated.Rotation) != 1 || rotated.Rotation[0].Outcome != "not_reached" || pi["43"].holds() != k2 {
		t.Fatal("unreachable rotation", w.Body.String())
	}
	for _, p := range read().People {
		if p.ID == "43" && (p.Copy == nil || p.Copy.Current || p.Copy.Suffix != "7Q2x") {
			t.Fatalf("bob's earlier copy %+v", p.Copy)
		}
	}
	// An unanswered write may have written: it is recorded, so the next key
	// reaches the person, and a give that finds their own credential removes
	// the record again.
	pi["42"].mu.Lock()
	pi["42"].fail = true
	pi["42"].mu.Unlock()
	k3view := decodeInto[onboardingReply](t, w.Body.Bytes()).SiteKey
	if code, got := give("42", k3view); code != 200 || got != "unknown" || x.auth.copyView("42") == nil {
		t.Fatal("unanswered write", code, got)
	}
	pi["42"].mu.Lock()
	pi["42"].fail = false
	pi["42"].mu.Unlock()
	k4 := "sk-ant-" + strings.Repeat("V", 30) + "k4k4"
	w = siteKeyPost(x.h, alice, csrf, "set", `{"provider":"anthropic","key":"`+k4+`"}`)
	if !strings.Contains(w.Body.String(), `{"subject":"42","outcome":"kept"}`) || x.auth.copyView("42") != nil || pi["42"].holds() != "oauth" {
		t.Fatal("own credential after an unanswered write", w.Body.String())
	}
	// Removing the key leaves the copies with their people.
	if w := siteKeyPost(x.h, alice, csrf, "delete", `{"offer":"all"}`); w.Code != 200 {
		t.Fatal("delete", w.Code)
	}
	if v := x.auth.copyView("43"); v == nil || v.Current {
		t.Fatal("copy after delete", v)
	}

	// The browser cannot reach the daemon route through the gateway.
	before := len(pi["42"].requests)
	if w := request(x.h, "POST", siteKeyDaemonPath, alice); w.Code == 200 || len(pi["42"].requests) != before {
		t.Fatal("daemon route reachable from the browser", w.Code)
	}

	ledger := x.file("site-ai-key-copies.json")
	info, _ := os.Stat(filepath.Join(x.dir, "site-ai-key-copies.json"))
	if info == nil || info.Mode().Perm() != 0600 || !strings.Contains(ledger, `"43"`) {
		t.Fatal("copies record", info, ledger)
	}
	for name, leak := range map[string]string{"copies record": ledger, "administration": x.file("administration.json"), "logs": logs.String()} {
		for _, k := range []string{anthropicKey, k2, k3} {
			if strings.Contains(leak, k) || strings.Contains(leak, k[:20]) {
				t.Fatalf("%s carries a key", name)
			}
		}
	}
	if strings.Contains(x.file("administration.json"), x.auth.ledger.Salt) {
		t.Fatal("administration state carries the fingerprint salt")
	}

	// The record survives a restart and fails closed when it is not the
	// gateway's private file.
	x.restart()
	if v := x.auth.copyView("43"); v == nil || v.Suffix != "7Q2x" {
		t.Fatal("record lost at restart", v)
	}
	if e := os.Chmod(filepath.Join(x.dir, "site-ai-key-copies.json"), 0644); e != nil {
		t.Fatal(e)
	}
	if _, e := NewAuth(OAuthConfig{ClientID: "f", ClientSecret: "f", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, AuthOptions{Provider: x.provider, Sink: x.sink, Broker: x.broker, AdminFile: filepath.Join(x.dir, "administration.json"), SiteKeyFile: filepath.Join(x.dir, "site-ai-key.json")}); e == nil {
		t.Fatal("a readable copies record loaded")
	}
}

// Root's admin ai-key seed goes through the same path: the dry run asks the
// person's daemon and writes nothing; the write answers the daemon's word.
func TestSiteKeySeedControl(t *testing.T) {
	x, pi := siteKeyDesk(t)
	ctx := context.Background()
	if _, e := x.auth.AdminControl(ctx, []byte(`{"operation":"ai_key_seed_check","subject":"43"}`)); e == nil {
		t.Fatal("seed check without a key")
	}
	if _, _, e := x.auth.setSiteKey("", "openai", openaiKey, false); e != nil {
		t.Fatal(e)
	}
	out, e := x.auth.AdminControl(ctx, []byte(`{"operation":"ai_key_seed_check","subject":"43"}`))
	if e != nil || !strings.Contains(string(out), `"state":"absent"`) || pi["43"].holds() != "" {
		t.Fatal("dry run", string(out), e)
	}
	out, e = x.auth.AdminControl(ctx, []byte(`{"operation":"ai_key_seed","subject":"43"}`))
	if e != nil || !strings.Contains(string(out), `"outcome":"seeded"`) || pi["43"].holds() != openaiKey || strings.Contains(string(out), openaiKey) {
		t.Fatal("seed", string(out), e)
	}
	out, e = x.auth.AdminControl(ctx, []byte(`{"operation":"ai_key_set_check","provider":"openai","key":"sk-`+strings.Repeat("N", 30)+`next"}`))
	if e != nil || !strings.Contains(string(out), `"replaces":["43"]`) {
		t.Fatal("set dry run names who it replaces", string(out), e)
	}
	if _, e := x.auth.AdminControl(ctx, []byte(`{"operation":"ai_key_seed","subject":"43","key":"x"}`)); e == nil {
		t.Fatal("seed took a key")
	}
	out, e = x.auth.AdminControl(ctx, []byte(`{"operation":"ai_key_copies"}`))
	if e != nil || !strings.Contains(string(out), `"id":"43"`) || !strings.Contains(string(out), `"current":true`) {
		t.Fatal("copies", string(out), e)
	}
}
