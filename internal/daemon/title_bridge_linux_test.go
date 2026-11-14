//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"

	"github.com/open-habitat/open-habitat/internal/core"
	"github.com/open-habitat/open-habitat/internal/transport"
)

func TestTitleModelUsesShippedExtensionProvider(t *testing.T) {
	entry, err := filepath.Abs(filepath.Join("pi-device-test", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "index.js"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(entry); err != nil {
		t.Fatal("pinned Pi test dependency not installed")
	}
	var calls atomic.Int32
	var bridgeUnavailable atomic.Bool
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Model string `json:"model"`
			Tools any    `json:"tools"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Error(err)
		}
		if (request.Model != "fixture-sonnet" && request.Model != "fixture-luna") || request.Tools != nil || r.Header.Get("Authorization") != "Bearer synthetic" {
			t.Errorf("unexpected extension request: %+v", request)
		}
		calls.Add(1)
		if request.Model == "fixture-sonnet" && bridgeUnavailable.Load() {
			http.Error(w, "synthetic provider failure", http.StatusForbidden)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"id\":\"synthetic\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"{\\\"title\\\":\\\"Repository review\\\"}\"},\"finish_reason\":null}]}\n\ndata: {\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n")
	}))
	defer provider.Close()
	root := t.TempDir()
	node := filepath.Join(root, "bin", "node")
	bridge := filepath.Join(root, "node_modules", "pi-claude-bridge", "src", "index.ts")
	for _, dir := range []string{filepath.Dir(node), filepath.Dir(bridge)} {
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Symlink(nativeNodePath(t), node); err != nil {
		t.Fatal(err)
	}
	extension := fmt.Sprintf(`export default function(pi) {
 pi.registerProvider('claude-bridge', {
  baseUrl: %q, api: 'openai-completions', apiKey: 'synthetic', authHeader: true,
  models: ['fixture-opus', 'fixture-sonnet'].map(id => ({id, name: id, reasoning: false, input: ['text'], cost: {input:0, output:0, cacheRead:0, cacheWrite:0}, contextWindow: 8192, maxTokens: 1024}))
 });
}`, provider.URL+"/v1")
	if err := os.WriteFile(bridge, []byte(extension), 0600); err != nil {
		t.Fatal(err)
	}
	// No native credentials or models: registration is the only route to a title.
	home := t.TempDir()
	c := &ConversationController{home: home, cfg: transport.Config{Username: "synthetic"}, runtime: &core.PiRuntimeConfig{Node: node, Entry: entry}}
	for _, model := range []*piStartupChoice{nil, {Provider: "claude-bridge", Model: "fixture-opus"}} {
		title, err := c.generateTitle("Review repository", model)
		if err != nil || title != "Repository review" {
			t.Fatalf("extension-only title: %q %v", title, err)
		}
	}
	if calls.Load() != 2 {
		t.Fatalf("provider calls = %d", calls.Load())
	}
	// Installed does not mean signed in: native titles must still work when
	// the bridge advertises models but cannot answer.
	bridgeUnavailable.Store(true)
	agent := filepath.Join(home, ".pi", "agent")
	if err := os.MkdirAll(agent, 0700); err != nil {
		t.Fatal(err)
	}
	models := fmt.Sprintf(`{"providers":{"fixture":{"baseUrl":%q,"api":"openai-completions","apiKey":"synthetic","authHeader":true,"models":[{"id":"fixture-luna","name":"Luna","reasoning":false}]}}}`, provider.URL+"/v1")
	modelsPath := filepath.Join(agent, "models.json")
	if err := os.WriteFile(modelsPath, []byte(models), 0600); err != nil {
		t.Fatal(err)
	}
	for _, model := range []*piStartupChoice{nil, {Provider: "claude-bridge", Model: "fixture-opus"}} {
		if title, err := c.generateTitle("Review repository", model); err != nil || title != "Repository review" {
			t.Fatalf("native fallback: %q %v", title, err)
		}
	}
	if err := os.Remove(modelsPath); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(bridge); err != nil {
		t.Fatal(err)
	}
	if title, err := c.generateTitle("Review repository", nil); title != "" || err != titleModelUnavailable {
		t.Fatalf("missing bridge: %q %v", title, err)
	}
}
