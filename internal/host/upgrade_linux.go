//go:build linux

package host

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"golang.org/x/sys/unix"
	"os"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/provision"
)

var ErrUpgradeBlocked = errors.New("host_upgrade_blocked: successor qualification is incomplete")
var ErrMaintenanceApproval = errors.New("maintenance_approval_required: explicitly approve the maintenance window")
var ErrWorkBusy = errors.New("upgrade_work_busy: active or unobservable native work requires explicit interruption approval")

type UpgradeRequest struct {
	SitePath            string
	ApprovedPlan        string
	DryRun              bool
	ApproveMaintenance  bool
	ApproveInterruption bool
	Progress            func(string) error
}
type UpgradePlan struct {
	Protocol    string   `json:"protocol"`
	PlanID      string   `json:"plan_id"`
	Predecessor Release  `json:"predecessor"`
	Target      Release  `json:"target"`
	OwnerBinary string   `json:"owner_binary"`
	Checks      []Check  `json:"checks"`
	Approvable  bool     `json:"approvable"`
	Actions     []Action `json:"actions"`
	binding     string
}
type UpgradeResult struct {
	DryRun       bool        `json:"dry_run"`
	Plan         UpgradePlan `json:"plan"`
	Outcome      string      `json:"outcome"`
	Would        []Action    `json:"would"`
	Operation    *Operation  `json:"operation,omitempty"`
	EntryClosure string      `json:"entry_closure,omitempty"`
}

func BuildUpgradePlan(ctx context.Context, sitePath string) (UpgradePlan, error) {
	if os.Geteuid() != 0 {
		return UpgradePlan{}, ErrTrust
	}
	s, e := LoadSite(sitePath)
	if e != nil {
		return UpgradePlan{}, e
	}
	r, e := loadRelease(s)
	if e != nil {
		return UpgradePlan{}, e
	}
	if e = verifyUpgradeProduct(ctx, r); e != nil {
		return UpgradePlan{}, e
	}
	old, predecessor, e := installedRelease(ctx)
	if e != nil {
		return UpgradePlan{}, e
	}
	u := r.manifest.Upgrade
	if u == nil || old.Release != u.Predecessor || !upgradeDeclarationSame(old, s) {
		return UpgradePlan{}, ErrUpgradeTarget
	}
	im, exists, e := installedImmutable()
	if e != nil || !exists || im != s.Immutable() {
		return UpgradePlan{}, ErrImmutable
	}
	p := UpgradePlan{Protocol: "host.upgrade.v1", Predecessor: old.Release, Target: s.Release, OwnerBinary: generationPath(s) + "/open-habitat", Checks: []Check{}, Approvable: true, Actions: []Action{{"upgrade.stage", "planned", "authenticated_successor"}, {"upgrade.quiesce", "planned", "explicit_maintenance_required"}, {"upgrade.activate", "planned", "restart_native_consumers"}, {"upgrade.verify", "planned", "structural_acceptance_required"}}}
	inspection, e := Inspect(ctx, sitePath)
	if e != nil {
		return p, e
	}
	for _, c := range inspection.Checks {
		// Apply compares the desired release to today's installed selector/packages;
		// upgrade instead authenticates its predecessor and stages its successor.
		switch c.Code {
		case "installation.generation", "release.runtime":
			continue
		}
		p.Checks = append(p.Checks, c)
		if c.Status != "pass" {
			p.Approvable = false
		}
	}
	if e = verifyServingPredecessor(ctx, old, predecessor); e != nil {
		p.Checks = append(p.Checks, Check{"upgrade.predecessor", "fail", "predecessor_not_healthy"})
		p.Approvable = false
	}
	binding, e := inputBinding(ctx, sitePath)
	if e != nil {
		return p, e
	}
	state, e := provision.InspectInstallation(ctx)
	if e != nil {
		return p, e
	}
	machine, e := hostIdentity(productionSources())
	if e != nil {
		return p, e
	}
	b, _ := json.Marshal(struct {
		Protocol, Binding, Machine, Broker string
		Predecessor                        Release
	}{p.Protocol, binding, machine, state.Token, old.Release})
	sum := sha256.Sum256(b)
	p.PlanID = hex.EncodeToString(sum[:])
	p.binding = binding
	return p, nil
}

// Upgrade deliberately stages first and returns an explicit immutable owner.
// Only that verified successor may acquire/publish an upgrade journal and enter
// maintenance. There is no implicit exec through the mutable current selector.
func Upgrade(ctx context.Context, req UpgradeRequest) (UpgradeResult, error) {
	if os.Geteuid() != 0 {
		return UpgradeResult{}, ErrTrust
	}
	if !absolute(req.SitePath) || req.ApprovedPlan != "" && !digestRE.MatchString(req.ApprovedPlan) || !req.DryRun && req.ApprovedPlan == "" {
		return UpgradeResult{}, ErrSite
	}
	if !req.DryRun && !req.ApproveMaintenance {
		return UpgradeResult{}, ErrMaintenanceApproval
	}
	return upgradeNative(ctx, req)
}

// The driver is fixed by product code. Each action has a native postcondition;
// phase records grant no permission to replay uncertain side effects.
type upgradeDriver struct {
	journal        string
	owner          uint32
	now            func() time.Time
	plan           func(context.Context, string) (UpgradePlan, error)
	binding        func(context.Context, string) (string, error)
	stage          func(context.Context) error
	isOwner        func() bool
	prepare        func(context.Context, *Lock, Operation) error
	steps          []upgradeStep
	fence          func(context.Context) error
	verifyComplete func(context.Context, *Lock, Operation) (bool, error)
}
type upgradeStep struct {
	phase string
	run   func(context.Context, *Lock, Operation) error
}

func executeUpgrade(ctx context.Context, req UpgradeRequest, d upgradeDriver) (r UpgradeResult, resultErr error) {
	r.DryRun = req.DryRun
	p, e := d.plan(ctx, req.SitePath)
	r.Plan = p
	r.Would = p.Actions
	r.Outcome = "planned"
	// Resume is resolved from durable intent under exclusion, never a new plan
	// over partially switched selectors. Before staging there is no transaction.
	candidate := upgradeCandidate(d.journal, d.owner, req.ApprovedPlan)
	if req.DryRun {
		if e != nil {
			return r, e
		}
		if req.ApprovedPlan != "" && p.PlanID != req.ApprovedPlan {
			return r, ErrStalePlan
		}
		if !p.Approvable {
			return r, ErrUpgradeBlocked
		}
		return r, nil
	}
	if !candidate {
		if e != nil {
			return r, e
		}
		if req.ApprovedPlan != p.PlanID {
			return r, ErrStalePlan
		}
		if !p.Approvable {
			return r, ErrUpgradeBlocked
		}
	}
	l, e := openOperationLock(ctx, d.journal, d.owner, d.now)
	if e != nil {
		return r, e
	}
	defer l.Close()
	binding, e := d.binding(ctx, req.SitePath)
	if e != nil {
		return r, e
	}
	o, resume, e := l.resumeUpgrade(binding, req.ApprovedPlan)
	if e != nil {
		return r, e
	}
	closed := resume
	defer func() {
		if resultErr != nil && closed {
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
	if resume || o.Kind == "upgrade" && o.PlanID == req.ApprovedPlan && l.upgradeIntentMatches(o, binding) {
		r.Plan = UpgradePlan{Protocol: "host.upgrade.v1", PlanID: o.PlanID, Target: o.Target, OwnerBinary: generationParent + "/" + o.OwnerGeneration + "/open-habitat", Actions: []Action{}}
		r.Operation = &o
		if !d.isOwner() {
			return r, ErrUpgradeOwner
		}
		if o.Status == "completed" {
			ok, e := d.verifyComplete(ctx, l, o)
			if e != nil {
				return r, e
			}
			if !ok {
				return r, ErrRecovery
			}
			r.Outcome = "no_change"
			r.Would = []Action{}
			return r, nil
		}
	}
	if !resume {
		p, e = d.plan(ctx, req.SitePath)
		r.Plan = p
		if e != nil {
			return r, e
		}
		if p.PlanID != req.ApprovedPlan {
			return r, ErrStalePlan
		}
		if !p.Approvable {
			return r, ErrUpgradeBlocked
		}
		if e = d.stage(ctx); e != nil {
			return r, e
		}
		if !d.isOwner() {
			r.Outcome = "staged"
			r.Would = []Action{}
			return r, nil
		}
		// Recheck the same approval after copying. Staging has not closed entry,
		// installed packages or changed a selector, so failure leaves N serving.
		p, e = d.plan(ctx, req.SitePath)
		if e != nil {
			return r, e
		}
		if p.PlanID != req.ApprovedPlan {
			return r, ErrStalePlan
		}
		if !p.Approvable {
			return r, ErrUpgradeBlocked
		}
		o, e = l.begin("upgrade", p.PlanID, p.Target, func(o Operation) error {
			b, _ := json.Marshal(applyIntent{binding, o.ID})
			return replacePrivateAt(l.fd, o.ID+"-upgrade.json", b)
		})
		if e != nil {
			return r, e
		}
	}
	r.Operation = &o
	r.Outcome = "incomplete"
	if e = d.prepare(ctx, l, o); e != nil {
		return r, e
	}
	for _, step := range d.steps {
		if e = ctx.Err(); e != nil {
			return r, e
		}
		current, e := d.binding(ctx, req.SitePath)
		if e != nil {
			return r, e
		}
		if current != binding {
			return r, ErrStalePlan
		}
		// From quiescing intent onwards, every failure must leave closed entry.
		closed = true
		o, e = l.Advance(o, step.phase, "running", "")
		if e != nil {
			return r, e
		}
		r.Operation = &o
		if req.Progress != nil {
			if e = req.Progress(step.phase); e != nil {
				return r, e
			}
		}
		if e = step.run(ctx, l, o); e != nil {
			return r, e
		}
	}
	if ok, e := d.verifyComplete(ctx, l, o); e != nil {
		return r, e
	} else if !ok {
		return r, ErrRecovery
	}
	current, e := d.binding(ctx, req.SitePath)
	if e != nil {
		return r, e
	}
	if current != binding {
		return r, ErrStalePlan
	}
	o, e = l.Advance(o, "completed", "completed", "")
	if e != nil {
		return r, e
	}
	r.Operation = &o
	r.Outcome = "upgraded"
	r.Would = []Action{}
	return r, nil
}

var ErrUpgradeOwner = errors.New("upgrade_owner_required: invoke the explicit immutable successor owner_binary; never use current for recovery")

func upgradeCandidate(dir string, owner uint32, approval string) bool {
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
		if e == nil && decodeOperation(b, &o) == nil && o.Kind == "upgrade" && o.PlanID == approval {
			return true
		}
	}
	return false
}
func (l *Lock) upgradeIntentMatches(o Operation, binding string) bool {
	b, e := readPrivateAt(l.fd, o.ID+"-upgrade.json", l.owner)
	var i applyIntent
	return e == nil && strictJSON(b) == nil && json.Unmarshal(b, &i) == nil && i.OperationID == o.ID && i.Binding == binding
}
func (l *Lock) resumeUpgrade(binding, approval string) (Operation, bool, error) {
	var o Operation
	b, e := readPrivateAt(l.fd, "active.json", l.owner)
	if errors.Is(e, os.ErrNotExist) {
		return o, false, nil
	}
	if e != nil || decodeOperation(b, &o) != nil {
		return o, false, ErrRecovery
	}
	// Split publication is inspectable but never guessed forward by upgrade.
	if l.matchReceipt(o) != nil {
		return o, false, ErrRecovery
	}
	for _, name := range []string{"active.json.next", o.ID + ".json.next"} {
		if unix.Fstatat(l.fd, name, &unix.Stat_t{}, unix.AT_SYMLINK_NOFOLLOW) != unix.ENOENT {
			return o, false, ErrRecovery
		}
	}
	if o.Status == "completed" {
		return o, false, nil
	}
	if o.Kind != "upgrade" || o.Status != "running" || o.PlanID != approval || !l.upgradeIntentMatches(o, binding) {
		return o, false, ErrRecovery
	}
	return o, true, nil
}
