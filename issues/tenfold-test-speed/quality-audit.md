# Test-value audit — first pass (2026-10-15)

This is an evidence ledger, not a claim that the suite has been audited end to
end. The earlier [redundancy audit](result.md) compared whole Playwright *spec
files*. A distinctive assertion somewhere in a file does not justify every
case in that file, every duplicate assertion in the case, or its runtime.

## Inventory and cost

At this pass's starting tree: 107 Go test files (349 named Test/Example/Benchmark
functions; ~16,788 lines); 41 Vitest files (223 `it`/`test` calls; ~6,654
lines); 38 Playwright spec files (179 `test` calls including excluded demo and
lab cases; ~8,067 lines). Counts include parametrized tests as one definition,
so they are not the number of executed cases. The existing standalone browser
profile in [fast-focused-tests/profile.md](../fast-focused-tests/profile.md)
measured 142 passing normal cases in 82.15 s, with 241.40 summed case-seconds
in `browser-conversation` alone. Later changed-tree full gates in
[result.md](result.md) took 159–174 s warm with the browser phase at 119–133 s;
the suite grew meanwhile, so those are not directly comparable before/after
numbers. Chromium hosts are per case; independent case durations overlap in
eight workers. Building the web, building Storybook, dependency installation,
Go race, contracts and packaging also cost time independently of case count.

The full gate used to delete `web/node_modules` and repeat `npm ci --offline`
after a successful locked install. No consumer needs an air-gapped install of
the entire web lockfile: `scripts/prepare-test-release.sh` reinstalls with
`npm ci --prefix web --no-audit --no-fund` and packages built assets, not
`node_modules`; `scripts/package-release.sh` copies `web/dist`. The first
`npm ci` already checks lock/manifest consistency and installs the pinned tree.
The second install only showed that this same checkout's *just-warmed local npm
cache* could reinstall; it did not establish a cold offline release path. We
removed that reset and reinstall without changing other gate checks or receipt
semantics.

Local sequential timing in this disposable worktree (2026-10-15, Node/npm
22.23.2/10.9.8, `TMPDIR=/var/tmp`, checkout-local
`NPM_CONFIG_CACHE=$PWD/.cache/ci-local/npm`): after a successful warm-up
`npm ci` (28.16 s), one warmed `npm ci --prefix web --no-audit --no-fund`
took 27.84 s. The old pair, measured next against the warmed cache, took
23.29 s for `npm ci --prefix web` and 19.28 s for the offline second install
(after `rm -rf web/node_modules`), or 42.57 s excluding the reset. The extra
install cost 19.28 s in that pair; the single and pair used slightly different
npm audit/fund flags, as the gate does, and were sequential rather than
randomized. Host contention and cache state vary, so these are local install
costs, **not** a passing clean-gate wall-time comparison or a claimed end-to-end
speedup.

## Decisions made against code

| Surface | Decision | Distinguishing evidence / lost assertion |
| --- | --- | --- |
| `web/src/components/Button.test.tsx`, both tests | Delete the file. | First case restated `Button`'s direct text/callback forwarding to `ControlButton`. Second tested the disabled reason and disabled attribute, already covered more strongly by `DesignSystem.test.tsx` (`keeps disabled reason visible and prevents activation`), including a click that must not call the handler. |
| `web/src/components/AgentTurn.test.tsx`, `keeps separate work groups and a reply under one turn rail` | Delete this case. | Its `work` and `reply` props were already markup passed into the wrapper; the assertions pinned the wrapper's private class and echoed the supplied reply. The adjacent fold test still proves the reply remains visible when work is collapsed and controls disable while working; the thinking-row test still checks lazy expansion. |
| `web/src/components/LoginCard.test.tsx`, both tests | Delete the file. | First case echoed a hard-coded heading and forwarded callback; its negative check had no untrusted input. Second checked fixed prose/style and the absence of `auth_error` even though the component takes no such input. `workspace-slice-security.spec.ts` tests the *actual* adversarial `auth_error` URL, generic error notice, danger styling and retry through the app; `workspace-slice.spec.ts` covers real login. |
| `web/tests/control-states.spec.ts`, `production controls are constructed only in ControlElements` | Delete this case. | It scanned TSX/CSS with regexes for literal selectors, file locations and exact snippets, instead of verifying the interface. The remaining two browser cases exercise focus/feedback and layout in production. This does *not* establish an AST-wide architectural rule that all future controls use one component; if that is separately required, enforce it through a scoped lint rule rather than a screenshot/Playwright test. Earlier profile: this case took 0.04 s of case time, so no meaningful gate speedup is claimed. |
| `web/tests/lab-foundation.spec.ts`, metrics-and-theme assertions | Replace exact CSS-token copy with page-fit, stream/rail scrolling and composer-fit assertions at desktop and phone width; retain the real drawer, focus and keyboard navigation checks. | The old test copied 296/732/780 px widths, 13/14/24 px paddings, 15.5/14.5/11 px fonts, radius, border and outline values from the design CSS across four combinations. Valid refactors had to update both. The replacement detects actual clipping or lost navigation without promising pixel fidelity. Visual fidelity still needs an image review; this does not replace one. |
| `internal/daemon/history_block_read_linux_test.go`, `TestHistoryPageBudgetProductionDefault` | Delete. | Compared four production constants to repeated literals. A size change requires editing both sides to go green; it neither crosses a budget nor checks that the runtime handler uses it. Adjacent tests cross injected byte/page budgets and test actual cursor/response bounds; `conversation_linux_test.go` uses `maxHistoryFile + 1` to cross the file limit. The issue's previously checked acceptance criterion claimed the production defaults were "covered by a test"; this was the literal-value test, not behavioral evidence. That claim is no longer true in the exact-numeric sense; only the budget behavior is covered. If exact numbers become a published contract, add an externally sourced compatibility check instead. |
| `web/tests/workspace-slice-security.spec.ts`, 2,500-workspace browser case; new `web/src/app/snapshot.test.tsx` | Split by boundary. | Existing browser case failed four times waiting for a partial-source label after mounting 2,500 rows (the trace still showed loading at five seconds). It conflated >512 visible rows with a >1 MiB wire response. The browser case now renders 600 rows and retains the partial-source / filter / last-item assertions; three repeat runs passed in 5.3 s total. The 1 MiB reader acceptance is independently exercised with a valid large wire response in Vitest (single case ran in 661 ms including startup); this retains the input-boundary proof without a giant DOM. These are different claims, not duplicate tests. |
| `web/tests/browser-conversation.spec.ts`, four continuation refusal cases; `web/src/app/conversations.test.tsx` | Keep one host-backed browser case, move the four code/status classifications to one parametrized Vitest table. | All four browser cases built the same ended conversation, intercepted one POST, rendered one static reason, reloaded and asserted no repost. Different codes only changed the response status (409/429) and displayed sentence. `continueConversation` now has one cheap test per code for its actual JSON/status classification; the retained `writer_conflict` browser case proves the shared refusal/no-repost/reload path. This stops repeating the full native journey merely to compare four literals. Browser-localized wording of the other three codes is no longer pinned; changing wording is not a failure. |

The first four web files lost 206 lines and gained 33, mostly exact CSS
assertions; the other changes split a costly browser case and delete two more
low-value Vitest cases. This is not 206 browser cases removed. The source scan
saved one Playwright case; the lab edit reduced viewport/theme combinations
but still runs one browser case. A full-gate elapsed-time delta has **not**
been measured.

## Inspected and retained for a reason

- `web/src/components/DesignSystem.test.tsx`: IME composition must not send,
  modal focus must return to the trigger, and disabled actions must not fire.
  Its `StatusMark` text assertion alone would not earn a *new* test, but this
  one also checks the decorative dot's `aria-hidden` property.
- `web/src/components/PiDeviceSignIn.test.tsx`: malicious and lookalike URLs
  must never expose device codes or create navigation links. Not a trivial
  mapping table.
- `web/src/components/WorkingProgress.test.tsx`: unfamiliar Pi events and
  private tool arguments must not become executable HTML or be printed. Keep.
- `internal/provision/administration_linux_test.go`: the empty-list wire case
  distinguishes `[]` from `null`, which affects browser/host protocol validity;
  not just a derived JSON round-trip. Read boundaries, pagination and extra
  authority checks also have independent consequences.
- `internal/gateway/server_test.go`: multiple paths check that API failures
  cannot be mistaken for SPA pages and that robots/cache headers survive
  routes and HEAD; the static literals here are public behavior, not a copy of
  a constant with no consumer.
- `internal/cli/cli_test.go`: CLI output/exit codes are a public operator
  contract. The maintenance test is weaker than its name (it checks a final
  absent file, not that dry-run left state unchanged before `enter`); improve
  such tests on a CLI-focused pass rather than delete the entire package.

## Next case-level passes, in cost order

1. `web/tests/browser-conversation.spec.ts` had grown to 63 definitions and
   2,509 lines before this pass. Profile the remaining cases per case, then compare **each**
   send/continuation/lost-ack scenario to the Vitest store/journal cases and
   Go controller tests. In the previous profile one stale-working-view case
   was 15.37 s, but its held-request race tests a unique failure; deleting it
   without equivalent proof would be a false saving. Other candidates:
   pure footer/editor presentation cases vs component tests. The four
   continuation refusal variants were consolidated after inspecting the
   common path and the exact status/code differences. Do not delete further
   without inspecting the distinct error behavior and boundary.
2. `web/tests/design-system.spec.ts`: the two happy-state screenshots do not
   compare pixels. They now run only through `test:visual` for human review;
   the unhappy-state assertions remain in the gate, but its screenshot is
   manual-only too. The catalog axe test had a 12.49 s case in the older
   profile; compare its actual states to production-shell axe coverage before
   removing or shrinking it.
3. `web/tests/lab-conversation.spec.ts`: removed the ~20 s heartbeat case.
   It chiefly checked that a 20 s ticker produced a comment after ~20 s; it
   did not show that a real proxy kept an idle connection alive. The Go test
   proves that SSE opens before the first heartbeat and the browser idle/blur
   case checks absence of redundant network requests on a sped-up clock.
   This deliberately drops exact live-heartbeat-interval regression coverage;
   if proxy liveness becomes a requirement, test the proxy behavior directly.
4. Audit short component tests assertion by assertion; `RecapCard` mixes
   uncertainty checks with echoes of input text. Audit Go package-by-package
   afterward, preserving actual UID, root, socket and protocol checks. The earlier
   browser-spec-wide overlap ledger is not enough to justify the present
   number of assertions.

## Validation and limits

After reinstalling pinned web dependencies offline, `npm run test:component`,
`typecheck`, `lint` and `format:check` passed. Focused browser runs passed
`control-states.spec.ts` (2/2) and `lab-foundation.spec.ts` (1/1), with
`PLAYWRIGHT_BROWSERS_PATH=$PWD/.cache/ms-playwright`, `OH_PORT_BASE=15800`,
`TMPDIR=/var/tmp`. The first component run failed because the pre-existing
`web/node_modules` was missing `highlight.js`; `npm ci --offline` repaired the
local dependency tree and the rerun passed. An entire normal browser run
completed 159/160 cases in 109.7 s; the 2,500-workspace case timed out waiting
for its partial-source label. Its JSON result is local scratch at
`/var/tmp/oh-quality-normal.json`. Three isolated reruns reproduced this
failure (still showing `Ladataan` at the five-second assertion deadline).
After splitting the case by boundary, three focused repeats of the 600-row
browser case passed (5.3 s wall); the >1 MiB valid snapshot reader passed as
a Vitest case in 661 ms including startup. This fixes a failing test without
dropping the byte or cardinality checks. The failed 109.7 s suite is **not** a
passing benchmark or before/after comparison. A subsequent full normal run
with the 600-row case passed 160/160 in 129.6 s; the full lab run passed
24/24 in 42.9 s. These are separate sequential runs before consolidating
three continuation cases, not a changed-tree clean gate. One catalog axe case
took 25 s and the lab heartbeat took 23 s in that run; the latter measures a
real ~20 s deadline. Case times depend on host load and cannot be compared to
the older 142-case suite as though they were identical populations. Following
the continuation consolidation, its focused browser case passed (1/1),
`test:unit` passed (123/123), `test:component` passed (111/111), format/lint/
typecheck passed, and affected Go daemon tests passed with `-race`. Project
view validation and `issuectl doctor --json` passed. Two full normal browser
reruns after the three-case consolidation did **not** pass: one finished
156/157 with an archive/restore button disabled at a five-second assertion
(three isolated repeats of that same case passed), and one finished 156/157
with a fresh host unable to bind its worker port (15823 already in use at the
instant of spawn; the port was free on subsequent inspection). Their JSON
scratch results are `/var/tmp/oh-quality-normal-{after,confirm}.json`. These
runs cannot establish either a full-suite pass or a speedup. Another full
rerun would spend two minutes without addressing either failure; treat the
harness race/timeout as separate test reliability work rather than deleting
those behavioral cases. The latest cleanup also removed the arrow's half-pixel alignment check from
`latest action` (the actual appearance/disappearance behavior stays) and
replaced the browser journey that injected long tool target text with a short
Playwright test of production `ToolRow` in a catalog fixture, at desktop and
mobile widths. The prior DOM unit test still checks that the component emits
its name and first command line; the layout test measures real CSS without
starting Pi. `test:visual` opts into screenshots and the normal browser suite
skips the two capture-only cases. After this pass, `typecheck`, `lint`, `format:check`, and component tests
(113/113) passed. A full normal browser run passed 159 cases with the two
capture-only cases skipped (1.6 min), and a sequential lab run passed 24/24
(29.0 s); both used `OH_PORT_BASE=16100` and disk-backed `/var/tmp` scratch.
A separate opt-in capture run passed both screenshots and the retained latest
button behavior (3/3). The earlier 129.6 s browser / 42.9 s lab runs came
from a different tree and conditions, so this is a passing gate result, not
an isolated, comparable speedup measurement. No distinct-UID scenario was run;
this document is not a full-gate receipt.

## Case-cost pass (2026-10-15, current tree)

The cancelled speed worker's useful commits were carried onto main: the nine
short-lived socket activation child processes no longer wait for the race
runtime's post-assertion one-second exit grace; the lab forced-gap check uses
an ordinary native turn because its gap is injected *after* settlement. Its
file-card tests now wait for saved content rather than describing synthetic
extra cards as live events (the fake Pi never streams those cards), and a PID
fixture waits for a populated file. The previously uncommitted archive test
waits for affirmative writer absence after its writer has exited, without
turning an unknown `/proc` census into absence. Real Go race coverage and
production fake-Pi/daemon timing remain unchanged.

| Change | What still proves the distinct behavior |
| --- | --- |
| Removed three host-backed `browser-conversation` geometry cases (`composer centers`, `footer and floating latest`, `resized editor`) | A short browser case renders production `Composer` in the design fixture, enters 20 lines and checks a scrollable editor and usable send on narrow screens. `only reader scroll suspends following` and `latest action follows expanded output` still prove the scroll/jump control with the actual conversation. The dropped half-pixel alignment, forced CSS min-height, injected notice markup and exact editor height did not prove native host interaction. |
| Reduced `control-states` shared feedback case from two themes/six controls plus CSS token injection to a production link and account menu | Its focus and hover assertions still use real controls; keyboard/zoom/axe and theme contrast are checked by `shell-accessibility`, `design-system` and `theme`. An injected hover-token literal and identical interactions in a second theme did not establish distinct behavior. |
| First `native-history` case uses a 51-entry synthetic history rather than loading all 251 entries over 10 clicks | Two real older-page loads still cross the 25-row boundary, reach the unknown native event and untrusted 40k-character message, keep it non-executable, reject writes, and prove reload restores the first page. Go's history page-budget tests cover cursor/response bounds; the browser `older page keeps the visible native row anchored` checks paging layout. The old CDP heap number was only printed, not asserted or a retained-size benchmark, and its screenshots were never compared. Other native-history cases still use the 251-entry fixture. |
| Split the four catalog state/theme axe scans into independently scheduled cases | Same four scans and assertions; no axe state removed. This can shorten the suite's critical path but does not reduce total scan CPU. |

The attempted current-tree standalone browser baseline at `de1a75a9` ran
165 cases in 154.1 s but failed three: both file-card cases clicked a
transient live disclosure just as it disappeared, and the external terminal
append case timed out under concurrent load. This **is not a passing baseline**
or evidence of a speedup. The settled saved-card selector now fixes the first
race instead of increasing its timeout. Focused browser checks after the
case-cost edits passed 9/9 (including all four axe combinations and the
short native history); focused race tests for archive, Pi PID and activation
passed twice each. The full suite and a comparable before/after wall-time
measurement remain to be done.

## Native journey consolidation (2026-10-15)

Two more cases repeated the expensive `endedConversation` native create/send/stop
journey solely to check states already reached by other cases:

| Removed case | Replacement and preserved distinguishing assertion |
| --- | --- |
| `ordinary refresh keeps an explicit continuation proof` | `ended browser conversation continues explicitly without reposting` now dispatches focus after the native proof and verifies the Continue button remains visible before posting once. This tests the ordinary focus path, not only an HTTP-failure retry. |
| `archived native history restores through the same icon row` | `restart offers native continuation and archive without a handle` already archives, opens the native URL, restores through the header action, and continues after daemon reset. It now checks that the restore is enabled, the archived header passes axe, the restore action disappears after the click and the archive action becomes enabled. The separate workspace-archive and phone cases still cover their different entry points. |

The earlier edited-tree browser JSON (`/var/tmp/oh-speed-edited-browser.json`)
records 9.095 s and 8.856 s respectively for these two passing *individual*
cases, in a failing 151.8 s full run. These 17.951 case-seconds are a
potential reduction in aggregate work, **not** a demonstrated wall-clock
saving: remaining cases gained assertions, parallel scheduling varies, and
that run was not a passing baseline. No native/security case, UID boundary,
write recovery, or axe state/theme scan was removed. The archive and focus
assertions have the same real host boundaries in the retained cases. A focused
browser run of the two retained journeys plus the queue-clear 401, lost-reply
recovery and 600-workspace partial snapshot passed 5/5 in 18.2 s at
`OH_PORT_BASE=32000` (standalone, not a clean-gate timing). Queue-clear now
drains its held snapshot route after the 401 assertion before teardown;
that changes no authorization assertion and avoids disposing the response
while `route.fetch()` is still in flight.

The first committed-tree clean, no-reuse gate on `0d6080c6` **failed** after
319 s (setup 6 s, dependencies 59 s, web checks 27 s, browser 194 s,
Go/contracts 227 s concurrently; packaging not reached). Go/contracts passed;
normal browser had 160 passed, two capture-only skipped and two failures:
`pi-onboarding-race` never displayed Alice's device code (the page showed
"Tilaa ei voitu vahvistaa" under load), and the 600-row partial snapshot
still showed only "Ladataan" after five seconds. This is not a comparable
passing speed measurement. The output is local scratch in
`/var/tmp/oh-tenfold-gate-1.log` (the Playwright trace in the old worktree may
be overwritten by later runs). The salvaged browser case uses 513 rows: the
old bug truncated at 512, so the 513th row retains the exact boundary assertion
and reduces unnecessary DOM/input work. It waits up to 15 seconds for the
specific partial-source notice rather than mistaking an in-progress loading
view for an empty catalog. This is a longer *bound*, not a 15-second fixed
sleep. The separate Vitest reader still exercises a valid >1 MiB wire response.
No Pi race assertion or production authority code was removed.

## Landed slice validation (2026-10-15)

The two preserved commits above were cherry-picked onto `9b1d6d9d` as
`8876556c` and `d742aa06`. After those commits, with disk-backed
`TMPDIR=/var/tmp`, an unused `OH_PORT_BASE=39000` checked with `ss -ltnp`,
and `PLAYWRIGHT_BROWSERS_PATH=$PWD/.cache/ms-playwright`, focused Playwright
cases passed 4/4: native restart/archive/restore/continue, focus/explicit
continue without repost, queue-clear 401/login, and partial 513-row snapshot.
`npm run typecheck --prefix web`, `npm run lint --prefix web`, and
`git diff 9b1d6d9d..HEAD --check` passed. Targeted Vitest snapshot and
conversation tests passed 7/7, including the >1 MiB wire acceptance and the
four refusal-code classifications. Final diff review found the once-only
continue/send counts, CSRF and empty POST body, queue 401, archived header
axe and restore-state assertions still in the retained real-host cases; the
513th workspace remains visible and the byte limit remains covered separately.
No full clean gate or comparable before/after timing was run for this slice;
**no wall-clock speedup is claimed**. Distinct-UID security scenarios were
not run and cannot be inferred from the focused browser tests.

## Vitest jsdom/worker investigation (2026-10-15)

After the no-reuse gate on `7b02273a` failed one recap test at Vitest's
five-second default under host load (21 files, 68.32 s, 195.18 summed jsdom
environment-seconds), we measured options on the same **unchanged** web tree
at `b5a0b52d` with installed pinned dependencies and warm caches. Each wall
time below is a separate passing standalone unit run (`/usr/bin/time`, seconds):

| Configuration | Run 1 | Run 2 | Result |
| --- | ---: | ---: | --- |
| Existing default forks/isolation | 27.02 | 19.76 | 21 files, 126 tests passed twice |
| `--pool threads` with isolation | 21.46 | 22.12 | Passed twice, no clear saving |
| Default forks with `--maxWorkers 4` | 22.95 | 23.03 | Passed twice, no clear saving |

Vitest 5's own warning attributes much of the tracked work to creating 21
jsdom environments (62.20/80.41 summed seconds in the two default runs),
but the elapsed wall times overlap across workers and do **not** add up to
that figure. `--pool vmThreads` kept per-file isolation and ran in 14.88 s,
but failed two tests (124/126 passed): `ReadableStream is not defined` in
`AccountProfileOnboarding.test.tsx` and `github.test.tsx`. It also raised the
`time`-reported command max RSS from ~233 MiB with forks to ~1.6 GiB
(not aggregate memory across child workers). This is not a passing benchmark
or a safe substitution; sharing jsdom between
files via `--no-isolate` would instead discard the required per-file boundary.

The host was busy (load average roughly 22–37 on eight cores, with other
browser/build workers active), so these small, sequential samples are not
proof of a clean-gate speedup or reproducible capacity improvement. The
forks/4 and threads options were within baseline run-to-run spread. No Vitest
configuration, timeout or test assertion was changed. The next improvement
would need to preserve file isolation and DOM/stream semantics while passing
under concurrent gate load before changing the default. After the measurements,
the unchanged default unit suite passed again (126/126, 39.99 s under a busier
load), as did the component suite (115/115), typecheck, lint, format check,
project-view validation and `git diff --check`. There was no changed-tree
clean gate, browser run or separate-UID test.

## Queue-clear 401 browser-route teardown (2026-10-15)

On `69bf63a2`, the conductor's no-reuse clean gate ended after 197 s with
normal browser 162 passed, two skipped and one failed: queue-clear 401/login
threw `route.fulfill: Route is already handled!` after the old `/api/v1/snapshot`
response was held. Earlier standalone evidence also saw `route.fetch: Test
ended`. The log is `/var/tmp/oh-night-gate-after-install.jsonl`; the retained
trace was at `web/test-results/browser-conversation--brow-833ea-eue-clear-401-reaches-login-chromium/trace.zip` (subsequent tests may overwrite it).
Neither run is a passing speed baseline.

The browser can cancel/auto-handle the pending snapshot during the 401 login
transition. `release()` plus `unrouteAll({ behavior: "wait" })` alone does not
make a later `route.fulfill` legal. The test now explicitly observes its held
route's terminal outcome: a successful old response delivered after login, or
Playwright's specific `Route is already handled!` cancellation **after** login
is visible. A fetch error, non-200 upstream snapshot or any other route error
fails the test instead of being suppressed by blanket `ignoreErrors`. The test
waits for that route to settle before disposing routes/closing the fixture,
then checks login remains visible and the former editor is absent. It still
requires the actual queue-clear write to return 401, and it never releases the
successful old snapshot until the signed-out UI is visible. App snapshot reads
use an abort signal and a `ready()` guard before dispatch, while
`authenticationRequired` clears the snapshot (`web/src/app/App.tsx`, `store.ts`).
The browser may cancel the request rather than deliver it; this case cannot
claim that every repeat exercised delivery. No production or Go changes were
made. This is a reliability fix, **not** a measured gate speedup.

Validation on the changed test tree (from `69bf63a2`): installed pinned web
dependencies with `npm ci --prefix web --no-audit --no-fund`. Standalone
Playwright with `TMPDIR=/var/tmp`, `PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright`,
`OH_BROWSER_WORKERS=2`: the queue-clear case passed 10/10 at
`OH_PORT_BASE=34700` (34.3 s); the final run at `OH_PORT_BASE=34800` passed
50/50 in 1.7 min (`--repeat-each=10` for queue-clear, status 401, changed
snapshot identity, workspace identity isolation/expiry and explicit-retry
expiry). The final run used the finished test edits. Web typecheck, lint and
format check, `python3 scripts/validate-project-view.py` and `git diff --check`
passed.
These are same-UID synthetic host/browser checks, not a clean gate, separate-UID
security proof, or comparable elapsed-time measurement. The conductor owns
the next changed-tree clean gate.

## Synthetic slow-turn prompt audit (2026-10-15)

The fake Pi in `test/browser-host/fakepi.go` sleeps 2 s per phase for prompts
containing `hidas`, versus 200 ms per phase otherwise. Inspected each occurrence
in `browser-conversation.spec.ts` and `lab-conversation.spec.ts`; changed only
`home card blocks archive during Pi work, shows failure and removes on success`.
That case waits for the native answer before injecting `activity: "running"`
into a subsequent snapshot. Its disabled archive assertion tests the injected
snapshot, not an actual live slow turn; its re-enabled archive, refusal and
success assertions remain unchanged. The prompt and card selector now use
`päätyö` instead of `hidas päätyö`.

Retained the other browser slow prompts: steer/queue/clear and queue-clear 401
need a real working queue; the stale-working-view case holds a follow-up request
until the original turn goes idle; switching-agent drafts checks an unsent draft
while streaming; the pending-ack case needs the queued command to remain pending.
Retained the lab slow prompts: recap invalidation checks the stale card vanish
in both tabs while the second turn is underway; the real-controller case checks
live progress before settlement; typed-journey checks transient thinking/tool
fragments before saved blocks; intermediate-message and stop-confirmation cases
check working progress before the visual-hold turn completes. No fake-Pi timer,
production behavior, deadline or concurrency setting changed.

Focused Playwright before/after on this worker, one worker, same
`OH_PORT_BASE=52300`, installed pinned dependencies and warm browser/build caches:
`home card blocks archive during Pi work, shows failure and removes on success`
passed in **9,397 ms** before and **3,828 ms** after (Playwright JSON case
durations; standalone runs sequentially). The case saved 5,569 ms of measured
case time in this pair, not a full-gate wall-time improvement; host contention,
build/cache state and scheduling can vary. Both runs built and used the
synthetic browser host; neither is distinct-UID or real-Pi evidence. The
conductor owns the full clean gate.
Web typecheck, lint and format check passed after the edit; `git diff --check`
passed. Final diff review: the only assertion-related change is matching the
home card's new prompt text; answer-settlement still precedes the fabricated
running snapshot, and all archive transitions are still asserted. No lab case
was changed, so no lab run was needed for this slice.

## Receipt and continuation case-level pass (2026-10-15)

The edited-tree browser JSON at `/var/tmp/oh-speed-edited-browser.json` starts
with an npm build preamble before the Playwright JSON. It records individual
*passing* cases on a **failing** 151.8 s run, so its durations are cost
orientation only, not a passing before baseline. This pass removed two cases,
not the pending/rejected/uncertain or lost-ack matrix:

| Removed browser case (edited-tree case duration) | Distinguishing incorrect implementation and retained proof |
| --- | --- |
| `validated accepted send receipt never reposts` (5,786 ms) | A matching accepted status might fail to clear a submitted draft or repost on manual refresh. The normal `create, send once, reconnect and old history stays read-only` journey checks native acceptance, cleared draft, one POST and reload; `a lost accepted send resolves on reload without another write` checks that the *same native write* reconciles to an empty editor with exactly one POST even when its HTTP reply is lost. The accepted-specific static marker (`.ah-send-accepted` absent) is no longer pinned directly; the retained native send/reload case instead checks that the pending notice disappears and the editor stays usable. Rendering a redundant accepted marker without changing delivery is a presentation regression, not an additional once-only write failure. The retained pending/rejected/uncertain receipt cases still cover the intercepted status path, `refreshConversation`, no repost and the shared matching-status/no-additional-lookup branch. |
| `lost reply looks up matching command without repost` (5,871 ms) | Despite its name, this case deleted `send_receipt` from status but did **not** delete the accepted `ack`; it asserted `lookups === 0`, not a fallback lookup. In `useConversation.ts` a matching command falls back to `ack` before doing a receipt GET. The retained native send/reload and lost-accepted-reply recovery cases catch failure to accept without repost; the remaining receipt variants check no unnecessary lookup when status is matched. This did not exercise the missing-command-ID fallback. The exact accepted-ack preference over an extra GET is no longer directly pinned, but an extra read alone is not a correctness/security failure and does not justify another synthetic host. |

The pending receipt variant stays because a validated `pending` **status** is
not the same as the in-flight 404 receipt or a pending follow-up ack. Rejected
stays because it must retain the unsent text instead of clearing it. Uncertain
stays for copy/disabled controls. The accepted lost reply via reload and via
HTTP snapshot without SSE are separate recovery paths; daemon 404 versus
missing command receipt (unknown, not rejected) are separate failure states.
The held late-continuation reply, snapshot-stale continuation, writer-conflict
refusal, and native restart/restore cases retain different race/ownership
assertions. None is replaced with a same-UID component mock, and none of this
establishes distinct-UID user isolation.

Focused verification on this changed tree (`OH_PORT_BASE=53000`, two browser
workers, cached Chromium, disk-backed `/var/tmp`) passed 7/7: the three
retained receipt outcomes, native send/reload, lost accepted reply/reload,
writer-conflict continuation refusal/reload and lost continuation reply/HTTP
recovery. Their summed Playwright case durations were 43,055 ms; the same
seven titles totalled 53,118 ms in the earlier failed full-run JSON, plus
11,657 ms for the two now-deleted cases (64,775 ms for those nine). Different
host load and scheduling, and especially the earlier **failed** run, prevent
calling that difference a passing-suite speedup. No clean gate or separate-UID
scenario ran here; the conductor owns the clean gate. Web typecheck, lint,
format check, focused conversation Vitest (6/6), complete web unit suite
(126/126 across 21 files), project-view validation and `git diff --check`
passed.

## Native history title after archive/restore (2026-10-15)

The clean gate on `5cb58dd3` failed the combined archive/restore/title browser
case while 160+ other normal cases passed. Its retained trace (in the main
checkout's `web/test-results/native-history--native-his-6eed2-ion-can-archive-and-restore-chromium/trace.zip`)
shows the exact title POST at 18:39:56 UTC:
`/api/v1/conversations/11111111-1111-4111-8111-111111111111/history_title`
returned **409 Conflict** in 519 ms. It had the authenticated browser cookie,
CSRF header and `workspace_id` JSON body; snapshot reads immediately before
and after archive/restore showed active → archived → active, readable native
history, a first-prompt fallback title and `process: not_observed`. The
browser then displayed its explicit “Otsikkoa ei voitu luoda” warning. The
trace does not retain the 409 response body, so it cannot distinguish the
controller's `control_uncertain` from `writer_conflict` precondition or prove
which internal check changed. It *does* rule out a five-second model latency,
missing auth, or a title-generation success whose UI simply lagged. The
fixture seeds 251 readable native entries and the test controller uses a
fixed synthetic title rather than a provider; no malformed synthetic title or
real model request was observed. A native write may be refused when its
ownership/revision proof cannot be re-established; that is a legitimate
non-success, not a product promise of a successful rename after every restore.

The archive/restore test still exercises both real actions and clicks the
actual title control. It now distinguishes a 409 refusal (must show the warning
and **not** claim the title) from a 200 successful rename (must display the
native title). A separate settled-history browser case requires a 200 title
POST *and* the refreshed native header to show “Synteettinen otsikko”; this
keeps the successful Pi naming path mandatory instead of accepting all 409s
as a substitute. No production code, fake Pi, synthetic history or timeouts
were changed. The test checks status and visible outcome, not Playwright's
`response.json()` after navigation: a first diagnostic run passed 10/12 but
two successes lost the CDP response body when the app refreshed immediately.
The initial unmodified test passed 10/10 in isolation (26.5 s), which did not
explain the gate's refusal. Those are not full-gate or real-provider results.

On the final edited tree, the two focused Playwright cases passed **20/20**
(`--repeat-each=10`, two workers, `OH_PORT_BASE=59000`, disk-backed
`TMPDIR=/var/tmp`, cached Chromium; 38.5 s). Each of the ten settled-history
cases required the real title POST and visible name. Web typecheck, lint,
format check, project-view validation and `git diff --check` passed. The
conductor owns the full clean gate; these isolated same-UID synthetic checks
cannot establish behavior under full-suite host load or distinct-UID isolation.

## Onboarding notice accessibility scope (2026-10-15)

The clean gate on `b3c0a5d1` failed `@a11y failed session check offers reload
under the repository card` at the 30 s test deadline. The error pointed at
`finally`'s fixture reset, but the retained trace in the main checkout's
`web/test-results/onboarding-notices--a11y-f-935da-d-under-the-repository-card-chromium/trace.zip`
shows that reset was only where the expired deadline surfaced: the reload
`locator.click()` began after the two full-page axe scans, resolved the button,
then saw it detach while waiting for click actionability and did not complete
before timeout. The trace does not establish whether the detach was a background
rerender or the start of the reload. Swallowing cleanup or lengthening the
30 s deadline would not establish that the reload worked.

`onboarding-notices.spec.ts` now scopes its two login-error scans to the error
`aside.ah-notice` and its failed-session scan to the repository notice at phone
width. Both cases still measure the notice against its card at desktop (1280)
and phone (390), including page overflow. The failed-session case still requires
the actual 503 session failure and its message, checks the notice/reload control
with axe, tabs away and back to establish keyboard reachability, activates reload
with Enter, and requires the restored GitHub catalog. Keyboard activation also
avoids Playwright click actionability waiting across a potentially remounting
reload button. The separate catalog-retry case still checks read-only retry
without clone.

Lost proof: full-page axe at both widths for the login-error and failed-session
screens (four scans), including any issues outside the notice introduced only
in those states; the failed-session notice is now scanned at phone width only.
Retained/overlapping proof: `shell-accessibility.spec.ts` scans the signed-out
page, shell at desktop/640, chooser and next first-use step; `design-system.spec.ts`
scans the catalog in happy/unhappy states and both themes;
`workspace-slice.spec.ts` scans multiple host-backed catalog states for
serious/critical violations. None scans this particular failed-session notice,
so its scoped zero-violations assertion stays. An issue confined to desktop
notice color contrast could escape the phone-only axe scan; contrast tokens
and the notice component are shared between widths, while alignment remains
checked at both. No exact-pixel style checks were changed.

On this worker with pinned dependencies, cached Chromium, `TMPDIR=/var/tmp`,
`OH_PORT_BASE=52000`: the unchanged failed-session case passed in **3,093 ms**
(standalone Playwright JSON case duration, warm build); the changed case passed
in **3,467 ms** (same case in a three-case passing spec, 3/3). These are
passing before/after case seconds, **not a measured speedup**: schedule,
contention and spec composition differ. The changed case passed 10/10 repeats
(two workers, case durations 2,815–4,209 ms, 25.6 s whole run); all three
cases passed together. Web typecheck, lint and format check passed. This is
synthetic same-UID browser-host evidence, not a changed-tree clean gate,
real-provider evidence or distinct-UID proof. The conductor owns the gate.
