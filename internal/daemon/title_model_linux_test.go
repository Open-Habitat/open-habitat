//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
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
	var excerpt, answer atomic.Value
	excerpt.Store("")
	answer.Store("")
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
		if len(request.Messages) < 2 || (request.Messages[0].Role != "developer" && request.Messages[0].Role != "system") || !strings.Contains(fmt.Sprint(request.Messages[0].Content), "latest user message") || !strings.Contains(fmt.Sprint(request.Messages[1].Content), excerpt.Load().(string)) {
			t.Errorf("title language instruction absent: %+v", request.Messages)
		}
		instruction := fmt.Sprint(request.Messages[0].Content)
		if !strings.Contains(instruction, "2–5 words") || !strings.Contains(instruction, "32 characters") || !strings.Contains(instruction, "no label or prefix") {
			t.Errorf("title constraints absent: %s", instruction)
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
		content, _ := json.Marshal(answer.Load().(string))
		fmt.Fprintf(w, "data: {\"id\":\"synthetic\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":%s},\"finish_reason\":null}]}\n\n", content)
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
	for _, tc := range []struct{ name, input, raw, want string }{
		{"Finnish first title", "Testataan muistutusta tässä keskustelussa", "Muistutuksen testaus tässä keskustelussa", "Muistutuksen testaus tässä"},
		{"Finnish regeneration", titleExcerpt("Check the connection", "Puhu suomea ja tarkista yhteys"), "Tarkista synteettinen verkkoyhteys uudelleen tänään", "Tarkista synteettinen"},
		{"English first title", "Check synthetic workspace reminders", "Test synthetic workspace reminder delivery", "Test synthetic workspace"},
		{"English regeneration", titleExcerpt("Testataan muistutusta", "Check reminders in English"), "Check reminder delivery", "Check reminder delivery"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			excerpt.Store(tc.input)
			answer.Store(tc.raw)
			title, err := c.generateTitle(tc.input)
			if err != nil || title != tc.want {
				t.Fatalf("title %q, want %q: %v", title, tc.want, err)
			}
		})
	}
	if cheapCalls.Load() != 4 || fallbackCalls.Load() != 4 {
		t.Fatalf("cheap=%d fallback=%d", cheapCalls.Load(), fallbackCalls.Load())
	}
}
