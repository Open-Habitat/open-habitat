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

func TestSpeechSiteCopyNeverReplacesTheOwnKey(t *testing.T) {
	home := t.TempDir()
	s := NewSpeech(transport.Config{Home: home}, func(*http.Request) bool { return true })
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
	if w := speechRequest(t, s.KeyHandler(), "POST", SpeechKeyPath, `{"key":"`+ownSpeechKey+`","region":"us"}`); w.Code != 200 {
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
	s := NewSpeech(transport.Config{Home: home}, func(*http.Request) bool { return true })
	h := s.KeyHandler()
	for _, tc := range []struct {
		method, body string
		status       int
	}{
		{"POST", `{"key":"` + ownSpeechKey + `","region":"jp"}`, 400},
		{"POST", `{"key":"$SONIOX_API_KEY","region":"eu"}`, 400},
		{"POST", `{"key":"` + ownSpeechKey + `","region":"eu","source":"site"}`, 400},
		{"PUT", `{"key":"` + ownSpeechKey + `","region":"eu"}`, 405},
		{"POST", `{"key":"` + ownSpeechKey + `","region":"eu"}`, 200},
	} {
		if w := speechRequest(t, h, tc.method, SpeechKeyPath, tc.body); w.Code != tc.status {
			t.Fatalf("%+v: %d %s", tc, w.Code, w.Body)
		}
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
	for _, h := range []http.Handler{untrusted.KeyHandler(), untrusted.SessionHandler(), untrusted.SiteKeyHandler()} {
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
	s := NewSpeechWithFixtureEndpoints(transport.Config{Home: home}, func(*http.Request) bool { return true }, func() SpeechEndpoints { return SpeechEndpoints{API: soniox.URL, WebSocket: "wss://soniox.invalid/ws"} }, nil)
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
