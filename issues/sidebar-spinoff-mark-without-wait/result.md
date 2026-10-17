# Result: the sidebar mark follows working spinoffs, not the wait

## Change

- **Snapshot fact.** Each readable conversation in the snapshot carries
  `spinoffs_working` (contract `snapshot.schema.json`, absent when none):
  the number of its own Taskfleet spinoffs whose state is *working*. The
  daemon derives it from the `taskfleet run list` it already reads for the
  workspace filter (`taskfleetRunFacts.list`, cached while the run records'
  stamps are unchanged; run status lives in `manifest.json`, which the stamp
  covers). Attribution is the spinoff route's `belongsSpinoff` (creator Pi
  session, kind, not caller-owned) with a repository subdirectory accepted by
  path; the read route keeps its exact checkout proof. No new store or
  process: the same native listing, as the daemon's own user.
- **Sidebar.** `AgentNavItem` takes `spinoffWorking` instead of matching the
  activity label. The rail sets it when `spinoffs_working > 0` or the agent
  is in *Odottaa spinoffia*, and never from a stale snapshot. The mark is now
  the blinking branch symbol of the prototype (a CSS mask over the accent
  colour) instead of a dot, and the row's description says "Spinoff
  työskentelee" unless it already says "Odottaa spinoffia". The wording
  "Odottaa spinoffia" still comes only from a live wait process.

## Evidence

- `TestWorkingSpinoffsCountsOnlyTheParentsWorkingRuns` (Go): sibling
  checkout, another session, a settled, a stalled and a caller-owned run do
  not count; a pending run in a subdirectory does.
- `web/tests/spinoffs.spec.ts` "sidebar marks a working spinoff without a
  live wait after a daemon restart…": host-backed, real daemon snapshot. The
  test host now installs a synthetic `taskfleet` that answers only after
  `/fixture/taskfleet` writes a native-shaped run record for a parent
  session. With the run working and the daemon restarted (no wait exists),
  the row has the mark and "Spinoff työskentelee" and not "Odottaa
  spinoffia"; after the run settles and the sidebar refreshes, the mark is
  gone. With the daemon field removed the test fails.
- Lab screenshots with HTML snapshots: `sidebar-desktop-*`,
  `sidebar-phone-*` (drawer open), light and dark, captured by
  `web/lab/capture-sidebar-spinoff.mjs`.
- `go test ./internal/daemon`: only the six known Pi credential, device,
  model and startup failures; `./internal/gateway` passes; contracts
  regenerated with `go generate ./internal/contracts` and
  `scripts/check-generated.sh` clean.

## Decisions for later review

- **Waiting-for-parent and unknown runs do not raise the mark.** Only
  *working* counts: an interactive run waiting for its parent, or one whose
  supervisor is gone, is not a sub-agent at work.
- **A killed supervisor keeps the mark for at most ten seconds.** Taskfleet
  probes supervisor liveness at list time and a killed supervisor changes no
  run record, so a cached listing that holds unsettled runs now expires after
  `taskfleetLivenessTTL` (10 s); listings of only settled runs stay cached by
  their stamps. Found by the independent review (below). A run whose
  supervisor pid was never recorded (`not-recorded`) still counts as working
  until Taskfleet marks it stalled; changing `spinoffState` for that would
  also change the thread's spinoff read.

## Review

Independent `/llm-review` of the whole batch (finder GPT-6 Astra, verifier
Claude Fable 5.1): the cache-liveness finding was confirmed and fixed with
`TestTaskfleetListingWithUnsettledRunsExpires`; the verifier found no path by
which `spinoffs_working` counts another user's or another session's run.
