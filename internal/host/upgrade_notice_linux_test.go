//go:build linux

package host

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/upgradenotice"
)

// noticeDriver adds the advisory record to the unit driver. The wait
// stands in for the countdown and records what the record said meanwhile.
func noticeDriver(t *testing.T) (upgradeDriver, UpgradeRequest, *[]string, *bool, string) {
	d, req, events, owner := upgradeTestDriver(t)
	dir := filepath.Join(filepath.Dir(d.journal), "opt")
	if e := os.Mkdir(dir, 0755); e != nil {
		t.Fatal(e)
	}
	d.notice = filepath.Join(dir, "upgrade-notice.json")
	d.wait = func(_ context.Context, lead time.Duration) error {
		b, e := os.ReadFile(d.notice)
		if e != nil {
			t.Fatal("no record during the countdown", e)
		}
		r, e := upgradenotice.Parse(b)
		if e != nil || r.State != upgradenotice.Announced || r.Deadline.Sub(r.AnnouncedAt) != lead || r.TargetVersion != "2.0.0" {
			t.Fatalf("record %+v %v", r, e)
		}
		*events = append(*events, "countdown:"+lead.String())
		return nil
	}
	d.reach = func() []upgradeUser { return []upgradeUser{} }
	return d, req, events, owner, d.notice
}

func readNotice(t *testing.T, path string) (upgradenotice.Record, bool) {
	t.Helper()
	b, e := os.ReadFile(path)
	if errors.Is(e, os.ErrNotExist) {
		return upgradenotice.Record{}, false
	}
	if e != nil {
		t.Fatal(e)
	}
	r, e := upgradenotice.Parse(b)
	if e != nil {
		t.Fatal(e)
	}
	return r, true
}

func TestUpgradeCountdownComesAfterStagingAndBeforeTheStop(t *testing.T) {
	d, req, events, _, path := noticeDriver(t)
	req.LeadTime = 5 * time.Minute
	var told []UpgradeAnnouncement
	req.Announced = func(a UpgradeAnnouncement) error { told = append(told, a); return nil }
	r, e := executeUpgrade(context.Background(), req, d)
	if e != nil || r.Outcome != "upgraded" {
		t.Fatalf("%+v %v", r, e)
	}
	if got := strings.Join(*events, ","); got != "stage,countdown:5m0s,quiescing,activating,verifying,verified" {
		t.Fatal(got)
	}
	a := r.Announcement
	if a == nil || a.State != "announced" || a.Mode != "countdown" || a.LeadSeconds != 300 || len(a.ScheduleID) != 32 || a.Reach == nil || len(told) != 1 || told[0].ScheduleID != a.ScheduleID {
		t.Fatalf("%+v %+v", a, told)
	}
	if _, ok := readNotice(t, path); ok {
		t.Fatal("the record outlived the stop")
	}
}

func TestUpgradeCountdownCancelledWithdrawsAndLeavesThePredecessor(t *testing.T) {
	d, req, events, _, path := noticeDriver(t)
	ctx, cancel := context.WithCancel(context.Background())
	inner := d.wait
	d.wait = func(c context.Context, lead time.Duration) error {
		_ = inner(c, lead)
		cancel()
		<-c.Done()
		return c.Err()
	}
	r, e := executeUpgrade(ctx, req, d)
	if !errors.Is(e, context.Canceled) || r.Announcement.State != "withdrawn" || r.Operation != nil {
		t.Fatalf("%+v %v", r, e)
	}
	if got := strings.Join(*events, ","); got != "stage,countdown:2m0s" {
		t.Fatal("cancellation reached the stop:", got)
	}
	rec, ok := readNotice(t, path)
	if !ok || rec.State != upgradenotice.Withdrawn || rec.ScheduleID != r.Announcement.ScheduleID {
		t.Fatalf("%+v %v", rec, ok)
	}
	if r.EntryClosure != "" {
		t.Fatal("a cancelled countdown closed entry")
	}
	if _, e := os.Stat(filepath.Join(d.journal, "active.json")); !errors.Is(e, os.ErrNotExist) {
		t.Fatal("a cancelled countdown left an operation in the journal")
	}
	// A new attempt requalifies and announces a fresh schedule with a full
	// lead before any stop.
	d.wait = inner
	*events = nil
	r2, e := executeUpgrade(context.Background(), req, d)
	if e != nil || r2.Outcome != "upgraded" || r2.Announcement.ScheduleID == r.Announcement.ScheduleID || r2.Announcement.LeadSeconds != 120 {
		t.Fatalf("%+v %v", r2.Announcement, e)
	}
	if got := strings.Join(*events, ","); got != "stage,countdown:2m0s,quiescing,activating,verifying,verified" {
		t.Fatal("the retry skipped its announcement:", got)
	}
}

func TestUpgradeFailureBeforeTheStopAnnouncesAgainOnRetry(t *testing.T) {
	d, req, events, _, path := noticeDriver(t)
	failed := false
	d.prepare = func(context.Context, *Lock, Operation) error {
		if !failed {
			failed = true
			return errors.New("prepare failed")
		}
		return nil
	}
	if _, e := executeUpgrade(context.Background(), req, d); e == nil {
		t.Fatal("prepare failure succeeded")
	}
	if rec, ok := readNotice(t, path); !ok || rec.State != upgradenotice.Withdrawn {
		t.Fatal("a failure before the stop left its schedule announced")
	}
	*events = nil
	r, e := executeUpgrade(context.Background(), req, d)
	if e != nil || r.Outcome != "upgraded" || strings.Join(*events, ",") != "countdown:2m0s,quiescing,activating,verifying,verified" {
		t.Fatalf("%+v %v %v", r, e, *events)
	}
}

// Reach comes from the stop's own census; nothing after the deadline
// requalifies the release or asks the daemons again.
func TestUpgradeReachComesFromTheStopWithoutWaitingForAgents(t *testing.T) {
	d, req, events, _, path := noticeDriver(t)
	calls := 0
	plan := d.plan
	d.plan = func(c context.Context, s string) (UpgradePlan, error) { calls++; return plan(c, s) }
	key := ""
	d.steps[0].run = func(_ context.Context, _ *Lock, o Operation) error {
		*events = append(*events, o.Phase)
		rec, _ := readNotice(t, path)
		key = rec.Key()
		return nil
	}
	d.reach = func() []upgradeUser {
		return []upgradeUser{{Name: "a", Daemon: true, ActiveTurns: 2, Notice: &upgradeWorkNotice{Key: key, Told: 2, Held: 1, NotDelivered: 1}}, {Name: "b", Daemon: true}, {Name: "c"}}
	}
	r, e := executeUpgrade(context.Background(), req, d)
	if e != nil || r.Outcome != "upgraded" {
		t.Fatalf("%+v %v %v", r, e, *events)
	}
	if calls != 3 {
		t.Fatalf("plan read %d times; the deadline must not requalify", calls)
	}
	if got := *r.Announcement.Reach; got != (UpgradeNoticeReach{Told: 2, Held: 1, NotDelivered: 1, DaemonsUnreported: 1}) || key == "" {
		t.Fatalf("%+v", got)
	}
}

func TestUpgradeChangedInputsAtTheDeadlineWithdraw(t *testing.T) {
	d, req, events, _, path := noticeDriver(t)
	binding := d.binding
	d.binding = func(c context.Context, s string) (string, error) {
		if strings.Contains(strings.Join(*events, ","), "countdown") {
			return strings.Repeat("9", 64), nil
		}
		return binding(c, s)
	}
	r, e := executeUpgrade(context.Background(), req, d)
	if !errors.Is(e, ErrStalePlan) || r.Announcement.State != "withdrawn" || r.Operation != nil || strings.Contains(strings.Join(*events, ","), "quiescing") {
		t.Fatalf("%+v %v %v", r, e, *events)
	}
	if rec, ok := readNotice(t, path); !ok || rec.State != upgradenotice.Withdrawn {
		t.Fatal("a stale upgrade left its schedule announced")
	}
}

// A daemon that started during the lead without interruption approval stops
// the upgrade before entry closes, with the predecessor serving.
func TestUpgradeDaemonStartedDuringTheLeadWithdrawsBeforeClosing(t *testing.T) {
	d, req, events, _, path := noticeDriver(t)
	d.daemonsActive = func(context.Context) (bool, error) {
		return strings.Contains(strings.Join(*events, ","), "countdown"), nil
	}
	r, e := executeUpgrade(context.Background(), req, d)
	if !errors.Is(e, ErrWorkBusy) || r.Announcement.State != "withdrawn" || r.Operation != nil || r.EntryClosure != "" || strings.Contains(strings.Join(*events, ","), "quiescing") {
		t.Fatalf("%+v %v %v", r, e, *events)
	}
	if rec, ok := readNotice(t, path); !ok || rec.State != upgradenotice.Withdrawn {
		t.Fatal("left its schedule announced")
	}
	req.ApproveInterruption = true
	*events = nil
	if r, e = executeUpgrade(context.Background(), req, d); e != nil || r.Outcome != "upgraded" {
		t.Fatalf("approved %+v %v", r, e)
	}
}

func TestUpgradeFailureAfterTheStopRemovesTheSchedule(t *testing.T) {
	d, req, _, _, path := noticeDriver(t)
	req.Progress = func(p string) error {
		if p == "activating" {
			return errors.New("crash boundary")
		}
		return nil
	}
	r, e := executeUpgrade(context.Background(), req, d)
	if e == nil || r.EntryClosure != "verified_closed" || r.Announcement.State != "announced" {
		t.Fatalf("%+v %v", r, e)
	}
	if _, ok := readNotice(t, path); ok {
		t.Fatal("a schedule outlived a stop that began")
	}
}

func TestUpgradeImmediateStagedAndPreviewAnnounceNothing(t *testing.T) {
	d, req, events, owner, path := noticeDriver(t)
	req.Immediate = true
	r, e := executeUpgrade(context.Background(), req, d)
	if e != nil || r.Announcement.Mode != "immediate" || r.Announcement.State != "not_announced" || strings.Contains(strings.Join(*events, ","), "countdown") {
		t.Fatalf("%+v %v %v", r.Announcement, e, *events)
	}
	d2, req2, events2, owner2, path2 := noticeDriver(t)
	*owner2 = false
	r, e = executeUpgrade(context.Background(), req2, d2)
	if e != nil || r.Outcome != "staged" || r.Announcement.State != "not_announced" || strings.Join(*events2, ",") != "stage" {
		t.Fatalf("%+v %v %v", r, e, *events2)
	}
	req2.DryRun, req2.ApprovedPlan = true, ""
	r, e = executeUpgrade(context.Background(), req2, d2)
	if e != nil || r.Announcement.State != "previewed" || r.Announcement.LeadSeconds != 120 {
		t.Fatalf("%+v %v", r.Announcement, e)
	}
	for _, p := range []string{path, path2} {
		if _, ok := readNotice(t, p); ok {
			t.Fatal("published without a countdown")
		}
	}
	_, _ = owner, d
}
