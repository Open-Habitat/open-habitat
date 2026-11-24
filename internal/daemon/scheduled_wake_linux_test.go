//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// current is the conversation's live launch, as its Pi's --current names it.
func (h *heldHarness) current(c *ConversationController, id string) string {
	h.t.Helper()
	c.mu.Lock()
	defer c.mu.Unlock()
	s := c.sessions[id]
	if s == nil || s.rpc == nil {
		h.t.Fatal("no live launch")
	}
	return "id=pi:" + id + "&workspace_id=" + s.workspace + "&generation=" + s.rpc.processGeneration + "&current=true"
}

func (h *heldHarness) agentWake(c *ConversationController, method, path, query, body string) (int, map[string]any) {
	h.t.Helper()
	target := "http://unix" + AgentWakesPath + path
	if query != "" {
		target += "?" + query
	}
	r := httptest.NewRequest(method, target, strings.NewReader(body))
	if body == "" {
		r = httptest.NewRequest(method, target, nil)
	}
	w := httptest.NewRecorder()
	c.agentWakes(w, r)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func errCode(out map[string]any) string {
	e, _ := out["error"].(map[string]any)
	code, _ := e["code"].(string)
	return code
}

func (h *heldHarness) storedWakes() []scheduledWake {
	h.t.Helper()
	value, err := readWakes(h.root)
	if err != nil {
		h.t.Fatal(err)
	}
	return value.Wakes
}

func future(d time.Duration) string { return time.Now().Add(d).UTC().Format(time.RFC3339) }

// The agent sets, lists, replays, moves and cancels its own conversation's
// wakes through its live launch; the person has a cap of 100 pending, and
// creating places the conversation in Hiljaiset while its turn runs.
func TestAgentWakeCommandsAndTheCap(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Muistuta torstaina", heldA)
	cur := h.current(c, id)
	body := func(at, note, key string) string {
		b, _ := json.Marshal(map[string]string{"at": at, "note": note, "idempotency_key": key})
		return strings.Replace(string(b), `,"idempotency_key":""`, "", 1)
	}
	for _, bad := range []string{
		body("2026-11-19T09:00:00", "muistuta", ""), // no offset: the zone would be guessed
		body(future(time.Hour), " ", ""),
		body(future(time.Hour), strings.Repeat("x", maxWakeNote+1), ""),
		body(future(time.Hour), "muistuta", "not-a-uuid"),
		`{"at":"` + future(time.Hour) + `","note":"x","extra":1}`,
	} {
		if code, _ := h.agentWake(c, "POST", "", cur, bad); code != 400 {
			t.Fatalf("%s: %d", bad, code)
		}
	}
	if code, out := h.agentWake(c, "POST", "", cur, body(future(-time.Minute), "muistuta", "")); code != 409 || errCode(out) != "wake_time_past" {
		t.Fatalf("past: %d %v", code, out)
	}
	// Another launch's context is not this conversation's agent.
	if code, _ := h.agentWake(c, "POST", "", "id=pi:"+id+"&workspace_id="+h.workspace+"&generation=00000000-0000-4000-8000-000000000000&current=true", body(future(time.Hour), "x", "")); code != 409 {
		t.Fatalf("stale launch: %d", code)
	}
	key := "11111111-1111-4111-8111-111111111111"
	at := future(48 * time.Hour)
	code, out := h.agentWake(c, "POST", "", cur, body(at, "muistuta poistamaan backup-2024", key))
	if code != 200 || out["replayed"] != false {
		t.Fatalf("create: %d %v", code, out)
	}
	made := out["wake"].(map[string]any)
	wakeID := made["id"].(string)
	// A lost reply is recovered by repeating the same key: the same wake.
	code, out = h.agentWake(c, "POST", "", cur, body(at, "muistuta poistamaan backup-2024", key))
	if code != 200 || out["replayed"] != true || out["wake"].(map[string]any)["id"] != wakeID {
		t.Fatalf("replay: %d %v", code, out)
	}
	if code, out := h.agentWake(c, "POST", "", cur, body(future(72*time.Hour), "muistuta poistamaan backup-2024", key)); code != 409 || errCode(out) != "idempotency_conflict" {
		t.Fatalf("conflict: %d %v", code, out)
	}
	info, err := os.Stat(filepath.Join(h.root, ".local/state/open-habitat/wakes.json"))
	if err != nil || info.Mode().Perm() != 0600 {
		t.Fatalf("wakes file: %v %v", err, info)
	}
	// The snapshot shows the pending wake on the conversation.
	value, _ := readWakes(h.root)
	if pending := snapshotWakes(value, "pi:"+id); len(pending) != 1 || pending[0]["id"] != wakeID {
		t.Fatalf("snapshot wakes: %v", pending)
	}
	// The person moves it: the agent's time is kept as moved_from.
	moved := future(96 * time.Hour)
	w := h.post(func(w http.ResponseWriter, r *http.Request) { c.personWake(w, r, id) }, `{"action":"move","wake_id":"`+wakeID+`","at":"`+moved+`"}`)
	if w.Code != 200 {
		t.Fatalf("person move: %d %s", w.Code, w.Body.String())
	}
	got := h.storedWakes()[0]
	if !got.at().Equal(mustTime(t, moved)) || !got.at().After(mustTime(t, at)) || got.MovedFrom == "" || !mustTime(t, got.MovedFrom).Equal(mustTime(t, at)) {
		t.Fatalf("moved: %+v", got)
	}
	// The agent cancels its own: nothing to tell it afterwards.
	if code, out := h.agentWake(c, "DELETE", "/"+wakeID, cur, ""); code != 200 || out["wake"].(map[string]any)["cancel_reason"] != "agent" {
		t.Fatalf("delete: %d %v", code, out)
	}
	if h.storedWakes()[0].Tell {
		t.Fatal("the agent's own cancel is told back to it")
	}
	if code, out := h.agentWake(c, "DELETE", "/"+wakeID, cur, ""); code != 409 || errCode(out) != "wake_not_pending" {
		t.Fatalf("second delete: %d %v", code, out)
	}
	// The cap: 100 pending for the whole person, whatever conversation.
	err = changeWakes(h.root, time.Now(), func(v *wakesFile) (bool, error) {
		for i := 0; i < maxPendingWakes; i++ {
			wid, _ := newWakeID()
			v.Wakes = append(v.Wakes, scheduledWake{ID: wid, AgentID: "pi:" + heldF, At: future(time.Duration(i+1) * time.Hour), Note: "muu", SetBy: "agent", SetAt: stamp(time.Now()), Status: "pending"})
		}
		return true, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if code, out := h.agentWake(c, "POST", "", cur, body(future(time.Hour), "yksi liikaa", "")); code != 409 || errCode(out) != "wake_limit_reached" {
		t.Fatalf("cap: %d %v", code, out)
	}
	// --all lists the person's every pending wake; --current only its own.
	if code, out := h.agentWake(c, "GET", "", "all=true", ""); code != 200 || len(out["wakes"].([]any)) != maxPendingWakes {
		t.Fatalf("list all: %d", code)
	}
	if code, out := h.agentWake(c, "GET", "", cur, ""); code != 200 || len(out["wakes"].([]any)) != 1 {
		t.Fatalf("list current: %d %v", code, out)
	}
}

func mustTime(t *testing.T, s string) time.Time {
	t.Helper()
	v, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		t.Fatal(err)
	}
	return v
}

// The daemon keeps one user timer on the next pending wake, restarts it when
// that changes, and removes it with the last pending wake.
func TestWakeTimerUnitFollowsTheNextWake(t *testing.T) {
	h := newHeldHarness(t)
	var mu sync.Mutex
	var calls []string
	env := &wakeTimerEnv{home: h.root, exe: "/opt/open-habitat/current/open-habitat", managerReady: func() bool { return true }, userManager: func(_ context.Context, args ...string) error {
		mu.Lock()
		defer mu.Unlock()
		calls = append(calls, strings.Join(args, " "))
		return nil
	}}
	first := time.Date(2030, 1, 2, 7, 0, 0, 0, time.UTC)
	if err := env.sync(context.Background(), first.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	unit := func(name string) string {
		b, _ := os.ReadFile(filepath.Join(h.root, ".config/systemd/user", name))
		return string(b)
	}
	if !strings.Contains(unit(wakeTimerUnit), "OnCalendar=2030-01-02 08:00:00 UTC\n") || !strings.Contains(unit(wakeTimerUnit), "Persistent=true") || !strings.Contains(unit(wakeTimerUnit), "OnStartupSec=") {
		t.Fatalf("timer: %s", unit(wakeTimerUnit))
	}
	if !strings.Contains(unit(wakeServiceUnit), "ExecStart=/opt/open-habitat/current/open-habitat agent wake due --json\n") {
		t.Fatalf("service: %s", unit(wakeServiceUnit))
	}
	if strings.Join(calls, "|") != "daemon-reload|enable "+wakeTimerUnit+"|restart "+wakeTimerUnit {
		t.Fatalf("calls: %v", calls)
	}
	// The same next wake changes nothing in the user manager.
	calls = nil
	if err := env.sync(context.Background(), first.Add(time.Hour)); err != nil || len(calls) != 0 {
		t.Fatalf("unchanged: %v %v", err, calls)
	}
	if err := env.sync(context.Background(), first); err != nil || !strings.Contains(unit(wakeTimerUnit), "OnCalendar=2030-01-02 07:00:00 UTC\n") || len(calls) != 3 {
		t.Fatalf("moved: %v %v", err, calls)
	}
	// A user manager that refused once is asked again, though the files
	// already match.
	fail := true
	env.userManager = func(_ context.Context, args ...string) error {
		mu.Lock()
		defer mu.Unlock()
		calls = append(calls, strings.Join(args, " "))
		if fail && args[0] == "enable" {
			return context.DeadlineExceeded
		}
		return nil
	}
	calls = nil
	later := first.Add(2 * time.Hour)
	if err := env.sync(context.Background(), later); err == nil {
		t.Fatal("a refused enable was reported as applied")
	}
	fail = false
	calls = nil
	if err := env.sync(context.Background(), later); err != nil || len(calls) != 3 {
		t.Fatalf("not retried after a refusal: %v %v", err, calls)
	}
	calls = nil
	if err := env.sync(context.Background(), time.Time{}); err != nil || unit(wakeTimerUnit) != "" || unit(wakeServiceUnit) != "" || calls[0] != "disable --now "+wakeTimerUnit {
		t.Fatalf("removed: %v %v", err, calls)
	}
	// Without a lingering user manager no timer is claimed.
	env.managerReady = func() bool { return false }
	if err := env.sync(context.Background(), first); err == nil {
		t.Fatal("timer written without a user manager")
	}
}

// A wake whose time passed while the daemon was down fires when the next
// daemon starts: its stopped Pi is started, the agent gets the wake turn
// with the lateness, and the wake fires once.
func TestOverdueWakeFiresOnceAfterARestartAndSaysLate(t *testing.T) {
	h := newHeldHarness(t)
	h.setFile("background", "1")
	h.setFile("background-state", "finished")
	c, stop := h.daemon()
	id := h.create(c)
	h.converse(c, id, "Muistuta huomenna", heldA)
	at := time.Now().Add(time.Hour).UTC().Truncate(time.Second)
	if _, status, code := c.createWake(agentConversationQuery{id: "pi:" + id, current: true}, at.Format(time.RFC3339), "tarkista varmuuskopio", ""); status != 0 {
		t.Fatalf("create: %d %s", status, code)
	}
	stop() // the daemon is down at the wake time
	launches := h.launchesOf(id)

	// The next incarnation starts three hours after the wake time.
	c2, stop2 := h.daemon()
	defer stop2()
	late := at.Add(3 * time.Hour)
	c2.wakeClock = func() time.Time { return late }
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go c2.watchScheduledWakes(ctx)
	h.eventually("overdue wake fired", func() bool {
		w := h.storedWakes()
		return len(w) == 1 && w[0].Status == "fired"
	})
	if h.launchesOf(id) != launches+1 {
		t.Fatalf("launches %d, want %d", h.launchesOf(id), launches+1)
	}
	var sent []map[string]any
	for _, line := range h.lines("scheduled.log") {
		var q map[string]any
		_ = json.Unmarshal([]byte(line), &q)
		sent = append(sent, q)
	}
	if len(sent) != 1 || sent[0]["session_id"] != id {
		t.Fatalf("scheduled wakes sent: %v", sent)
	}
	wake := sent[0]["wake"].(map[string]any)
	if wake["note"] != "tarkista varmuuskopio" || wake["late_seconds"] != float64(3*3600) {
		t.Fatalf("wake message: %v", wake)
	}
	got := h.storedWakes()[0]
	if got.LateSeconds != 3*3600 || got.FiredAt != stamp(late) {
		t.Fatalf("fired record: %+v", got)
	}
	// A fired wake leaves the snapshot: Habitat's line in the conversation
	// tells it, not the rail row.
	value, _ := readWakes(h.root)
	if pending := snapshotWakes(value, "pi:"+id); len(pending) != 0 {
		t.Fatalf("fired wake still in the snapshot: %v", pending)
	}
	// A later due check fires nothing again, and nothing pends: no timer.
	if fired, next := c2.processDueWakes(context.Background()); fired != 0 || !next.IsZero() {
		t.Fatalf("again: %d %v", fired, next)
	}
	if len(h.lines("scheduled.log")) != 1 {
		t.Fatal("fired twice")
	}
}

// A wake that comes due while the daemon runs fires from the in-process
// timer, into the live Pi, without a restart.
func TestDueWakeFiresIntoTheLivePi(t *testing.T) {
	h := newHeldHarness(t)
	h.setFile("background", "1")
	h.setFile("background-state", "finished")
	c, stop := h.daemon()
	defer stop()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go c.watchScheduledWakes(ctx)
	id := h.create(c)
	h.converse(c, id, "Palaa tähän pian", heldA)
	launches := h.launchesOf(id)
	at := time.Now().Add(1500 * time.Millisecond).UTC().Format(time.RFC3339Nano)
	if _, status, code := c.createWake(agentConversationQuery{id: "pi:" + id, current: true}, at, "palaa asiaan", ""); status != 0 {
		t.Fatalf("create: %d %s", status, code)
	}
	h.eventually("wake fired", func() bool { return len(h.lines("scheduled.log")) == 1 })
	h.eventually("recorded fired", func() bool { w := h.storedWakes(); return w[0].Status == "fired" && w[0].LateSeconds == 0 })
	if h.launchesOf(id) != launches {
		t.Fatal("a live Pi was started again")
	}
	var q map[string]any
	_ = json.Unmarshal([]byte(h.lines("scheduled.log")[0]), &q)
	if _, late := q["wake"].(map[string]any)["late_seconds"]; late {
		t.Fatalf("an on-time wake said late: %v", q)
	}
}

// Archiving cancels the conversation's pending wakes and the notice's undo
// brings them back; a later restore does not, and the agent hears of the
// cancellation with the person's next message, once.
func TestArchiveCancelsWakesUndoRestoresLaterRestoreTells(t *testing.T) {
	h := newHeldHarness(t)
	h.setFile("background", "1")
	h.setFile("background-state", "finished")
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Muistuta", heldA)
	at := future(48 * time.Hour)
	if _, status, code := c.createWake(agentConversationQuery{id: "pi:" + id, current: true}, at, "muistuta vuokrasopimuksesta", ""); status != 0 {
		t.Fatalf("create: %d %s", status, code)
	}
	change := func(archived, wakes bool) {
		t.Helper()
		sessions, _ := nativeSessions(c.nativeCfg())
		token := ""
		for _, n := range sessions {
			if n.id == id {
				token = archiveObservation(n)
			}
		}
		previous := "active"
		if !archived {
			previous = "archived"
		}
		// The turn's own writes may still be settling: archive waits for them.
		h.eventually("archive change", func() bool {
			w := httptest.NewRecorder()
			c.archiveInput(context.Background(), w, id, archiveRequest{WorkspaceID: h.workspace, Archived: archived, ObservationToken: token, PreviousArchive: previous, RestoreWakes: wakes})
			if w.Code == 409 && strings.Contains(w.Body.String(), "writer_conflict") {
				return false
			}
			if w.Code != 200 {
				t.Fatalf("archive change: %d %s", w.Code, w.Body.String())
			}
			return true
		})
		if archived {
			// The archive stops the idle Pi; a send meets it stopping until then.
			h.eventually("archived Pi stopped", func() bool { return h.stopped(c, id) })
		}
	}
	restore := func(wakes bool) { change(false, wakes) }
	h.quiescent(c, id)
	change(true, false)
	if w := h.storedWakes()[0]; w.Status != "cancelled" || w.CancelReason != "archived" || w.Tell {
		t.Fatalf("archived: %+v", w)
	}
	value, _ := readWakes(h.root)
	if pending := snapshotWakes(value, "pi:"+id); len(pending) != 0 {
		t.Fatal("an archived conversation still shows a pending wake")
	}
	restore(true) // the notice's undo
	if w := h.storedWakes()[0]; w.Status != "pending" || w.At != mustTime(t, at).UTC().Format(time.RFC3339Nano) {
		t.Fatalf("undo: %+v", w)
	}
	// ...and puts the conversation back in Hiljaiset to wait for it.
	if marks, _ := readTurnMarks(h.root); marks.Sections["pi:"+id].Section != "quiet" {
		t.Fatalf("undo left the conversation out of Hiljaiset: %+v", marks.Sections)
	}
	change(true, false)
	restore(false) // later, from the archive
	if w := h.storedWakes()[0]; w.Status != "cancelled" || !w.Tell {
		t.Fatalf("later restore: %+v", w)
	}
	if len(h.lines("tell.log")) != 0 {
		t.Fatal("told before the person wrote")
	}
	h.converse(c, id, "Jatketaan", heldB)
	tells := h.lines("tell.log")
	if len(tells) != 1 {
		t.Fatalf("tells: %v", tells)
	}
	var q struct {
		SessionID string           `json:"session_id"`
		Cancelled []map[string]any `json:"cancelled"`
	}
	_ = json.Unmarshal([]byte(tells[0]), &q)
	if q.SessionID != id || len(q.Cancelled) != 1 || q.Cancelled[0]["reason"] != "archived" || q.Cancelled[0]["note"] != "muistuta vuokrasopimuksesta" {
		t.Fatalf("told: %s", tells[0])
	}
	h.eventually("tell cleared", func() bool { return !h.storedWakes()[0].Tell })
	h.converse(c, id, "Vielä", heldC)
	if len(h.lines("tell.log")) != 1 {
		t.Fatal("told twice")
	}
	// The undo never revives a wake the agent was already told is gone.
	change(true, false)
	restore(true)
	if w := h.storedWakes()[0]; w.Status != "cancelled" {
		t.Fatalf("revived after telling: %+v", w)
	}
}

// The person's line is built from the native message's details only; the
// agent's English text never reaches it.
func TestWakeLineProjectsDetailsNotText(t *testing.T) {
	entry := func(customType string, details map[string]any) nativeEntry {
		raw, _ := json.Marshal(map[string]any{"type": "custom_message", "customType": customType, "display": true, "content": "[Open Habitat] agent text", "details": details})
		return nativeEntry{Type: "custom_message", ID: "e1", Raw: raw}
	}
	got, ok := nativeWakeLine(entry(scheduledWakeMessageType, map[string]any{"schema_version": 1, "id": "wk_0123456789abcdef", "at": "2026-11-19T07:00:00Z", "set_at": "2026-11-17T13:12:00Z", "fired_at": "2026-11-19T10:36:00Z", "late_seconds": 12960, "note": "muistuta"}))
	if !ok || got.ScheduledWake == nil || got.ScheduledWake.Kind != "fired" || got.ScheduledWake.Wakes[0].LateSeconds != 12960 {
		t.Fatalf("fired: %+v", got)
	}
	b, _ := json.Marshal(got)
	if bytes.Contains(b, []byte("agent text")) {
		t.Fatalf("agent text reached the person's line: %s", b)
	}
	got, ok = nativeWakeLine(entry(wakeCancelMessageType, map[string]any{"schema_version": 1, "cancelled": []any{map[string]any{"id": "wk_0123456789abcdef", "at": "2026-11-19T07:00:00Z", "note": "muistuta", "reason": "archived", "cancelled_at": "2026-11-17T13:40:00Z"}, map[string]any{"at": "nonsense", "note": "x", "reason": "archived", "cancelled_at": "2026-11-17T13:40:00Z"}}}))
	if !ok || got.ScheduledWake == nil || got.ScheduledWake.Kind != "cancelled" || len(got.ScheduledWake.Wakes) != 1 {
		t.Fatalf("cancelled: %+v", got)
	}
	// A malformed fired wake is recognised (kept out of the agent text
	// path) but shows nothing.
	got, ok = nativeWakeLine(entry(scheduledWakeMessageType, map[string]any{"at": "2026-11-19T07:00:00Z", "note": ""}))
	if !ok || got.ScheduledWake != nil {
		t.Fatalf("malformed: %+v", got)
	}
}

// A wake the person cancels or moves while an earlier due wake is being
// delivered is not sent from the stale list, and a busy Pi's wake waits
// without spending its retries.
func TestDueWakesAreReadAgainBeforeEachDelivery(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	now := time.Now()
	ids := make([]string, 3)
	if err := changeWakes(h.root, now, func(v *wakesFile) (bool, error) {
		for i := range ids {
			ids[i], _ = newWakeID()
			v.Wakes = append(v.Wakes, scheduledWake{ID: ids[i], AgentID: "pi:" + []string{heldA, heldB, heldC}[i], At: stamp(now.Add(time.Duration(i-10) * time.Minute)), Note: "muistuta", SetBy: "agent", SetAt: stamp(now.Add(-time.Hour)), Status: "pending"})
		}
		return true, nil
	}); err != nil {
		t.Fatal(err)
	}
	var sent []string
	c.wakeDeliver = func(w scheduledWake, _ int64) (string, bool) {
		sent = append(sent, w.ID)
		switch w.ID {
		case ids[0]:
			// The person cancels the second and moves the third meanwhile.
			if _, status, code := c.cancelWake("pi:"+heldB, ids[1], "person"); status != 0 {
				t.Fatalf("cancel: %s", code)
			}
			later := future(time.Hour)
			if _, status, code := c.changeWake("pi:"+heldC, ids[2], &later, nil, true); status != 0 {
				t.Fatalf("move: %s", code)
			}
		}
		return "", false
	}
	if fired, _ := c.processDueWakes(context.Background()); fired != 1 || len(sent) != 1 {
		t.Fatalf("fired %d, sent %v", fired, sent)
	}
	got := map[string]scheduledWake{}
	for _, w := range h.storedWakes() {
		got[w.ID] = w
	}
	if got[ids[0]].Status != "fired" || got[ids[1]].Status != "cancelled" || got[ids[2]].Status != "pending" || got[ids[2]].MovedFrom == "" {
		t.Fatalf("after: %+v", got)
	}
	// A busy Pi: the wake waits a minute and keeps its retries.
	c.wakeDeliver = func(scheduledWake, int64) (string, bool) { return "busy", true }
	c.wakeClock = func() time.Time { return now.Add(2 * time.Hour) }
	c.processDueWakes(context.Background())
	if w := h.storedWakes(); func() scheduledWake {
		for _, x := range w {
			if x.ID == ids[2] {
				return x
			}
		}
		return scheduledWake{}
	}().Attempts != 0 {
		t.Fatalf("a busy turn spent a retry: %+v", w)
	}
}

// Whatever the mix of pending wakes, cancellations still to tell and
// history, a saved file is one the next read accepts.
func TestSavedWakesAlwaysReadBack(t *testing.T) {
	h := newHeldHarness(t)
	now := time.Now()
	var v wakesFile
	add := func(n int, status string, tell bool) {
		for i := 0; i < n; i++ {
			id, _ := newWakeID()
			w := scheduledWake{ID: id, AgentID: "pi:" + heldA, At: stamp(now.Add(time.Hour)), Note: "x", SetBy: "agent", SetAt: stamp(now), Status: status, Tell: tell}
			if status == "cancelled" {
				w.CancelReason, w.CancelledAt = "person", stamp(now)
			}
			if status == "fired" {
				w.FiredAt = stamp(now)
			}
			v.Wakes = append(v.Wakes, w)
		}
	}
	add(maxPendingWakes, "pending", false)
	add(150, "cancelled", true)
	add(maxWakeRecords, "fired", false)
	if err := saveWakes(h.root, v, now); err != nil {
		t.Fatal(err)
	}
	back, err := readWakes(h.root)
	if err != nil {
		t.Fatalf("a saved file does not read back: %v", err)
	}
	pending, tell := 0, 0
	for _, w := range back.Wakes {
		if w.Status == "pending" {
			pending++
		}
		if w.Tell {
			tell++
		}
	}
	if pending != maxPendingWakes || tell != maxPendingWakes {
		t.Fatalf("pending %d, to tell %d", pending, tell)
	}
}
