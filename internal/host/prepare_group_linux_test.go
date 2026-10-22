//go:build linux

package host

import (
	"context"
	"os"
	"testing"
)

func TestPrepareProcGroupParser(t *testing.T) {
	if got, e := parseProcGroup([]byte("open-habitat-proc:x:997:\n")); e != nil || got != "997" {
		t.Fatal(got, e)
	}
	for _, bad := range []string{"", "open-habitat-proc:x:0:\n", "open-habitat-proc:x:65534:\n", "open-habitat-proc:x:0997:\n", "other:x:997:\n", "open-habitat-proc:x:997:agent-a\n", "open-habitat-proc:x:997:\nother:x:998:\n"} {
		if _, e := parseProcGroup([]byte(bad)); e == nil {
			t.Fatalf("unsafe group accepted: %q", bad)
		}
	}
}
func TestPrepareNativeProcGroup(t *testing.T) {
	if os.Getenv("HOST_PREPARE_GROUP_CONTAINER") != "1" || os.Geteuid() != 0 {
		t.Skip("disposable root group fixture required")
	}
	ctx := context.Background()
	if group, e := procGroup(ctx); e != nil || group != "absent" {
		t.Fatalf("fixture must start without group: %s %v", group, e)
	}
	if e := installPolicy("/", policyFile{"/etc/sysusers.d/open-habitat-proc.conf", "g open-habitat-proc -\n"}, 0); e != nil {
		t.Fatal(e)
	}
	if e := ensureProcGroup(ctx); e != nil {
		t.Fatal(e)
	}
	group, e := procGroup(ctx)
	if e != nil || group == "absent" {
		t.Fatal(group, e)
	}
	before, e := os.ReadFile("/etc/group")
	if e != nil {
		t.Fatal(e)
	}
	if e := ensureProcGroup(ctx); e != nil {
		t.Fatal(e)
	}
	after, e := os.ReadFile("/etc/group")
	if e != nil || string(before) != string(after) {
		t.Fatal("existing group was rewritten", e)
	}
}
