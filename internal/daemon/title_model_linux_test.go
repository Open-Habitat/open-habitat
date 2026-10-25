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
	"time"

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
	var excerpt, answer, retryAnswer, finish atomic.Value
	var attempt atomic.Int32
	var holdRewrite atomic.Bool
	excerpt.Store("")
	answer.Store("")
	retryAnswer.Store("")
	finish.Store("stop")
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
		if request.Tools != nil || request.MaxTokens > 256 {
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
		raw := answer.Load().(string)
		if attempt.Add(1) > 1 {
			raw = retryAnswer.Load().(string)
			if holdRewrite.Load() {
				<-r.Context().Done()
				return
			}
		}
		content, _ := json.Marshal(raw)
		fmt.Fprintf(w, "data: {\"id\":\"synthetic\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":%s},\"finish_reason\":null}]}\n\n", content)
		fmt.Fprintf(w, "data: {\"id\":\"synthetic\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":%q}]}\n\ndata: [DONE]\n\n", finish.Load().(string))
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
	c := &ConversationController{home: home, cfg: transport.Config{Username: "synthetic"}, runtime: &core.PiRuntimeConfig{Node: nativeNodePath(t), Entry: entry}}
	for _, tc := range []struct {
		name, input, raw, retry, want string
		calls                         int32
	}{
		{"Finnish rewrite", "Tarkista repositorion sisältö ja laadi yhteenveto", `{"title":"Repositorion sisällön tarkistus ja yhteenveto","fallback":"Sisällön tarkistus"}`, `{"title":"Repositorion yhteenveto","fallback":"Sisällön tarkistus"}`, "Repositorion yhteenveto", 2},
		{"Finnish fallback after rewrite", titleExcerpt("Check the connection", "Puhu suomea ja tarkista yhteys"), `{"title":"Tarkista synteettinen verkkoyhteys uudelleen tänään","fallback":"Verkkoyhteyden tarkistus"}`, `{"title":"Tarkista synteettinen verkkoyhteys uudelleen tänään","fallback":"Verkkoyhteyden tarkistus"}`, "Verkkoyhteyden tarkistus", 2},
		{"English long first message", "Review repository contents. " + strings.Repeat("Synthetic documentation and source details. ", 300), `{"title":"Synthetic repository review","fallback":"Repository review"}`, "", "Synthetic repository review", 1},
		{"Fenced JSON", "Review repository", "```json\n{\"title\":\"Repository review\",\"fallback\":\"Code review\"}\n```", "", "Repository review", 1},
		{"English regeneration", titleExcerpt("Testataan muistutusta", "Check reminders in English"), `{"title":"Check reminder delivery","fallback":"Reminder delivery"}`, "", "Check reminder delivery", 1},
		{"invalid responses never cut", "Review synthetic repository", `{"title":"one two three four five six","fallback":"an extremely overlong fallback phrase here"}`, `{"title":"Read supercalifragilisticexpialidocious"}`, "", 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			excerpt.Store(prefixBytes(tc.input, 4096))
			answer.Store(tc.raw)
			retryAnswer.Store(tc.retry)
			attempt.Store(0)
			title, err := c.generateTitle(tc.input)
			if title != tc.want || (err != nil) != (tc.want == "") {
				t.Fatalf("title %q, want %q: %v", title, tc.want, err)
			}
			if tc.want == "" && err != titleModelInvalid {
				t.Fatalf("invalid response mislabeled as unavailable: %v", err)
			}
			if attempt.Load() != tc.calls {
				t.Fatalf("provider calls %d, want %d", attempt.Load(), tc.calls)
			}
		})
	}
	// A provider's output cap is an invalid answer, not missing entitlement;
	// even a complete-looking fragment must never be accepted as a whole title.
	finish.Store("length")
	excerpt.Store("Review synthetic repository")
	answer.Store(`{"title":"Repository review","fallback":"Code review"}`)
	retryAnswer.Store(`{"title":"Repository review","fallback":"Code review"}`)
	attempt.Store(0)
	if title, err := c.generateTitle("Review synthetic repository"); title != "" || err != titleModelInvalid || attempt.Load() != 2 {
		t.Fatalf("token-limited answer accepted or misclassified: %q %v; calls=%d", title, err, attempt.Load())
	}
	// Keep an already generated complete phrase when the rewrite stalls. The
	// native SDK must actually cancel its HTTP call before the Go hard deadline.
	finish.Store("stop")
	holdRewrite.Store(true)
	answer.Store(`{"title":"one two three four five six","fallback":"Repositorion tarkistus"}`)
	attempt.Store(0)
	start := time.Now()
	if title, err := c.generateTitle("Review synthetic repository"); err != nil || title != "Repositorion tarkistus" || attempt.Load() != 2 {
		t.Fatalf("lost complete fallback during stalled rewrite: %q %v; calls=%d", title, err, attempt.Load())
	}
	if time.Since(start) >= 15*time.Second {
		t.Fatal("fallback outlived the daemon's hard deadline")
	}
	if cheapCalls.Load() != 8 || fallbackCalls.Load() != 13 {
		t.Fatalf("cheap=%d fallback=%d", cheapCalls.Load(), fallbackCalls.Load())
	}
}
