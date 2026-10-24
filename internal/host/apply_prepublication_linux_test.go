//go:build linux

package host

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/unix"
)

// fencedStagingApply leaves the journal as an apply that failed in staging:
// running, entry closed, nothing published (birch's EXDEV state).
func fencedStagingApply(t *testing.T, dir string, owner uint32, approval, binding string) Operation {
	t.Helper()
	l, e := openOperationLock(context.Background(), dir, owner, time.Now)
	if e != nil {
		t.Fatal(e)
	}
	defer l.Close()
	o, e := l.BeginApply(approval, Release{"0.1.0-pilot.8", strings.Repeat("8", 64)}, binding)
	for _, phase := range []string{"quiescing", "staging"} {
		if e == nil {
			o, e = l.Advance(o, phase, "running", "")
		}
	}
	if e != nil {
		t.Fatal(e)
	}
	return o
}

func TestApplyPrepublicationContinuationRequiresNothingPublished(t *testing.T) {
	for _, tc := range []struct {
		name  string
		setup func(t *testing.T, root, journal string, l *Lock, o Operation)
		ok    bool
	}{
		{"fresh", func(*testing.T, string, string, *Lock, Operation) {}, true},
		{"empty_parents", func(t *testing.T, root, _ string, _ *Lock, _ Operation) {
			mkdirs(t, root+generationParent, root+"/opt/open-habitat/profiles", root+generationStageParent+"/release-leftover")
		}, true},
		{"generation", func(t *testing.T, root, _ string, _ *Lock, _ Operation) {
			mkdirs(t, root+generationParent+"/"+strings.Repeat("8", 64))
		}, false},
		{"current", func(t *testing.T, root, _ string, _ *Lock, _ Operation) {
			mkdirs(t, root+"/opt/open-habitat")
			if e := os.Symlink("/nowhere", root+"/opt/open-habitat/current"); e != nil {
				t.Fatal(e)
			}
		}, false},
		{"profile", func(t *testing.T, root, _ string, _ *Lock, _ Operation) {
			mkdirs(t, root+"/opt/open-habitat/profiles/editor")
		}, false},
		{"broker", func(t *testing.T, root, _ string, _ *Lock, _ Operation) {
			mkdirs(t, root+"/var/lib/open-habitat/broker")
		}, false},
		{"immutable", func(t *testing.T, _, journal string, _ *Lock, _ Operation) {
			writePrivate(t, filepath.Join(journal, "installation.json"))
		}, false},
		{"gateway", func(t *testing.T, root, _ string, _ *Lock, _ Operation) {
			mkdirs(t, root+"/etc/open-habitat/gateway")
			writePrivate(t, root+"/etc/open-habitat/gateway/gateway.json")
		}, false},
		{"intent_stage", func(t *testing.T, _, journal string, _ *Lock, o Operation) {
			writePrivate(t, filepath.Join(journal, o.ID+"-apply.json.next"))
		}, false},
		{"initializing", func(t *testing.T, _, _ string, l *Lock, o Operation) {
			if _, e := l.Advance(o, "initializing", "running", ""); e != nil {
				t.Fatal(e)
			}
		}, false},
		{"receipt_split", func(t *testing.T, _, journal string, l *Lock, o Operation) {
			next := o
			next.Seq++
			if e := replacePrivateAt(l.fd, o.ID+".json", mustOperationBytes(t, next)); e != nil {
				t.Fatal(e)
			}
		}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			journal, owner := operationFixture(t)
			root := filepath.Join(filepath.Dir(journal), "root")
			o := fencedStagingApply(t, journal, owner, strings.Repeat("a", 64), "old")
			l, e := openOperationLock(context.Background(), journal, owner, time.Now)
			if e != nil {
				t.Fatal(e)
			}
			tc.setup(t, root, journal, l, o)
			l.Close()
			got, e := applyPrepublicationContinuation(journal, owner, root)
			if tc.ok != (e == nil) || tc.ok && got != o {
				t.Fatalf("ok=%v got %+v %v", tc.ok, got, e)
			}
		})
	}
}

func TestApplyPlanBindsPrepublicationContinuation(t *testing.T) {
	site, src, _ := inspectionFixture(t)
	fencedStagingApply(t, src.journal, src.owner, strings.Repeat("a", 64), "old")
	fence := func(p Plan) Check {
		for _, c := range p.Checks {
			if c.Code == "operation.fence" {
				return c
			}
		}
		return Check{}
	}
	// Without an installation root to observe there is no continuation proof.
	p, e := buildPlan(context.Background(), site, src)
	if e != nil || fence(p) != (Check{"operation.fence", "fail", "recovery_required"}) || p.Continuation != nil {
		t.Fatal(fence(p), p.Continuation, e)
	}
	src.installRoot = filepath.Join(filepath.Dir(src.journal), "root")
	p, e = buildPlan(context.Background(), site, src)
	if e != nil || fence(p) != (Check{"operation.fence", "pass", "apply_prepublication_continuation_verified"}) || p.Continuation == nil || p.Continuation.Phase != "staging" {
		t.Fatal(fence(p), p.Continuation, e)
	}
	// Preparation never takes over an apply.
	q, e := buildPlanMode(context.Background(), site, src, true)
	if e != nil || fence(q).Status == "pass" {
		t.Fatal(fence(q), e)
	}
	// The approval names this exact record: any journal change makes it stale.
	l, e := openOperationLock(context.Background(), src.journal, src.owner, time.Now)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = l.Advance(*p.Continuation, "staging", "running", ""); e != nil {
		t.Fatal(e)
	}
	l.Close()
	again, e := buildPlan(context.Background(), site, src)
	if e != nil || again.PlanID == p.PlanID || again.Continuation == nil || again.Continuation.Seq != p.Continuation.Seq+1 {
		t.Fatal("continuation plan did not bind the operation record", again.Continuation, e)
	}
}

func TestApplyPrepublicationRollForwardCompletesSameOperation(t *testing.T) {
	for _, bad := range []string{"", "no_continuation", "other_record", "original_approval", "intent_written", "receipt_split"} {
		t.Run(bad, func(t *testing.T) {
			dir, owner := operationFixture(t)
			ctx := context.Background()
			original := strings.Repeat("a", 64)
			fenced := fencedStagingApply(t, dir, owner, original, "pilot8-site-and-product")
			approval := strings.Repeat("b", 64)
			successor := Release{"0.1.0-pilot.9", strings.Repeat("9", 64)}
			continuation := fenced
			if bad == "other_record" {
				continuation.Seq++
			}
			plan := Plan{Inspection: Inspection{Target: successor, Checks: []Check{{"operation.fence", "pass", "apply_prepublication_continuation_verified"}}}, PlanID: approval, Approvable: true, Continuation: &continuation}
			if bad == "no_continuation" {
				plan.Continuation = nil
			}
			req := ApplyRequest{SitePath: "/site.json", ApprovedPlan: approval}
			if bad == "original_approval" {
				req.ApprovedPlan = original
				plan.PlanID = original
			}
			phases := []string{}
			done := false
			d := applyDriver{journal: dir, owner: owner, now: time.Now,
				observe:  func(context.Context, string) (Plan, error) { return plan, nil },
				binding:  func(context.Context, string) (string, error) { return "pilot9-site-and-product", nil },
				complete: func(context.Context) (bool, error) { return done, nil },
				fence:    func(context.Context) error { return nil },
			}
			for _, phase := range []string{"quiescing", "staging", "initializing", "verified"} {
				d.steps = append(d.steps, applyStep{phase, func(context.Context) error {
					phases = append(phases, phase)
					done = phase == "verified"
					return nil
				}})
			}
			d.resumeSteps = func(o Operation) ([]applyStep, error) {
				if lateApplyPhase(o.Phase) {
					return nil, ErrRecovery
				}
				return d.steps, nil
			}
			journalBefore := snapshot(t, dir)
			if bad == "intent_written" || bad == "receipt_split" {
				// An interrupted roll-forward: the new intent is durable, and for
				// a split also the new receipt, but the fence still names the old.
				l, e := openOperationLock(ctx, dir, owner, time.Now)
				if e != nil {
					t.Fatal(e)
				}
				b, _ := json.Marshal(applyIntent{"pilot9-site-and-product", fenced.ID})
				if e = replacePrivateAt(l.fd, fenced.ID+"-apply.json", b); e != nil {
					t.Fatal(e)
				}
				if bad == "receipt_split" {
					next := fenced
					next.PlanID, next.Target, next.Phase, next.Seq = approval, successor, "started", fenced.Seq+1
					if e = replacePrivateAt(l.fd, fenced.ID+".json", mustOperationBytes(t, next)); e != nil {
						t.Fatal(e)
					}
				}
				l.Close()
			}
			r, e := executeApply(ctx, req, d)
			switch bad {
			case "no_continuation", "other_record", "original_approval":
				if !errors.Is(e, ErrRecovery) || len(phases) != 0 || snapshot(t, dir) != journalBefore {
					t.Fatal("unproven takeover", r, e, phases)
				}
				return
			}
			if e != nil || r.Outcome != "applied" || strings.Join(phases, ",") != "quiescing,staging,initializing,verified" {
				t.Fatal(r, e, phases)
			}
			o := *r.Operation
			if o.ID != fenced.ID || o.StartedAt != fenced.StartedAt || o.PlanID != approval || o.Target != successor || o.Status != "completed" || o.Seq <= fenced.Seq {
				t.Fatalf("%+v", o)
			}
			fd, e := openDir(dir, owner, true)
			if e != nil {
				t.Fatal(e)
			}
			defer unix.Close(fd)
			if !(&Lock{fd: fd, owner: owner}).applyIntentMatches(o, "pilot9-site-and-product") {
				t.Fatal("intent was not rolled forward")
			}
			// The completed operation verifies on repeat without running steps.
			phases = nil
			if r, e = executeApply(ctx, req, d); e != nil || r.Outcome != "no_change" || len(phases) != 0 {
				t.Fatal(r, e, phases)
			}
		})
	}
}

func TestGenerationPublicationCrossDeviceIsTyped(t *testing.T) {
	home, e := os.UserHomeDir()
	if e != nil {
		t.Fatal(e)
	}
	var a, b unix.Stat_t
	if unix.Stat("/dev/shm", &a) != nil || unix.Stat(home, &b) != nil || a.Dev == b.Dev {
		t.Skip("needs /dev/shm on a filesystem other than the home directory")
	}
	src, e := os.MkdirTemp("/dev/shm", "oh-stage-")
	if e != nil {
		t.Skip("/dev/shm not writable", e)
	}
	t.Cleanup(func() { os.RemoveAll(src) })
	dest := filepath.Join(t.TempDir(), "generation")
	if e = publishGeneration(src, dest); !errors.Is(e, ErrStagingCrossDevice) || !errors.Is(e, unix.EXDEV) {
		t.Fatal(e)
	}
	if _, e = os.Stat(src); e != nil {
		t.Fatal("stage lost on refused publication", e)
	}
}

// Run by scripts/test-host-initialization-uids.sh with /var/lib/open-habitat
// on its own tmpfs, the layout of a server with a separate /var.
func TestGenerationStagingWithSeparateVar(t *testing.T) {
	if os.Geteuid() != 0 || os.Getenv("HOST_SPLIT_VAR_CONTAINER") != "1" {
		t.Skip("disposable root container with a separately mounted /var/lib/open-habitat only")
	}
	var v, o unix.Stat_t
	if e := unix.Stat("/var/lib/open-habitat", &v); e != nil {
		t.Fatal(e)
	}
	if e := ensurePolicyDir(generationParent, 0); e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { os.RemoveAll("/opt/open-habitat") })
	if e := unix.Stat(generationParent, &o); e != nil || v.Dev == o.Dev {
		t.Fatal("fixture does not separate /var from /opt", e)
	}
	// The earlier staging parent under /var is refused before any archive work.
	if _, e := openGenerationStage("/var/lib/open-habitat/staging", generationParent, 0); !errors.Is(e, ErrStagingCrossDevice) {
		t.Fatal("cross-device staging parent accepted", e)
	}
	legacy, e := os.MkdirTemp("/var/lib/open-habitat/staging", "release-")
	if e != nil {
		t.Fatal(e)
	}
	if e = publishGeneration(legacy, generationParent+"/"+strings.Repeat("8", 64)); !errors.Is(e, ErrStagingCrossDevice) {
		t.Fatal(e)
	}
	parent, e := openGenerationStage(generationStageParent, generationParent, 0)
	if e != nil {
		t.Fatal(e)
	}
	defer parent.Close()
	var st unix.Stat_t
	if e = unix.Stat(generationStageParent, &st); e != nil || st.Mode&0777 != 0700 || st.Uid != 0 {
		t.Fatal("staging parent is not private", st.Mode, e)
	}
	if e = parent.Mkdir("release-x", 0700); e != nil {
		t.Fatal(e)
	}
	if e = os.WriteFile(generationStageParent+"/release-x/product.json", []byte("[]"), 0644); e != nil {
		t.Fatal(e)
	}
	dest := generationParent + "/" + strings.Repeat("9", 64)
	if e = publishGeneration(generationStageParent+"/release-x", dest); e != nil {
		t.Fatal(e)
	}
	if b, e := os.ReadFile(dest + "/product.json"); e != nil || string(b) != "[]" {
		t.Fatal("published generation", e)
	}
	if e = publishGeneration(generationStageParent+"/release-x", dest); e == nil {
		t.Fatal("publication replaced an existing generation")
	}
}

func mkdirs(t *testing.T, paths ...string) {
	t.Helper()
	for _, p := range paths {
		if e := os.MkdirAll(p, 0755); e != nil {
			t.Fatal(e)
		}
	}
}

func writePrivate(t *testing.T, path string) {
	t.Helper()
	if e := os.WriteFile(path, []byte("{}"), 0600); e != nil {
		t.Fatal(e)
	}
}
