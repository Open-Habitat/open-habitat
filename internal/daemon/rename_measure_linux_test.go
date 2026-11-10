//go:build linux

package daemon

import (
	"github.com/open-habitat/open-habitat/internal/core"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestRestingRenameNative(t *testing.T) {
	p, _ := piFixture(t)
	h := newHeldHarness(t)
	namingFakePi(t, h)
	c, stop := h.daemon()
	id := h.create(c)
	h.eventually("idle", func() bool { _, s := h.status(c, id); return s.State == "idle" })
	if w := h.send(c, id, "Synthetic topic", heldA); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	h.eventually("settled", func() bool { c.mu.Lock(); defer c.mu.Unlock(); return c.sessions[id].settled && !c.sessions[id].naming })
	stop()
	h.runtime = &core.PiRuntimeConfig{Node: p.Node, Entry: p.Entry, Manifest: p.Manifest}
	c, stop = h.daemon()
	defer stop()
	c.fixture = false
	// A native extension is irrelevant to a name write. Loading it used to
	// dominate the first rename; it must not run at all on the settled path.
	extDir := filepath.Join(h.root, ".pi", "agent", "extensions")
	if err := os.MkdirAll(extDir, 0700); err != nil {
		t.Fatal(err)
	}
	extension := `import { writeFileSync } from 'node:fs';
await new Promise(resolve => setTimeout(resolve, 2000));
writeFileSync(process.env.HOME + '/rename-extension-loaded', 'loaded');
export default function() {}`
	if err := os.WriteFile(filepath.Join(extDir, "slow.ts"), []byte(extension), 0600); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"First native rename", "Second native rename"} {
		start := time.Now()
		code, state := h.rename(c, id, h.workspace, name)
		t.Logf("resting rename %q: %s (%d %s)", name, time.Since(start), code, state)
		if code != 200 || state != "done" {
			t.Fatalf("rename: %d %s", code, state)
		}
		if got := h.nativeName(id); got != name {
			t.Fatalf("name: %q", got)
		}
	}
	if _, err := os.Stat(filepath.Join(h.root, "rename-extension-loaded")); !os.IsNotExist(err) {
		t.Fatal("rename loaded a user extension")
	}
}
