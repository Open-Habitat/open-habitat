# Result

All three failures were specs written for the five-row phone header that
8e6220e1 (`phone-header-too-tall`, accepted by Jari) replaced with two rows.
The product behaves as that change intended; no product code changed.

- `title-regeneration.spec.ts` "compact header …": at 390 px the title now
  shares row 1 with the panel buttons and the menu, so it is ~120 px wide and
  a 32-character generated title shortens with an ellipsis (as in the accepted
  screenshots). The spec asserted the old layout: title wider than 200 px,
  title group as wide as the whole row, and the generated title unshortened.
  At 390 px it now asserts that the title fills the room the row leaves it (its
  right edge meets the next control), stays on one line, and the model chip is
  on the row below. The desktop width keeps the >200 px and unshortened checks.
  Renamed to "… keeps the title on its phone row …".
- `lab-title-generation.spec.ts` 390 px light/dark: the spec clicked
  `conversation-retitle`, which the phone block hides; the action is the
  `menu-retitle` item of the header menu. At 390 px the spec now runs the
  action through the menu, checks the item is disabled while naming and enabled
  after, and asserts the dots (the arrow belongs to the hidden icon, so its
  running animation is only asserted at 1440 px; its absence under reduced
  motion is still checked at both).
- `browser-conversation.spec.ts` pending/rejected/uncertain send receipt:
  `expectPhoneComposerWithinViewport` resized the page to 390 px and left it
  there. The following `refreshConversation` waits for the header's archive
  icon and opens Tiedot, both hidden on a phone since 8e6220e1, so it timed out.
  The helper now restores the caller's viewport. Not a send-receipt or timing
  regression: the cause is deterministic and shows on an idle machine with one
  spec run alone, so no bisect was needed beyond reading 8e6220e1's phone CSS
  block (`.ah-archive-control`, `.ah-details-toggle` → `display: none`).

## Decisions for later review

- **Generated titles are allowed to shorten on a phone.** The
  `conversation-title-too-long` fix (e47251eb) bounded generated titles to 32
  characters so they fit the header; on the accepted phone layout the title row
  is narrower than that bound. I took the accepted screenshots (title shortened
  with an ellipsis, full title in the menu heading) as the decision and changed
  the spec, rather than shrinking the bound or widening the row.
- **The receipt refresh stays a desktop check.** The alternative was to teach
  `readyConversation`/`refreshConversation` to open the phone menu; the phone
  composer bound is the only phone claim that test makes.

## Checks

- `title-regeneration.spec.ts`, `lab-title-generation.spec.ts`,
  `browser-conversation.spec.ts` (71) alone: passed.
- `./scripts/test-focused.sh --area web`: passed.
- Whole suites on main d732c059 + this change, `OH_BROWSER_WORKERS=4`, under
  the new suite lock. Birch was never idle during this run: other workers kept
  it at load 9–15 on 8 vCPU with focused specs.
  - Browser: 409 passed, 1 failed (11.2 min). All four original failures
    passed. The failure was `attachment-documents.spec.ts:38`: the composer's
    six chips did not appear within 5 s.
  - Lab: 136 passed, 1 failed (4.4 min). Both `lab-title-generation` 390 px
    cases passed. The failure was `lab-conversation.spec.ts:607` (typed
    fragments): the live tool row did not appear within 20 s.
  - Both stray failures passed 3/3 when run alone straight afterwards, at the
    same load. They are filed as `browser-waits-time-out-under-load`
    (untriaged). So the acceptance "both suites green on idle Birch" is not
    shown yet: the remaining reds are load-sensitive waits outside this issue,
    not the failures this issue named.
- After rebasing onto 479be1b7 the three changed specs pass again, except
  `browser-conversation.spec.ts:145` (saved bash row after reload). It also
  fails on plain main 479be1b7, so this change did not cause it. Another
  worker has filed it as `flaky-saved-turn-bash-row`.
