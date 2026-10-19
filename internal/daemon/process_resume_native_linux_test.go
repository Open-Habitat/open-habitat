//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// A Taskfleet stand-in reading the user's own run records from HOME. Its wait
// polls them like the real `run wait`, so finishing a run ends the process.
const resumeFakeTaskfleet = `#!/usr/bin/env python3
import json,os,sys,time
state=os.path.join(os.environ["HOME"],"taskfleet-state.json")
def runs(): return json.load(open(state))
def out(d): print(json.dumps(dict(schema_version=1,data=d,warnings=[])),flush=True)
a=sys.argv[1:]
if a[:1]==["version"]: out(dict(version="0.15.0"))
elif a[:2]==["run","list"]: out(dict(runs=runs()))
elif a[:2]==["run","show"]:
    r=[x for x in runs() if x["run_id"]==a[2]]
    if not r: sys.exit(1)
    out(r[0])
elif a[:2]==["run","wait"]:
    ids=[x for x in a[2:] if len(x)==26]
    while True:
        by={x["run_id"]:x for x in runs()}
        if all(by[i]["status"] not in ("pending","running") for i in ids):
            out(dict(runs=[by[i] for i in ids])); sys.exit(0)
        time.sleep(0.05)
else: sys.exit(2)
`

const (
	resumeWaitedRun  = "01m531x6y92ggdqcmb1exzmnya"
	resumeSettledRun = "01m531x6y92ggdqcmb1exzmnyc"
)

// The two issues' host-backed proof: real pinned Pi, real pi-processes, the
// shipped companion and two real controller incarnations (a daemon restart).
// After the restart the tray shows the cut-off processes, the resumed agent's
// next turn is told which were cut off and which spinoffs settled, its
// restored wait wakes it, and a later restart with nothing new adds nothing.
func TestProcessResumeCatchUpAcrossDaemonRestart(t *testing.T) {
	modules, err := filepath.Abs("pi-device-test/node_modules")
	if err != nil {
		t.Fatal(err)
	}
	cli := filepath.Join(modules, "@earendil-works/pi-coding-agent/dist/bundle/cli.js")
	core := filepath.Join(modules, "@aliou/pi-processes/extensions/processes/index.ts")
	if _, err := os.Stat(core); err != nil {
		t.Skip("pinned process test dependencies not installed")
	}
	companion, _ := filepath.Abs("process-extension.mjs")
	h := newHeldHarness(t)
	agent := filepath.Join(h.root, ".pi/agent")
	bin := filepath.Join(h.root, ".local/bin")
	for _, dir := range []string{agent, bin} {
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(bin, "taskfleet"), []byte(resumeFakeTaskfleet), 0700); err != nil {
		t.Fatal(err)
	}

	var mu sync.Mutex
	bodies := []string{}
	reply := map[int]string{} // request number → tool command, else text
	reply[1] = `{"name":"dev-server","command":"sleep 300"}`
	reply[2] = `{"name":"spinoff-wait","command":"taskfleet run wait ` + resumeWaitedRun + ` --output json"}`
	reply[4] = reply[2] // the agent restores the wait the catch-up names
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		mu.Lock()
		bodies = append(bodies, string(b))
		n := len(bodies)
		mu.Unlock()
		w.Header().Set("Content-Type", "text/event-stream")
		if args, ok := reply[n]; ok {
			var v map[string]string
			_ = json.Unmarshal([]byte(args), &v)
			start, _ := json.Marshal(map[string]string{"action": "start", "name": v["name"], "command": v["command"]})
			encoded, _ := json.Marshal(string(start))
			fmt.Fprintf(w, "data: {\"id\":\"s\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"tool_calls\":[{\"index\":0,\"id\":\"call%d\",\"type\":\"function\",\"function\":{\"name\":\"process\",\"arguments\":%s}}]},\"finish_reason\":null}]}\n\n", n, encoded)
			fmt.Fprint(w, "data: {\"id\":\"s\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"tool_calls\"}]}\n\ndata: [DONE]\n\n")
			return
		}
		fmt.Fprint(w, "data: {\"id\":\"s\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"Fixture answer\"},\"finish_reason\":null}]}\n\ndata: {\"id\":\"s\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n")
	}))
	defer provider.Close()
	request := func(n int) string {
		h.eventually(fmt.Sprintf("provider request %d", n), func() bool { mu.Lock(); defer mu.Unlock(); return len(bodies) >= n })
		mu.Lock()
		defer mu.Unlock()
		return bodies[n-1]
	}
	models, _ := json.Marshal(map[string]any{"providers": map[string]any{"fixture": map[string]any{"baseUrl": provider.URL + "/v1", "api": "openai-completions", "apiKey": "synthetic", "models": []any{map[string]string{"id": "fake", "name": "Fake"}}}}})
	if err := os.WriteFile(filepath.Join(agent, "models.json"), models, 0600); err != nil {
		t.Fatal(err)
	}
	// The fixture runtime passes only cli.js; this launcher adds the product's
	// extensions the way piArgs does for the installed runtime.
	launcher := filepath.Join(h.root, "node")
	script := fmt.Sprintf("#!/bin/sh\nshift\nexec /usr/bin/node %q --provider fixture --model fake --extension %q --extension %q \"$@\"\n", cli, core, companion)
	if err := os.WriteFile(launcher, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	h.runtime.Node = launcher

	cwd := filepath.Join(h.root, "src", "project")
	writeRuns := func(id string, waited, settled string, settledAt time.Time) {
		t.Helper()
		run := func(runID, status string, landed bool, updated time.Time) map[string]any {
			return map[string]any{"run_id": runID, "kind": "spinoff", "lifecycle": "autonomous", "status": status, "title": "fixture " + runID[22:], "created_at": "2026-10-16T10:00:00Z", "source_repo": cwd, "source_branch": "main", "created_by_session": map[string]string{"harness": "pi", "session_id": id}, "created_by_run_id": nil, "landed": landed, "attention_required": false, "awaiting_input": false, "stalled": false, "supervisor": map[string]any{"state": "alive"}, "node_transcripts": []any{}, "manifest": map[string]any{"updated_at": updated.UTC().Format(time.RFC3339Nano)}}
		}
		b, _ := json.Marshal([]any{run(resumeWaitedRun, waited, waited == "done", settledAt), run(resumeSettledRun, settled, settled == "done", settledAt)})
		state := filepath.Join(h.root, "taskfleet-state.json")
		// The fake wait reads concurrently. Publish a complete inventory instead
		// of letting json.load see a truncated file and emit a spurious crash.
		if err := os.WriteFile(state+".next", b, 0600); err != nil {
			t.Fatal(err)
		}
		if err := os.Rename(state+".next", state); err != nil {
			t.Fatal(err)
		}
	}
	inventory := func(c *ConversationController, id string) processInventory {
		t.Helper()
		w := httptest.NewRecorder()
		c.processRoutes(w, httptest.NewRequest("GET", "/api/v1/conversations/"+id+"/processes", nil), []string{id, "processes"})
		var inv processInventory
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &inv) != nil {
			t.Fatalf("inventory: %d %s", w.Code, w.Body.String())
		}
		return inv
	}
	settled := func(c *ConversationController, id, command string) {
		h.eventually("turn "+command+" settled", func() bool {
			_, v := h.status(c, id)
			return v.State == "idle" && h.receipt(c, id, command) == "accepted"
		})
	}
	stop := func(c *ConversationController, cancel func(), id string) {
		cancel()
		h.eventually("Pi reaped by the daemon stop", func() bool {
			c.mu.Lock()
			defer c.mu.Unlock()
			return c.sessions[id] == nil || c.sessions[id].dead
		})
	}

	// First daemon: the agent starts a server and a wait for its spinoff.
	first, cancelFirst := h.daemon()
	id := h.create(first)
	writeRuns(id, "running", "running", time.Now())
	if w := h.send(first, id, "Aloita", heldA); w.Code != 200 {
		t.Fatalf("first send: %d %s", w.Code, w.Body.String())
	}
	request(3)
	settled(first, id, heldA)
	var dev string
	h.eventually("both processes live", func() bool {
		inv := inventory(first, id)
		live := 0
		for _, p := range inv.Processes {
			if p.Status == "running" {
				live++
			}
			if p.Name == "dev-server" {
				dev = p.ID
			}
		}
		return live == 2 && len(inv.Interrupted) == 0
	})
	stop(first, cancelFirst, id)
	// The other spinoff finishes while Pi is down.
	writeRuns(id, "running", "done", time.Now())

	// Second daemon. A terminal Pi on the same session may own live processes:
	// none of them is called cut off while it writes.
	second, cancelSecond := h.daemon()
	sessions, _ := filepath.Glob(filepath.Join(agent, "sessions", "*", "*_"+id+".jsonl"))
	if len(sessions) != 1 {
		t.Fatalf("session file: %v", sessions)
	}
	terminal := exec.Command("bash", "-c", "exec -a pi sleep 20 3<\"$1\"", "bash", sessions[0])
	terminal.Dir = cwd
	if err := terminal.Start(); err != nil {
		t.Fatal(err)
	}
	h.eventually("terminal writer observed", func() bool { return second.piWriter(sessions[0], cwd) == "writer_present" })
	if inv := inventory(second, id); len(inv.Interrupted) != 0 {
		t.Fatalf("a terminal Pi's processes shown as cut off: %+v", inv.Interrupted)
	}
	_ = terminal.Process.Kill()
	_ = terminal.Wait()
	// Without it the conversation's tray shows what the restart cut off. The
	// writer census can be transiently uncertain under concurrent load.
	var inv processInventory
	h.eventually("cut-off processes shown", func() bool {
		inv = inventory(second, id)
		return inv.Availability == "unavailable" && len(inv.Interrupted) == 2
	})
	// Assert the observation that satisfied the poll. A second /proc census
	// can legitimately be uncertain as unrelated same-UID processes exit.
	for _, p := range inv.Interrupted {
		if p.Reason != "server_restart" || !p.Wakes {
			t.Fatalf("cut-off process: %+v", p)
		}
		if p.Name == "spinoff-wait" && (len(p.RunIDs) != 1 || p.RunIDs[0] != resumeWaitedRun) {
			t.Fatalf("cut-off wait: %+v", p)
		}
	}
	if w := h.send(second, id, "Jatketaan", heldB); w.Code != 200 {
		t.Fatalf("resume send: %d %s", w.Code, w.Body.String())
	}
	catchUp := request(4)
	for _, want := range []string{"[Open Habitat]", dev + ` \"dev-server\": sleep 300`, resumeSettledRun + ` \"fixture ` + resumeSettledRun[22:] + `\" finished and merged`, "taskfleet run wait " + resumeWaitedRun + " --output json"} {
		if !strings.Contains(catchUp, want) {
			t.Fatalf("resumed turn lacks %q:\n%s", want, catchUp)
		}
	}
	request(5)
	settled(second, id, heldB)
	if inv := inventory(second, id); len(inv.Interrupted) != 0 {
		t.Fatalf("processes the agent was told about stay in the tray: %+v", inv.Interrupted)
	}

	// The restored wait wakes the agent when its spinoff completes.
	second.mu.Lock()
	beforeWake := second.sessions[id].turnGeneration
	second.mu.Unlock()
	writeRuns(id, "done", "done", time.Now())
	wake := request(6)
	if !strings.Contains(wake, resumeWaitedRun) {
		t.Fatalf("wake turn without the wait's result:\n%s", wake)
	}
	h.eventually("wake turn published", func() bool {
		second.mu.Lock()
		defer second.mu.Unlock()
		s := second.sessions[id]
		// Do not accept the previous turn's idle state before agent_start is
		// consumed, or stop Pi before this wake's history is published.
		return s.turnGeneration > beforeWake && heldActivity(s) == ""
	})
	stop(second, cancelSecond, id)

	// Nothing happened while Pi was down this time: no second message.
	third, cancelThird := h.daemon()
	defer cancelThird()
	if inv := inventory(third, id); len(inv.Interrupted) != 0 {
		t.Fatalf("nothing was cut off: %+v", inv.Interrupted)
	}
	if w := h.send(third, id, "Taas", heldC); w.Code != 200 {
		t.Fatalf("third send: %d %s", w.Code, w.Body.String())
	}
	if again := request(7); strings.Count(again, "[Open Habitat]") != 1 {
		t.Fatalf("a catch-up without news:\n%s", again)
	}
	settled(third, id, heldC)
}
