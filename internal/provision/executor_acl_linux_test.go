//go:build linux

package provision

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestParentACLExactNumericAndDrift(t *testing.T) {
	e := NewLinuxHostExecutor(21003, 21003)
	acl := "user::rwx\nuser:21001:--x\ngroup::--x\nmask::--x\nother::---\n"
	calls := 0
	e.run = func(_ context.Context, path string, args ...string) ([]byte, error) {
		calls++
		if path != getfacl || len(args) != 2 || args[0] != "-cpn" || args[1] != socketBase {
			t.Fatalf("unexpected ACL command: %s %v", path, args)
		}
		return []byte(acl), nil
	}
	if err := e.parentACL(context.Background(), 21001); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []string{
		strings.Replace(acl, "user:21001", "user:carol", 1),
		strings.Replace(acl, "other::---", "other::--x", 1),
		acl + "user:21001:--x\n", acl + "user:99999:--x\n",
	} {
		acl = bad
		if err := e.parentACL(context.Background(), 21001); err == nil {
			t.Fatal("accepted", bad)
		}
	}
	e.run = func(context.Context, string, ...string) ([]byte, error) { return nil, errors.New("ACL unavailable") }
	if err := e.parentACL(context.Background(), 21001); err == nil {
		t.Fatal("accepted unavailable ACL")
	}
	if calls == 0 {
		t.Fatal("no ACL lookup")
	}
}
