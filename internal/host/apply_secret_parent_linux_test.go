//go:build linux

package host

import (
	"context"
	"encoding/binary"
	"golang.org/x/sys/unix"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"testing"
	"time"
)

func TestGatewaySecretParentsRejectInheritedReaders(t *testing.T) {
	if os.Getenv("HOST_SECRET_ACL_CHILD") == "1" {
		b, e := os.ReadFile(os.Getenv("HOST_SECRET_ACL_PATH"))
		if e != nil || string(b) != "synthetic-fixture-only" {
			t.Fatal("synthetic secret read denied")
		}
		return
	}
	base, owner := operationFixture(t)
	base = filepath.Dir(base)
	native := os.Geteuid() == 0 && os.Getenv("HOST_INIT_UID_CONTAINER") == "1"
	if native {
		var e error
		base, e = os.MkdirTemp("/var/lib", "oh-secret-acl-")
		if e != nil {
			t.Fatal(e)
		}
		t.Cleanup(func() { os.RemoveAll(base) })
		if e = os.Chmod(base, 0755); e != nil {
			t.Fatal(e)
		}
	}
	path := base + "/gateway"
	if e := secretParentSafe(path, owner); e != nil {
		t.Fatal(e)
	}
	// A real POSIX default ACL grants a synthetic UID read/search in children
	// without adding group/world write bits to the parent.
	acl := make([]byte, 4+5*8)
	binary.LittleEndian.PutUint32(acl, 2)
	for i, e := range []struct {
		tag, perm uint16
		id        uint32
	}{{1, 7, ^uint32(0)}, {2, 5, 42001}, {4, 5, ^uint32(0)}, {16, 5, ^uint32(0)}, {32, 0, ^uint32(0)}} {
		off := 4 + i*8
		binary.LittleEndian.PutUint16(acl[off:], e.tag)
		binary.LittleEndian.PutUint16(acl[off+2:], e.perm)
		binary.LittleEndian.PutUint32(acl[off+4:], e.id)
	}
	e := unix.Setxattr(base, "system.posix_acl_default", acl, 0)
	if e == unix.ENOTSUP {
		t.Skip("filesystem lacks POSIX ACLs")
	}
	if e != nil {
		t.Fatal(e)
	}
	if e = secretParentSafe(path, owner); e == nil {
		t.Fatal("default named reader accepted before creation")
	}
	if e = os.Mkdir(path, 0750); e != nil {
		t.Fatal(e)
	}
	if e = os.Chmod(path, 0750); e != nil {
		t.Fatal(e)
	}
	if e = secretParentSafe(path, owner); e == nil {
		t.Fatal("inherited reader accepted on secret parent")
	}
	probe := func(want bool) {
		t.Helper()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		cmd := exec.CommandContext(ctx, os.Args[0], "-test.run=^TestGatewaySecretParentsRejectInheritedReaders$")
		cmd.Env = append(os.Environ(), "HOST_SECRET_ACL_CHILD=1", "HOST_SECRET_ACL_PATH="+path+"/key")
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: 42001, Gid: 42001, Groups: []uint32{}}, Pdeathsig: syscall.SIGKILL}
		b, e := cmd.CombinedOutput()
		if (e == nil) != want {
			t.Fatalf("kernel read want=%v err=%v output=%s", want, e, b)
		}
	}
	if native {
		if e = os.Chown(path, 0, 21003); e != nil {
			t.Fatal(e)
		}
		if e = os.WriteFile(path+"/key", []byte("synthetic-fixture-only"), 0600); e != nil {
			t.Fatal(e)
		}
		if e = os.Chown(path+"/key", 0, 21003); e != nil {
			t.Fatal(e)
		}
		if e = os.Chmod(path+"/key", 0640); e != nil {
			t.Fatal(e)
		}
		probe(true) // Modes alone really do expose bytes to this foreign UID.
	}

	// Removing only the default leaves a named access ACL: it still must refuse.
	if e = unix.Removexattr(path, "system.posix_acl_default"); e != nil {
		t.Fatal(e)
	}
	if e = secretParentSafe(path, owner); e == nil {
		t.Fatal("named access reader accepted")
	}
	if e = unix.Removexattr(path, "system.posix_acl_access"); e != nil {
		t.Fatal(e)
	}
	if e = secretParentSafe(path, owner); e != nil {
		t.Fatal("safe explicit private parent refused", e)
	}
	if native {
		probe(false)
	} // The exact parent boundary denies the same UID.
}

func TestGatewayAncestorTraversal(t *testing.T) {
	base, owner := operationFixture(t)
	path := filepath.Dir(base) + "/bootstrap"
	if e := gatewayAncestorSafe(path, owner); e != nil {
		t.Fatal(e)
	}
	if e := os.Mkdir(path, 0700); e != nil {
		t.Fatal(e)
	}
	if e := gatewayAncestorSafe(path, owner); e == nil {
		t.Fatal("root-private bootstrap accepted")
	}
	if os.Getegid() != 0 {
		t.Skip("canonical root group readback needs root container")
	}
	for _, mode := range []os.FileMode{0711, 0755, 0750, 0777, os.ModeSetgid | 0711} {
		if e := os.Chmod(path, mode); e != nil {
			t.Fatal(e)
		}
		e := gatewayAncestorSafe(path, owner)
		if (e == nil) != (mode == 0711 || mode == 0755) {
			t.Fatalf("mode %o: %v", mode, e)
		}
	}
}

func TestGatewayBootstrapDistinctUIDs(t *testing.T) {
	if os.Getenv("HOST_BOOTSTRAP_CHILD") == "1" {
		base := os.Getenv("HOST_BOOTSTRAP_PATH")
		_, configErr := os.ReadFile(base + "/gateway/config")
		_, sourceErr := os.ReadFile(base + "/secrets/source")
		_, siteErr := os.ReadFile(base + "/site.json")
		gateway := os.Getuid() == 42001
		if (configErr == nil) != gateway || sourceErr == nil || siteErr == nil {
			t.Fatal("bootstrap boundary", configErr, sourceErr, siteErr)
		}
		return
	}
	if os.Geteuid() != 0 || os.Getenv("HOST_INIT_UID_CONTAINER") != "1" {
		t.Skip("distinct kernel UIDs require disposable root container")
	}
	base, e := os.MkdirTemp("/var/lib", "oh-bootstrap-")
	if e != nil {
		t.Fatal(e)
	}
	defer os.RemoveAll(base)
	if e = os.Chmod(base, 0711); e != nil {
		t.Fatal(e)
	}
	for _, dir := range []string{"gateway", "secrets"} {
		if e = os.Mkdir(base+"/"+dir, 0700); e != nil {
			t.Fatal(e)
		}
	}
	if e = os.Chown(base+"/gateway", 0, 42001); e != nil {
		t.Fatal(e)
	}
	if e = os.Chmod(base+"/gateway", 0750); e != nil {
		t.Fatal(e)
	}
	for _, name := range []string{"gateway/config", "secrets/source", "site.json"} {
		if e = os.WriteFile(base+"/"+name, []byte("synthetic"), 0600); e != nil {
			t.Fatal(e)
		}
	}
	if e = os.Chown(base+"/gateway/config", 0, 42001); e != nil {
		t.Fatal(e)
	}
	if e = os.Chmod(base+"/gateway/config", 0640); e != nil {
		t.Fatal(e)
	}
	if e = gatewayAncestorSafe(base, 0); e != nil {
		t.Fatal(e)
	}
	for _, uid := range []uint32{42001, 42002} {
		cmd := exec.Command(os.Args[0], "-test.run=^TestGatewayBootstrapDistinctUIDs$")
		cmd.Env = append(os.Environ(), "HOST_BOOTSTRAP_CHILD=1", "HOST_BOOTSTRAP_PATH="+base)
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uid, Gid: uid, Groups: []uint32{}}}
		if b, e := cmd.CombinedOutput(); e != nil {
			t.Fatal(uid, e, string(b))
		}
	}
}

func TestGatewayParentPreflight(t *testing.T) {
	if os.Geteuid() != 0 || os.Getenv("HOST_INIT_UID_CONTAINER") != "1" {
		t.Skip("fixed installation paths require disposable root container")
	}
	const path = "/etc/open-habitat"
	if e := os.Mkdir(path, 0700); e != nil {
		t.Fatal(e)
	}
	defer os.RemoveAll(path)
	if e := os.Chmod(path, 0700); e != nil {
		t.Fatal(e)
	}
	check := func(want bool) {
		t.Helper()
		var r Inspection
		r.Inputs = map[string]string{}
		nativeInspection(context.Background(), Site{}, &r)
		found := false
		for _, c := range r.Checks {
			if c.Code == "installation.parents" && c.Reason == "gateway_parent_requires_root_0711_or_0755_no_acl" {
				found = true
			}
		}
		if found != want {
			t.Fatalf("preflight parent failure want %v, checks %#v", want, r.Checks)
		}
	}
	check(true)
	st, e := os.Stat(path)
	if e != nil || st.Mode().Perm() != 0700 {
		t.Fatal("preflight mutated bootstrap", st, e)
	}
	if e = os.Chmod(path, 0711); e != nil {
		t.Fatal(e)
	}
	check(false)
}
