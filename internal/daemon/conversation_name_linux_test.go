//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// namingFakePi keeps a session name as real Pi does: in memory until the
// session has a message, then in the file before that message.
func namingFakePi(t *testing.T, h *heldHarness) {
	t.Helper()
	script := strings.Replace(heldFakePi, `        ms=int(time.time()*1000)
        append(dict(type="message",message=dict(role="user"`, `        ms=int(time.time()*1000)
        for n in PENDING: append(dict(type="session_info",name=n))
        PENDING.clear()
        append(dict(type="message",message=dict(role="user"`, 1)
	script = strings.Replace(script, `    elif r["type"]=="get_commands":`, `    elif r["type"]=="set_session_name":
        open(os.path.join(home,"names.log"),"a").write(r["name"]+"\n")
        if os.path.exists(path): append(dict(type="session_info",name=r["name"]))
        else: PENDING.append(r["name"])
        out(dict(type="response",id=r["id"],command=r["type"],success=True))
    elif r["type"]=="get_commands":`, 1)
	script = strings.Replace(script, "for line in sys.stdin:\n    r=json.loads(line)\n    if r[\"type\"]==\"get_state\"", "PENDING=[]\nfor line in sys.stdin:\n    r=json.loads(line)\n    if r[\"type\"]==\"get_state\"", 1)
	if !strings.Contains(script, "PENDING=[]") || !strings.Contains(script, "for n in PENDING") || !strings.Contains(script, `"set_session_name"`) {
		t.Fatal("fake Pi patch did not apply")
	}
	if err := os.WriteFile(h.runtime.Node, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
}

func (h *heldHarness) rename(c *ConversationController, id, workspace, name string) (int, string) {
	b, _ := json.Marshal(map[string]string{"workspace_id": workspace, "name": name})
	w := h.post(func(w http.ResponseWriter, r *http.Request) { c.nameByHand(w, r, id) }, string(b))
	var reply struct{ State string }
	_ = json.Unmarshal(w.Body.Bytes(), &reply)
	return w.Code, reply.State
}

func (h *heldHarness) nativeName(id string) string {
	h.t.Helper()
	sessions, err := nativeSessions(h.cfg)
	if err != nil {
		h.t.Fatal(err)
	}
	for _, s := range sessions {
		if s.id == id {
			name, ok := nativeNameExact(s, h.cfg.UID)
			if !ok {
				h.t.Fatalf("unreadable native name of %s", id)
			}
			return name
		}
	}
	return ""
}

func (h *heldHarness) snapshotTitle(c *ConversationController, id string) (string, string) {
	h.t.Helper()
	handler := snapshotHandlerWithController(h.cfg, func(*http.Request) bool { return true },
		func(transport.Config) Discovery { return scan(h.root, h.cfg.UID, unix.Openat2, false) },
		nativeSessions, h.root, unknownGitHub, c.journal, c)
	r := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
	r.RequestURI = SnapshotPath
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	var doc struct {
		Agents []struct {
			ID    string `json:"agent_id"`
			Title struct {
				Display string `json:"display"`
				Source  string `json:"source"`
			} `json:"title"`
		} `json:"agents"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &doc) != nil {
		h.t.Fatalf("snapshot: %d %s", w.Code, w.Body.String())
	}
	for _, a := range doc.Agents {
		if a.ID == "pi:"+id {
			return a.Title.Display, a.Title.Source
		}
	}
	h.t.Fatalf("snapshot lacks %s", id)
	return "", ""
}

// A goal's name given at creation is Pi's own session name from the first
// message on, shows before Pi has a file, and no automatic title replaces it.
// A later hand-given name replaces it, live and on a settled history alike.
func TestGivenNameIsNativeAndWinsOverAutomaticTitles(t *testing.T) {
	h := newHeldHarness(t)
	namingFakePi(t, h)
	h.setFile("start-delay", "0.5")
	c, stop := h.daemon()
	var generated atomic.Int32
	c.titleGenerator = func(string) (string, error) { generated.Add(1); return "Automatic title", nil }
	w := h.post(c.create, fmt.Sprintf(`{"workspace_id":%q,"name":"Viikkoraportti"}`, h.workspace))
	if w.Code != 200 {
		t.Fatalf("create: %d %s", w.Code, w.Body.String())
	}
	var created struct {
		AgentID string `json:"agent_id"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &created)
	id := strings.TrimPrefix(created.AgentID, "pi:")
	h.eventually("goal name accepted", func() bool {
		c.mu.Lock()
		defer c.mu.Unlock()
		return c.sessions[id].givenName == "Viikkoraportti"
	})
	if title, source := h.snapshotTitle(c, id); title != "Viikkoraportti" || source != "native_session" {
		t.Fatalf("title before Pi's file: %q %q", title, source)
	}
	if w := h.send(c, id, "Kirjoita raportti", heldA); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	h.eventually("first turn named", func() bool {
		c.mu.Lock()
		defer c.mu.Unlock()
		return c.sessions[id].settled && c.sessions[id].automaticFirst && !c.sessions[id].naming
	})
	if name := h.nativeName(id); name != "Viikkoraportti" {
		t.Fatalf("native name after first message: %q", name)
	}
	if generated.Load() != 0 {
		t.Fatal("generated a title over the goal's name")
	}

	// Renaming a running conversation goes to its Pi.
	if code, state := h.rename(c, id, h.workspace, "Oma nimi"); code != 200 || state != "done" {
		t.Fatalf("live rename: %d %s", code, state)
	}
	if name := h.nativeName(id); name != "Oma nimi" {
		t.Fatalf("native name after live rename: %q", name)
	}
	for _, bad := range []string{"", " Oma", "Oma ", "Rivi\nkaksi", strings.Repeat("ä", 81)} {
		if code, _ := h.rename(c, id, h.workspace, bad); code != 400 {
			t.Fatalf("name %q: %d", bad, code)
		}
	}

	// A hand-given name lands while an automatic title is being generated:
	// it does not wait for the model, and the automatic title then yields.
	other := h.create(c)
	entered, release := make(chan struct{}, 1), make(chan struct{})
	c.mu.Lock()
	c.titleGenerator = func(string) (string, error) { entered <- struct{}{}; <-release; return "Automatic title", nil }
	c.mu.Unlock()
	h.eventually("other idle", func() bool { _, v := h.status(c, other); return v.State == "idle" })
	if w := h.send(c, other, "Toinen aihe", heldB); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	<-entered
	if code, state := h.rename(c, other, h.workspace, "Käsin"); code != 200 || state != "done" {
		t.Fatalf("rename during generation: %d %s", code, state)
	}
	close(release)
	h.eventually("automatic naming ended", func() bool {
		c.mu.Lock()
		defer c.mu.Unlock()
		return !c.sessions[other].naming
	})
	if name := h.nativeName(other); name != "Käsin" {
		t.Fatalf("automatic title replaced a given name: %q", name)
	}
	stop()

	// After a restart there is no handle: a temporary Pi writes the name.
	c, stop = h.daemon()
	defer stop()
	if code, state := h.rename(c, id, h.workspace, "Kolmas nimi"); code != 200 || state != "done" {
		t.Fatalf("history rename: %d %s", code, state)
	}
	if name := h.nativeName(id); name != "Kolmas nimi" {
		t.Fatalf("native name after history rename: %q", name)
	}
	if title, _ := h.snapshotTitle(c, id); title != "Kolmas nimi" {
		t.Fatalf("snapshot title: %q", title)
	}
}

// A name given while Pi still starts is held and written once Pi is ready,
// replacing the one given at creation.
func TestGivenNameWhileStartingIsWrittenWhenReady(t *testing.T) {
	h := newHeldHarness(t)
	namingFakePi(t, h)
	h.setFile("start-delay", "1")
	c, stop := h.daemon()
	defer stop()
	w := h.post(c.create, fmt.Sprintf(`{"workspace_id":%q,"name":"Tavoitteen nimi"}`, h.workspace))
	var created struct {
		AgentID string `json:"agent_id"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &created) != nil {
		t.Fatalf("create: %d %s", w.Code, w.Body.String())
	}
	id := strings.TrimPrefix(created.AgentID, "pi:")
	if code, state := h.rename(c, id, h.workspace, "Toinen"); code != 200 || state != "held" {
		t.Fatalf("rename while starting: %d %s", code, state)
	}
	h.eventually("held name written", func() bool { return len(h.lines("names.log")) == 1 })
	if names := h.lines("names.log"); names[0] != "Toinen" {
		t.Fatalf("Pi was given %q", names)
	}
	if b, err := os.ReadFile(filepath.Join(h.root, "launches.log")); err != nil || strings.Count(string(b), "\n") != 1 {
		t.Fatalf("a held name must not start another Pi: %q", b)
	}
}

// Pi holds a name in memory until the first message. A fresh child started
// again for the same empty conversation is given it again: after a failed
// first start, and after Pi ended before anything was written.
func TestGivenNameSurvivesFreshRelaunch(t *testing.T) {
	h := newHeldHarness(t)
	namingFakePi(t, h)
	c, stop := h.daemon()
	defer stop()
	h.setFile("start-fail", "1")
	w := h.post(c.create, fmt.Sprintf(`{"workspace_id":%q,"name":"Tavoite"}`, h.workspace))
	var created struct {
		AgentID string `json:"agent_id"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &created) != nil {
		t.Fatalf("create: %d %s", w.Code, w.Body.String())
	}
	id := strings.TrimPrefix(created.AgentID, "pi:")
	h.eventually("start failed", func() bool { _, v := h.status(c, id); return v.State == "start_failed" })
	h.setFile("start-fail", "")
	h.setFile("prompt-reject", "1")
	if w := h.send(c, id, "Ensimmäinen", heldA); w.Code != 200 {
		t.Fatalf("retry send: %d %s", w.Code, w.Body.String())
	}
	h.eventually("goal name given to the retried Pi", func() bool { return len(h.lines("names.log")) == 1 })

	// A hand-given name, then Pi ends before the first message.
	h.eventually("idle", func() bool { _, v := h.status(c, id); return v.State != "starting" && v.State != "pending" })
	if code, state := h.rename(c, id, h.workspace, "Käsin annettu"); code != 200 || state != "done" {
		t.Fatalf("rename: %d %s", code, state)
	}
	c.mu.Lock()
	s := c.sessions[id]
	c.mu.Unlock()
	_ = s.rpc.close()
	h.eventually("Pi ended", func() bool { c.mu.Lock(); defer c.mu.Unlock(); return s.dead })
	if title, _ := h.snapshotTitle(c, id); title != "Käsin annettu" {
		t.Fatalf("title after Pi ended: %q", title)
	}
	h.setFile("prompt-reject", "")
	if w := h.send(c, id, "Toinen", heldB); w.Code != 200 {
		t.Fatalf("send after Pi ended: %d %s", w.Code, w.Body.String())
	}
	h.eventually("turn settled", func() bool { return h.receipt(c, id, heldB) == "accepted" && h.nativeName(id) != "" })
	if name := h.nativeName(id); name != "Käsin annettu" {
		t.Fatalf("native name after relaunch: %q", name)
	}
}
