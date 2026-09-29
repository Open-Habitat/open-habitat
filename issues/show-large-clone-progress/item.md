---
created: 2026-09-29
updated: 2026-09-29
type: improvement
status: open
priority: high
lane: github-clone-progress
collision: [internal/daemon/github_clone_linux.go, web/src/app/GitHubOnboarding.tsx]
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
