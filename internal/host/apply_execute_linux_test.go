//go:build linux

package host

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
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
