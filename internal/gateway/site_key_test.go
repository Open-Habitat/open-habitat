package gateway

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Synthetic keys: shaped like the providers' but never real.
var (
	anthropicKey = "sk-ant-" + strings.Repeat("S", 30) + "wxyz"
	openaiKey    = "sk-" + strings.Repeat("O", 30) + "abcd"
)

func siteKeyPost(h http.Handler, c *http.Cookie, csrf, verb, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest("POST", "https://host.test/api/v1/server/onboarding/ai-key/"+verb, strings.NewReader(body))
	r.AddCookie(c)
	r.Header.Set("Origin", "https://host.test")
	r.Header.Set("X-Agent-Host-CSRF", csrf)
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

// withSiteKeyFile gives a signed-in fixture its key file beside the
// administration state.
func withSiteKeyFile(t *testing.T, a *Auth, admin string) string {
	t.Helper()
	path := filepath.Join(filepath.Dir(admin), "site-ai-key.json")
	if e := a.loadSiteKey(path); e != nil {
		t.Fatal(e)
	}
	return path
}

// The administrator sets the key and the offer becomes site_key in the same
// operation; every read names only provider, suffix and time. The key is in
// its own 0600 file and nowhere else: not the administration state, a reply,
// a log line or the person's own read. While it is stored, a document write
// cannot move the offer away; delete needs the replacement offer and leaves
// no file.
func TestSiteKeySetReadDelete(t *testing.T) {
	h, a, cookie, csrf, admin := signedIn(t)
	var logs bytes.Buffer
	a.log = CallbackLogger(&logs)
	keyFile := withSiteKeyFile(t, a, admin)

	for _, bad := range []string{
		`{"provider":"openai","key":"` + anthropicKey + `"}`,
		`{"provider":"anthropic","key":"` + openaiKey + `"}`,
		`{"provider":"openai","key":"!cat /etc/passwd"}`,
		`{"provider":"openai","key":"$OPENAI_API_KEY"}`,
		`{"provider":"mistral","key":"` + openaiKey + `"}`,
	} {
		w := siteKeyPost(h, cookie, csrf, "set", bad)
		if w.Code != 400 || errorCode(t, w) != "invalid_key" {
			t.Fatalf("%s: %d %s", bad, w.Code, w.Body.String())
		}
	}
	if w := siteKeyPost(h, cookie, csrf, "set", `{"provider":"openai","key":"`+openaiKey+`","offer":"all"}`); w.Code != 400 {
		t.Fatal("set took an offer", w.Code)
	}
	if w := siteKeyPost(h, cookie, "wrong", "set", `{"provider":"openai","key":"`+openaiKey+`"}`); w.Code != 403 {
		t.Fatal("set without CSRF", w.Code)
	}
	if _, e := os.Stat(keyFile); !os.IsNotExist(e) {
		t.Fatal("a refused set wrote the key file")
	}

	w := siteKeyPost(h, cookie, csrf, "set", `{"provider":"anthropic","key":"`+anthropicKey+`"}`)
	var got onboardingReply
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &got) != nil || got.AIAccount.Offer != "site_key" || got.Version != 1 || got.SiteKey == nil || got.SiteKey.Provider != "anthropic" || got.SiteKey.Suffix != "wxyz" || got.SiteKey.SetAt == "" {
		t.Fatalf("set: %d %s", w.Code, w.Body.String())
	}
	info, e := os.Stat(keyFile)
	stored, _ := os.ReadFile(keyFile)
	if e != nil || info.Mode().Perm() != 0600 || !bytes.Contains(stored, []byte(anthropicKey)) {
		t.Fatal("key file", e, info)
	}
	state, _ := os.ReadFile(admin)
	read := request(h, "GET", "/api/v1/server/onboarding", cookie)
	site := request(h, "GET", "/api/v1/onboarding/site", cookie)
	shown, _ := a.AdminControl(t.Context(), []byte(`{"operation":"ai_key_show"}`))
	for name, leak := range map[string][]byte{"administration": state, "set reply": w.Body.Bytes(), "read": read.Body.Bytes(), "person read": site.Body.Bytes(), "control show": shown, "logs": logs.Bytes()} {
		if bytes.Contains(leak, []byte(anthropicKey)) || bytes.Contains(leak, []byte(anthropicKey[:20])) {
			t.Fatalf("%s carries the key", name)
		}
	}
	if !bytes.Contains(read.Body.Bytes(), []byte(`"suffix":"wxyz"`)) || !bytes.Contains(shown, []byte(`"stored":true`)) {
		t.Fatal("reads lost the key's description", read.Body.String(), string(shown))
	}
	// The person's step, when native Pi status shows it at all, offers
	// everything: the seed did not give them a usable key.
	if !bytes.Contains(site.Body.Bytes(), []byte(`"offer":"all"`)) || bytes.Contains(site.Body.Bytes(), []byte("suffix")) {
		t.Fatal("person read", site.Body.String())
	}

	// A document write keeps site_key and cannot change it.
	doc := `{"repositories":{"mode":"preselected","defaults":[]},"integrations":[],"ai_account":{"offer":"claude"}}`
	if w := onboardingPut(h, cookie, csrf, withExpected(doc, 1)); w.Code != 400 || errorCode(t, w) != "site_key_stored" {
		t.Fatal("offer moved off site_key while the key is stored", w.Code, w.Body.String())
	}
	keep := strings.Replace(doc, `"claude"`, `"site_key"`, 1)
	if w := onboardingPut(h, cookie, csrf, withExpected(keep, 1)); w.Code != 200 {
		t.Fatal("a write that keeps site_key", w.Code, w.Body.String())
	}

	// Replacing changes future seeds only and leaves the version alone.
	w = siteKeyPost(h, cookie, csrf, "set", `{"provider":"openai","key":"`+openaiKey+`"}`)
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &got) != nil || got.Version != 2 || got.SiteKey.Provider != "openai" || got.SiteKey.Suffix != "abcd" {
		t.Fatal("replace", w.Code, w.Body.String())
	}
	if seed := a.siteKeySeed(); seed == nil || seed.Key != openaiKey {
		t.Fatal("replacement is not what new people get")
	}

	if w := siteKeyPost(h, cookie, csrf, "delete", `{"offer":"site_key"}`); w.Code != 400 || errorCode(t, w) != "invalid_offer" {
		t.Fatal("delete kept site_key", w.Code)
	}
	if w := siteKeyPost(h, cookie, csrf, "delete", `{}`); w.Code != 400 {
		t.Fatal("delete without a replacement offer", w.Code)
	}
	w = siteKeyPost(h, cookie, csrf, "delete", `{"offer":"claude"}`)
	got = onboardingReply{}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &got) != nil || got.AIAccount.Offer != "claude" || got.SiteKey != nil || got.Version != 3 {
		t.Fatal("delete", w.Code, w.Body.String())
	}
	if _, e := os.Stat(keyFile); !os.IsNotExist(e) || a.siteKeySeed() != nil {
		t.Fatal("deleted key still stored")
	}
	if w := siteKeyPost(h, cookie, csrf, "delete", `{"offer":"all"}`); w.Code != 400 || errorCode(t, w) != "site_key_unavailable" {
		t.Fatal("delete with nothing stored", w.Code)
	}
	if bytes.Contains(logs.Bytes(), []byte(openaiKey)) {
		t.Fatal("logged the key")
	}
}

// Root's control path is the same writer, and its dry runs write nothing.
func TestSiteKeyControlDryRunWritesNothing(t *testing.T) {
	_, a, _, _, admin := signedIn(t)
	keyFile := withSiteKeyFile(t, a, admin)
	set := []byte(`{"operation":"ai_key_set_check","provider":"openai","key":"` + openaiKey + `"}`)
	reply, e := a.AdminControl(t.Context(), set)
	if e != nil || !bytes.Contains(reply, []byte(`"suffix":"abcd"`)) || bytes.Contains(reply, []byte(openaiKey)) {
		t.Fatal(string(reply), e)
	}
	if _, e := os.Stat(keyFile); !os.IsNotExist(e) {
		t.Fatal("dry run wrote the key")
	}
	if c, _ := a.onboardingView(); c.AIAccount.Offer != "all" || c.Version != 0 {
		t.Fatal("dry run changed the offer", c)
	}
	if _, e := a.AdminControl(t.Context(), bytes.Replace(set, []byte("_check"), nil, 1)); e != nil {
		t.Fatal(e)
	}
	if _, e := a.AdminControl(t.Context(), []byte(`{"operation":"ai_key_delete_check","offer":"all"}`)); e != nil {
		t.Fatal(e)
	}
	if _, e := os.Stat(keyFile); e != nil || a.siteKeySeed() == nil {
		t.Fatal("dry delete removed the key")
	}
	_, e = a.AdminControl(t.Context(), []byte(`{"operation":"ai_key_delete","offer":"all"}`))
	if c, _ := a.onboardingView(); e != nil || c.AIAccount.Offer != "all" || a.siteKeySeed() != nil {
		t.Fatal("control delete", e, c)
	}
}

// A key whose offer is not site_key is an interrupted set or delete that was
// never reported as done: loading removes it. A key file that is not the
// gateway's private record fails startup closed. An offer of site_key whose
// key is gone seeds nothing.
func TestSiteKeyLoadIsClosedAndFinishesInterruptedChanges(t *testing.T) {
	dir := t.TempDir()
	admin := filepath.Join(dir, "administration.json")
	keyFile := filepath.Join(dir, "site-ai-key.json")
	record := `{"version":1,"provider":"openai","key":"` + openaiKey + `","set_at":"2026-10-24T09:00:00Z"}`
	state := func(offer string) string {
		return `{"version":1,"name":"","administrators":[],"onboarding":{"version":1,"repositories":{"mode":"preselected","defaults":[]},"integrations":[],"ai_account":{"offer":"` + offer + `"}}}`
	}
	load := func() (*Auth, error) {
		a := &Auth{log: CallbackLogger(&bytes.Buffer{})}
		if e := a.loadAdministration(admin); e != nil {
			return nil, e
		}
		return a, a.loadSiteKey(keyFile)
	}
	write := func(path, body string, mode os.FileMode) {
		t.Helper()
		if e := os.WriteFile(path, []byte(body), mode); e != nil {
			t.Fatal(e)
		}
		if e := os.Chmod(path, mode); e != nil {
			t.Fatal(e)
		}
	}

	write(admin, state("all"), 0600)
	write(keyFile, record, 0600)
	if a, e := load(); e != nil || a.siteKeySeed() != nil {
		t.Fatal("interrupted change kept", e)
	}
	if _, e := os.Stat(keyFile); !os.IsNotExist(e) {
		t.Fatal("interrupted change left its key on disk")
	}

	write(admin, state("site_key"), 0600)
	a, e := load()
	if e != nil || a.siteKeySeed() != nil {
		t.Fatal("site_key without a key seeds", e)
	}
	// Its key gone by hand, the offer can still be left the usual way.
	a.siteKeyFile = keyFile
	if c, _, e := a.deleteSiteKey("", "claude", false); e != nil || c.AIAccount.Offer != "claude" {
		t.Fatal("offer without its key could not be left", e)
	}
	write(admin, state("site_key"), 0600)
	write(keyFile, record, 0600)
	if a, e := load(); e != nil || a.siteKeySeed() == nil {
		t.Fatal("stored key not loaded", e)
	}
	for _, bad := range []struct {
		body string
		mode os.FileMode
	}{
		{record, 0640},
		{strings.Replace(record, `"version":1`, `"version":2`, 1), 0600},
		{strings.Replace(record, openaiKey, "!cmd", 1), 0600},
		{strings.Replace(record, `}`, `,"extra":1}`, 1), 0600},
		{"not json", 0600},
	} {
		write(keyFile, bad.body, bad.mode)
		if _, e := load(); !errors.Is(e, ErrAdministrationState) {
			t.Fatalf("accepted %q %o", bad.body, bad.mode)
		}
	}
}

// The key is seeded only in the handoff of the login whose ensure created
// the binding: the receipt records the daemon's answer, a later login (as
// after a lost handoff or a broker restart, when ensure no longer says
// created) carries no seed, and nothing retries.
func TestSiteKeySeededOnlyInTheCreatingLogin(t *testing.T) {
	h, a, _, s, logs, admin := planFixture(t, "preselected")
	withSiteKeyFile(t, a, admin)
	if _, _, e := a.setSiteKey("", "anthropic", anthropicKey, false); e != nil {
		t.Fatal(e)
	}
	s.seed = func(SiteKeySeed) (string, error) { return "", errors.New("lost") }
	if w, _ := login(t, h); w.Code == 303 {
		t.Fatal("lost handoff answer issued a session")
	}
	if len(s.seeds) != 1 || s.seeds[0] != (SiteKeySeed{"anthropic", anthropicKey}) || len(s.plans) != 0 {
		t.Fatalf("first login handed over %+v %+v", s.seeds, s.plans)
	}
	if r, _ := a.receiptFor("42"); r.AIKey != "unknown" {
		t.Fatal("lost answer recorded as", r.AIKey)
	}
	s.seed = nil
	if w, _ := login(t, h); w.Code != 303 || len(s.seeds) != 1 {
		t.Fatal("a later login seeded", w.Code, len(s.seeds))
	}
	stored, _ := os.ReadFile(admin)
	if bytes.Contains(stored, []byte(anthropicKey)) || bytes.Contains(logs.Bytes(), []byte(anthropicKey)) {
		t.Fatal("seed persisted in administration state or logged")
	}
}

// The receipt keeps the daemon's word: seeded, or already_present when the
// person's own credential stayed. A site without a key records not_offered
// and hands nothing over.
func TestSiteKeyReceiptRecordsTheAnswer(t *testing.T) {
	for _, answer := range []string{"seeded", "already_present", "failed", "unexpected"} {
		h, a, _, s, _, admin := planFixture(t, "preselected")
		withSiteKeyFile(t, a, admin)
		if _, _, e := a.setSiteKey("", "openai", openaiKey, false); e != nil {
			t.Fatal(e)
		}
		s.seed = func(SiteKeySeed) (string, error) { return answer, nil }
		if w, _ := login(t, h); w.Code != 303 {
			t.Fatal(answer, w.Code)
		}
		want := answer
		if answer == "unexpected" {
			want = "unknown"
		}
		if r, _ := a.receiptFor("42"); r.AIKey != want {
			t.Fatal(answer, r.AIKey)
		}
	}
	h, a, _, s, _, _ := planFixture(t, "preselected")
	if w, _ := login(t, h); w.Code != 303 || len(s.seeds) != 0 {
		t.Fatal("seeded without a key")
	}
	if r, _ := a.receiptFor("42"); r.AIKey != "not_offered" {
		t.Fatal(r.AIKey)
	}
}
