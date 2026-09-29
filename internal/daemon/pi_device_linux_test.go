//go:build linux

package daemon

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func piFixture(t *testing.T) (*PiDevice, string) {
	t.Helper()
	if os.Geteuid() == 0 {
		t.Skip("test must run as disposable unprivileged UID; root cannot prove mapped-UID boundary")
	}
	home := t.TempDir()
	t.Setenv("HOME", home)
	pkg := filepath.Join("pi-device-test", "node_modules", "@earendil-works", "pi-coding-agent")
	abs, err := filepath.Abs(pkg)
	if err != nil {
		t.Fatal(err)
	}
	node, err := exec.LookPath("node")
	if err != nil {
		t.Fatal(err)
	}
	// Test-only wrapper installs the fetch trap before the real pinned SDK.
	wrapper := filepath.Join(home, "node-mock")
	mock, err := filepath.Abs(filepath.Join("pi-device-test", "mock.mjs"))
	if err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(wrapper, []byte("#!/bin/sh\nexec "+node+" --import "+mock+" \"$@\"\n"), 0700); err != nil {
		t.Fatal(err)
	}
	return &PiDevice{Home: home, Node: wrapper, Entry: filepath.Join(abs, "dist/index.js"), Manifest: filepath.Join(abs, "package.json")}, home
}
func TestPiDeviceFixtureHomeOnly(t *testing.T) {
	p, _ := piFixture(t)
	t.Setenv("HOME", t.TempDir()) // Browser host shares one UID across synthetic homes.
	if err := p.validate(); err == nil || !strings.Contains(err.Error(), "HOME mismatch") {
		t.Fatalf("production HOME mismatch accepted: %v", err)
	}
	p.FixtureHome = true
	if err := p.validate(); err != nil {
		t.Fatalf("fixture HOME rejected: %v", err)
	}
}

func TestPiDeviceNativeAndOwnership(t *testing.T) {
	p, home := piFixture(t)
	if got := p.Status(); got != "missing" {
		t.Fatalf("initial status %s", got)
	}
	id, events, err := p.Start()
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err = p.Start(); err == nil {
		t.Fatal("concurrent attempt accepted")
	}
	if p.Cancel("wrong-id") {
		t.Fatal("wrong owner cancelled attempt")
	}
	var got []PiDeviceEvent
	for e := range events {
		got = append(got, e)
	}
	if len(got) != 2 || got[0].Type != "device_code" || got[1].Type != "status" || got[1].State != "usable" {
		t.Fatalf("unexpected frames: %+v", got)
	}
	if p.Cancel(id) {
		t.Fatal("reused attempt cancelled new state")
	}
	if got := p.Status(); got != "usable" {
		t.Fatalf("status %s", got)
	}
	content, err := os.ReadFile(filepath.Join(home, ".pi", "agent", "auth.json"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), "SYNTHETIC-REFRESH-SECRET") {
		t.Fatal("native credentials not stored")
	}
	for _, e := range got {
		if strings.Contains(e.UserCode, "SYNTHETIC") {
			t.Fatal("secret in IPC")
		}
	}
}
func TestPiDeviceUnsafePaths(t *testing.T) {
	p, home := piFixture(t)
	p.Home = t.TempDir()
	if _, _, err := p.Start(); err == nil {
		t.Fatal("mismatched HOME accepted")
	}
	p.Home = home
	outside := t.TempDir()
	if err := os.Mkdir(filepath.Join(home, ".pi"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(home, ".pi", "agent")); err != nil {
		t.Fatal(err)
	}
	if p.Status() != "unknown" {
		t.Fatal("symlink accepted")
	}
	if _, _, err := p.Start(); err == nil {
		t.Fatal("symlink accepted for login")
	}
	if err := os.Remove(filepath.Join(home, ".pi", "agent")); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(home, ".pi", "agent"), 0700); err != nil {
		t.Fatal(err)
	}
	auth := filepath.Join(home, ".pi", "agent", "auth.json")
	if err := os.WriteFile(auth, []byte("{}"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(auth, 0644); err != nil {
		t.Fatal(err)
	}
	if _, _, err := p.Start(); err == nil {
		t.Fatal("world-readable auth accepted")
	}
}
func TestPiDeviceAbort(t *testing.T) {
	p, _ := piFixture(t)
	// A stuck native child must be reaped on cancellation, not orphaned.
	script := filepath.Join(t.TempDir(), "stuck")
	if err := os.WriteFile(script, []byte("#!/bin/sh\nexec sleep 60\n"), 0700); err != nil {
		t.Fatal(err)
	}
	p.Node = script
	id, events, err := p.Start()
	if err != nil {
		t.Fatal(err)
	}
	if !p.Cancel(id) {
		t.Fatal("cancel rejected")
	}
	timer := time.NewTimer(3 * time.Second)
	defer timer.Stop()
	select {
	case <-timer.C:
		t.Fatal("child not reaped")
	case <-events:
	}
}
