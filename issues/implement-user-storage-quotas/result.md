# Implementation in progress — quota admission slice

This worker added a Linux quota reader and changed production clone admission to check the daemon's own effective UID quota plus actual filesystem free blocks. This removes the separate `~/src` mount and 20 GiB / 5 GiB admission policy. It does **not** provision a quota or expose quota administration, so it must not be deployed as a completed replacement for the old policy. On filesystems without an active readable quota clone admission fails closed. Kernel EDQUOT remains the final bound when a remote repository grows after admission.

The quota reader selects only the block-backed ext4 `/home` or root mount from `/proc/self/mountinfo`, checks the device identity against `/home`, and passes that kernel-selected device to `quotactl`. Hard limits use 1024-byte quota blocks; current usage is already bytes. Its set operation requires an aligned 1 MiB–1 PiB limit and reads back the effective hard limit. Root broker integration is **not yet done**; this primitive must not be presented as an administration API.

Adopted the preserved previous worker's boundary inspection. This retry removes discovery's mounted-source capacity check: workspace visibility no longer depends on a separately mounted `~/src` staying below 20 GiB. The native path, ownership, symlink and race checks remain. This is a limited, independently useful slice, **not** quota enforcement. The issue remains open.

## Remaining work

- The root broker still permits only `ensure`, `authorize`, `lookup`, `list`; add validated bound-user quota read/set operations, selecting the committed UID rather than a client path or UID. Apply a validated gateway-provided default quota during the journaled account-creation flow before publishing a binding, and fail closed when quota setup fails.
- Add the gateway's durable default-limit setting, shared browser/root-CLI writer, per-bound-user usage and limit reads and limit mutation, filesystem capacity/free space and overcommit warning. Native quota state must remain the only limit/usage record.
- Clone admission now uses an own-UID quota check and fails closed on unreadable quotas. Still surface an understandable full-quota explanation and personal usage/limit. Do not claim a remote Git repository's eventual size can be known in advance: kernel enforcement is final.
- Update browser, documentation and tests across the remaining boundaries. The live acceptance criteria remain unchecked.

## Fleetrepo deployment prerequisite — not deployed

A separate Fleetrepo Taskfleet worker (`01m4qdwvbxz4gs3qzx6v2qr7z6`) was delegated the guest journaled quota setup, image removal and stale release guards. Its result and commit must be checked before claiming this prerequisite completed.

On the disposable test installation enable ext4 journaled user quotas (`tune2fs -O quota`) on the filesystem holding `/home`, verify quota support is active after reboot, configure the gateway's initial default quota, and stop creating/mounting per-user `~/src` images in `infra/native-agent-host-test/src_volume.py`. Then prove kernel `EDQUOT` for Git, Pi and a shell across each user's whole home and verify read/write/admin UI and CLI behavior. No existing image migration is required; no deployment or live verification was performed by this worker.

## Decisions for review

Chose byte values on the application wire and 1024-byte-aligned limit values for Linux quota hard-limit blocks; a zero hard limit is unusable (Linux interprets it as unlimited). Default size and UI layout remain for the next slice. Quota addressing via `quotactl` uses the host-controlled home filesystem, not a browser-supplied path; the broker must select the UID from the committed binding.

## Evidence and limits

The source-based discovery check and a synthetic large-filesystem regression test establish the removal of the size exclusion; the test runs on a >20 GiB filesystem but not on a distinct mounted `~/src` (that host behavior still needs a synthetic mount or guest test). Focused Go tests passed: `TMPDIR=/var/tmp/nah-quota-retry go test ./internal/daemon -run 'TestDiscovery(OnLargeFilesystem|StatesAndFacts|BoundsMountAndRace)' -count=1 -v`. The first focused run failed because the new assertion used `ok` instead of discovery's actual `present` state; the corrected run passed.

The final clean gate passed on committed product revision `2ef905bf430b4aeed92911249532ec2b65d7f4c3`: `TMPDIR=/var/tmp/nah-quota-retry PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright NAH_PORT_BASE=16370 NPM_CONFIG_OFFLINE=true ./scripts/ci-local.sh --clean --json` returned `status: passed, clean: true` (620 s). The preceding attempt stopped at npm dependency download due to network `ETIMEDOUT`; populating the ignored worktree npm cache and running offline resolved it. The gate did not require runnable changes. `issuectl doctor --json` and `python3 scripts/validate-project-view.py` passed; existing doctor advisories were not introduced by this slice. The post-gate change to this result is evidence-only, so the gate was not rerun.

Final-diff self-review was proportionate to this nonprivileged, four-line deletion and focused regression: `scan` still opens `src` without following symlinks, checks home ownership and entry identity, and refuses unsafe paths and races. No broker, quota syscall or administrator authorization code changed, so the requested independent privileged final-diff review is deferred to the remaining privileged slice. The test does not exercise a separate mounted source. No claim about quota enforcement, distinct-UID isolation or live deployment is made.
