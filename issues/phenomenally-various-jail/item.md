---
created: 2026-10-21
updated: 2026-10-25
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m5eg8e8gzn1wncxd51ves1jj/observed-browser-test-races
originating_run: 01m5eg8e8gzn1wncxd51ves1jj
originating_run_kind: spinoff
closed: 2026-10-21
---

# Browser tests race background reads and in-flight routes

## Description

## Description

Host-backed synthetic browser checks intermittently fail in `web/tests/server-version-reload.spec.ts` and `web/tests/reconnect-recovery.spec.ts` because the tests advance to the next operation while earlier reads/restarts are still in flight. These failures make the whole ordinary suite unreliable even when the wording-cleanup changes are unrelated. Observed during taskfleet run `01m5eg8e8gzn1wncxd51ves1jj` on base `d71151f1`; both files' experimental fixes were reverted before landing the wording task.

## Reproduction

On the normal Cedar route, run `cd web && npx playwright test server-version-reload.spec.ts reconnect-recovery.spec.ts --repeat-each 10 --workers=4`. Both tests have also failed inside the whole ordinary suite. Local diagnostic logs are `/var/tmp/wording-browser-ordinary.log`, `/var/tmp/wording-verified-ordinary.log`, `/var/tmp/wording-races.log`, and `/var/tmp/wording-complete-races.log` on Alder. Synthetic traces were fetched through the existing pinned warm route and inspected with `scripts/inspect-trace.sh`.

- Release test: it sometimes observes the new server version but still has bundle-state=current. `/fixture/upgrade` acknowledges before the replacement gateway/listener serves the new index. Restarting just after remounting the server section can also interrupt its initial administration/storage requests, leaving an error view rather than a version row. Merely waiting for an index response is insufficient when `checkBundle` coalesces an already-running read.
- Explicit reconnect after daemon restart: removing the simulated snapshot/events outage before the refresh generation has finished starting allows a 409 epoch response to trigger automatic resnapshot/recovery. The retry button detaches, or is still pending when the test tries to click it. In one 10-repeat four-spec run, three such reconnect cases failed.
- Uncertain creation recheck: a still-running reload/recheck list read can succeed as soon as the route is removed; the second recheck button then detaches before click. One such case failed in each of two 10-repeat runs.

These are observed test synchronization failures, not evidence that the live reconnect defect is fixed or caused by these seams. The existing live-product issue remains separate.

## Acceptance Criteria

- [x] Synchronize the synthetic restart/outage and distinct user-triggered reads without removing cases, weakening behavior assertions, adding sleeps, or increasing timeouts.
- [x] The two specs pass repeated runs and the whole ordinary suite once via Cedar.

## Implementation notes

A trial response-drain implementation that called `Response.finished()` on mocked 503 replies hung in all affected cases; response headers/statuses were visible in the trace but completion promises did not settle. Synchronizing actual response generations needs care rather than another blanket completion wait. No experimental reconnect/release-test edits are retained in the wording-cleanup delivery.

## Additional occurrence in final validation

On the final wording-cleanup tree (with both experimental release/reconnect edits reverted), `cd web && npx playwright test` failed 2 cases / passed 299 / skipped the 3 capture-only cases (146 s command). The release test again lost its version row during restart. `web/tests/mutation-layer.spec.ts:163` also failed with `route.abort: Route is already handled!` at line 171: its handler awaits `route.fetch()` before aborting the reply, while the test can already progress through the optimistic archive and navigate. This is another observed in-flight-route lifecycle race; ensure the route handler settles before navigation/unroute. Log: `/var/tmp/wording-delivery-ordinary.log`. Lab (62), shell repeat (90), and fast web (471) all passed on this same final tree; the required whole ordinary check remains a blocker, not a green result.

## Resolution

### 2026-10-21T07:40:12Z · @issuectl

Preserved read/restart/recovery synchronization retained; final whole ordinary and lab suites pass on the integrated tree. See result.md.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
