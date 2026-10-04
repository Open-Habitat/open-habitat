---
created: 2026-10-04
updated: 2026-10-04
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: taskfleet:01m427s47pbwfvjag70kdbhy8z
lane: release-tooling
lane_seq: 10
---

# Release tooling friction found during the pilot.18 release

## Problem

The pilot.18 release on 2026-10-04 required several ad hoc corrections to
packaging and verification commands. The release completed only after those
corrections and a separate source-volume expansion. Future releases should
use a shared release procedure and checks that already handle these cases.

The work belongs primarily in Fleetrepo's `infra/native-agent-host-test/`,
which owns the test-server operators and `RELEASE-UPGRADE.md`. Some failures
came from temporary scripts written for this particular run. Choose which
corrections belong in reusable helpers and which are best explained in the
release guide; the temporary wrappers themselves are not a required design.

## Remaining work

Source-volume headroom was checked too late: the product had been switched
before `src_volume.py verify` found only 2.48 GB free on the 12 GiB volume,
below its 5 GiB admission floor. Fleetrepo has since added the growth operator,
expanded the volume to 20 GiB and verified it successfully. The remaining
release-workflow problem is discovering insufficient headroom before the
switch and directing the operator to the existing remedy.

Packaging should preserve the exact clean, pushed revision that passed the
gate. During pilot.18 another session advanced `origin/main` while the gate
ran, and the temporary wrapper incorrectly treated that as a failure. Checking
that the pinned revision remains an ancestor of current `origin/main` would
preserve the source requirement without requiring other sessions to stop
pushing. The wrapper also mistook the gate log's final timing line for its
result; the authoritative result is the JSON status envelope.

The independent probes need to respect the contracts they check:

- A forwarded OAuth request uses the canonical hostname in `Host`, without
  the local forwarding port, while retaining TLS hostname verification.
- A systemd check interprets the reported enablement state against the
  expected state of that unit. The nonzero exit for `disabled` or `static`
  alone does not mean the installation is wrong.
- A daemon Unix-socket HTTP request uses `Host: unix`, as required by the
  endpoint contract.

The run also attempted to look up the removed `omega_ca_migrate.py`. The
current release guide already references `omega_route.py`; the report does
not establish a stale path in that guide. Keep route and Access verification
aligned with the current `omega_route.py` and `omega_access.py` helpers,
correcting any stale references actually found.

## Acceptance Criteria

- [ ] The shared release workflow detects insufficient source-volume headroom
  before switching releases and points to the existing volume operator.
- [ ] Packaging and gate-result handling retain the verified source revision
  when `origin/main` advances and read the gate's structured result correctly.
- [ ] Shared verification commands handle forwarded HTTP, expected systemd
  states and daemon requests correctly; the guide identifies current helpers.
- [ ] Focused tests or recorded checks demonstrate the corrected cases, with
  the changes and verification recorded in the owning repository.

## Sources

The original observations are in Taskfleet run `01m427s47pbwfvjag70kdbhy8z`
and Fleetrepo receipt commit `6a701800`. Fleetrepo's
`issues/rebuild-test-vm-first-use/result.md` records both the release and the
subsequent volume recovery; recovery commit `74f7560f` records the restored
admission and host verification. These distinguish the original failures
from the work already completed.
