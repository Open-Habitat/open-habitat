//go:build linux

package host

import (
	"context"
	"golang.org/x/sys/unix"
)

func lateApplyPhase(phase string) bool {
	return phase == "converging" || phase == "verifying" || phase == "verified"
}

// A successor may finish only an already activated apply. Reconstruct the old
// binding from its trusted installed executable, without changing the intent.
// Earlier phases still require the original product: publication may be partial.
func applyContinuationBinding(ctx context.Context, path, approval, journal string, owner uint32, current, installed func(context.Context, string) (string, error)) (string, error) {
	binding, e := current(ctx, path)
	if e != nil {
		return "", e
	}
	fd, e := openDir(journal, owner, true)
	if e != nil {
		return binding, nil
	}
	defer unix.Close(fd)
	b, e := readPrivateAt(fd, "active.json", owner)
	var o Operation
	if e != nil || decodeOperation(b, &o) != nil || o.Kind != "apply" || o.PlanID != approval || !(lateApplyPhase(o.Phase) || o.Phase == "completed" && o.Status == "completed") {
		return binding, nil
	}
	l := &Lock{fd: fd, owner: owner}
	if l.matchReceipt(o) != nil || l.applyIntentMatches(o, binding) {
		return binding, nil
	}
	old, e := installed(ctx, path)
	if e != nil || !l.applyIntentMatches(o, old) {
		return binding, nil
	}
	return old, nil
}

// Do not reseed, republish generations or replay apt on late-phase recovery.
// Recheck every installed structural postcondition before starting listeners.
func (n *nativeApply) recoverGateway(ctx context.Context) error {
	if !gatewayConfigurationMatches(n.site) {
		return ErrNativeApply
	}
	r, e := loadRelease(n.site)
	if e != nil {
		return e
	}
	if e = generationMatches(ctx, n.site, r); e != nil {
		return e
	}
	if e = verifyInstalledUnits(ctx, n.site); e != nil {
		return e
	}
	if e = n.closeEntries(ctx); e != nil {
		return e
	}
	if _, e = nativeCommand(ctx, "/usr/bin/systemctl", "reset-failed", "open-habitat-gateway.service", "open-habitat-revoke.socket"); e != nil {
		return e
	}
	if _, e = nativeCommand(ctx, "/usr/bin/systemctl", "start", "open-habitat-broker.service", "open-habitat-revoke.socket", "open-habitat-gateway.service"); e != nil {
		return e
	}
	return nil
}
