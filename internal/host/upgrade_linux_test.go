//go:build linux

package host

import (
	"context"
	"encoding/json"
	"errors"
	"golang.org/x/sys/unix"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func upgradeTestDriver(t *testing.T) (upgradeDriver, UpgradeRequest, *[]string, *bool) {
	t.Helper()
	dir, fixtureOwner := operationFixture(t)
	events := []string{}
	owner := true
	binding := strings.Repeat("b", 64)
	approval := strings.Repeat("a", 64)
	p := UpgradePlan{Protocol: "host.upgrade.v1", PlanID: approval, Predecessor: Release{"1.0.0", strings.Repeat("c", 64)}, Target: Release{"2.0.0", strings.Repeat("d", 64)}, OwnerBinary: "/immutable/open-habitat", Approvable: true, Actions: []Action{}}
	d := upgradeDriver{journal: dir, owner: fixtureOwner, now: func() time.Time { return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC) }, plan: func(context.Context, string) (UpgradePlan, error) { return p, nil }, binding: func(context.Context, string) (string, error) { return binding, nil }, stage: func(context.Context) error { events = append(events, "stage"); return nil }, isOwner: func() bool { return owner }, prepare: func(context.Context, *Lock, Operation) error { return nil }, fence: func(context.Context) error { events = append(events, "fence"); return nil }, verifyComplete: func(context.Context, *Lock, Operation) (bool, error) { return true, nil }}
	for _, phase := range []string{"quiescing", "activating", "verifying", "verified"} {
		d.steps = append(d.steps, upgradeStep{phase, func(_ context.Context, _ *Lock, o Operation) error { events = append(events, o.Phase); return nil }})
	}
	return d, UpgradeRequest{SitePath: "/site.json", ApprovedPlan: approval, ApproveMaintenance: true}, &events, &owner
}
func TestUpgradeStageBeforeMaintenanceAndImmutableOwner(t *testing.T) {
	d, req, events, owner := upgradeTestDriver(t)
	*owner = false
	r, e := executeUpgrade(context.Background(), req, d)
	if e != nil || r.Outcome != "staged" || strings.Join(*events, ",") != "stage" {
		t.Fatalf("%+v %v %v", r, e, *events)
	}
	if _, e = os.Stat(filepath.Join(d.journal, "active.json")); !errors.Is(e, os.ErrNotExist) {
		t.Fatal("staging published maintenance intent", e)
	}
	*owner = true
	*events = nil
	r, e = executeUpgrade(context.Background(), req, d)
	if e != nil || r.Outcome != "upgraded" || r.Operation.SchemaVersion != 2 || r.Operation.OwnerGeneration != r.Operation.Target.ManifestSHA256 {
		t.Fatalf("%+v %v", r, e)
	}
	*events = nil
	r, e = executeUpgrade(context.Background(), req, d)
	if e != nil || r.Outcome != "no_change" || len(*events) != 0 {
		t.Fatalf("repeat %+v %v %v", r, e, *events)
	}
}
func TestUpgradePreactivationFailureLeavesPredecessor(t *testing.T) {
	d, req, events, _ := upgradeTestDriver(t)
	boom := errors.New("stage failed")
	d.stage = func(context.Context) error { return boom }
	_, e := executeUpgrade(context.Background(), req, d)
	if !errors.Is(e, boom) || len(*events) != 0 {
		t.Fatalf("%v %v", e, *events)
	}
	if _, e = os.Stat(filepath.Join(d.journal, "active.json")); !errors.Is(e, os.ErrNotExist) {
		t.Fatal("staging created active intent")
	}
}
func TestUpgradeFailureBoundariesResumeOnlyMatchingApproval(t *testing.T) {
	for _, phase := range []string{"quiescing", "activating", "verifying", "verified"} {
		t.Run(phase, func(t *testing.T) {
			d, req, events, _ := upgradeTestDriver(t)
			boom := errors.New("crash boundary")
			req.Progress = func(p string) error {
				if p == phase {
					return boom
				}
				return nil
			}
			r, e := executeUpgrade(context.Background(), req, d)
			if !errors.Is(e, boom) || r.EntryClosure != "verified_closed" || (*events)[len(*events)-1] != "fence" {
				t.Fatalf("%+v %v %v", r, e, *events)
			}
			if r.Operation.Phase != phase {
				t.Fatal(r.Operation)
			}
			req.Progress = nil
			req.ApprovedPlan = strings.Repeat("f", 64)
			if _, e = executeUpgrade(context.Background(), req, d); !errors.Is(e, ErrStalePlan) {
				t.Fatal("foreign approval resumed", e)
			}
			req.ApprovedPlan = strings.Repeat("a", 64)
			d.plan = func(context.Context, string) (UpgradePlan, error) { return UpgradePlan{}, ErrRecovery }
			r, e = executeUpgrade(context.Background(), req, d)
			if e != nil || r.Outcome != "upgraded" {
				t.Fatalf("matching continuation %+v %v", r, e)
			}
		})
	}
}
func TestUpgradeSplitPublicationRefusesWithoutRewritingEvidence(t *testing.T) {
	d, req, _, _ := upgradeTestDriver(t)
	req.Progress = func(string) error { return errors.New("stop") }
	r, _ := executeUpgrade(context.Background(), req, d)
	l, e := openOperationLock(context.Background(), d.journal, d.owner, d.now)
	if e != nil {
		t.Fatal(e)
	}
	b, e := readPrivateAt(l.fd, "active.json", d.owner)
	if e != nil {
		t.Fatal(e)
	}
	if e = replacePrivateAt(l.fd, "active.json.next", b); e != nil {
		t.Fatal(e)
	}
	l.Close()
	req.Progress = nil
	if _, e = executeUpgrade(context.Background(), req, d); !errors.Is(e, ErrRecovery) {
		t.Fatal(e)
	}
	after, e := os.ReadFile(d.journal + "/active.json")
	if e != nil || string(b) != string(after) {
		t.Fatal("rewrote split evidence")
	}
	if r.Operation == nil {
		t.Fatal("missing operation")
	}
}
func TestUpgradeDryRunDoesNotCreateLockOrStage(t *testing.T) {
	d, req, events, _ := upgradeTestDriver(t)
	req.DryRun = true
	r, e := executeUpgrade(context.Background(), req, d)
	if e != nil || !r.DryRun || len(*events) != 0 {
		t.Fatal(r, e, *events)
	}
	if _, e = os.Lstat(d.journal); !errors.Is(e, os.ErrNotExist) {
		t.Fatal("dry run wrote", e)
	}
	req.ApprovedPlan = strings.Repeat("f", 64)
	if _, e = executeUpgrade(context.Background(), req, d); !errors.Is(e, ErrStalePlan) {
		t.Fatal(e)
	}
}
func TestUpgradeLinkRejectsForeignTarget(t *testing.T) {
	dir := t.TempDir()
	path := dir + "/current"
	os.Symlink("foreign", path)
	if e := replaceUpgradeLink(path, "predecessor", "successor"); !errors.Is(e, ErrRecovery) {
		t.Fatal(e)
	}
	have, _ := os.Readlink(path)
	if have != "foreign" {
		t.Fatal("adopted foreign link")
	}
	os.Remove(path)
	os.Symlink("predecessor", path)
	if e := replaceUpgradeLink(path, "predecessor", "successor"); e != nil {
		t.Fatal(e)
	}
	if e := replaceUpgradeLink(path, "predecessor", "successor"); e != nil {
		t.Fatal(e)
	}
}

func TestUpgradeUserActivationUnitSelectors(t *testing.T) {
	for _, unit := range []string{"sync.service", "sync.socket", "sync.timer", "sync.path", "work@one.service"} {
		if !safeUserUnit(unit) {
			t.Fatal(unit)
		}
	}
	for _, unit := range []string{"--all", "../root.service", "unit.service\nroot.service", "unqualified.target"} {
		if safeUserUnit(unit) {
			t.Fatal(unit)
		}
	}
}

func TestUpgradeNewerJournalRoutesWithoutInterpretation(t *testing.T) {
	d, req, _, _ := upgradeTestDriver(t)
	r, e := executeUpgrade(context.Background(), req, d)
	if e != nil {
		t.Fatal(e)
	}
	path := d.journal + "/" + r.Operation.ID + ".json"
	b, e := os.ReadFile(path)
	if e != nil {
		t.Fatal(e)
	}
	b = []byte(strings.Replace(string(b), `"schema_version":2`, `"schema_version":99`, 1))
	if e = os.WriteFile(path, b, 0600); e != nil {
		t.Fatal(e)
	}
	_, e = showOperation(d.journal, r.Operation.ID, d.owner)
	var hint *UpgradeOwnerRequired
	if !errors.As(e, &hint) || hint.JournalSchema != 99 || hint.OwnerBinary != generationParent+"/"+r.Operation.OwnerGeneration+"/open-habitat" {
		t.Fatal(e)
	}
	after, _ := os.ReadFile(path)
	if string(after) != string(b) {
		t.Fatal("older inspector rewrote journal")
	}
	var o Operation
	if decodeOperation(b, &o) == nil {
		t.Fatal("unknown schema granted mutation permission")
	}
}

func TestUpgradeSessionObservationUsesGatewayCapacity(t *testing.T) {
	dir, owner := operationFixture(t)
	l, e := openOperationLock(context.Background(), dir, owner, time.Now)
	if e != nil {
		t.Fatal(e)
	}
	defer l.Close()
	data := []byte(strings.Repeat("x", MaxSiteBytes+1))
	if e = os.WriteFile(dir+"/sessions.json", data, 0600); e != nil {
		t.Fatal(e)
	}
	if _, e = readPrivateAt(l.fd, "sessions.json", owner); !errors.Is(e, ErrTrust) {
		t.Fatal("site bound unexpectedly expanded", e)
	}
	if got, e := readPrivateAtLimit(l.fd, "sessions.json", owner, 4<<20); e != nil || len(got) != len(data) {
		t.Fatal("valid gateway session capacity refused", e)
	}
}

func TestUpgradeConsentRefusesBeforeMaintenance(t *testing.T) {
	d, req, events, _ := upgradeTestDriver(t)
	plan, _ := d.plan(context.Background(), req.SitePath)
	plan.InterruptionRequired = true
	d.plan = func(context.Context, string) (UpgradePlan, error) { return plan, nil }
	if _, e := executeUpgrade(context.Background(), req, d); !errors.Is(e, ErrWorkBusy) || len(*events) != 0 {
		t.Fatal("refusal caused maintenance", e, *events)
	}
	if _, e := os.Stat(d.journal); !errors.Is(e, os.ErrNotExist) {
		t.Fatal("refusal created intent", e)
	}
	req.DryRun = true
	if _, e := executeUpgrade(context.Background(), req, d); e != nil {
		t.Fatal("preview needs interruption approval", e)
	}
}

func TestUpgradeAcceptedResumeDoesNotQuiesceAgain(t *testing.T) {
	d, req, events, _ := upgradeTestDriver(t)
	req.Progress = func(phase string) error {
		if phase == "verified" {
			return errors.New("crash after acceptance")
		}
		return nil
	}
	if _, e := executeUpgrade(context.Background(), req, d); e == nil {
		t.Fatal("missing interruption")
	}
	req.Progress = nil
	*events = nil
	d.finishAccepted = func(context.Context, *Lock, Operation) (bool, error) {
		*events = append(*events, "finish_acceptance")
		return true, nil
	}
	d.plan = func(context.Context, string) (UpgradePlan, error) { return UpgradePlan{}, ErrRecovery }
	r, e := executeUpgrade(context.Background(), req, d)
	if e != nil || r.Outcome != "upgraded" || strings.Join(*events, ",") != "finish_acceptance" {
		t.Fatal(r, e, *events)
	}
}

func TestUpgradeAcceptanceIsOwnerBoundAndSplitSafe(t *testing.T) {
	if os.Geteuid() != 0 {
		t.Skip("private root acceptance records; root container runs this")
	}
	d, req, _, _ := upgradeTestDriver(t)
	r, e := executeUpgrade(context.Background(), req, d)
	if e != nil {
		t.Fatal(e)
	}
	l, e := openOperationLock(context.Background(), d.journal, 0, time.Now)
	if e != nil {
		t.Fatal(e)
	}
	defer l.Close()
	n := &nativeUpgrade{}
	if ok, e := n.accepted(l, *r.Operation); e != nil || ok {
		t.Fatal(ok, e)
	}
	name := r.Operation.ID + "-upgrade-accepted.json"
	b, _ := json.Marshal(upgradeAcceptance{1, r.Operation.ID, r.Operation.OwnerGeneration})
	if e = replacePrivateAt(l.fd, name+".next", b); e != nil {
		t.Fatal(e)
	}
	if _, e = n.accepted(l, *r.Operation); !errors.Is(e, ErrRecovery) {
		t.Fatal("split acceptance was replay permission", e)
	}
	if e = unix.Renameat(l.fd, name+".next", l.fd, name); e != nil {
		t.Fatal(e)
	}
	if ok, e := n.accepted(l, *r.Operation); e != nil || !ok {
		t.Fatal(ok, e)
	}
	foreign := *r.Operation
	foreign.OwnerGeneration = strings.Repeat("e", 64)
	if _, e = n.accepted(l, foreign); !errors.Is(e, ErrRecovery) {
		t.Fatal("foreign owner accepted", e)
	}
}

func TestUpgradeCancellationRetainsTypedSignalCause(t *testing.T) {
	d, req, _, _ := upgradeTestDriver(t)
	ctx, cancel := context.WithCancel(context.Background())
	d.steps = []upgradeStep{{"quiescing", func(context.Context, *Lock, Operation) error { cancel(); return ErrNativeApply }}}
	r, e := executeUpgrade(ctx, req, d)
	if !errors.Is(e, context.Canceled) || !errors.Is(e, ErrNativeApply) || r.EntryClosure != "verified_closed" {
		t.Fatal("cancelled native action lost signal classification", r, e)
	}
}
