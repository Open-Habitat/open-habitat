# Account menu: compact sounds row

## What changed

The account menu's Äänet row keeps its Soi/Hiljaa control and, when the
device is quiet, shows one line: the deciding reason and an Ääniasetukset
button that opens Settings › Äänet. The expanded list of reasons and fix
buttons is gone from the menu (desktop popover and phone sheet alike);
Settings › Äänet still lists every reason with its fix. With sounds playing
the row still says "Vain tämä laite".

The reason shown follows what has to be fixed first: off on all devices,
then night quiet, then device mute (which the control above already shows).
The line uses Settings' own reason texts (`SoundSummary` in
`web/src/app/SoundStatus.tsx`). Explain mode gets a card for the button
(AS12, nav), and AS01 now says the row shows the main reason.

The menu no longer writes account preferences, so its sound write-error line
and focus handling for fixes went with them.

## Tests run

All under umask 077.

- `./scripts/test-focused.sh --area web`: passed (266 files, 2256 tests).
  The new `SoundSummary` cases failed before the component existed.
- `./scripts/test-focused.sh --area browser --spec account-sound-reasons.spec.ts --spec attention-sound.spec.ts`:
  14/14 passed. `account-sound-reasons.spec.ts` was rewritten for the
  compact row: one reason matching Settings' text, no list or fixes, row
  under 110 px, axe clean, Explain card AS12, unmute from the control keeps
  "off" as the reason, and the button lands on Settings › Äänet with the
  full list. It runs at 1440 and 390 px in Finnish and English.
- UI references regenerated; `scripts/test-ui-reference.py` passed.
- Synthetic screenshots at 1440 and 390 px checked by eye; not kept.

## Live check

Not checked on an installation. KOKEILTAVAA has the steps.

## Decisions for later review

- The button label is "Ääniasetukset" / "Sound settings", not "Asetukset",
  because the menu already has an Asetukset item just above.
- When several reasons apply, the line shows only the main one with no
  "+1" count, as the issue asks for at most one short line; Settings shows
  the rest.
- The link opens the Äänet section at its top, not at a particular row.
