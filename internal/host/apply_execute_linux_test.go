//go:build linux

package host

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"
)

func TestApplyLockedRevalidationAndResume(t *testing.T) {
	dir, owner := operationFixture(t)
	ctx := context.Background()
	id := strings.Repeat("1", 64)
	p := Plan{Inspection: Inspection{Target: Release{"0.1.0", strings.Repeat("0", 64)}}, PlanID: id, Approvable: true}
	writes := 0
	reads := 0
	done := false
	interrupted := true
	d := applyDriver{journal: dir, owner: owner, now: time.Now, observe: func(context.Context, string) (Plan, error) {
		reads++
		q := p
		if reads == 2 {
			q.PlanID = strings.Repeat("2", 64)
		}
		return q, nil
	}, binding: func(context.Context, string) (string, error) { return "bound", nil }, complete: func(context.Context) (bool, error) { return done, nil }, steps: []applyStep{{"initializing", func(context.Context) error {
		writes++
		if interrupted {
			return context.Canceled
		}
		done = true
		return nil
	}}}}
	req := ApplyRequest{SitePath: "/site.json", ApprovedPlan: id}
	if _, e := executeApply(ctx, req, d); !errors.Is(e, ErrStalePlan) || writes != 0 {
		t.Fatal("stale under lock", e, writes)
	}
	d.observe = func(context.Context, string) (Plan, error) { return p, nil }
	r, e := executeApply(ctx, req, d)
	if !errors.Is(e, context.Canceled) || r.Operation == nil {
		t.Fatal(r, e)
	}
	// Changed desired inputs cannot reuse the interrupted approval.
	d.binding = func(context.Context, string) (string, error) { return "different", nil }
	if _, e = executeApply(ctx, req, d); !errors.Is(e, ErrRecovery) || writes != 1 {
		t.Fatal(e, writes)
	}
	d.binding = func(context.Context, string) (string, error) { return "bound", nil }
	interrupted = false
	r, e = executeApply(ctx, req, d)
	if e != nil || r.Outcome != "applied" || writes != 2 {
		t.Fatal(r, e, writes)
	}
	before, _ := os.ReadFile(dir + "/active.json")
	r, e = executeApply(ctx, req, d)
	after, _ := os.ReadFile(dir + "/active.json")
	if e != nil || r.Outcome != "no_change" || string(before) != string(after) || writes != 2 {
		t.Fatal(r, e, writes)
	}
}

func TestApplyResumeReceiptFirstPublication(t *testing.T) {
	for _, phase := range []string{"staging", "initializing", "seeded", "converging", "activating", "verifying", "verified", "completed"} {
		t.Run(phase, func(t *testing.T) {
			dir, owner := operationFixture(t)
			ctx := context.Background()
			l, e := openOperationLock(ctx, dir, owner, time.Now)
			if e != nil {
				t.Fatal(e)
			}
			o, e := l.Begin("apply", strings.Repeat("a", 64), Release{"0.1.0", strings.Repeat("b", 64)})
			if e != nil {
				t.Fatal(e)
			}
			b, _ := json.Marshal(applyIntent{"binding", o.ID})
			if e = replacePrivateAt(l.fd, o.ID+"-apply.json", b); e != nil {
				t.Fatal(e)
			}
			next := o
			next.Seq++
			next.Phase = phase
			if phase == "completed" {
				next.Status = "completed"
			}
			b, _ = json.Marshal(next)
			if e = replacePrivateAt(l.fd, o.ID+".json", b); e != nil {
				t.Fatal(e)
			}
			l.Close()
			l, e = openOperationLock(ctx, dir, owner, time.Now)
			if e != nil {
				t.Fatal(e)
			}
			defer l.Close()
			recovered, resume, e := l.resumeApply("binding", o.PlanID)
			if e != nil || recovered != next || resume != (phase != "completed") {
				t.Fatal(recovered, resume, e)
			}
			if e = l.matchReceipt(recovered); e != nil {
				t.Fatal(e)
			}
		})
	}
}

func TestNewPolicyParentsRespectDeclaredModeNotUmask(t *testing.T) {
	dir, owner := operationFixture(t)
	old := syscall.Umask(077)
	defer syscall.Umask(old)
	if e := ensurePolicyDir(dir+"/public", owner); e != nil {
		t.Fatal(e)
	}
	for _, p := range []string{dir, dir + "/public"} {
		st, e := os.Stat(p)
		if e != nil || st.Mode().Perm() != 0755 {
			t.Fatal(p, st, e)
		}
	}
	if e := os.Chmod(dir, 0700); e != nil {
		t.Fatal(e)
	}
	if e := ensurePolicyDir(dir, owner); e != nil {
		t.Fatal(e)
	}
	st, e := os.Stat(dir)
	if e != nil || st.Mode().Perm() != 0700 {
		t.Fatal("existing private parent widened", st, e)
	}
}

func TestApplyFirstFencePublicationHasBoundIntent(t *testing.T) {
	dir, owner := operationFixture(t)
	ctx := context.Background()
	l, e := openOperationLock(ctx, dir, owner, time.Now)
	if e != nil {
		t.Fatal(e)
	}
	target := Release{"0.1.0", strings.Repeat("b", 64)}
	prior, e := l.Begin("prepare", strings.Repeat("c", 64), target)
	if e != nil {
		t.Fatal(e)
	}
	prior, e = l.Advance(prior, "completed", "completed", "")
	if e != nil {
		t.Fatal(e)
	}
	previous, _ := json.Marshal(prior)
	o, e := l.BeginApply(strings.Repeat("a", 64), target, "bound")
	if e != nil {
		t.Fatal(e)
	}
	if !l.applyIntentMatches(o, "bound") {
		t.Fatal("running fence lacks input binding")
	}
	// Model loss after first active-fence fsync but before its rename.
	if e = replacePrivateAt(l.fd, "active.json", previous); e != nil {
		t.Fatal(e)
	}
	b, _ := json.Marshal(o)
	if e = replacePrivateAt(l.fd, "active.json.next", b); e != nil {
		t.Fatal(e)
	}
	l.Close()
	if !applyCandidate(dir, owner, o.PlanID) {
		t.Fatal("durable first apply stage not inspectable")
	}
	l, e = openOperationLock(ctx, dir, owner, time.Now)
	if e != nil {
		t.Fatal(e)
	}
	defer l.Close()
	got, resume, e := l.resumeApply("bound", o.PlanID)
	if e != nil || !resume || got != o {
		t.Fatal(got, resume, e)
	}
	if e = l.matchReceipt(got); e != nil {
		t.Fatal(e)
	}
}

func TestApplyFailureRefencesBeforeUnlock(t *testing.T) {
	for _, unavailable := range []bool{false, true} {
		t.Run(strconv.FormatBool(unavailable), func(t *testing.T) {
			dir, owner := operationFixture(t)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			p := Plan{PlanID: strings.Repeat("a", 64), Approvable: true, Inspection: Inspection{Target: Release{"0.1.0", strings.Repeat("b", 64)}}}
			gateOpen := false
			fenced := 0
			d := applyDriver{journal: dir, owner: owner, now: time.Now, observe: func(context.Context, string) (Plan, error) { return p, nil }, binding: func(context.Context, string) (string, error) { return "bound", nil }, complete: func(context.Context) (bool, error) { return false, nil }, steps: []applyStep{{"verified", func(context.Context) error { gateOpen = true; cancel(); return ErrNativeApply }}}, fence: func(cleanup context.Context) error {
				fenced++
				if cleanup.Err() != nil {
					t.Fatal("cancelled context reused for closure")
				}
				if l, e := openOperationLock(cleanup, dir, owner, time.Now); !errors.Is(e, ErrBusy) {
					if l != nil {
						l.Close()
					}
					t.Fatal("operation lock released before closure", e)
				}
				if unavailable {
					return ErrEntryFence
				}
				gateOpen = false
				return nil
			}}
			r, e := executeApply(ctx, ApplyRequest{SitePath: "/site.json", ApprovedPlan: p.PlanID}, d)
			want := "verified_closed"
			if unavailable {
				want = "unavailable"
			}
			if !errors.Is(e, context.Canceled) || r.EntryClosure != want || fenced != 1 || gateOpen != unavailable || r.Outcome != "incomplete" {
				t.Fatal(r, e, fenced, gateOpen)
			}
			l, e := openOperationLock(context.Background(), dir, owner, time.Now)
			if e != nil {
				t.Fatal(e)
			}
			l.Close()
		})
	}
}

func TestApplyRefusesProtectedInputDriftDuringActions(t *testing.T) {
	dir, owner := operationFixture(t)
	binding := "approved"
	second := false
	closed := false
	p := Plan{PlanID: strings.Repeat("a", 64), Approvable: true, Inspection: Inspection{Target: Release{"0.1.0", strings.Repeat("b", 64)}}}
	d := applyDriver{journal: dir, owner: owner, now: time.Now, observe: func(context.Context, string) (Plan, error) { return p, nil }, binding: func(context.Context, string) (string, error) { return binding, nil }, complete: func(context.Context) (bool, error) { return false, nil }, fence: func(context.Context) error { closed = true; return nil }, steps: []applyStep{{"staging", func(context.Context) error { binding = "root-delivered-new-secret"; return nil }}, {"activating", func(context.Context) error { second = true; return nil }}}}
	r, e := executeApply(context.Background(), ApplyRequest{SitePath: "/site.json", ApprovedPlan: p.PlanID}, d)
	if !errors.Is(e, ErrStalePlan) || second || !closed || r.EntryClosure != "verified_closed" {
		t.Fatal(r, e, second, closed)
	}
}
