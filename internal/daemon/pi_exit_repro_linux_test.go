//go:build linux

package daemon

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/core"
)

// Opt-in against an installed runtime, never the caller's home or credentials.
func TestRuntimePiWakeCancelExitRepro(t *testing.T) {
	runtime := os.Getenv("OH_EXIT_REPRO_RUNTIME")
	if runtime == "" {
		t.Skip("set OH_EXIT_REPRO_RUNTIME to a runtime payload")
	}
	h := newHeldHarness(t)
	h.runtime = &core.PiRuntimeConfig{Node: filepath.Join(runtime, "bin/node"), Entry: filepath.Join(runtime, "node_modules/@earendil-works/pi-coding-agent/dist/cli.js")}
	dir := filepath.Join(h.root, ".pi/agent/extensions")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	// Keep startup pending long enough to hold and cancel a message without
	// contacting a model. No personal settings or extensions are copied.
	if err := os.WriteFile(filepath.Join(dir, "delay.mjs"), []byte("await new Promise(r => setTimeout(r, 2000)); export default function() {}"), 0600); err != nil {
		t.Fatal(err)
	}
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	for i := 0; i < 5; i++ {
		w := httptest.NewRecorder()
		c.continueEnded(w, httptest.NewRequest(http.MethodPost, "http://unix/x", nil), id)
		if w.Code != 200 {
			t.Fatalf("continue: %d %s", w.Code, w.Body.String())
		}
	}
	if w := h.send(c, id, "synthetic held message", heldA); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if got := h.receipt(c, id, heldA); got != "held" {
		t.Fatalf("receipt %q", got)
	}
	w := h.post(func(w http.ResponseWriter, r *http.Request) { c.cancelHeld(w, r, id) }, `{"command_id":"aaaaaaaa-0000-4000-8000-00000000000b"}`)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	h.eventually("ready after cancel", func() bool { _, s := h.status(c, id); return s.State == "idle" })
	c.mu.Lock()
	p := c.sessions[id].rpc
	c.mu.Unlock()
	select {
	case <-p.exited:
		t.Fatalf("unasked exit: %s; stderr=%s", crashDetail(p.inputEndCause(), p.cmd.ProcessState), p.stderrDiagnostics.lastClass())
	case <-time.After(3 * time.Second):
	}
	t.Log("five continues, held send and cancel: Pi remains alive with input open")
}
