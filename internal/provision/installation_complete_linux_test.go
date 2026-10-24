//go:build linux

package provision

import (
	"context"
	"errors"
	"golang.org/x/sys/unix"
	"os"
	"testing"
)

func TestCompleteOnlyExactUnpublishedInitialization(t *testing.T) {
	for _, phase := range []string{"broker.json", "allowlist.json", "bindings.json", "head.json"} {
		t.Run(phase, func(t *testing.T) {
			parent, owner, p := installFixture(t)
			stop := errors.New("interrupted")
			_, e := initializeBroker(context.Background(), parent, "broker", p, []string{"42"}, owner, func(at string) error {
				if at == phase {
					return stop
				}
				return nil
			})
			if !errors.Is(e, stop) {
				t.Fatal(e)
			}
			before := installationSnapshot(t, parent)
			e = completeBrokerInitialization(context.Background(), parent, p, []string{"42"}, owner)

			if e != nil {
				t.Fatal(e)
			}
			st, e := inspectInstallation(context.Background(), parent+"/broker", owner)
			if e != nil || st.Epoch != 1 || st.Generation != 1 || len(st.BoundSubjects) != 0 {
				t.Fatal(st, e)
			}
			before = installationSnapshot(t, parent)
			if e = completeBrokerInitialization(context.Background(), parent, p, []string{"42"}, owner); e == nil || installationSnapshot(t, parent) != before {
				t.Fatal("occupied seed changed", e)
			}
		})
	}
}

// Snapshot metadata is unnecessary here: absence of any content/path mutation
// is the property distinguishing refused partial and occupied transactions.
func installationSnapshot(t *testing.T, dir string) string {
	t.Helper()
	var out string
	entries, e := os.ReadDir(dir)
	if e != nil {
		t.Fatal(e)
	}
	for _, entry := range entries {
		out += entry.Name()
		if entry.IsDir() {
			out += installationSnapshot(t, dir+"/"+entry.Name())
		} else {
			b, e := os.ReadFile(dir + "/" + entry.Name())
			if e != nil {
				t.Fatal(e)
			}
			out += string(b)
		}
	}
	return out
}

func TestCompleteAdmissionPreservesCommittedHead(t *testing.T) {
	parent, owner, p := installFixture(t)
	ctx := context.Background()
	if _, e := initializeBroker(ctx, parent, "broker", p, []string{"42", "43"}, owner, nil); e != nil {
		t.Fatal(e)
	}
	dir := parent + "/broker"
	fd, e := lockedDir(ctx, dir, owner)
	if e != nil {
		t.Fatal(e)
	}
	oldHead, _ := readAt(fd, "head.json", owner)
	oldBindings, _ := readAt(fd, "bindings.json", owner)
	next := allowFile{Version: 1, Epoch: 2, IDs: []allowed{{ID: "42"}}}
	if e = writeNew(fd, "allowlist.json.next", marshal(next)); e != nil {
		t.Fatal(e)
	}
	unix.Close(fd)
	before := installationSnapshot(t, parent)
	if e = completeAdmissionPublication(ctx, dir, p, []string{"43"}, false, owner); e == nil || installationSnapshot(t, parent) != before {
		t.Fatal("different desired set accepted", e)
	}
	if e = completeAdmissionPublication(ctx, dir, p, []string{"42"}, false, owner); e != nil {
		t.Fatal(e)
	}
	state, e := inspectInstallation(ctx, dir, owner)
	if e != nil || state.Epoch != 2 || state.ObservedEpoch != 1 || len(state.Admission) != 1 || state.Admission[0] != "42" {
		t.Fatal(state, e)
	}
	fd, e = lockedDir(ctx, dir, owner)
	if e != nil {
		t.Fatal(e)
	}
	defer unix.Close(fd)
	head, _ := readAt(fd, "head.json", owner)
	bindings, _ := readAt(fd, "bindings.json", owner)
	if string(head) != string(oldHead) || string(bindings) != string(oldBindings) {
		t.Fatal("native ledger/head rewritten")
	}
}
