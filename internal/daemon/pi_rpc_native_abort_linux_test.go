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
)

// The controller's abort answers the browser at once and then waits for Pi's
// acknowledgement, which the pinned Pi gives only after the aborted run has
// settled. A stop is therefore as quick as Pi's settle: here a running bash
// tool is killed and the run settles, aborted, before the acknowledgement.
// The provider is synthetic; the tool is a real child of the pinned Pi.
func TestPiRPCNativeAbortDuringToolSettlesFirst(t *testing.T) {
	binary, err := filepath.Abs(filepath.Join("pi-device-test", "node_modules", ".bin", "pi"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(binary); err != nil {
		t.Skip("pinned Pi test dependency not installed")
	}
	native, home := piFixture(t)
	credential := "sk-" + strings.Repeat("n", 24) + "wxyz"
	if _, err := native.credentials(context.Background(), "save", "openai", credential); err != nil {
		t.Fatal(err)
	}
	var calls atomic.Int32
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		if calls.Add(1) == 1 {
			fmt.Fprint(w, `data: {"id":"s","object":"chat.completion.chunk","created":0,"model":"fake","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"bash","arguments":"{\"command\":\"sleep 60\"}"}}]},"finish_reason":null}]}`+"\n\n")
			fmt.Fprint(w, `data: {"id":"s","object":"chat.completion.chunk","created":0,"model":"fake","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`+"\n\ndata: [DONE]\n\n")
			return
		}
		fmt.Fprint(w, `data: {"id":"s","object":"chat.completion.chunk","created":0,"model":"fake","choices":[{"index":0,"delta":{"role":"assistant","content":"done"},"finish_reason":"stop"}]}`+"\n\ndata: [DONE]\n\n")
	}))
	defer provider.Close()
	cwd := filepath.Join(home, "src", "synthetic")
	for _, dir := range []string{filepath.Join(home, ".pi", "agent"), cwd, filepath.Join(home, "run")} {
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
	}
	models, _ := json.Marshal(map[string]any{"providers": map[string]any{"openai": map[string]any{
		"baseUrl": provider.URL + "/v1", "api": "openai-completions", "authHeader": true,
		"models": []any{map[string]any{"id": "fake", "name": "Fake"}},
	}}})
	if err := os.WriteFile(filepath.Join(home, ".pi", "agent", "models.json"), models, 0600); err != nil {
		t.Fatal(err)
	}
	cli, err := filepath.Abs(filepath.Join("pi-device-test", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js"))
	if err != nil {
		t.Fatal(err)
	}
	id, _ := uuid()
	owner, err := acquirePiOwnership(filepath.Join(home, "run"), id)
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
	p, err := launchPiRPCCommand("/usr/bin/node", []string{cli, "--provider", "openai", "--model", "fake", "--thinking", "off"}, home, cwd, []string{"PATH=/usr/bin:/bin"}, owner, ws, "ws_example123")
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	if ok, err := p.request("prompt", "work", 15*time.Second); err != nil || !ok {
		t.Fatalf("Pi prompt: %v %v", ok, err)
	}
	until := time.After(15 * time.Second)
	for started := false; !started; {
		select {
		case event, ok := <-p.events:
			if !ok {
				t.Fatal("Pi exited before its tool started")
			}
			started = strings.Contains(string(event), `"type":"tool_execution_start"`)
		case <-until:
			t.Fatal("Pi tool did not start")
		}
	}
	pressed := time.Now()
	acknowledged := make(chan error, 1)
	go func() {
		ok, err := p.request("abort", "", 30*time.Second)
		if err == nil && !ok {
			err = fmt.Errorf("abort refused")
		}
		acknowledged <- err
	}()
	settled := false
	for {
		select {
		case err := <-acknowledged:
			if err != nil {
				t.Fatalf("native abort: %v", err)
			}
			if !settled {
				t.Fatal("Pi acknowledged the abort before its run settled")
			}
			// sleep 60 must not hold the stop; a few seconds covers a loaded host.
			if elapsed := time.Since(pressed); elapsed > 5*time.Second {
				t.Fatalf("abort took %v", elapsed)
			}
			t.Logf("abort acknowledged after %v", time.Since(pressed))
			return
		case event, ok := <-p.events:
			if !ok {
				t.Fatal("Pi exited during abort")
			}
			var frame struct {
				Type    string `json:"type"`
				Aborted bool   `json:"aborted"`
			}
			_ = json.Unmarshal(event, &frame)
			if frame.Type == "agent_settled" {
				if !frame.Aborted {
					t.Fatal("aborted run settled as not aborted")
				}
				settled = true
			}
		}
	}
}
