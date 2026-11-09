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
)

// Exercises production piArgs and RPC launch with the shipped core, native
// user MCP config, and local MCP/model peers. No extension activates codemode
// for the test: Pi must make the default-exposure MCP tool reachable itself.
func TestMCPBuiltRuntimeAgent(t *testing.T) {
	runtime := os.Getenv("OH_CORE_RUNTIME")
	if runtime == "" {
		t.Skip("set OH_CORE_RUNTIME to a built core runtime")
	}
	var called atomic.Bool
	mcp := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			w.WriteHeader(405)
			return
		}
		var req struct {
			ID     json.RawMessage `json:"id"`
			Method string          `json:"method"`
			Params struct {
				Name string `json:"name"`
			} `json:"params"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Error(err)
			w.WriteHeader(400)
			return
		}
		if len(req.ID) == 0 {
			w.WriteHeader(202)
			return
		}
		var result any
		switch req.Method {
		case "initialize":
			result = map[string]any{"protocolVersion": "2025-03-26", "capabilities": map[string]any{"tools": map[string]any{}}, "serverInfo": map[string]string{"name": "fixture", "version": "1"}}
		case "tools/list":
			result = map[string]any{"tools": []any{map[string]any{"name": "probe", "description": "Read fixture marker", "inputSchema": map[string]any{"type": "object", "properties": map[string]any{}}}}}
		case "tools/call":
			if req.Params.Name != "probe" {
				t.Errorf("unexpected tool %s", req.Params.Name)
			}
			called.Store(true)
			result = map[string]any{"content": []any{map[string]string{"type": "text", "text": "fixture-mcp-result"}}}
		default:
			t.Errorf("unexpected MCP method %s", req.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"jsonrpc": "2.0", "id": req.ID, "result": result})
	}))
	defer mcp.Close()
	var received atomic.Bool
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
		w.Header().Set("Content-Type", "text/event-stream")
		chunk := func(delta any, finish any) {
			b, _ := json.Marshal(map[string]any{"id": "fixture", "object": "chat.completion.chunk", "created": 0, "model": "fake", "choices": []any{map[string]any{"index": 0, "delta": delta, "finish_reason": finish}}})
			fmt.Fprintf(w, "data: %s\n\n", b)
		}
		last := body.Messages[len(body.Messages)-1]
		if last.Role == "tool" {
			received.Store(strings.Contains(string(last.Content), "fixture-mcp-result"))
			chunk(map[string]string{"role": "assistant", "content": "Done"}, nil)
			chunk(map[string]any{}, "stop")
		} else {
			active := false
			for _, tool := range body.Tools {
				if tool.Function.Name == "codemode" {
					active = true
				}
			}
			if !active {
				t.Error("codemode not declared to model")
			}
			args, _ := json.Marshal(map[string]string{"code": "text(await tools.mcp__open_habitat_atlassian__probe({}));"})
			chunk(map[string]any{"role": "assistant", "tool_calls": []any{map[string]any{"index": 0, "id": "probe-call", "type": "function", "function": map[string]string{"name": "codemode", "arguments": string(args)}}}}, nil)
			chunk(map[string]any{}, "tool_calls")
		}
		fmt.Fprint(w, "data: [DONE]\n\n")
	}))
	defer provider.Close()
	home := t.TempDir()
	agent := filepath.Join(home, ".pi", "agent")
	if err := os.MkdirAll(agent, 0700); err != nil {
		t.Fatal(err)
	}
	write := func(name string, v any) {
		t.Helper()
		b, _ := json.Marshal(v)
		if err := os.WriteFile(filepath.Join(agent, name), b, 0600); err != nil {
			t.Fatal(err)
		}
	}
	write("mcp.json", map[string]any{"mcpServers": map[string]any{"open_habitat_atlassian": map[string]any{"url": mcp.URL}}})
	write("models.json", map[string]any{"providers": map[string]any{"fixture": map[string]any{"baseUrl": provider.URL + "/v1", "api": "openai-completions", "apiKey": "synthetic", "models": []any{map[string]string{"id": "fake", "name": "Fake"}}}}})
	// Seed the normal bridge in test scratch rather than piArgs' /var/tmp.
	bridge := filepath.Join(t.TempDir(), "recap-extension.mjs")
	if err := os.WriteFile(bridge, recapExtension, 0600); err != nil {
		t.Fatal(err)
	}
	c := &ConversationController{home: home, recapPath: bridge, runtime: &core.PiRuntimeConfig{Node: filepath.Join(runtime, "bin", "node"), Entry: filepath.Join(runtime, "node_modules/@earendil-works/pi-coding-agent/dist/index.js")}}
	args, err := c.piArgs()
	if err != nil {
		t.Fatal(err)
	}
	args = append(args, "--provider", "fixture", "--model", "fake")
	p, err := launchPiRPCCommand(c.runtime.Node, args, home, home, []string{"PATH=/usr/bin:/bin"}, nil, nil, "")
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	// Wait for native discovery before asking the fixture model for a tool call.
	if ok, err := p.request("prompt", "/mcp", 15*time.Second); !ok || err != nil {
		t.Fatal(ok, err)
	}
	if ok, err := p.request("prompt", "Read the fixture marker", 15*time.Second); !ok || err != nil {
		t.Fatal(ok, err)
	}
	timeout := time.After(30 * time.Second)
	for {
		select {
		case event := <-p.events:
			if strings.Contains(string(event), `"type":"agent_settled"`) && received.Load() {
				if !called.Load() {
					t.Fatal("MCP server never called")
				}
				return
			}
		case <-timeout:
			t.Fatalf("MCP round trip missing: called=%v result=%v", called.Load(), received.Load())
		}
	}
}
