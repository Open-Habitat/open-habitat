//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const (
	wakeRun   = "01m531x6y92ggdqcmb1exzmn00"
	wakeOther = "01m531x6y92ggdqcmb1exzmn01"
)

// taskfleet installs a synthetic Taskfleet on the agent's PATH that lists
// and shows these runs, which this conversation created unless foreign.
func (h *heldHarness) taskfleet(id string, runs map[string]string, foreign ...string) {
	h.t.Helper()
	extra := map[string]map[string]any{}
	for run, status := range runs {
		extra[run] = map[string]any{"status": status}
		for _, f := range foreign {
			if f == run {
				extra[run]["created_by_session"] = map[string]string{"harness": "pi", "session_id": "aaaaaaaa-0000-4000-8000-0000000000ff"}
			}
		}
	}
	h.taskfleetRuns(id, extra)
}

// taskfleetRuns is taskfleet with each run's fields given: its status and
// anything Taskfleet adds, such as a resident run's round state.
func (h *heldHarness) taskfleetRuns(id string, runs map[string]map[string]any) {
	h.t.Helper()
	bin := filepath.Join(h.root, ".local", "bin")
	if err := os.MkdirAll(bin, 0700); err != nil {
		h.t.Fatal(err)
	}
	var list []any
	shows := ""
	for run, fields := range runs {
		r := map[string]any{"run_id": run, "kind": "spinoff", "landed": fields["status"] == "done", "title": "työ " + run[len(run)-2:], "created_at": "2030-01-01T00:00:00Z", "source_repo": filepath.Join(h.root, "src", "project"), "agent_owner": "taskfleet", "created_by_session": map[string]string{"harness": "pi", "session_id": id}, "report": map[string]string{"summary": "Valmis."}, "manifest": map[string]string{"updated_at": "2030-01-01T00:10:00Z"}, "node_transcripts": []any{}}
		for k, v := range fields {
			r[k] = v
		}
		list = append(list, r)
		show, _ := json.Marshal(map[string]any{"schema_version": 1, "data": r})
		shows += "if [ \"$3\" = " + run + " ]; then cat <<'EOF'\n" + string(show) + "\nEOF\nfi\n"
	}
	all, _ := json.Marshal(map[string]any{"schema_version": 1, "data": map[string]any{"runs": list}})
	script := "#!/bin/sh\nif [ \"$2\" = list ]; then cat <<'EOF'\n" + string(all) + "\nEOF\nexit 0\nfi\n" + shows
	if err := os.WriteFile(filepath.Join(bin, "taskfleet"), []byte(script), 0700); err != nil {
		h.t.Fatal(err)
	}
}

// crash ends the conversation's Pi unasked and, once it is gone, records in
// its native branch a waking background process that Pi started and never
// saw end, as a Pi stopped under a wait leaves it.
func (h *heldHarness) crash(c *ConversationController, id, command string) {
	h.t.Helper()
	c.mu.Lock()
	s := c.sessions[id]
	c.mu.Unlock()
	_ = s.rpc.cmd.Process.Kill()
	h.eventually("Pi reaped", func() bool {
		c.mu.Lock()
		defer c.mu.Unlock()
		return s.state == "stopped" && !liveChild(s)
	})
	h.cutProcess(c, id, command)
}

func (h *heldHarness) cutProcess(c *ConversationController, id, command string) {
	h.t.Helper()
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		h.t.Fatal(err)
	}
	for _, n := range sessions {
		if n.id != id {
			continue
		}
		b, err := os.ReadFile(n.path)
		if err != nil {
			h.t.Fatal(err)
		}
		lines := strings.Split(strings.TrimSpace(string(b)), "\n")
		var last struct {
			ID string `json:"id"`
		}
		_ = json.Unmarshal([]byte(lines[len(lines)-1]), &last)
		entry, _ := json.Marshal(map[string]any{"type": "message", "id": "c0ffee01", "parentId": last.ID, "timestamp": time.Now().UTC().Format(time.RFC3339Nano), "message": map[string]any{"role": "toolResult", "toolName": "process", "content": []any{}, "details": map[string]any{"action": "start", "process": map[string]any{"id": "proc_0a1b", "name": "odotus", "command": command, "startTime": time.Now().UnixMilli()}, "notify": map[string]string{"onSuccess": "turn", "onFailure": "turn"}}}})
		f, err := os.OpenFile(n.path, os.O_APPEND|os.O_WRONLY, 0)
		if err != nil {
			h.t.Fatal(err)
		}
		_, _ = f.Write(append(entry, '\n'))
		_ = f.Close()
		return
	}
	h.t.Fatal("native history not found")
}

func (h *heldHarness) wakes() []map[string]any {
	var out []map[string]any
	for _, line := range h.lines("wakes.log") {
		var q map[string]any
		if json.Unmarshal([]byte(line), &q) == nil {
			out = append(out, q)
		}
	}
	return out
}

func (h *heldHarness) launchesOf(id string) int {
	n := 0
	for _, l := range h.lines("launches.log") {
		if l == id {
			n++
		}
	}
	return n
}

// A Pi that waits on a Taskfleet run it created is not stopped for idleness,
// however long; once the run settles, the idle stop applies again.
func TestIdleStopSparesAPiWaitingOnItsRun(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Käynnistä työ", activityCommand(1))
	h.quiescent(c, id)
	h.taskfleet(id, map[string]string{wakeRun: "running"})
	now := time.Now().Add(time.Second)
	c.stopExpiredIdlePi(context.Background(), now)
	c.stopExpiredIdlePi(context.Background(), now.Add(3*piIdlePeriod))
	if !h.live(c, id) {
		t.Fatal("stopped while its own run still works")
	}
	// Somebody else's run holds nothing here.
	h.taskfleet(id, map[string]string{wakeRun: "running"}, wakeRun)
	c.stopExpiredIdlePi(context.Background(), now.Add(4*piIdlePeriod))
	if h.live(c, id) {
		t.Fatal("a run another conversation created kept this Pi")
	}
	if f, _, resting := h.rest(c, id); !resting || f.cause != "idle" {
		t.Fatalf("rest %+v", f)
	}
}

// The run hold is weaker than a busy Pi: a start that needs a place takes it
// from a truly idle Pi first, then from one waiting only on a run.
func TestRoomTakesTrulyIdlePiBeforeOneWaitingOnARun(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	var ids []string
	for i := 0; i < heldLiveLimit; i++ {
		id := h.create(c)
		h.converse(c, id, "Viesti", activityCommand(i))
		ids = append(ids, id)
	}
	// The longest unused one waits on its run.
	h.taskfleet(ids[0], map[string]string{wakeRun: "running"})
	h.create(c)
	if !h.live(c, ids[0]) || h.live(c, ids[1]) {
		t.Fatalf("room: waiting live %v, next live %v", h.live(c, ids[0]), h.live(c, ids[1]))
	}
}

// Pi crashed while a `taskfleet run wait` for this conversation's own run
// was running. Nothing happens while the run works; once it settles Habitat
// starts Pi once and the companion's catch-up becomes the agent's turn.
func TestStoppedConversationWakesWhenTheAwaitedRunSettles(t *testing.T) {
	h := newHeldHarness(t)
	h.setFile("background", "1")
	h.setFile("background-state", "finished")
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Odota työtä", activityCommand(1))
	h.quiescent(c, id)
	h.taskfleet(id, map[string]string{wakeRun: "running"})
	h.crash(c, id, "taskfleet run wait "+wakeRun+" --output json")
	launches := h.launchesOf(id)
	c.wakeWaitingRests(context.Background(), time.Now())
	if h.launchesOf(id) != launches || h.live(c, id) {
		t.Fatal("woken while the run still works")
	}
	h.taskfleet(id, map[string]string{wakeRun: "done"})
	c.wakeWaitingRests(context.Background(), time.Now())
	if h.launchesOf(id) != launches+1 {
		t.Fatalf("launches %d, want one more than %d", h.launchesOf(id), launches)
	}
	wakes := h.wakes()
	if len(wakes) != 1 || wakes[0]["reason"] != "settled" || wakes[0]["session_id"] != id {
		t.Fatalf("wakes: %v", wakes)
	}
	rests := h.lines("launch-rest.log")
	if !strings.HasPrefix(rests[len(rests)-1], "crash ") {
		t.Fatalf("the woken Pi was not told its stop: %q", rests)
	}
	h.eventually("woken turn settled", func() bool {
		c.mu.Lock()
		defer c.mu.Unlock()
		s := c.sessions[id]
		return s.told && heldActivity(s) == "" && liveChild(s)
	})
	if _, _, resting := h.rest(c, id); resting {
		t.Fatal("still resting after the agent was told")
	}
	// The agent has been told; a later check wakes nothing again.
	c.wakeWaitingRests(context.Background(), time.Now())
	if len(h.wakes()) != 1 || h.launchesOf(id) != launches+1 {
		t.Fatal("woken twice")
	}
}

// Jari 2026-11-08: when the main conversation's Pi stops, its named workers
// keep waiting, and the next round report wakes it as a settled run does.
func TestStoppedConversationWakesOnItsNamedWorkersRoundReport(t *testing.T) {
	h := newHeldHarness(t)
	h.setFile("background", "1")
	h.setFile("background-state", "finished")
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Pyydä uusi kierros", activityCommand(1))
	h.quiescent(c, id)
	resident := func(state string, open bool) map[string]map[string]any {
		return map[string]map[string]any{wakeRun: {"status": "running", "supervisor": map[string]string{"state": "alive"}, "resident": map[string]any{"name": "proto-m365", "round_state": state, "rounds_reported": 2, "worker_running": state == "working", "idle_expiry_secs": 86400, "last_round": map[string]any{"round": 2, "attempt": 2, "reported_at": "2030-01-01T00:20:00Z", "summary": "Kierros 2 valmis.", "open": open}}}}
	}
	h.taskfleetRuns(id, resident("working", false))
	h.crash(c, id, "taskfleet run wait "+wakeRun+" --output json")
	launches := h.launchesOf(id)
	c.wakeWaitingRests(context.Background(), time.Now())
	if h.launchesOf(id) != launches || h.live(c, id) {
		t.Fatal("woken while the named worker's round is under way")
	}
	h.taskfleetRuns(id, resident("waiting", true))
	c.wakeWaitingRests(context.Background(), time.Now())
	if h.launchesOf(id) != launches+1 {
		t.Fatalf("launches %d, want one more than %d", h.launchesOf(id), launches)
	}
	if wakes := h.wakes(); len(wakes) != 1 || wakes[0]["reason"] != "settled" || wakes[0]["session_id"] != id {
		t.Fatalf("wakes: %v", wakes)
	}
}

// A cut-off waking process that is not a run wait can never report back, so
// it wakes the conversation at once; a wait for runs that are not this
// conversation's is the same. A Pi the person stopped is never woken.
func TestCutOffWaitsWakeAtOnceButThePersonsStopHolds(t *testing.T) {
	for _, tc := range []struct{ name, command string }{
		{"other process", "until curl -sf http://example.invalid; do sleep 5; done"},
		{"foreign run", "taskfleet run wait " + wakeOther},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := newHeldHarness(t)
			h.setFile("background", "1")
			h.setFile("background-state", "finished")
			c, stop := h.daemon()
			defer stop()
			id := h.create(c)
			h.converse(c, id, "Odota", activityCommand(1))
			h.quiescent(c, id)
			h.taskfleet(id, map[string]string{wakeOther: "running"}, wakeOther)
			h.crash(c, id, tc.command)
			c.wakeWaitingRests(context.Background(), time.Now())
			if w := h.wakes(); len(w) != 1 || w[0]["reason"] != "cut_off" {
				t.Fatalf("wakes: %v", w)
			}
		})
	}
	h := newHeldHarness(t)
	h.setFile("background", "1")
	h.setFile("background-state", "finished")
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Odota", activityCommand(1))
	h.quiescent(c, id)
	w := h.post(func(w http.ResponseWriter, r *http.Request) { c.stop(w, r, id) }, "")
	if w.Code != 200 {
		t.Fatalf("stop: %d %s", w.Code, w.Body.String())
	}
	h.eventually("stopped", func() bool { return h.stopped(c, id) })
	h.cutProcess(c, id, "until false; do sleep 5; done")
	c.wakeWaitingRests(context.Background(), time.Now())
	if len(h.wakes()) != 0 || h.live(c, id) {
		t.Fatal("woke a Pi the person stopped")
	}
}

// A person who woke a crashed conversation by typing and then stopped it has
// the last word, in this daemon and after a restart: the companion recorded
// their stop in the branch, so the cut-off wait wakes nothing.
func TestThePersonsStopAfterATypingWakeHoldsAcrossARestart(t *testing.T) {
	h := newHeldHarness(t)
	h.setFile("background", "1")
	h.setFile("background-state", "finished")
	first, stopFirst := h.daemon()
	id := h.create(first)
	h.converse(first, id, "Odota", activityCommand(1))
	h.quiescent(first, id)
	h.taskfleet(id, map[string]string{wakeRun: "done"})
	h.crash(first, id, "taskfleet run wait "+wakeRun)
	if code, state := h.wake(first, id); code != 200 || state != "starting" {
		t.Fatalf("typing wake: %d %s", code, state)
	}
	h.eventually("awake", func() bool { _, v := h.status(first, id); return v.State == "idle" })
	if w := h.post(func(w http.ResponseWriter, r *http.Request) { first.stop(w, r, id) }, ""); w.Code != 200 {
		t.Fatalf("stop: %d", w.Code)
	}
	h.eventually("stopped", func() bool { return h.stopped(first, id) })
	if sessions, _ := nativeSessions(first.nativeCfg()); len(sessions) != 1 {
		t.Fatal("native history not found")
	} else if b, _ := os.ReadFile(sessions[0].path); !strings.Contains(string(b), `"oh-person-stop"`) {
		t.Fatal("the person's stop is not in the branch")
	}
	first.wakeWaitingRests(context.Background(), time.Now())
	if len(h.wakes()) != 0 {
		t.Fatal("woke a Pi the person stopped after waking it")
	}
	stopFirst()
	c, stop := h.daemon()
	defer stop()
	c.wakeWaitingRests(context.Background(), time.Now())
	if len(h.wakes()) != 0 || h.live(c, id) {
		t.Fatal("a restart overruled the person's stop")
	}
}

// A wake the companion declines leaves the rest as it was and stops Pi
// again; the same stop is not woken twice.
func TestDeclinedWakeRestsOn(t *testing.T) {
	h := newHeldHarness(t)
	h.setFile("background", "1")
	h.setFile("background-state", "finished")
	h.setFile("wake-decline", "1")
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Odota", activityCommand(1))
	h.quiescent(c, id)
	h.crash(c, id, "sleep 600")
	c.wakeWaitingRests(context.Background(), time.Now())
	if len(h.wakes()) != 1 {
		t.Fatalf("wakes: %v", h.wakes())
	}
	h.eventually("stopped again", func() bool { return h.stopped(c, id) })
	if f, _, resting := h.rest(c, id); !resting || f.cause != "crash" {
		t.Fatalf("rest %+v %v", f, resting)
	}
	launches := h.launchesOf(id)
	c.wakeWaitingRests(context.Background(), time.Now().Add(time.Hour))
	if h.launchesOf(id) != launches {
		t.Fatal("a declined wake was tried again")
	}
}

// After a daemon restart, a conversation whose wait the restart cut off is
// found from its native branch and woken once its run has settled.
func TestRestartCutWaitWakesAfterTheRunSettles(t *testing.T) {
	h := newHeldHarness(t)
	h.setFile("background", "1")
	h.setFile("background-state", "finished")
	first, stopFirst := h.daemon()
	id := h.create(first)
	h.converse(first, id, "Odota", activityCommand(1))
	h.quiescent(first, id)
	stopFirst()
	h.eventually("first incarnation's Pi reaped", func() bool {
		first.mu.Lock()
		defer first.mu.Unlock()
		return first.sessions[id].dead
	})
	h.cutProcess(first, id, "taskfleet run wait "+wakeRun+" --any --output json")
	h.taskfleet(id, map[string]string{wakeRun: "failed", wakeOther: "running"})
	c, stop := h.daemon()
	defer stop()
	c.wakeWaitingRests(context.Background(), time.Now())
	if w := h.wakes(); len(w) != 1 || w[0]["reason"] != "settled" {
		t.Fatalf("wakes: %v", w)
	}
	rests := h.lines("launch-rest.log")
	if !strings.HasPrefix(rests[len(rests)-1], "restart ") {
		t.Fatalf("the woken Pi was not told the restart: %q", rests)
	}
}

func TestBranchSaysWhichProcessesThePersonStopped(t *testing.T) {
	start := func(id, proc string, at int64) string {
		return `{"type":"message","id":"` + id + `","parentId":null,"timestamp":"2030-01-01T00:00:00Z","message":{"role":"toolResult","toolName":"process","details":{"action":"start","process":{"id":"` + proc + `","name":"x","command":"sleep 9","startTime":` + strings.Repeat("1", int(at)) + `},"notify":{"onSuccess":"turn","onFailure":"turn"}}}}`
	}
	b := strings.Join([]string{
		start("a0000001", "proc_aaaa", 1),
		`{"type":"custom","id":"a0000002","parentId":"a0000001","timestamp":"2030-01-01T00:00:01Z","customType":"oh-person-stop","data":{"schema_version":1}}`,
		strings.Replace(start("a0000003", "proc_bbbb", 2), `"parentId":null`, `"parentId":"a0000002"`, 1),
	}, "\n")
	open := scanBranch([]byte(b)).open
	if len(open) != 2 || !open[0].PersonStopped || open[1].PersonStopped {
		t.Fatalf("%+v", open)
	}
}

func TestWaitOutcomeFollowsTheWaitsOwnCondition(t *testing.T) {
	id := "aaaaaaaa-0000-4000-8000-00000000000a"
	run := func(runID, status string, own bool) nativeSpinoff {
		creator := id
		if !own {
			creator = "aaaaaaaa-0000-4000-8000-0000000000ff"
		}
		r := nativeSpinoff{ID: runID, Kind: "spinoff", Status: status, SourceRepo: "/w", AgentOwner: "taskfleet"}
		r.Creator = &struct {
			Harness   string `json:"harness"`
			SessionID string `json:"session_id"`
		}{"pi", creator}
		return r
	}
	wait := func(command string) []branchProcess {
		return []branchProcess{{ID: "proc_0a1b", Command: command, Wakes: true}}
	}
	both := "taskfleet run wait " + wakeRun + " " + wakeOther
	for _, tc := range []struct {
		name    string
		waits   []branchProcess
		runs    map[string]nativeSpinoff
		outcome string
	}{
		{"every run by default", wait(both), map[string]nativeSpinoff{wakeRun: run(wakeRun, "done", true), wakeOther: run(wakeOther, "running", true)}, ""},
		{"every run settled", wait(both), map[string]nativeSpinoff{wakeRun: run(wakeRun, "done", true), wakeOther: run(wakeOther, "cancelled", true)}, "settled"},
		{"the first with --any", wait(both + " --any"), map[string]nativeSpinoff{wakeRun: run(wakeRun, "done", true), wakeOther: run(wakeOther, "running", true)}, "settled"},
		{"attention wakes a default wait", wait(both), map[string]nativeSpinoff{wakeRun: func() nativeSpinoff { r := run(wakeRun, "running", true); r.AwaitingInput = true; return r }()}, "settled"},
		{"but not a --terminal one", wait(both + " --terminal"), map[string]nativeSpinoff{wakeRun: func() nativeSpinoff { r := run(wakeRun, "running", true); r.AwaitingInput = true; return r }()}, ""},
		{"unreadable Taskfleet decides nothing", wait(both), nil, ""},
		{"foreign runs", wait(both), map[string]nativeSpinoff{wakeRun: run(wakeRun, "running", false)}, "cut_off"},
		{"another process", wait("npm run dev"), nil, "cut_off"},
	} {
		if got := waitOutcome(tc.waits, tc.runs, id); got != tc.outcome {
			t.Errorf("%s: %q, want %q", tc.name, got, tc.outcome)
		}
	}
}

func TestRestartNoticeCarriesHabitatsWake(t *testing.T) {
	raw := json.RawMessage(`{"type":"custom_message","customType":"oh-resume-catch-up","display":true,"content":"x","details":{"stopped":{"cause":"crash","at":"2026-10-28T19:26:55Z"},"woke":"settled","processes":[],"spinoffs":[]}}`)
	entry, ok := nativeRestart(nativeEntry{ID: "c", Type: "custom_message", Raw: raw})
	if !ok || entry.Restart == nil || entry.Restart.Woke != "settled" {
		t.Fatalf("%+v", entry.Restart)
	}
	raw = json.RawMessage(strings.Replace(string(raw), `"settled"`, `"anything"`, 1))
	if entry, _ := nativeRestart(nativeEntry{ID: "c", Type: "custom_message", Raw: raw}); entry.Restart.Woke != "" {
		t.Fatal("an unknown reason was carried")
	}
}

// While Habitat's own wake hands the agent its catch-up, a message the person
// sends is held for after that turn instead of racing it into Pi.
func TestAMessageSentDuringAWakeWaitsForItsTurn(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Alku", activityCommand(1))
	h.quiescent(c, id)
	c.mu.Lock()
	s := c.sessions[id]
	s.waking = true
	c.mu.Unlock()
	if w := h.send(c, id, "Kesken herätyksen", heldA); w.Code != 200 || !strings.Contains(w.Body.String(), `"held"`) {
		t.Fatalf("send during a wake: %d %s", w.Code, w.Body.String())
	}
	if p := h.prompts(); len(p) != 1 {
		t.Fatalf("prompted during the wake: %q", p)
	}
	c.mu.Lock()
	s.waking = false
	c.mu.Unlock()
	c.deliverHeld(s)
	h.eventually("held message delivered", func() bool { return h.receipt(c, id, heldA) == "accepted" })
	if p := h.prompts(); len(p) != 2 || p[1] != "Kesken herätyksen" {
		t.Fatalf("prompts: %q", p)
	}
}
