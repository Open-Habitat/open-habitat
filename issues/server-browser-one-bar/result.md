# Result

The live viewer has one top bar for the turn, agent request, take/done controls,
clipboard popover, stop and close. The canvas has no edge tabs; its dashed agent
border and solid accent person border remain. The experimental feature gate and
viewer input/state logic are unchanged.

The presentation component portals its existing controls into the sheet header;
no clipboard or turn state moved into the sheet. Rebased onto the password-entry
change (`7e323044`), retaining its masked input, explanation and tests. The card
worker had not landed when this result was prepared.

## Verification

Implementation: `d726e96c` (same tested browser sources as `435ae462`; the later
rebase brought only prototype/issue files). Checks used umask 077, the shared
scratch lease, bounded timeouts and at most two browser workers.

- `./scripts/test-focused.sh --area web`: passed static checks and 2,025 tests
  in 248 files.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15300 ./scripts/test-focused.sh --area browser --spec server-browser.spec.ts`:
  all 11 cases passed after integrating the password-entry change.
- `npx playwright test tests/server-browser.spec.ts --repeat-each 3` from `web/`,
  with two workers, isolated leased scratch and 0–60ms reply jitter: 33 passed.
- The extended phone case checks the four actions in one non-overlapping row at
  320px, their containment in the top bar, the popover below the bar, usable
  canvas width and an empty Axe violation list with a long agent request.
- Temporary synthetic-lab capture case: passed. Reviewed desktop agent/person,
  desktop clipboard, phone request and phone clipboard screenshots. Paired inert
  HTML snapshots and PNGs, capture source and logs are retained outside git at
  `/var/tmp/agent-keep/server-browser-one-bar/`.
- Focused self-review of the final diff: presentation-only risk; handlers,
  noVNC effects, clipboard clearing, keyboard interception, idle timers and
  authorization were not changed. No independent model review was needed.
- `issuectl doctor --json` and `git diff --check`: passed.

Early runs exposed missing local dependencies (installed from the lockfiles),
a keyboard-inaccessible scrolling request region (made focusable), and the lint
suppression placement for that region (corrected). All required final checks
passed. Native Xvnc/Chrome keyboard qualification and live-server verification
were not run; the synthetic peer proves event routing, not native Chrome input.
No whole browser suite or clean gate was run.

## Decisions for later review

- Narrow screens keep the same actions as icons with accessible names and title
  tooltips; the sheet title is visually hidden. Alternative: wrap the actions
  into another row. Chosen to keep the requested single bar.
- Long agent requests remain in a bounded, keyboard-scrollable header region,
  rather than growing the toolbar or dropping the request. The existing request
  text is preserved in full.
- The clipboard remains an overlaid panel below the bar on phones as on desktop,
  instead of pushing the canvas down. Its width and height stay within the view.
