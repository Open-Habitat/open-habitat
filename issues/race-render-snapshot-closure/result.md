# Result

Implemented on Birch from `7b609ac0`, with the sweep instrumentation applied locally and removed before commit.

## Product changes

- The authenticated journal delivers tool notifications synchronously, before a subsequent settlement can retire the live window. Arguments are taken from the current event accumulator when Pi's completion omits them. The editor subscribes independently of conversation rendering.
- Accepted snapshot tails that overtake SSE deliver unseen completions too; the existing instance/sequence cursor excludes already accepted completions. No second history store or persistent deduplication cache.
- Newly created conversations resolve their workspace from the confirmed creation reply until discovery catches up. Requiring snapshot metadata here caused intermittent missing attribution in intermediate browser runs.
- Workspace Undo captures the current route at press time. A retained card handler invokes the current page callback rather than its old render's callback.
- A view's new tab resolves its address through the existing host entry page. A cached URL is insufficient when another tab deleted it and the focus refresh is still pending.

## Detectors and counts

Failures/runs. All local delay runs used `OH_PORT_BASE=10950`, two workers, `BROWSER_HOST_REPLY_DELAY_MS=250`, `OH_TIMEOUT_SCALE=4`, and `--repeat-each 2`. The raw logs are in `/var/tmp/oh-render.ZWk8AI/` (disposable; conclusions are preserved here).

| Sweep case (original line) | Sweep CPU4 | Local before D250×4 | Final D250×4 | Final CPU4 + D250×4 |
|---|---:|---:|---:|---:|
| browser-editor-concurrent :66, two layouts | 4/6 | 0/4 | 0/4 | 0/4 |
| browser-editor-concurrent :137 | 1/3 | 0/2 | 0/2 | 0/2 |
| browser-editor-concurrent :158, two layouts | 3/6 | 0/4 | 0/4 | 0/4 |
| view-links :163 | 0/3 | 2/2 | 0/2 | not run |
| lab-workspace-page :180 | 0/3 | 1/2 | 0/2 | not run |
| lab-workspace-page :431, card archive Undo | 2/3 | 0/2 | 0/2 | 0/2 at CPU6 |

Final logs: `verified-delay.log` (12/12), `verified-cpu.log` (10/10), `lab-verified-final.log` (4/4); CPU6 Undo `undo-cpu.log` (2/2). No CPU busy loops or whole browser suite were run. CPU results here are on the shared host without deliberately added host saturation, not a reproduction of the sweep's exact loaded environment.

Focused entrypoints ran browser-editor-concurrent, view-links and lab-workspace-page; the latter full spec passed 8/8 before its final readiness corrections. Final repeated targeted cases above cover every changed browser journey. `./scripts/test-focused.sh --area web`: 166 files, 1236 tests passed, plus static checks. No Go or contract product files changed.

## Deterministic mechanism tests

Vitest steps tool completion then settlement synchronously without rendering, checks replay/unsubscribe, covers new-conversation metadata lag, and exercises snapshot-ahead and recovery-tail orders without duplicate reports. A retained card press is invoked after rerendering with another route's callback. The existing view-tab test now requires host resolution even with a cached address.

A mutation probe disabled event subscriptions and restored the captured card callback: five regressions failed in an 860 ms Vitest run (27 existing cases still passed). Restoring the fix passed all 37 tests in the three focused files. Snapshot tests also caught an initially incomplete synthetic event fixture; the fixture now includes its required timestamp and settlement state.

## Spec changes and why

- The typing-pause case drives the two-second product timer with `page.clock`, rather than letting axe/automation consume that pause. axe runs after importing with the clock resumed: it needs timers itself. Content, pending/imported, undo/redo, save, geometry and accessibility assertions remain strict.
- The workspace journey waits for confirmed creation and its route replacement before leaving the placeholder, includes the created card before capturing the list, and waits for the final hide response before reload. Optimistic visibility is not disk persistence. This corrected independently observed late-navigation, extra-card and lost queued-write test races.
- The view-link leak check uses request-event headers synchronously. Async `allHeaders()` could remain pending on redirects, fail at teardown or hang a drain. Referer is available in Chromium's ordinary request-event headers; cookie/security-header completeness is not needed. Leak assertions remain, including a final assertion after the journey.

Intermediate failures were investigated, not treated as passes: missing Pi arguments, missing new-agent metadata, snapshot reseed bypass, timer-vs-axe deadlock, and the spec races above were corrected. One repeat had `Unable to preload CSS ... BrowserDocument` before reaching the editor; later fresh runs passed. No assertion was relaxed to hide it. The first web-focused check rejected formatting in the throwaway instrumentation; the clean-tree check passed after removing it.

## Review

Independent `/llm-review` and `/assess-findings` because the journal's live event path changed. Finder `claude-fable-5-1` found the reachable snapshot-reseed bypass; `gpt-6-astra` independently verified it. Fixed and pinned with two tests. The speculative throwing-observer candidate was dropped: today's observer queues a caught promise, and no reachable synchronous throw was established. Local final review covered subscription disposal, identity/CSRF remount, replay filtering, arguments only on tool start, newly created agents, and final spec changes. Local reports: `history/review-render-snapshot.md`, `history/assessment-render-snapshot.{json,md}`. Model scores were logged to Alder's corpus.

## Decisions for later review

- Observe background agents in the open document's workspace too, rather than only the rendered conversation: they can change the same file. Other-workspace reports are ignored by the document controller.
- Resolve view tabs through the host instead of trusting the rendered URL or awaiting a focus refresh. This adds a resolver navigation but retains synchronous popup opening and uses the current address authority.
- Across an outage longer than the bounded journal tail, attribution cannot be reconstructed. Existing focus and pre-save disk reads remain the fallback; this change does not invent agent attribution for missing history.

## Integration validation

Rebased onto main after `race-ordering-harness` landed; only the adjacent KOKEILTAVAA lines conflicted, and both were retained. `git range-diff` showed no product/spec changes from the rebase. On rebased product commit `5e52895c`, the maintained harness with `OH_REPLY_DELAY_MS=250 OH_REPLY_SEED=render-final OH_TIMEOUT_SCALE=4 OH_PORT_BASE=10950 OH_BROWSER_WORKERS=2` passed:

- web-focused static/unit/component checks: 167 files, 1238 tests;
- browser-focused editor spec: 5/5;
- editor + view-links :163, `--repeat-each 2`: 12/12;
- lab workspace sidebar/Undo cases, `--repeat-each 2`: 4/4.

Logs: `rebased-web.log`, `rebased-editor.log`, `rebased-repeat.log`, `rebased-lab.log` in the scratch directory above. `issuectl doctor`, project-view validation and diff whitespace checks passed. This final addition records evidence only.

Evidence is host-backed synthetic browser behavior and unit ordering, not native provider behavior or distinct-UID isolation. No deployment, full gate or whole-suite result is claimed.
