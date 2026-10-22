//go:build linux

package provision

import (
	"context"
	"errors"
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
			if phase != "head.json" {
				if e == nil || installationSnapshot(t, parent) != before {
					t.Fatal("partial seed changed", e)
				}
				return
			}
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
