---
created: 2026-10-04
updated: 2026-10-04
type: bug
reporter: jari
status: untriaged
priority: normal
provenance: chat
source_ref: taskfleet:01m427s47pbwfvjag70kdbhy8z
---

# Release tooling friction found during the pilot.18 release

## Description

## Observed

The pilot.18 release on 2026-10-04 (taskfleet run `01m427s47pbwfvjag70kdbhy8z`,
Fleetrepo receipt `6a701800`) hit several avoidable problems in the release
tooling and its documented checks. Each was worked around during the run; none
changed what was installed. They make the next release slower and easier to
get wrong.

1. **Source volume admission.** The volume operator's `src_volume.py verify`
   refuses below 5 GiB free; the 12 GiB `~/src` volume had 2.48 GB free, which
   blocked the release record although the product was live and verified. The
   release procedure had no step to check headroom before switching, and no
   documented way to grow the volume. (Jari decided to grow it; separate run.)
2. **Packaging wrapper and moving `origin/main`.** The wrapper required
   `origin/main` to stay equal to the SHA pushed at start; other sessions
   pushing during the gate made it fail. It should keep the exact start SHA and
   require only that it is an ancestor of current `origin/main`.
3. **Gate result extraction.** The wrapper read the gate's last line, which is a
   timing line, instead of parsing the JSON status envelope.
4. **Stale helper path.** The procedure still pointed at the removed
   `omega_ca_migrate.py`; the pushed `omega_route.py` and `omega_access.py`
   read-only route checks are the current ones.
5. **Forwarded OAuth check Host header.** The probe sent the local forward port
   in `Host`; it must send the canonical hostname while keeping TLS hostname
   verification.
6. **systemd probe.** `systemctl is-enabled` returns non-zero for `disabled` and
   `static`; the probe treated those documented states as failures.
7. **Daemon Unix-socket probe.** It used the wrong HTTP `Host`; the daemon's
   endpoint contract requires `Host: unix`.

## Expected

The procedure and its helpers handle these cases themselves, so a release run
spends its time on verification rather than on rediscovering them. The
operators live in Fleetrepo (`infra/native-agent-host-test/`); this issue records
the product-side view, and the fixes may land there.

## Where run reports are

A worker's terminal report is stored with its Taskfleet run, not in the
repository: `taskfleet run show <run-id> --output json | jq .data.report`
(files under `~/.taskfleet/runs/<run-id>/` on alder). Findings that should
outlive the run belong in an issue like this one.
