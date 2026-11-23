//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/upgradenotice"
)

func (h *heldHarness) upgradeAsks() []map[string]any {
	var out []map[string]any
	for _, line := range h.lines("upgrade.log") {
		var q map[string]any
		if json.Unmarshal([]byte(line), &q) == nil {
			out = append(out, q)
		}
	}
	return out
}

// appendBranch writes entries onto a conversation's native branch, as a
// stopped Pi left them.
func (h *heldHarness) appendBranch(c *ConversationController, id string, entries ...map[string]any) {
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
		f, err := os.OpenFile(n.path, os.O_APPEND|os.O_WRONLY, 0)
		if err != nil {
			h.t.Fatal(err)
		}
		parent := last.ID
		for i, e := range entries {
			id := "ab" + strings.Repeat("0", 5) + string(rune('a'+i))
			e["id"], e["parentId"], e["timestamp"] = id, parent, time.Now().UTC().Format(time.RFC3339Nano)
			parent = id
			line, _ := json.Marshal(e)
			_, _ = f.Write(append(line, '\n'))
		}
		_ = f.Close()
		return
	}
	h.t.Fatal("native history not found")
}

func upgradeRecord(now time.Time, lead time.Duration) upgradenotice.Record {
	return upgradenotice.Record{SchemaVersion: 1, ScheduleID: strings.Repeat("c", 32), Revision: 1, TargetVersion: "0.9.0", AnnouncedAt: now, Deadline: now.Add(lead), State: upgradenotice.Announced, RenewedAt: now}
}

// The announcement reaches each live conversation once, is counted for the
// host, shows in the browser's snapshot and starts no resting Pi.
func TestUpgradeNoticeReachesLiveConversationsOnce(t *testing.T) {
	h := newHeldHarness(t)
	h.setFile("background", "1")
	h.setFile("background-state", "finished")
	c, stop := h.daemon()
	defer stop()
	live := h.create(c)
	h.converse(c, live, "Työskentele", activityCommand(1))
	h.quiescent(c, live)
	resting := h.create(c)
	h.converse(c, resting, "Valmis", activityCommand(2))
	h.quiescent(c, resting)
	if w := h.post(func(w http.ResponseWriter, r *http.Request) { c.stop(w, r, resting) }, ""); w.Code != 200 {
		t.Fatalf("stop: %d", w.Code)
	}
	h.eventually("stopped", func() bool { return h.stopped(c, resting) })
	launches := h.launchesOf(resting)

	now := time.Now()
	rec := upgradeRecord(now, 2*time.Minute)
	var readErr error
	c.upgradeRead = func(string) (upgradenotice.Record, error) { return rec, readErr }
	if c.upgradeCensus() != nil || c.upgradeView() != nil {
		t.Fatal("a schedule before any was read")
	}
	c.refreshUpgrade(context.Background(), now)
	asks := h.upgradeAsks()
	if len(asks) != 1 || asks[0]["op"] != "upgrade_notice" || asks[0]["session_id"] != live {
		t.Fatalf("asks %v", asks)
	}
	notice, _ := asks[0]["notice"].(map[string]any)
	if notice["schedule_id"] != rec.ScheduleID || notice["version"] != "0.9.0" || notice["revision"] != float64(1) {
		t.Fatalf("notice %v", notice)
	}
	if h.launchesOf(resting) != launches {
		t.Fatal("a resting conversation was started to be told")
	}
	census := c.upgradeCensus()
	if census["told"] != 1 || census["held"] != 0 || census["schedule_id"] != rec.ScheduleID {
		t.Fatalf("census %v", census)
	}
	if v := c.upgradeView(); v["status"] != "countdown" || v["deadline"] != rec.Deadline.UTC().Format(time.RFC3339) {
		t.Fatalf("view %v", v)
	}
	c.refreshUpgrade(context.Background(), now.Add(5*time.Second))
	if len(h.upgradeAsks()) != 1 {
		t.Fatal("told twice")
	}
	// The deadline passed under a live owner: nothing more is told, the
	// browser reads "starting".
	rec.RenewedAt = now.Add(170 * time.Second)
	c.refreshUpgrade(context.Background(), now.Add(3*time.Minute))
	if v := c.upgradeView(); v["status"] != "starting" || len(h.upgradeAsks()) != 1 {
		t.Fatalf("view %v", v)
	}
	// A record it cannot trust is no schedule at all.
	readErr = upgradenotice.ErrUntrusted
	c.refreshUpgrade(context.Background(), now)
	if c.upgradeView() != nil || c.upgradeCensus() != nil {
		t.Fatal("an untrusted record was read as a schedule")
	}
	readErr = os.ErrNotExist
	c.refreshUpgrade(context.Background(), now)
	if c.upgradeView() != nil {
		t.Fatal("a missing record was read as a schedule")
	}
}

// An idle agent with nothing to lose holds the announcement; the daemon asks
// again until it is given, and a withdrawal takes it back.
func TestHeldUpgradeNoticeIsWithdrawnWithTheSchedule(t *testing.T) {
	h := newHeldHarness(t)
	h.setFile("background", "1")
	h.setFile("background-state", "finished")
	h.setFile("upgrade-outcome", "held")
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Työskentele", activityCommand(1))
	h.quiescent(c, id)
	now := time.Now()
	rec := upgradeRecord(now, 2*time.Minute)
	c.upgradeRead = func(string) (upgradenotice.Record, error) { return rec, nil }
	c.refreshUpgrade(context.Background(), now)
	c.refreshUpgrade(context.Background(), now.Add(5*time.Second))
	if n := len(h.upgradeAsks()); n != 2 {
		t.Fatalf("a held announcement was not asked after: %d", n)
	}
	if census := c.upgradeCensus(); census["held"] != 1 || census["told"] != 0 {
		t.Fatalf("census %v", census)
	}
	// A steer a long tool holds is not delivered until it reaches the model.
	h.setFile("upgrade-outcome", "queued")
	c.refreshUpgrade(context.Background(), now.Add(7*time.Second))
	if census := c.upgradeCensus(); census["not_delivered"] != 1 || census["told"] != 0 || len(h.upgradeAsks()) != 3 {
		t.Fatalf("census %v", census)
	}
	h.setFile("upgrade-outcome", "held")
	c.refreshUpgrade(context.Background(), now.Add(8*time.Second))
	rec.State, rec.RenewedAt = upgradenotice.Withdrawn, now.Add(10*time.Second)
	if n := len(h.upgradeAsks()); n != 4 {
		t.Fatalf("asks before the withdrawal: %d", n)
	}
	c.refreshUpgrade(context.Background(), now.Add(10*time.Second))
	asks := h.upgradeAsks()
	if last := asks[len(asks)-1]; last["op"] != "upgrade_notice_withdraw" || last["schedule_id"] != rec.ScheduleID {
		t.Fatalf("asks %v", asks)
	}
	if v := c.upgradeView(); v["status"] != "withdrawn" {
		t.Fatalf("view %v", v)
	}
	// An owner that stopped renewing reads as unknown, never "starting".
	rec.State, rec.RenewedAt = upgradenotice.Announced, now
	c.refreshUpgrade(context.Background(), now.Add(3*time.Minute))
	if v := c.upgradeView(); v["status"] != "unknown" {
		t.Fatalf("view %v", v)
	}
}

// After a graceful daemon restart, the turn it cut is woken with the
// version the daemon now runs; a finished conversation and one the person
// stopped are not.
func TestRestartCutTurnIsWokenAndOnlyIt(t *testing.T) {
	h := newHeldHarness(t)
	h.setFile("background", "1")
	h.setFile("background-state", "finished")
	first, stopFirst := h.daemon()
	cut := h.create(first)
	h.converse(first, cut, "Tee työ", activityCommand(1))
	h.quiescent(first, cut)
	finished := h.create(first)
	h.converse(first, finished, "Valmis", activityCommand(2))
	h.quiescent(first, finished)
	stopped := h.create(first)
	h.converse(first, stopped, "Pysäytä", activityCommand(3))
	h.quiescent(first, stopped)
	stopFirst()
	h.eventually("first incarnation's Pi reaped", func() bool {
		first.mu.Lock()
		defer first.mu.Unlock()
		return first.sessions[cut].dead && first.sessions[finished].dead && first.sessions[stopped].dead
	})
	ms := time.Now().UnixMilli()
	prompt := func() map[string]any {
		return map[string]any{"type": "message", "message": map[string]any{"role": "user", "content": "jatka", "timestamp": ms}}
	}
	call := func() map[string]any {
		return map[string]any{"type": "message", "message": map[string]any{"role": "assistant", "content": []any{}, "stopReason": "toolUse", "timestamp": ms}}
	}
	aborted := func() map[string]any {
		return map[string]any{"type": "message", "message": map[string]any{"role": "assistant", "content": []any{}, "stopReason": "aborted", "timestamp": ms}}
	}
	mark := func() map[string]any {
		return map[string]any{"type": "custom", "customType": restartStopType, "data": map[string]any{"schema_version": 1}}
	}
	h.appendBranch(first, cut, prompt(), call(), mark(), aborted())
	h.appendBranch(first, stopped, prompt(), call(), aborted())
	c, stop := h.daemon()
	defer stop()
	c.setVersion("0.9.0")
	c.wakeWaitingRests(context.Background(), time.Now())
	w := h.wakes()
	if len(w) != 1 || w[0]["reason"] != "turn_cut" || w[0]["session_id"] != cut || w[0]["version"] != "0.9.0" {
		t.Fatalf("wakes: %v", w)
	}
	if h.live(c, finished) || h.live(c, stopped) {
		t.Fatal("woke a conversation the restart did not cut")
	}
	c.wakeWaitingRests(context.Background(), time.Now().Add(time.Minute))
	if len(h.wakes()) != 1 {
		t.Fatal("woken twice")
	}
}

func TestBranchScanTellsARestartCutFromOtherStops(t *testing.T) {
	line := func(v map[string]any) string { b, _ := json.Marshal(v); return string(b) }
	n := 0
	entry := func(v map[string]any) string {
		n++
		v["id"] = "e000000" + string(rune('a'+n))
		if n > 1 {
			v["parentId"] = "e000000" + string(rune('a'+n-1))
		}
		v["timestamp"] = "2026-11-23T12:00:00Z"
		return line(v)
	}
	msg := func(role, stop string) map[string]any {
		return map[string]any{"type": "message", "message": map[string]any{"role": role, "stopReason": stop}}
	}
	mark := func() map[string]any { return map[string]any{"type": "custom", "customType": restartStopType} }
	catchUp := func() map[string]any {
		return map[string]any{"type": "custom_message", "customType": catchUpMessageType, "details": map[string]any{}}
	}
	for _, tc := range []struct {
		name    string
		entries []map[string]any
		want    bool
	}{
		{"aborted after the mark", []map[string]any{msg("user", ""), msg("assistant", "toolUse"), mark(), msg("toolResult", ""), msg("assistant", "aborted")}, true},
		{"Pi died after the mark", []map[string]any{msg("user", ""), msg("assistant", "toolUse"), mark()}, true},
		{"crash leaves no mark", []map[string]any{msg("user", ""), msg("assistant", "toolUse")}, false},
		{"the person's stop", []map[string]any{msg("user", ""), msg("assistant", "aborted")}, false},
		{"finished", []map[string]any{msg("user", ""), msg("assistant", "stop")}, false},
		{"woken and finished", []map[string]any{msg("user", ""), mark(), msg("assistant", "aborted"), catchUp(), msg("assistant", "stop")}, false},
		{"told, then Pi ended", []map[string]any{msg("user", ""), mark(), msg("assistant", "aborted"), catchUp()}, false},
		{"the person stopped it afterwards", []map[string]any{msg("user", ""), mark(), msg("assistant", "aborted"), {"type": "custom", "customType": personStopType}}, false},
	} {
		n = 0
		var lines []string
		for _, e := range tc.entries {
			lines = append(lines, entry(e))
		}
		if got := scanBranch([]byte(strings.Join(lines, "\n") + "\n")).restartCut; got != tc.want {
			t.Errorf("%s: restartCut %v", tc.name, got)
		}
	}
}

func TestCensusCarriesTheAnnouncementsReach(t *testing.T) {
	c := &ConversationController{sessions: map[string]*conversation{}}
	now := time.Now()
	rec := upgradeRecord(now, 2*time.Minute)
	c.upgradeRead = func(string) (upgradenotice.Record, error) { return rec, nil }
	c.refreshUpgrade(context.Background(), now)
	got := c.census(context.Background(), nil)
	n, ok := got["upgrade_notice"].(map[string]any)
	if !ok || n["schedule_id"] != rec.ScheduleID || n["told"] != 0 {
		t.Fatalf("%v", got)
	}
	c.upgradeRead = func(string) (upgradenotice.Record, error) { return upgradenotice.Record{}, errors.New("gone") }
	c.refreshUpgrade(context.Background(), now)
	if _, ok := c.census(context.Background(), nil)["upgrade_notice"]; ok {
		t.Fatal("reach without a schedule")
	}
}

func TestHistoryShowsTheAnnouncementAsHabitatsLine(t *testing.T) {
	raw := json.RawMessage(`{"type":"custom_message","customType":"oh-upgrade-notice","display":true,"content":"x","details":{"schema_version":1,"schedule_id":"` + strings.Repeat("a", 32) + `","revision":1,"version":"0.9.0","deadline":"2026-11-23T12:02:00Z","variant":"idle","processes":[{"id":"proc_0a1b","name":"dev"},{"id":"bad","name":"x"}]}}`)
	e, ok := nativeUpgradeNotice(nativeEntry{ID: "c", Type: "custom_message", Raw: raw})
	if !ok || e.UpgradeNotice == nil || e.UpgradeNotice.Version != "0.9.0" || e.UpgradeNotice.Variant != "idle" || len(e.UpgradeNotice.Processes) != 1 || e.Content.Text != "" {
		t.Fatalf("%+v", e.UpgradeNotice)
	}
	bad := json.RawMessage(strings.Replace(string(raw), `"idle"`, `"later"`, 1))
	if e, ok := nativeUpgradeNotice(nativeEntry{ID: "c", Type: "custom_message", Raw: bad}); !ok || e.UpgradeNotice != nil {
		t.Fatal("an unknown variant was shown")
	}
	raw = json.RawMessage(`{"type":"custom_message","customType":"oh-resume-catch-up","display":true,"content":"x","details":{"stopped":{"cause":"restart","at":"2026-11-23T12:03:10Z"},"woke":"turn_cut","interrupted_turn":true,"processes":[],"spinoffs":[]}}`)
	if r, _ := nativeRestart(nativeEntry{ID: "c", Type: "custom_message", Raw: raw}); r.Restart == nil || r.Restart.Woke != "turn_cut" || !r.Restart.InterruptedTurn {
		t.Fatalf("%+v", r.Restart)
	}
}
