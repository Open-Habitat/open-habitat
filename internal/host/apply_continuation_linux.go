//go:build linux

package host

import (
	"context"
	"errors"
	"os"
	"path/filepath"

	"golang.org/x/sys/unix"
)

func lateApplyPhase(phase string) bool {
	return phase == "converging" || phase == "verifying" || phase == "verified"
}

// A successor may finish only an already activated apply. Reconstruct the old
// binding from its trusted installed executable, without changing the intent.
// Earlier phases still require the original product: publication may be partial.
// Called only by the driver's binding callback while executeApply holds flock;
// the second descriptor below is a read handle, not another lock acquisition.
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
	if e = n.closeEntries(ctx); e != nil {
		return e
	}
	if e = repairGatewayUnit(ctx, n.site); e != nil {
		return e
	}
	// A late resume skips staging, so an apply begun by a binary that
	// predates this file would otherwise never pass verification.
	if e = installPolicy("/", needrestartOverride, 0); e != nil {
		return e
	}
	if e = verifyInstalledUnits(ctx, n.site); e != nil {
		return e
	}
	if _, e = nativeCommand(ctx, "/usr/bin/systemctl", "reset-failed", "open-habitat-gateway.service", "open-habitat-revoke.socket"); e != nil {
		return e
	}
	if _, e = nativeCommand(ctx, "/usr/bin/systemctl", "start", "open-habitat-broker.service", "open-habitat-revoke.socket"); e != nil {
		return e
	}
	// Even a still-running predecessor must acquire the reloaded capability
	// policy. A later exact completed retry bypasses recovery entirely.
	_, e = nativeCommand(ctx, "/usr/bin/systemctl", "restart", "open-habitat-gateway.service")
	return e
}

func earlyApplyPhase(phase string) bool {
	return phase == "started" || phase == "quiescing" || phase == "staging"
}

// A running apply that stopped before its generation was published has done
// only what every fresh apply repeats: closed HTTP entry, met Ubuntu minimums
// and a removed private stage. A successor release may continue that same
// operation under a fresh approval of the corrected inputs (an earlier release
// failed EXDEV here when /var was a separate filesystem). The phase alone is
// not evidence; nothing published or initialized may exist, so a fence left
// after publication, initialization or on an installed host stays closed.
// root is "/" except in tests.
func applyPrepublicationContinuation(journal string, owner uint32, root string) (Operation, error) {
	var o Operation
	fd, e := openDir(journal, owner, true)
	if e != nil {
		return o, ErrRecovery
	}
	defer unix.Close(fd)
	b, e := readPrivateAt(fd, "active.json", owner)
	if e != nil || decodeOperation(b, &o) != nil || o.Kind != "apply" || o.Status != "running" || !earlyApplyPhase(o.Phase) {
		return o, ErrRecovery
	}
	l := &Lock{fd: fd, owner: owner}
	if l.matchReceipt(o) != nil {
		return o, ErrRecovery
	}
	for _, name := range []string{"active.json.next", o.ID + ".json.next", o.ID + "-apply.json.next", "installation.json", "installation.json.next"} {
		var st unix.Stat_t
		if unix.Fstatat(fd, name, &st, unix.AT_SYMLINK_NOFOLLOW) != unix.ENOENT {
			return o, ErrRecovery
		}
	}
	for _, path := range []string{"/opt/open-habitat/current", "/opt/open-habitat/current.next", "/opt/open-habitat/core", "/opt/open-habitat/core.next", "/opt/open-habitat/pi-runtime.json", "/opt/open-habitat/site-origin.json", "/opt/open-habitat/editor.json", "/var/lib/open-habitat/broker", "/var/lib/open-habitat/.broker-initialize", "/etc/open-habitat/gateway/gateway.json"} {
		if _, e := os.Lstat(filepath.Join(root, path)); !errors.Is(e, os.ErrNotExist) {
			return o, ErrRecovery
		}
	}
	for _, path := range []string{generationParent, "/opt/open-habitat/profiles"} {
		path = filepath.Join(root, path)
		st, e := os.Lstat(path)
		if errors.Is(e, os.ErrNotExist) {
			continue
		}
		if e != nil || !st.IsDir() {
			return o, ErrRecovery
		}
		entries, e := os.ReadDir(path)
		if e != nil || len(entries) != 0 {
			return o, ErrRecovery
		}
	}
	return o, nil
}
