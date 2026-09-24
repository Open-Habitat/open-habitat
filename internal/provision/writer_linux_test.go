//go:build linux

package provision

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

type fakeHost struct {
	mu        sync.Mutex
	occupied  map[string]bool
	uids      map[uint32]bool
	steps     []string
	fail      string
	verifyErr bool
	onStep    func(string)
}

func (h *fakeHost) Available(_ context.Context, n string, u uint32) (bool, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.fail == "available" {
		return false, errors.New("injected")
	}
	return !h.occupied[n] && !h.uids[u], nil
}
func (h *fakeHost) Step(_ context.Context, p, n string, u uint32) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.fail == p {
		return errors.New("injected")
	}
	h.steps = append(h.steps, p)
	if h.onStep != nil {
		h.onStep(p)
	}
	if p == "account" {
		h.occupied[n] = true
		h.uids[u] = true
	}
	return nil
}
func (h *fakeHost) Verify(_ context.Context, n string, u uint32) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.fail == "verify" || h.verifyErr || !h.occupied[n] || !h.uids[u] {
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
	if r = handle(w, "ensure", "42", "renamed"); r.Route == nil || r.Route.Username != "carol" || len(h.steps) != 5 {
		t.Fatal(r, h.steps)
	}
	if r = handle(w, "authorize", "42", ""); r.Route == nil {
		t.Fatal(r)
	}
	h.verifyErr = true
	if r = handle(w, "authorize", "42", ""); r.Failure != Drift {
		t.Fatal(r)
	}
	h.verifyErr = false
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":5,"ids":[]}`)
	if r = handle(w, "ensure", "42", "carol"); r.Failure != Denied {
		t.Fatal(r)
	}
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":4,"ids":[{"id":"42"}]}`)
	if r = handle(w, "authorize", "42", ""); r.Failure != StateUnavailable {
		t.Fatal("epoch rollback", r)
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
			h.fail = ""
			if r = handle(w, "ensure", "42", "carol"); r.Failure != StateUnavailable {
				t.Fatal("retried pending", r)
			}
			if r = handle(w, "authorize", "42", ""); r.Failure != StateUnavailable {
				t.Fatal(r)
			}
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
		})
	}
	w, _ := writerFixture(t)
	put(t, w.Dir, "head.json", `{"version":1,"epoch":4,"generation":7,"generation":8}`)
	if r := handle(w, "authorize", "42", ""); r.Failure != StateUnavailable {
		t.Fatal(r)
	}
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
	if out[0].Route.UID == out[1].Route.UID {
		t.Fatal("uid collision")
	}
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
			if r := handle(w, "ensure", "42", "carol"); r.Failure != StateUnavailable {
				t.Fatal(r)
			}
			if r := handle(w, "authorize", "42", ""); r.Failure != StateUnavailable {
				t.Fatal(r)
			}
		})
	}
}
