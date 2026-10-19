//go:build linux

package main

import (
	"bufio"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"
	"testing"
	"time"
)

func TestLifetimeHelper(t *testing.T) {
	if os.Getenv("OH_LIFETIME_HELPER") != "1" {
		return
	}
	// Simulate a wedged host whose normal shutdown handler cannot finish.
	signal.Ignore(syscall.SIGTERM)
	guardLifetime(false)
	println("LIFETIME_READY")
	for {
		time.Sleep(time.Hour)
	}
}

func TestRemovedWorktreeEndsHost(t *testing.T) {
	root := filepath.Join(t.TempDir(), "worktree")
	if err := os.MkdirAll(filepath.Join(root, ".cache"), 0700); err != nil {
		t.Fatal(err)
	}
	self, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	source, err := os.Open(self)
	if err != nil {
		t.Fatal(err)
	}
	defer source.Close()
	binary := filepath.Join(root, ".cache", "browser-host")
	dest, err := os.OpenFile(binary, os.O_CREATE|os.O_WRONLY, 0700)
	if err != nil {
		t.Fatal(err)
	}
	_, err = io.Copy(dest, source)
	dest.Close()
	if err != nil {
		t.Fatal(err)
	}
	child := exec.Command(binary, "-test.run=^TestLifetimeHelper$")
	child.Env = append(os.Environ(), "OH_LIFETIME_HELPER=1", "BROWSER_HOST_OWNER_PID=")
	output, err := child.StderrPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := child.Start(); err != nil {
		t.Fatal(err)
	}
	defer child.Process.Kill()
	ready := make(chan bool, 1)
	go func() {
		scanner := bufio.NewScanner(output)
		ready <- scanner.Scan() && scanner.Text() == "LIFETIME_READY"
		io.Copy(io.Discard, output)
	}()
	select {
	case ok := <-ready:
		if !ok {
			t.Fatal("helper did not become ready")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("helper readiness timed out")
	}
	// Rename and recreate, not merely unlink: the old host must not adopt the
	// replacement directory now occupying its worktree path.
	if err := os.Rename(root, root+"-removed"); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(root, 0700); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() { done <- child.Wait() }()
	select {
	case err := <-done:
		if err == nil {
			t.Fatal("host exited without lifetime signal")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("host survived worktree removal")
	}
}
