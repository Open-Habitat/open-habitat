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
	"testing"
)

func TestHistoryTitleAllowsColdPiStartup(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	id := h.create(c)
	h.eventually("idle", func() bool { _, s := h.status(c, id); return s.State == "idle" })
	if w := h.send(c, id, "Synthetic topic", heldA); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	h.eventually("settled", func() bool {
		c.mu.Lock()
		defer c.mu.Unlock()
		return c.sessions[id].settled && !c.sessions[id].naming
	})
	stop()
	// Model the real cold runtime: extensions load before Pi reads its first
	// command. Only resumed children wait; the initial conversation is settled.
	script := strings.Replace(heldFakePi, "for line in sys.stdin:\n    r=json.loads(line)", "if existing: time.sleep(4.3)\nfor line in sys.stdin:\n    r=json.loads(line)", 1)
	script = strings.Replace(script, `    elif r["type"]=="get_commands":`, `    elif r["type"]=="set_session_name":
        append(dict(type="session_info",name=r["name"]))
        out(dict(type="response",id=r["id"],command=r["type"],success=True))
    elif r["type"]=="get_commands":`, 1)
	if err := os.WriteFile(h.runtime.Node, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	c, stop = h.daemon()
	defer stop()
	c.titleGenerator = func(string) (string, error) { return "Cold startup title", nil }
	w := h.post(func(w http.ResponseWriter, r *http.Request) { c.historyTitle(w, r, id) }, fmt.Sprintf(`{"workspace_id":%q}`, h.workspace))
	var reply struct{ State, Reason string }
	if err := json.Unmarshal(w.Body.Bytes(), &reply); err != nil {
		t.Fatal(err)
	}
	if w.Code != 200 || reply.State != "done" {
		t.Fatalf("cold Pi retitle: %d %+v", w.Code, reply)
	}
	sessions, err := nativeSessions(h.cfg)
	if err != nil || len(sessions) != 1 {
		t.Fatalf("native sessions: %v %v", sessions, err)
	}
	if name, ok := nativeNameExact(sessions[0], h.cfg.UID); !ok || name != "Cold startup title" {
		t.Fatalf("native name: %q %t", name, ok)
	}
	launches, err := os.ReadFile(filepath.Join(h.root, "launches.log"))
	if err != nil || strings.Count(string(launches), id+"\n") != 2 {
		t.Fatalf("expected initial child and exactly one temporary writer: %q %v", launches, err)
	}
}

// A live-title request that arrives after the conversation's Pi ended names
// the settled history instead of refusing it as uncontrolled.
func TestRegenerateTitleAfterPiEndedUsesSettledHistory(t *testing.T) {
	h := newHeldHarness(t)
	script := strings.Replace(heldFakePi, `    elif r["type"]=="get_commands":`, `    elif r["type"]=="set_session_name":
        append(dict(type="session_info",name=r["name"]))
        out(dict(type="response",id=r["id"],command=r["type"],success=True))
    elif r["type"]=="get_commands":`, 1)
	if err := os.WriteFile(h.runtime.Node, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.eventually("idle", func() bool { _, s := h.status(c, id); return s.State == "idle" })
	if w := h.send(c, id, "Synthetic topic", heldA); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	h.eventually("settled", func() bool {
		c.mu.Lock()
		defer c.mu.Unlock()
		return c.sessions[id].settled && !c.sessions[id].naming
	})
	c.mu.Lock()
	child := c.sessions[id].rpc.cmd.Process
	c.mu.Unlock()
	if err := child.Kill(); err != nil {
		t.Fatal(err)
	}
	h.eventually("stopped", func() bool { _, s := h.status(c, id); return s.State == "stopped" })
	c.titleGenerator = func(string) (string, error) { return "Settled after exit", nil }
	w := httptest.NewRecorder()
	c.regenerateTitle(w, httptest.NewRequest("POST", "http://unix/regenerate_title", nil), id)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"done"`) {
		t.Fatalf("title after Pi ended: %d %s", w.Code, w.Body.String())
	}
	sessions, err := nativeSessions(h.cfg)
	if err != nil || len(sessions) != 1 {
		t.Fatalf("native sessions: %v %v", sessions, err)
	}
	if name, ok := nativeNameExact(sessions[0], h.cfg.UID); !ok || name != "Settled after exit" {
		t.Fatalf("native name: %q %t", name, ok)
	}
}
