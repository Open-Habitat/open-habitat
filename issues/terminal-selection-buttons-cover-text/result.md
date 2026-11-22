# Result

Selection actions use the selected rows' full bounds, including the terminal's
padding and viewport offset, and the toolbar's measured dimensions. They appear
above the first selected row when possible, otherwise below the last row, with
horizontal clamping. Selection geometry refreshes on scrolling and resizing.
Copy and send-to-conversation callbacks are unchanged.

The old anchor was already xterm's normalized **start**, not its last line.
The actual problems were missing screen padding, missing bottom bounds, a fixed
40-pixel offset, and clamping negative top coordinates into the selection.

## Decisions for later review

- When neither side has space, use the panel header outside terminal content.
  This temporarily covers part of the tab strip; hiding actions would make them
  unavailable, while inserting a row would resize the terminal and could clear
  the selection. The same fallback handles tmux OSC 52 copies, which contain no
  selection coordinates. Normal selections keep the actions beside their rows.

## Verification and review

Tested the final code diff based on `b6b25172d99b980b702bfa374cd2fbc75b181efc`.
All heavy checks ran with `umask 077`, a scratch lease and bounded timeouts.

- `./scripts/test-focused.sh --area web`: passed lint, TypeScript and all
  249 test files / 2031 tests, including six positioning tests.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15300 ./scripts/test-focused.sh --area browser --spec browser-terminal.spec.ts`:
  passed all six terminal browser cases during development.
- Final spec: `npx playwright test tests/browser-terminal.spec.ts --repeat-each 3`
  from `web/`, with two workers, the same port base, private scratch and
  `OH_REPLY_DELAY_MS=60`: 18 passed.
- Final synthetic capture run through the focused runner with one worker and
  `--tag 'selection actions stay'`: passed. Plain selection with mouse reporting
  disabled and Shift-selection inside real tmux cover single/multiple rows at
  both edges and a viewport-filling range. Assertions check the actual selected
  row extent as well as non-overlap and panel containment. Existing clipboard,
  tmux redraw and Mac shortcut cases remain green.
- Focused self-review: low-risk browser layout change; no session ownership,
  wire contract, daemon state or authorization change, so no independent model
  review required. Reviewed geometry, exclusive end-cell handling, observer
  cleanup, fallback placement and unchanged actions. Screenshot inspection caught
  a test setup problem where the preceding toolbar intercepted the next drag;
  tests now clear through Copy and verify the intended range explicitly.
- Synthetic PNG/HTML pairs and logs are retained outside git under
  `/var/tmp/agent-keep/terminal-selection-buttons-cover-text/`. Inspected
  `shots/placement-shift-4-6.png`, `shots/placement-plain-0-2.png` and
  `shots/placement-shift-0-8.png` for above, below and header placement.

Initial checks found a missing story bound, lint warnings and an absent Pi SDK
fixture; these were corrected before the passing final checks. No live service
was changed or inspected. This is synthetic same-UID browser evidence, not
installed-host or distinct-UID qualification. No whole-suite or clean gate run.

## Live check

In a conversation's terminal, select one line and several lines near the top
and bottom, using Shift when tmux mouse reporting is enabled. Repeat with mouse
reporting off. Copy and send-to-conversation must remain usable without hiding
any selected row. A selection filling the terminal uses the header instead.
