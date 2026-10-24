//go:build linux

package host

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"golang.org/x/sys/unix"
)

// applyDriver supplies observations and fixed product actions, never commands
// from the site. Every step must reobserve its native postcondition on retry.
type applyDriver struct {
	journal     string
	owner       uint32
	now         func() time.Time
	observe     func(context.Context, string) (Plan, error)
	binding     func(context.Context, string) (string, error)
	steps       []applyStep
	resumeSteps func(Operation) ([]applyStep, error)
	complete    func(context.Context) (bool, error)
	fence       func(context.Context) error
	revalidate  func(context.Context, string) error
}
type applyStep struct {
	phase string
	run   func(context.Context) error
}
// An apply intent names the approval it belongs to: a rolled-forward binding
// must never be accepted under the approval it replaced.
type applyIntent struct {
	Binding     string `json:"binding"`
	OperationID string `json:"operation_id"`
	PlanID      string `json:"plan_id"`
}

func executeApply(ctx context.Context, req ApplyRequest, d applyDriver) (r ApplyResult, resultErr error) {
	begun := false
	defer func() {
		if resultErr != nil && ctx.Err() != nil {
			resultErr = errors.Join(resultErr, ctx.Err())
		}
	}()
	r, err := qualifyApply(ctx, req, d.observe)
	if req.DryRun {
		return r, err
	}
	if err != nil {
		// A matching prior approval is only a candidate for read-only
		// postcondition verification or same-input continuation under the lock.
		if !applyCandidate(d.journal, d.owner, req.ApprovedPlan) {
			return r, err
		}
	}
	if err = ensurePolicyDir(filepath.Dir(d.journal), d.owner); err != nil {
		return r, err
	}
	l, err := openOperationLock(ctx, d.journal, d.owner, d.now)
	if err != nil {
		return r, err
	}
	defer func() {
		defer l.Close()
		if resultErr != nil {
			resultErr = errors.Join(resultErr, l.recordAptFailure(r.Operation, resultErr))
		}
		if resultErr != nil && begun && d.fence != nil {
			cleanup, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			if e := d.fence(cleanup); e != nil {
				r.EntryClosure = "unavailable"
				resultErr = errors.Join(resultErr, e)
			} else {
				r.EntryClosure = "verified_closed"
			}
		}
	}()
	// Approval comparison happens again after exclusion, before any intent or
	// service/account mutation. The sole earlier write is the lock trust root.
	binding, err := d.binding(ctx, req.SitePath)
	if err != nil {
		return r, err
	}
	o, resume, err := l.resumeApply(binding, req.ApprovedPlan)
	if errors.Is(err, errApplyOtherApproval) {
		// Only a plan observed now, under the lock, that verified this exact
		// unpublished operation may take it over; the plan ID is the approval.
		r, err = qualifyApply(ctx, req, d.observe)
		if err != nil {
			return r, err
		}
		if r.Plan.Continuation == nil || *r.Plan.Continuation != o || !planChecks(r.Plan, "operation.fence", "apply_prepublication_continuation_verified") {
			return r, ErrRecovery
		}
		o, err = l.rollApplyForward(o, r.Plan.PlanID, r.Plan.Target, binding)
		if err != nil {
			return r, err
		}
		resume = true
	}
	if err != nil {
		return r, err
	}
	begun = resume
	if d.revalidate != nil {
		if e := d.revalidate(ctx, req.SitePath); e != nil {
			return r, e
		}
	}
	currentBinding, e := d.binding(ctx, req.SitePath)
	if e != nil {
		return r, e
	}
	if currentBinding != binding {
		return r, ErrStalePlan
	}
	if !resume && o.Kind == "apply" && o.PlanID == req.ApprovedPlan && l.applyIntentMatches(o, binding) {
		if ok, e := d.complete(ctx); e != nil {
			return r, e
		} else if ok {
			r.Outcome = "no_change"
			r.Would = []Action{}
			r.Operation = &o
			return r, nil
		}
	}
	if !resume {
		r, err = qualifyApply(ctx, req, d.observe)
		if err != nil {
			return r, err
		}
		if ok, e := d.complete(ctx); e != nil {
			return r, e
		} else if ok {
			r.Outcome = "no_change"
			r.Would = []Action{}
			return r, nil
		}
		o, err = l.BeginApply(r.Plan.PlanID, r.Plan.Target, binding)
		if err != nil {
			return r, err
		}
		begun = true
	}
	r.Operation = &o
	r.Outcome = "incomplete"
	steps := d.steps
	if resume && d.resumeSteps != nil {
		steps, err = d.resumeSteps(o)
		if err != nil {
			return r, err
		}
	}
	for _, step := range steps {
		if err = ctx.Err(); err != nil {
			return r, err
		}
		if current, e := d.binding(ctx, req.SitePath); e != nil {
			return r, e
		} else if current != binding {
			return r, ErrStalePlan
		}
		next, e := l.Advance(o, step.phase, "running", "")
		if e != nil {
			return r, e
		}
		o = next
		r.Operation = &o
		if req.Progress != nil {
			if err = req.Progress(step.phase); err != nil {
				return r, err
			}
		}
		if err = step.run(ctx); err != nil {
			return r, err
		}
		// External root secret delivery does not share this lock. Never publish
		// a completed operation over different protected inputs selected late
		// by an action; on drift the entry fence is restored under the lock.
		if current, e := d.binding(ctx, req.SitePath); e != nil {
			return r, e
		} else if current != binding {
			return r, ErrStalePlan
		}
	}
	if ok, e := d.complete(ctx); e != nil {
		return r, e
	} else if !ok {
		return r, ErrRecovery
	}
	if current, e := d.binding(ctx, req.SitePath); e != nil {
		return r, e
	} else if current != binding {
		return r, ErrStalePlan
	}
	o, err = l.Advance(o, "completed", "completed", "")
	if err != nil {
		return r, err
	}
	r.Operation = &o
	r.Outcome = "applied"
	r.Would = []Action{}
	return r, nil
}

func planChecks(p Plan, code, reason string) bool {
	for _, c := range p.Checks {
		if c.Code == code {
			return c.Status == "pass" && c.Reason == reason
		}
	}
	return false
}

func qualifyApply(ctx context.Context, req ApplyRequest, observe func(context.Context, string) (Plan, error)) (ApplyResult, error) {
	if !absolute(req.SitePath) {
		return ApplyResult{}, siteError("--site", "require canonical absolute non-root path")
	}
	if req.ApprovedPlan != "" && !digestRE.MatchString(req.ApprovedPlan) {
		return ApplyResult{}, siteError("--approved-plan", "require 64 lowercase hexadecimal characters")
	}
	if !req.DryRun && req.ApprovedPlan == "" {
		return ApplyResult{}, siteError("--approved-plan", "required for a real run")
	}
	if err := ctx.Err(); err != nil {
		return ApplyResult{}, err
	}
	p, err := observe(ctx, req.SitePath)
	if err != nil {
		return ApplyResult{}, err
	}
	r := ApplyResult{DryRun: req.DryRun, Plan: p, Would: p.Actions, Outcome: "planned"}
	if req.ApprovedPlan != "" && req.ApprovedPlan != p.PlanID {
		return r, ErrStalePlan
	}
	for _, c := range p.Checks {
		if c.Status != "pass" && c.Reason == "recovery_required" {
			return r, ErrRecovery
		}
		if c.Status != "pass" && c.Reason == "immutable_identity_changed" {
			return r, ErrImmutable
		}
	}
	if !p.Approvable {
		r.Outcome = "blocked"
		return r, ErrApplyBlocked
	}
	return r, ctx.Err()
}

// A running apply may resume only the exact protected desired inputs and the
// original approval; another approval returns errApplyOtherApproval for the
// executor's pre-publication proof. Phase names confer no replay permission:
// steps must inspect reality. Preparation/upgrade and malformed/split records
// remain fenced.
func (l *Lock) resumeApply(binding, approval string) (Operation, bool, error) {
	var o Operation
	b, e := readPrivateAt(l.fd, "active.json", l.owner)
	// Begin publishes its input binding before the journal. A fully durable
	// first fence can therefore finish publication even when the old completed
	// operation (often prepare) is still selected. No action preceded Begin.
	if stage, se := readPrivateAt(l.fd, "active.json.next", l.owner); se == nil {
		var next, prior Operation
		clear := errors.Is(e, os.ErrNotExist) || (e == nil && decodeOperation(b, &prior) == nil && prior.Status == "completed" && l.matchReceipt(prior) == nil)
		if clear && decodeOperation(stage, &next) == nil && next.Kind == "apply" && next.Status == "running" && next.Phase == "started" && next.Seq == 1 && next.PlanID == approval && l.matchReceipt(next) == nil && l.applyIntentMatches(next, binding) {
			if se = unix.Renameat(l.fd, "active.json.next", l.fd, "active.json"); se != nil {
				return o, false, se
			}
			if se = unix.Fsync(l.fd); se != nil {
				return o, false, se
			}
			b, e = stage, nil
		}
	}
	if errors.Is(e, os.ErrNotExist) {
		return o, false, nil
	}
	if e != nil || decodeOperation(b, &o) != nil {
		return o, false, ErrRecovery
	}
	if l.matchReceipt(o) != nil {
		// Receipt-first publication can leave a fully durable successor intent
		// and an older fence. No action follows a failed Advance. Accept only
		// the exact next intent of this same approved apply, after validating
		// its separately persisted desired-input binding.
		b, e := readPrivateAt(l.fd, o.ID+".json", l.owner)
		var next Operation
		if e != nil || decodeOperation(b, &next) != nil {
			return o, false, ErrRecovery
		}
		same := o.PlanID == approval && l.applyIntentMatches(o, binding) && next.PlanID == o.PlanID && next.Target == o.Target
		// rollApplyForward also publishes receipt-first, after its new intent.
		rolled := o.Status == "running" && earlyApplyPhase(o.Phase) && next.PlanID == approval && next.Phase == "started" && next.Status == "running" && l.applyIntentMatches(next, binding)
		if o.Kind != "apply" || !(same || rolled) || next.ID != o.ID || next.Kind != o.Kind || next.StartedAt != o.StartedAt || next.Seq != o.Seq+1 {
			return o, false, ErrRecovery
		}
		if e = l.publishRecoveredFence(next); e != nil {
			return o, false, e
		}
		o = next
	}
	if o.Status == "completed" {
		return o, false, nil
	}
	if o.Kind != "apply" || o.Status != "running" {
		return o, false, ErrRecovery
	}
	for _, name := range []string{"active.json.next", o.ID + ".json.next"} {
		var st unix.Stat_t
		if unix.Fstatat(l.fd, name, &st, unix.AT_SYMLINK_NOFOLLOW) != unix.ENOENT {
			return o, false, ErrRecovery
		}
	}
	if o.PlanID != approval {
		return o, false, errApplyOtherApproval
	}
	if !l.applyIntentMatches(o, binding) {
		return o, false, ErrRecovery
	}
	return o, true, nil
}

// errApplyOtherApproval is still a recovery refusal unless the executor proves
// a pre-publication continuation for this exact operation.
var errApplyOtherApproval = fmt.Errorf("%w: running apply has another approval", ErrRecovery)

// rollApplyForward moves an unpublished running apply to a new approval and
// input binding, keeping its ID and sequence. The new intent precedes the
// receipt: an interruption leaves either the old receipt (repeat the same
// continuation) or a receipt-first split that resumeApply accepts only with
// this approval and binding.
func (l *Lock) rollApplyForward(o Operation, plan string, target Release, binding string) (Operation, error) {
	b, e := readPrivateAt(l.fd, "active.json", l.owner)
	var current Operation
	if e != nil || decodeOperation(b, &current) != nil || current != o || o.Kind != "apply" || o.Status != "running" || !earlyApplyPhase(o.Phase) || l.matchReceipt(o) != nil {
		return Operation{}, ErrRecovery
	}
	intent, _ := json.Marshal(applyIntent{binding, o.ID, plan})
	if e = replacePrivateAt(l.fd, o.ID+"-apply.json", intent); e != nil {
		return Operation{}, e
	}
	next := o
	next.PlanID = plan
	next.Target = target
	return l.advanceAs(o, next, "started", "running", "", "")
}

func (l *Lock) applyIntentMatches(o Operation, binding string) bool {
	b, e := readPrivateAt(l.fd, o.ID+"-apply.json", l.owner)
	var intent applyIntent
	return e == nil && strictJSON(b) == nil && json.Unmarshal(b, &intent) == nil && intent.Binding == binding && intent.OperationID == o.ID && intent.PlanID == o.PlanID
}

func (l *Lock) publishRecoveredFence(o Operation) error {
	b, e := readPrivateAt(l.fd, "active.json.next", l.owner)
	if errors.Is(e, os.ErrNotExist) {
		b, _ := json.Marshal(o)
		return replacePrivateAt(l.fd, "active.json", b)
	}
	var staged Operation
	if e != nil || decodeOperation(b, &staged) != nil || staged != o {
		return ErrRecovery
	}
	if e = unix.Renameat(l.fd, "active.json.next", l.fd, "active.json"); e != nil {
		return e
	}
	return unix.Fsync(l.fd)
}

func applyCandidate(dir string, owner uint32, approval string) bool {
	if !digestRE.MatchString(approval) {
		return false
	}
	fd, e := openDir(dir, owner, true)
	if e != nil {
		return false
	}
	defer unix.Close(fd)
	for _, name := range []string{"active.json", "active.json.next"} {
		b, e := readPrivateAt(fd, name, owner)
		var o Operation
		if e != nil || decodeOperation(b, &o) != nil || o.Kind != "apply" {
			continue
		}
		if o.PlanID == approval {
			return true
		}
		// A rolled-forward receipt can precede its fence; the locked
		// resumeApply decides whether that split is recoverable.
		b, e = readPrivateAt(fd, o.ID+".json", owner)
		var receipt Operation
		if e == nil && decodeOperation(b, &receipt) == nil && receipt.ID == o.ID && receipt.Kind == "apply" && receipt.PlanID == approval {
			return true
		}
	}
	return false
}
