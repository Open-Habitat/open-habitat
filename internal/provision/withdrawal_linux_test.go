//go:build linux

package provision

import (
	"context"
	"errors"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"
)

func stops(h *fakeHost) []hostCall {
	h.mu.Lock()
	defer h.mu.Unlock()
	return append([]hostCall{}, h.stopCalls...)
}

// Withdrawal stops the committed binding's listeners after the commit, a
// repeat stops them again, and nothing else ever asks for a stop: not a
// refused withdrawal, not a never-bound id, not an admission or restore.
func TestWithdrawalStopsCommittedListeners(t *testing.T) {
	w, h := runtimeWriter(t, true)
	accessRow(t, admit(w, "50", "Newcomer", "42"))
	first := handle(w, "ensure", "50", "Newcomer")
	if first.Route == nil {
		t.Fatal(first)
	}
	if r := withdraw(w, "42", "50"); r.Failure != OperatorOwned || len(stops(h)) != 0 {
		t.Fatal("operator withdrawal reached the host", r, stops(h))
	}
	if row := accessRow(t, withdraw(w, "50", "42")); row.State != StateWithdrawn {
		t.Fatal(row)
	}
	want := hostCall{"stop-listeners", "github", "50", first.Route.Username, first.Route.UID}
	if got := stops(h); !reflect.DeepEqual(got, []hostCall{want}) {
		t.Fatalf("stop: %+v", got)
	}
	if row := accessRow(t, withdraw(w, "50", "42")); row.State != StateWithdrawn {
		t.Fatal("withdraw is not idempotent", row)
	}
	if got := stops(h); !reflect.DeepEqual(got, []hostCall{want, want}) {
		t.Fatalf("repeat did not stop again: %+v", got)
	}
	accessRow(t, admit(w, "51", "passer", "42"))
	if row := accessRow(t, withdraw(w, "51", "42")); row.State != StateRemoved {
		t.Fatal(row)
	}
	if row := accessRow(t, withdraw(w, "51", "42")); row.State != StateRemoved || len(stops(h)) != 2 {
		t.Fatal("a never-bound withdrawal stopped something", stops(h))
	}
	// Restore after a stop returns the same account; the next ensure
	// asks for the sockets again and nothing stops them.
	if row := accessRow(t, admit(w, "50", "Newcomer", "42")); row.State != StateJoined {
		t.Fatal(row)
	}
	again := handle(w, "ensure", "50", "Newcomer")
	if again.Route == nil || again.Route.UID != first.Route.UID || len(stops(h)) != 2 {
		t.Fatal("restore after stop", again, stops(h))
	}
}

// A failed stop leaves the withdrawal committed and is reported unavailable,
// which the gateway treats as uncertain and keeps its deny. The repeat
// retries only the stop; restore works whether or not a stop succeeded.
func TestWithdrawalFailedStop(t *testing.T) {
	w, h := runtimeWriter(t, true)
	accessRow(t, admit(w, "50", "Newcomer", "42"))
	if handle(w, "ensure", "50", "Newcomer").Route == nil {
		t.Fatal("ensure")
	}
	h.stopErr = true
	if r := withdraw(w, "50", "42"); r.Failure != StateUnavailable {
		t.Fatal("failed stop reported as done", r)
	}
	a := allowState(t, w.Dir)
	if len(a.Runtime) != 1 || a.Runtime[0].State != "withdrawn" {
		t.Fatalf("withdrawal not committed before the stop: %+v", a)
	}
	if r := handle(w, "authorize", "50", ""); r.Failure != Denied {
		t.Fatal("authorize after a withdrawal whose stop failed", r)
	}
	epoch := a.Epoch
	if r := withdraw(w, "50", "42"); r.Failure != StateUnavailable {
		t.Fatal(r)
	}
	h.stopErr = false
	if row := accessRow(t, withdraw(w, "50", "42")); row.State != StateWithdrawn {
		t.Fatal(row)
	}
	if allowState(t, w.Dir).Epoch != epoch || len(stops(h)) != 3 {
		t.Fatal("a repeat changed admission or skipped the stop", allowState(t, w.Dir), stops(h))
	}
	// Restore straight after a failed stop.
	accessRow(t, admit(w, "50", "Newcomer", "42"))
	h.stopErr = true
	if r := withdraw(w, "50", "42"); r.Failure != StateUnavailable {
		t.Fatal(r)
	}
	h.stopErr = false
	if row := accessRow(t, admit(w, "50", "Newcomer", "42")); row.State != StateJoined {
		t.Fatal(row)
	}
	if handle(w, "ensure", "50", "Newcomer").Route == nil {
		t.Fatal("ensure after restore following a failed stop")
	}
}

// The stop is chosen from committed state alone: an admitted, unknown or
// never-bound id stops nothing, and the startup pass stops every withdrawn
// binding and only those.
func TestWithdrawalStopTargetsOnlyWithdrawnBindings(t *testing.T) {
	w, h := runtimeWriter(t, true)
	for _, u := range []struct{ id, name string }{{"50", "erin"}, {"51", "frank"}} {
		accessRow(t, admit(w, u.id, u.name, "42"))
		if handle(w, "ensure", u.id, u.name).Route == nil {
			t.Fatal("ensure", u.id)
		}
	}
	ctx := context.Background()
	for _, id := range []string{"50", "42", "99", ""} {
		if err := w.stopWithdrawn(ctx, id, nil); err != nil || len(stops(h)) != 0 {
			t.Fatal("stopped a non-withdrawn subject", id, err, stops(h))
		}
	}
	h.stopErr = true
	withdraw(w, "50", "42")
	h.stopErr = false
	h.mu.Lock()
	h.stopCalls = nil
	h.mu.Unlock()
	reported := map[string]error{}
	if err := w.stopWithdrawn(ctx, "", func(user string, err error) { reported[user] = err }); err != nil {
		t.Fatal(err)
	}
	if got := stops(h); len(got) != 1 || got[0].id != "50" || len(reported) != 1 || reported[got[0].username] != nil {
		t.Fatal("startup pass", got, reported)
	}
	// Under admission "any" nobody is withdrawn.
	w.AdmitAny = true
	if err := w.stopWithdrawn(ctx, "", nil); err != nil || len(stops(h)) != 1 {
		t.Fatal("stopped under admission any", err, stops(h))
	}
	w.AdmitAny = false
	// A rolled-back admission file is refused, not acted on.
	put(t, w.Dir, "head.json", `{"version":1,"epoch":99,"generation":9}`)
	if err := w.stopWithdrawn(ctx, "50", nil); err == nil || len(stops(h)) != 1 {
		t.Fatal("acted on rolled-back state", err, stops(h))
	}
}

// The stop holds the activation slot, so a socket start the broker asks for
// meanwhile waits for it instead of being undone by it.
func TestWithdrawalStopHoldsActivationSlot(t *testing.T) {
	w, h := runtimeWriter(t, true)
	accessRow(t, admit(w, "50", "erin", "42"))
	if handle(w, "ensure", "50", "erin").Route == nil {
		t.Fatal("ensure")
	}
	accessRow(t, withdraw(w, "50", "42"))
	w.activation.slot <- struct{}{}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	if err := w.stopWithdrawn(ctx, "50", nil); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatal("stop did not wait for the activation slot", err)
	}
	<-w.activation.slot
	if len(stops(h)) != 1 {
		t.Fatal(stops(h))
	}
}

func TestWithdrawalStopBudget(t *testing.T) {
	ctx := context.Background()
	if commandBudget(ctx, systemctl, append([]string{"stop"}, listenerUnits("erin")...)...) != 60*time.Second {
		t.Fatal("stop budget")
	}
	if commandBudget(ctx, systemctl, append([]string{"reset-failed"}, listenerUnits("erin")...)...) != 3*time.Second {
		t.Fatal("reset-failed budget")
	}
}

// TestWithdrawalStopListenersAsRoot runs the native stop as root inside
// scripts/test-broker-boot-uids.sh's disposable container, where systemctl is
// replaced by a recorder: the stop names exactly the committed person's
// three units, starts nothing, and is done only when all are inactive.
func TestWithdrawalStopListenersAsRoot(t *testing.T) {
	if os.Getenv("PROVISION_UID_CONTAINER") != "1" {
		t.Skip("requires the disposable root container")
	}
	if os.Geteuid() != 0 {
		t.Fatal("the container proof runs as the container's root, like the broker")
	}
	i := ExecutorIdentity{provider: "github", id: "50", username: "erin", uid: 2100}
	units := listenerUnits("erin")
	for _, tc := range []struct {
		name  string
		state map[string]string
		ok    bool
	}{
		{"stopped", map[string]string{}, true},
		{"service still running", map[string]string{units[0]: "deactivating"}, false},
		{"socket failed after reset", map[string]string{units[2]: "failed"}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var ran []string
			e := NewLinuxHostExecutor(1001, 1002)
			e.run = func(_ context.Context, path string, args ...string) ([]byte, error) {
				if path != systemctl {
					t.Fatalf("ran %s", path)
				}
				ran = append(ran, strings.Join(args, " "))
				if args[0] == "show" {
					state := tc.state[args[1]]
					if state == "" {
						state = "inactive"
					}
					return []byte("ActiveState=" + state + "\n"), nil
				}
				return nil, errors.New("exit status 5")
			}
			err := e.StopListeners(context.Background(), i)
			if (err == nil) != tc.ok {
				t.Fatal(err)
			}
			want := []string{"stop " + strings.Join(units, " "), "reset-failed " + strings.Join(units, " ")}
			if !reflect.DeepEqual(ran[:2], want) {
				t.Fatalf("commands: %q", ran)
			}
			for _, c := range ran[2:] {
				if !strings.HasPrefix(c, "show open-habitat-") || !strings.Contains(c, "@erin.") {
					t.Fatalf("unexpected command %q", c)
				}
			}
		})
	}
	e := NewLinuxHostExecutor(1001, 1002)
	e.run = func(context.Context, string, ...string) ([]byte, error) {
		t.Fatal("ran a command for an invalid identity")
		return nil, nil
	}
	for _, bad := range []ExecutorIdentity{{username: "../x", uid: 2100}, {username: "erin", uid: 0}, {username: "", uid: 2100}} {
		if e.StopListeners(context.Background(), bad) == nil {
			t.Fatal("accepted", bad)
		}
	}
}

// A daemon a timed-out stop left failed must not block restore or the
// broker's startup; provisioning still sees only inactive or active units.
func TestUnitShownAcceptsFailedDaemonOnRetry(t *testing.T) {
	shown := func(state string) string {
		return "LoadState=loaded\nActiveState=" + state + "\nFragmentPath=/etc/systemd/system/x\n"
	}
	service, socket := "open-habitat-daemon@erin.service", "open-habitat-daemon@erin.socket"
	for _, tc := range []struct {
		unit, state string
		retry, ok   bool
	}{
		{service, "inactive", false, true},
		{service, "active", false, true},
		{service, "failed", false, false},
		{service, "failed", true, true},
		{service, "activating", true, false},
		{service, "deactivating", true, false},
		{socket, "failed", true, true},
		{socket, "activating", true, true},
		{socket, "failed", false, false},
	} {
		if unitShown(tc.unit, shown(tc.state), tc.retry) != tc.ok {
			t.Error(tc)
		}
	}
	if unitShown(service, "LoadState=not-found\nActiveState=inactive\nFragmentPath=/x\n", true) {
		t.Error("accepted a missing template")
	}
}

// A withdrawal waits for the stop inside ensure's exchange budget.
func TestWithdrawUsesTheLongExchange(t *testing.T) {
	for op, long := range map[string]bool{"ensure": true, "admit": true, "withdraw": true, "authorize": false, "access_read": false} {
		if longExchange(op) != long {
			t.Error(op)
		}
	}
}
