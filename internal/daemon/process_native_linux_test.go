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

// The real pinned Pi and real pi-processes, synthetic HOME/provider only. This
// exercises active-run socket queries, idle wake-up ordering, stop and clear.
func TestProcessPinnedPiBridgeAndWake(t *testing.T) {
	root, err := filepath.Abs("pi-device-test/node_modules")
	if err != nil {
		t.Fatal(err)
	}
	cli := filepath.Join(root, "@earendil-works/pi-coding-agent/dist/bundle/cli.js")
	core := filepath.Join(root, "@aliou/pi-processes/extensions/processes/index.ts")
	if _, err := os.Stat(core); err != nil {
		t.Skip("pinned process test dependencies not installed")
	}
	companion, _ := filepath.Abs("process-extension.mjs")
	home := t.TempDir()
	agent := filepath.Join(home, ".pi/agent")
	os.MkdirAll(agent, 0700)
	sentinel := filepath.Join(home, "release")
	var calls atomic.Int32
	wakeEntered, wakeRelease := make(chan struct{}, 1), make(chan struct{})

	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := calls.Add(1)
		w.Header().Set("Content-Type", "text/event-stream")
		if n == 1 || n == 4 {
			command := fmt.Sprintf("while [ ! -e %s ]; do sleep 0.02; done; printf 'fixture complete\\n'", sentinel)
			if n == 4 {
				command = "sleep 90"
			}
			command = "export TOKEN=synthetic-process-secret; " + command
			args, _ := json.Marshal(map[string]any{"action": "start", "name": "synthetic-build", "command": command, "notify": map[string]string{"onSuccess": "turn", "onFailure": "turn"}})
			encoded, _ := json.Marshal(string(args))
			fmt.Fprintf(w, "data: {\"id\":\"s\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"tool_calls\":[{\"index\":0,\"id\":\"call%d\",\"type\":\"function\",\"function\":{\"name\":\"process\",\"arguments\":%s}}]},\"finish_reason\":null}]}\n\n", n, encoded)
			fmt.Fprint(w, "data: {\"id\":\"s\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"tool_calls\"}]}\n\ndata: [DONE]\n\n")
			return
		}
		if n == 3 {
			wakeEntered <- struct{}{}
			select {
			case <-wakeRelease:
			case <-r.Context().Done():
				return
			}
		}
		fmt.Fprint(w, "data: {\"id\":\"s\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"Fixture answer\"},\"finish_reason\":null}]}\n\ndata: {\"id\":\"s\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n")
	}))
	defer provider.Close()
	defer func() {
		select {
		case <-wakeRelease:
		default:
			close(wakeRelease)
		}
	}()
	models := map[string]any{"providers": map[string]any{"fixture": map[string]any{"baseUrl": provider.URL + "/v1", "api": "openai-completions", "apiKey": "synthetic", "models": []any{map[string]string{"id": "fake", "name": "Fake"}}}}}
	b, _ := json.Marshal(models)
	os.WriteFile(filepath.Join(agent, "models.json"), b, 0600)
	p, err := launchPiRPCCommand("/usr/bin/node", []string{cli, "--provider", "fixture", "--model", "fake", "--extension", core, "--extension", companion}, home, home, []string{"PATH=/usr/bin:/bin"}, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	s := &conversation{id: ownershipTestID, rpc: p, state: "idle"}
	c := &ConversationController{sessions: map[string]*conversation{ownershipTestID: s}, journal: newEventJournal()}
	go c.drain(s)
	wait := func(label string, condition func() bool) {
		t.Helper()
		deadline := time.Now().Add(15 * time.Second)
		for time.Now().Before(deadline) {
			if condition() {
				return
			}
			time.Sleep(10 * time.Millisecond)
		}
		t.Fatalf("timed out %s (provider calls %d)", label, calls.Load())
	}
	inventory := func() processInventory {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		return p.inventory(ctx)
	}
	wait("companion ready", func() bool { return inventory().Availability == "available" })
	if ok, err := p.request("prompt", "Run the synthetic background build", 10*time.Second); err != nil || !ok {
		t.Fatalf("prompt %v %v", ok, err)
	}
	wait("first settlement", func() bool { c.mu.Lock(); defer c.mu.Unlock(); return s.settled && s.state == "idle" })
	inv := inventory()
	if len(inv.Processes) != 1 || inv.Processes[0].Wakes == nil || !*inv.Processes[0].Wakes {
		t.Fatalf("missing native notify join %+v", inv)
	}
	if len(inventoryWaiting(inv)) != 1 {
		t.Fatal("not waiting on native background build")
	}
	os.WriteFile(sentinel, []byte("done"), 0600)
	select {
	case <-wakeEntered:
	case <-time.After(15 * time.Second):
		t.Fatal("completion did not wake Pi")
	}
	c.mu.Lock()
	active, state := s.runActive, s.state
	c.mu.Unlock()
	if !active || state != "accepted" {
		t.Fatalf("native wake not working: active=%v state=%s", active, state)
	}
	// Inventory queries do not prompt, steer or disturb the active model request.
	inv = inventory()
	if inv.Availability != "available" || calls.Load() != 3 {
		t.Fatal("list disturbed run")
	}
	c.journal.mu.Lock()
	events := append([][]byte{}, c.journal.frames...)
	c.journal.mu.Unlock()
	c.mu.Lock()
	diagnostics, _ := json.Marshal(s.events)
	c.mu.Unlock()
	if strings.Contains(string(diagnostics), "synthetic-process-secret") || strings.Contains(string(diagnostics), "stdoutFile") {
		t.Fatal("native status retained private process metadata")
	}
	for _, event := range events {
		if strings.Contains(string(event), "synthetic-process-secret") {
			t.Fatal("serialized Pi process argument leaked into journal")
		}
	}
	wakeSeen := false
	for _, event := range events {
		if strings.Contains(string(event), `"kind":"process.notification"`) && strings.Contains(string(event), `"delivery":"wake"`) {
			wakeSeen = true
		}
	}
	if !wakeSeen {
		t.Fatal("live wake delivery not projected")
	}
	close(wakeRelease)
	wait("wake settlement", func() bool { c.mu.Lock(); defer c.mu.Unlock(); return s.settled && !s.runActive })
	if ok, err := p.request("prompt", "Start another synthetic background build", 10*time.Second); err != nil || !ok {
		t.Fatalf("second prompt %v %v", ok, err)
	}
	wait("second build", func() bool { inv = inventory(); return len(inv.Processes) == 2 })
	var running processRecord
	for _, record := range inv.Processes {
		if record.Status == "running" {
			running = record
		}
	}
	if running.ID == "" {
		t.Fatalf("no running native process %+v", inv)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var stopped struct {
		Result string `json:"result"`
	}
	err = p.processRequest(ctx, map[string]any{"op": "stop", "id": running.ID, "token": running.Token, "force": false}, &stopped)
	if err != nil || stopped.Result != "killed" {
		t.Fatalf("stop %+v %v", stopped, err)
	}
	wait("native stop", func() bool {
		for _, r := range inventory().Processes {
			if r.ID == running.ID {
				return r.Status == "killed"
			}
		}
		return false
	})
	if err = p.processRequest(ctx, map[string]string{"op": "clear"}, nil); err != nil {
		t.Fatal(err)
	}
	if got := inventory(); got.Availability != "available" || len(got.Processes) != 0 {
		t.Fatal("clear did not remove native records", got)
	}
}
