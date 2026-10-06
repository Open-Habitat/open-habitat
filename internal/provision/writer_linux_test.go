//go:build linux

package provision

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"testing"
	"time"

	"golang.org/x/sys/unix"
)

type hostCall struct {
	phase    string
	provider string
	id       string
	username string
	uid      uint32
}

func call(phase string, i ExecutorIdentity) hostCall {
	return hostCall{phase, i.Provider(), i.ID(), i.Username(), i.UID()}
}

func assertCalls(t *testing.T, h *fakeHost, want ...hostCall) {
	t.Helper()
	h.mu.Lock()
	defer h.mu.Unlock()
	if !reflect.DeepEqual(h.calls, want) {
		t.Fatalf("executor calls: got %+v, want %+v", h.calls, want)
	}
}

func provisionCalls(id, name string, uid uint32) []hostCall {
	calls := make([]hostCall, 0, len(phases)+1)
	for _, phase := range phases {
		calls = append(calls, hostCall{phase, "github", id, name, uid})
	}
	return append(calls, hostCall{"verify", "github", id, name, uid}, hostCall{"verify", "github", id, name, uid})
}

type fakeHost struct {
	mu         sync.Mutex
	occupied   map[string]bool
	uids       map[uint32]bool
	steps      []string
	calls      []hostCall
	fail       string
	verifyErr  bool
	readyErr   bool
	routeErr   bool
	readyCalls []hostCall
	routeCalls []hostCall
	onReady    func()
	onStep     func(string)
}

func (h *fakeHost) Available(_ context.Context, n string, u uint32) (bool, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.fail == "available" {
		return false, errors.New("injected")
	}
	return !h.occupied[n] && !h.uids[u], nil
}
func (h *fakeHost) Step(_ context.Context, p string, i ExecutorIdentity) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.calls = append(h.calls, call(p, i))
	if h.fail == p {
		return errors.New("injected")
	}
	h.steps = append(h.steps, p)
	if h.onStep != nil {
		h.onStep(p)
	}
	if p == "account" {
		h.occupied[i.Username()] = true
		h.uids[i.UID()] = true
	}
	return nil
}
func (h *fakeHost) RouteReady(_ context.Context, i ExecutorIdentity) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.routeCalls = append(h.routeCalls, call("route-ready", i))
	if h.routeErr {
		return errors.New("inactive")
	}
	return nil
}
func (h *fakeHost) Ready(ctx context.Context, i ExecutorIdentity) error {
	h.mu.Lock()
	h.readyCalls = append(h.readyCalls, call("ready", i))
	fail, callback := h.readyErr, h.onReady
	h.mu.Unlock()
	if callback != nil {
		callback()
	}
	if fail {
		return errors.New("socket start failed")
	}
	return ctx.Err()
}
func (h *fakeHost) Verify(_ context.Context, i ExecutorIdentity) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.calls = append(h.calls, call("verify", i))
	if h.fail == "verify" || h.verifyErr || !h.occupied[i.Username()] || !h.uids[i.UID()] {
		return errors.New("drift")
	}
	return nil
}
func writerFixture(t *testing.T) (Writer, *fakeHost) {
	t.Helper()
	d := fixture(t)
	put(t, d, "bindings.json", `{"version":1,"generation":7,"bindings":[]}`)
	put(t, d, "head.json", `{"version":1,"epoch":4,"generation":7}`)
	h := &fakeHost{occupied: map[string]bool{}, uids: map[uint32]bool{}}
	w := NewWriter(d, 2100, 2102, h)
	w.owner = uint32(os.Getuid())
	return w, h
}
func handle(w Writer, op, id, name string) Reply {
	return w.Handle(context.Background(), request(op, id, name))
}
func TestWriterPhasesAndCommittedVerification(t *testing.T) {
	w, h := writerFixture(t)
	r := handle(w, "ensure", "42", "carol")
	if r.Route == nil || r.Route.UID != 2100 || r.Generation != 8 || r.Epoch != 4 {
		t.Fatal(r)
	}
	if len(h.steps) != 5 || !fileAbsent(filepath.Join(w.Dir, "pending.json")) {
		t.Fatal(h.steps)
	}
	want := provisionCalls("42", "carol", 2100)
	assertCalls(t, h, want...)
	if r = handle(w, "ensure", "42", "renamed"); r.Route == nil || r.Route.Username != "carol" || len(h.steps) != 5 {
		t.Fatal(r, h.steps)
	}
	want = append(want, hostCall{"verify", "github", "42", "carol", 2100}, hostCall{"verify", "github", "42", "carol", 2100})
	assertCalls(t, h, want...)
	if r = handle(w, "authorize", "42", ""); r.Route == nil {
		t.Fatal(r)
	}
	want = append(want, hostCall{"verify", "github", "42", "carol", 2100})
	assertCalls(t, h, want...)
	h.verifyErr = true
	if r = handle(w, "authorize", "42", ""); r.Failure != Drift {
		t.Fatal(r)
	}
	want = append(want, hostCall{"verify", "github", "42", "carol", 2100})
	assertCalls(t, h, want...)
	h.verifyErr = false
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":5,"ids":[]}`)
	if r = handle(w, "ensure", "42", "carol"); r.Failure != Denied {
		t.Fatal(r)
	}
	assertCalls(t, h, want...)
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":4,"ids":[{"id":"42"}]}`)
	if r = handle(w, "authorize", "42", ""); r.Failure != StateUnavailable {
		t.Fatal("epoch rollback", r)
	}
	assertCalls(t, h, want...)
}
func TestWriterExplicitAnyAdmission(t *testing.T) {
	w, h := writerFixture(t)
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":4,"ids":[]}`)
	if r := handle(w, "ensure", "91", "visitor"); r.Failure != Denied {
		t.Fatal("default must deny unknown ID", r)
	}
	w.AdmitAny = true
	if r := handle(w, "authorize", "91", ""); r.Failure != Denied {
		t.Fatal("unbound account cannot authorize", r)
	}
	r := handle(w, "ensure", "91", "visitor")
	if r.Route == nil || r.Route.UID != 2100 || r.Route.Username != "visitor" {
		t.Fatal("new identity not provisioned", r)
	}
	assertCalls(t, h, provisionCalls("91", "visitor", 2100)...)
	if r := handle(w, "authorize", "91", ""); r.Route == nil || r.Route.UID != 2100 {
		t.Fatal("committed identity not authorized", r)
	}
	if r := handle(w, "ensure", "92", "visitor"); r.Failure != NameCollision {
		t.Fatal("new identity must not claim occupied name", r)
	}
	// Removing the mode from operator config restores the explicit-ID rule,
	// including for a previously bound account.
	w.AdmitAny = false
	if r := handle(w, "authorize", "91", ""); r.Failure != Denied {
		t.Fatal("mode removed", r)
	}
}
func fileAbsent(p string) bool { _, e := os.Lstat(p); return os.IsNotExist(e) }
func TestWriterFailuresRemainPending(t *testing.T) {
	for _, phase := range []string{"available", "account", "home", "config", "socket", "unit", "verify"} {
		t.Run(phase, func(t *testing.T) {
			w, h := writerFixture(t)
			h.fail = phase
			r := handle(w, "ensure", "42", "carol")
			if r.Route != nil {
				t.Fatal(r)
			}
			if phase == "available" {
				assertCalls(t, h)
				if !fileAbsent(filepath.Join(w.Dir, "pending.json")) {
					t.Fatal("journal before occupancy")
				}
				return
			}
			b, e := os.ReadFile(filepath.Join(w.Dir, "pending.json"))
			if e != nil {
				t.Fatal(e)
			}
			var j journal
			if json.Unmarshal(b, &j) != nil || j.ID != "42" || j.UID != 2100 || j.Username != "carol" || j.Phase != phase {
				t.Fatal(string(b))
			}
			want := provisionCalls("42", "carol", 2100)
			for i, c := range want {
				if c.phase == phase {
					want = want[:i+1]
					break
				}
			}
			assertCalls(t, h, want...)
			h.fail = ""
			if r = handle(w, "ensure", "42", "carol"); r.Failure != StateUnavailable {
				t.Fatal("retried pending", r)
			}
			if r = handle(w, "authorize", "42", ""); r.Failure != StateUnavailable {
				t.Fatal(r)
			}
			assertCalls(t, h, want...)
		})
	}
}
func TestWriterCollisionsAndCorruption(t *testing.T) {
	for _, tc := range []struct {
		name, allow, ledger string
		occ                 string
		want                Failure
	}{
		{name: "reserved alice", occ: "alice", want: NameCollision}, {name: "reserved bob", occ: "bob", want: NameCollision},
		{name: "alternate", allow: `{"version":1,"epoch":5,"ids":[{"id":"42","alternate":"bob"}]}`, occ: "bob", want: NameCollision},
		{name: "duplicate allow", allow: `{"version":1,"epoch":4,"ids":[{"id":"42"},{"id":"42"}]}`, want: StateUnavailable},
		{name: "ledger collision", ledger: `{"version":1,"generation":7,"bindings":[{"id":"43","uid":2100,"username":"carol"}]}`, want: NameCollision},
		{name: "ledger rollback", ledger: `{"version":1,"generation":6,"bindings":[]}`, want: StateUnavailable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w, h := writerFixture(t)
			if tc.allow != "" {
				put(t, w.Dir, "allowlist.json", tc.allow)
			}
			if tc.ledger != "" {
				put(t, w.Dir, "bindings.json", tc.ledger)
			}
			if tc.occ != "" {
				h.occupied[tc.occ] = true
			}
			candidate := "carol"
			if tc.occ != "" {
				candidate = tc.occ
			}
			if tc.name == "alternate" {
				candidate = "carol"
			}
			if r := handle(w, "ensure", "42", candidate); r.Failure != tc.want {
				t.Fatal(r)
			}
			assertCalls(t, h)
		})
	}
	w, h := writerFixture(t)
	put(t, w.Dir, "head.json", `{"version":1,"epoch":4,"generation":7,"generation":8}`)
	if r := handle(w, "authorize", "42", ""); r.Failure != StateUnavailable {
		t.Fatal(r)
	}
	assertCalls(t, h)
}
func TestWriterSerializesAcrossInstances(t *testing.T) {
	w, h := writerFixture(t)
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":4,"ids":[{"id":"42"},{"id":"43"}]}`)
	var wg sync.WaitGroup
	out := make([]Reply, 30)
	for i := range out {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			id := "42"
			name := "carol"
			if i%2 == 1 {
				id = "43"
				name = "dave"
			}
			out[i] = handle(w, "ensure", id, name)
		}(i)
	}
	wg.Wait()
	for _, r := range out {
		if r.Route == nil {
			t.Fatal(r)
		}
	}
	if len(h.steps) != 10 {
		t.Fatal(h.steps)
	}
	// Regardless of interleaving, each ID is paired only with its own name/UID.
	h.mu.Lock()
	calls := append([]hostCall(nil), h.calls...)
	h.mu.Unlock()
	if len(calls) != 7*2+28*2 { // each ensure rechecks under the ledger lock
		t.Fatalf("unexpected call count: %d", len(calls))
	}
	for _, c := range calls {
		if c.provider != "github" || c.id == "42" && (c.username != "carol" || c.uid != out[0].Route.UID) || c.id == "43" && (c.username != "dave" || c.uid != out[1].Route.UID) || c.id != "42" && c.id != "43" {
			t.Fatalf("crossed executor identity: %+v", c)
		}
	}
	if out[0].Route.UID == out[1].Route.UID {
		t.Fatal("uid collision")
	}
}
func TestWriterRenamedAndRevokedSubjectsNeverCross(t *testing.T) {
	w, h := writerFixture(t)
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":4,"ids":[{"id":"42"},{"id":"43"}]}`)
	if r := handle(w, "ensure", "42", "carol"); r.Route == nil {
		t.Fatal(r)
	}
	if r := handle(w, "ensure", "43", "dave"); r.Route == nil {
		t.Fatal(r)
	}
	want := append(provisionCalls("42", "carol", 2100), provisionCalls("43", "dave", 2101)...)
	// A changed login, including one matching another binding, is not authority.
	if r := handle(w, "ensure", "42", "dave"); r.Route == nil || r.Route.Username != "carol" {
		t.Fatal(r)
	}
	want = append(want, hostCall{"verify", "github", "42", "carol", 2100}, hostCall{"verify", "github", "42", "carol", 2100})
	assertCalls(t, h, want...)
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":5,"ids":[{"id":"43"}]}`)
	if r := handle(w, "authorize", "42", ""); r.Failure != Denied {
		t.Fatal(r)
	}
	assertCalls(t, h, want...)
	if r := handle(w, "authorize", "43", ""); r.Route == nil || r.Route.UID != 2101 {
		t.Fatal(r)
	}
	want = append(want, hostCall{"verify", "github", "43", "dave", 2101})
	assertCalls(t, h, want...)
}

func TestWriterNoImplicitProductionOwnerOverride(t *testing.T) {
	w, _ := writerFixture(t)
	w.owner = 0
	if os.Getuid() != 0 {
		if r := handle(w, "ensure", "42", "carol"); r.Failure != StateUnavailable {
			t.Fatal(r)
		}
	}
	w, _ = writerFixture(t)
	w.Executor = nil
	if r := handle(w, "ensure", "42", "carol"); r.Failure != StateUnavailable {
		t.Fatal(r)
	}
}

func TestWriterRevocationDuringMutationLeavesJournal(t *testing.T) {
	w, h := writerFixture(t)
	h.onStep = func(p string) {
		if p == "account" {
			put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":5,"ids":[]}`)
		}
	}
	r := handle(w, "ensure", "42", "carol")
	if r.Failure != StateUnavailable || fileAbsent(filepath.Join(w.Dir, "pending.json")) {
		t.Fatal(r)
	}
	assertCalls(t, h, hostCall{"account", "github", "42", "carol", 2100})
	b, e := os.ReadFile(filepath.Join(w.Dir, "bindings.json"))
	if e != nil {
		t.Fatal(e)
	}
	var l ledgerFile
	if json.Unmarshal(b, &l) != nil || len(l.Bindings) != 0 {
		t.Fatal(string(b))
	}
}
func TestWriterAlternateAndUIDPool(t *testing.T) {
	w, h := writerFixture(t)
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":5,"ids":[{"id":"42","alternate":"safe_name"}]}`)
	h.occupied["alice"] = true
	h.occupied["bob"] = true
	h.uids[2100] = true
	r := handle(w, "ensure", "42", "bob")
	if r.Route == nil || r.Route.Username != "safe_name" || r.Route.UID != 2101 {
		t.Fatal(r)
	}
	assertCalls(t, h, provisionCalls("42", "safe_name", 2101)...)
}
func TestWriterUnsafeStateAndInterruptedPublication(t *testing.T) {
	for _, name := range []string{"pending.json", "pending.json.next", "bindings.json.next", "head.json.next"} {
		t.Run(name, func(t *testing.T) {
			w, _ := writerFixture(t)
			put(t, w.Dir, name, "{}")
			if r := handle(w, "ensure", "42", "carol"); r.Failure != StateUnavailable {
				t.Fatal(r)
			}
		})
	}
	w, _ := writerFixture(t)
	if e := os.Chmod(w.Dir, 0755); e != nil {
		t.Fatal(e)
	}
	if r := handle(w, "ensure", "42", "carol"); r.Failure != StateUnavailable {
		t.Fatal(r)
	}
}

func TestWriterRestartAtEveryJournalPhase(t *testing.T) {
	for _, phase := range append([]string{"reserved", "verify", "publish"}, phases...) {
		t.Run(phase, func(t *testing.T) {
			w, _ := writerFixture(t)
			put(t, w.Dir, "pending.json", string(marshal(journal{Version: 1, ID: "42", Username: "carol", UID: 2100, Epoch: 4, Generation: 7, Phase: phase})))
			paths := []string{"pending.json", "bindings.json", "head.json"}
			original := make(map[string][]byte, len(paths))
			for _, path := range paths {
				var err error
				original[path], err = os.ReadFile(filepath.Join(w.Dir, path))
				if err != nil {
					t.Fatal(err)
				}
			}
			// Model a broker restart with a new Writer over the same test directory.
			// Neither authorization nor a fresh ensure repairs a partial
			// journal, even when the executor would otherwise be available.
			restarted := NewWriter(w.Dir, 2100, 2102, w.Executor)
			restarted.owner = w.owner
			for _, op := range []string{"authorize", "ensure"} {
				name := "carol"
				if op == "authorize" {
					name = ""
				}
				if r := handle(restarted, op, "42", name); r.Failure != StateUnavailable || r.Route != nil {
					t.Fatal(op, r)
				}
			}
			for _, path := range paths {
				got, err := os.ReadFile(filepath.Join(w.Dir, path))
				if err != nil || !bytes.Equal(got, original[path]) {
					t.Fatal("mutated on restart", path, err)
				}
			}
			if len(w.Executor.(*fakeHost).calls) != 0 {
				t.Fatal("executor called with pending journal")
			}
			// Only the isolated test fixture removes its synthetic marker. With
			// identical state and writer, a normal ensure must now succeed; this
			// rules out a vacuous unavailable result from an invalid fixture.
			if err := os.Remove(filepath.Join(w.Dir, "pending.json")); err != nil {
				t.Fatal(err)
			}
			if r := handle(restarted, "ensure", "42", "carol"); r.Route == nil || r.Route.UID != 2100 {
				t.Fatal("control ensure unavailable", r)
			}
		})
	}
}

func TestWriterLockWaitCancellationAndDeadline(t *testing.T) {
	w, h := writerFixture(t)
	holder, err := unix.Open(w.Dir, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer unix.Close(holder)
	if err := unix.Flock(holder, unix.LOCK_EX|unix.LOCK_NB); err != nil {
		t.Fatal(err)
	}
	defer unix.Flock(holder, unix.LOCK_UN)
	for _, tc := range []struct {
		name string
		ctx  func() (context.Context, context.CancelFunc)
	}{
		{"deadline", func() (context.Context, context.CancelFunc) {
			return context.WithTimeout(context.Background(), 40*time.Millisecond)
		}},
		{"canceled", func() (context.Context, context.CancelFunc) {
			ctx, cancel := context.WithCancel(context.Background())
			cancel()
			return ctx, cancel
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := tc.ctx()
			defer cancel()
			start := time.Now()
			if r := w.Handle(ctx, request("ensure", "42", "carol")); r.Failure != StateUnavailable {
				t.Fatal(r)
			}
			if time.Since(start) > time.Second {
				t.Fatal("lock wait ignored cancellation")
			}
			if len(h.steps) != 0 || !fileAbsent(filepath.Join(w.Dir, "pending.json")) {
				t.Fatal("mutated while waiting")
			}
		})
	}
	unix.Flock(holder, unix.LOCK_UN)
	if r := handle(w, "ensure", "42", "carol"); r.Route == nil {
		t.Fatal("lock not reusable", r)
	}
}

func TestEnsureActivationFailsClosedAndExplicitRetry(t *testing.T) {
	w, h := writerFixture(t)
	h.readyErr = true
	h.routeErr = true
	if r := handle(w, "ensure", "42", "carol"); r.Route != nil || r.Failure != StateUnavailable {
		t.Fatal(r)
	}
	if !fileAbsent(filepath.Join(w.Dir, "pending.json")) {
		t.Fatal("committed binding left pending")
	}
	b, err := os.ReadFile(filepath.Join(w.Dir, "bindings.json"))
	if err != nil || !bytes.Contains(b, []byte(`"username":"carol"`)) {
		t.Fatal("binding lost", err)
	}
	if r := handle(w, "authorize", "42", ""); r.Route != nil || r.Failure != StateUnavailable {
		t.Fatal("inactive socket routable", r)
	}
	h.readyErr = false
	h.routeErr = false
	if r := handle(w, "ensure", "42", "renamed"); r.Route == nil || r.Route.UID != 2100 {
		t.Fatal("explicit retry refused", r)
	}
	want := hostCall{"ready", "github", "42", "carol", 2100}
	if !reflect.DeepEqual(h.readyCalls, []hostCall{want, want}) {
		t.Fatal("ensure activation identity", h.readyCalls)
	}
	if !reflect.DeepEqual(h.routeCalls, []hostCall{{"route-ready", "github", "42", "carol", 2100}, {"route-ready", "github", "42", "carol", 2100}}) {
		t.Fatal("authorize route identity", h.routeCalls)
	}
}
func TestEnsureActivationRevocationRace(t *testing.T) {
	w, h := writerFixture(t)
	h.onReady = func() { put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":5,"ids":[]}`) }
	if r := handle(w, "ensure", "42", "carol"); r.Route != nil {
		t.Fatal("revoked route returned", r)
	}
	if r := handle(w, "authorize", "42", ""); r.Failure != Denied {
		t.Fatal(r)
	}
}
