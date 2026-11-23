//go:build linux

package gateway

import (
	"context"
	"errors"
	"strings"
	"testing"
)

// ScheduleRemoval and CancelRemoval model the broker's removal: schedule
// withdraws and records the removal, cancel drops it before the data stage.
func (b *accessFake) ScheduleRemoval(_ context.Context, id, hint, actor, when string) (AccessRow, error) {
	if b.onSchedule != nil {
		b.onSchedule()
	}
	b.amu.Lock()
	defer b.amu.Unlock()
	if b.operator[id] {
		return AccessRow{}, ErrOperatorOwned
	}
	if bound, _ := b.LookupBound(context.Background(), id); !bound {
		delete(b.runtime, id)
		return AccessRow{ID: id, Source: "site_admin", State: "removed"}, nil
	}
	if b.removals == nil {
		b.removals = map[string]*RemovalState{}
	}
	if b.removals[id] == nil {
		due := "2026-11-07T09:00:00Z"
		if when == "now" {
			due = "2026-10-24T09:00:00Z"
		}
		b.removals[id] = &RemovalState{Stage: "closed", Due: due, Actor: actor, At: "2026-10-24T09:00:00Z"}
	}
	b.runtime[id] = "withdrawn"
	return b.row(id)[0], nil
}

func (b *accessFake) CancelRemoval(_ context.Context, id, _ string) (AccessRow, error) {
	b.amu.Lock()
	defer b.amu.Unlock()
	if r := b.removals[id]; r != nil && r.Stage == "removing" {
		return AccessRow{}, ErrRemovalStarted
	}
	delete(b.removals, id)
	return b.row(id)[0], nil
}

// complete is the broker finishing the data stage: the binding and every
// admission record of the subject are gone.
func (b *accessFake) complete(id string) {
	b.amu.Lock()
	delete(b.removals, id)
	delete(b.runtime, id)
	b.amu.Unlock()
	b.fakeBroker.mu.Lock()
	if b.unbound == nil {
		b.unbound = map[string]bool{}
	}
	b.unbound[id] = true
	b.fakeBroker.mu.Unlock()
}

// Removal records the removal and the deny and removes the sessions before
// the broker is asked; the typed login must name the subject; restore waits
// for a cancel; and once the broker has deleted the data, the gateway drops
// everything it kept so the id comes back as a new account.
func TestPersonRemovalOrderAndCompletion(t *testing.T) {
	x := newAccessHarness(t)
	bob := x.login("43", "bob")
	if bob == nil {
		t.Fatal("runtime-admitted login")
	}
	if _, err := x.auth.removePerson(context.Background(), "42", "43", "carol", "grace"); !errors.Is(err, errLoginMismatch) {
		t.Fatal("wrong login", err)
	}
	if !x.live(bob) || strings.Contains(x.file("administration.json"), `"removals"`) {
		t.Fatal("a refused removal touched the person")
	}
	if _, err := x.auth.removePerson(context.Background(), "42", "42", "alice", "now"); !errors.Is(err, errSelfRemoval) {
		t.Fatal("self removal", err)
	}
	x.broker.onSchedule = func() {
		admin := x.file("administration.json")
		if !strings.Contains(admin, `"denied":["43"]`) || !strings.Contains(admin, `"removals":{"43":`) {
			t.Error("broker asked before the record and deny were durable", admin)
		}
		if x.sessionsOf("43") != 0 {
			t.Error("broker asked before the sessions were removed")
		}
	}
	row, err := x.auth.removePerson(context.Background(), "42", "43", "BOB", "grace")
	if err != nil || row.State != "withdrawn" || row.Removal == nil {
		t.Fatal(row, err)
	}
	if x.live(bob) || x.login("43", "bob") != nil {
		t.Fatal("removed person still reaches the web")
	}
	view, err := x.auth.accessList(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	var entry *accessEntry
	for i := range view.Entries {
		if view.Entries[i].ID == "43" {
			entry = &view.Entries[i]
		}
	}
	// No daemon is reachable in this harness: not_reached, nothing named.
	if entry == nil || entry.Removal == nil || entry.Removal.Stage != "scheduled" || entry.Removal.Due != "2026-11-07T09:00:00Z" || entry.Removal.Disconnect != "not_reached" {
		t.Fatalf("listed removal: %+v", entry)
	}
	if _, err := x.auth.admitAccess(context.Background(), "42", "43"); !errors.Is(err, ErrRemovalPending) {
		t.Fatal("restore during removal", err)
	}
	// The broker deletes the data; the next list settles the gateway's part.
	x.broker.complete("43")
	if _, err := x.auth.accessList(context.Background()); err != nil {
		t.Fatal(err)
	}
	admin := x.file("administration.json")
	if strings.Contains(admin, `"removals"`) || strings.Contains(admin, `"denied"`) || strings.Contains(admin, `"43"`) {
		t.Fatal("gateway kept the removed subject", admin)
	}
	if row, err := x.auth.admitAccess(context.Background(), "42", "43"); err != nil || row.State != "allowed" {
		t.Fatal("re-admission", row, err)
	}
}

// Cancel drops the record and leaves access withdrawn; after the data stage
// began it is refused. A root administrator is root's to remove.
func TestPersonRemovalCancelAndRefusals(t *testing.T) {
	x := newAccessHarness(t)
	if _, err := x.auth.removePerson(context.Background(), "", "42", "alice", "now"); !errors.Is(err, ErrOperatorOwned) {
		t.Fatal("site.json person", err)
	}
	if _, err := x.auth.removePerson(context.Background(), "42", "43", "bob", "grace"); err != nil {
		t.Fatal(err)
	}
	row, err := x.auth.cancelPersonRemoval(context.Background(), "42", "43")
	if err != nil || row.State != "withdrawn" || row.Removal != nil {
		t.Fatal(row, err)
	}
	admin := x.file("administration.json")
	if strings.Contains(admin, `"removals"`) || !strings.Contains(admin, `"denied":["43"]`) {
		t.Fatal("cancel", admin)
	}
	if _, err := x.auth.removePerson(context.Background(), "42", "43", "bob", "now"); err != nil {
		t.Fatal(err)
	}
	x.broker.amu.Lock()
	x.broker.removals["43"].Stage = "removing"
	x.broker.amu.Unlock()
	if _, err := x.auth.cancelPersonRemoval(context.Background(), "42", "43"); !errors.Is(err, ErrRemovalStarted) {
		t.Fatal("cancel after the data stage began", err)
	}
	if status, code := accessReason(ErrRemovalStarted); status != 409 || code != "removal_started" {
		t.Fatal(status, code)
	}
}

// The administrator's sum of limits counts a person under removal by usage,
// so removing someone brings an overcommitted disk back under capacity.
func TestQuotaSumCountsRemovalByUsage(t *testing.T) {
	a := &Auth{broker: removalQuotaBroker{newFakeBroker()}}
	b, err := a.quotaUsers(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	s := string(b)
	if !strings.Contains(s, `"overcommitted":false`) || !strings.Contains(s, `"removal_due":"2026-12-05T09:00:00Z"`) {
		t.Fatal(s)
	}
}

type removalQuotaBroker struct{ *fakeBroker }

func (removalQuotaBroker) ListQuotas(context.Context) ([]QuotaRow, QuotaFilesystem, error) {
	return []QuotaRow{
		{BoundUser: BoundUser{ID: "42", Username: "alice"}, Quota: Quota{UsageBytes: 1 << 30, LimitBytes: 60 << 30}},
		{BoundUser: BoundUser{ID: "43", Username: "bob"}, Quota: Quota{UsageBytes: 10 << 30, LimitBytes: 50 << 30}, RemovalDue: "2026-12-05T09:00:00Z"},
		{BoundUser: BoundUser{ID: "44", Username: "carol"}, Quota: Quota{UsageBytes: 2 << 30}, RemovalDue: "2026-11-21T09:00:00Z"},
	}, QuotaFilesystem{CapacityBytes: 100 << 30, FreeBytes: 80 << 30}, nil
}
