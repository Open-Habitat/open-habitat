//go:build linux

package main

import (
	"context"
	"encoding/json"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"testing"
	"time"
)

func connect(t *testing.T, path string) (*net.UnixConn, result) {
	t.Helper()
	var c *net.UnixConn
	var err error
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		c, err = net.DialUnix("unix", nil, &net.UnixAddr{Name: path, Net: "unix"})
		if err == nil {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	if err != nil {
		t.Fatal(err)
	}
	var got result
	if err := json.NewDecoder(c).Decode(&got); err != nil {
		t.Fatal(err)
	}
	return c, got
}

func TestPeerCredentialAllowAndMode(t *testing.T) {
	path := filepath.Join(t.TempDir(), "daemon.sock")
	done := make(chan error, 1)
	go func() { done <- serveOnce(path, uint(os.Getuid())) }()
	c, got := connect(t, path)
	defer c.Close()
	if got.PeerUID != uint32(os.Getuid()) {
		t.Fatalf("uid=%d", got.PeerUID)
	}
	if info, err := os.Stat(path); err != nil || info.Mode().Perm() != 0660 {
		t.Fatalf("mode=%v err=%v", info.Mode().Perm(), err)
	}
	if err := <-done; err != nil {
		t.Fatal(err)
	}
}

func TestPeerCredentialDeny(t *testing.T) {
	path := filepath.Join(t.TempDir(), "daemon.sock")
	done := make(chan error, 1)
	go func() { done <- serveOnce(path, uint(os.Getuid()+1)) }()
	deadline := time.Now().Add(time.Second)
	var c *net.UnixConn
	var err error
	for time.Now().Before(deadline) {
		c, err = net.DialUnix("unix", nil, &net.UnixAddr{Name: path, Net: "unix"})
		if err == nil {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	if err != nil {
		t.Fatal(err)
	}
	c.Close()
	if err := <-done; err == nil {
		t.Fatal("expected denial")
	}
}

func TestDirectChildStopsWithOwner(t *testing.T) {
	if os.Getenv("GO_TRIAL_CHILD") == "1" {
		ctx, cancel := context.WithCancel(context.Background())
		go func() { time.Sleep(50 * time.Millisecond); cancel() }()
		if err := runChild(ctx); err != nil {
			t.Fatal(err)
		}
		return
	}
	cmd := exec.Command(os.Args[0], "-test.run=TestDirectChildStopsWithOwner")
	cmd.Env = append(os.Environ(), "GO_TRIAL_CHILD=1")
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("%v: %s", err, out)
	}
}
