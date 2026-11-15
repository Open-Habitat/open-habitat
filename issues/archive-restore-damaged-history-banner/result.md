# Result

## Cause and fix

The archive handler reduced every failed end-of-history proof to `control_uncertain`. A malformed final line therefore reached the browser as “changed elsewhere,” although the browser already knows how to explain `history_damaged`. The end-only proof now distinguishes stable damage from unavailable, mismatched or changing observations. Archive requires matching repeated observations before returning `history_damaged`; it neither repairs nor rewrites history, nor scans the whole history to diagnose a failed end check.

Restore failures without an existing archive notice went into a separate App-wide `archiveProblem` string, rendered as a non-dismissible PageNotice. It was not cleared on navigation. Removed that parallel state: restore failures use the existing dismissible ArchiveNotice, bound to the initiating view (or the workspace reached by archiving). Leaving that view clears it; a late refusal does not appear in another conversation. Settings overlays preserve the underlying view's pending result.

Writing to a resting, non-archived damaged conversation already works safely: typing's continuation is refused with `history_damaged`; sending directly keeps the message held, attempts startup, and settles as `start_failed` with that same reason. Added controller regression coverage for the held message, reason and unchanged native bytes. No production change to that path was needed.

The shared damaged-history explanation is unchanged: the history contains a damaged line, the file is kept, and the person can continue in a new conversation or ask an agent in another conversation to inspect it.

## Decisions for later review

- Keep restore refused for damaged final records, rather than silently repair or relax its proof: the approved task asks for the truthful reason, not different restore eligibility.
- Scope notices to the initiating view, with the existing archive-to-workspace transition allowed. Unlike a global banner, this cannot follow into another conversation. A refusal arriving after the person leaves does not raise a new banner there.
- Reuse the existing generic damaged-line explanation rather than introduce last-line-specific copy: the same explanation also serves continuation's whole-history diagnosis.

## Verification

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed. Covers restore refusal, archive state/native-byte preservation, end-proof diagnosis, and resting send/start failure.
- `./scripts/test-focused.sh --area web`: passed, 226 files / 1791 tests, plus type and static checks.
- `./scripts/test-focused.sh --area browser --spec archive-damaged-history.spec.ts --spec rail-archive.spec.ts`: passed three consecutive runs, 4/4 cases each, two workers. Includes actual damaged-history restore through the synthetic host, dismissal, navigation to another conversation, Settings pending-reply regression, existing rail undo, touch behavior and axe on the refusal notice.
- Independent review: claude-fable-5-2 finder and gpt-6-astra verifier, followed by local assessment. Fixed both confirmed candidates: underlying-view versus Settings route mismatch and unnecessary whole-history fallback under the shared writer. No follow-up issue required.

Earlier development runs caught a test import mistake, an incorrect synchronous-send expectation, and browser test setup/locator mistakes; corrected before the passing runs. One existing rail focus-outline assertion failed transiently and passed all three final repetitions without product changes. Full browser suite, live installation and separate-UID checks were not run.

Live check: restore an archived conversation with a deliberately malformed final history line. Confirm the damaged-history explanation, close the notice, retry, and switch to another conversation: the notice must not follow. In a resting non-archived damaged conversation, type or send and confirm the reason is shown without losing the message or changing the history.
