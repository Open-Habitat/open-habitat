//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"slices"
	"testing"

	"github.com/open-habitat/open-habitat/internal/testpython"
)

type censusView struct {
	Conversations []struct {
		AgentID     string   `json:"agent_id"`
		WorkspaceID *string  `json:"workspace_id"`
		Activities  []string `json:"activities"`
		Processes   []struct {
			ID, Name string
		} `json:"processes"`
	} `json:"conversations"`
	Jobs []struct {
		Kind    string `json:"kind"`
		AgentID string `json:"agent_id"`
	} `json:"jobs"`
}

// census reads the work census as the agent CLI does and checks the reply
// against the contract.
func (h *heldHarness) census(c *ConversationController) censusView {
	h.t.Helper()
	w := httptest.NewRecorder()
	c.workCensus(nil).ServeHTTP(w, httptest.NewRequest("GET", AgentWorkPath, nil))
	if w.Code != 200 {
		h.t.Fatalf("census: %d %s", w.Code, w.Body.String())
	}
	cmd := exec.Command(testpython.Validator(h.t), "-c", `import sys,runpy,json; m=runpy.run_path('../../scripts/validate-contracts.py'); m['Draft202012Validator'](m['schemas']['agent-work.schema.json'],registry=m['registry']).validate(json.load(sys.stdin))`)
	cmd.Stdin = bytes.NewReader(w.Body.Bytes())
	if out, err := cmd.CombinedOutput(); err != nil {
		h.t.Fatalf("schema: %v %s\n%s", err, out, w.Body.String())
	}
	var v censusView
	if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
		h.t.Fatal(err)
	}
	return v
}

func (v censusView) activities(id string) []string {
	for _, c := range v.Conversations {
		if c.AgentID == "pi:"+id {
			return c.Activities
		}
	}
	return nil
}

// The census lists what stopping the daemon would cut and nothing else: an
// idle Pi is not listed, a running turn is, a background process keeps an
// otherwise idle conversation listed with its label, an unclear process
// bridge is unknown, and a finished process leaves nothing behind.
func TestWorkCensusSeesTurnsAndBackgroundProcesses(t *testing.T) {
	h := newHeldHarness(t)
	// Every child gets a process bridge, answering none until told otherwise.
	h.setFile("background", "1")
	h.setFile("background-state", "finished")
	c, stop := h.daemon()
	defer stop()
	idle := h.create(c)
	h.converse(c, idle, "Valmis", activityCommand(1))
	h.quiescent(c, idle)
	if v := h.census(c); len(v.Conversations) != 0 || len(v.Jobs) != 0 {
		t.Fatalf("idle Pi listed as work: %+v", v)
	}

	h.setFile("prompt-hold", "1")
	busy := h.create(c)
	h.eventually("ready", func() bool { _, v := h.status(c, busy); return v.State == "idle" })
	if w := h.send(c, busy, "Pitkä työ", activityCommand(2)); w.Code != 200 {
		t.Fatalf("send: %d %s", w.Code, w.Body.String())
	}
	h.eventually("turn running", func() bool {
		c.mu.Lock()
		defer c.mu.Unlock()
		return c.sessions[busy].runActive
	})
	v := h.census(c)
	if got := v.activities(busy); !slices.Equal(got, []string{"turn"}) || v.activities(idle) != nil {
		t.Fatalf("running turn: %+v", v)
	}
	h.setFile("prompt-hold", "")
	h.quiescent(c, busy)

	h.setFile("background-state", "running")
	v = h.census(c)
	for _, id := range []string{idle, busy} {
		if got := v.activities(id); !slices.Equal(got, []string{"processes"}) {
			t.Fatalf("background process of %s: %+v", id, v)
		}
	}
	if p := v.Conversations[0].Processes; len(p) != 1 || p[0].ID != "proc_1" || p[0].Name != "kääntäjä" {
		t.Fatalf("process not named: %+v", v.Conversations[0])
	}
	h.setFile("background-state", "unknown")
	if got := h.census(c).activities(idle); !slices.Equal(got, []string{"unknown"}) {
		t.Fatalf("unclear bridge: %v", got)
	}
	h.setFile("background-state", "finished")
	if v := h.census(c); len(v.Conversations) != 0 {
		t.Fatalf("finished processes still listed: %+v", v)
	}
}

// Work the conversation's controller state does not show: a command the
// person ran, Habitat's own title, the settle window, and a handle whose
// workspace the daemon can no longer name, which the rail's list skips.
func TestWorkCensusSeesWorkBehindAnIdleState(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Valmis", activityCommand(1))
	h.quiescent(c, id)
	for _, tc := range []struct {
		name string
		set  func(*conversation)
		want []string
	}{
		{"person's command", func(s *conversation) { s.bash = &bashRun{state: "running"} }, []string{"command"}},
		{"held command", func(s *conversation) { s.bash = &bashRun{state: "held"} }, []string{"command"}},
		{"title", func(s *conversation) { s.naming = true }, []string{"habitat"}},
		{"recap", func(s *conversation) { s.recapping = true }, []string{"habitat"}},
		{"settle window", func(s *conversation) { s.settled, s.settlement = true, nil }, []string{"habitat"}},
		{"turn and command", func(s *conversation) { s.runActive, s.bash = true, &bashRun{state: "running"} }, []string{"turn", "command"}},
	} {
		c.mu.Lock()
		s := c.sessions[id]
		saved := *s
		tc.set(s)
		c.mu.Unlock()
		got := h.census(c).activities(id)
		c.mu.Lock()
		restoreCensusFields(s, &saved)
		c.mu.Unlock()
		if !slices.Equal(got, tc.want) {
			t.Errorf("%s: %v, want %v", tc.name, got, tc.want)
		}
	}

	c.mu.Lock()
	c.sessions[id].workspace = ""
	c.sessions[id].runActive = true
	c.mu.Unlock()
	v := h.census(c)
	c.mu.Lock()
	c.sessions[id].runActive = false
	c.mu.Unlock()
	if len(v.Conversations) != 1 || v.Conversations[0].WorkspaceID != nil || !slices.Equal(v.Conversations[0].Activities, []string{"turn"}) {
		t.Fatalf("handle without a workspace: %+v", v)
	}
}

// restoreCensusFields puts back what a case changed without copying the
// conversation's locks and channels over the live handle.
func restoreCensusFields(s, saved *conversation) {
	s.bash, s.naming, s.recapping, s.runActive = saved.bash, saved.naming, saved.recapping, saved.runActive
	s.settled, s.settlement = saved.settled, saved.settlement
}

// Naming a history no handle holds runs a title-model call and a temporary
// Pi outside every handle; the census lists it as a job for as long as it
// runs.
func TestWorkCensusSeesHandlelessTitleWork(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	id := h.create(c)
	h.converse(c, id, "Synthetic topic", activityCommand(1))
	h.quiescent(c, id)
	stop()
	c, stop = h.daemon()
	defer stop()
	release := make(chan struct{})
	entered := make(chan struct{})
	c.titleGenerator = func(string) (string, error) {
		close(entered)
		<-release
		return "", fmt.Errorf("synthetic model failure")
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		h.post(func(w http.ResponseWriter, r *http.Request) { c.historyTitle(w, r, id) }, fmt.Sprintf(`{"workspace_id":%q}`, h.workspace))
	}()
	<-entered
	v := h.census(c)
	close(release)
	<-done
	if len(v.Conversations) != 0 || len(v.Jobs) != 1 || v.Jobs[0].Kind != "history_title" || v.Jobs[0].AgentID != "pi:"+id {
		t.Fatalf("handle-less title work: %+v", v)
	}
	if v := h.census(c); len(v.Jobs) != 0 {
		t.Fatalf("finished title work still listed: %+v", v)
	}
}

// A workspace operation, such as a publish pushing for up to 45 minutes,
// holds the daemon-wide workspace writer without a conversation or a clone
// job; the census lists it while it holds the writer.
func TestWorkCensusSeesWorkspaceOperation(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	if !cloneWriter.TryLock("workspace_publish_running") {
		t.Fatal("workspace writer already held")
	}
	v := h.census(c)
	cloneWriter.Unlock()
	if len(v.Jobs) != 1 || v.Jobs[0].Kind != "workspace_operation" {
		t.Fatalf("held workspace writer: %+v", v)
	}
	if v := h.census(c); len(v.Jobs) != 0 {
		t.Fatalf("released writer still listed: %+v", v)
	}
}

// The census answers no input, and never with invalid_arguments: the host
// upgrade reads that code as a CLI without the census.
func TestWorkCensusRefusesInput(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	for _, r := range []*http.Request{
		httptest.NewRequest("GET", AgentWorkPath+"?all=1", nil),
		httptest.NewRequest("POST", AgentWorkPath, nil),
		httptest.NewRequest("GET", AgentWorkPath, bytes.NewReader([]byte("{}"))),
	} {
		w := httptest.NewRecorder()
		c.workCensus(nil).ServeHTTP(w, r)
		if w.Code != 400 || !bytes.Contains(w.Body.Bytes(), []byte(`"invalid_request"`)) {
			t.Fatalf("%s %s: %d %s", r.Method, r.URL, w.Code, w.Body.String())
		}
	}
}

// heldWork is heldActivity's detail: each case that makes a conversation
// busy names its kind, and heldActivity still reads the same.
func TestHeldWorkKinds(t *testing.T) {
	for _, tc := range heldActivityCases() {
		work := heldWork(&tc.s)
		if (len(work) == 0) != (tc.want == "") {
			t.Errorf("%s: work %v but activity %q", tc.name, work, tc.want)
		}
	}
	for _, tc := range []struct {
		name string
		s    conversation
		want []string
	}{
		{"command on idle Pi", conversation{state: "idle", bash: &bashRun{state: "running"}}, []string{"command"}},
		{"finished command", conversation{state: "idle", bash: &bashRun{state: "finished"}}, nil},
		{"title", conversation{state: "idle", naming: true}, []string{"habitat"}},
		{"Habitat's own wake", conversation{state: "idle", waking: true}, []string{"habitat"}},
		{"settling", conversation{state: "idle", settled: true}, []string{"habitat"}},
		{"held message", conversation{state: "idle", held: []heldMessage{{}}}, []string{"turn"}},
		{"question inside turn", conversation{state: "accepted", runActive: true, questionID: "q"}, []string{"question", "turn"}},
		{"stopping", conversation{state: "stopping"}, []string{"unknown"}},
		{"stopping while naming", conversation{state: "stopping", naming: true}, []string{"habitat"}},
	} {
		if got := heldWork(&tc.s); !slices.Equal(got, tc.want) {
			t.Errorf("%s: %v, want %v", tc.name, got, tc.want)
		}
	}
	if got := heldActivity(&conversation{state: "idle", bash: &bashRun{state: "running"}}); got != "turn" {
		t.Errorf("command still reads as %q to the limit and deletion", got)
	}
}
