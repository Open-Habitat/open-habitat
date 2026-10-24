//go:build linux

package daemon

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// A handoff plan answers each default in order: an existing ~/src entry of
// the same name (case-insensitively, as GitHub names compare) is
// already_present and is never cloned over; the rest wait for ~/src's writer
// and start one at a time as ordinary jobs. A start the daemon refuses stays
// listed with its reason and is not tried again.
func TestPlanQueuesOnlyAbsentDefaults(t *testing.T) {
	home := t.TempDir()
	script := gitWrapper(t, home, seedBare(t), false)
	f := newCloneJobsFixture(t, home, script)
	if err := os.Mkdir(filepath.Join(home, "src", "Present"), 0700); err != nil {
		t.Fatal(err)
	}
	lookups := map[string]int{}
	inner := f.jobs.run
	f.jobs.run = func(ctx context.Context, program, dir, fd string, args ...string) ([]byte, error) {
		if program == "gh" && args[len(args)-1] != "/user" {
			lookups[args[len(args)-1]]++
			if args[len(args)-1] == "/repos/org/gone" {
				return nil, os.ErrNotExist
			}
		}
		return inner(ctx, program, dir, fd, args...)
	}
	if err := os.WriteFile(f.gate, nil, 0600); err != nil {
		t.Fatal(err)
	}
	// Hold ~/src's writer as another clone would: nothing starts meanwhile.
	cloneWriter.Lock()
	out := f.jobs.Plan(context.Background(), transport.Plan{Mode: "skip", Defaults: []string{"org/present", "org/repo", "org/gone"}})
	want := []transport.PlanOutcome{{FullName: "org/present", Outcome: "already_present"}, {FullName: "org/repo", Outcome: "queued"}, {FullName: "org/gone", Outcome: "queued"}}
	if len(out) != 3 || out[0] != want[0] || out[1] != want[1] || out[2] != want[2] {
		t.Fatal(out)
	}
	time.Sleep(50 * time.Millisecond)
	if planned := f.list()["planned"].([]any); len(planned) != 2 || planned[0].(map[string]any)["state"] != "waiting" || len(lookups) != 0 {
		t.Fatal("started while ~/src was busy", planned, lookups)
	}
	cloneWriter.Unlock()
	f.waitFile(f.ready)
	list := f.list()
	jobs := list["jobs"].([]any)
	if len(jobs) != 1 || jobs[0].(map[string]any)["full_name"] != "org/repo" || jobs[0].(map[string]any)["mode"] != "full" {
		t.Fatal(jobs)
	}
	if err := os.Remove(f.gate); err != nil {
		t.Fatal(err)
	}
	for deadline := time.Now().Add(10 * time.Second); ; time.Sleep(20 * time.Millisecond) {
		planned := f.list()["planned"].([]any)
		if len(planned) == 1 && planned[0].(map[string]any)["state"] == "refused" {
			if p := planned[0].(map[string]any); p["full_name"] != "org/gone" || p["reason"] != "native_source_unavailable" {
				t.Fatal(p)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("refusal never listed", planned)
		}
	}
	f.settle()
	time.Sleep(50 * time.Millisecond)
	if lookups["/repos/org/present"] != 0 || lookups["/repos/org/gone"] != 1 || lookups["/repos/org/repo"] != 1 {
		t.Fatal("present default cloned or refusal retried", lookups)
	}
	if out := f.jobs.Plan(context.Background(), transport.Plan{Mode: "skip", Defaults: make([]string, maxPlanned)}); out != nil {
		t.Fatal("plan beyond the bound answered", out)
	}
}
