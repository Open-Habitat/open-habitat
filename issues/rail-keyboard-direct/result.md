# Result

Implemented direction 1, without an experimental switch. Alt/⌥+↑/↓ opens the previous/next visible rail conversation across Your turn, Running and Quiet. Alt/⌥+Shift+↑/↓ cycles waiting conversations independently of whether Meanwhile is showing. The Meanwhile button follows the same next-waiting order and names the new chord.

The rail's existing models supply order, including Quiet sorting, workspace narrowing and its kept open row. Terminal, editor, dialog and composer-list keys are left alone. Composer focus is retained; navigation from the rail enters the composer. Rapid presses read the live address rather than an earlier rendered selection. No daemon, contract, session-state or authority behavior changed.

## Decisions for later review

- Hidden Quiet rows are skipped, including when the whole rail is narrowed. A folded Quiet section's still-visible open row remains in order. Including hidden rows would contradict the accepted prototype's visible-order rule.
- Ordinary arrows stop at either end; Shift wraps within waiting rows, as the prototype's actual handlers do. With no selected visible row, ordinary arrows open the first row; Shift opens the first/last waiting row by direction.
- The listener lives with the mounted rail rather than the terminal's per-conversation `BrowserShell` hook. This keeps one owner of the visible order and works from the workspace landing too. Settings and unrelated pages keep their own keys.
- Discoverability uses the brief's rail tooltip/Explain line, accessible shortcut metadata and Meanwhile keycap. No new persistent first-use/dismissal store was introduced. The Explain keyboard paragraph is desktop-only; labels use ⌥/⇧ on Mac and Alt+/Shift+ elsewhere.
- Regeneration exposed pre-existing guide drift. The separate baseline-reference commit refreshes only references generated from the unchanged starting browser sources; the feature commit carries the shortcut changes separately.

## Verification and focused self-review

- `./scripts/test-focused.sh --area web`: 219 files, 1713 tests passed after rebasing onto integrated main, including order/filter/fold/end behavior, Shift cycling, key modifiers, composition, terminal/editor/dialog/list exclusions and archived exclusion.
- Focused `next-waiting-row.spec.ts`: 5 host-backed synthetic cases passed. The same spec passed **15/15** with `--repeat-each 3`, two workers and 0–60 ms reply jitter. The new case crosses all three sections from the composer, preserves a draft, stops at the end, cycles waiting rows both ways and navigates from a focused rail link.
- `lab-rail-keyboard-help.spec.ts`: 4/4 synthetic-lab cases passed. Inspected paired PNG/HTML captures (kept outside the repository) for Finnish/English at 1440 and 390 pixels: desktop hints fit; touch omits the hint. UK uses the same wording.
- UI-reference generator check, its three Python tests, and `git diff --check` passed. Rebase encountered one generated-reference conflict; regenerated from integrated sources, then reran web and both browser specs successfully.
- Focused self-review traced shortcut ownership, live-route selection, ready-field focus, Quiet ordering and exclusions. Earlier browser failures revealed blur-induced focus loss and stale rendered selection during fast stepping; both were corrected and the repeated run passed. Test setup was corrected to lower a completed conversation explicitly, exclude the legacy fixture history, and await the selected route before typing.
- Removed the old assertion that Alt+Down does nothing when Meanwhile is hidden: it contradicts the new always-available rail navigation. Draft preservation and hidden-row-independent navigation now have browser coverage.
- Native macOS/Safari/Firefox key delivery and a live installation were not tested; evidence is Chromium plus synthetic host/lab and unit tests, not a live-host or OS-isolation claim.

**Live check:** On the test server, leave a draft in one conversation and use Alt/⌥+↓ through Your turn, Running and Quiet; type immediately after each step, return to the draft, then try Alt/⌥+Shift+↑/↓. Fold Quiet and confirm hidden rows are skipped. In a terminal or editor, the arrows must stay with that tool. Hover the rail or inspect Your turn in Explain mode for the hint.
