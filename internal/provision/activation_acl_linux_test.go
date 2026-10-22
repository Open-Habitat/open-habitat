//go:build linux

package provision

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

// Run only in the disposable VM-tools container, never on the development host.
// Real setfacl/getfacl are needed: callback output cannot establish that cold
// directory reconstruction produces the ACL representation the verifier accepts.
func TestColdRuntimeACLNative(t *testing.T) {
	if os.Getenv("HOST_COLD_ACL_CONTAINER") != "1" || os.Geteuid() != 0 {
		t.Skip("requires isolated root VM-tools container")
	}
	if _, err := os.Lstat("/run/open-habitat"); !os.IsNotExist(err) {
		t.Fatal("fixture must start absent", err)
	}
	for path, mode := range map[string]os.FileMode{"/run/open-habitat": 0750, socketBase: 0710} {
		if err := os.MkdirAll(path, mode); err != nil {
			t.Fatal(err)
		}
		if err := os.Chown(path, 0, 21003); err != nil {
			t.Fatal(err)
		}
		if err := os.Chmod(path, mode); err != nil {
			t.Fatal(err)
		}
	}
	e := NewLinuxHostExecutor(21003, 21003)
	ctx := context.Background()
	for n, name := range []string{"guestone", "guesttwo"} {
		i := ExecutorIdentity{provider: "github", id: number(uint32(n + 1)), username: name, uid: uint32(21032 + n)}
		if err := e.prepareSocket(ctx, i); err != nil {
			t.Fatal("native cold reconstruction", name, err)
		}
		if err := e.socket(ctx, i); err != nil {
			t.Fatal("native reconstructed ACL rejected", name, err)
		}
		p := filepath.Join(socketBase, name)
		if _, err := e.command(ctx, setfacl, "-m", "u:21034:--x", p); err != nil {
			t.Fatal(err)
		}
		if e.socket(ctx, i) == nil {
			t.Fatal("foreign named ACL accepted")
		}
		if e.prepareSocket(ctx, i) == nil {
			t.Fatal("existing drift repaired")
		}
		if _, err := e.command(ctx, setfacl, "-x", "u:21034", p); err != nil {
			t.Fatal(err)
		}
	}
}
