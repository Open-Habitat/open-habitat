//go:build linux

package daemon

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"
)

func quarantines(t *testing.T, path string) []string {
	t.Helper()
	found, err := filepath.Glob(path + ".partial-*")
	if err != nil {
		t.Fatal(err)
	}
	return found
}

// Only the final, non-newline-terminated JSON prefix goes; every original
// byte is kept next to the file first, and complete lines are never touched.
func TestCutPartialTailQuarantinesOriginal(t *testing.T) {
	home := t.TempDir()
	id := "12345678-1234-4123-8123-123456789abc"
	prefix := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, home) + `{"type":"message","id":"first","parentId":null,"message":{"role":"user","content":"saved"}}` + "\n"
	for i, tail := range []string{`{"type":"message","id":"last","message":{"content":"cut`, "{\"text\":\"\xe2\x82"} {
		path := filepath.Join(home, fmt.Sprintf("s%d.jsonl", i))
		if err := os.WriteFile(path, []byte(prefix+tail), 0600); err != nil {
			t.Fatal(err)
		}
		if cutOff, err := reconciledNativeTail(path, os.Geteuid(), id, home); err != nil || !cutOff {
			t.Fatalf("cut-off tail not admitted: %v %v", cutOff, err)
		}
		quarantine, removed, err := cutPartialTail(path, os.Geteuid(), id, home, time.Now())
		if err != nil || removed != len(tail) {
			t.Fatalf("cut: %v removed %d", err, removed)
		}
		if got, _ := os.ReadFile(path); string(got) != prefix {
			t.Fatalf("native file after cut: %q", got)
		}
		kept, err := os.ReadFile(quarantine)
		if err != nil || string(kept) != prefix+tail {
			t.Fatalf("quarantine copy: %q %v", kept, err)
		}
		if info, _ := os.Stat(quarantine); info.Mode().Perm() != 0600 || filepath.Ext(quarantine) == ".jsonl" {
			t.Fatalf("quarantine %s mode %v", quarantine, info.Mode())
		}
		if _, err := reconciledNativeHistory(path, os.Geteuid(), id, home); err != nil {
			t.Fatalf("repaired history not admitted: %v", err)
		}
	}
	// Damage that is not a cut-off tail is refused and left as it is: a
	// complete corrupt line, also when a cut-off tail follows it, and a
	// complete file.
	for i, content := range []string{prefix + "{bad\n", prefix + "{bad\n" + `{"type":"mess`, prefix + "\x00\x00\x00", prefix} {
		path := filepath.Join(home, fmt.Sprintf("d%d.jsonl", i))
		if err := os.WriteFile(path, []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
		if _, _, err := cutPartialTail(path, os.Geteuid(), id, home, time.Now()); err == nil {
			t.Fatalf("cut %q", content)
		}
		if got, _ := os.ReadFile(path); string(got) != content || len(quarantines(t, path)) != 0 {
			t.Fatalf("refused cut changed %q", content)
		}
		if _, err := reconciledNativeTail(path, os.Geteuid(), id, home); content != prefix && err != errHistoryDamaged {
			t.Fatalf("damage %q not reported as damage: %v", content, err)
		}
	}
}

// A file someone else holds open, as a terminal Pi mid-append would, is not
// cut: the write lease that keeps appends out cannot be taken.
func TestPartialTailOpenElsewhereIsNotCut(t *testing.T) {
	home := t.TempDir()
	id := "12345678-1234-4123-8123-123456789abc"
	path := filepath.Join(home, "s.jsonl")
	content := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, home) + `{"type":"thinking","id":"x`
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
	writer, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := cutPartialTail(path, os.Geteuid(), id, home, time.Now()); err == nil {
		t.Fatal("cut while the file was open elsewhere")
	}
	writer.Close()
	if got, _ := os.ReadFile(path); string(got) != content || len(quarantines(t, path)) != 0 {
		t.Fatal("a refused cut changed the history")
	}
	if _, _, err := cutPartialTail(path, os.Geteuid(), id, home, time.Now()); err != nil {
		t.Fatalf("cut after the writer closed: %v", err)
	}
}

// The quota that cut Pi's write may still be full: a quarantine copy that
// cannot be written leaves the native file exactly as it was, and says why.
func TestPartialTailUnderFullQuotaKeepsFile(t *testing.T) {
	home := t.TempDir()
	id := "12345678-1234-4123-8123-123456789abc"
	path := filepath.Join(home, "s.jsonl")
	content := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, home) + `{"type":"thinking","id":"x`
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
	original := writeQuarantine
	defer func() { writeQuarantine = original }()
	writeQuarantine = func(f *os.File, b []byte) error {
		_, _ = f.Write(b[:len(b)/2])
		return &os.PathError{Op: "write", Path: f.Name(), Err: syscall.EDQUOT}
	}
	c := &ConversationController{}
	c.cfg.UID = os.Geteuid()
	if got := c.readyNativeTail(path, id, home); got != "quota_full" {
		t.Fatalf("problem %q", got)
	}
	if got, _ := os.ReadFile(path); string(got) != content || len(quarantines(t, path)) != 0 {
		t.Fatal("a failed quarantine changed the history or left a partial copy")
	}
	writeQuarantine = original
	if got := c.readyNativeTail(path, id, home); got != "" {
		t.Fatalf("problem after space was freed %q", got)
	}
	if got, _ := os.ReadFile(path); !strings.HasSuffix(string(got), "}\n") {
		t.Fatalf("tail kept: %q", got)
	}
}

// Jari's outage (29.10.2026): Pi's last write was cut by a full quota, the
// daemon stopped, and the conversation could not be woken. A send after the
// restart now quarantines the fragment, resumes the same native session and
// delivers the message once; the earlier history stays byte for byte.
func TestCutOffHistoryResumesAfterRestart(t *testing.T) {
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
	files, _ := filepath.Glob(filepath.Join(h.root, ".pi/agent/sessions/*/*_"+id+".jsonl"))
	if len(files) != 1 {
		t.Fatalf("session files: %v", files)
	}
	path := files[0]
	saved, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	tail := `{"type":"message","id":"cut00001","message":{"role":"assistant","content":[{"type":"thinking","thinking":"kesken`
	if err := os.WriteFile(path, append(append([]byte{}, saved...), tail...), 0600); err != nil {
		t.Fatal(err)
	}

	second, stopSecond := h.daemon()
	defer stopSecond()
	if w := h.send(second, id, "Jatko", heldB); w.Code != 200 {
		t.Fatalf("resume send: %d %s", w.Code, w.Body.String())
	}
	h.eventually("resumed prompt accepted", func() bool { return h.receipt(second, id, heldB) == "accepted" })
	h.eventually("resumed turn settled", func() bool { _, v := h.status(second, id); return v.State == "idle" })
	if prompts := h.prompts(); len(prompts) != 2 || prompts[1] != "Jatko" {
		t.Fatalf("native prompts after resume: %q", prompts)
	}
	got, _ := os.ReadFile(path)
	if !strings.HasPrefix(string(got), string(saved)) || strings.Contains(string(got), "kesken") {
		t.Fatalf("history after resume:\n%s", got)
	}
	if native := readNativeSettled(path, h.cfg.UID); native.state != "readable" || native.cutOff {
		t.Fatalf("resumed history: %+v", native)
	}
	kept := quarantines(t, path)
	if len(kept) != 1 {
		t.Fatalf("quarantine copies: %v", kept)
	}
	if b, _ := os.ReadFile(kept[0]); string(b) != string(saved)+tail {
		t.Fatal("quarantine copy differs from the original bytes")
	}
}

// Damage the daemon must not skip fails the start with its reason, and the
// held message and native file stay as they were.
func TestDamagedHistoryStartFailsWithReason(t *testing.T) {
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
	files, _ := filepath.Glob(filepath.Join(h.root, ".pi/agent/sessions/*/*_"+id+".jsonl"))
	if len(files) != 1 {
		t.Fatalf("session files: %v", files)
	}
	f, err := os.OpenFile(files[0], os.O_APPEND|os.O_WRONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = f.WriteString("{bad\n")
	f.Close()
	damaged, _ := os.ReadFile(files[0])

	second, stopSecond := h.daemon()
	defer stopSecond()
	launches := len(h.lines("launches.log"))
	if w := h.send(second, id, "Jatko", heldB); w.Code != 200 {
		t.Fatalf("send: %d %s", w.Code, w.Body.String())
	}
	h.eventually("start failed", func() bool { _, v := h.status(second, id); return v.State == "start_failed" })
	if _, view := h.status(second, id); view.StartProblem != "history_damaged" || len(view.Held) != 1 {
		t.Fatalf("failed start: %+v", view)
	}
	if got, _ := os.ReadFile(files[0]); string(got) != string(damaged) || len(quarantines(t, files[0])) != 0 {
		t.Fatal("damaged history was changed")
	}
	if got := len(h.lines("launches.log")); got != launches {
		t.Fatal("Pi was started on damaged history")
	}
}
