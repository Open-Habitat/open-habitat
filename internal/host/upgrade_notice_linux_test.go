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
	if _, e := os.Stat(filepath.Join(d.journal, "active.json")); !errors.Is(e, os.ErrNotExist) {
		t.Fatal("a cancelled countdown began maintenance")
	}
	// A new attempt announces a fresh schedule with a full lead.
	d.wait = inner
	r2, e := executeUpgrade(context.Background(), req, d)
	if e != nil || r2.Announcement.ScheduleID == r.Announcement.ScheduleID || r2.Announcement.LeadSeconds != 120 {
		t.Fatalf("%+v %v", r2.Announcement, e)
	}
}

func TestUpgradeRequalifiesAtTheDeadlineWithoutWaitingForAgents(t *testing.T) {
	d, req, events, _, path := noticeDriver(t)
	calls := 0
	plan := d.plan
	key := ""
	d.plan = func(c context.Context, s string) (UpgradePlan, error) {
		p, e := plan(c, s)
		calls++
		if calls == 4 {
			// At the deadline: one daemon is busy and reports its delivery,
			// another runs a predecessor without the receiver.
			rec, _ := readNotice(t, path)
			key = rec.Key()
			p.Work = []upgradeUser{{Name: "a", Daemon: true, ActiveTurns: 2, Notice: &upgradeWorkNotice{Key: key, Told: 2, Held: 1, NotDelivered: 1}}, {Name: "b", Daemon: true}, {Name: "c"}}
		}
		return p, e
	}
	r, e := executeUpgrade(context.Background(), req, d)
	if e != nil || r.Outcome != "upgraded" {
		t.Fatalf("%+v %v %v", r, e, *events)
	}
	if got := *r.Announcement.Reach; got != (UpgradeNoticeReach{Told: 2, Held: 1, NotDelivered: 1, DaemonsUnreported: 1}) || key == "" {
		t.Fatalf("%+v", got)
	}
}

func TestUpgradeBlockedAtTheDeadlineWithdraws(t *testing.T) {
	d, req, events, _, path := noticeDriver(t)
	calls := 0
	plan := d.plan
	d.plan = func(c context.Context, s string) (UpgradePlan, error) {
		p, e := plan(c, s)
		if calls++; calls == 4 {
			p.Approvable = false
		}
		return p, e
	}
	r, e := executeUpgrade(context.Background(), req, d)
	if !errors.Is(e, ErrUpgradeBlocked) || r.Announcement.State != "withdrawn" || strings.Contains(strings.Join(*events, ","), "quiescing") {
		t.Fatalf("%+v %v %v", r, e, *events)
	}
	if rec, ok := readNotice(t, path); !ok || rec.State != upgradenotice.Withdrawn {
		t.Fatal("blocked upgrade left its schedule announced")
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
