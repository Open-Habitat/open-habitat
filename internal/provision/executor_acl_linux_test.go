//go:build linux

package provision

import (
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/sys/unix"
)

// Model a policy-drifted installer directory in disposable storage. A named
// default ACL can grant read access after chmod even when stat reports 0711.
func TestBindingDirectoryInheritedACLRejectedBeforeWrite(t *testing.T) {
	d := t.TempDir()
	// Linux POSIX ACL xattr: version 2, owner rwx, named user r--,
	// group --x, mask r-x, other --x. The named UID is synthetic.
	b := make([]byte, 4+5*8)
	binary.LittleEndian.PutUint32(b, 2)
	for n, e := range []struct {
		tag, perm uint16
		id        uint32
	}{
		{1, 7, ^uint32(0)}, {2, 4, 22002}, {4, 1, ^uint32(0)}, {16, 5, ^uint32(0)}, {32, 1, ^uint32(0)},
	} {
		o := 4 + n*8
		binary.LittleEndian.PutUint16(b[o:], e.tag)
		binary.LittleEndian.PutUint16(b[o+2:], e.perm)
		binary.LittleEndian.PutUint32(b[o+4:], e.id)
	}
	if err := unix.Setxattr(d, "system.posix_acl_default", b, 0); err != nil {
		if err == unix.EOPNOTSUPP || err == unix.EPERM {
			t.Skipf("fixture filesystem lacks POSIX ACL support: %v", err)
		}
		t.Fatal(err)
	}
	if bindingDirACL(d) == nil {
		t.Fatal("inherited default ACL accepted")
	}
	p := filepath.Join(d, "daemon-pilot.json")
	f, err := os.OpenFile(p, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if _, err := unix.Fgetxattr(int(f.Fd()), "system.posix_acl_access", nil); err == unix.ENODATA {
		t.Fatal("new file's inherited access ACL went unnoticed")
	}
	st, err := f.Stat()
	if err != nil {
		t.Fatal(err)
	}
	if st.Size() != 0 {
		t.Fatal("fixture binding was written before ACL rejection")
	}
}
