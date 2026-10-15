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

The full gate deliberately performs a second offline `npm ci` after deleting
`web/node_modules`, to prove the lockfile is complete offline (see
[web/AGENTS.md](../../web/AGENTS.md)). It is a fixed cost, not an example of
an obvious unit test to delete. This pass did not alter the release gate or
its receipt semantics.

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
