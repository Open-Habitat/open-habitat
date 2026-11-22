# Browser visit data

Implemented the data side only; no card UI, deployment or visible test-server change.

Targeted CLI actions now carry page URL/title and an explicit browser action;
click/type carry selectors, and click/type/eval carry their source page so the
record need not parse shell arguments or show typed text/script contents.
Existing result fields remain. Downloads additionally carry file name and target
folder. Goto and immediately observed click navigations wait for load; close
uses browser-level metadata so a modal dialog cannot block recovery. The existing
browser-host CDP relay already carries these messages; it needed no change.

`web/src/app/turnBrowserVisits.ts` exports the pure `turnBrowserVisits(steps,
audience)` derivation, consuming the same `ToolStep` shape as `turnChanges`.
It produces one summary per turn and owner-only detail; participant results have
no detail property. Pages expose origin/path/title, never URL query, fragment or
credentials. Downloads expose name/folder, click/type expose selectors and eval
is an action kind only. Nothing is persisted.

## Integration handoff

The later card implementation must supply full saved bash result blocks from
native history, not history-page previews. `TurnChangesSource` currently fetches
full outputs only for file reads; do not reuse its file-specific output filtering
for browser visits. This task deliberately adds no mounted source or final card.
The audience parameter is a presentation projection, not permission to fetch
owner history. Existing history authorization remains unchanged.

Coverage is explicitly `command-results-only`: completed recognized CLI outputs,
not arbitrary external CDP clients, later timer-driven navigation, or a browser
history log. Old outputs, failed tool calls and mixed/truncated output cannot
establish complete visits and are ignored. Several whole JSON envelopes in one
bash call are supported. Summary counts are observed evidence, not semantic
claims about bookings, submissions or every resource the page loaded.

## Decisions for later review

- Add `browser_action` and source-page fields rather than infer command identity
  and selectors from arbitrary shell syntax. The alternative shell parser would
  misread wrappers, quoting and multi-command calls; explicit results are native
  history evidence and additive to the CLI contract.
- Count each goto, including revisits. Count a click's resulting page only when
  its before/after URL differs beyond the fragment; retain query differences for
  counting but never expose them. Fragment-only anchors and hash-router changes
  remain actions, not separate page visits. The alternative full-URL comparison
  inflated page counts for ordinary accordion/anchor clicks.
- Preserve origin-only all-tab/status listings: they have no single acted-on page.
  Close reports its last browser-level target title/URL, not renderer-evaluated
  document metadata, so modal dialogs do not remove the recovery path.

## Verification

Tested the implementation based on `73524a1b41686aab76b7648d31eec0d9ba2786e7`;
final evidence corresponds to the code committed with this result.
All commands used private scratch, umask 077 and bounded execution.

- `./scripts/test-focused.sh --area go --go-package ./internal/cli`: passed.
- `./scripts/test-focused.sh --area go --go-package ./internal/browserhost`:
  passed (selected separately from the CLI package).
- `./scripts/test-focused.sh --area web`: passed; 247 files, 2015 tests, including
  seven new visit-derivation tests, static checks and component tests.
- `./scripts/test-focused.sh --area contracts`: passed; generation clean,
  109 schemas, 174 fixture files, 44 scenarios and negative checks.
- Native `TestBrowserActionsNative`: production CLI/host against synthetic sites,
  sandboxed Chrome, three consecutive final passes. Held goto and click redirect
  loads, post-navigation metadata, original authenticated multichunk download,
  selectors, eval, screenshot and last-tab behavior covered. Added modal-dialog
  close regression failed before the review fix and passed afterwards.
  The local Chromium could not start its sandbox; the test was cross-compiled
  through the focused runner (`GOARCH=amd64`, `GOFLAGS=-c -o=...`) and executed
  on a qualified Linux host with `OH_BROWSER_ACTION_CHROME` and short private
  TMPDIR. No sandbox bypass. This is same-UID synthetic evidence, not installed
  services, VNC, a real account or distinct-UID isolation.
- No Playwright specs touched, no whole browser suite or clean gate run.
- `git diff --check`, project-view validator and issuectl doctor: passed.

Evidence retained at `/var/tmp/agent-keep/server-browser-visit-data/` (test logs,
review and assessment). No captured HTML or images committed.

## Review

Independent `/llm-review` with claude-fable-5-2, then gpt-6-astra verification of
the two surviving findings; `/assess-findings`: two confirmed FIX rows, both
implemented and regression-tested. Routine risk: additive CLI output contract,
CDP event ordering and privacy projection; no new authority or stored state.
The review caught renderer-dependent close and fragment-only page overcounting.
No surviving finding required a new issue. Performance logging disabled for
this no-push worker; review/assessment evidence is retained locally.
