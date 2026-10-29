//go:build linux

package daemon

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// The section's writes go through the pinned Pi's SettingsManager into the
// person's own settings.json, keep Pi's other keys, and refuse what the
// recap could not honour.
func TestRecapSettingsHandlerWritesPiSettings(t *testing.T) {
	p, home := piFixture(t)
	cfg := transport.Config{Home: home, UID: os.Geteuid()}
	handler := RecapSettingsHandler(cfg, func(*http.Request) bool { return true }, p)
	call := func(method, body string) (int, map[string]any) {
		t.Helper()
		r := httptest.NewRequest(method, "http://unix"+RecapSettingsPath, strings.NewReader(body))
		if body != "" {
			r.Header.Set("Content-Type", "application/json")
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		var reply map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &reply)
		return w.Code, reply
	}
	code, reply := call("GET", "")
	if code != 200 || reply["settings"].(map[string]any)["delay_seconds"] != 180.0 || reply["settings"].(map[string]any)["model"] != nil {
		t.Fatalf("defaults: %d %v", code, reply)
	}
	if err := os.MkdirAll(filepath.Join(home, ".pi", "agent"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(home, ".pi", "agent", "settings.json"), []byte(`{"defaultModel":"gpt-6-luna"}`), 0600); err != nil {
		t.Fatal(err)
	}
	valid := `{"level":"custom","delay_seconds":75,"model":"claude-bridge/claude-sonnet-5-5","words":25,"next_words":10,"messages":16,"history_tokens":4000,"message_tokens":500,"response_tokens":256,"first_after_turns":2}`
	code, reply = call("PUT", valid)
	if code != 200 {
		t.Fatalf("write: %d %v", code, reply)
	}
	if s := reply["settings"].(map[string]any); s["delay_seconds"] != 75.0 || s["model"] != "claude-bridge/claude-sonnet-5-5" || s["level"] != "custom" {
		t.Fatalf("readback: %v", s)
	}
	raw, _ := os.ReadFile(filepath.Join(home, ".pi", "agent", "settings.json"))
	if !strings.Contains(string(raw), `"defaultModel": "gpt-6-luna"`) || !strings.Contains(string(raw), `"delaySeconds": 75`) {
		t.Fatalf("Pi settings: %s", raw)
	}
	if recapDelay(home).Seconds() != 75 {
		t.Fatal("daemon delay does not follow the setting")
	}
	for name, body := range map[string]string{
		"fable":     strings.Replace(valid, "claude-sonnet-5-5", "claude-fable-5-1", 1),
		"opus":      strings.Replace(valid, "claude-sonnet-5-5", "claude-opus-5-5", 1),
		"provider":  strings.Replace(valid, "claude-bridge/", "fixture/", 1),
		"too long":  strings.Replace(valid, `"delay_seconds":75`, `"delay_seconds":600`, 1),
		"too short": strings.Replace(valid, `"delay_seconds":75`, `"delay_seconds":30`, 1),
		"level":     strings.Replace(valid, `"custom"`, `"manual"`, 1),
		"missing":   strings.Replace(valid, `"words":25,`, ``, 1),
		"unknown":   strings.Replace(valid, `"words":25,`, `"words":25,"mode":"manual",`, 1),
		"duplicate": strings.Replace(valid, `"words":25,`, `"words":25,"words":30,`, 1),
	} {
		if code, _ := call("PUT", body); code != 400 {
			t.Errorf("%s accepted: %d", name, code)
		}
	}
	// Automatic is no key at all; a hand-edited bad value is its default.
	code, reply = call("PUT", strings.Replace(valid, `"claude-bridge/claude-sonnet-5-5"`, `null`, 1))
	if code != 200 || reply["settings"].(map[string]any)["model"] != nil {
		t.Fatalf("automatic: %d %v", code, reply)
	}
	if err := os.WriteFile(filepath.Join(home, ".pi", "agent", "settings.json"), []byte(`{"openHabitat":{"recap":{"level":"short","delaySeconds":5,"words":30,"model":"claude-bridge/claude-opus-5-5"}}}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, reply = call("GET", ""); reply["settings"].(map[string]any)["delay_seconds"] != 180.0 || reply["settings"].(map[string]any)["words"] != 30.0 || reply["settings"].(map[string]any)["model"] != nil {
		t.Fatalf("hand-edited: %v", reply)
	}
}
