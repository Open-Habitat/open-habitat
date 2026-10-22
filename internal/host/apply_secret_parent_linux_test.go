//go:build linux

package host

import (
	"encoding/binary"
	"golang.org/x/sys/unix"
	"os"
	"path/filepath"
	"testing"
)

func TestGatewaySecretParentsRejectInheritedReaders(t *testing.T) {
	base, owner := operationFixture(t)
	base = filepath.Dir(base)
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
}
