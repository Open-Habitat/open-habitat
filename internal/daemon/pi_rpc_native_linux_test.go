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
	wrapper := filepath.Join(home, "pi-fixture")
	if err := os.WriteFile(wrapper, []byte("#!/bin/sh\nexec '"+binary+"' --provider fixture --model fake \"$@\"\n"), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(wrapper, home, cwd, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
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
	if err != nil || len(sessions) != 1 {
		t.Fatalf("native history: %d sessions, %v", len(sessions), err)
	}
	session := readNativeSettled(sessions[0].path, os.Geteuid())
	if session.state != "readable" {
		t.Fatalf("native history %s", session.state)
	}
	for _, entry := range session.entries {
		if strings.Contains(entry.full, "hello from synthetic") {
			return
		}
	}
	t.Fatal("native reply missing")
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
