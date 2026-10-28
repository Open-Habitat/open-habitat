# Result

## Cause

The composer field's text was 14.5px (13.5px in `!` shell mode and in the
Komennot/Tiedosto search). iOS WebKit, which Brave on iPhone also uses, zooms
the page into a focused field whose text is under 16px. `AppShell` follows the
visual viewport (`--ah-visible-height`, `--ah-visible-top`) only while
`visualViewport.scale` is 1, so that pinch zoom keeps its native behaviour. Once
the focus zoom set the scale above 1, the shell stopped following the keyboard
and stayed at the full screen height, which left the field under the keyboard.
The existing keyboard spec emulated the visual viewport at scale 1 and so
never reached this case.

## Change

- On a touch screen (`pointer: coarse`) the composer field and the choice
  list's search field use 16px text, so iOS does not zoom when they get focus.
- `AppShell` marks the shell `data-keyboard` when the visible height is more
  than 150px below the tallest height seen at the current width. While the
  keyboard is open and focus is in the composer, the phone header keeps only
  its first row (the activity mark moves onto it) and the recap card is
  hidden. Both come back when the keyboard closes. In the emulated 390×440
  view the conversation gets 251px of the 440px, where before it got 145px
  with the header's second row and the recap showing.
- The viewport meta has `interactive-widget=resizes-content`, so Android
  Chrome shrinks the layout (and `dvh`) with the keyboard. iOS ignores it, and
  the visual-viewport path still covers iOS.
- `phone-composer-keyboard.spec.ts` now models WebKit's focus zoom for the
  iOS case. Without the 16px rule the field's bottom edge lands at 789px
  against a 485px visible area. The spec also checks the collapsed header and
  the conversation's share, and that both return when the keyboard closes.

Evidence: `attachments/keyboard-390x440-ios-emulated.png` (emulated keyboard
with Safari's 45px pan. The stream area is blank because the spec pads the
timeline to 3000px).

## What a real iPhone still has to confirm

Playwright here has only Chromium, and no browser test can open an OS
keyboard. A real iPhone (Brave and Safari) still has to confirm:

- the page no longer zooms when the field is tapped;
- the field sits directly above the keyboard, including the predictive-text
  bar, and does not jump when the keyboard animates;
- the 150px keyboard threshold collapses the header on that phone, and
  Brave's toolbar showing and hiding does not trip it;
- landscape, where the visible height with the keyboard open is very small.

These are in KOKEILTAVAA under "Työn alla".

## Decisions for later review

- **16px composer text on touch screens.** Alternatives: `maximum-scale=1` in
  the viewport meta, which stops the focus zoom but also blocks pinch zoom on
  Android, an accessibility loss; or following the visual viewport even when
  zoomed, which breaks pinch zoom. 16px is the standard fix and changes only
  the composer's text size on phones (body text is 14.5px).
- **The header's second row hides while typing with the keyboard open.** The
  context ring, Git chip and model chip return when the keyboard closes; the
  activity mark stays on the first row, and Stop stays in the composer.
  Alternative: keep both rows, which costs about 45px of a roughly 400px view.
  It only applies while focus is in the composer, so a picker's own search
  field cannot hide the chip it opened from.
- **The recap hides while typing with the keyboard open.** Before this
  change, the recap kept at most 20% of the visible height with the keyboard
  open. With the field visible, that left the conversation about a third of
  the view (145px of 440px). The latest turn matters more when replying, and
  the recap returns when the keyboard closes. Alternative: keep the 20% card.
- **Keyboard detection by height drop (over 150px below the tallest height at
  this width).** Alternatives: compare against the layout viewport, which
  fails on Android with `resizes-content`; or test focus only, which cannot
  tell a hardware keyboard from an on-screen one.

Not changed: other text fields under 16px (settings forms, rail search) can
still zoom on iOS. Outside the conversation that does not hide the composer.

## Review

Focused self-review. The change is CSS, one viewport meta attribute and a
browser-side attribute in `AppShell`. No daemon, contract, session state or
authority path is touched.
