//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/user"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/core"
	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// heldFakePi records every launch and prompt in the synthetic home so a test
// can count native writes. Files in HOME steer it: start-delay (seconds before
// answering get_state), start-fail (exit before reading any request) and
// prompt-exit (exit on a prompt without answering it).
const heldFakePi = `#!/usr/bin/env python3
import datetime,json,os,sys,time,uuid
home=os.environ["HOME"]; args=sys.argv[1:]
sid=None; existing=None
for i,a in enumerate(args[:-1]):
    if a=="--session-id": sid=args[i+1]
    if a=="--session": existing=args[i+1]; sid=os.path.basename(existing)[:-6].split("_")[-1]
open(os.path.join(home,"launches.log"),"a").write(sid+"\n")
if os.path.exists(os.path.join(home,"start-fail")): sys.exit(3)
cwd=os.getcwd()
d=os.path.join(home,".pi","agent","sessions","--"+cwd.strip("/").replace("/","-")+"--")
path=existing or os.path.join(d,time.strftime("%Y-%m-%dT%H-%M-%S-000Z",time.gmtime())+"_"+sid+".jsonl")
parent=None
if existing:
    for line in open(existing):
        try: e=json.loads(line)
        except Exception: continue
        if e.get("type")!="session" and e.get("id"): parent=e["id"]
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00","Z")
def append(entry):
    global parent
    if not os.path.exists(path):
        os.makedirs(d,exist_ok=True)
        with open(path,"w") as f: f.write(json.dumps(dict(type="session",version=3,id=sid,timestamp=now(),cwd=cwd))+"\n")
    eid=uuid.uuid4().hex[:8]
    entry.update(id=eid,parentId=parent,timestamp=now()); parent=eid
    with open(path,"a") as f: f.write(json.dumps(entry)+"\n")
def out(v): print(json.dumps(v),flush=True)
for line in sys.stdin:
    r=json.loads(line)
    if r["type"]=="get_state":
        p=os.path.join(home,"start-delay")
        if os.path.exists(p): time.sleep(float(open(p).read()))
        out(dict(type="response",id=r["id"],command="get_state",success=True,data=dict(model=dict(provider="openai-codex",id="fake"),thinkingLevel="off")))
    elif r["type"]=="prompt":
        if os.path.exists(os.path.join(home,"prompt-exit")): sys.exit(4)
        open(os.path.join(home,"prompts.log"),"a").write(json.dumps(r["message"])+"\n")
        out(dict(type="response",id=r["id"],command="prompt",success=True))
        out(dict(type="agent_start"))
        ms=int(time.time()*1000)
        append(dict(type="message",message=dict(role="user",content=r["message"],timestamp=ms)))
        append(dict(type="message",message=dict(role="assistant",content=[dict(type="text",text="ok")],timestamp=ms,stopReason="stop")))
        out(dict(type="agent_end"))
        out(dict(type="agent_settled"))
    else:
        out(dict(type="response",id=r["id"],command=r["type"],success=True))
`

type heldHarness struct {
	t         *testing.T
	root      string
	workspace string
	cfg       transport.Config
	runtime   *core.PiRuntimeConfig
}

func newHeldHarness(t *testing.T) *heldHarness {
	t.Helper()
	if os.Geteuid() == 0 {
		t.Skip("requires nonroot")
	}
	if _, err := os.Stat("/usr/bin/python3"); err != nil {
		t.Skip("requires python3 for the synthetic Pi")
	}
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "src", "project"), 0700); err != nil {
		t.Fatal(err)
	}
	script := filepath.Join(root, "fake-pi")
	if err := os.WriteFile(script, []byte(heldFakePi), 0700); err != nil {
		t.Fatal(err)
	}
	name := "synthetic"
	if u, err := user.Current(); err == nil {
		name = u.Username
	}
	cfg := transport.Config{Home: root, UID: os.Geteuid(), Username: name, Provider: "github", Subject: "1"}
	return &heldHarness{t: t, root: root, cfg: cfg, workspace: opaque("ws_", cfg.Provider+":"+cfg.Subject+":project"), runtime: &core.PiRuntimeConfig{Node: script, Entry: filepath.Join(root, "pi", "entry"), Manifest: filepath.Join(root, "pi", "manifest")}}
}

// daemon starts one controller incarnation; cancelling it is a daemon stop.
func (h *heldHarness) daemon() (*ConversationController, context.CancelFunc) {
	ctx, cancel := context.WithCancel(context.Background())
	c := ConversationHandlerWithFixtureRuntime(ctx, h.cfg, func(*http.Request) bool { return true }, func(context.Context) string { return "connected" }, h.root, h.runtime)
	c.titleGenerator = func(string) (string, error) { return "", errors.New("no titles in this test") }
	// Cancelling alone shuts down in the background; close Pi before the
	// stop returns, so nothing still writes when the temporary home goes.
	return c, func() { c.shutdown(); cancel() }
}

func (h *heldHarness) post(handler func(http.ResponseWriter, *http.Request), body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest("POST", "http://unix/x", strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler(w, r)
	return w
}

func (h *heldHarness) send(c *ConversationController, id, text, command string) *httptest.ResponseRecorder {
	b, _ := json.Marshal(map[string]string{"message": text, "command_id": command})
	return h.post(func(w http.ResponseWriter, r *http.Request) { c.sendKind(w, r, id, "send") }, string(b))
}

type heldStatus struct {
	State        string `json:"state"`
	WorkspaceID  string `json:"workspace_id"`
	StartProblem string `json:"start_problem"`
	Held         []struct {
		CommandID string `json:"command_id"`
		Text      string `json:"text"`
	} `json:"held"`
}

func (h *heldHarness) status(c *ConversationController, id string) (int, heldStatus) {
	w := httptest.NewRecorder()
	c.observe(w, httptest.NewRequest("GET", "http://unix/status", nil), id)
	var view heldStatus
	_ = json.Unmarshal(w.Body.Bytes(), &view)
	return w.Code, view
}

func (h *heldHarness) receipt(c *ConversationController, id, command string) string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if s := c.sessions[id]; s != nil {
		return s.receipts[command]
	}
	return ""
}

func (h *heldHarness) lines(name string) []string {
	b, err := os.ReadFile(filepath.Join(h.root, name))
	if err != nil {
		return nil
	}
	return strings.Split(strings.TrimSpace(string(b)), "\n")
}

// prompts returns the native prompt texts the synthetic Pi received, in order.
func (h *heldHarness) prompts() []string {
	var out []string
	for _, line := range h.lines("prompts.log") {
		var text string
		if json.Unmarshal([]byte(line), &text) != nil {
			h.t.Fatalf("prompt log line %q", line)
		}
		out = append(out, text)
	}
	return out
}

func (h *heldHarness) eventually(label string, ok func() bool) {
	h.t.Helper()
	deadline := time.Now().Add(15 * time.Second)
	for !ok() {
		if time.Now().After(deadline) {
			h.t.Fatalf("timed out: %s", label)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func (h *heldHarness) create(c *ConversationController) string {
	w := h.post(c.create, fmt.Sprintf(`{"workspace_id":%q}`, h.workspace))
	if w.Code != 200 {
		h.t.Fatalf("create: %d %s", w.Code, w.Body.String())
	}
	var reply struct {
		AgentID string `json:"agent_id"`
		State   string `json:"state"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &reply); err != nil || reply.State != "starting" {
		h.t.Fatalf("create reply: %s", w.Body.String())
	}
	return strings.TrimPrefix(reply.AgentID, "pi:")
}

func (h *heldHarness) setFile(name, value string) {
	h.t.Helper()
	path := filepath.Join(h.root, name)
	if value == "" {
		_ = os.Remove(path)
		return
	}
	if err := os.WriteFile(path, []byte(value), 0600); err != nil {
		h.t.Fatal(err)
	}
}

const (
	heldA = "aaaaaaaa-0000-4000-8000-00000000000a"
	heldB = "aaaaaaaa-0000-4000-8000-00000000000b"
	heldC = "aaaaaaaa-0000-4000-8000-00000000000c"
	heldD = "aaaaaaaa-0000-4000-8000-00000000000d"
	heldE = "aaaaaaaa-0000-4000-8000-00000000000e"
	heldF = "aaaaaaaa-0000-4000-8000-00000000000f"
)

// Creation replies before Pi is ready. Messages sent meanwhile are held under
// their command IDs, reach Pi as one joined prompt, and are never sent twice.
func TestHeldMessagesJoinIntoOnePromptWhileCreating(t *testing.T) {
	h := newHeldHarness(t)
	h.setFile("start-delay", "1.5")
	c, stop := h.daemon()
	defer stop()
	began := time.Now()
	id := h.create(c)
	if elapsed := time.Since(began); elapsed > time.Second {
		t.Fatalf("create waited %s for Pi to become ready", elapsed)
	}
	for _, m := range [][2]string{{"Ensimmäinen", heldA}, {"Toinen", heldB}} {
		if w := h.send(c, id, m[0], m[1]); w.Code != 200 || !strings.Contains(w.Body.String(), `"held"`) {
			t.Fatalf("held send: %d %s", w.Code, w.Body.String())
		}
	}
	if w := h.send(c, id, "Ensimmäinen", heldA); w.Code != 409 {
		t.Fatalf("a repeated command ID must not be held twice: %d", w.Code)
	}
	if _, view := h.status(c, id); view.State != "starting" || len(view.Held) != 2 || view.Held[0].CommandID != heldA || view.Held[1].Text != "Toinen" {
		t.Fatalf("status while starting: %+v", view)
	}
	h.eventually("held prompt accepted", func() bool {
		return h.receipt(c, id, heldA) == "accepted" && h.receipt(c, id, heldB) == "accepted"
	})
	h.eventually("turn settled", func() bool { _, v := h.status(c, id); return v.State == "idle" })
	if prompts := h.prompts(); len(prompts) != 1 || prompts[0] != "Ensimmäinen\n\nToinen" {
		t.Fatalf("native prompts: %q", prompts)
	}
	if _, view := h.status(c, id); len(view.Held) != 0 {
		t.Fatalf("delivered messages still held: %+v", view.Held)
	}
}

// After a daemon restart a browser conversation opens as stopped history;
// opening it starts nothing. Stop before Pi runs returns exactly the held text
// and leaves no Pi running. The next send resumes and delivers exactly once.
func TestHeldMessagesAcrossDaemonRestart(t *testing.T) {
	h := newHeldHarness(t)
	first, stopFirst := h.daemon()
	id := h.create(first)
	if w := h.send(first, id, "Alku", heldA); w.Code != 200 {
		t.Fatalf("first send: %d %s", w.Code, w.Body.String())
	}
	h.eventually("first turn settled", func() bool {
		_, v := h.status(first, id)
		return v.State == "idle" && h.receipt(first, id, heldA) == "accepted"
	})
	stopFirst()
	h.eventually("first incarnation's Pi reaped", func() bool {
		first.mu.Lock()
		defer first.mu.Unlock()
		return first.sessions[id].dead
	})

	second, stopSecond := h.daemon()
	defer stopSecond()
	launches := len(h.lines("launches.log"))
	code, view := h.status(second, id)
	if code != 200 || view.State != "stopped" || view.WorkspaceID != h.workspace || len(view.Held) != 0 {
		t.Fatalf("stopped status: %d %+v", code, view)
	}
	time.Sleep(200 * time.Millisecond)
	if got := len(h.lines("launches.log")); got != launches {
		t.Fatalf("opening a stopped conversation launched Pi: %d -> %d", launches, got)
	}

	// Stop before Pi runs: the message comes back and Pi does not stay running.
	h.setFile("start-delay", "1.5")
	if w := h.send(second, id, "Peruttava", heldB); w.Code != 200 || !strings.Contains(w.Body.String(), `"held"`) {
		t.Fatalf("lazy send: %d %s", w.Code, w.Body.String())
	}
	w := h.post(func(w http.ResponseWriter, r *http.Request) { second.cancelHeld(w, r, id) }, fmt.Sprintf(`{"command_id":%q}`, heldC))
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"returned":[{"command_id":"`+heldB+`","text":"Peruttava"}]`) {
		t.Fatalf("cancel held: %d %s", w.Code, w.Body.String())
	}
	if got := h.receipt(second, id, heldB); got != "cancelled" {
		t.Fatalf("cancelled receipt: %s", got)
	}
	h.eventually("lazily started Pi stopped again", func() bool {
		second.mu.Lock()
		s := second.sessions[id]
		done := s.dead && s.state == "stopped"
		second.mu.Unlock()
		return done
	})
	if prompts := h.prompts(); len(prompts) != 1 {
		t.Fatalf("a cancelled message reached Pi: %q", prompts)
	}

	// The next send resumes the native session and is delivered once.
	h.setFile("start-delay", "")
	if w := h.send(second, id, "Jatko", heldD); w.Code != 200 || !strings.Contains(w.Body.String(), `"held"`) {
		t.Fatalf("resume send: %d %s", w.Code, w.Body.String())
	}
	h.eventually("resumed prompt accepted", func() bool { return h.receipt(second, id, heldD) == "accepted" })
	h.eventually("resumed turn settled", func() bool { _, v := h.status(second, id); return v.State == "idle" })
	if prompts := h.prompts(); len(prompts) != 2 || prompts[1] != "Jatko" {
		t.Fatalf("native prompts after resume: %q", prompts)
	}
	if w := h.send(second, id, "Jatko", heldD); w.Code != 409 {
		t.Fatalf("a delivered command ID was accepted again: %d", w.Code)
	}
}

// A failed start keeps every held message; a retry joins them with the next.
func TestHeldMessagesSurviveFailedStart(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	h.setFile("start-fail", "1")
	id := h.create(c)
	if w := h.send(c, id, "Säilyy", heldE); w.Code != 200 {
		t.Fatalf("held send: %d %s", w.Code, w.Body.String())
	}
	h.eventually("start failed", func() bool { _, v := h.status(c, id); return v.State == "start_failed" })
	if _, view := h.status(c, id); len(view.Held) != 1 || view.Held[0].Text != "Säilyy" || view.StartProblem == "" {
		t.Fatalf("failed start lost the held message: %+v", view)
	}
	if got := h.receipt(c, id, heldE); got != "held" {
		t.Fatalf("receipt after failed start: %s", got)
	}
	h.setFile("start-fail", "")
	if w := h.send(c, id, "Uusi", heldF); w.Code != 200 {
		t.Fatalf("retry send: %d %s", w.Code, w.Body.String())
	}
	h.eventually("retried prompt accepted", func() bool {
		return h.receipt(c, id, heldE) == "accepted" && h.receipt(c, id, heldF) == "accepted"
	})
	if prompts := h.prompts(); len(prompts) != 1 || prompts[0] != "Säilyy\n\nUusi" {
		t.Fatalf("native prompts after retry: %q", prompts)
	}
}

// Terminal history has no browser origin: a send is refused, never held.
func TestHeldRefusesTerminalHistory(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	const id = ownershipTestID
	dir := filepath.Join(h.root, ".pi", "agent", "sessions", "terminal")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	header := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, filepath.Join(h.root, "src", "project"))
	if err := os.WriteFile(filepath.Join(dir, "x_"+id+".jsonl"), []byte(header), 0600); err != nil {
		t.Fatal(err)
	}
	if code, _ := h.status(c, id); code != 404 {
		t.Fatalf("terminal history offered as resumable: %d", code)
	}
	if w := h.send(c, id, "Ei", heldA); w.Code != 409 {
		t.Fatalf("terminal send: %d %s", w.Code, w.Body.String())
	}
	if len(h.lines("launches.log")) != 0 {
		t.Fatal("terminal send launched Pi")
	}
}

// A joined prompt carries several command IDs. If Pi dies before answering it,
// every one of them becomes uncertain; none stays pending forever.
func TestHeldJoinedReceiptsAllResolveWhenPiDies(t *testing.T) {
	h := newHeldHarness(t)
	h.setFile("start-delay", "1")
	h.setFile("prompt-exit", "1")
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	for _, m := range [][2]string{{"yksi", heldA}, {"kaksi", heldB}} {
		if w := h.send(c, id, m[0], m[1]); w.Code != 200 {
			t.Fatalf("held send: %d %s", w.Code, w.Body.String())
		}
	}
	h.eventually("both receipts resolved", func() bool {
		return h.receipt(c, id, heldA) == "uncertain" && h.receipt(c, id, heldB) == "uncertain"
	})
}

// A direct send to a ready Pi never overtakes messages that are still held:
// they reach Pi first, joined with it, in one prompt.
func TestHeldMessagesGoBeforeADirectSend(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.eventually("ready", func() bool { _, v := h.status(c, id); return v.State == "idle" })
	// The readiness window in which a held message can remain while Pi is idle.
	c.mu.Lock()
	s := c.sessions[id]
	s.held = append(s.held, heldMessage{id: heldA, text: "odottanut"})
	s.commands[heldA] = true
	c.receipt(s, heldA, "held")
	c.mu.Unlock()
	if w := h.send(c, id, "suora", heldB); w.Code != 200 || !strings.Contains(w.Body.String(), `"pending"`) {
		t.Fatalf("direct send: %d %s", w.Code, w.Body.String())
	}
	h.eventually("joined prompt accepted", func() bool {
		return h.receipt(c, id, heldA) == "accepted" && h.receipt(c, id, heldB) == "accepted"
	})
	if prompts := h.prompts(); len(prompts) != 1 || prompts[0] != "odottanut\n\nsuora" {
		t.Fatalf("native prompts: %q", prompts)
	}
}

// Pipe EOF can precede Wait, especially under CPU pressure. Neither the event
// drain nor readiness failure may advertise a retry while the old child still
// holds its writer lock.
func TestFailedStartWaitsForChildReapBeforeRetry(t *testing.T) {
	inR, inW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer inR.Close()
	defer inW.Close()
	outR, outW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer outR.Close()
	defer outW.Close()
	p := &piRPC{in: inW, out: outR, done: make(chan struct{}), exited: make(chan struct{}), events: make(chan json.RawMessage)}
	close(p.done)
	close(p.events)
	s := &conversation{id: "startup", rpc: p, state: "starting", held: []heldMessage{{id: heldE, text: "keep"}}}
	c := &ConversationController{sessions: map[string]*conversation{s.id: s}}
	c.drain(s)
	c.mu.Lock()
	state := s.state
	c.mu.Unlock()
	if state != "starting" {
		t.Errorf("EOF advertised %q before child reap", state)
	}
	// Exercise readiness independently of the event drain's state change.
	s.state = "starting"
	finished := make(chan struct{})
	go func() { c.awaitReady(s); close(finished) }()
	defer func() {
		select {
		case <-p.exited:
		default:
			close(p.exited)
		}
		<-finished
	}()
	deadline := time.After(3 * time.Second)
	for !p.closing.Load() {
		select {
		case <-deadline:
			t.Fatal("readiness failure did not close RPC")
		default:
			time.Sleep(time.Millisecond)
		}
	}
	c.mu.Lock()
	state = s.state
	held := len(s.held)
	c.mu.Unlock()
	if state != "starting" || held != 1 {
		t.Fatalf("before reap: state=%q held=%d", state, held)
	}
	close(p.exited)
	c.watch(s)
	<-finished
	if s.state != "start_failed" || len(s.held) != 1 || s.held[0].text != "keep" {
		t.Fatalf("after reap: state=%q held=%v", s.state, s.held)
	}
}
