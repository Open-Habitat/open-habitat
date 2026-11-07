//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"
)

func activityCommand(n int) string { return fmt.Sprintf("bbbbbbbb-0000-4000-8000-%012d", n) }

func (h *heldHarness) live(c *ConversationController, id string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	s := c.sessions[id]
	return s != nil && liveChild(s)
}

// converse sends one message and waits until Pi has answered it and is idle.
func (h *heldHarness) converse(c *ConversationController, id, text, command string) {
	h.t.Helper()
	if w := h.send(c, id, text, command); w.Code != 200 {
		h.t.Fatalf("send %q: %d %s", text, w.Code, w.Body.String())
	}
	h.eventually("turn of "+text+" settled", func() bool {
		_, v := h.status(c, id)
		return h.receipt(c, id, command) == "accepted" && v.State == "idle"
	})
}

// deletion runs the workspace deletion handler on the harness's own
// controller, against a synthetic /proc that holds no foreign processes.
func (h *heldHarness) deletion(c *ConversationController, action string) (int, map[string]any) {
	h.t.Helper()
	token := ""
	for _, w := range Discover(h.cfg).Entries {
		if w.Name == "project" {
			token = workspaceToken(h.cfg, w)
		}
	}
	input := map[string]any{"action": action, "workspace_id": h.workspace, "observation_token": token}
	if action == "delete" {
		input["disposal"] = "trash"
	}
	b, _ := json.Marshal(input)
	r := httptest.NewRequest("POST", "http://unix"+WorkspacePath, bytes.NewReader(b))
	r.RequestURI = WorkspacePath
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	WorkspaceHandlerWithArchive(h.cfg, func(*http.Request) bool { return true }, c).ServeHTTP(w, r)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func (h *heldHarness) deletable() {
	h.t.Helper()
	// Not the person's last workspace, and no real /proc scan.
	if err := os.MkdirAll(filepath.Join(h.root, "src", "toinen"), 0700); err != nil {
		h.t.Fatal(err)
	}
	old := deletionProcRoot
	deletionProcRoot = h.t.TempDir()
	h.t.Cleanup(func() { deletionProcRoot = old })
}

// Idle conversations do not fill the limit: one start more stops the
// longest unused idle Pi. Its history stays, and its next message resumes it,
// which in turn stops the then longest unused one.
func TestIdleConversationsYieldTheirPlace(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	var ids []string
	for i := 0; i < heldLiveLimit; i++ {
		id := h.create(c)
		h.converse(c, id, fmt.Sprintf("Viesti %d", i), activityCommand(i))
		ids = append(ids, id)
	}
	fifth := h.create(c)
	if h.live(c, ids[0]) {
		t.Fatal("the longest unused idle Pi still runs after a fifth start")
	}
	for _, id := range ids[1:] {
		if !h.live(c, id) {
			t.Fatalf("an idle Pi other than the longest unused one was stopped: %s", id)
		}
	}
	h.eventually("fifth ready", func() bool { _, v := h.status(c, fifth); return v.State == "idle" })

	h.converse(c, ids[0], "Jatketaan", activityCommand(10))
	if h.live(c, ids[1]) || !h.live(c, ids[0]) {
		t.Fatalf("resume did not take the longest unused place: first live %v, second live %v", h.live(c, ids[0]), h.live(c, ids[1]))
	}
	launches := 0
	for _, l := range h.lines("launches.log") {
		if l == ids[0] {
			launches++
		}
	}
	if launches != 2 {
		t.Fatalf("first conversation launched %d times, want a fresh start and one resume", launches)
	}
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		t.Fatal(err)
	}
	for _, n := range sessions {
		if n.id == ids[0] {
			b, _ := os.ReadFile(n.path)
			if !strings.Contains(string(b), "Viesti 0") || !strings.Contains(string(b), "Jatketaan") {
				t.Fatalf("native history lost a message across the stop: %s", b)
			}
			return
		}
	}
	t.Fatal("native history of the stopped conversation not found")
}

// A turn in progress holds its place and blocks deletion, naming the
// conversation; once the turns end, the fifth start and deletion go through
// without archiving anything, and deletion stops the idle Pi it found.
func TestBusyConversationsHoldPlacesAndBlockDeletion(t *testing.T) {
	h := newHeldHarness(t)
	h.deletable()
	c, stop := h.daemon()
	defer stop()
	h.setFile("prompt-hold", "1")
	var ids []string
	for i := 0; i < heldLiveLimit; i++ {
		id := h.create(c)
		h.eventually("ready", func() bool { _, v := h.status(c, id); return v.State == "idle" })
		if w := h.send(c, id, fmt.Sprintf("Pitkä työ %d", i), activityCommand(i)); w.Code != 200 {
			t.Fatalf("send: %d %s", w.Code, w.Body.String())
		}
		h.eventually("turn running", func() bool {
			c.mu.Lock()
			defer c.mu.Unlock()
			return c.sessions[id].runActive
		})
		ids = append(ids, id)
	}
	w := h.post(c.create, fmt.Sprintf(`{"workspace_id":%q}`, h.workspace))
	if w.Code != 429 || !strings.Contains(w.Body.String(), "capacity_exceeded") {
		t.Fatalf("a fifth start beside four running turns: %d %s", w.Code, w.Body.String())
	}
	for _, id := range ids {
		if !h.live(c, id) {
			t.Fatalf("a running turn was stopped to make room: %s", id)
		}
	}
	for _, action := range []string{"delete_check", "delete"} {
		code, body := h.deletion(c, action)
		blockers, _ := body["blockers"].([]any)
		named := map[string]bool{}
		for _, raw := range blockers {
			b := raw.(map[string]any)
			if b["kind"] == "pi_session" && b["activity"] == "turn" {
				named[b["agent_id"].(string)] = true
			}
		}
		if code != 200 || body["outcome"] != "blocked" || len(named) != len(ids) {
			t.Fatalf("%s beside running turns: %d %v", action, code, body)
		}
		for _, id := range ids {
			if !named["pi:"+id] {
				t.Fatalf("%s does not name %s: %v", action, id, body)
			}
		}
	}

	h.setFile("prompt-hold", "")
	for i, id := range ids {
		h.eventually("turn settled", func() bool { return h.receipt(c, id, activityCommand(i)) == "accepted" })
		// State becomes idle before native history publication (and automatic
		// naming) finishes. Those operations legitimately still block deletion.
		h.quiescent(c, id)
	}
	if code, body := h.deletion(c, "delete_check"); code != 200 || body["outcome"] != "trash" {
		t.Fatalf("idle conversations block the check: %d %v", code, body)
	}
	for _, id := range ids {
		if !h.live(c, id) {
			t.Fatal("a check that changes nothing stopped an idle Pi")
		}
	}
	if code, body := h.deletion(c, "delete"); code != 200 || body["state"] != "trashed" {
		t.Fatalf("deletion beside idle conversations: %d %v", code, body)
	}
	for _, id := range ids {
		if h.live(c, id) {
			t.Fatalf("an idle Pi still runs in the trashed workspace: %s", id)
		}
	}
}

func (h *heldHarness) archive(c *ConversationController, id string) {
	h.t.Helper()
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		h.t.Fatal(err)
	}
	token := ""
	for _, n := range sessions {
		if n.id == id {
			token = archiveObservation(n)
		}
	}
	w := httptest.NewRecorder()
	c.archiveInput(context.Background(), w, id, archiveRequest{WorkspaceID: h.workspace, Archived: true, ObservationToken: token, PreviousArchive: "active"})
	if w.Code != 200 {
		h.t.Fatalf("archive: %d %s", w.Code, w.Body.String())
	}
}

// An idle conversation's Pi holds no place once archived. A Pi whose
// background process still runs is busy: archive, the limit and deletion
// leave it running, since stopping Pi would stop the process too.
func TestArchiveStopsIdlePiButNotBackgroundWork(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Arkistoitava", activityCommand(1))
	h.archive(c, id)
	h.eventually("archived idle Pi stopped", func() bool { return !h.live(c, id) })
	c.mu.Lock()
	cause := c.sessions[id].stopCause
	c.mu.Unlock()
	if cause != "person" {
		t.Fatalf("archive stop reported as %q", cause)
	}

	h.setFile("background", "1")
	working := h.create(c)
	h.converse(c, working, "Käynnistä käännös taustalle", activityCommand(2))
	h.setFile("background", "")
	h.archive(c, working)
	c.stopIfIdle(context.Background(), working) // what archive started, done synchronously
	busy := c.busySessions(context.Background(), filepath.Join(h.root, "src", "project"))
	if !h.live(c, working) || len(busy) != 1 || busy[0] != (busyConversation{"pi:" + working, "processes"}) {
		t.Fatalf("background work: live %v, busy %v", h.live(c, working), busy)
	}
	for i := 0; i < heldLiveLimit-1; i++ {
		h.create(c)
	}
	if w := h.post(c.create, fmt.Sprintf(`{"workspace_id":%q}`, h.workspace)); !h.live(c, working) {
		t.Fatalf("a start stopped a Pi with background work: %d", w.Code)
	}
}

// The production limit protects only the host: a person runs clearly more
// than ten turns at once, none stopped to make room for another.
func TestMoreThanTenConversationsWorkAtOnce(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	c.mu.Lock()
	c.maxLive = 0
	c.mu.Unlock()
	noLiveLimits(t)
	h.setFile("prompt-hold", "1")
	var ids []string
	for i := 0; i < 12; i++ {
		id := h.create(c)
		h.eventually("ready", func() bool { _, v := h.status(c, id); return v.State == "idle" })
		if w := h.send(c, id, fmt.Sprintf("Pitkä työ %d", i), activityCommand(i)); w.Code != 200 {
			t.Fatalf("send %d: %d %s", i, w.Code, w.Body.String())
		}
		h.eventually("turn running", func() bool {
			c.mu.Lock()
			defer c.mu.Unlock()
			return c.sessions[id].runActive
		})
		ids = append(ids, id)
	}
	for _, id := range ids {
		if !h.live(c, id) {
			t.Fatalf("a running turn was stopped below the host limit: %s", id)
		}
	}
}

// noLiveLimits makes root's live-limits file absent for one test.
func noLiveLimits(t *testing.T) {
	setLiveLimits(t, "")
}

// setLiveLimits stands in for root's live-limits file; "" is absent.
func setLiveLimits(t *testing.T, file string) {
	original := readLiveLimits
	readLiveLimits = func() ([]byte, error) {
		if file == "" {
			return nil, os.ErrNotExist
		}
		return []byte(file), nil
	}
	t.Cleanup(func() { readLiveLimits = original })
}

type capacityView struct {
	Limit   int    `json:"limit"`
	Source  string `json:"source"`
	Holding []struct {
		AgentID     string `json:"agent_id"`
		WorkspaceID string `json:"workspace_id"`
		Activity    string `json:"activity"`
	} `json:"holding"`
}

func (h *heldHarness) capacity(c *ConversationController) capacityView {
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/api/v1/conversations/capacity", nil)
	r.Host = "unix"
	c.ServeHTTP(w, r)
	var v capacityView
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &v) != nil {
		h.t.Fatalf("capacity: %d %s", w.Code, w.Body.String())
	}
	return v
}

// The administrator's limit reaches the daemon only as root's file: this
// person's exception wins over the installation's limit, a change applies to
// the next start, and the refused person can read what holds the places.
func TestAdministratorLimitFromRootFile(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	c.mu.Lock()
	c.maxLive = 0
	c.mu.Unlock()
	uid := strconv.Itoa(os.Getuid())
	setLiveLimits(t, `{"version":1,"default":5,"people":{"`+uid+`":2}}`)
	h.setFile("prompt-hold", "1")
	var ids []string
	for i := 0; i < 2; i++ {
		id := h.create(c)
		h.eventually("ready", func() bool { _, v := h.status(c, id); return v.State == "idle" })
		if w := h.send(c, id, fmt.Sprintf("Työ %d", i), activityCommand(i)); w.Code != 200 {
			t.Fatalf("send %d: %d", i, w.Code)
		}
		h.eventually("turn running", func() bool {
			c.mu.Lock()
			defer c.mu.Unlock()
			return c.sessions[id].runActive
		})
		ids = append(ids, id)
	}
	if w := h.post(c.create, fmt.Sprintf(`{"workspace_id":%q}`, h.workspace)); w.Code != 429 || !strings.Contains(w.Body.String(), "capacity_exceeded") {
		t.Fatalf("own limit 2 not enforced: %d %s", w.Code, w.Body.String())
	}
	v := h.capacity(c)
	if v.Limit != 2 || v.Source != "own" || len(v.Holding) != 2 {
		t.Fatalf("capacity: %+v", v)
	}
	for _, x := range v.Holding {
		if x.Activity != "turn" || x.WorkspaceID != h.workspace || !slices.Contains(ids, strings.TrimPrefix(x.AgentID, "pi:")) {
			t.Fatalf("holder: %+v", x)
		}
	}
	// Without the exception the installation's limit applies to the next start.
	setLiveLimits(t, `{"version":1,"default":3}`)
	if v = h.capacity(c); v.Limit != 3 || v.Source != "installation" {
		t.Fatalf("installation: %+v", v)
	}
	h.create(c)
	// A file root did not write cleanly is the daemon's own default.
	setLiveLimits(t, `{"version":1,"default":999}`)
	if v = h.capacity(c); v.Limit != 32 || v.Source != "default" {
		t.Fatalf("broken file: %+v", v)
	}
}

// The definition itself: everything the controller knows in memory that makes
// a conversation busy. A plausible wrong definition (runActive alone, or any
// live child) fails one of these rows.
func heldActivityCases() []struct {
	name string
	s    conversation
	want string
} {
	return []struct {
		name string
		s    conversation
		want string
	}{
		{"idle", conversation{state: "idle"}, ""},
		{"rejected prompt", conversation{state: "rejected"}, ""},
		{"rejected after published turn", conversation{state: "rejected", settled: true, settlement: map[string]string{"state": "settled"}}, ""},
		{"rejected with unpublished settlement", conversation{state: "rejected", settled: true}, "turn"},
		{"settled and published", conversation{state: "idle", settled: true, settlement: map[string]string{}}, ""},
		{"run active", conversation{state: "idle", runActive: true}, "turn"},
		{"prompt pending", conversation{state: "pending"}, "turn"},
		{"prompt accepted", conversation{state: "accepted"}, "turn"},
		{"starting", conversation{state: "starting"}, "turn"},
		{"held message", conversation{state: "idle", held: []heldMessage{{}}}, "turn"},
		{"queued steering", conversation{state: "idle", queueSteering: []string{"x"}}, "turn"},
		{"spinoff wait inside turn", conversation{state: "accepted", runActive: true}, "turn"},
		{"queued follow-up", conversation{state: "idle", queueFollowUp: []string{"x"}}, "turn"},
		{"title being written", conversation{state: "idle", naming: true}, "turn"},
		{"recap being written", conversation{state: "idle", recapping: true}, "turn"},
		{"abort in flight", conversation{state: "idle", aborting: true}, "turn"},
		{"settling history", conversation{state: "idle", settled: true}, "turn"},
		{"question", conversation{state: "accepted", runActive: true, questionID: "q"}, "question"},
		{"stopping", conversation{state: "stopping"}, "unknown"},
		{"uncertain", conversation{state: "uncertain"}, "unknown"},
	}
}

func TestHeldActivity(t *testing.T) {
	for _, tc := range heldActivityCases() {
		if got := heldActivity(&tc.s); got != tc.want {
			t.Errorf("%s: %q, want %q", tc.name, got, tc.want)
		}
	}
}

// A person the browser reports present is not stopped, however long Pi has
// been idle; the ten minutes count from the latest report.
func TestIdleStopWaitsForThePersonsAbsence(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Ennen lepoa", activityCommand(1))
	h.quiescent(c, id)
	now := time.Now().Add(time.Second)
	c.stopExpiredIdlePi(context.Background(), now)
	// Writing a long message: the report arrives well into the idle period.
	c.mu.Lock()
	c.sessions[id].presentAt = now.Add(8 * time.Minute)
	c.mu.Unlock()
	c.stopExpiredIdlePi(context.Background(), now.Add(piIdlePeriod))
	c.stopExpiredIdlePi(context.Background(), now.Add(8*time.Minute+piIdlePeriod-time.Nanosecond))
	if !h.live(c, id) {
		t.Fatal("stopped while the person was present")
	}
	c.stopExpiredIdlePi(context.Background(), now.Add(8*time.Minute+piIdlePeriod))
	if h.live(c, id) {
		t.Fatal("not stopped ten minutes after the person left")
	}
	if f, _, resting := h.rest(c, id); !resting || f.cause != "idle" {
		t.Fatalf("rest %+v %v", f, resting)
	}
}

// The browser's report reaches the idle stop through the presence handler.
func TestPresenceReportHoldsTheIdleStop(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Ennen lepoa", activityCommand(1))
	h.quiescent(c, id)
	c.stopExpiredIdlePi(context.Background(), time.Now().Add(-piIdlePeriod))
	w := httptest.NewRecorder()
	c.notePresence(w, httptest.NewRequest(http.MethodPost, "http://unix/presence", nil), id)
	if w.Code != 200 {
		t.Fatalf("presence: %d", w.Code)
	}
	c.stopExpiredIdlePi(context.Background(), time.Now())
	if !h.live(c, id) {
		t.Fatal("stopped right after a presence report")
	}
}

// The watcher's injected clock expires without waiting ten real minutes. The
// real controller/fake Pi pair proves graceful exit, native history and exactly
// one delivery on the lazy restart, including a retried browser command ID.
func TestIdleTimeoutResumesOnce(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Ennen lepoa", activityCommand(1))
	h.quiescent(c, id)
	now := time.Now().Add(time.Second)
	c.stopExpiredIdlePi(context.Background(), now)
	c.stopExpiredIdlePi(context.Background(), now.Add(piIdlePeriod-time.Nanosecond))
	if !h.live(c, id) {
		t.Fatal("stopped before ten minutes idle")
	}
	c.stopExpiredIdlePi(context.Background(), now.Add(piIdlePeriod))
	if h.live(c, id) {
		t.Fatal("idle Pi was not reaped")
	}
	h.converse(c, id, "Jatketaan", activityCommand(2))
	h.quiescent(c, id)
	if w := h.send(c, id, "Jatketaan", activityCommand(2)); w.Code != 200 || !strings.Contains(w.Body.String(), `"pending"`) {
		t.Fatalf("retry: %d %s", w.Code, w.Body.String())
	}
	prompts := strings.Join(h.prompts(), "\n")
	if strings.Count(prompts, "Jatketaan") != 1 {
		t.Fatalf("message delivered more or less than once: %s", prompts)
	}
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		t.Fatal(err)
	}
	for _, n := range sessions {
		if n.id == id {
			b, err := os.ReadFile(n.path)
			if err != nil || !strings.Contains(string(b), "Ennen lepoa") || !strings.Contains(string(b), "Jatketaan") {
				t.Fatalf("history after restart: %s %v", b, err)
			}
			return
		}
	}
	t.Fatal("history not found")
}

func TestIdleTimeoutKeepsEveryHeldActivity(t *testing.T) {
	for _, tc := range heldActivityCases() {
		if tc.want == "" {
			continue
		}
		t.Run(tc.name, func(t *testing.T) {
			now := time.Now()
			s := tc.s
			s.id = "test"
			s.idleSince = now.Add(-2 * piIdlePeriod)
			s.rpc = &piRPC{exited: make(chan struct{})}
			c := &ConversationController{sessions: map[string]*conversation{s.id: &s}}
			c.stopExpiredIdlePi(context.Background(), now)
			if !liveChild(&s) || !s.idleSince.IsZero() {
				t.Fatal("busy child stopped or retained its old idle period")
			}
		})
	}
}

func TestIdleTimeoutKeepsBackgroundAndUnknown(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	h.setFile("background", "1")
	id := h.create(c)
	h.converse(c, id, "Taustatyö", activityCommand(1))
	h.quiescent(c, id)
	now := time.Now().Add(time.Second)
	for _, mode := range []string{"running", "unknown", "finished"} {
		h.setFile("background-state", mode)
		c.stopExpiredIdlePi(context.Background(), now)
		c.stopExpiredIdlePi(context.Background(), now.Add(piIdlePeriod))
		if mode != "finished" && !h.live(c, id) {
			t.Fatalf("stopped %s background work", mode)
		}
		if mode == "finished" && h.live(c, id) {
			t.Fatal("finished background work never became idle")
		}
		now = now.Add(2 * piIdlePeriod)
	}
}

func TestIdleTimeoutRechecksRecentPrompt(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Ensimmäinen", activityCommand(1))
	h.quiescent(c, id)
	now := time.Now().Add(-2 * piIdlePeriod)
	c.stopExpiredIdlePi(context.Background(), now)
	h.converse(c, id, "Uusi vuoro", activityCommand(2))
	h.quiescent(c, id)
	c.stopExpiredIdlePi(context.Background(), time.Now())
	if !h.live(c, id) {
		t.Fatal("a recent prompt did not reset the old idle observation")
	}
}

// Pipe EOF may publish uncertainty before the exit watcher gets the lock. A
// completed stop already has reap proof and must expose lazy resume at once.
func TestGracefulIdleStopReapWinsOverEOF(t *testing.T) {
	for _, state := range []string{"stopping", "uncertain", "starting"} {
		t.Run(state, func(t *testing.T) {
			s := &conversation{id: "test", state: state, rpc: stoppedRPC()}
			c := &ConversationController{sessions: map[string]*conversation{s.id: s}}
			c.closeStopping([]*conversation{s})
			want := "stopped"
			if state == "starting" {
				want = state
			}
			if s.state != want {
				t.Fatalf("after reaping: %s, want %s", s.state, want)
			}
		})
	}
}

// An idle UI state can still be publishing native history or generating a title.
// Wait for the shared definition, not just the UI, before advancing fake time.
func (h *heldHarness) quiescent(c *ConversationController, id string) {
	h.t.Helper()
	h.eventually("controller idle", func() bool {
		c.mu.Lock()
		defer c.mu.Unlock()
		return heldActivity(c.sessions[id]) == ""
	})
}

// Pi can reject preflight (for example an expired provider credential) without
// a new native turn. The previous published settlement must remain idle.
func TestIdleTimeoutAfterRejectedPrompt(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Valmis", activityCommand(1))
	h.quiescent(c, id)
	h.setFile("prompt-reject", "1")
	if w := h.send(c, id, "Hylatty", activityCommand(2)); w.Code != 200 {
		t.Fatalf("send: %d %s", w.Code, w.Body.String())
	}
	h.eventually("prompt rejected", func() bool { return h.receipt(c, id, activityCommand(2)) == "rejected" })
	c.mu.Lock()
	activity := heldActivity(c.sessions[id])
	c.mu.Unlock()
	if activity != "" {
		t.Fatalf("rejected prompt left idle Pi busy: %s", activity)
	}
	now := time.Now().Add(time.Second)
	c.stopExpiredIdlePi(context.Background(), now)
	c.stopExpiredIdlePi(context.Background(), now.Add(piIdlePeriod))
	if h.live(c, id) {
		t.Fatal("rejected prompt kept idle Pi alive")
	}
}
