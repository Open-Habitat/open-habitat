//go:build linux

package daemon

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/wsframe"
)

// startTestPi runs a process that looks like a terminal Pi: argv[0] is pi,
// it works in cwd and carries the given environment.
func startTestPi(t *testing.T, proc, cwd string, env []string, script string) *exec.Cmd {
	t.Helper()
	cmd := exec.Command("bash", "-c", script)
	cmd.Dir, cmd.Env = cwd, append(append(os.Environ(), "TMUX=", "TMUX_PANE="), env...)
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = cmd.Process.Kill(); _ = cmd.Wait() })
	exposeTestProcess(t, proc, cmd.Process.Pid)
	// Wait until bash has become pi.
	for deadline := time.Now().Add(3 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		if raw, _ := os.ReadFile(filepath.Join("/proc", strconv.Itoa(cmd.Process.Pid), "cmdline")); isPiCommand(raw) {
			return cmd
		}
	}
	t.Fatal("test Pi did not start")
	return nil
}

func testProcRoot(t *testing.T) string {
	t.Helper()
	proc := shortDir(t)
	if err := os.Symlink("/proc/stat", filepath.Join(proc, "stat")); err != nil {
		t.Fatal(err)
	}
	return proc
}

// The writer is named only when nothing else of the person's Pi could have
// written the conversation; an open descriptor names it outright.
func TestLocateTerminalPiNamesOnlyAnUnambiguousWriter(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("daemon never runs as root")
	}
	uid := os.Geteuid()
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "work")
	if err := os.MkdirAll(cwd, 0o700); err != nil {
		t.Fatal(err)
	}
	id, otherID := "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"
	path := writeSession(t, home, id, cwd)
	other := writeSession(t, home, otherID, cwd)
	elsewhere := writeSession(t, home, "33333333-3333-4333-8333-333333333333", filepath.Join(home, "src", "else"))
	target := nativeSession{id: id, cwd: cwd, path: path, state: "readable"}
	histories := []nativeSession{target, {id: otherID, cwd: cwd, path: other, state: "readable"}, {cwd: filepath.Join(home, "src", "else"), path: elsewhere}}
	old := time.Now().Add(-time.Hour)
	for _, p := range []string{path, other, elsewhere} {
		if err := os.Chtimes(p, old, old); err != nil {
			t.Fatal(err)
		}
	}
	proc := testProcRoot(t)
	pi := startTestPi(t, proc, cwd, []string{"TMUX=/tmp/tmux-1,2/default,4242,0", "TMUX_PANE=%12"}, "exec -a pi sleep 30")
	locate := func(own map[int]bool) (terminalPi, bool) {
		return locateTerminalPi(proc, target, histories, uid, own, nil)
	}
	if _, ok := locate(nil); ok {
		t.Fatal("named a Pi that started after the conversation's last change")
	}
	now := time.Now().Add(time.Second)
	if err := os.Chtimes(path, now, now); err != nil {
		t.Fatal(err)
	}
	got, ok := locate(nil)
	if !ok || got.pid != pi.Process.Pid || got.socket != "/tmp/tmux-1,2/default" || got.pane != "%12" || got.cwd != cwd {
		t.Fatalf("located %+v %v", got, ok)
	}
	// Another conversation in the directory changed since that Pi started.
	if err := os.Chtimes(other, now, now); err != nil {
		t.Fatal(err)
	}
	if _, ok := locate(nil); ok {
		t.Fatal("named a Pi that may have written another conversation")
	}
	// Unless the daemon's own child writes that one.
	if got, ok := locateTerminalPi(proc, target, histories, uid, nil, map[string]bool{otherID: true}); !ok || got.pid != pi.Process.Pid {
		t.Fatalf("own child's conversation counted: %+v %v", got, ok)
	}
	if err := os.Chtimes(other, old, old); err != nil {
		t.Fatal(err)
	}
	// A second Pi in the directory: either could be the writer, unless it is
	// the daemon's own child.
	second := startTestPi(t, proc, cwd, nil, "exec -a pi sleep 30")
	if _, ok := locate(nil); ok {
		t.Fatal("named one of two Pis in the directory")
	}
	if got, ok := locate(map[int]bool{second.Process.Pid: true}); !ok || got.pid != pi.Process.Pid {
		t.Fatalf("own child not skipped: %+v %v", got, ok)
	}
	// A Pi holding the file is its writer wherever it works; a non-Pi
	// holding it is not.
	reader := exec.Command("bash", "-c", "exec 3<\"$0\"; exec sleep 30", path)
	if err := reader.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = reader.Process.Kill(); _ = reader.Wait() })
	exposeTestProcess(t, proc, reader.Process.Pid)
	holder := startTestPi(t, proc, home, []string{"TMUX_PANE=%3"}, "exec 3<\""+path+"\"; exec -a pi sleep 30")
	if got, ok := locate(nil); !ok || got.pid != holder.Process.Pid || got.socket != "" {
		t.Fatalf("descriptor holder not named: %+v %v", got, ok)
	}
}

func TestTmuxFromEnvironRejectsForgedValues(t *testing.T) {
	for _, env := range []string{
		"TMUX=relative/sock,1,0\x00TMUX_PANE=%1",
		"TMUX=/tmp/../etc/sock,1,0\x00TMUX_PANE=%1",
		"TMUX=/tmp/sock\x00TMUX_PANE=%1",
		"TMUX=/tmp/sock,1,0\x00TMUX_PANE=1",
		"TMUX=/tmp/sock,1,0\x00TMUX_PANE=%1;kill-server",
		"TMUX=/tmp/sock,1,0",
	} {
		if s, p := tmuxFromEnviron([]byte(env)); s != "" || p != "" {
			t.Errorf("%q gave %q %q", env, s, p)
		}
	}
}

// The real path: a Pi in the person's own tmux, on a server the daemon
// reaches only through that Pi's root, shown read-only by its pane.
func TestTerminalWriterPaneIsWatchedReadOnly(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("daemon never runs as root")
	}
	f := newTerminalFixture(t, true)
	proc := testProcRoot(t)
	f.host.proc = proc
	sock := filepath.Join(f.tmp, "ps")
	tmux := func(args ...string) string {
		t.Helper()
		cmd := exec.Command(f.host.tmux, append([]string{"-f", "/dev/null", "-S", sock}, args...)...)
		cmd.Env = append(os.Environ(), "SHELL=/bin/bash", "TMUX=")
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("tmux %v: %s", args, out)
		}
		return strings.TrimSpace(string(out))
	}
	t.Cleanup(func() { _ = exec.Command(f.host.tmux, "-S", sock, "kill-server").Run() })
	tmux("new-session", "-d", "-s", "work", "-x", "100", "-y", "30", "-c", f.cfg.Home)
	pane := tmux("new-window", "-d", "-P", "-F", "#{pane_id}", "-t", "work:", "-n", "pi", "-c", f.dir, "printf 'pi-mirror-marker\\n'; exec -a pi sleep 60")
	pid, err := strconv.Atoi(tmux("display-message", "-p", "-t", pane, "#{pane_pid}"))
	if err != nil {
		t.Fatal(err)
	}
	exposeTestProcess(t, proc, pid)
	for deadline := time.Now().Add(3 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		if raw, _ := os.ReadFile(filepath.Join("/proc", strconv.Itoa(pid), "cmdline")); isPiCommand(raw) {
			break
		}
	}
	id := "44444444-4444-4444-8444-444444444444"
	writeSession(t, f.cfg.Home, id, f.dir)
	outside := "55555555-5555-4555-8555-555555555555"
	writeSession(t, f.cfg.Home, outside, f.cfg.Home)

	writer := func(conversation string) map[string]any {
		t.Helper()
		res, err := f.client().Get("http://unix" + TerminalWriterPath + "?workspace_id=" + f.id + "&conversation=" + conversation)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		var body map[string]any
		if res.StatusCode != 200 || json.NewDecoder(res.Body).Decode(&body) != nil {
			t.Fatalf("writer: %d", res.StatusCode)
		}
		return body
	}
	got := writer(id)
	window := tmux("display-message", "-p", "-t", pane, "#{window_index}")
	if got["place"] != "tmux" || got["session"] != "work" || got["name"] != "pi" || got["window"] != float64(mustAtoi(t, window)) {
		t.Fatalf("writer %+v", got)
	}
	for _, key := range []string{"socket", "pane", "pid", "path"} {
		if _, leaked := got[key]; leaked {
			t.Fatalf("writer answer carries %s: %+v", key, got)
		}
	}
	// A conversation outside the workspace is not this workspace's to show.
	if got := writer(outside); got["place"] != "none" {
		t.Fatalf("outside conversation %+v", got)
	}

	w, code := f.dial(t, "workspace_id="+f.id+"&conversation="+id)
	if code != 101 {
		t.Fatalf("upgrade %d", code)
	}
	w.resize(t, 60, 15)
	w.waitReady(t)
	before := tmux("display-message", "-p", "-t", pane, "#{pane_width} #{pane_height}")
	if w.ready["read_only"] != true || w.ready["conversation"] != id || w.ready["name"] != "work:"+window || strings.Join([]string{strconv.Itoa(int(w.ready["cols"].(float64))), strconv.Itoa(int(w.ready["rows"].(float64)))}, " ") != before {
		t.Fatalf("ready %+v (pane %s)", w.ready, before)
	}
	if !w.until(t, "pi-mirror-marker", 3*time.Second) {
		t.Fatal("pane not shown")
	}
	// The pane's tty would echo anything typed into it.
	w.send(t, wsframe.OpBinary, "typed-into-mirror\r")
	w.resize(t, 40, 10)
	time.Sleep(700 * time.Millisecond)
	if strings.Contains(tmux("capture-pane", "-p", "-t", pane), "typed-into-mirror") {
		t.Fatal("the view typed into the person's pane")
	}
	if got := tmux("display-message", "-p", "-t", pane, "#{pane_width} #{pane_height}"); got != before {
		t.Fatalf("the view resized the person's pane: %s", got)
	}
	if got := tmux("list-clients", "-F", "#{client_name}"); got != "" {
		t.Fatalf("the view attached a client to the person's server: %q", got)
	}
	// Pi exiting ends the view, though its window may live on.
	if err := exec.Command("kill", strconv.Itoa(pid)).Run(); err != nil {
		t.Fatal(err)
	}
	w.until(t, "\x00never", 5*time.Second)
	if w.exit["state"] != "ended" {
		t.Fatalf("view outlived its Pi: %+v", w.exit)
	}
	if got := writer(id); got["place"] != "none" {
		t.Fatalf("writer after exit %+v", got)
	}
	if _, code := f.dial(t, "workspace_id="+f.id+"&conversation="+id); code != 404 {
		t.Fatalf("view of an exited Pi: %d", code)
	}
}

func mustAtoi(t *testing.T, s string) int {
	t.Helper()
	n, err := strconv.Atoi(s)
	if err != nil {
		t.Fatal(err)
	}
	return n
}

func TestTerminalWriterRefusals(t *testing.T) {
	f := newTerminalFixture(t, true)
	mux := TerminalWriterPath + "?"
	for name, q := range map[string]string{
		"no conversation":   "workspace_id=" + f.id,
		"agent prefix":      "workspace_id=" + f.id + "&conversation=pi:44444444-4444-4444-8444-444444444444",
		"path conversation": "workspace_id=" + f.id + "&conversation=..%2F44444444-4444-4444-8444-4444444444",
		"extra pane":        "workspace_id=" + f.id + "&conversation=44444444-4444-4444-8444-444444444444&pane=%251",
		"reordered":         "conversation=44444444-4444-4444-8444-444444444444&workspace_id=" + f.id,
	} {
		res, err := f.client().Get("http://unix" + mux + q)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != 400 {
			t.Errorf("%s: %d", name, res.StatusCode)
		}
	}
	for name, q := range map[string]string{
		"socket in conversation": "workspace_id=" + f.id + "&conversation=%2Ftmp%2Ftmux-1%2Fdefault",
		"both targets":           "workspace_id=" + f.id + "&shell=new&conversation=44444444-4444-4444-8444-444444444444",
	} {
		if _, code := f.dial(t, q); code != 400 {
			t.Errorf("%s: %d", name, code)
		}
	}
	untrusted := newTerminalFixture(t, false)
	res, err := untrusted.client().Get("http://unix" + mux + "workspace_id=" + untrusted.id + "&conversation=44444444-4444-4444-8444-444444444444")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 403 {
		t.Errorf("untrusted peer: %d", res.StatusCode)
	}
}

// TMUX_PANE is inherited text: a Pi that is not running inside the pane it
// names is in a terminal, not a pane the view may show.
func TestTerminalWriterIgnoresAPaneThePiIsNotIn(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("daemon never runs as root")
	}
	f := newTerminalFixture(t, true)
	proc := testProcRoot(t)
	f.host.proc = proc
	sock := filepath.Join(f.tmp, "ps")
	tmux := func(args ...string) string {
		t.Helper()
		cmd := exec.Command(f.host.tmux, append([]string{"-f", "/dev/null", "-S", sock}, args...)...)
		cmd.Env = append(os.Environ(), "SHELL=/bin/bash", "TMUX=")
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("tmux %v: %s", args, out)
		}
		return strings.TrimSpace(string(out))
	}
	t.Cleanup(func() { _ = exec.Command(f.host.tmux, "-S", sock, "kill-server").Run() })
	other := tmux("new-session", "-d", "-P", "-F", "#{pane_id}", "-s", "work", "-c", f.cfg.Home)
	pane := tmux("new-window", "-d", "-P", "-F", "#{pane_id}", "-t", "work:", "-c", f.dir, "TMUX_PANE="+other+" exec -a pi sleep 60")
	pid := mustAtoi(t, tmux("display-message", "-p", "-t", pane, "#{pane_pid}"))
	exposeTestProcess(t, proc, pid)
	for deadline := time.Now().Add(3 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		if raw, _ := os.ReadFile(filepath.Join("/proc", strconv.Itoa(pid), "cmdline")); isPiCommand(raw) {
			break
		}
	}
	id := "44444444-4444-4444-8444-444444444444"
	writeSession(t, f.cfg.Home, id, f.dir)
	if got := f.host.writerPane(t.Context(), f.dir, id); got.place != "terminal" {
		t.Fatalf("place %q for a pane the Pi is not in", got.place)
	}
	if _, code := f.dial(t, "workspace_id="+f.id+"&conversation="+id); code != 404 {
		t.Fatalf("view of a foreign pane: %d", code)
	}
}

// Pi can switch to another conversation without exiting (/new, /resume): the
// view of the first one then ends, though the process lives on.
func TestTerminalWriterViewEndsWhenPiSwitchesConversation(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("daemon never runs as root")
	}
	f := newTerminalFixture(t, true)
	proc := testProcRoot(t)
	f.host.proc = proc
	sock := filepath.Join(f.tmp, "ps")
	tmux := func(args ...string) string {
		t.Helper()
		cmd := exec.Command(f.host.tmux, append([]string{"-f", "/dev/null", "-S", sock}, args...)...)
		cmd.Env = append(os.Environ(), "SHELL=/bin/bash", "TMUX=")
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("tmux %v: %s", args, out)
		}
		return strings.TrimSpace(string(out))
	}
	t.Cleanup(func() { _ = exec.Command(f.host.tmux, "-S", sock, "kill-server").Run() })
	pane := tmux("new-session", "-d", "-P", "-F", "#{pane_id}", "-s", "work", "-c", f.dir, "exec -a pi sleep 60")
	pid := mustAtoi(t, tmux("display-message", "-p", "-t", pane, "#{pane_pid}"))
	exposeTestProcess(t, proc, pid)
	for deadline := time.Now().Add(3 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		if raw, _ := os.ReadFile(filepath.Join("/proc", strconv.Itoa(pid), "cmdline")); isPiCommand(raw) {
			break
		}
	}
	id := "44444444-4444-4444-8444-444444444444"
	writeSession(t, f.cfg.Home, id, f.dir)
	w, code := f.dial(t, "workspace_id="+f.id+"&conversation="+id)
	if code != 101 {
		t.Fatalf("upgrade %d", code)
	}
	w.resize(t, 60, 15)
	w.waitReady(t)
	writeSession(t, f.cfg.Home, "66666666-6666-4666-8666-666666666666", f.dir)
	w.until(t, "\x00never", 10*time.Second)
	if w.exit["state"] != "ended" {
		t.Fatalf("view followed Pi into another conversation: %+v", w.exit)
	}
}
