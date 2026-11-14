//go:build linux

package host

import "testing"

func TestUpgradeSessionActive(t *testing.T) {
	for _, state := range []string{"idle", "stopped", "failed", "start_failed"} {
		t.Run(state, func(t *testing.T) {
			if upgradeSessionActive(state) {
				t.Fatalf("settled state %q counted as an active turn", state)
			}
		})
	}
	for _, state := range []string{"running", "starting", "streaming", "unknown", "", "future_state"} {
		t.Run(state, func(t *testing.T) {
			if !upgradeSessionActive(state) {
				t.Fatalf("unsettled or unfamiliar state %q must count as active", state)
			}
		})
	}
}

func TestUpgradeSettledTurnsStillRequireInterruptionConsent(t *testing.T) {
	for _, observable := range []bool{true, false} {
		if !interruptionRequired([]upgradeUser{{Daemon: true, TurnsObservable: observable, ActiveTurns: 0}}) {
			t.Fatalf("live daemon must require consent even with no reported active turns (observable=%v)", observable)
		}
	}
}
