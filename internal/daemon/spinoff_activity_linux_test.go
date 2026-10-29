//go:build linux

package daemon

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// Jari 29.10.2026: an --interactive spinoff committed and stopped at Pi's
// prompt, and the rail and panel still pulsed it as working. Taskfleet keeps
// such a run running; Pi's own session says the turn ended.
func TestLiveWorkerStateReadsPiOwnSession(t *testing.T) {
	cfg, n := spinoffFixture(t)
	parent := nativeSession{id: spinoffParent, cwd: "/home/fixture/src/source"}
	r := nativeSpinoff{ID: spinoffFixtureID, Kind: "spinoff", Status: "running", Lifecycle: "interactive", SourceRepo: parent.cwd, Nodes: []spinoffNode{n}}
	r.Creator = &struct {
		Harness   string `json:"harness"`
		SessionID string `json:"session_id"`
	}{"pi", spinoffParent}
	p := filepath.Join(cfg.Home, ".taskfleet", *n.Live.Path)
	if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
		t.Fatal(err)
	}
	home, err := os.Open(cfg.Home)
	if err != nil {
		t.Fatal(err)
	}
	defer home.Close()
	now := time.Date(2026, 10, 29, 20, 0, 0, 0, time.UTC)
	header := `{"type":"session","version":3,"id":"` + spinoffSession + `","timestamp":"2026-10-29T19:00:00Z","cwd":"/w"}`
	user := `{"type":"message","id":"u","message":{"role":"user","content":"task"}}`
	call := `{"type":"message","id":"a","message":{"role":"assistant","stopReason":"toolUse","content":[]}}`
	result := `{"type":"message","id":"t","message":{"role":"toolResult","toolName":"bash","content":[]}}`
	done := `{"type":"message","id":"d","message":{"role":"assistant","stopReason":"stop","content":[{"type":"text","text":"Committed."}]}}`
	reminder := `{"type":"custom_message","id":"c","customType":"oh-wait-reminder","display":true,"content":"x"}`
	for _, c := range []struct {
		name  string
		lines []string
		want  string
	}{
		{"turn under way", []string{header, user}, "working"},
		{"tool call", []string{header, user, call}, "working"},
		{"tool result", []string{header, user, call, result}, "working"},
		{"turn ended", []string{header, user, call, result, done}, "idle"},
		{"label after the reply", []string{header, user, done, `{"type":"label","id":"l"}`}, "idle"},
		{"extension starts the next turn", []string{header, user, done, reminder}, "working"},
		{"retry wait after a failed reply", []string{header, user, `{"type":"message","id":"e","message":{"role":"assistant","stopReason":"error","content":[]}}`, `{"type":"context_edit","id":"ce"}`}, "working"},
		{"failed reply, no retry left", []string{header, user, `{"type":"message","id":"e","message":{"role":"assistant","stopReason":"error","content":[]}}`}, "idle"},
		{"half-written line", []string{header, user, done, `{"type":"message","id":"x","mess`}, "idle"},
	} {
		if err := os.WriteFile(p, []byte(strings.Join(c.lines, "\n")+"\n"), 0o600); err != nil {
			t.Fatal(err)
		}
		if got, _ := liveWorkerState(home, cfg.UID, r, now); got != c.want {
			t.Fatalf("%s: state = %s, want %s", c.name, got, c.want)
		}
		working, idle := workingSpinoffs(home, cfg.UID, []nativeSpinoff{r}, parent, now)
		if c.want == "idle" && (working != 0 || idle != 1) || c.want == "working" && (working != 1 || idle != 0) {
			t.Fatalf("%s: working %d idle %d", c.name, working, idle)
		}
	}
	// Jari 28.10.2026: a headless Pi worker sat at Pi's project trust prompt
	// with only its session header written, while Habitat said it worked.
	for _, c := range []struct {
		at    time.Time
		want  string
		input bool
	}{
		{now, "idle", true},
		{time.Date(2026, 10, 29, 19, 0, 30, 0, time.UTC), "working", false},
	} {
		if err := os.WriteFile(p, []byte(header+"\n"+`{"type":"model_change","id":"m"}`+"\n"), 0o600); err != nil {
			t.Fatal(err)
		}
		if got, input := liveWorkerState(home, cfg.UID, r, c.at); got != c.want || input != c.input {
			t.Fatalf("header only at %s: %s %v", c.at, got, input)
		}
	}
	// Taskfleet's word stands when Pi's cannot be read: an ended run, a
	// Claude worker, a path outside the state root, or no session yet.
	ended := r
	ended.Status = "done"
	if got, _ := liveWorkerState(home, cfg.UID, ended, now); got != "unmerged" {
		t.Fatalf("ended run = %s", got)
	}
	claude := r
	claude.Nodes = []spinoffNode{n}
	claude.Nodes[0].Harness = "claude"
	escaped := r
	escaped.Nodes = []spinoffNode{n}
	escaped.Nodes[0].Live.Path = strptr("../.taskfleet/" + *n.Live.Path)
	missing := r
	missing.Nodes = []spinoffNode{n}
	missing.Nodes[0].Live.Path = strptr(".creating/pi-sessions/" + spinoffFixtureID + "/none.jsonl")
	for _, other := range []nativeSpinoff{claude, escaped, missing} {
		if got, _ := liveWorkerState(home, cfg.UID, other, now); got != "working" {
			t.Fatalf("unreadable session = %s", got)
		}
	}
	if got, _ := liveWorkerState(nil, cfg.UID, r, now); got != "working" {
		t.Fatalf("no home = %s", got)
	}
}
