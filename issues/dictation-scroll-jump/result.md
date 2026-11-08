# Result

The composer now reveals the caret after dictated text when the textarea returns. Restoring selection alone left Chromium scrolled to the old end; the existing caret-line measurement now positions the textarea scroll after focus and selection restoration, in the same layout effect. No timers, new state owner, or speech/host changes.

## Validation

Tested the working-tree implementation in this issue's commit on Birch:

- `./scripts/test-focused.sh --area web`: 188 files / 1408 tests passed, typecheck and static checks passed.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=26700 ./scripts/test-focused.sh --area browser --spec speech-input.spec.ts` (private `/var/tmp` TMPDIR, umask 077): all 13 cases passed, including the existing accessibility check.
- New browser regression dictates into rows 2, 40 and 80 of an 80-line draft, checking text, focus, selection endpoints and caret visibility against actual scrollTop/clientHeight. Temporarily restoring the old implementation made the visibility assertion fail; restoring the fix passed the full spec again.
- The first test run exposed an incorrect test expectation including the automatically inserted separator space in the caret position. Corrected the expectation: the caret belongs immediately after the dictated word, before that separator.
- Focused self-review: checked layout-effect ordering, existing caret measurement reuse, top/middle/end behavior and selection replacement coverage. No authority, contract or session-state changes; independent review not required.

This is Chromium host-backed synthetic speech evidence, not a real microphone/provider or Safari verification. No visual design changed. Live-device checking remains in KOKEILTAVAA.md.

## Decisions for later review

None: this restores the requested caret visibility without changing product behavior beyond the defect.
