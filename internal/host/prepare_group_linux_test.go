//go:build linux

package host

import (
	"context"
	"os"
	"strings"
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
	// Primary memberships and aliases are real NSS observations here, not only
	// parser fixtures. Neither unsafe state may be repaired or accepted.
	passwd, e := os.ReadFile("/etc/passwd")
	if e != nil {
		t.Fatal(e)
	}
	if e = os.WriteFile("/etc/passwd", append(append([]byte{}, passwd...), []byte("agent-a:x:21001:"+group+"::/nonexistent:/usr/sbin/nologin\n")...), 0644); e != nil {
		t.Fatal(e)
	}
	if e = ensureProcGroup(ctx); e != ErrTrust {
		t.Fatalf("primary membership accepted: %v", e)
	}
	if e = os.WriteFile("/etc/passwd", passwd, 0644); e != nil {
		t.Fatal(e)
	}
	if e = os.WriteFile("/etc/group", append(append([]byte{}, before...), []byte("fixture-alias:x:"+group+":\n")...), 0644); e != nil {
		t.Fatal(e)
	}
	if e = ensureProcGroup(ctx); e != ErrTrust {
		t.Fatalf("GID alias accepted: %v", e)
	}
}

func TestPrepareProcPrimaryAndAliasRefusals(t *testing.T) {
	groups := []byte("root:x:0:\nopen-habitat-proc:x:997:\n")
	users := []byte("root:x:0:0::/root:/bin/sh\nagent-a:x:21001:21001::/home/agent-a:/usr/sbin/nologin\n")
	if !safeProcMembership("997", groups, users) {
		t.Fatal("empty exemption refused")
	}
	for _, bad := range [][]byte{
		[]byte(strings.Replace(string(users), "21001:21001:", "21001:997:", 1)),
		[]byte(strings.Replace(string(users), "21001:21001:", "21001:0997:", 1)),
		nil, []byte("malformed"),
	} {
		if safeProcMembership("997", groups, bad) {
			t.Fatal("primary/unknown members accepted")
		}
	}
	for _, bad := range [][]byte{
		append(append([]byte{}, groups...), []byte("alias:x:997:agent-a\n")...),
		append(append([]byte{}, groups...), []byte("open-habitat-proc:x:997:\n")...),
		[]byte(strings.Replace(string(groups), "997:", "997:agent-a", 1)),
		nil,
	} {
		if safeProcMembership("997", bad, users) {
			t.Fatal("alias/ambiguous membership accepted")
		}
	}
}
