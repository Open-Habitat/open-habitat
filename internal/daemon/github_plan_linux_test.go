//go:build linux

package daemon

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// A handoff plan answers each default in order: a checkout of that very
// repository in ~/src (names compare case-insensitively, as GitHub's do) is
// already_present and is never cloned over; the rest wait for ~/src's writer
// and start one at a time as ordinary jobs, under GitHub's own spelling. A
// start the daemon refuses, an unrelated tree at the destination included,
// stays listed with its reason and is not tried again.
func TestPlanQueuesOnlyAbsentDefaults(t *testing.T) {
	home := t.TempDir()
	script := gitWrapper(t, home, seedBare(t), false)
	f := newCloneJobsFixture(t, home, script)
	present := filepath.Join(home, "src", "Present")
	for _, args := range [][]string{{"init", "-q", present}, {"-C", present, "remote", "add", "origin", "https://github.com/org/present.git"}} {
		if b, err := exec.Command("/usr/bin/git", args...).CombinedOutput(); err != nil {
			t.Fatal(err, string(b))
		}
	}
	// Same destination name, another repository's tree.
	if err := os.Mkdir(filepath.Join(home, "src", "docs"), 0700); err != nil {
		t.Fatal(err)
	}
	var mu sync.Mutex
	lookups := map[string]int{}
	inner := f.jobs.run
	f.jobs.run = func(ctx context.Context, program, dir, fd string, args ...string) ([]byte, error) {
		if program == "gh" && args[len(args)-1] != "/user" {
			endpoint := args[len(args)-1]
			mu.Lock()
			lookups[endpoint]++
			mu.Unlock()
			if endpoint == "/repos/org/gone" {
				return nil, os.ErrNotExist
			}
			if endpoint == "/repos/org/docs" {
				return []byte(`{"name":"docs","full_name":"org/docs","owner":{"login":"org"},"clone_url":"https://github.com/org/docs.git"}`), nil
			}
		}
		return inner(ctx, program, dir, fd, args...)
	}
	if err := os.WriteFile(f.gate, nil, 0600); err != nil {
		t.Fatal(err)
	}
	// Hold ~/src's writer as another clone would: nothing starts meanwhile.
	cloneWriter.Lock()
	out := f.jobs.Plan(context.Background(), transport.Plan{Mode: "skip", Defaults: []string{"org/present", "ORG/Repo", "org/gone", "org/docs"}})
	want := []transport.PlanOutcome{{FullName: "org/present", Outcome: "already_present"}, {FullName: "ORG/Repo", Outcome: "queued"}, {FullName: "org/gone", Outcome: "queued"}, {FullName: "org/docs", Outcome: "queued"}}
	if len(out) != 4 || out[0] != want[0] || out[1] != want[1] || out[2] != want[2] || out[3] != want[3] {
		t.Fatal(out)
	}
	time.Sleep(50 * time.Millisecond)
	mu.Lock()
	looked := len(lookups)
	mu.Unlock()
	if planned := f.list()["planned"].([]any); len(planned) != 3 || planned[0].(map[string]any)["state"] != "waiting" || looked != 0 {
		t.Fatal("started while ~/src was busy", planned, looked)
	}
	cloneWriter.Unlock()
	f.waitFile(f.ready)
	list := f.list()
	jobs := list["jobs"].([]any)
	// The job carries GitHub's spelling, not the site's.
	if len(jobs) != 1 || jobs[0].(map[string]any)["full_name"] != "org/repo" || jobs[0].(map[string]any)["mode"] != "full" {
		t.Fatal(jobs)
	}
	if err := os.Remove(f.gate); err != nil {
		t.Fatal(err)
	}
	for deadline := time.Now().Add(10 * time.Second); ; time.Sleep(20 * time.Millisecond) {
		planned := f.list()["planned"].([]any)
		if len(planned) == 2 && planned[0].(map[string]any)["state"] == "refused" && planned[1].(map[string]any)["state"] == "refused" {
			got := map[any]any{}
			for _, p := range planned {
				got[p.(map[string]any)["full_name"]] = p.(map[string]any)["reason"]
			}
			if got["org/gone"] != "native_source_unavailable" || got["org/docs"] != "checkout_exists" {
				t.Fatal(got)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("refusals never listed", planned)
		}
	}
	f.settle()
	time.Sleep(50 * time.Millisecond)
	mu.Lock()
	defer mu.Unlock()
	if lookups["/repos/org/present"] != 0 || lookups["/repos/org/gone"] != 1 || lookups["/repos/ORG/Repo"] != 1 || lookups["/repos/org/docs"] != 1 {
		t.Fatal("present default cloned or refusal retried", lookups)
	}
	if out := f.jobs.Plan(context.Background(), transport.Plan{Mode: "skip", Defaults: make([]string, maxPlanned)}); out != nil {
		t.Fatal("plan beyond the bound answered", out)
	}
}
