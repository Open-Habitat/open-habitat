//go:build linux

package daemon

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"
)

const ownershipTestID = "12345678-1234-1234-1234-123456789abc"

func TestPiOwnershipCrashHelper(t *testing.T) {
	if os.Getenv("PI_OWNER_HELPER") == "" {
		return
	}
	runtime, home := os.Getenv("PI_OWNER_RUNTIME"), os.Getenv("PI_OWNER_HOME")
	o, err := acquirePiOwnership(runtime, ownershipTestID)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	p, err := launchPiRPCWithOwnership(filepath.Join(home, "pi"), home, home, "", []string{"PATH=/usr/bin:/bin"}, o)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	if err := os.WriteFile(filepath.Join(home, "child.pid"), []byte(strconv.Itoa(p.cmd.Process.Pid)), 0600); err != nil {
		os.Exit(2)
	}
	select {}
}

func TestPiOwnershipCrashAndNativeReconciliation(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires disposable nonroot UID")
	}
	home := t.TempDir()
	runtime := filepath.Join(home, "run")
	if err := os.Mkdir(runtime, 0700); err != nil {
		t.Fatal(err)
	}
	script := filepath.Join(home, "pi")
	if err := os.WriteFile(script, []byte("#!/bin/sh\ntrap '' HUP\nexec sleep 30\n"), 0700); err != nil {
		t.Fatal(err)
	}
	// Separate helper process owns a direct synthetic Pi child. The child
	// retains the inherited lock after its daemon exits.
	cmd := exec.Command(os.Args[0], "-test.run=^TestPiOwnershipCrashHelper$")
	cmd.Env = append(os.Environ(), "PI_OWNER_HELPER=1", "PI_OWNER_RUNTIME="+runtime, "PI_OWNER_HOME="+home)
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = cmd.Process.Kill(); _ = cmd.Wait() }()
	var pid int
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		b, err := os.ReadFile(filepath.Join(home, "child.pid"))
		if err == nil {
			pid, _ = strconv.Atoi(strings.TrimSpace(string(b)))
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if pid <= 0 {
		t.Fatal("daemon fixture did not launch child")
	}
	defer syscall.Kill(pid, syscall.SIGKILL)
	if o, err := acquirePiOwnership(runtime, ownershipTestID); err == nil {
		o.release()
		t.Fatal("second writer entered while old child alive")
	}
	// No native file: absence must not be mistaken for settled history.
	path := filepath.Join(home, "session.jsonl")
	if _, err := reconciledNativeHistory(path, os.Geteuid(), ownershipTestID, home); err == nil {
		t.Fatal("missing history reconciled")
	}
	header := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":\"%s\",\"cwd\":%q}\n", ownershipTestID, home)
	if err := os.WriteFile(path, []byte(header), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := reconciledNativeHistory(path, os.Geteuid(), ownershipTestID, home); err != nil {
		t.Fatal(err)
	}
	// Readable native history does not override a still-running writer.
	if o, err := acquirePiOwnership(runtime, ownershipTestID); err == nil {
		o.release()
		t.Fatal("history bypassed live writer")
	}
	// Crash the daemon; Pdeathsig terminates its direct child.
	if err := cmd.Process.Kill(); err != nil {
		t.Fatal(err)
	}
	_ = cmd.Wait()
	deadline = time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		o, err := acquirePiOwnership(runtime, ownershipTestID)
		if err == nil {
			o.release()
			return
		} // Lock released, NOT a resume authorization.
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("direct child did not release inherited fence")
}

func TestPiOwnershipConcurrentAndUntrustedLock(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires nonroot UID")
	}
	dir := t.TempDir()
	o, err := acquirePiOwnership(dir, ownershipTestID)
	if err != nil {
		t.Fatal(err)
	}
	if second, err := acquirePiOwnership(dir, ownershipTestID); err == nil {
		second.release()
		t.Fatal("duplicate owner")
	}
	o.release()
	lock := filepath.Join(dir, "pi-owners", ownershipTestID+".lock")
	if err := os.Remove(lock); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(dir, "sentinel")
	if err := os.WriteFile(target, []byte("safe"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(target, lock); err != nil {
		t.Fatal(err)
	}
	if _, err := acquirePiOwnership(dir, ownershipTestID); err == nil {
		t.Fatal("symlink accepted")
	}
	b, _ := os.ReadFile(target)
	if string(b) != "safe" {
		t.Fatal("sentinel changed")
	}
}

func TestPiOwnershipGracefulStopStillUnknown(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires nonroot UID")
	}
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	if err := os.WriteFile(script, []byte("#!/bin/sh\nexec sleep 30\n"), 0700); err != nil {
		t.Fatal(err)
	}
	o, err := acquirePiOwnership(home, ownershipTestID)
	if err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPCWithOwnership(script, home, home, "", []string{"PATH=/usr/bin:/bin"}, o)
	if err != nil {
		o.release()
		t.Fatal(err)
	}
	if another, err := acquirePiOwnership(home, ownershipTestID); err == nil {
		another.release()
		t.Fatal("active child not fenced")
	}
	if err := p.close(); err == nil || !strings.Contains(err.Error(), "unknown") {
		t.Fatalf("false settled stop: %v", err)
	}
	if err := o.release(); err != nil {
		t.Fatal(err)
	}
	next, err := acquirePiOwnership(home, ownershipTestID)
	if err != nil {
		t.Fatalf("direct child still holds lock: %v", err)
	}
	next.release() // does not confer authorization to resume
}
