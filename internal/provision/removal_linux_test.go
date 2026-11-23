//go:build linux

package provision

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/storagequota"
)

// fakeRemoval records each removal step and fails the ones named in fail
// once each, so a test can interrupt every point and repeat to completion.
type fakeRemoval struct {
	mu    sync.Mutex
	host  *fakeHost
	calls []string
	fail  map[string]int
}

func (f *fakeRemoval) step(name string, i ExecutorIdentity) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, name+":"+i.Username())
	if f.fail[name] > 0 {
		f.fail[name]--
		if name == "home" {
			return removalHold(RemovalHomeUnsafe)
		}
		return errors.New("private host detail")
	}
	if name == "artifacts" {
		f.host.mu.Lock()
		delete(f.host.occupied, i.Username())
		delete(f.host.uids, i.UID())
		f.host.mu.Unlock()
	}
	return nil
}

func (f *fakeRemoval) CloseOut(_ context.Context, i ExecutorIdentity) error {
	return f.step("close", i)
}
func (f *fakeRemoval) Reopen(_ context.Context, i ExecutorIdentity) error { return f.step("reopen", i) }
func (f *fakeRemoval) RemoveOutside(_ context.Context, i ExecutorIdentity) error {
	return f.step("outside", i)
}
func (f *fakeRemoval) RemoveHome(_ context.Context, i ExecutorIdentity) error {
	return f.step("home", i)
}
func (f *fakeRemoval) RemoveArtifacts(_ context.Context, i ExecutorIdentity) error {
	return f.step("artifacts", i)
}

func (f *fakeRemoval) taken() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := f.calls
	f.calls = nil
	return out
}

type removalClock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *removalClock) get() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}
func (c *removalClock) add(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}

type removalEvent struct{ stage, outcome, reason string }

// removalWriter is a runtime-admission broker with person 50 admitted and
// bound as "newcomer".
func removalWriter(t *testing.T) (Writer, *fakeHost, *fakeRemoval, *removalClock, *[]removalEvent) {
	t.Helper()
	w, h := runtimeWriter(t, true)
	clock := &removalClock{now: time.Date(2026, 11, 21, 9, 0, 0, 0, time.UTC)}
	w.Now = clock.get
	f := &fakeRemoval{host: h, fail: map[string]int{}}
	w.RemovalHost = f
	events := &[]removalEvent{}
	var mu sync.Mutex
	w.RemovalEvent = func(id, user, stage, outcome, reason string) {
		mu.Lock()
		defer mu.Unlock()
		if id != "50" || user != "newcomer" {
			t.Errorf("event names %s/%s", id, user)
		}
		*events = append(*events, removalEvent{stage, outcome, reason})
	}
	accessRow(t, admit(w, "50", "Newcomer", "42"))
	if r := handle(w, "ensure", "50", "Newcomer"); r.Route == nil || r.Route.UID != 2100 {
		t.Fatal(r)
	}
	return w, h, f, clock, events
}

func schedule(w Writer, id, when string) Reply {
	return w.Handle(context.Background(), Request{Version: 1, Operation: OpRemovalSchedule, Provider: "github", ID: id, LoginHint: "Newcomer", Actor: "42", When: when})
}
func cancelRemoval(w Writer, id string) Reply {
	return w.Handle(context.Background(), Request{Version: 1, Operation: OpRemovalCancel, Provider: "github", ID: id, Actor: "42"})
}

func ledgerState(t *testing.T, dir string) ledgerFile {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(dir, "bindings.json"))
	if err != nil {
		t.Fatal(err)
	}
	var l ledgerFile
	if json.Unmarshal(b, &l) != nil {
		t.Fatal(string(b))
	}
	return l
}

// A grace-period removal closes the person out at once, refuses everything
// that would bring them back, waits for the due time, then deletes in order
// and drops the binding and every admission record. Coming back is a new
// account.
func TestRemovalGracePeriodLifecycle(t *testing.T) {
	w, h, f, clock, events := removalWriter(t)
	row := accessRow(t, schedule(w, "50", RemovalGrace))
	if row.State != StateWithdrawn || row.Removal == nil || row.Removal.Stage != RemovalClosed || row.Removal.Due != "2026-12-05T09:00:00Z" || row.Removal.Actor != "42" || row.Removal.Reason != "" {
		t.Fatalf("scheduled row: %+v %+v", row, row.Removal)
	}
	if got := f.taken(); !reflect.DeepEqual(got, []string{"close:newcomer"}) {
		t.Fatal("close-out", got)
	}
	if len(stops(h)) != 1 {
		t.Fatal("listeners not stopped", stops(h))
	}
	if r := admit(w, "50", "Newcomer", "42"); r.Failure != RemovalPending {
		t.Fatal("restore during removal", r)
	}
	limit := uint64(2 << 30)
	if r := w.Handle(context.Background(), Request{Version: 1, Operation: "quota_set", Provider: "github", ID: "50", LimitBytes: &limit}); r.Failure != RemovalPending {
		t.Fatal("quota change during removal", r)
	}
	// Root admitting the id again does not route it.
	put(t, w.Dir, "allowlist.json", strings.Replace(string(mustRead(t, w.Dir, "allowlist.json")), `"ids":[{"id":"42"}]`, `"ids":[{"id":"42"},{"id":"50"}]`, 1))
	if r := handle(w, "authorize", "50", ""); r.Failure != RemovalPending {
		t.Fatal("authorize during removal", r)
	}
	w.RunRemovals(context.Background())
	if a := allowState(t, w.Dir); a.removal("50").Reason != RemovalAdmitted || len(f.taken()) != 0 {
		t.Fatalf("admitted removal ran: %+v", a.removal("50"))
	}
	put(t, w.Dir, "allowlist.json", strings.Replace(string(mustRead(t, w.Dir, "allowlist.json")), `,{"id":"50"}`, ``, 1))
	w.RunRemovals(context.Background())
	if got := f.taken(); !reflect.DeepEqual(got, []string{"close:newcomer"}) {
		t.Fatal("held close-out not repeated", got)
	}
	if a := allowState(t, w.Dir); a.removal("50").Reason != "" || a.removal("50").Stage != RemovalClosed {
		t.Fatalf("hold not cleared: %+v", a.removal("50"))
	}
	// Before the due time nothing more happens.
	clock.add(RemovalGracePeriod - time.Minute)
	w.RunRemovals(context.Background())
	if got := f.taken(); len(got) != 0 {
		t.Fatal("ran before due", got)
	}
	clock.add(time.Minute)
	w.RunRemovals(context.Background())
	if got := f.taken(); !reflect.DeepEqual(got, []string{"close:newcomer", "outside:newcomer", "home:newcomer", "artifacts:newcomer"}) {
		t.Fatal("data stage", got)
	}
	q := w.Quota.(*fakeQuota)
	if !reflect.DeepEqual(q.cleared, []uint32{2100}) {
		t.Fatal("quota not cleared", q.cleared)
	}
	if l := ledgerState(t, w.Dir); len(l.Bindings) != 0 || l.Generation != 9 {
		t.Fatalf("binding not dropped: %+v", l)
	}
	a := allowState(t, w.Dir)
	if a.Runtime != nil || a.Removals != nil || a.Members != nil || a.Revoked != nil {
		t.Fatalf("admission records left: %+v", a)
	}
	if r := w.Handle(context.Background(), Request{Version: 1, Operation: "access_read", Provider: "github", ID: "50"}); r.Access == nil || len(r.Access.Rows) != 0 {
		t.Fatal("removed person still listed", r)
	}
	if last := (*events)[len(*events)-1]; last != (removalEvent{"data", "completed", ""}) {
		t.Fatal(*events)
	}
	// Coming back is a new account, here with the reused UID.
	accessRow(t, admit(w, "50", "Newcomer", "42"))
	if r := handle(w, "ensure", "50", "Newcomer"); r.Route == nil || !r.Created || r.Route.UID != 2100 {
		t.Fatal("re-admission", r)
	}
}

func mustRead(t *testing.T, dir, name string) []byte {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(dir, name))
	if err != nil {
		t.Fatal(err)
	}
	return b
}

// Every interruption point holds the removal with a fixed reason, keeps the
// binding, and the next run repeats the steps until the removal completes.
func TestRemovalInterruptionsRepeatToCompletion(t *testing.T) {
	for _, point := range []string{"close", "outside", "home", "artifacts", "charged", "clear"} {
		t.Run(point, func(t *testing.T) {
			w, _, f, _, events := removalWriter(t)
			q := w.Quota.(*fakeQuota)
			switch point {
			case "charged":
				q.charged = map[uint32][2]uint64{2100: {4096, 1}}
			case "clear":
				q.clearFail = 1
			default:
				f.fail[point] = 1
			}
			if point == "close" {
				f.fail[point] = 2
			}
			row := accessRow(t, schedule(w, "50", RemovalNow))
			if point == "close" {
				if row.Removal.Stage != RemovalClosing || row.Removal.Reason != RemovalCloseFailed {
					t.Fatalf("failed close-out: %+v", row.Removal)
				}
			}
			select {
			case <-w.removal.kick:
			default:
				t.Fatal("immediate removal did not wake the runner")
			}
			w.RunRemovals(context.Background())
			a := allowState(t, w.Dir)
			e := a.removal("50")
			want := map[string]string{"close": RemovalCloseFailed, "outside": RemovalStepFailed, "home": RemovalHomeUnsafe, "artifacts": RemovalStepFailed, "charged": RemovalFilesRemain, "clear": RemovalStepFailed}[point]
			if e == nil || e.Stage != RemovalRemoving || e.Reason != want {
				t.Fatalf("held entry: %+v", e)
			}
			if len(ledgerState(t, w.Dir).Bindings) != 1 {
				t.Fatal("binding dropped while held")
			}
			if r := cancelRemoval(w, "50"); r.Failure != RemovalStarted {
				t.Fatal("cancel after the data stage began", r)
			}
			// The operator fixes the cause.
			q.mu.Lock()
			q.charged = nil
			q.mu.Unlock()
			f.taken()
			w.RunRemovals(context.Background())
			if got := f.taken(); !reflect.DeepEqual(got, []string{"close:newcomer", "outside:newcomer", "home:newcomer", "artifacts:newcomer"}) {
				t.Fatal("repeat did not run every step", got)
			}
			if l := ledgerState(t, w.Dir); len(l.Bindings) != 0 || allowState(t, w.Dir).Removals != nil {
				t.Fatal("repeat did not complete")
			}
			held := false
			for _, ev := range *events {
				held = held || ev.outcome == "held" && ev.reason == want
			}
			if !held {
				t.Fatal("hold not reported", *events)
			}
		})
	}
}

// Cancelling before the data stage unexpires the account and leaves access
// withdrawn; a repeat changes nothing.
func TestRemovalCancel(t *testing.T) {
	w, _, f, _, _ := removalWriter(t)
	accessRow(t, schedule(w, "50", RemovalGrace))
	f.taken()
	row := accessRow(t, cancelRemoval(w, "50"))
	if row.State != StateWithdrawn || row.Removal != nil {
		t.Fatalf("cancelled row: %+v", row)
	}
	if got := f.taken(); !reflect.DeepEqual(got, []string{"reopen:newcomer"}) {
		t.Fatal(got)
	}
	if row := accessRow(t, cancelRemoval(w, "50")); row.State != StateWithdrawn || len(f.taken()) != 0 {
		t.Fatal("repeat cancel", row)
	}
	if row := accessRow(t, admit(w, "50", "Newcomer", "42")); row.State != StateJoined {
		t.Fatal("restore after cancel", row)
	}
	// A failed reopen keeps the removal.
	accessRow(t, schedule(w, "50", RemovalGrace))
	f.fail["reopen"] = 1
	if r := cancelRemoval(w, "50"); r.Failure != StateUnavailable || allowState(t, w.Dir).removal("50") == nil {
		t.Fatal("failed reopen", r)
	}
}

// "Now" on a grace-period removal brings the due time forward; a repeat of
// either timing never moves it later.
func TestRemovalNowAfterGrace(t *testing.T) {
	w, _, _, _, _ := removalWriter(t)
	accessRow(t, schedule(w, "50", RemovalGrace))
	if row := accessRow(t, schedule(w, "50", RemovalGrace)); row.Removal.Due != "2026-12-05T09:00:00Z" {
		t.Fatal(row.Removal)
	}
	if row := accessRow(t, schedule(w, "50", RemovalNow)); row.Removal.Due != "2026-11-21T09:00:00Z" {
		t.Fatal(row.Removal)
	}
	if row := accessRow(t, schedule(w, "50", RemovalGrace)); row.Removal.Due != "2026-11-21T09:00:00Z" {
		t.Fatal("grace moved the due time later", row.Removal)
	}
}

// Root's source is outside the gateway's reach, a test installation removes
// nobody, and a subject with no binding has its admission records dropped.
func TestRemovalRefusalsAndUnbound(t *testing.T) {
	w, _, f, _, _ := removalWriter(t)
	if r := schedule(w, "42", RemovalNow); r.Failure != OperatorOwned {
		t.Fatal(r)
	}
	accessRow(t, admit(w, "51", "passer", "42"))
	if row := accessRow(t, schedule(w, "51", RemovalNow)); row.State != StateRemoved {
		t.Fatal(row)
	}
	for _, x := range allowState(t, w.Dir).Runtime {
		if x.ID == "51" {
			t.Fatal("unbound entry kept")
		}
	}
	if len(f.taken()) != 0 {
		t.Fatal("unbound removal reached the host")
	}
	w.AdmitAny = true
	if r := schedule(w, "50", RemovalNow); r.Failure != AdmissionOpen {
		t.Fatal(r)
	}
	w.AdmitAny = false
	w.RemovalHost = nil
	if r := schedule(w, "50", RemovalNow); r.Failure != StateUnavailable {
		t.Fatal(r)
	}
}

// The administrator's storage page counts a person under removal by usage:
// the row carries the due date, and keeps it after the quota record is gone.
func TestRemovalQuotaRow(t *testing.T) {
	w, _, _, _, _ := removalWriter(t)
	q := w.Quota.(*fakeQuota)
	q.quota = storagequota.Quota{Usage: 5 << 20, Limit: 1 << 30}
	q.charged = map[uint32][2]uint64{2100: {5 << 20, 10}}
	accessRow(t, schedule(w, "50", RemovalGrace))
	r := w.Handle(context.Background(), Request{Version: 1, Operation: "quota_list", Provider: "github", ID: "0"})
	if r.Quotas == nil || len(r.Quotas.Rows) != 1 {
		t.Fatal(r)
	}
	row := r.Quotas.Rows[0]
	if row.RemovalDue != "2026-12-05T09:00:00Z" || row.UsageBytes != 5<<20 || row.LimitBytes != 1<<30 || row.Unavailable {
		t.Fatalf("%+v", row)
	}
	q.mu.Lock()
	q.quota.Limit = 0
	q.mu.Unlock()
	r = w.Handle(context.Background(), Request{Version: 1, Operation: "quota_list", Provider: "github", ID: "0"})
	if r.Quotas == nil || r.Quotas.Rows[0].LimitBytes != 0 || r.Quotas.Rows[0].Unavailable {
		t.Fatal("cleared record", r)
	}
}

// The allocator skips a UID the kernel still charges.
func TestAllocatorSkipsChargedUID(t *testing.T) {
	w, _ := writerFixture(t)
	w.Quota.(*fakeQuota).charged = map[uint32][2]uint64{2100: {0, 1}}
	if r := handle(w, "ensure", "42", "carol"); r.Route == nil || r.Route.UID != 2101 {
		t.Fatal(r)
	}
}

// Startup neither verifies nor activates a binding under removal, so a
// half-deleted account never stops the broker from serving the others.
func TestStartupSkipsRemovalBinding(t *testing.T) {
	w, h, _, _, _ := removalWriter(t)
	accessRow(t, schedule(w, "50", RemovalNow))
	h.mu.Lock()
	h.verifyErr = true
	h.mu.Unlock()
	w.Quota.(*fakeQuota).fail = true
	w.Quota.(*fakeQuota).chargedFail = true
	if bindings, err := w.startupBindings(context.Background()); err != nil || len(bindings) != 0 {
		t.Fatal(bindings, err)
	}
}

func TestRemovalWire(t *testing.T) {
	for _, bad := range []string{
		`{"version":1,"operation":"removal_schedule","provider":"github","id":"50","actor":"42","login_hint":"x"}`,
		`{"version":1,"operation":"removal_schedule","provider":"github","id":"50","actor":"42","login_hint":"x","when":"later"}`,
		`{"version":1,"operation":"removal_schedule","provider":"github","id":"50","login_hint":"x","when":"now"}`,
		`{"version":1,"operation":"removal_cancel","provider":"github","id":"50","actor":"42","when":"now"}`,
		`{"version":1,"operation":"withdraw","provider":"github","id":"50","actor":"42","when":"now"}`,
		`{"version":1,"operation":"removal_cancel","provider":"github","id":"0","actor":"42"}`,
	} {
		if _, err := ParseRequest([]byte(bad)); err == nil {
			t.Fatal("accepted", bad)
		}
	}
	for _, good := range []string{
		`{"version":1,"operation":"removal_schedule","provider":"github","id":"50","actor":"42","login_hint":"x","when":"grace"}`,
		`{"version":1,"operation":"removal_cancel","provider":"github","id":"50","actor":"root"}`,
	} {
		if _, err := ParseRequest([]byte(good)); err != nil {
			t.Fatal("refused", good)
		}
	}
	page := func(removal string) string {
		return `{"version":1,"generation":1,"epoch":1,"access":{"mode":"allowlist","runtime_admission":true,"rows":[{"id":"50","source":"site_admin","state":"withdrawn","username":"newcomer","login_hint":"x","actor":"42","at":"2026-11-21T09:00:00Z"` + removal + `}]}}`
	}
	if _, err := ParseReply([]byte(page(`,"removal":{"stage":"closed","due":"2026-12-05T09:00:00Z","actor":"42","at":"2026-11-21T09:00:00Z"}`))); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []string{
		`,"removal":{"stage":"gone","due":"2026-12-05T09:00:00Z","actor":"42","at":"2026-11-21T09:00:00Z"}`,
		`,"removal":{"stage":"closed","due":"2026-12-05T09:00:00Z","actor":"42","at":"2026-11-21T09:00:00Z","reason":"/home/x"}`,
		`,"removal":{"stage":"closed","due":"2026-12-05T09:00:00Z","actor":"42","at":"2026-11-21T09:00:00Z","path":"x"}`,
	} {
		if _, err := ParseReply([]byte(page(bad))); err == nil {
			t.Fatal("accepted", bad)
		}
	}
	if _, err := ParseReply([]byte(`{"version":1,"failure":"removal_pending"}`)); err != nil {
		t.Fatal(err)
	}
}

// The home is deleted by descriptor: a link inside is removed as itself and
// its target survives, a home of another owner is refused, and an
// interrupted deletion continues from the reserved name.
func TestRemoveHomeAt(t *testing.T) {
	base := t.TempDir()
	if err := os.Chmod(base, 0755); err != nil {
		t.Fatal(err)
	}
	uid := uint32(os.Getuid())
	if uid < 1000 {
		t.Skip("needs an ordinary test UID")
	}
	outside := filepath.Join(t.TempDir(), "keep")
	if err := os.WriteFile(outside, []byte("x"), 0600); err != nil {
		t.Fatal(err)
	}
	home := filepath.Join(base, "carol")
	for _, d := range []string{"a/b/c", "d"} {
		if err := os.MkdirAll(filepath.Join(home, d), 0700); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(home, "a/b/c/f"), []byte("x"), 0400); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(home, "d/link")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Dir(outside), filepath.Join(home, "dirlink")); err != nil {
		t.Fatal(err)
	}
	i := ExecutorIdentity{provider: "github", id: "50", username: "carol", uid: uid}
	other := ExecutorIdentity{provider: "github", id: "50", username: "carol", uid: uid + 1}
	if err := removeHomeAt(context.Background(), base, other); holdReason(err, "") != RemovalHomeUnsafe {
		t.Fatal("another owner's home", err)
	}
	// An interrupted run renamed the home already.
	if err := os.Rename(home, filepath.Join(base, removalReserved(uid))); err != nil {
		t.Fatal(err)
	}
	if err := removeHomeAt(context.Background(), base, i); err != nil {
		t.Fatal(err)
	}
	entries, _ := os.ReadDir(base)
	if len(entries) != 0 {
		t.Fatal("left", entries)
	}
	if _, err := os.Stat(outside); err != nil {
		t.Fatal("link target removed", err)
	}
	if err := removeHomeAt(context.Background(), base, i); err != nil {
		t.Fatal("repeat", err)
	}
	// A home that is a link is refused.
	if err := os.Symlink(filepath.Dir(outside), home); err != nil {
		t.Fatal(err)
	}
	if err := removeHomeAt(context.Background(), base, i); holdReason(err, "") != RemovalHomeUnsafe {
		t.Fatal("linked home", err)
	}
	if _, err := os.Stat(outside); err != nil {
		t.Fatal(err)
	}
}
