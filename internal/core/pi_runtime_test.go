//go:build linux

package core

import (
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"testing"
)

func TestSharedPiRuntimeAcrossUIDs(t *testing.T) {
	if os.Getenv("PI_SELECTOR_CHILD") == "1" {
		cfg, err := loadSharedPiRuntime(os.Getenv("PI_SELECTOR_PATH"))
		if err != nil || cfg.Node != "/opt/runtime/bin/node" || os.Getenv("HOME") != os.Getenv("PI_EXPECT_HOME") {
			t.Fatalf("UID %d cannot select pinned runtime with own HOME: %v", os.Geteuid(), err)
		}
		return
	}
	if os.Geteuid() != 0 {
		t.Skip("disposable root container required")
	}
	dir, err := os.MkdirTemp("/opt", "pi-selector-")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir)
	os.Chmod(dir, 0755)
	path := filepath.Join(dir, "runtime.json")
	if err := os.WriteFile(path, []byte(`{"node":"/opt/runtime/bin/node","entry":"/opt/runtime/sdk/dist/index.js","manifest":"/opt/runtime/sdk/package.json"}`), 0644); err != nil {
		t.Fatal(err)
	}
	for _, uid := range []uint32{21001, 21002} {
		home := filepath.Join(dir, "home-"+string(rune('a'+uid-21001)))
		if err := os.Mkdir(home, 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.Chown(home, int(uid), int(uid)); err != nil {
			t.Fatal(err)
		}
		cmd := exec.Command(os.Args[0], "-test.run=^TestSharedPiRuntimeAcrossUIDs$")
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uid, Gid: uid}}
		cmd.Env = append(os.Environ(), "PI_SELECTOR_CHILD=1", "PI_SELECTOR_PATH="+path, "PI_EXPECT_HOME="+home, "HOME="+home)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("UID %d: %v %s", uid, err, out)
		}
	}
}

func TestSharedPiRuntimeSelector(t *testing.T) {
	if os.Geteuid() != 0 {
		t.Skip("root-owned selector fixtures require disposable root")
	}
	dir, err := os.MkdirTemp("/root", "pi-selector-")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir)
	if err := os.Chmod(dir, 0755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "runtime.json")
	good := `{"node":"/opt/runtime/bin/node","entry":"/opt/runtime/node_modules/@earendil-works/pi-coding-agent/dist/index.js","manifest":"/opt/runtime/node_modules/@earendil-works/pi-coding-agent/package.json"}`
	write := func(s string) {
		t.Helper()
		if err := os.WriteFile(path, []byte(s), 0644); err != nil {
			t.Fatal(err)
		}
	}
	write(good)
	a, err := loadSharedPiRuntime(path)
	if err != nil || a.Node != "/opt/runtime/bin/node" {
		t.Fatalf("valid selector: %v", err)
	}
	// Selection contains only program paths: no account or credential context.
	for _, content := range []string{`{"node":"/x","entry":"/y","manifest":"/z","home":"/home/other"}`, `{"node":"/x","entry":"/y"}`, good + good, `garbage`} {
		write(content)
		if _, err := loadSharedPiRuntime(path); err == nil {
			t.Fatalf("accepted %q", content)
		}
	}
	write(good)
	if err := os.Chmod(path, 0666); err != nil {
		t.Fatal(err)
	}
	if _, err := loadSharedPiRuntime(path); err == nil {
		t.Fatal("writable selector")
	}
	os.Chmod(path, 0644)
	os.Chmod(dir, 0777)
	if _, err := loadSharedPiRuntime(path); err == nil {
		t.Fatal("writable parent")
	}
	os.Chmod(dir, 0755)
	os.Remove(path)
	if err := os.Symlink(filepath.Join(dir, "actual"), path); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(dir, "actual"), []byte(good), 0644)
	if _, err := loadSharedPiRuntime(path); err == nil {
		t.Fatal("symlink selector")
	}
	os.Remove(path)
	if _, err := loadSharedPiRuntime(path); err == nil {
		t.Fatal("absent selector")
	}
	alias := dir + "-link"
	if err := os.Symlink(dir, alias); err != nil {
		t.Fatal(err)
	}
	defer os.Remove(alias)
	if _, err := loadSharedPiRuntime(filepath.Join(alias, "actual")); err == nil {
		t.Fatal("symlink parent")
	}
}
