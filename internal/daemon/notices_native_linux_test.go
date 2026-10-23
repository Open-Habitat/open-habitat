//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/entryfence"
	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// The container's PID 1 creates the real CLI's fixed-path socket, then passes
// it to this nonroot synthetic controller. No CLI transport/trust bypass is used.
func TestNativePiNoticeOneToolCall(t *testing.T) {
	if os.Getenv("OH_NATIVE_NOTICE_CONTAINER") != "1" {
		t.Skip("requires scripts/test-native-pi-notice.sh")
	}
	// This is the live difference the original fixture omitted: the gateway
	// config parent is deliberately inaccessible to the agent's kernel UID.
	if !entryfence.Closed("/etc/open-habitat/upgrade-closed") {
		t.Fatal("fixture did not reproduce the protected config ancestor")
	}
	fenced := os.Getenv("OH_NATIVE_NOTICE_FENCED") == "1"
	if entryfence.Closed(entryfence.AgentUpgradePath) != fenced {
		t.Fatal("unexpected public fence state")
	}
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "fixture")
	if err := os.MkdirAll(cwd, 0700); err != nil {
		t.Fatal(err)
	}
	agentDir := filepath.Join(home, ".pi", "agent")
	if err := os.MkdirAll(agentDir, 0700); err != nil {
		t.Fatal(err)
	}
	text := "Muista tarkistaa testit"
	var calls atomic.Int32
	toolResults := make(chan string, 1)
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Messages []struct {
				Role    string          `json:"role"`
				Content json.RawMessage `json:"content"`
			} `json:"messages"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil {
			t.Error("invalid provider request")
			w.WriteHeader(400)
			return
		}
		call := calls.Add(1)
		system := ""
		result := ""
		for _, m := range body.Messages {
			if m.Role == "system" || m.Role == "developer" {
				var content string
				if json.Unmarshal(m.Content, &content) != nil {
					t.Error("invalid system content")
				}
				system += content
			}
			if m.Role == "tool" {
				var s string
				if json.Unmarshal(m.Content, &s) == nil {
					result += s
				} else {
					result += string(m.Content)
				}
			}
		}
		if !strings.Contains(system, "open-habitat agent notice create") {
			t.Error("notice capability missing from native prompt")
		}
		w.Header().Set("Content-Type", "text/event-stream")
		send := func(delta any, finish any) {
			b, _ := json.Marshal(map[string]any{"id": "notice-fixture", "object": "chat.completion.chunk", "created": 0, "model": "fake", "choices": []any{map[string]any{"index": 0, "delta": delta, "finish_reason": finish}}})
			fmt.Fprintf(w, "data: %s\n\n", b)
		}
		if call == 1 {
			// This synthetic model executes the recipe it actually received,
			// not a separately hardcoded CLI command. It proves discoverability
			// and execution, not a real model's language understanding.
			_, recipe, found := strings.Cut(system, "```sh\n")
			command, _, complete := strings.Cut(recipe, "\n```")
			if !found || !complete {
				t.Error("complete notice recipe missing from native prompt")
				return
			}
			command = "command -v open-habitat && " + strings.ReplaceAll(command, "Reminder text", text)
			args, _ := json.Marshal(map[string]string{"command": command})
			send(map[string]any{"role": "assistant", "tool_calls": []any{map[string]any{"index": 0, "id": "notice-tool", "type": "function", "function": map[string]string{"name": "bash", "arguments": string(args)}}}}, nil)
			send(map[string]any{}, "tool_calls")
		} else {
			select {
			case toolResults <- result:
			default:
			}
			send(map[string]string{"role": "assistant", "content": "Valmis."}, nil)
			send(map[string]any{}, "stop")
		}
		fmt.Fprint(w, "data: [DONE]\n\n")
	}))
	defer provider.Close()
	models := map[string]any{"providers": map[string]any{"fixture": map[string]any{"baseUrl": provider.URL + "/v1", "api": "openai-completions", "apiKey": "synthetic", "models": []any{map[string]any{"id": "fake", "name": "Fake", "reasoning": false}}}}}
	b, _ := json.Marshal(models)
	if err := os.WriteFile(filepath.Join(agentDir, "models.json"), b, 0600); err != nil {
		t.Fatal(err)
	}
	id, _ := uuid()
	owner, err := acquirePiOwnership(home, id)
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
	cli, _ := filepath.Abs("pi-device-test/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js")
	extension, err := installProcessExtension(home)
	if err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPCCommand("/usr/bin/node", []string{cli, "--provider", "fixture", "--model", "fake", "--thinking", "off", "--extension", extension}, home, cwd, []string{agentPath(home)}, owner, ws, "ws_example123")
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	cfg := transport.Config{Home: home, UID: os.Geteuid(), Username: "synthetic-agent", Socket: "/run/open-habitat/users/synthetic-agent/daemon.sock"}
	c := &ConversationController{home: home, cfg: cfg, sessions: map[string]*conversation{id: {id: id, cwd: cwd, workspace: "ws_example123", rpc: p, owner: owner}}, journal: newEventJournal()}
	inherited := os.NewFile(3, "agent-listener")
	ln, err := net.FileListener(inherited)
	if err != nil {
		t.Fatal(err)
	}
	inherited.Close()
	defer ln.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go transport.ServeAgent(ctx, ln.(*net.UnixListener), cfg, agentHandler(cfg, c, "test", "test", nil))
	if ok, err := p.request("prompt", "jätä minulle muistutus tähän keskusteluun: "+text, 15*time.Second); err != nil || !ok {
		t.Fatalf("prompt: %v %v", ok, err)
	}
	tools := 0
	deadline := time.After(30 * time.Second)
	settled := false
	for !settled {
		select {
		case event, ok := <-p.events:
			if !ok {
				t.Fatal("Pi exited before settlement")
			}
			var e struct {
				Type    string `json:"type"`
				IsError bool   `json:"isError"`
			}
			json.Unmarshal(event, &e)
			if e.Type == "tool_execution_start" {
				tools++
			}
			if e.Type == "tool_execution_end" && e.IsError {
				t.Logf("tool failed: %s", event)
			}
			settled = e.Type == "agent_settled"
		case <-deadline:
			t.Fatal("Pi did not settle")
		}
	}
	select {
	case result := <-toolResults:
		if !strings.HasPrefix(result, "/opt/open-habitat/current/open-habitat\n") {
			t.Fatalf("CLI did not resolve through launch selector: %s", result)
		}
		if fenced {
			if !strings.Contains(result, `"code":"host_maintenance"`) {
				t.Fatalf("fenced mutation did not report maintenance: %s", result)
			}
		} else if !strings.Contains(result, `"persistence":"persisted"`) {
			t.Fatalf("first notice write was not persisted: %s", result)
		}
	case <-time.After(time.Second):
		t.Fatal("tool result missing from provider request")
	}
	if tools != 1 || calls.Load() != 2 {
		t.Fatalf("tools=%d provider calls=%d", tools, calls.Load())
	}
	source, err := c.noticeSource(id)
	if err != nil || source == nil {
		t.Fatalf("native source: %+v %v", source, err)
	}
	notices, err := readNativeNotices(source.path, cfg.UID, id, cwd)
	if fenced {
		if err != nil || len(notices) != 0 {
			t.Fatalf("fenced mutation reached native writer: %+v %v", notices, err)
		}
		t.Log("real Pi + real CLI: maintenance refused before native write")
	} else {
		if err != nil || len(notices) != 1 || !sessionIDPattern.MatchString(notices[0].ID) || notices[0].Text != text {
			t.Fatalf("native notices: %+v %v", notices, err)
		}
		t.Log("real Pi + real CLI: one bash tool, first write persisted and readable from native history")
	}
}
