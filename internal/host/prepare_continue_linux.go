//go:build linux

package host

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"

	policy "github.com/open-habitat/open-habitat"
	"github.com/open-habitat/open-habitat/internal/storagequota"
	"golang.org/x/sys/unix"
)

// Only the post-probe session restart is replayable. All other policy bytes
// must already match, the probe must be gone with original kernel limits, and
// both durable copies of the intent must agree. No broker state is repaired.
func prepareContinuation(ctx context.Context, s Site, src prepareSources) (Operation, ProbeEvidence, error) {
	var o Operation
	var ev ProbeEvidence
	fail := func() (Operation, ProbeEvidence, error) { return o, ev, ErrRecovery }
	fd, err := openDir(src.inspect.journal, src.inspect.owner, true)
	if err != nil {
		return fail()
	}
	defer unix.Close(fd)
	b, err := readPrivateAt(fd, "active.json", src.inspect.owner)
	if err != nil || decodeOperation(b, &o) != nil || o.Kind != "prepare" || o.Status != "running" || o.Phase != "session_restarting" || o.Target != s.Release {
		return fail()
	}
	l := &Lock{fd: fd, owner: src.inspect.owner}
	if l.matchReceipt(o) != nil {
		return fail()
	}
	for _, name := range []string{"active.json.next", o.ID + ".json.next", o.ID + "-probe.json.next", o.ID + "-preparation.json.next"} {
		var st unix.Stat_t
		if unix.Fstatat(fd, name, &st, unix.AT_SYMLINK_NOFOLLOW) != unix.ENOENT {
			return fail()
		}
	}
	if s.Storage.EnforceUserQuota {
		b, err = readPrivateAt(fd, o.ID+"-probe.json", src.inspect.owner)
		if err != nil || strictJSON(b) != nil || json.Unmarshal(b, &ev) != nil || ev.SchemaVersion != 1 || ev.OperationID != o.ID || !ev.EDQUOT || !ev.Cleaned || ev.Directory != ".open-habitat-probe-"+o.ID {
			return fail()
		}
		home, err := openDir(src.home, src.inspect.owner, false)
		if err != nil {
			return fail()
		}
		defer unix.Close(home)
		var st unix.Stat_t
		if unix.Fstatat(home, ev.Directory, &st, unix.AT_SYMLINK_NOFOLLOW) != unix.ENOENT {
			return fail()
		}
		if src.root == "/" && storagequota.VerifyProbeCleanupFD(home, ev.Reservation) != nil {
			return fail()
		}
	} else {
		// A preparation without user quotas never probes; a probe record
		// means this intent was not that preparation.
		var st unix.Stat_t
		if unix.Fstatat(fd, o.ID+"-probe.json", &st, unix.AT_SYMLINK_NOFOLLOW) != unix.ENOENT {
			return fail()
		}
	}
	ps, err := src.policies(ctx, s)
	if src.root == "/" {
		ps, err = nativePreparePolicies(ctx, s)
	}
	if err != nil {
		return fail()
	}
	legacy := strings.ReplaceAll(policy.ProcService, "gid=@PROC_GID@", "gid=open-habitat-proc")
	legacy = strings.ReplaceAll(legacy, "# host prepare renders @PROC_GID@ from the validated native exemption group.\n", "")
	for _, p := range ps {
		got, err := policyBytes(src.root, p, src.inspect.owner)
		if err != nil || got.Mode != 0644 {
			return fail()
		}
		if got.Content != p.Content && !(p.Path == "/etc/systemd/system/open-habitat-proc.service" && got.Content == legacy) {
			return fail()
		}
		// installPolicy can finish a complete same-input policy publication.
		// The published predecessor must independently match above; a stage
		// never authorizes adopting foreign live bytes or journal state.
		staged, err := policyBytes(src.root, policyFile{Path: p.Path + ".next"}, src.inspect.owner)
		if err == nil {
			if staged.Content != p.Content || staged.Mode != 0644 {
				return fail()
			}
		} else if !errors.Is(err, os.ErrNotExist) {
			return fail()
		}
	}
	return o, ev, nil
}
