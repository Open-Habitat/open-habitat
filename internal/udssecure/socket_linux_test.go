//go:build linux

package udssecure

import (
	"net"
	"os"
	"path/filepath"
	"testing"
)

func TestRejectsUncontrolledSocketAndPath(t *testing.T) {
	dir, e := os.MkdirTemp("/tmp", "uds-")
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { _ = os.RemoveAll(dir) })
	socket := filepath.Join(dir, "daemon.sock")
	ln, e := net.Listen("unix", socket)
	if e != nil {
		t.Fatal(e)
	}
	defer ln.Close()
	for _, path := range []string{socket, filepath.Join(dir, "missing.sock"), "/run/open-habitat/users/../daemon.sock"} {
		if Mapped(path, os.Getuid()) == nil {
			t.Fatalf("accepted uncontrolled path %q", path)
		}
	}
	alias := filepath.Join(dir, "alias")
	if e := os.Symlink(socket, alias); e != nil {
		t.Fatal(e)
	}
	if Mapped(alias, os.Getuid()) == nil {
		t.Fatal("accepted symlink")
	}
}
