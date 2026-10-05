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
	"testing"
	"time"

	"github.com/maintainer/native-agent-host/internal/transport"
)

// Exercises the pinned real Pi RPC parser with a disposable HOME and no
// provider credentials, prompts or network. It proves launch and acknowledgement,
// not a model response or a web control.
// The HTTP server is a synthetic OpenAI-compatible provider, not a real
// account. Pi itself handles the prompt, emits events, and writes native JSONL.
func TestPiRPCNativeSyntheticProvider(t *testing.T) {
	binary, err := filepath.Abs(filepath.Join("pi-device-test", "node_modules", ".bin", "pi"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(binary); err != nil {
		t.Skip("pinned Pi test dependency not installed")
	}
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" || r.Method != http.MethodPost || r.Header.Get("Authorization") != "Bearer synthetic" {
			t.Errorf("unexpected provider request: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(400)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"id\":\"synthetic\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"hello from synthetic\"},\"finish_reason\":null}]}\n\n")
		fmt.Fprint(w, "data: {\"id\":\"synthetic\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n")
	}))
	defer provider.Close()
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "synthetic")
	if err := os.MkdirAll(filepath.Join(home, ".pi", "agent"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(cwd, 0700); err != nil {
		t.Fatal(err)
	}
	models := map[string]any{"providers": map[string]any{"fixture": map[string]any{
		"baseUrl": provider.URL + "/v1", "api": "openai-completions", "apiKey": "synthetic", "authHeader": true,
		"models": []any{map[string]any{"id": "fake", "name": "Fake", "reasoning": false}},
	}}}
	data, _ := json.Marshal(models)
	if err := os.WriteFile(filepath.Join(home, ".pi", "agent", "models.json"), data, 0600); err != nil {
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
	ws, err := os.Open(cwd)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	p, err := launchPiRPCCommand("/usr/bin/node", []string{cli, "--provider", "fixture", "--model", "fake"}, home, cwd, []string{"PATH=/usr/bin:/bin"}, owner, ws)
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	// Pi has not persisted a fresh session before its first assistant message;
	// this is why automatic naming waits for native settlement.
	if initial, err := nativeSessions(transport.Config{Home: home, UID: os.Geteuid()}); err != nil || len(initial) != 0 {
		t.Fatalf("fresh Pi history before first reply: %+v, %v", initial, err)
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
