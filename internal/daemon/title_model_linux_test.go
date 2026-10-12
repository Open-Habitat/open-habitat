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

	"github.com/Open-Habitat/open-habitat/internal/core"
	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestTitleModelUsesPinnedPiRuntimeWithSyntheticProvider(t *testing.T) {
	entry, err := filepath.Abs(filepath.Join("pi-device-test", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "index.js"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(entry); err != nil {
		t.Skip("pinned Pi test dependency not installed")
	}
	var cheapCalls, fallbackCalls atomic.Int32
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" || r.Header.Get("Authorization") != "Bearer synthetic" {
			t.Errorf("unexpected provider call %s", r.URL.Path)
			w.WriteHeader(400)
			return
		}
		var request struct {
			Messages []struct {
				Role    string `json:"role"`
				Content any    `json:"content"`
			} `json:"messages"`
			Tools     any    `json:"tools"`
			MaxTokens int    `json:"max_tokens"`
			Model     string `json:"model"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Error(err)
		}
		if request.Tools != nil || request.MaxTokens > 48 {
			t.Errorf("unbounded/tool-enabled title: %+v", request)
		}
		// The first advertised model can fail even when Pi has another one.
		// Provider error bodies must not be echoed by the helper.
		if request.Model == "cheap" {
			cheapCalls.Add(1)
			http.Error(w, "synthetic-provider-secret", 503)
			return
		}
		if request.Model != "fake" {
			t.Errorf("unexpected model: %q", request.Model)
		}
		fallbackCalls.Add(1)
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"id\":\"synthetic\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"Otsikko suomeksi\"},\"finish_reason\":null}]}\n\n")
		fmt.Fprint(w, "data: {\"id\":\"synthetic\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n")
	}))
	defer provider.Close()
	home := t.TempDir()
	agent := filepath.Join(home, ".pi", "agent")
	if err := os.MkdirAll(agent, 0700); err != nil {
		t.Fatal(err)
	}
	model := map[string]any{"providers": map[string]any{"fixture": map[string]any{"baseUrl": provider.URL + "/v1", "api": "openai-completions", "apiKey": "synthetic", "authHeader": true, "models": []any{map[string]any{"id": "cheap", "name": "Cheap", "reasoning": false}, map[string]any{"id": "fake", "name": "Fake", "reasoning": true}}}}}
	data, _ := json.Marshal(model)
	if err := os.WriteFile(filepath.Join(agent, "models.json"), data, 0600); err != nil {
		t.Fatal(err)
	}
	c := &ConversationController{home: home, cfg: transport.Config{Username: "synthetic"}, runtime: &core.PiRuntimeConfig{Node: "/usr/bin/node", Entry: entry}}
	title, err := c.generateTitle("Puhu suomea")
	if err != nil || title != "Otsikko suomeksi" || cheapCalls.Load() != 1 || fallbackCalls.Load() != 1 {
		t.Fatalf("title %q: %v, cheap=%d fallback=%d", title, err, cheapCalls.Load(), fallbackCalls.Load())
	}
}
