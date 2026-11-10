# Result

Fixed a spec race, not a background-read product defect. Only
`web/tests/browser-shell.spec.ts` changes.

## Cause and fix

The spec dragged immediately after maximize/restore. The panel's layout changes
before `Terminal.tsx`'s ResizeObserver fits xterm. Xterm 6's SelectionService
explicitly clears selection on a row-count change. A gesture made before that
callback is therefore cleared by the resize the test itself requested.
`BrowserShell.tsx` keeps the connection/surface on ordinary list refreshes;
`Terminal.tsx` mounts its xterm in an empty-dependency effect. No background-read
remount/reset was found.

A temporary, spec-local ResizeObserver wrapper held only the terminal callback
at maximize, then released it 100 ms after the selection mouseup. This reproduced
the reported missing-highlight assertion. With the new row-count wait, releasing
the held resize after 500 ms instead passed. The instrumentation was removed;
no production timing or test seam was added. The original uninstrumented gate
interleaving was not reproduced, so its exact callback order cannot be proven
from the original report alone.

The spec now waits for the rendered xterm row count to change after both size
toggles, before selecting. It asserts the highlight immediately and again after
an actual successful terminal-list background read, rather than sleeping two
seconds (shorter than the three-second poll). Clipboard text and composer text
assertions remain exact; no timeouts were increased or selection retried.

Stress also exposed close-control help intercepting the adjacent restore button.
The journey explicitly dismisses that help with Escape before restoring; moving
the mouse away alone did not reliably dismiss the focused tooltip.

## Evidence

Birch, synthetic host with real tmux/bash, Chromium; base commit
`fed21d3319aad83335462b2b5520891030d30f31`. Final tested spec SHA-256:
`710d8b991c9d7d29cb2a16be37b873631accf77325bbdb1103b9a8b3c0028ee1`.
All native browser runs used umask 077, a fresh short `/var/tmp/oh-XXXX` TMPDIR,
`OH_PORT_BASE=15300`, and two browser workers (controlled experiments: one).

- Before edits: 18/18 target cases passed across `selection-a`, `selection-b`,
  `selection-c`, each six repeats, 250 ms jitter and CPU 4×; respectively one,
  four and eight timeout-bounded CPU hogs. This alone did not reproduce the race.
- Controlled callback experiment through `./scripts/test-focused.sh --area
  browser --spec browser-shell.spec.ts --tag 'multi-line paste'`: original
  ordering failed at the highlight assertion; resize-state wait passed.
- Final detector: `cd web; OH_CPU_THROTTLE=4 OH_REPLY_DELAY_MS=250
  OH_REPLY_SEED=<seed> npx playwright test tests/browser-shell.spec.ts
  --grep 'multi-line paste' --repeat-each 6 --trace off`, for seeds `selection-a`
  and `selection-b`: **12/12 passed** (59.2 s and about 60 s).
  Four `timeout 240 sh -c 'yes >/dev/null'` processes ran beside these tests,
  with an EXIT trap to terminate them early. Each Playwright command also had
  `timeout 110`; the suite lock excluded another whole-suite run.
- Final default focused jitter: `OH_REPLY_DELAY_MS=60
  OH_REPLY_SEED=selection-default npx playwright test tests/browser-shell.spec.ts
  --repeat-each 3 --trace off`: **36/36 passed**, including the file's accessibility
  checks (2.6 minutes). Wrapped in `timeout 240` under the suite lock.
- `timeout 240 ./scripts/test-focused.sh --area web`: passed static checks and
  **206 test files / 1553 tests**.
- `git diff --check`, `issuectl doctor --json`, and
  `python3 scripts/validate-project-view.py`: passed.

Intermediate detector runs found the tooltip interaction above. One detector
attempt overlapped main's whole gate (observed host load 39) and exhausted the
unchanged 30-second test budgets at several different steps. It was not counted
as a pass; final runs acquired the suite lock before adding controlled load.

Review: local source/diff review and controlled negative experiment, proportionate
to a test-only change. No sessions, contracts, daemon state, authority or product
code changed; an independent LLM review was not required. No full suite, clean
gate or live-server test was run. No KOKEILTAVAA entry: there is no shipped UI
change to try.

## Decisions for later review

None: waiting for the test's requested resize is within the agreed spec-fix scope.
