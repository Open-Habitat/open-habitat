//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestProcessCommandHints(t *testing.T) {
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
}

// The table is shared with the companion's waitRuns test
// (pi-device-test/process-extension.test.mjs) so the two grammars agree.
func TestTaskfleetWaitSharedGrammar(t *testing.T) {
	raw, err := os.ReadFile("testdata/taskfleet-wait-grammar.json")
	if err != nil {
		t.Fatal(err)
	}
	var table struct {
		Cases []struct {
			Command  string    `json:"command"`
			RunIDs   []string  `json:"run_ids"`
			Operands *[]string `json:"operands"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(raw, &table); err != nil || len(table.Cases) == 0 {
		t.Fatal(err)
	}
	for _, tc := range table.Cases {
		got := taskfleetWait(tc.Command)
		if strings.Join(got, ",") != strings.Join(tc.RunIDs, ",") || (got == nil) != (len(tc.RunIDs) == 0) {
			t.Errorf("%q: got %v, want %v", tc.Command, got, tc.RunIDs)
		}
		want := tc.RunIDs
		if tc.Operands != nil {
			want = *tc.Operands
		}
		if ops := taskfleetWaitOperands(tc.Command); strings.Join(ops, ",") != strings.Join(want, ",") {
			t.Errorf("%q operands: got %v, want %v", tc.Command, ops, want)
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
func TestProcessInventoryExpandedWaitIDs(t *testing.T) {
	const run = "01m531x6y92ggdqcmb1exzmn10"
	for _, tc := range []struct {
		name      string
		ids       []string
		available bool
	}{
		{"expanded", []string{run}, true},
		{"unknown", []string{}, true},
		{"invalid", []string{"not-a-run"}, false},
		{"oversized", make([]string, 201), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			p := testProcessPeer(t, os.Getpid(), func(c net.Conn) {
				var q map[string]any
				if json.NewDecoder(c).Decode(&q) != nil {
					return
				}
				json.NewEncoder(c).Encode(map[string]any{"ok": true, "data": map[string]any{"protocol": 1, "records": []any{map[string]any{
					"id": "proc_abcd", "name": "wait", "command": "taskfleet run wait $(cat active.txt) --any", "startTime": 1000, "status": "running", "wakes_agent": true, "run_ids": tc.ids,
				}}}})
			})
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			inv := p.inventory(ctx)
			if (inv.Availability == "available") != tc.available {
				t.Fatalf("inventory: %+v", inv)
			}
			if tc.available {
				if len(inv.Processes) != 1 || !reflect.DeepEqual(inv.Processes[0].RunIDs, tc.ids) {
					t.Fatalf("lost expanded IDs: %+v", inv)
				}
				waiting := inventoryWaiting(inv)
				if len(waiting) != 1 || !reflect.DeepEqual(waiting[0].RunIDs, tc.ids) {
					t.Fatalf("waiting: %+v", waiting)
				}
			}
		})
	}
}

func TestProcessInventoryForegroundWaitIDs(t *testing.T) {
	const run = "01m531x6y92ggdqcmb1exzmn10"
	for _, ids := range [][]string{{run}, {}, {"not-a-run"}, make([]string, 201)} {
		p := testProcessPeer(t, os.Getpid(), func(c net.Conn) {
			var q map[string]any
			if json.NewDecoder(c).Decode(&q) != nil {
				return
			}
			json.NewEncoder(c).Encode(map[string]any{"ok": true, "data": map[string]any{"protocol": 1, "records": []any{}, "foreground_run_ids": ids}})
		})
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		inv := p.inventory(ctx)
		cancel()
		valid := len(ids) == 0 || len(ids) == 1 && ids[0] == run
		if (inv.Availability == "available") != valid {
			t.Fatalf("inventory: %+v", inv)
		}
		if valid && (!reflect.DeepEqual(inv.ForegroundRunIDs, ids) || len(inv.Processes) != 0) {
			t.Fatalf("lost foreground wait or invented process: %+v", inv)
		}
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
	binary := filepath.Join(home, ".local", "bin", "taskfleet")
	os.MkdirAll(filepath.Dir(binary), 0700)
	script := `#!/bin/sh
[ "$1" = run ] && [ "$2" = show ] && [ "$4" = --output ] && [ "$5" = json ] || exit 1
printf '%s\n' "$3" >> "$HOME/queried"
[ "$FIXTURE_STATUS" = done ] && landed=true || landed=false
printf '{"schema_version":1,"data":{"run_id":"%s","kind":"spinoff","source_repo":"/synthetic/source","created_by_session":{"harness":"pi","session_id":"11111111-1111-4111-8111-111111111111"},"title":"Synthetic work","status":"%s","landed":%s,"report":{"secret":"must not cross","origin":{"worker_oid":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}}}\n' "$3" "$FIXTURE_STATUS" "$landed"
`
	if err := os.WriteFile(binary, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", home)
	id := "01m51veyk0hsa1br34epkr2rpg"
	runs := readProcessSpinoffs(context.Background(), home, []string{"FIXTURE_STATUS=running"}, []string{id, "bad;command"}, nativeSession{id: "11111111-1111-4111-8111-111111111111", cwd: "/synthetic/source"})
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
	done := readProcessSpinoffs(context.Background(), home, []string{"FIXTURE_STATUS=done"}, []string{id}, nativeSession{id: "11111111-1111-4111-8111-111111111111", cwd: "/synthetic/source"})
	if taskfleetPending(done) {
		t.Fatal("finished runs presented as working")
	}
	if len(done) != 1 || done[0].Commit != nil {
		t.Fatalf("pre-rebase worker OID exposed as an integrated commit: %+v", done)
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

func TestProcessRPCDeltaAndAggregateStatusNeverLeakNativeDetails(t *testing.T) {
	const id = "11111111-1111-4111-8111-111111111111"
	rpc := &piRPC{events: make(chan json.RawMessage, 20)}
	s := &conversation{id: id, rpc: rpc, state: "idle"}
	c := &ConversationController{sessions: map[string]*conversation{id: s}, journal: newEventJournal()}
	frames := []string{
		`{"type":"agent_start"}`,
		`{"type":"message_end","message":{"role":"custom","customType":"ad-process:notification","details":{"kind":"success","processId":"proc_abcd","processName":"first","timestamp":1}}}`,
		`{"type":"message_start","message":{"role":"assistant","content":[]}}`,
		`{"type":"message_end","message":{"role":"custom","customType":"ad-process:notification","details":{"kind":"success","processId":"proc_bcde","processName":"during-first-stream","timestamp":2}}}`,
		`{"type":"message_update","assistantMessageEvent":{"type":"toolcall_start","contentIndex":0,"toolName":"process","id":"call1"}}`,
		`{"type":"message_update","assistantMessageEvent":{"type":"toolcall_delta","contentIndex":0,"delta":"{\"command\":\"TOKEN=synthetic-secret sleep 1\"}"}}`,
		`{"type":"message_update","assistantMessageEvent":{"type":"toolcall_end","contentIndex":0,"toolCall":{"id":"call1","name":"process","arguments":{"action":"start","command":"TOKEN=synthetic-secret sleep 1"}}}}`,
		`{"type":"message_start","message":{"role":"toolResult","toolName":"process","content":[{"type":"text","text":"pid 123 /private-log"}],"details":{"process":{"command":"synthetic-secret","pid":123,"stdoutFile":"/private-log"}}}}`,
		`{"type":"message_end","message":{"role":"toolResult","toolName":"process","details":{"process":{"command":"synthetic-secret","pid":123,"stdoutFile":"/private-log"}}}}`,
		`{"type":"turn_end","messages":[{"role":"toolResult","details":{"command":"synthetic-secret","pid":123,"stdoutFile":"/private-log"}}]}`,
		`{"type":"agent_end","messages":[{"role":"toolResult","details":{"command":"synthetic-secret","pid":123,"stdoutFile":"/private-log"}}]}`,
		`{"type":"message_start","message":{"role":"assistant","content":[]}}`,
		`{"type":"message_update","assistantMessageEvent":{"type":"toolcall_start","contentIndex":0,"toolName":"read","id":"call2"}}`,
		`{"type":"message_update","assistantMessageEvent":{"type":"toolcall_delta","contentIndex":0,"delta":"public.md"}}`,
		`{"type":"message_update","assistantMessageEvent":{"type":"toolcall_end","contentIndex":0,"toolCall":{"id":"call2","name":"read","arguments":{"path":"public.md"}}}}`,
	}
	for _, frame := range frames {
		rpc.events <- json.RawMessage(frame)
	}
	close(rpc.events)
	c.drain(s)
	status, _ := json.Marshal(s.events)
	c.journal.mu.Lock()
	journal := bytes.Join(c.journal.frames, []byte("\n"))
	c.journal.mu.Unlock()
	for _, private := range []string{"synthetic-secret", "/private-log", "stdoutFile", "\"pid\""} {
		if strings.Contains(string(status), private) || strings.Contains(string(journal), private) {
			t.Fatal("private process RPC field escaped", private, string(status), string(journal))
		}
	}
	if !bytes.Contains(journal, []byte(`"delivery":"wake"`)) || !bytes.Contains(journal, []byte(`"delivery":"steer"`)) {
		t.Fatal("initial wake and concurrent first-assistant notification were not distinguished", string(journal))
	}
	if !strings.Contains(string(journal), "public.md") {
		t.Fatal("non-process argument deltas lost after message reset")
	}
	for _, raw := range s.events {
		var frame map[string]any
		json.Unmarshal(raw, &frame)
		for field := range frame {
			if field != "type" && field != "toolName" {
				t.Fatal("unchecked diagnostic field", field)
			}
		}
	}
}

func TestProcessUnavailableRetainsBrowserOriginWithoutCreatingOwners(t *testing.T) {
	home := t.TempDir()
	id := ownershipTestID
	if processBrowserOrigin(home, id) {
		t.Fatal("absent origin invented")
	}
	if _, err := os.Stat(filepath.Join(home, "pi-owners")); !os.IsNotExist(err) {
		t.Fatal("inventory created native ownership state")
	}
	dir := filepath.Join(home, "pi-owners")
	os.Mkdir(dir, 0700)
	os.WriteFile(filepath.Join(dir, id+".lock"), []byte(`{"workspace":"ws_example123","cwd":"/synthetic"}`), 0600)
	if !processBrowserOrigin(home, id) {
		t.Fatal("saved browser origin lost after daemon restart")
	}
}

func TestProcessSnapshotKeepsPendingQuestionDuringNativeRun(t *testing.T) {
	home := t.TempDir()
	os.MkdirAll(filepath.Join(home, "src", "workspace"), 0700)
	cfg := transport.Config{UID: os.Geteuid(), GatewayUID: os.Geteuid(), Username: "synthetic", Home: home, Provider: "github", Subject: "42", Socket: "/run/open-habitat/users/synthetic/daemon.sock"}
	id := ownershipTestID
	workspace := opaque("ws_", "github:42:workspace")
	question := map[string]any{"request_id": "q", "question_kind": "input", "prompt": "Choose", "choices": []string{}}
	c := &ConversationController{cfg: cfg, home: home, fixture: true, trusted: func(*http.Request) bool { return true }, discover: func(cfg transport.Config) Discovery { return scan(home, cfg.UID, unix.Openat2, false) }, sessions: map[string]*conversation{id: {id: id, workspace: workspace, rpc: &piRPC{exited: make(chan struct{})}, runActive: true, questionID: "q", question: question}}, journal: newEventJournal()}
	request := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
	request.RequestURI = SnapshotPath
	w := httptest.NewRecorder()
	c.FixtureSnapshot().ServeHTTP(w, request)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var snapshot struct {
		Agents []struct {
			Active   bool `json:"run_active"`
			Question struct {
				ID string `json:"request_id"`
			} `json:"pending_question"`
		} `json:"agents"`
	}
	if json.Unmarshal(w.Body.Bytes(), &snapshot) != nil || len(snapshot.Agents) != 1 || !snapshot.Agents[0].Active || snapshot.Agents[0].Question.ID != "q" {
		t.Fatal("snapshot lost question precedence", w.Body.String())
	}
}

// Only the current leaf's ancestry counts, and the process start time against
// this daemon's and this Pi's start says why a process was cut off.
func TestProcessInterruptedFromActiveBranch(t *testing.T) {
	start := func(id, parent, proc string, at int64, command string) string {
		return fmt.Sprintf(`{"type":"message","id":%q,"parentId":%q,"message":{"role":"toolResult","toolName":"process","details":{"action":"start","process":{"id":%q,"name":"n","command":%q,"startTime":%d},"notify":{"onSuccess":"turn","onFailure":"turn"}}}}`, id, parent, proc, command, at)
	}
	lines := []string{
		`{"type":"session","version":3,"id":"00000000-0000-4000-8000-000000000001","cwd":"/w"}`,
		start("a", "", "proc_aaaa", 100, "taskfleet run wait 01m531x6y92ggdqcmb1exzmnya --output json"),
		start("b", "a", "proc_bbbb", 200, "export TOKEN=secret; sleep 9"),
		start("abandoned", "b", "proc_cccc", 250, "sleep 9"), // a branch the leaf left behind
		start("c", "b", "proc_dddd", 300, "sleep 9"),
		`{"type":"custom_message","id":"d","parentId":"c","customType":"oh-resume-catch-up","details":{"processes":[{"id":"proc_dddd","startTime":300}]}}`,
		start("e", "d", "proc_eeee", 400, "sleep 9"),
		start("f", "e", "proc_ffff", 120, "sleep 9"),
		// A timed-out stop leaves the process live; a successful one ends it.
		`{"type":"message","id":"g","parentId":"f","message":{"role":"toolResult","toolName":"process","details":{"action":"stop","result":{"ok":false,"reason":"timeout","info":{"id":"proc_ffff"}}}}}`,
		start("h", "g", "proc_9999", 130, "sleep 9"),
		`{"type":"message","id":"i","parentId":"h","message":{"role":"toolResult","toolName":"process","details":{"action":"stop","result":{"ok":true,"info":{"id":"proc_9999"}}}}}`,
	}
	open := scanBranchProcesses([]byte(strings.Join(lines, "\n") + "\n"))
	got := interruptedProcesses(open, 400, 150)
	if len(got) != 3 || got[0].ID != "proc_ffff" || got[1].ID != "proc_bbbb" || got[1].Reason != "pi_stopped" || got[2].ID != "proc_aaaa" || got[2].Reason != "server_restart" {
		t.Fatalf("interrupted: %+v", got)
	}
	if len(got[2].RunIDs) != 1 || strings.Contains(got[1].Preview, "secret") {
		t.Fatalf("projection: %+v", got)
	}
}

// A wait started before the person began the latest turn is marked; one the
// agent started within that turn, or with the turn's start unknown, is not.
func TestProcessWaitingMarksWaitsBeforeTheTurn(t *testing.T) {
	yes := true
	inv := processInventory{Availability: "available", Processes: []processRecord{
		{ID: "service", Name: "serve", Status: "running", Wakes: &yes, Start: 1000, RunIDs: []string{}},
		{ID: "build", Name: "build", Status: "running", Wakes: &yes, Start: 3000, RunIDs: []string{}},
	}}
	got := inventoryWaiting(inv)
	markWaitsBeforeTurn(got, 0)
	if got[0].BeforeTurn || got[1].BeforeTurn {
		t.Fatal("marked without a known turn start", got)
	}
	markWaitsBeforeTurn(got, 2000)
	if !got[0].BeforeTurn || got[1].BeforeTurn {
		t.Fatal(got)
	}
	raw, _ := json.Marshal(got)
	if !strings.Contains(string(raw), `"process_id":"service","name":"serve","kind":"process","run_ids":[],"before_turn":true`) || strings.Count(string(raw), "before_turn") != 1 || strings.Contains(string(raw), "start") {
		t.Fatal(string(raw))
	}
}
