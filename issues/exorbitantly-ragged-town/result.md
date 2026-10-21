# Ordered native command completion

Run `01m5enmd289scwdhdnvfc932kh`, based on main `6da753c8` plus the six preserved wording/race commits.

The RPC reader previously delivered a bash reply directly to `runBash`, independently of the bounded event queue. `runBash` could publish the saved native entry before `drain` had consumed its preceding output. A queued delta arriving afterwards recreated provisional output even though the native card already existed. No text comparison can safely join these: identical command text is a distinct invocation.

Registered bash completions now follow their output through the same event queue, identified by native RPC request ID. Only the event drain releases that invocation's reply to `runBash`. EOF waits for the queued events to drain before deciding that a reply was missing. History and its native entry keys remain authoritative; no new store, contract or text-based deduplication was added.

`TestBashReplyFollowsQueuedOutput` uses pipes to hold the controller until the reader has consumed output, response and EOF. It rejects a reply delivered ahead of the backlog and checks that the ordered completion survives EOF and leaves no live output after publication. The dead-session variant also requires a queued completion to survive reap; `TestRunBashWaitsForQueuedReplyAtEOF` exercises the actual `runBash` wait. The existing controller test still exercises two identical commands; the unchanged browser spec still requires two saved cards and exactly two total cards before and after reload.

## Final integrated validation

Final runnable revision: `85aa3113`; later changes only close issues and record evidence.

Run `01m5enmd289scwdhdnvfc932kh` harvested all six commits from
`wt/nffsxk3ccv-land-wording-cleanup-races` onto main `6da753c8` without
conflicts, retaining main's newer changes. The remaining command-card race is
fixed in this run by commit `85aa3113`.

Project validation commands used disk-backed `TMPDIR=/var/tmp`; native checks used `umask 077`.
Browser commands ran through the configured Cedar route with synthetic hosts.

| Check | Result | Measured duration |
| --- | --- | --- |
| `./scripts/test-web-fast.sh` | 81 files / 471 passed | 21.17 s Vitest |
| `cd web && npx playwright test tests/command-cards.spec.ts --repeat-each 5` | 10 passed | 15.4 s Playwright |
| `cd web && npx playwright test` | 302 passed, 3 opt-in capture skips | 2.2 min Playwright |
| `cd web && npx playwright test --config playwright.lab.config.ts` | 62 passed | 32.4 s Playwright |
| `go test -race -count=3 -run 'TestBash\|TestLocalCommand\|TestRunBash\|TestNativeCommand' ./internal/daemon` | passed | 5.671 s package |
| `go test -race ./internal/daemon` | passed | 80.896 s package; targeted + full final runs together 98 s |

The final fast check plus three browser commands together took 205 s including routing/builds.
Final logs on Alder: `/var/tmp/oh-card-work/{fast-final,cards-final,ordinary-final,lab-final,review-go,daemon-race-final}.log`.
`git diff --check`, issue doctor and project-view validation passed. Self-review
covered the preserved helper and synchronization changes, unchanged command-card
assertions, invocation correlation and EOF ordering. Focused review by `claude-fable-5-1` found a queued-completion loss on early drain exit; it was fixed with a dead-session regression and an actual `runBash` EOF-wait test. The same review thread verified the correction with no remaining actionable finding. Logs: `/var/tmp/oh-card-work/review{,-final}.log`. Its sandbox could not create held-harness conversations (`native_source_unavailable`, also on clean HEAD); routed Linux targeted and full daemon race checks above cover that execution limitation. No full clean gate,
live-provider or distinct-UID claim. No different ordinary-suite flake appeared.

## Recovered attempts and limits

The initial fast command refused missing worktree dependencies (exit 2). Pinned
`npm ci --prefix web` resolved that prerequisite; the complete rerun above passed.
An optional skill-path lookup and exploratory guessed-file lookups returned
ENOENT/no-match; scoped source searches resolved them. Full command/failure
inventory: `/var/tmp/oh-card-work/inventory.md`. The pre-fix card repeat happened
to pass 10/10, so it was not claimed as reproduction; the deterministic queued
completion regression supplies that boundary coverage. Existing build warnings
and dependency audit advisories did not fail validation; dependencies were not
changed. The preserved run's earlier unsuccessful trials remain in its git
history, not evidence of a passing check here.
