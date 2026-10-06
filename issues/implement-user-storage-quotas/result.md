# Implementation in progress — first slice

Adopted the preserved previous worker's boundary inspection. This retry removes discovery's mounted-source capacity check: workspace visibility no longer depends on a separately mounted `~/src` staying below 20 GiB. The native path, ownership, symlink and race checks remain. This is a limited, independently useful slice, **not** quota enforcement. The issue remains open.

## Remaining work

- The root broker still permits only `ensure`, `authorize`, `lookup`, `list`; add validated bound-user quota read/set operations, selecting the committed UID rather than a client path or UID. Apply a validated gateway-provided default quota during the journaled account-creation flow before publishing a binding, and fail closed when quota setup fails.
- Add the gateway's durable default-limit setting, shared browser/root-CLI writer, per-bound-user usage and limit reads and limit mutation, filesystem capacity/free space and overcommit warning. Native quota state must remain the only limit/usage record.
- Replace `boundedCloneVolume` with an own-UID quota admission check in the daemon; fail closed on unreadable quotas, surface a full-quota explanation, and show personal usage/limit. Do not claim a remote Git repository's eventual size can be known in advance: kernel enforcement is final.
- Update browser, documentation and tests across the remaining boundaries. The live acceptance criteria remain unchecked.

## Fleetrepo deployment prerequisite — not deployed

On the disposable test installation enable ext4 journaled user quotas (`tune2fs -O quota`) on the filesystem holding `/home`, verify quota support is active after reboot, configure the gateway's initial default quota, and stop creating/mounting per-user `~/src` images in `infra/native-agent-host-test/src_volume.py`. Then prove kernel `EDQUOT` for Git, Pi and a shell across each user's whole home and verify read/write/admin UI and CLI behavior. No existing image migration is required; no deployment or live verification was performed by this worker.

## Decisions for review

None taken in this slice. Quota addressing via `quotactl` must use the host-controlled home filesystem and the bound UID, not a browser-supplied path. Choose validated quota units/granularity and test them before committing the broker slice.

## Evidence and limits

The source-based discovery check and a synthetic large-filesystem regression test establish the removal of the size exclusion; the test runs on a >20 GiB filesystem but not on a distinct mounted `~/src` (that host behavior still needs a synthetic mount or guest test). Focused Go tests passed: `TMPDIR=/var/tmp/nah-quota-retry go test ./internal/daemon -run 'TestDiscovery(OnLargeFilesystem|StatesAndFacts|BoundsMountAndRace)' -count=1 -v`. The first focused run failed because the new assertion used `ok` instead of discovery's actual `present` state; the corrected run passed. Clean gate result and final-diff review are recorded below when available. No claim about quota enforcement, distinct-UID isolation or live deployment is made.
