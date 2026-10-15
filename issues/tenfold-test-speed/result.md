# Test-speed investigation

## What changed

The native-history HTTP handler now takes private page and block budgets. Production callers pass the original 256 KiB page and 1 MiB block budgets; the test uses an 8 KiB page budget for metadata pagination (12 entries of roughly 7 KiB each) and an 8 KiB block budget with a 16 KiB image. The tests still cross both budgets, check the backward and forward cursors and reject a request one byte above the block budget. A separate test pins both production defaults and the unchanged 32 MiB legacy / 512 MiB native file limits. The tail-window test uses a 1 MiB record (four times the page budget) rather than 34 MiB: it still checks backward navigation, chunking, revision invalidation and capped HTTP responses. It no longer proves that a single record above the *historical* 32 MiB legacy-file threshold remains readable. That historical regression proof would require a separate slow test; it was not equivalent to the actual page bound.

All browser cases still start a fresh isolated synthetic host. Removed nine 2.2-second sleeps from Pi onboarding cases: their comment assumed the preceding case's Pi helper leaked into the current host, but every case gets a new daemon/device/home and scenario reset replaces its ephemeral leases. The one case checking polling while a status request remains in flight now advances Chromium's timer through one, then two more, 2-second poll intervals instead of sleeping 10.1 seconds; it still asserts single-flight, no false success, no duplicate POST, and explicit retry. Production's 2-second interval and fake Pi's 2-second native transition are untouched. No browser test was deleted.

## Redundancy audit (normal and lab browser specs)

Each row states its distinguishing proof and closest overlapping test. Overlap is not a replacement unless it covers the distinguishing behavior. Pure component rendering is also exercised by Vitest, but a browser visual, focus, or real host route assertion cannot be removed merely because a component renders.

| Spec | Distinguishing assertion; closest overlap |
| --- | --- |
| `account-settings` | Native credential observation and identity switch; `browser-conversation` settings only checks revalidation timing. |
| `browser-conversation` | 58 host-backed controller/recovery cases: once-only writes, receipts, answer/queue/continuation races, drafts across identity, and reconnect. `lab-conversation` covers happy turns and selected frame recovery, not its lost-ack/state matrix; `resilience-states` covers outage views, not write receipts. The footer/editor assertions overlap component render tests but additionally check browser widths and native interaction. |
| `control-states` | Shared controls' focus and theme feedback, plus source construction rule; `design-system` checks catalog focus, not migrated production controls. |
| `design-system` | Catalog visual themes, zoom, reduced motion and axe; `shell-accessibility` checks the actual signed-in shell. |
| `first-use-ux` | Abort semantics, delayed reads and code-preparation feedback; `pi-onboarding-host` proves native attempt result, not first-click/focus behavior. |
| `github-denied` | Denied checkout remains unconfirmed; `github-observation` exercises conflict/partial and lost responses, not denied writes. |
| `github-first-onboarding` | End-to-end checkout selection and narrow keyboard access; `github-observation` tests response reconciliation. |
| `github-observation` | Existing checkout, conflict and lost POST readback; `github-first-onboarding` proves ordinary selection only. |
| `github-session` | Cookie/identity switch fences in-flight catalog; `workspace-slice-security` authenticates mapping, not that pending catalog. |
| `github-slow` | Slow reply/focus prevents duplicate checkout; `github-observation` checks lost reply rather than concurrent focus. |
| `github-stream` | Native clone progress stage; `github-first-onboarding` checks completed clone. |
| `lifecycle-frames` | Repeated completed turns cannot become Pi messages; `lab-conversation` checks typed fragment convergence, not this frame classifier. |
| `native-history` | Paging, native-only reads, anchored scroll, corrupt/missing states, warm return and mapped identity; daemon history tests cover parser/bounds, not browser anchoring and rendering. |
| `onboarding-notices` | Desktop/phone error alignment and safe read-only retry; `first-use-ux` covers onboarding controls rather than placement. |
| `pi-attempt-host` | Foreign/stale attempt denial with mapped reads; `pi-onboarding-host` tests UI session separation, not native attempt mapping. |
| `pi-native-route-gate` | Gate's single OpenAI check alongside mapped native reads; `account-settings` covers credential settings, not native route gating. |
| `pi-onboarding-cancel-race` | Cancellation of an in-flight poll; `pi-onboarding-host` tests settled cancellation. |
| `pi-onboarding-host` | Native attempt, foreign session, unknown/expiry and polling through restart; `pi-onboarding-slow` tests delayed replies, not lost lease and explicit retry. |
| `pi-onboarding-race` | Old-session late reply and unbound-session action fence; `pi-onboarding-session` checks settled switch. |
| `pi-onboarding-restart` | Restart/expired lease; `pi-onboarding-host` also restarts a lost code, but does not check an expired lease with fresh state. |
| `pi-onboarding-session` | Device instructions removed on Alice→Bob switch; `pi-onboarding-race` tests late response during switching. |
| `pi-onboarding-slow` | Native reads span polls with exactly one write; `pi-onboarding-host` checks delayed poll after restart, not multiple delayed native reads. |
| `resilience-states` | Read/snapshot outages, stale-vs-empty state and retry; `browser-conversation` covers write reconciliation rather than workspace outage truth. |
| `round4-polish` | History labels, focus ring and distinct pending-code cancellation; `shell-accessibility` has generic route focus, `first-use-ux` has abort controls but neither checks these details. |
| `shell-accessibility` | Signed-in/out shell axe, focus restoration, zoom and headings; `design-system` checks catalog a11y, not real navigation. |
| `terminal-sync` | Native terminal append reaches two browser contexts exactly once; `native-history` checks one-context pagination. |
| `theme` | Pre-bundle theme application, system preference, storage-denied fallback; `design-system` checks rendered catalog themes, not persistence or initial flash. |
| `workspace-slice-security` | No fixture in production, safe auth/callback, mapped account and >512 workspaces; `workspace-slice` tests normal isolation and routing but not bundle or high-cardinality boundary. |
| `workspace-slice` | OAuth routing, identity isolation, snapshot truth and axe on built host; `workspace-slice-security` has narrower auth adversarial cases, not journey. |
| `lab-conversation` | Fake Pi through real controller, combined SSE, native paging, recap and recovery, heartbeat; `browser-conversation` tests many related failures, but not every combined-frame/recap assertion. |
| `lab-foundation` | Lab-only metrics, narrow navigation and title access; `design-system` checks catalog rather than lab state. |
| `lab-onboarding` | Clone/Pi flow and publication visibility across local vs cloned checkout; `github-first-onboarding` tests production checkout but not lab publication states. |
| `synthetic-demo` | Demo isolation/no external host and error sanitization; excluded from the normal suite, and not a substitute for gateway boundary tests. |

**Removal/move map:** none. Changed wait only in the nine Pi cases listed above; each keeps its original assertions. All Unix-user, socket, gateway, daemon identity and provisioning tests remain. No claim that same-UID browser hosts prove kernel UID isolation.

## Timing, decisions and remaining gap

Before (previous changed-tree warm run): elapsed 169 s, browser 129 s, Go/contracts 124 s. Before cold: 233 s, browser 142 s, Go/contracts 157 s; dependencies alone 49 s. This worktree's 8-core host has eight Playwright workers. Race measurement on the three originally slow daemon cases (before changes, with metadata test edit racing the measurement): `go test -race` 50.94 s package / 54.81 s wall; plain run was 1.56 s package / 3.37 s wall but failed because the first 4 KiB test budget was smaller than an individual 7.5 KiB entry. After correction, the same three cases pass under race in 2.79 s package / 5.84 s wall. This shows a real input-size amplification under the race detector; keep `-race` in the full gate for every Go package rather than silently dropping race coverage. In three serial normal-suite runs, all 142 cases passed each time (76.81 s, 72.15 s and 78.23 s wall, with eight workers). No fixed network-idle wait appears in the browser specs; the only remaining fixed browser sleeps are two 1-second waits in conversation cases. The slow Pi native read test still delays actual HTTP responses 1.9 seconds so it crosses the production 2-second poll interval; replacing those replies with an immediate fixture would erase its single-flight proof. The host remains cheap to start (previous median 17 ms). The same 142-case suite with four workers took 89.72 s; eight workers' 72.15–78.23 s is faster on this eight-core host, so keep eight. These timings exclude the separate lab suite and packaging.

Focused diff review: production entry points `HistoryHandler` and `HistoryHandlerWithNativeRoot` still use the production constants; the unexported budget override is called only from tests. The image is 16 KiB against an 8 KiB injected block limit; a limit of 8,193 bytes is rejected. Twelve metadata-rich entries each weigh about 7.5 KiB against an 8 KiB page budget, so both directions cross the page bound and retain cursor assertions. No browser case was deleted, and no security boundary assertion was removed. The remaining risk is the retired >32 MiB record proof and actual Pi's real-time 2-second transition, which the browser tests still wait for. The fixture's `scenario` switch resets devices and the suite starts a fresh host per case, so removing pre-case 2.2-second sleeps does not grant cross-case state.

## Full gate evidence

| Changed-tree `--clean --json --no-reuse` | Setup | Dependencies | Web checks | Browser | Go/contracts | Packaging | Elapsed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Before, cold (previous run) | 5 s | 49 s | 12 s | 142 s | 157 s | 10 s | 233 s passed |
| Before, warm (previous run) | 5 s | 14 s | 11 s | 129 s | 124 s | 10 s | 169 s passed |
| After, cold-cache attempt on `1e5e9ae7` | 5 s | 47 s | 11 s | 139 s | 95 s | not reached | 202 s failed |
| After, warm-cache retry on `1e5e9ae7` | 5 s | 14 s | 11 s | 124 s | 82 s | 9 s | 162.82 s passed |
| After, documentation/issue tree `067f5ba4` | 6 s | 14 s | 11 s | 119 s | 66 s | 10 s | 159.41 s passed |

Cold-cache failure: the browser phase passed; the Go phase failed in `TestConversationSpontaneousExitWithInheritedStdout` and `TestPiRPCDetachedStdout` waiting for fixture holder processes under concurrent browser load. These subprocess fixtures passed in the subsequent complete gate. The failed run produced no gate receipt. These numbers are not a 10x speedup: the browser side still determines wall time, and the 82-second Go/contracts phase includes build/storybook and validators, not just the now-faster daemon bounds cases. Gate wall time improved only 6 seconds warm. The separate Go suite with pinned Pi fixture installed took 17.84 s plain and 21.07 s under `-race` with warm Go caches. Per-package times (plain → race, seconds): `cli` 0.13→10.12, `core` 0.013→1.013, `daemon` 14.27→17.68, `diagnostic` 0.003→1.022, `gateway` 0.569→2.734, `nativegh` 3.059→4.079, `provision` 7.926→8.544, `storagequota` 0.006→1.021, `transport` 1.031→2.080, `udssecure` 0.006→1.010. The all-package race check retains concurrent code coverage and adds only ~3.2 seconds wall after the large inputs were removed, so it remains in the gate.

Both passing gate runs used `--no-reuse`, produced receipts with `reused_phases: []`, and left a clean worktree. To check the operator without pushing a worker branch to `origin/main`, I made a disposable local bare origin and clone at `/var/tmp/tenfold-profile/operator/`, set its `main` to commit `067f5ba4`, and copied the receipt byte-for-byte into that clone's git common directory. Fleetrepo's `release_test.py --dry-run --product <clone> --version 0.0.0-pilot.999 --output <private directory>` accepted the unchanged receipt, rebuilt and verified the release, and returned `dry_run_verified_no_guest_contact` with matching source/tree and `gate: clean-gate` in 5.71 s. This verifies the operator's receipt path on identical source bytes; it does not claim the worktree was pushed to real `origin/main` or that a guest was contacted. A final no-reuse gate must cover the committed measurement update as well. The issue stays open because 159 s is nowhere near the under-60-second close threshold. Further progress needs a browser journey rewrite that removes unique cross-layer cost without losing evidence; dropping security tests or turning off `-race` would disguise the problem rather than fix it.

## Follow-up on the expanded suite (2026-10-14)

This follow-up reduced only the **synthetic fake Pi** turn steps from 400 to 200 ms (and the deliberately slow `hidas` step from 4 to 2 seconds). The child is built from `test/browser-host/fakepi.go`; production Pi, the browser's 2-second poll, native leases and production deadlines were not changed. The real transitions, native history and per-case fresh hosts remain in place. No tests were removed or moved, so the removal/move map above still applies. The shortened turn is not a substitute for a dedicated test of a slow provider. Review of the call sites found the fake's steps only in this test host; production `cmd/open-habitat` does not import it. Under repeated focused runs the four conversation queue/continuation cases passed 12/12. A conversation status route could remain active at test teardown; the test now drains its routes after checking the no-repost assertion. A Go subprocess test could observe a newly created but not yet populated PID file, so it now waits for a valid PID before asserting (20/20 focused `-race` runs); neither fix weakens the proof.

| Changed-tree, clean, no-reuse | Setup | Dependencies | Web checks | Browser (normal + lab) | Go/contracts | Packaging | Elapsed | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Previous passing warm baseline `067f5ba4` (142 normal, 17 lab cases) | 6 s | 14 s | 11 s | 119 s | 66 s | 10 s | 159.41 s | passed |
| First run here `e17a3153` (157 normal, 17 lab cases, cold worktree caches) | 5 s | 42 s | 13 s | 149 s | 125 s | 10 s | 219 s | passed |
| Warm run `b8790b25` (same expanded case count) | 4 s | 15 s | 12 s | 137 s | 96 s | 9 s | 178 s | passed |
| Final evidence tree `1c22527c` (157 normal, 17 lab) | 5 s | 14 s | 12 s | 133 s | 83 s | 9 s | 174 s | passed; `reused_phases: []` |

Both passing runs had `reused_phases: []` and a clean worktree. The baseline is **not** an apples-to-apples performance comparison: main gained 15 normal browser cases between the rounds, and the Go cache and host load also differed. The new warm gate is not faster than the previously recorded 159 seconds, let alone under 60 seconds. The separate normal-suite profile on the 100 ms fake had 157 cases totaling 617 case-seconds; its slowest genuine cases were the 11.2-second delayed Pi-status test and 9.6-second axe catalog test, besides a 30-second timeout. Lab profiling found a 22.1-second journal-heartbeat case and an 18.5-second typed-fragment case. The heartbeat verifies a real elapsed deadline, not idle test padding. Normal and lab are serial inside the browser phase.

I tested overlapping the two browser suites on their separate host ports. The first attempt failed because both Playwright processes deleted each other's artifacts. After separating artifact paths, running eight plus four Chromium workers alongside Go race tests caused native timing failures; reducing to four plus two still caused intermittent browser assertions and a Go fixture failure. The overlap reached 103–111 seconds in *failed* browser phases, so it cannot be claimed as a validated speedup. Those experimental orchestration changes were reverted. The subsequent serial gate retry passed all 157 normal and 17 lab browser cases but failed `TestConversationSpontaneousExitWithInheritedStdout` on the partly written PID (fixed above). Another serial attempt failed intermittent continuation controls and `TestCloseEmptyBrowserChild`. The later complete gate passed on `1c22527c` after returning the slow synthetic turn to its previously passing two-second setting and fixing the PID observation race; the intermittent failures are not reproduced there. Logs from failed attempts are in `/var/tmp/oh-tenfold/gate-serial-final.log` and `gate-after-pid.log` on this worktree's test host. Browser profile failure details are in `/var/tmp/oh-tenfold/profile.json`. The issue remains open: the small-fraction speed criterion has not been met. The next improvement should target the actual case costs and Go fixtures under concurrent load rather than add more parallelism to this eight-core host.

## Concurrent-load Go fixture follow-up (2026-10-15)

The no-reuse gate at `69bf63a2` failed in two daemon fixtures while Go and browser suites overlapped (`/var/tmp/oh-night-gate-after-install.jsonl`; Go/contracts 157 s, browser 197 s). Archive returned 409 after the *second* synthetic native writer exited; the fixture waited for an affirmative `not_observed` census after the first exit but skipped that wait after the second. It now waits for the same affirmative result (up to 3 s) after both exits. An `unknown` census never counts as absence; production archive policy is unchanged.

The clone deadline fixture previously allowed 60 ms from the start of the Go call for a shell child to run `mkdir .git`. On the failing gate the deadline won before the child created `.git`, so the test's partial-checkout precondition was false. The replacement waits for the native child to create `.git` and signal readiness before triggering a test-controlled deadline context, then checks that the command returns `DeadlineExceeded` promptly and `.git` remains. A 5 s real timeout caps a broken fixture; it does not substitute for readiness. The injected context uses a real cancellation channel and reports `DeadlineExceeded` through `Err`, testing the deadline branch and process-group termination without using scheduler time as the start signal. The fixture now starts a separate sleep child and checks its `/proc` state after the deadline; a dead leader with a live sleep child fails. An orphaned zombie is counted as dead.

Validation: `TMPDIR=/var/tmp go test -race ./internal/daemon -run '^(TestArchiveKeepsNativeHistoryAndRejectsUnknownWriters|TestCloneNativeDeadlineKillsSlowProcessGroup)$' -count=10` passed (6.18 s package). Under `GOMAXPROCS=2`, the original replacement passed 20 repetitions (15.22 s package); after adding explicit child-process proof, both focused race tests passed another 10 repetitions (4.69 s package). `gofmt`, `TMPDIR=/var/tmp go vet ./internal/daemon`, and `git diff --check` passed. These constrained/repeated runs are not a reproduction of full browser concurrency. No full gate was started here; the conductor will run it after landing.

## Lab visual-hold journey consolidation (2026-10-15)

`web/tests/lab-conversation.spec.ts` had two independent hosts that logged in,
created a conversation, selected `pi-visual-hold` and sent a prompt to inspect
one in-flight tool phase. The intermediate-message case asserted that the
partial native assistant reply has a `Vastaa` header while progress still says
working; the stop case asserted the bash-progress label, geometry and explicit
stop confirmation outcome. The stop case now checks the intermediate reply
*before* its existing progress, geometry and stop checks. The fake Pi's
`pi-visual-hold` mode stops at `tool_execution_start` until the test flips the
scenario to `ready`, so the merged observation remains a real native in-flight
turn, not a settled-output substitute. It does not use `hidas`: the fixed
2-second phases added delay before reaching the already-held tool but did not
strengthen the assertion. The crash-after-release (`kaadu`) remains to exercise
the unconfirmed-stop path. No simulator, controller or production behavior was
changed. The retained dedicated typed-fragment case still uses `hidas` because
it must see thinking and tool-call fragments *before* the answer is saved; its
2-second phases provide an observable pre-settlement window. Its later
reconnect/gap assertions do not alone justify removing that window. Recap
invalidation remains a separate two-tab case: its second turn must be live
while stale recap disappears, which the visual-hold journey does not cover.

Before the edit, a focused standalone lab run on `04420f90` passed 3/3
(typed 22,350 ms, intermediate 7,976 ms, stop 9,517 ms case durations;
31.75 s elapsed). Same port base 55000, two workers, pinned installed web
dependencies, browser cache `$HOME/.cache/ms-playwright`, disk-backed
`TMPDIR=/var/tmp`. The three case durations are summed work, not wall time;
two independent hosts run concurrently. After-edit timings and repeated
results follow below. This worker did not run the full gate, UID isolation or
real model Pi; synthetic fake Pi runs via the real host controller and writes
native history.

After the edit, the same focused command with `--repeat-each=2` passed 4/4
(two typed: 21,957 and 22,448 ms; two merged visual-hold: 4,534 and
3,969 ms; 39.74 s elapsed for two repetitions scheduled across two hosts).
The typed journey's saved blocks, injected sequence gap and recovery snapshot
checks all passed twice. A separate single-repeat comparable wall measurement
follows. Web typecheck and lint passed. The first format check reported only a
new line-wrap mismatch; formatting was corrected and `format:check` plus
`git diff --check` then passed. Project-view validation passed (28 pages).
The comparable single-repeat after run passed 2/2 (typed 21,970 ms,
merged hold 3,919 ms, **28.26 s wall**). Against the passing 3/3 before run
(31.75 s wall), that is 3.49 s less elapsed in this pair, while summed
individual case time falls from 39,843 to 25,889 ms. These are standalone
runs under the same port/caches, not a controlled full-suite speedup: the
hosts overlap and scheduling/build/load vary. The before command initially
could not start because this fresh worktree lacked `web/node_modules`; after
`npm ci --prefix web`, the correctly configured baseline passed. No failing
attempt is included as timing evidence.
