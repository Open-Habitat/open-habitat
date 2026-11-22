# Result: reproduction coverage added; reported failure remains unresolved

No production fix is claimed. The existing real-browser popup test passed on
unchanged production code. An extended regression also passes for a feature
popup at `about:blank#popup`: the status inventory includes both the opener and
the popup, the popup's × closes it, the original opener keeps its identity, and
keyboard input reaches that opener without selecting it again.

The work is preserved without merging because the reported missing opener has
not been reproduced or explained. The issue remains open work, not fixed or
classified as an invalid report.

## Findings

- `internal/browserhost/control_linux.go` already closes through
  `Target.closeTarget`. Before sending it, the handler fetches fresh page
  targets from Chrome and refuses a missing target or fewer than two pages.
- `BrowserWindowList` in `web/src/components/ServerBrowser.tsx` disables × when
  the inventory has fewer than two windows. A singleton inventory therefore
  explains why × would not act; it does not explain why the opener was absent.
- The browser-host inventory includes every valid page target returned by
  Chrome. The daemon's `fromHost` conversion is shared by browser and agent
  status and has no window-count cutoff. No production change was justified
  from the available evidence.
- A temporary real-Xvnc restart experiment observed both main and popup before
  and after shutdown/restart. Its subsequent keyboard assertion failed, so it
  does **not** establish complete post-restart interaction. The temporary test
  modifications were removed; the observation is retained in `restart.log`.
- A separate disposable headless Chrome probe opened the blank popup from the
  initial New Tab page. Both pages appeared before and after graceful restart.
  This is a direct Chrome observation, not installed-server evidence.

## Changes

Extended `web/tests/server-browser-popup-native.spec.ts` with a blank feature
popup opened by `window.open`, an exact two-target status assertion, a close
through the actual viewer list, stable opener identity, and real keyboard input
to the remaining opener. Existing normal-popup and self-close coverage remains.

## Verification

Base revision: `18c67cfad`. Production code remains unchanged from that base.
Final test code was checked with:

- `./scripts/test-focused.sh --area go --go-package ./internal/browserhost`:
  passed.
- `OH_BROWSER_ACTION_CHROME=/usr/bin/google-chrome ./scripts/test-focused.sh
  --area go --go-package ./internal/cli`: passed, with the native CDP fixture
  enabled (including its existing popup/tab close checks).
- `BROWSER_HOST_REAL_BROWSER=/usr/bin/Xtigervnc:/usr/bin/google-chrome
  OH_BROWSER_WORKERS=1 OH_PORT_BASE=17400 ./scripts/test-focused.sh --area browser
  --spec server-browser-popup-native.spec.ts`: three separate final runs passed.
  Runs used the focused runner's reply jitter, private scratch lease, umask 077
  and outer 180-second timeout. This was three invocations, not an accepted
  `--repeat-each` option: the shell wrapper rejects that flag.
- From `web/`, `node_modules/.bin/biome check --error-on-warnings
  tests/server-browser-popup-native.spec.ts`: passed.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, and
  `git diff --check`: passed.

Initial setup attempts lacked web/Pi fixture dependencies; these were installed
before successful tests. One browser attempt found an occupied port; the final
runs used a different port base. No whole browser suite, clean gate, live
installation check, or claim of a repaired deployment is included.

External evidence: `/var/tmp/agent-keep/server-browser-popup-close-noop/`:
`baseline.log`, `go.log`, `cli.log`, `final-native-1.log` through
`final-native-3.log`, `restart.log`, and `restart-probe.log`. All experiments
used disposable profiles and synthetic pages. No captured HTML or images enter
git.

## Review

Focused self-review: test-only change, no authority, contract, daemon state,
CDP multiplexing or control-handover change. The added assertion checks a real
inventory boundary and verifies input reaches the surviving original page;
it does not merely check the supplied popup title. An independent model review
was not required and was not run.

## Decisions for later review

- **Do not invent a replacement opener or remove last-page protection.** Those
  could make a singleton popup closable, but would hide rather than explain the
  lost original page. The alternative was an automatic new blank window on
  last-page close; there is no evidence that this repairs the reported failure.
- **Do not classify the report as cannot-reproduce/closed.** Synthetic passing
  tests do not disprove the observed failure. Preserve the regression and the
  unresolved inventory question for a later reproduction with the exact
  sequence of native window actions and any intervening restart.
- **No user-visible release note.** There is no production change to try, so
  adding a success claim to a private test checklist would be misleading.
- **No merge.** The requested fix and live confirmation are not established.
  Return an unsuccessful terminal report with these limitations rather than
  merge test coverage as though it fixed the bug.
