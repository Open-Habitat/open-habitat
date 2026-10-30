# Result

The table check in `web/tests/browser-editor.spec.ts` no longer reads either
side once. The editor's line (`before`) counts only when two polled reads
agree, and the table's top row is polled until it is within one line of
`before`. This change touches only the test.

## What was checked in the product

The table's scroll restoration (`arrive` in `BrowserEditor.tsx`) is
synchronous. It runs in the same effect that focuses the preview, and the
spec already waits for that focus. The rows have fixed heights
(`white-space: pre`, no webfonts, the CSS loaded eagerly). Temporary
diagnostics recorded `scrollTop` and the top row over 1.5 s after the switch,
plus every scroll event on both scrollers. In 7 loaded full-spec runs and
6 runs at 8× and 20× CPU throttle (CDP), the preview landed on line 103 in its
first frame and never moved. The one transient they showed was on the editor's
side: after the test's jump, the editor stood at its estimated height
(scrollTop 3921) for one frame, then corrected to 2075. The failure did not
reproduce on current `main`, so the exact 29.10. race is not proven. The
likeliest one is that `before` was accepted at the first value over 20 while
the editor was still settling.

## Evidence

5 of 5 full `browser-editor.spec.ts` runs passed (22/22 each) with
`OH_BROWSER_WORKERS=2`, `OH_PORT_BASE=9300`, alongside a `timeout`-bounded
`browser-conversation.spec.ts` run (`OH_PORT_BASE=9400`) on Birch.
`browser-conversation.spec.ts` lost 3 cases per run in that setup because
both runs rebuilt `web/dist` and `.cache/browser-host` in the same worktree.
That spec passed 74/74 on its own. `./scripts/test-focused.sh --area web`
passed.

## Decisions for later review

- **Test-only fix, not a product change.** The alternative was to restore
  the table on a later frame or after a settle signal. Nothing showed the
  restoration itself to be wrong, so a product change would have been a guess.
