---
created: 2026-09-29
updated: 2026-10-02
type: improvement
status: done
priority: high
lane: github-clone-progress
collision: [internal/daemon/github_clone_linux.go, web/src/app/GitHubOnboarding.tsx]
closed: 2026-10-02
closed_by: claude
---

# Show truthful native Git stages during large repository checkout

## Jari's live feedback (2026-09-29)
With three selected repositories, the chooser's `Haettu 0/3` indicator stayed unchanged during a possibly large checkout, including a repository of the order of 5 GB. Jari requests stage-level progress for long imports, not a stationary overall count. Read-only observation after his `Jatka` found three newly created mapped-UID `~/src` directories, including the named large repository, and no running clone process; the browser subsequently reached Pi login. This establishes neither individual clone duration nor whether those checkout trees are complete without a separate Git/origin verification. Do not automatically re-clone or remove any existing directory.

## Concrete native limitation
Current `internal/daemon/github_clone_linux.go` synchronously waits for `git clone` (subprocess deadline 70 seconds, total request deadline 90 seconds), discards subprocess stderr and returns only a final `cloned` or `checkout_uncertain`. Browser shows only the number of fully confirmed repositories, so a large clone appears frozen; a clone exceeding the subprocess deadline leaves a potentially partial directory and cannot be safely retried. Gateway/authentication and browser/host contract currently carry only a final response.

## Recommended acceptance, without a new workspace registry
- [ ] Expose *truthful* per-repository phases from mapped-UID native Git: connecting/reserving, receiving objects (report Git's own percent/bytes when present), checkout, verifying Git/origin/clean state, confirmed or uncertain. Overall count remains n/N. Unknown duration is indeterminate, not a fabricated percent or ETA.
- [ ] Allow legitimately large checkouts to complete within a reviewed extended bounded duration and disk budget; propagate only allowlisted structured progress, never raw stderr, origin credentials or source paths to browser/gateway logs. Revalidate user/UID and prevent cross-user observations on every progress route.
- [ ] Browser disconnect, tab refresh, uncertain writes, interrupted download, native exit and a pre-existing partial directory remain explicit uncertain/conflict states; no automatic retry, overwrite or cleanup. Read-only native observation is the recovery authority; design reconnection or clear safe interruption semantics before extending the deadline.
- [ ] Synthetic separate-UID and production-bundle browser tests drive a slow chunked Git fixture, stages, disconnect, provider failure and read-only recovery. Prove no real home or GitHub identity used in tests. Clean committed-tree gate and guarded test-host deployment. Record protocol/authority implications as an ADR before implementation if streaming/reconnection requires a new store or responsibility boundary.

## Decisions

### 2026-09-29T08:32:48Z · @jari

2026-09-29: Approved the recommendation to design a bounded authenticated clone-progress stream, cancel native write on disconnect, and use read-only native Git observation on refresh; no persistent progress store and no automatic retry. Record contract and trade-offs in @decide-clone-progress-contract ADR before implementation. Approval is for design and implementation within this scope, not a live GitHub test or deployment.

### 2026-10-01T02:25:51Z · @jari

2026-10-01 (Jari): disk budget authority — the operator provisions each Unix user their own bounded volume (per-user limit), instead of a new per-attempt quota operation in the root broker. This amends ADR 0005's per-attempt 20 GiB requirement (docs/adr-0005-clone-progress-stream.md must be updated by the implementing run). The daemon still checks headroom before admitting a clone and fails closed when the bounded volume is absent. Preserved analysis: branch wt/jjj72341j1-bounded-clone-progress (blocker.md).

## Resolution

### 2026-10-02T01:18:27Z · @claude

Native Git clone stages, bounded per-user volume admission, safe cancellation, and read-only recovery implemented and validated on the clean committed product tree. Synthetic screenshots and tests are in result.md. Operator mount provisioning and guarded live test-host deployment remain for the conductor release.

## Test server (pilot.16, 2026-10-02)

Operator-verified release `e1e56efe` runs with the mapped UID's dedicated 12 GiB `~/src` ext4 volume (original repositories preserved); the volume survived a guest reboot. Synthetic no-volume clone admission refuses writes while read-only discovery works. Jari: select a large GitHub repository and watch actual native receiving/checkout stages, then refresh and confirm completed checkout by read-only observation. No real clone, GitHub interaction or browser progress on pilot.16 has been verified by the operator. See the Fleetrepo private inventory for receipts.
