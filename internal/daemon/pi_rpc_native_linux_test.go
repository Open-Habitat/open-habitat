//go:build linux

package daemon

import (
	"context"
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

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// Exercises the pinned real Pi RPC parser with a disposable HOME and no
// provider credentials, prompts or network. It proves launch and acknowledgement,
// not a model response or a web control.
// The HTTP server is a synthetic OpenAI-compatible provider, not a real
// account. Pi itself handles the prompt, emits events, and writes native JSONL.
func TestPiRPCNativeSyntheticProvider(t *testing.T) {
	for _, legacy := range []bool{false, true} {
		t.Run(fmt.Sprintf("legacy_loadout=%v", legacy), func(t *testing.T) {
			testPiRPCNativeSyntheticProvider(t, legacy)
		})
	}
}

func testPiRPCNativeSyntheticProvider(t *testing.T, legacy bool) {
	binary, err := filepath.Abs(filepath.Join("pi-device-test", "node_modules", ".bin", "pi"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(binary); err != nil {
		t.Skip("pinned Pi test dependency not installed")
	}
	native, home := piFixture(t)
	credential := "sk-" + strings.Repeat("n", 24) + "wxyz"
	if _, err := native.credentials(context.Background(), "save", credential); err != nil {
		t.Fatal(err)
	}
	providerContexts := make(chan string, 4)
	var providerCalls atomic.Int32
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" || r.Method != http.MethodPost || r.Header.Get("Authorization") != "Bearer "+credential {
			t.Errorf("unexpected provider request: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(400)
			return
		}
		var body struct {
			Tools []struct {
				Function struct {
					Name string `json:"name"`
				} `json:"function"`
			} `json:"tools"`
			Messages []struct {
				Role    string          `json:"role"`
				Content json.RawMessage `json:"content"`
			} `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Error(err)
			w.WriteHeader(400)
			return
		}

		localTool := false
		for _, tool := range body.Tools {
			if tool.Function.Name == "local_files" {
				localTool = true
			}
		}
		// An earlier release had no local_files declaration in its transcript.
		wantLocalTool := !legacy || providerCalls.Add(1) > 1
		if localTool != wantLocalTool {
			t.Errorf("local_files declared=%v, want %v", localTool, wantLocalTool)
		}
		var system strings.Builder
		for _, message := range body.Messages {
			if message.Role == "system" || message.Role == "developer" {
				var content string
				if err := json.Unmarshal(message.Content, &content); err != nil {
					t.Error(err)
					w.WriteHeader(400)
					return
				}
				system.WriteString(content)
				system.WriteByte('\n')
			}
		}
		providerContexts <- system.String()
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"id\":\"synthetic\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"hello from synthetic\"},\"finish_reason\":null}]}\n\n")
		fmt.Fprint(w, "data: {\"id\":\"synthetic\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n")
	}))
	defer provider.Close()
	cwd := filepath.Join(home, "src", "synthetic")
	if err := os.MkdirAll(filepath.Join(home, ".pi", "agent"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(cwd, 0700); err != nil {
		t.Fatal(err)
	}
	models := map[string]any{"providers": map[string]any{"openai": map[string]any{
		"baseUrl": provider.URL + "/v1", "api": "openai-completions", "authHeader": true,
		"models": []any{map[string]any{"id": "initial", "name": "Initial", "reasoning": true}, map[string]any{"id": "fake", "name": "Fake", "reasoning": true}},
	}}}
	data, _ := json.Marshal(models)
	if err := os.WriteFile(filepath.Join(home, ".pi", "agent", "models.json"), data, 0600); err != nil {
		t.Fatal(err)
	}
	// Host context must compose with native personal and project context and
	// discovered skills, not replace the agent directory or user settings.
	for path, text := range map[string]string{
		filepath.Join(home, ".pi/agent/AGENTS.md"):             "personal-instruction-fixture",
		filepath.Join(home, ".pi/agent/APPEND_SYSTEM.md"):      "personal-append-fixture",
		filepath.Join(cwd, "AGENTS.md"):                        "project-instruction-fixture",
		filepath.Join(home, ".pi/agent/skills/local/SKILL.md"): "---\nname: local\ndescription: personal-skill-fixture\n---\nLocal skill\n",
	} {
		if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(text), 0600); err != nil {
			t.Fatal(err)
		}
	}
	assertContext := func() {
		t.Helper()
		select {
		case system := <-providerContexts:
			// CLI entry points are an agent-facing discovery contract, not UI
			// wording. Check them independently of hostContext so removing the
			// notice cue still fails even when the rest of the guide arrives.
			for _, text := range []string{hostContext, "open-habitat agent --help", "open-habitat agent notice create", "open-habitat agent notice create --help", "personal-instruction-fixture", "personal-append-fixture", "project-instruction-fixture", "personal-skill-fixture"} {
				if !strings.Contains(system, text) {
					t.Fatalf("native Pi did not load context: %q", text)
				}
			}
		case <-time.After(15 * time.Second):
			t.Fatal("no synthetic provider request")
		}
	}
	// Explicit startup choices must not overwrite the person's native defaults.
	settingsPath := filepath.Join(home, ".pi", "agent", "settings.json")
	originalSettings := []byte(`{"defaultProvider":"fixture","defaultModel":"other","defaultThinkingLevel":"off"}`)
	if err := os.WriteFile(settingsPath, originalSettings, 0600); err != nil {
		t.Fatal(err)
	}
	// Invoke the same Node CLI bundle as production, not the SDK export module.
	cli := filepath.Join("pi-device-test", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js")
	cli, err = filepath.Abs(cli)
	if err != nil {
		t.Fatal(err)
	}
	runtime := filepath.Join(home, "run")
	if err := os.Mkdir(runtime, 0700); err != nil {
		t.Fatal(err)
	}
	id, _ := uuid()
	owner, err := acquirePiOwnership(runtime, id)
	if err != nil {
		t.Fatal(err)
	}
	defer owner.release()
	if err := owner.markBrowser("ws_example123", cwd); err != nil {
		t.Fatal(err)
	}
	ws, err := os.Open(cwd)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	prefix := []string{cli, "--provider", "openai", "--model", "initial", "--thinking", "off"}
	if legacy {
		// Pi itself writes a genuine older loadout, not a hand-edited transcript.
		prefix = append(prefix, "--exclude-tools", "local_files")
	}
	p, err := launchPiRPCCommand("/usr/bin/node", prefix, home, cwd, []string{"PATH=/usr/bin:/bin"}, owner, ws, "ws_example123")
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	initial, err := p.requestQueue("get_state", "", 15*time.Second)
	if err != nil || !initial.Accepted || initial.Choice == nil || initial.Choice.Provider != "openai" || initial.Choice.Model != "initial" || initial.Choice.Thinking != "off" {
		t.Fatalf("native initial choice: %+v %v", initial, err)
	}
	// Pi has not persisted a fresh session before its first assistant message;
	// this is why automatic naming waits for native settlement.
	if initial, err := nativeSessions(transport.Config{Home: home, UID: os.Geteuid()}); err != nil || len(initial) != 0 {
		t.Fatalf("fresh Pi history before first reply: %+v, %v", initial, err)
	}
	// The first-message choice uses native non-persisting RPC setters on this
	// same child/session, not a replacement session or global settings write.
	c := &ConversationController{home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, sessions: map[string]*conversation{}}
	child := &conversation{id: id, cwd: cwd, rpc: p, owner: owner}
	c.sessions[id] = child
	if err := c.applyFirstChoice(child, &piStartupChoice{Provider: "openai", Model: "fake", Thinking: "low"}); err != nil {
		t.Fatal(err)
	}
	accepted, err := p.request("prompt", "Say hello", 15*time.Second)
	if err != nil || !accepted {
		t.Fatalf("Pi prompt: %v %v", accepted, err)
	}
	settled := false
	until := time.After(15 * time.Second)
	for !settled {
		select {
		case event, ok := <-p.events:
			if !ok {
				t.Fatal("Pi exited before agent_settled")
			}
			if strings.Contains(string(event), `"type":"agent_settled"`) {
				settled = true
			}
		case <-until:
			t.Fatal("Pi did not settle")
		}
	}
	assertContext()
	if p.overflow.Load() {
		t.Fatal("Pi events overflowed")
	}
	// Pi nests histories by cwd; scan through the same native reader as production.
	sessions, err := nativeSessions(transport.Config{Home: home, UID: os.Geteuid()})
	if err != nil || len(sessions) != 1 || sessions[0].id != id || sessions[0].cwd != cwd {
		t.Fatalf("native history: %+v, %v", sessions, err)
	}
	session := readNativeSettled(sessions[0].path, os.Geteuid())
	if session.state != "readable" {
		t.Fatalf("native history %s", session.state)
	}
	modelSelected, thinkingSelected := false, false
	for _, entry := range session.entries {
		if entry.Kind == "model_change" && entry.full == "openai/fake" {
			modelSelected = true
		}
		if entry.EntryType == "thinking_level_change" && entry.full == "low" {
			thinkingSelected = true
		}
	}
	if !modelSelected || !thinkingSelected {
		t.Fatalf("startup settings missing: model=%v thinking=%v", modelSelected, thinkingSelected)
	}
	if stored, err := os.ReadFile(settingsPath); err != nil || string(stored) != string(originalSettings) {
		t.Fatalf("startup flags changed native default: %s %v", stored, err)
	}
	found := false
	for _, entry := range session.entries {
		if strings.Contains(entry.full, "hello from synthetic") {
			found = true
		}
	}
	if !found {
		t.Fatal("native reply missing")
	}
	// This is the pinned real Pi RPC, not a fake JSONL writer: Pi appends
	// session_info itself and the daemon's native reader sees the result.
	if ok, err := p.request("set_session_name", "A native title", 4*time.Second); err != nil || !ok {
		t.Fatalf("native set_session_name: %v %v", ok, err)
	}
	if name := nativeName(readNativeHeader(sessions[0].path, os.Geteuid()), os.Geteuid()); name != "A native title" {
		t.Fatalf("native Pi title: %q", name)
	}
	// Exercise the pinned Pi abort wire command (on an idle turn); unlike
	// process stop it must leave the same child available for a state query.
	if ok, err := p.request("abort", "", 15*time.Second); err != nil || !ok {
		t.Fatalf("native abort: %v %v", ok, err)
	}
	if ok, err := p.request("get_state", "", 15*time.Second); err != nil || !ok {
		t.Fatalf("Pi after abort: %v %v", ok, err)
	}
	// Continuation after daemon restart goes through the same additive native
	// context path; an old history must not lose the current release's guide.
	p.close()
	resumed, err := launchPiRPCSession("/usr/bin/node", []string{cli, "--provider", "openai", "--model", "fake", "--thinking", "off"}, home, cwd, []string{"PATH=/usr/bin:/bin"}, owner, ws, sessions[0].path, "ws_example123")
	if err != nil {
		t.Fatal(err)
	}
	defer resumed.close()
	if ok, err := resumed.request("prompt", "Continue", 15*time.Second); err != nil || !ok {
		t.Fatalf("native continuation: %v %v", ok, err)
	}
	assertContext()
}

func TestPiRPCNativeState(t *testing.T) {
	binary, err := filepath.Abs(filepath.Join("pi-device-test", "node_modules", ".bin", "pi"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(binary); err != nil {
		t.Skip("pinned Pi test dependency not installed")
	}
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "synthetic")
	if err := os.MkdirAll(cwd, 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(binary, home, cwd, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	ok, err := p.request("get_state", "", 15*time.Second)
	if err != nil || !ok {
		t.Fatalf("real Pi get_state: %v %v", ok, err)
	}
}
