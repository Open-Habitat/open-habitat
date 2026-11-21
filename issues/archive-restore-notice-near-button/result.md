# Result

Restore refusals started from an archived conversation's footer now appear inside that footer, immediately above its controls. Both the read-only history view and browser conversation pass the initiating placement to the existing archive notice state. The notice renders locally instead of registering with the shared top notice area; it remains dismissible, persistent on refusal and scoped to the initiating view. The mutation, native proof and navigation rules are unchanged.

## Decisions for later review

- Place footer feedback across the footer's full width above Restore, rather than overlay it or move focus/scroll to the top. This keeps the explanation and next action together on phone and desktop without narrowing the explanation to the button's width.
- Keep header/menu archive and restore feedback in the existing top notice area. Header archive already navigates to the workspace, whose top area keeps the undo offer available. Keeping the established destination avoids inventing a second notification system for a control that has left the screen.
- Keep rail archive feedback in that same existing notice area, not a placeholder at the removed row. The row disappears on success, and on phones its drawer closes; a row-local success notice would disappear with it. Refusals use the same established location. Home-card errors and archive-list restore confirmations already have their own local feedback and are unchanged.
- Successful footer restoration still removes the archived footer and returns the conversation to its normal controls; it does not add a new success banner. There was no separate footer success notice to relocate. Helper information and its actions remain inside the footer.
- Reuse the existing notice and its Explain-mode mapping rather than add new copy or controls. Local notices do not join the shared area's folding or same-kind replacement.

## Verification

Tested the implementation on base `c0d9bbf48729edad2625f7d1700357a9dbf364c7`, with the changes carried by this issue's fixing commit.

- `./scripts/test-web-fast.sh`: passed; 232 files, 1887 tests, plus static/type checks. The added component test proves a local refusal neither replaces nor folds a shared archive notice.
- Three consecutive executions of `./scripts/test-focused.sh --area browser --spec archive-damaged-history.spec.ts --spec rail-archive.spec.ts --spec native-history.spec.ts`, with `OH_BROWSER_WORKERS=2`, default focused reply jitter and separate port bases: 18/18 each (54 passes). The focused wrapper does not accept `--repeat-each`, so the three executions supply the required repetition.
- Damaged-history cases cover 390px and 1280px in light and dark: footer containment, geometric proximity to Restore, no horizontal overflow, dismissal, header/menu-triggered placement, route cleanup and axe on the notice. Native-history restores from the footer successfully; rail cases check shared-area undo and refusal, including Settings and touch behavior.
- Inspected all four synthetic browser-host screenshots. Paired captures and test logs are retained outside git at `/var/tmp/agent-keep/archive-restore-notice-near-button/` (`restore-390-light`, `restore-390-dark`, `restore-1280-light`, `restore-1280-dark`; PNG and captured DOM HTML). The HTML is a DOM capture, not a self-contained offline reproduction.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py` and `git diff --check`: passed. Closing the existing issue produced only the advisory that its original body has no Acceptance Criteria checklist; verified outcomes are recorded here.
- Review: focused local final-diff review, component regression and repeated host-backed browser tests. This is presentation-only: no session lifecycle, daemon state, wire contract or authorization change, so no independent model review was required. Reviewed both footer callers, unchanged header/rail behavior, notice portal registration, dismissal and view scoping.

Development attempts first found unsupported wrapper arguments and a missing Pi fixture dependency, then a phone test attempting a desktop-only header button. Corrected setup and used the actual phone menu. One attempt encountered a temporarily occupied test port; final runs used separate ports. No required check remains blocked. Whole browser suite, clean gate and live deployment were not run; the evidence is synthetic, not live-installation acceptance.

## Live check

On an archived conversation whose history is already known to be damaged, press Restore at the bottom: the dismissible refusal should appear immediately above it. Close and retry, then navigate to another conversation: the notice must not follow. Repeat on phone and desktop in light/dark. Header/menu restore should instead report beside the header. Archive from a rail row and use the top area's undo; restore a healthy archived conversation from its footer and confirm the normal conversation controls return.
