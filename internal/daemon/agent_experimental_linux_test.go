//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/experimental"
	"github.com/open-habitat/open-habitat/internal/transport"
)

func TestAgentExperimentalPreferences(t *testing.T) {
	home := t.TempDir()
	cfg := transport.Config{UID: os.Geteuid(), Home: home, Socket: filepath.Join(home, "daemon.sock"), Provider: "github", Subject: "42"}
	path := filepath.Join(home, "agent.sock")
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	handler := agentHandler(cfg, nil, "test", "", nil)
	go func() { done <- transport.ServeAgent(ctx, ln, cfg, handler) }()
	defer func() {
		cancel()
		if err := <-done; err != nil {
			t.Error(err)
		}
	}()
	tr := &http.Transport{DialContext: func(context.Context, string, string) (net.Conn, error) { return net.Dial("unix", path) }}
	defer tr.CloseIdleConnections()
	client := &http.Client{Transport: tr, Timeout: 5 * time.Second}
	call := func(method, target, body string, want int) []byte {
		t.Helper()
		req, _ := http.NewRequest(method, "http://unix"+target, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-UID", "99999") // Never selects a different person's file.
		res, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		data, _ := io.ReadAll(res.Body)
		if res.StatusCode != want {
			t.Fatalf("%s %s: %d %s", method, target, res.StatusCode, data)
		}
		return data
	}
	data := call("GET", AgentExperimentalPath, "", 200)
	matchesSchema(t, "experimental-features.schema.json", string(data))
	if _, err := os.Stat(filepath.Join(home, ".config")); !os.IsNotExist(err) {
		t.Fatal("read wrote preferences")
	}
	var reply struct {
		Features []experimentalChoice `json:"features"`
	}
	if json.Unmarshal(data, &reply) != nil || len(reply.Features) != len(experimental.List()) {
		t.Fatal(string(data))
	}
	for _, f := range reply.Features {
		if f.Enabled {
			t.Fatal("new preferences enabled")
		}
	}
	// Preserve unrelated preferences and stale ids, but never offer stale ids.
	initial := accountPreferences{Engine: "vscode", Language: "en-GB", Experimental: map[string]bool{"retired-feature": true, "shares-page": true}}
	if err := savePreferences(home, initial); err != nil {
		t.Fatal(err)
	}
	for _, body := range []string{
		`{"id":"unknown-feature","enabled":true}`, `{"id":"explain-mode","enabled":true}`, `{"id":"explain-mode","enabled":null}`,
		`{"id":"explain-mode","enabled":true,"uid":99999}`, `{"id":"explain-mode","enabled":true,"home":"/other"}`,
		`{"id":"explain-mode","enabled":true,"enabled":false}`, `{"ID":"explain-mode","enabled":true}`,
		`{"id":"explain-mode","enabled":true} {}`, `{"id":"explain-mode","enabled":"true"}`,
	} {
		call("PUT", AgentExperimentalPath, body, 400)
	}
	call("GET", AgentExperimentalPath+"?uid=99999", "", 400)
	call("GET", AgentExperimentalPath, `{}`, 400)
	call("PUT", AgentExperimentalPath+"?subject=43", `{"id":"explain-mode","enabled":true}`, 400)
	call("GET", "/agent/v1/%65xperimental", "", 404)
	stored, err := readPreferences(home)
	if err != nil || stored.Experimental["explain-mode"] {
		t.Fatal("rejection wrote", err)
	}
	for _, on := range []bool{true, true, false} {
		body, _ := json.Marshal(map[string]any{"id": "rewind-conversation", "enabled": on})
		data = call("PUT", AgentExperimentalPath, string(body), 200)
		if json.Unmarshal(data, &reply) != nil {
			t.Fatal(string(data))
		}
		found := false
		for _, f := range reply.Features {
			if f.ID == "retired-feature" || f.ID == "shares-page" || f.ID == "explain-mode" {
				t.Fatal("stale choice offered")
			}
			if f.ID == "rewind-conversation" {
				found = true
				if f.Enabled != on {
					t.Fatal("wrong confirmation")
				}
			}
		}
		if !found {
			t.Fatal("missing feature")
		}
		stored, err = readPreferences(home)
		if err != nil || stored.Experimental["rewind-conversation"] != on || !stored.Experimental["shares-page"] || !stored.Experimental["retired-feature"] || stored.Engine != "vscode" || stored.Language != "en-GB" {
			t.Fatalf("lost preference: %+v %v", stored, err)
		}
		// The browser reads the very same preference, not an agent-only store.
		req := httptest.NewRequest("GET", AccountPreferencesPath, nil)
		req.Host = "unix"
		w := httptest.NewRecorder()
		AccountPreferencesHandler(cfg, func(*http.Request) bool { return true }).ServeHTTP(w, req)
		if w.Code != 200 {
			t.Fatal(w.Code, w.Body.String())
		}
		var browser struct {
			Experimental map[string]bool `json:"experimental"`
		}
		if json.Unmarshal(w.Body.Bytes(), &browser) != nil || browser.Experimental["rewind-conversation"] != on {
			t.Fatal(w.Body.String())
		}
	}
	// A forged identity header is not the transport-installed peer capability.
	for _, method := range []string{"GET", "PUT"} {
		req := httptest.NewRequest(method, AgentExperimentalPath, strings.NewReader(`{"id":"explain-mode","enabled":true}`))
		req.Header.Set("X-UID", "99999")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != 403 {
			t.Fatal("foreign identity accepted")
		}
	}
	if err := os.WriteFile(filepath.Join(home, ".config/open-habitat/preferences.json"), []byte("broken"), 0600); err != nil {
		t.Fatal(err)
	}
	call("GET", AgentExperimentalPath, "", 503)
	call("PUT", AgentExperimentalPath, `{"id":"rewind-conversation","enabled":true}`, 503)
}

// Settings › Vaaralliset toiminnot is the person's to allow in the browser:
// the agent listener reads nothing of it and has no route that writes it,
// neither the browser's preferences path nor the experimental switch.
func TestAgentListenerCannotAllowRiskyFeature(t *testing.T) {
	home := t.TempDir()
	cfg := transport.Config{UID: os.Geteuid(), Home: home, Socket: filepath.Join(home, "daemon.sock"), Provider: "github", Subject: "42"}
	path := filepath.Join(home, "agent.sock")
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- transport.ServeAgent(ctx, ln, cfg, agentHandler(cfg, nil, "test", "", nil)) }()
	defer func() {
		cancel()
		if err := <-done; err != nil {
			t.Error(err)
		}
	}()
	tr := &http.Transport{DialContext: func(context.Context, string, string) (net.Conn, error) { return net.Dial("unix", path) }}
	defer tr.CloseIdleConnections()
	client := &http.Client{Transport: tr, Timeout: 5 * time.Second}
	for _, tc := range []struct{ method, target, body string }{
		{"PUT", AccountPreferencesPath, `{"risky":{"conversation-links":true}}`},
		{"GET", AccountPreferencesPath, ""},
		{"PUT", AgentExperimentalPath, `{"id":"conversation-links","enabled":true}`},
		{"PUT", "/agent/v1/risky", `{"id":"conversation-links","enabled":true}`},
		{"PUT", "/agent/v1/preferences", `{"risky":{"conversation-links":true}}`},
	} {
		req, _ := http.NewRequest(tc.method, "http://unix"+tc.target, strings.NewReader(tc.body))
		req.Header.Set("Content-Type", "application/json")
		res, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		data, _ := io.ReadAll(res.Body)
		res.Body.Close()
		if res.StatusCode < 400 {
			t.Fatalf("%s %s: %d %s", tc.method, tc.target, res.StatusCode, data)
		}
	}
	stored, err := readPreferences(home)
	if err != nil || len(stored.Risky) != 0 {
		t.Fatalf("the agent allowed a risky feature: %+v %v", stored, err)
	}
}
