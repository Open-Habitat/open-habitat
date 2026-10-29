//go:build linux

package daemon

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

const ownSpeechKey = "own0000000000000000000000000Ab12"
const siteSpeechKey = "site000000000000000000000000Zz99"

func speechRequest(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(method, "http://unix"+path, strings.NewReader(body))
	if body != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

// regionalSoniox is a synthetic Soniox with an API address per region, in
// which each key works only in its own region and the other answers 401,
// as Soniox does (speech-key-wrong-region). A key it does not list is
// refused everywhere; status, when set, is every answer instead.
type regionalSoniox struct {
	srv     *httptest.Server
	mu      sync.Mutex
	regions map[string]string
	asked   []string
	status  atomic.Int32
}

func newRegionalSoniox(t *testing.T, regions map[string]string) *regionalSoniox {
	f := &regionalSoniox{regions: regions}
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		region, path, _ := strings.Cut(strings.TrimPrefix(r.URL.Path, "/"), "/")
		key := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		f.mu.Lock()
		f.asked = append(f.asked, region)
		home := f.regions[key]
		f.mu.Unlock()
		switch code := int(f.status.Load()); {
		case path != "v1/auth/temporary-api-key":
			http.NotFound(w, r)
		case code != 0:
			http.Error(w, `{"error_type":"secret detail"}`, code)
		case home != region:
			http.Error(w, `{"error_type":"unauthenticated","message":"secret detail"}`, 401)
		default:
			w.Header().Set("Content-Type", "application/json")
			io.WriteString(w, `{"api_key":"snx_temp_`+region+`_123456","expires_at":"2026-10-28T10:01:00.123Z"}`)
		}
	}))
	t.Cleanup(f.srv.Close)
	return f
}

func (f *regionalSoniox) speech(home string) *Speech {
	return NewSpeechWithFixtureEndpoints(transport.Config{Home: home}, func(*http.Request) bool { return true }, func(region string) SpeechEndpoints {
		return SpeechEndpoints{API: f.srv.URL + "/" + region, WebSocket: "wss://" + region + ".soniox.invalid/ws"}
	}, nil)
}

func (f *regionalSoniox) takeAsked() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	asked := f.asked
	f.asked = nil
	return asked
}

func TestSpeechSiteCopyNeverReplacesTheOwnKey(t *testing.T) {
	home := t.TempDir()
	s := newRegionalSoniox(t, map[string]string{ownSpeechKey: "us"}).speech(home)
	give := func(key, region, want string) {
		t.Helper()
		got, err := s.GiveSiteKey(key, region)
		if err != nil || got != want {
			t.Fatalf("give %s: %q %v, want %q", key, got, err, want)
		}
	}
	give(siteSpeechKey, "eu", "seeded")
	give(siteSpeechKey, "eu", "already_current")
	// The same key in another region is another credential pair.
	give(siteSpeechKey, "us", "replaced")
	give("next000000000000000000000000Zz98", "eu", "replaced")
	if w := speechRequest(t, s.KeyHandler(), "POST", SpeechKeyPath, `{"key":"`+ownSpeechKey+`"}`); w.Code != 200 {
		t.Fatalf("save: %d %s", w.Code, w.Body)
	}
	give(siteSpeechKey, "eu", "kept")
	k, err := readSpeechKey(home)
	if err != nil || k.APIKey != ownSpeechKey || k.Source != "own" {
		t.Fatalf("own key replaced: %+v %v", k, err)
	}
	st, err := os.Stat(filepath.Join(home, ".config/soniox/key.json"))
	if err != nil || st.Mode().Perm() != 0600 {
		t.Fatalf("permissions: %v %v", st, err)
	}
	// A file the daemon cannot read as the person's key is never absence: a
	// site copy must not land over it.
	if err := os.WriteFile(filepath.Join(home, ".config/soniox/key.json"), []byte(`{"api_key":"x"}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GiveSiteKey(siteSpeechKey, "eu"); err == nil {
		t.Fatal("gave over an unreadable key file")
	}
	if err := os.Chmod(filepath.Join(home, ".config/soniox/key.json"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := readSpeechKey(home); err == nil {
		t.Fatal("accepted a key file others can read")
	}
}

func TestSpeechKeyRoutesReplyWithoutTheKey(t *testing.T) {
	home := t.TempDir()
	soniox := newRegionalSoniox(t, map[string]string{ownSpeechKey: "eu"})
	s := soniox.speech(home)
	h := s.KeyHandler()
	for _, tc := range []struct {
		method, body string
		status       int
	}{
		// The region is Soniox's answer, never the browser's.
		{"POST", `{"key":"` + ownSpeechKey + `","region":"eu"}`, 400},
		{"POST", `{"key":"$SONIOX_API_KEY"}`, 400},
		{"POST", `{"key":"` + ownSpeechKey + `","source":"site"}`, 400},
		{"PUT", `{"key":"` + ownSpeechKey + `"}`, 405},
		{"POST", `{"key":"` + ownSpeechKey + `"}`, 200},
	} {
		if w := speechRequest(t, h, tc.method, SpeechKeyPath, tc.body); w.Code != tc.status {
			t.Fatalf("%+v: %d %s", tc, w.Code, w.Body)
		}
	}
	// The EU, the default here, took the EU key at the first ask.
	if asked := soniox.takeAsked(); strings.Join(asked, ",") != "eu" {
		t.Fatalf("asked: %v", asked)
	}
	w := speechRequest(t, h, "GET", SpeechKeyPath, "")
	if strings.Contains(w.Body.String(), ownSpeechKey[:20]) {
		t.Fatalf("reply carries the key: %s", w.Body)
	}
	var state speechKeyState
	if json.Unmarshal(w.Body.Bytes(), &state) != nil || !state.Present || *state.Suffix != "Ab12" || *state.Region != "eu" || *state.Source != "own" {
		t.Fatalf("state: %s", w.Body)
	}
	w = speechRequest(t, h, "DELETE", SpeechKeyPath, "")
	if json.Unmarshal(w.Body.Bytes(), &state) != nil || state.Present {
		t.Fatalf("after delete: %s", w.Body)
	}
	untrusted := NewSpeech(transport.Config{Home: home}, func(*http.Request) bool { return false })
	for _, h := range []http.Handler{untrusted.KeyHandler(), untrusted.SessionHandler(), untrusted.SiteKeyHandler(), untrusted.KeyCheckHandler()} {
		if w := speechRequest(t, h, "POST", SpeechKeyPath, ""); w.Code != 403 {
			t.Fatalf("untrusted peer: %d", w.Code)
		}
	}
}

func TestSpeechSessionMintsAndMapsSonioxFailures(t *testing.T) {
	var status atomic.Int32
	var seen atomic.Value
	soniox := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		seen.Store(r.Method + " " + r.URL.Path + " " + r.Header.Get("Authorization") + " " + string(body))
		if code := int(status.Load()); code != 200 {
			// Soniox's own words never reach the browser.
			http.Error(w, `{"error_type":"secret detail"}`, code)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"api_key":"snx_temp_abcdef123456","expires_at":"2026-10-28T10:01:00.123Z"}`)
	}))
	defer soniox.Close()
	home := t.TempDir()
	s := NewSpeechWithFixtureEndpoints(transport.Config{Home: home}, func(*http.Request) bool { return true }, func(string) SpeechEndpoints { return SpeechEndpoints{API: soniox.URL, WebSocket: "wss://soniox.invalid/ws"} }, nil)
	h := s.SessionHandler()
	if w := speechRequest(t, h, "POST", SpeechSessionPath, ""); w.Code != 409 || !strings.Contains(w.Body.String(), `"speech_key_missing"`) {
		t.Fatalf("no key: %d %s", w.Code, w.Body)
	}
	if _, err := s.GiveSiteKey(siteSpeechKey, "eu"); err != nil {
		t.Fatal(err)
	}
	status.Store(200)
	w := speechRequest(t, h, "POST", SpeechSessionPath, "")
	var session speechSession
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &session) != nil || session.APIKey != "snx_temp_abcdef123456" || session.ExpiresAt != "2026-10-28T10:01:00Z" || session.WebSocketURL != "wss://soniox.invalid/ws" || session.MaxSessionSeconds != 600 {
		t.Fatalf("session: %d %s", w.Code, w.Body)
	}
	var request struct {
		UsageType          string `json:"usage_type"`
		ExpiresIn          int    `json:"expires_in_seconds"`
		SingleUse          bool   `json:"single_use"`
		MaxSessionDuration int    `json:"max_session_duration_seconds"`
	}
	got := seen.Load().(string)
	prefix := "POST /v1/auth/temporary-api-key Bearer " + siteSpeechKey + " "
	if !strings.HasPrefix(got, prefix) || json.Unmarshal([]byte(strings.TrimPrefix(got, prefix)), &request) != nil || request != (struct {
		UsageType          string `json:"usage_type"`
		ExpiresIn          int    `json:"expires_in_seconds"`
		SingleUse          bool   `json:"single_use"`
		MaxSessionDuration int    `json:"max_session_duration_seconds"`
	}{"transcribe_websocket", 60, true, 600}) {
		t.Fatalf("Soniox request: %s", got)
	}
	for code, want := range map[int32]string{401: "speech_key_rejected", 403: "speech_key_rejected", 429: "speech_limit_reached", 500: "speech_unavailable"} {
		status.Store(code)
		w := speechRequest(t, h, "POST", SpeechSessionPath, "")
		if !strings.Contains(w.Body.String(), `"`+want+`"`) || strings.Contains(w.Body.String(), "secret detail") {
			t.Fatalf("%d: %d %s", code, w.Code, w.Body)
		}
	}
	// The daemon's own bound: a browser in a loop stops minting.
	status.Store(200)
	s.mints = nil
	clock := time.Date(2026, 10, 28, 10, 0, 0, 0, time.UTC)
	s.now = func() time.Time { return clock }
	for i := range speechMintsPerMinute {
		if w := speechRequest(t, h, "POST", SpeechSessionPath, ""); w.Code != 200 {
			t.Fatalf("mint %d: %d", i, w.Code)
		}
	}
	if w := speechRequest(t, h, "POST", SpeechSessionPath, ""); w.Code != 429 || !strings.Contains(w.Body.String(), "speech_limit_reached") {
		t.Fatalf("over the bound: %d %s", w.Code, w.Body)
	}
	clock = clock.Add(61 * time.Second)
	if w := speechRequest(t, h, "POST", SpeechSessionPath, ""); w.Code != 200 {
		t.Fatalf("after a minute: %d", w.Code)
	}
	soniox.Close()
	if w := speechRequest(t, h, "POST", SpeechSessionPath, ""); w.Code != 503 || !strings.Contains(w.Body.String(), "speech_unavailable") {
		t.Fatalf("unreachable: %d %s", w.Code, w.Body)
	}
}

func TestSpeechProductionClientRefusesLoopback(t *testing.T) {
	soniox := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("loopback reached")
	}))
	defer soniox.Close()
	s := newSpeech(transport.Config{Home: t.TempDir()}, func(*http.Request) bool { return true }, func(string) SpeechEndpoints { return SpeechEndpoints{API: soniox.URL} }, false)
	if _, err := s.GiveSiteKey(siteSpeechKey, "eu"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Mint(t.Context()); err != errSpeechUnavailable {
		t.Fatalf("mint: %v", err)
	}
}

// A synthetic key of the Soniox console's project shape, never a real one.
var projectSpeechKey = "snx_proj_" + strings.Repeat("A", 43) + "." + strings.Repeat("b", 86) + ".0-Cd12"

func TestSonioxKeyShapeTakesProjectKeys(t *testing.T) {
	for key, want := range map[string]bool{
		ownSpeechKey:                      true,
		projectSpeechKey:                  true,
		"short":                           false,
		strings.Repeat("A", 257):          false,
		"$SONIOX_API_KEY000000":           false,
		"snx_proj_0000000000000000.":      false,
		".snx_proj_0000000000000000":      false,
		"snx_proj_00000000..0000000000":   false,
		"snx_proj_0000000000000000000.ab": false,
		"a.b.c.d.e0000000000000":          false,
		"snx_proj_000000 00000000000":     false,
	} {
		if ValidSonioxKey(key) != want {
			t.Errorf("%q: want %v", key, want)
		}
	}
	home := t.TempDir()
	s := newRegionalSoniox(t, map[string]string{projectSpeechKey: "us"}).speech(home)
	if w := speechRequest(t, s.KeyHandler(), "POST", SpeechKeyPath, `{"key":"`+projectSpeechKey+`"}`); w.Code != 200 {
		t.Fatalf("save: %d %s", w.Code, w.Body)
	}
	if k, err := readSpeechKey(home); err != nil || k.APIKey != projectSpeechKey {
		t.Fatalf("project key did not round-trip: %+v %v", k, err)
	}
	var state speechKeyState
	if w := speechRequest(t, s.KeyHandler(), "GET", SpeechKeyPath, ""); json.Unmarshal(w.Body.Bytes(), &state) != nil || *state.Suffix != "Cd12" {
		t.Fatalf("state: %s", w.Body)
	}
	// A plain key stored before project keys still reads as the person's.
	if err := os.WriteFile(filepath.Join(home, ".config/soniox/key.json"), []byte(`{"api_key":"`+ownSpeechKey+`","region":"us","source":"own"}`), 0600); err != nil {
		t.Fatal(err)
	}
	if k, err := readSpeechKey(home); err != nil || k.APIKey != ownSpeechKey {
		t.Fatalf("stored plain key: %+v %v", k, err)
	}
}

// A key that works in neither region, or a Soniox that cannot be asked, is
// never saved: an unchecked key would read as refused at every dictation.
func TestSpeechKeySaveChecksTheKeyWithSoniox(t *testing.T) {
	home := t.TempDir()
	soniox := newRegionalSoniox(t, map[string]string{ownSpeechKey: "us"})
	s := soniox.speech(home)
	h := s.KeyHandler()
	for code, want := range map[int32]string{0: "speech_key_rejected", 503: "speech_unavailable", 429: "speech_limit_reached"} {
		soniox.status.Store(code)
		w := speechRequest(t, h, "POST", SpeechKeyPath, `{"key":"`+siteSpeechKey+`"}`)
		if w.Code == 200 || !strings.Contains(w.Body.String(), `"`+want+`"`) || strings.Contains(w.Body.String(), "secret detail") {
			t.Fatalf("%d: %d %s", code, w.Code, w.Body)
		}
		if k, err := readSpeechKey(home); k != nil || err != nil {
			t.Fatalf("%d: saved %+v %v", code, k, err)
		}
	}
	// Only a refusal moves on to the other region: an unreachable EU is
	// not a reason to guess the US.
	soniox.takeAsked()
	soniox.status.Store(503)
	speechRequest(t, h, "POST", SpeechKeyPath, `{"key":"`+ownSpeechKey+`"}`)
	if asked := soniox.takeAsked(); strings.Join(asked, ",") != "eu" {
		t.Fatalf("asked after an unreachable region: %v", asked)
	}
	// The EU, the default here, is asked first; a US key after its refusal.
	soniox.status.Store(0)
	var state speechKeyState
	if w := speechRequest(t, h, "POST", SpeechKeyPath, `{"key":"`+ownSpeechKey+`"}`); w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &state) != nil || *state.Region != "us" {
		t.Fatalf("save: %d %s", w.Code, w.Body)
	}
	if asked := soniox.takeAsked(); strings.Join(asked, ",") != "eu,us" {
		t.Fatalf("asked for a US key: %v", asked)
	}

	// The gateway's check of an administrator's key stores nothing.
	check := func(key, want string) {
		t.Helper()
		w := speechRequest(t, s.KeyCheckHandler(), "POST", SpeechKeyCheckPath, `{"schema_version":1,"key":"`+key+`"}`)
		if w.Code != 200 || strings.TrimSpace(w.Body.String()) != want {
			t.Fatalf("check %s: %d %s", key[:4], w.Code, w.Body)
		}
	}
	soniox.mu.Lock()
	soniox.regions[siteSpeechKey] = "eu"
	soniox.mu.Unlock()
	check(siteSpeechKey, `{"outcome":"works","region":"eu","schema_version":1}`)
	check(projectSpeechKey, `{"outcome":"rejected","schema_version":1}`)
	soniox.status.Store(500)
	check(siteSpeechKey, `{"outcome":"unavailable","schema_version":1}`)
	if k, err := readSpeechKey(home); err != nil || k.APIKey != ownSpeechKey {
		t.Fatalf("check changed the stored key: %+v %v", k, err)
	}
	if w := speechRequest(t, s.KeyCheckHandler(), "POST", SpeechKeyCheckPath, `{"schema_version":1,"key":"`+siteSpeechKey+`","region":"eu"}`); w.Code != 400 {
		t.Fatalf("check took a region: %d", w.Code)
	}
}

// A key stored under the wrong region, as the old region picker allowed
// (Jari's site copy on Birch), is tried once in the other region at the
// next dictation, which then starts, and its file says the right region.
func TestSpeechMintHealsAWrongRegion(t *testing.T) {
	home := t.TempDir()
	soniox := newRegionalSoniox(t, map[string]string{siteSpeechKey: "us"})
	s := soniox.speech(home)
	if _, err := s.GiveSiteKey(siteSpeechKey, "eu"); err != nil {
		t.Fatal(err)
	}
	session, err := s.Mint(t.Context())
	if err != nil || session.APIKey != "snx_temp_us_123456" || session.WebSocketURL != "wss://us.soniox.invalid/ws" {
		t.Fatalf("mint: %+v %v", session, err)
	}
	if asked := soniox.takeAsked(); strings.Join(asked, ",") != "eu,us" {
		t.Fatalf("asked: %v", asked)
	}
	if k, err := readSpeechKey(home); err != nil || k.Region != "us" || k.Source != "site" || k.APIKey != siteSpeechKey {
		t.Fatalf("not corrected: %+v %v", k, err)
	}
	// The next dictation asks the right region straight away.
	if _, err := s.Mint(t.Context()); err != nil {
		t.Fatal(err)
	}
	if asked := soniox.takeAsked(); strings.Join(asked, ",") != "us" {
		t.Fatalf("asked after correction: %v", asked)
	}
	// A key refused everywhere is refused, and its file stays as it was.
	soniox.mu.Lock()
	delete(soniox.regions, siteSpeechKey)
	soniox.mu.Unlock()
	if _, err := s.Mint(t.Context()); err != errSpeechRejected {
		t.Fatalf("refused key: %v", err)
	}
	if k, _ := readSpeechKey(home); k.Region != "us" {
		t.Fatalf("refused key's file changed: %+v", k)
	}
}
