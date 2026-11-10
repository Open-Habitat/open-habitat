//go:build linux

package core

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

func TestSharedPiRuntimeAcrossUIDs(t *testing.T) {
	if os.Getenv("PI_SELECTOR_CHILD") == "1" {
		if _, err := os.Stat("/etc/open-habitat/gateway.json"); !os.IsPermission(err) {
			t.Fatalf("UID %d reached gateway secrets: %v", os.Geteuid(), err)
		}
		cfg, err := LoadSharedPiRuntime()
		if os.Getenv("PI_SELECTOR_REJECT") == "1" {
			if err == nil {
				t.Fatal("unsafe shared selector accepted")
			}
		} else if err != nil || cfg.Node != "/opt/runtime/bin/node" || os.Getenv("HOME") != os.Getenv("PI_EXPECT_HOME") {
			t.Fatalf("UID %d cannot select runtime with own HOME: %v", os.Geteuid(), err)
		}
		return
	}
	// The fixed deployment paths must never be created on the host by go test.
	if os.Getenv("PI_SELECTOR_CONTAINER") != "1" || os.Geteuid() != 0 {
		t.Skip("requires disposable rootless container")
	}
	uidMap, err := os.ReadFile("/proc/self/uid_map")
	fields := strings.Fields(string(uidMap))
	if err != nil || len(fields) < 2 || fields[1] == "0" {
		t.Fatal("requires mapped container root")
	}
	if hostHome := os.Getenv("PI_SELECTOR_HOST_HOME"); hostHome == "" {
		t.Fatal("PI_SELECTOR_HOST_HOME must name the invoking user's home")
	} else if _, err := os.Stat(hostHome); !os.IsNotExist(err) {
		t.Fatal("real home must not be mounted")
	}
	if err := os.MkdirAll(filepath.Dir(SharedPiRuntimePath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll("/etc/open-habitat", 0750); err != nil {
		t.Fatal(err)
	}
	if err := os.Chown("/etc/open-habitat", 0, 21003); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod("/etc/open-habitat", 0750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile("/etc/open-habitat/gateway.json", []byte("synthetic secret"), 0640); err != nil {
		t.Fatal(err)
	}
	good := []byte(`{"node":"/opt/runtime/bin/node","entry":"/opt/runtime/sdk/dist/index.js","manifest":"/opt/runtime/sdk/package.json"}`)
	path := SharedPiRuntimePath
	for _, uid := range []uint32{21001, 21002} {
		home := filepath.Join("/home", "agent-"+string(rune('a'+uid-21001)))
		if err := os.MkdirAll(home, 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.Chown(home, int(uid), int(uid)); err != nil {
			t.Fatal(err)
		}
		child := func(reject bool) {
			t.Helper()
			cmd := exec.Command(os.Args[0], "-test.run=^TestSharedPiRuntimeAcrossUIDs$")
			cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uid, Gid: uid}}
			cmd.Env = append(os.Environ(), "PI_SELECTOR_CHILD=1", "PI_EXPECT_HOME="+home, "HOME="+home)
			if reject {
				cmd.Env = append(cmd.Env, "PI_SELECTOR_REJECT=1")
			}
			if out, err := cmd.CombinedOutput(); err != nil {
				t.Fatalf("UID %d: %v %s", uid, err, out)
			}
		}
		if err := os.WriteFile(path, good, 0644); err != nil {
			t.Fatal(err)
		}
		child(false)
		// Each negative begins with a readable, trusted selector. A missing file
		// must not accidentally satisfy a named unsafe-mode test.
		target := "/opt/pi-selector-symlink-target.json"
		if err := os.WriteFile(target, good, 0644); err != nil {
			t.Fatal(err)
		}
		for _, name := range []string{"world writable file", "wrong owner", "symlink file", "writable parent", "symlink parent"} {
			t.Run(name, func(t *testing.T) {
				if err := os.WriteFile(path, good, 0644); err != nil {
					t.Fatal(err)
				}
				if err := os.Chown(path, 0, 0); err != nil {
					t.Fatal(err)
				}
				if err := os.Chmod(path, 0644); err != nil {
					t.Fatal(err)
				}
				child(false)
				var err error
				switch name {
				case "world writable file":
					err = os.Chmod(path, 0666)
				case "wrong owner":
					err = os.Chown(path, int(uid), int(uid))
				case "symlink file":
					if err = os.Remove(path); err == nil {
						err = os.Symlink(target, path)
					}
				case "writable parent":
					err = os.Chmod(filepath.Dir(path), 0777)
				case "symlink parent":
					if err = os.Rename(filepath.Dir(path), "/opt/open-habitat-real"); err == nil {
						err = os.Symlink("/opt/open-habitat-real", filepath.Dir(path))
					}
				}
				if err != nil {
					t.Fatal(err)
				}
				child(true)
				if name == "symlink parent" {
					if err := os.Remove(filepath.Dir(path)); err != nil {
						t.Fatal(err)
					}
					if err := os.Rename("/opt/open-habitat-real", filepath.Dir(path)); err != nil {
						t.Fatal(err)
					}
				}
				if err := os.Chmod(filepath.Dir(path), 0755); err != nil {
					t.Fatal(err)
				}
				if err := os.Remove(path); err != nil {
					t.Fatal(err)
				}
			})
		}
		if err := os.Remove(target); err != nil {
			t.Fatal(err)
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
