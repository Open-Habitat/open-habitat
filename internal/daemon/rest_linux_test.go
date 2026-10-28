//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// The person's card and the agent's catch-up (process-extension.mjs
// readSpinoffs) read Taskfleet by one rule; both suites read the same table.
func TestRestRunsFollowTheCompanionRule(t *testing.T) {
	raw, err := os.ReadFile("testdata/catch-up-runs.json")
	if err != nil {
		t.Fatal(err)
	}
	var table struct {
		Cases []struct {
			Name     string            `json:"name"`
			Session  string            `json:"session"`
			Since    string            `json:"since"`
			Waited   []string          `json:"waited"`
			Reported []string          `json:"reported"`
			Runs     []json.RawMessage `json:"runs"`
			Settled  []restRun         `json:"settled"`
			Rearm    []string          `json:"rearm"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(raw, &table); err != nil {
		t.Fatal(err)
	}
	set := func(items []string) map[string]bool {
		m := map[string]bool{}
		for _, item := range items {
			m[item] = true
		}
		return m
	}
	for _, tc := range table.Cases {
		runs := make([]nativeSpinoff, len(tc.Runs))
		for i, r := range tc.Runs {
			if err := json.Unmarshal(r, &runs[i]); err != nil {
				t.Fatal(err)
			}
		}
		since, _ := time.Parse(time.RFC3339, tc.Since)
		list := func(context.Context) ([]nativeSpinoff, bool) { return runs, true }
		show := func(_ context.Context, id string) (nativeSpinoff, bool) {
			for _, r := range runs {
				if r.ID == id {
					return r, true
				}
			}
			return nativeSpinoff{}, false
		}
		settled, working, availability := unreportedRuns(context.Background(), nativeSession{id: tc.Session}, since.UnixMilli(), set(tc.Waited), set(tc.Reported), list, show)
		for i := range settled {
			settled[i].Title = ""
		}
		got, _ := json.Marshal(settled)
		want, _ := json.Marshal(tc.Settled)
		if string(got) != string(want) || availability != "available" {
			t.Errorf("%s: settled %s, want %s (%s)", tc.Name, got, want, availability)
		}
		var rearm []string
		for _, r := range working {
			if r.Waited != nil && *r.Waited {
				rearm = append(rearm, r.ID)
			}
		}
		if strings.Join(rearm, ",") != strings.Join(tc.Rearm, ",") {
			t.Errorf("%s: cut-off waits %v, want %v", tc.Name, rearm, tc.Rearm)
		}
	}
	// No inventory is no claim that nothing settled.
	if _, _, availability := unreportedRuns(context.Background(), nativeSession{id: "s1"}, 0, nil, nil, func(context.Context) ([]nativeSpinoff, bool) { return nil, false }, nil); availability != "unavailable" {
		t.Fatalf("missing Taskfleet read as %s", availability)
	}
}

func (h *heldHarness) rest(c *ConversationController, id string) (restFact, bool, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.restOf(c.sessions[id])
}

func (h *heldHarness) wake(c *ConversationController, id string) (int, string) {
	r := httptest.NewRequest("POST", "http://unix/continue", nil)
	w := httptest.NewRecorder()
	c.continueEnded(w, r, id)
	var reply struct {
		State string `json:"state"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &reply)
	return w.Code, reply.State
}

func (h *heldHarness) expectRest(c *ConversationController, id, cause string, awake bool) restFact {
	h.t.Helper()
	f, gotAwake, resting := h.rest(c, id)
	if !resting || f.cause != cause || gotAwake != awake || f.at.IsZero() {
		h.t.Fatalf("rest = %+v awake=%v resting=%v, want %s awake=%v", f, gotAwake, resting, cause, awake)
	}
	return f
}

// Each stop cause the daemon sees is the card's first sentence; typing wakes
// Pi once without a turn, the wake is idempotent, the started Pi learns the
// same stop, and the first message ends the rest.
func TestRestCausesWakeAndTell(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Ennen lepoa", activityCommand(1))
	h.quiescent(c, id)
	if _, _, resting := h.rest(c, id); resting {
		t.Fatal("a running, told conversation rests")
	}

	// idle: the reaper's stop.
	now := time.Now().Add(time.Second)
	c.stopExpiredIdlePi(context.Background(), now)
	c.stopExpiredIdlePi(context.Background(), now.Add(piIdlePeriod))
	if h.live(c, id) {
		t.Fatal("idle Pi was not reaped")
	}
	idle := h.expectRest(c, id, "idle", false)

	// Typing wakes it: one launch, no prompt, and a second wake is the answer,
	// not a conflict or another child.
	launches := len(h.lines("launches.log"))
	prompts := len(h.prompts())
	if code, state := h.wake(c, id); code != 200 || state != "starting" {
		t.Fatalf("wake: %d %s", code, state)
	}
	if code, _ := h.wake(c, id); code != 200 {
		t.Fatalf("racing wake: %d", code)
	}
	h.eventually("woken Pi ready", func() bool { _, awake, _ := h.rest(c, id); return awake })
	if code, state := h.wake(c, id); code != 200 || state != "idle" {
		t.Fatalf("wake of an awake Pi: %d %s", code, state)
	}
	time.Sleep(200 * time.Millisecond) // a lazy start would close it again here
	if !h.live(c, id) || len(h.lines("launches.log")) != launches+1 || len(h.prompts()) != prompts {
		t.Fatalf("wake: live=%v launches %d→%d prompts %d→%d", h.live(c, id), launches, len(h.lines("launches.log")), prompts, len(h.prompts()))
	}
	if got := h.expectRest(c, id, "idle", true); !got.at.Equal(idle.at) {
		t.Fatalf("woken rest moved: %v → %v", idle.at, got.at)
	}
	env := h.lines("launch-rest.log")
	if want := "idle " + idle.at.UTC().Format(time.RFC3339); env[len(env)-1] != want {
		t.Fatalf("Pi started from %q, want %q", env[len(env)-1], want)
	}

	// Woken but unused, it can stop again; the rest it woke from still holds.
	now = time.Now().Add(time.Second)
	c.stopExpiredIdlePi(context.Background(), now)
	c.stopExpiredIdlePi(context.Background(), now.Add(piIdlePeriod))
	if got := h.expectRest(c, id, "idle", false); !got.at.Equal(idle.at) {
		t.Fatalf("an unused wake replaced the rest: %v → %v", idle.at, got.at)
	}

	// The message tells the agent, and the rest is over.
	h.converse(c, id, "Jatketaan", activityCommand(2))
	if _, _, resting := h.rest(c, id); resting {
		t.Fatal("still resting after the message")
	}

	// person: the Stop button.
	w := httptest.NewRecorder()
	c.stop(w, httptest.NewRequest("POST", "http://unix/stop", nil), id)
	h.eventually("stopped", func() bool { return !h.live(c, id) })
	h.expectRest(c, id, "person", false)

	// crash: Pi ends on its own, here on the next prompt.
	h.setFile("prompt-exit", "1")
	if w := h.send(c, id, "Kaadu", activityCommand(3)); w.Code != 200 {
		t.Fatalf("send: %d %s", w.Code, w.Body.String())
	}
	h.eventually("crashed", func() bool {
		f, _, resting := h.rest(c, id)
		return resting && f.cause == "crash"
	})
	h.setFile("prompt-exit", "")

	// restart: a new daemon has no handle; the rest dates from its start.
	stop()
	c2, stop2 := h.daemon()
	defer stop2()
	if got := h.expectRest(c2, id, "restart", false); got.at.UnixMilli() != c2.started {
		t.Fatalf("restart rest at %v, daemon started %d", got.at, c2.started)
	}
}

// Two wakes that both find Pi stopped and then wait for the proof permit:
// the second finds the first one's Pi and answers with it.
func TestRacingWakesShareOnePi(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Ennen lepoa", activityCommand(1))
	h.quiescent(c, id)
	w := httptest.NewRecorder()
	c.stop(w, httptest.NewRequest("POST", "http://unix/stop", nil), id)
	h.eventually("stopped", func() bool { return !h.live(c, id) })
	launches := len(h.lines("launches.log"))
	release, ok := c.proofPermit(context.Background())
	if !ok {
		t.Fatal("permit")
	}
	codes := make(chan int, 2)
	for range 2 {
		go func() { code, _ := h.wake(c, id); codes <- code }()
	}
	time.Sleep(100 * time.Millisecond) // both pass the early check while Pi is stopped
	release()
	for range 2 {
		if code := <-codes; code != 200 {
			t.Fatalf("racing wake: %d", code)
		}
	}
	h.eventually("one Pi started", func() bool { _, awake, _ := h.rest(c, id); return awake })
	if got := len(h.lines("launches.log")); got != launches+1 {
		t.Fatalf("launches %d → %d", launches, got)
	}
}

// The card's report is read as the person, starts nothing, and names the runs
// that settled and the stop; a conversation that does not rest has no stop.
func TestRestReportReadsTaskfleetWithoutStarting(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Käynnistä työ", activityCommand(1))
	h.quiescent(c, id)
	// Without Taskfleet on the agent's PATH no run can have settled: the
	// inventory is empty and read, so a quiet rest has nothing to tell.
	if taskfleetBinary(h.root) == "" {
		w := httptest.NewRecorder()
		c.stop(w, httptest.NewRequest("POST", "http://unix/stop", nil), id)
		h.eventually("stopped", func() bool { return !h.live(c, id) })
		w = httptest.NewRecorder()
		c.restReport(w, httptest.NewRequest("GET", "http://unix/rest", nil), id)
		var reply map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &reply); err != nil || reply["availability"] != "available" {
			t.Fatalf("no Taskfleet: %d %s", w.Code, w.Body.String())
		}
		h.converse(c, id, "Taas", activityCommand(2))
		h.quiescent(c, id)
	}
	bin := filepath.Join(h.root, ".local", "bin")
	if err := os.MkdirAll(bin, 0700); err != nil {
		t.Fatal(err)
	}
	run := map[string]any{"run_id": "01m531x6y92ggdqcmb1exzmn00", "kind": "spinoff", "status": "done", "landed": true, "title": "Kontrastit", "created_at": "2030-01-01T00:00:00Z", "source_repo": filepath.Join(h.root, "src", "project"), "agent_owner": "taskfleet", "created_by_session": map[string]string{"harness": "pi", "session_id": id}, "report": map[string]string{"summary": "Korjasi 14 kontrastivirhettä."}, "manifest": map[string]string{"updated_at": "2030-01-01T00:10:00Z"}, "node_transcripts": []any{}}
	list, _ := json.Marshal(map[string]any{"schema_version": 1, "data": map[string]any{"runs": []any{run}}})
	show, _ := json.Marshal(map[string]any{"schema_version": 1, "data": run})
	script := "#!/bin/sh\nif [ \"$2\" = list ]; then cat <<'EOF'\n" + string(list) + "\nEOF\nelse cat <<'EOF'\n" + string(show) + "\nEOF\nfi\n"
	if err := os.WriteFile(filepath.Join(bin, "taskfleet"), []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	read := func() map[string]any {
		t.Helper()
		w := httptest.NewRecorder()
		c.restReport(w, httptest.NewRequest("GET", "http://unix/rest", nil), id)
		if w.Code != 200 {
			t.Fatalf("rest: %d %s", w.Code, w.Body.String())
		}
		var reply map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &reply); err != nil {
			t.Fatal(err)
		}
		return reply
	}
	if report := read()["report"].(map[string]any); report["stopped"] != nil || len(report["runs"].([]any)) != 0 {
		t.Fatalf("a running conversation's report: %v", report)
	}
	w := httptest.NewRecorder()
	c.stop(w, httptest.NewRequest("POST", "http://unix/stop", nil), id)
	h.eventually("stopped", func() bool { return !h.live(c, id) })
	launches := len(h.lines("launches.log"))
	reply := read()
	report := reply["report"].(map[string]any)
	if reply["availability"] != "available" || report["stopped"].(map[string]any)["cause"] != "person" || report["interrupted_turn"] != false {
		t.Fatalf("report: %v", reply)
	}
	runs := report["runs"].([]any)
	if len(runs) != 1 || runs[0].(map[string]any)["state"] != "merged" || runs[0].(map[string]any)["summary"] != "Korjasi 14 kontrastivirhettä." {
		t.Fatalf("runs: %v", runs)
	}
	if h.live(c, id) || len(h.lines("launches.log")) != launches {
		t.Fatal("reading the report started Pi")
	}
}
