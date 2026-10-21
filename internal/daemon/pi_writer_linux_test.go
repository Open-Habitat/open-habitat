//go:build linux

package daemon

import (
	"github.com/Open-Habitat/open-habitat/internal/transport"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"testing"
	"time"
)

func TestPiWriterLiveOwnUID(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("daemon never runs as root")
	}
	cwd := t.TempDir()
	path := filepath.Join(t.TempDir(), "session.jsonl")
	if err := os.WriteFile(path, []byte("session"), 0600); err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command("bash", "-c", "exec -a pi sleep 20 3<\"$1\"", "bash", path)
	cmd.Dir = cwd
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = cmd.Process.Kill(); _ = cmd.Wait() }()
	proc := t.TempDir()
	exposeTestProcess(t, proc, cmd.Process.Pid)
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if scanPiWriter(proc, path, cwd, os.Geteuid()) == "writer_present" {
			_ = cmd.Process.Kill()
			_ = cmd.Wait()
			if got := scanPiWriter(proc, path, cwd, os.Geteuid()); got != "not_observed" {
				t.Fatalf("after writer exit: %s", got)
			}
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("own-UID native descriptor was not detected")
}

func TestKnownControllerChildInSameWorkspaceDoesNotBlockOtherSession(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("daemon never runs as root")
	}
	cwd := t.TempDir()
	path := filepath.Join(t.TempDir(), "a.jsonl")
	if err := os.WriteFile(path, []byte("session"), 0600); err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command("bash", "-c", "exec -a pi sleep 20")
	cmd.Dir = cwd
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = cmd.Process.Kill(); _ = cmd.Wait() }()
	proc := t.TempDir()
	exposeTestProcess(t, proc, cmd.Process.Pid)
	// Poll only for child startup; the census excludes unrelated host processes.
	observe := func(label, want string, read func() string) {
		t.Helper()
		deadline := time.Now().Add(5 * time.Second)
		got := read()
		for got != want && time.Now().Before(deadline) {
			time.Sleep(10 * time.Millisecond)
			got = read()
		}
		if got != want {
			t.Fatalf("%s: %s, want %s", label, got, want)
		}
	}
	observe("unmanaged Pi", "unknown", func() string { return scanPiWriter(proc, path, cwd, os.Geteuid()) })
	c := &ConversationController{writerProc: proc, cfg: transport.Config{UID: os.Geteuid()}, sessions: map[string]*conversation{"b": {rpc: &piRPC{cmd: cmd, exited: make(chan struct{})}}}}
	observe("pinned other session", "not_observed", func() string { return c.piWriter(path, cwd) })
	session := nativeSession{id: "a", cwd: cwd, path: path, state: "readable"}
	observe("snapshot of other session", "not_observed", func() string {
		return scanSnapshotPiWriters(proc, []nativeSession{session}, os.Geteuid(), c.ownPiPIDs())[path]
	})
}

func TestPiWriterProcessCensus(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("daemon census runs as nonroot")
	}
	proc := t.TempDir()
	cwd := t.TempDir()
	path := filepath.Join(t.TempDir(), "session.jsonl")
	if err := os.WriteFile(path, []byte("session"), 0600); err != nil {
		t.Fatal(err)
	}
	check := func(want string) {
		t.Helper()
		if got := scanPiWriter(proc, path, cwd, os.Geteuid()); got != want {
			t.Fatalf("writer=%s, want %s", got, want)
		}
	}
	check("not_observed")
	// A foreign process with ptrace-protected cwd/fds must be skipped before
	// any detail read. On nonroot test hosts PID 1 is a useful foreign fixture.
	if foreign, err := os.Stat("/proc/1"); err == nil {
		if owner, ok := fileOwner(foreign); ok && owner != os.Geteuid() {
			if err := os.Symlink("/proc/1", filepath.Join(proc, "99999999")); err != nil {
				t.Fatal(err)
			}
			check("not_observed")
		}
	}
	pid := filepath.Join(proc, strconv.Itoa(os.Getpid()+100000))
	if err := os.MkdirAll(filepath.Join(pid, "fd"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(pid, "cmdline"), []byte("node\x00/opt/pi-coding-agent/dist/bundle/cli.js\x00"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(cwd, filepath.Join(pid, "cwd")); err != nil {
		t.Fatal(err)
	}
	check("unknown") // Pi may close its JSONL between writes.
	if err := os.Symlink(path, filepath.Join(pid, "fd", "3")); err != nil {
		t.Fatal(err)
	}
	check("writer_present")
	if err := os.Remove(filepath.Join(pid, "fd", "3")); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(filepath.Join(pid, "cmdline"), 0000); err != nil {
		t.Fatal(err)
	}
	check("unknown") // unreadable own-UID process cannot prove absence
	if err := os.Remove(filepath.Join(pid, "cmdline")); err != nil {
		t.Fatal(err)
	}
	check("not_observed") // The process disappeared before its command could be read.
	if got := scanPiWriter(proc, path, cwd, os.Geteuid()+1); got != "unknown" {
		t.Fatalf("foreign UID: %s", got)
	}
}

func TestPiWriterProtectedServices(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("daemon census runs as nonroot")
	}
	base := t.TempDir()
	path := filepath.Join(t.TempDir(), "session.jsonl")
	if err := os.WriteFile(path, []byte("session"), 0600); err != nil {
		t.Fatal(err)
	}
	target, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	// OpenSSH before the sshd-session split uses this process title. Like
	// gpg-agent, its same-UID post-auth child denies cwd/fd reads to the daemon.
	if err := os.Mkdir(filepath.Join(base, "fd"), 0000); err != nil {
		t.Fatal(err)
	}
	defer os.Chmod(filepath.Join(base, "fd"), 0700)
	for _, command := range []string{"sshd: hbadmin@notty  ", "gpg-agent", "/usr/bin/gpg-agent"} {
		if err := os.WriteFile(filepath.Join(base, "cmdline"), []byte(command+"\x00"), 0600); err != nil {
			t.Fatal(err)
		}
		if got := inspectOwnedPi(base, path, t.TempDir(), target); got != "not_observed" {
			t.Fatalf("protected %s: %s", command, got)
		}
		// Unlike the system session services, gpg-agent can have its home
		// inside a workspace. Its unreadable cwd/fds must still block deletion.
		want := "clear"
		if command != "sshd: hbadmin@notty  " {
			want = "unknown"
		}
		if got := inspectWorkspaceProcess(base, t.TempDir()); got != want {
			t.Fatalf("workspace process %s: %s, want %s", command, got, want)
		}
	}
	// A readable descriptor is still affirmative writer evidence, even when
	// the command claims to be a service.
	if err := os.Chmod(filepath.Join(base, "fd"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(path, filepath.Join(base, "fd", "3")); err != nil {
		t.Fatal(err)
	}
	if got := inspectOwnedPi(base, path, t.TempDir(), target); got != "writer_present" {
		t.Fatalf("service title must not hide an open session: %s", got)
	}
}
