//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestProcessCommandHintsAndWaitGrammar(t *testing.T) {
	command := `TOKEN=secret curl https://alice:password@example.invalid -H 'Authorization: Bearer abc' --api-key=hidden --password "also hidden" --auth-token another ghp_example123`
	preview := commandPreview(command)
	for _, secret := range []string{"secret", "alice", "password@example", "Bearer abc", "hidden", "another", "ghp_example123"} {
		if strings.Contains(preview, secret) {
			t.Fatalf("credential escaped %q in %q", secret, preview)
		}
	}
	if !strings.Contains(preview, "example.invalid") {
		t.Fatal("lost useful command hint")
	}
	id := "01m51veyk0hsa1br34epkr2rpg"
	if got := taskfleetWait("/opt/bin/taskfleet run wait " + id + " --any --timeout 2h --output json"); len(got) != 1 || got[0] != id {
		t.Fatal(got)
	}
	for _, bad := range []string{"X=y taskfleet run wait " + id, "taskfleet run wait " + id + " | cat", "taskfleet run wait '" + id + "'", "taskfleet run wait " + id + " --unknown", "taskfleet run wait " + id + " --timeout nope", "./taskfleet run wait " + id} {
		if taskfleetWait(bad) != nil {
			t.Fatal("unsafe recognition", bad)
		}
	}
}

func testProcessPeer(t *testing.T, pid int, handler func(net.Conn)) *piRPC {
	t.Helper()
	path := filepath.Join(t.TempDir(), "p.sock")
	listener, err := net.Listen("unix", path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { listener.Close() })
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			go func() { defer conn.Close(); handler(conn) }()
		}
	}()
	return &piRPC{cmd: &exec.Cmd{Process: &os.Process{Pid: pid}}, processSocket: path, processGeneration: "11111111-1111-4111-8111-111111111111", exited: make(chan struct{})}
}
func TestProcessSocketRejectsWrongChild(t *testing.T) {
	p := testProcessPeer(t, os.Getpid()+1, func(c net.Conn) {})
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if _, err := p.dialProcesses(ctx); err == nil {
		t.Fatal("another same-UID process accepted")
	}
}
func TestProcessSocketInventoryAndStaleFence(t *testing.T) {
	requests := make(chan map[string]any, 4)
	p := testProcessPeer(t, os.Getpid(), func(c net.Conn) {
		var q map[string]any
		if json.NewDecoder(c).Decode(&q) != nil {
			return
		}
		requests <- q
		json.NewEncoder(c).Encode(map[string]any{"ok": true, "data": map[string]any{"protocol": 1, "records": []any{map[string]any{"id": "proc_abcd", "name": strings.Repeat("測", 70), "command": "TOKEN=secret go test ./...", "startTime": 1000, "endTime": nil, "status": "running", "exitCode": nil, "signal": nil, "endReason": nil, "wakes_agent": true, "stdoutFile": "private-path", "pid": 123}}}})
	})
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	inv := p.inventory(ctx)
	wire, _ := json.Marshal(inv)
	if inv.Availability != "available" || len(inv.Processes) != 1 || inv.Processes[0].Token != "pt_1000" || len(inventoryWaiting(inv)) != 1 {
		t.Fatal(string(wire))
	}
	for _, secret := range []string{"secret", "private-path", "\"pid\""} {
		if strings.Contains(string(wire), secret) {
			t.Fatal("private native field escaped", string(wire))
		}
	}
	<-requests
	c := &ConversationController{sessions: map[string]*conversation{ownershipTestID: {id: ownershipTestID, rpc: p}}}
	body := `{"owner_generation":"old","process_token":"pt_1000","force":false}`
	req := httptest.NewRequest("POST", "http://unix/api/v1/conversations/"+ownershipTestID+"/processes/proc_abcd/stop", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.RequestURI = req.URL.RequestURI()
	w := httptest.NewRecorder()
	c.processRoutes(w, req, []string{ownershipTestID, "processes", "proc_abcd", "stop"})
	if w.Code != 409 {
		t.Fatalf("stale owner %d %s", w.Code, w.Body.String())
	}
	select {
	case <-requests:
		t.Fatal("stale stop reached owner")
	default:
	}
}
func TestProcessNotificationProjectsDetailsNeverXML(t *testing.T) {
	for _, kind := range []string{"custom_message", "message"} {
		m := json.RawMessage(`{"role":"custom","customType":"ad-process:notification","display":true,"content":"XML TOKEN=secret","details":{"kind":"success","processId":"proc_abcd","processName":"build","command":"TOKEN=secret make","exitCode":0,"attention":"turn"}}`)
		entry := nativeEntry{ID: "entry1", Type: kind, Raw: m, Message: m}
		out := nativeBlocks(entry)
		if len(out.Blocks) != 1 || out.Blocks[0].ProcessEvent == nil || out.Blocks[0].ProcessEvent.Delivery != nil {
			t.Fatal(out)
		}
		wire, _ := json.Marshal(out)
		if strings.Contains(string(wire), "secret") || strings.Contains(string(wire), "XML") {
			t.Fatal(string(wire))
		}
		raw := m
		if kind == "message" {
			raw, _ = json.Marshal(map[string]any{"type": kind, "message": m})
		}
		if _, ok := nativeBlockChunk(raw, 0, 0, 4096); ok {
			t.Fatal("raw notification read bypass")
		}
	}
}
func TestProcessWaitingIgnoresContextUnknownAndFinished(t *testing.T) {
	yes, no := true, false
	inv := processInventory{Availability: "available", Processes: []processRecord{{ID: "a", Status: "running", Wakes: &no}, {ID: "b", Status: "running"}, {ID: "c", Status: "exited", Wakes: &yes}, {ID: "d", Name: "test", Status: "running", Wakes: &yes, RunIDs: []string{}}}}
	got := inventoryWaiting(inv)
	if len(got) != 1 || got[0].ID != "d" || got[0].Kind != "process" {
		t.Fatal(got)
	}
}

func TestProcessToolProjectionJoinsWithoutPrivateFields(t *testing.T) {
	raw := json.RawMessage(`{"role":"toolResult","toolName":"process","toolCallId":"call1","content":[{"type":"text","text":"Started with pid 123, log /private/log"}],"details":{"action":"start","process":{"id":"proc_abcd","name":"test","startTime":12345,"command":"TOKEN=secret sleep 5","cwd":"/private","pid":123}}}`)
	entry := nativeBlocks(nativeEntry{ID: "e", Type: "message", Message: raw})
	if len(entry.Blocks) != 1 {
		t.Fatal(entry)
	}
	var projected struct {
		Action  string `json:"action"`
		Process struct {
			ID    string `json:"id"`
			Start int64  `json:"started_at"`
			Token string `json:"process_token"`
		} `json:"process"`
	}
	if json.Unmarshal([]byte(entry.Blocks[0].Text), &projected) != nil || projected.Action != "start" || projected.Process.ID != "proc_abcd" || projected.Process.Start != 12345 || projected.Process.Token != "pt_12345" {
		t.Fatal(entry)
	}
	wire, _ := json.Marshal(entry)
	for _, private := range []string{"secret", "/private", "pid"} {
		if strings.Contains(string(wire), private) {
			t.Fatal("private process metadata escaped", string(wire))
		}
	}
	chunk, _ := json.Marshal(map[string]any{"type": "message", "message": raw})
	full, ok := nativeBlockChunk(chunk, 0, 0, 4096)
	if !ok {
		t.Fatal("safe process result unavailable")
	}
	bytes, _ := json.Marshal(full)
	if strings.Contains(string(bytes), "private") {
		t.Fatal("block read bypass", string(bytes))
	}
}

func TestProcessTaskfleetReadsOnlyValidatedRunAsNativeUser(t *testing.T) {
	home := t.TempDir()
	binary := filepath.Join(home, "taskfleet")
	script := `#!/bin/sh
[ "$1" = run ] && [ "$2" = show ] && [ "$4" = --output ] && [ "$5" = json ] || exit 1
printf '%s\n' "$3" >> "$HOME/queried"
printf '{"schema_version":1,"data":{"run_id":"%s","title":"Synthetic work","status":"%s","landed":false,"report":{"secret":"must not cross"}}}\n' "$3" "$FIXTURE_STATUS"
`
	if err := os.WriteFile(binary, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", home)
	id := "01m51veyk0hsa1br34epkr2rpg"
	runs := readProcessSpinoffs(context.Background(), home, []string{"FIXTURE_STATUS=running"}, []string{id, "bad;command"})
	if len(runs) != 1 || !taskfleetPending(runs) || runs[0].Title != "Synthetic work" {
		t.Fatal(runs)
	}
	wire, _ := json.Marshal(runs)
	if strings.Contains(string(wire), "secret") || strings.Contains(string(wire), "must not cross") {
		t.Fatal(string(wire))
	}
	queried, _ := os.ReadFile(filepath.Join(home, "queried"))
	if string(queried) != id+"\n" {
		t.Fatal("invalid ID executed", string(queried))
	}
	done := readProcessSpinoffs(context.Background(), home, []string{"FIXTURE_STATUS=done"}, []string{id})
	if taskfleetPending(done) {
		t.Fatal("finished runs presented as working")
	}
}

func TestProcessUserSettingsAvoidDuplicateRuntime(t *testing.T) {
	home := t.TempDir()
	path := filepath.Join(home, ".pi/agent/settings.json")
	os.MkdirAll(filepath.Dir(path), 0700)
	for _, body := range []string{`{"packages":["npm:@aliou/pi-processes@0.10.9"]}`, `{"packages":[{"source":"npm:@aliou/pi-processes","extensions":["extensions/processes/index.ts"]}]}`} {
		os.WriteFile(path, []byte(body), 0600)
		if !nativeSettingsProvideProcesses(home) {
			t.Fatal("configured native owner not detected", body)
		}
	}
	os.WriteFile(path, []byte(`{"packages":["npm:unrelated"]}`), 0600)
	if nativeSettingsProvideProcesses(home) {
		t.Fatal("unrelated package suppressed product runtime")
	}
}
func TestProcessSuppressedLogMessageRemainsVisibleWithoutRawContent(t *testing.T) {
	raw := json.RawMessage(`{"customType":"ad-process:notification","display":true,"details":{"kind":"log_match_suppressed","processId":"*","processName":"log watches","summary":"Suppressed 12 log-match notifications because output was too fast.","command":"TOKEN=secret","timestamp":123},"content":"raw secret XML"}`)
	entry := nativeBlocks(nativeEntry{ID: "suppressed", Type: "custom_message", Raw: raw})
	if len(entry.Blocks) != 1 || entry.Blocks[0].ProcessEvent == nil || entry.Blocks[0].ProcessEvent.Kind != "log_match_suppressed" {
		t.Fatal("native summary dropped", entry)
	}
	wire, _ := json.Marshal(entry)
	if strings.Contains(string(wire), "raw secret") {
		t.Fatal(string(wire))
	}
}
