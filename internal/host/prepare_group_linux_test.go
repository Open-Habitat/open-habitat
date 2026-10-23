//go:build linux

package host

import (
	"context"
	"os"
	"os/exec"
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

func TestPrepareProcNumericRemountNative(t *testing.T) {
	if os.Getenv("HOST_PROC_REMOUNT_CONTAINER") != "1" || os.Geteuid() != 0 {
		t.Skip("isolated rootless mount namespace only")
	}
	ctx := context.Background()
	if err := installPolicy("/", policyFile{"/etc/sysusers.d/open-habitat-proc.conf", "g open-habitat-proc -\n"}, 0); err != nil {
		t.Fatal(err)
	}
	if err := ensureProcGroup(ctx); err != nil {
		t.Fatal(err)
	}
	ps, err := nativePreparePolicies(ctx, Site{})
	if err != nil {
		t.Fatal(err)
	}
	var args []string
	for _, p := range ps {
		if p.Path != "/etc/systemd/system/open-habitat-proc.service" {
			continue
		}
		for _, line := range strings.Split(p.Content, "\n") {
			if strings.HasPrefix(line, "ExecStart=") {
				args = strings.Fields(strings.TrimPrefix(line, "ExecStart="))
			}
		}
	}
	if len(args) != 4 || strings.Contains(args[2], "open-habitat-proc") || strings.Contains(args[2], "@") {
		t.Fatal("unrendered unit", args)
	}
	// Drive precisely the rendered unit command twice. util-linux 2.39.3 can
	// resolve a name on the first remount but leaves it unconverted on a repeat.
	for i := 0; i < 2; i++ {
		if b, err := exec.CommandContext(ctx, args[0], args[1:]...).CombinedOutput(); err != nil {
			t.Fatalf("remount %d: %v %s", i, err, b)
		}
	}
}
