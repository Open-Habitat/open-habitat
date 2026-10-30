# Result: composer action row, prototype round 1

Prototype: `issues/proto-composer-actions/prototypes/toimintorivi/index.html`
(one offline file, tokens and fonts embedded; Jari's guide in `NOTES.md`
beside it). Picker: *Nyt* (production as of this commit, the baseline) and
three directions. A toolbar switches rest/working, empty/typed field, light/dark,
desktop/phone and *Haamut*, which draws the other state's buttons as dashed
outlines in the same row so any jump is visible. *▶ Vuorottele* flips the state
every 1.4 s.

**Axis:** order and visual hierarchy of the row. Shared constraint for every
direction: a button that exists both at rest and while the agent works keeps
its position; *Ohjaa* stays distinct; the row fits a 360 px phone.

## Host facts (production code on main)

Row: `web/src/components/composer/Composer.tsx:1363–1475`, styles
`web/src/components/composer/composer.css:101–293` and the phone block from
`:836`.

Which buttons appear when (in DOM order):

| Button | When | Source |
| --- | --- | --- |
| Liitä | whenever `csrf` is set | `AttachmentMenu` (`Composer.tsx:1366`, `AttachmentMenu.tsx:24`) |
| Komennot | whenever `sources` is set; replaced by the `!` shell label in shell mode | `listButton("cmd")`, `Composer.tsx:1213` |
| Tiedosto | whenever `sources` is set | `listButton("file")` |
| — spacer — | always | `.ah-crow-grow` |
| model picker | only before the first message of a new conversation (`canChooseFirstModel`, `BrowserConversation.tsx:369`) | `Composer.tsx:1384` |
| Sanele | `speech && csrf && !shellOn` — vanishes when the draft starts with `!` | `Composer.tsx:1387`, `Dictation.tsx:217` |
| Ohjaa / Työn jälkeen chip | `working && !shellOn` | `Composer.tsx:1396` |
| running-command chip | a `!` command runs while the agent does not | `Composer.tsx:1411` |
| Stop | agent working with `onInterrupt`, or a `!` command running, or unsent messages waiting for Pi | `stopTarget`, `Composer.tsx:794`, `:1431` |
| Send (↑, or ▶ in shell mode) | always; `aria-disabled` while there is nothing to send | `Composer.tsx:1456` |

There is no separate attach/command/file overflow and no model picker in an
ongoing conversation (the model lives in the header).

**Why Sanele moves.** Everything right of the spacer is laid out from the right
edge, and the chip and Stop are inserted *between* Sanele and Send only while
`working` is true (`Composer.tsx:1396`, `:1431`). Sanele is pushed left by the
chip's width plus Stop (~130 px on desktop) when work starts and springs back
when it ends. Switching Ohjaa ↔ Työn jälkeen moves it again, because the two
labels differ in width. On a phone the whole row reflows as well:
`.ah-crow-busy .ah-crow-btn .ah-crow-lbl { display: none }`
(`composer.css:837`) hides the labels of Liitä, Komennot, Tiedosto and Sanele
only while working, so Komennot, Tiedosto and Sanele all change place
(measured: prototype `Nyt`, phone, every button except Liitä moves).

**Why Liitä has a filled background.** It is its default style, not hover or
focus. Liitä is the only row button drawn with the shared `ControlButton`
primitive (`AttachmentMenu.tsx:25`, `size="inline"`, default
`variant="secondary"`); the others are plain `<button class="ah-crow-btn">`.
For a primitive with a text label, `Controls.module.css:60`
(`.text.secondary`) sets `--i-bg: var(--ah-control)`, the rule that a text
button never reads as bare text (*buttons-no-surface*). The composer's reset
`.ah-crow button:where(:not(.ah-button))` (`composer.css:115`) deliberately
skips primitives, and `.ah-crow .ah-crow-btn` (`:126`) sets shape and colour
but no background, so the tint survives. Komennot, Tiedosto and Sanele get a
background only on hover (`--ah-hover`).

**Ohjaa** is `.ah-crow-chip` (`composer.css:195`): an inset 1 px
`--ah-line-strong` ring, pill shape, accent-coloured steer arrow, muted swap
arrow. Stop is an ink-filled circle, Send an accent circle that turns
`--ah-disabled-bg` when empty — so while the agent works on an empty field the
heaviest thing in the row is Stop, and the only accent-coloured thing is the
little arrow inside Ohjaa.

### Other findings (production, not fixed here)

- **Phone touch sizes do not apply.** The phone block's `.ah-crow-btn
  { min-height: 36px }` and `.ah-crow-chip { min-height: 36px }`
  (`composer.css:840`, `:852`) have lower specificity than
  `.ah-crow .ah-crow-btn` / `.ah-crow .ah-crow-chip` (`:126`, `:195`), so on a
  phone the aids and the mode chip stay 28 px high while Stop and Send become
  36 px. Measured in Chromium at 390 px with the production `composer.css`
  and tokens: aids 28 px, chip 28 px, Send 36 px.
- **At rest on a 390 px phone the row does not fit.** Four labelled aids plus
  Send need ~373 px of a 348 px row. `.ah-dictation-slot` has `min-width: 0`
  (`composer.css:960`), so the slot shrinks under Sanele and the Sanele button
  is drawn under Send (prototype `Nyt`, phone, rest; evidence
  `nyt-puhelin-tumma.avif`). Not confirmed on a live installation.
- `design-system/design.md` ("Levossa kirjoituskenttä on yksirivinen…",
  around line 245) still describes the 13.10 layout (a separate working row
  with Stop on the left); the code follows the later *Rivillä* direction
  (`composer.css:1–4`). Whichever direction is chosen should rewrite that
  paragraph.

## Directions

All three keep the production field, tokens, chip semantics, Stop/Send
behaviour and keyboard (Enter, Alt/⌥+Enter, Esc). Phone measurements at 360
and 390 px: no button that exists in both states moves, nothing overflows.

1. **Ankkuroitu — the smallest change.** Order unchanged, but the right edge is
   anchored: Sanele and Send stay put, and the work controls (Ohjaa, Stop) are
   born in the empty middle, left of a hairline divider. All aids share one
   quiet style (Liitä loses its fill). On a phone the aids are icon-only in
   both states. *Decides:* Stop is no longer next to Send; Send stays the last
   button. *Cost:* Stop and Send are separated by Sanele, so "stop" and "send"
   are no longer one cluster; the divider is one more line in the row.
2. **Roolit — group by role, one primary.** Left: everything that helps fill
   the field (Liitä, Komennot, Tiedosto, **Sanele**). Right: how the message
   goes (Ohjaa chip, Stop, Send). Send is the only filled control; Stop
   becomes an outlined circle; Ohjaa gets an accent-soft fill with an accent
   ring, so the steering mode is the most coloured thing in the row while the
   agent works. Work controls appear left of Send, into the gap. *Decides:*
   dictation is an input aid, not a sending control. *Cost:* on desktop Sanele
   moves far from Send (dictate-then-send is a longer pointer trip; on a phone
   the distance is small); Stop is visually lighter than today.
3. **Yksi painike — fold.** Liitä, Komennot and Tiedosto fold into one `+`
   menu (they also have `/` and `@` in the field). Right: Ohjaa chip (while
   working), Sanele as an icon, and **one round slot** that is Send at rest,
   Stop while the agent works on an empty field, and Send (steer or after-work)
   once there is text; while text exists, a quiet "Pysäytä: Esc" hint appears
   at the left on desktop. *Decides:* fewest controls; nothing appears or
   disappears except the chip. *Cost:* Stop is not clickable while a draft
   exists (Esc, or clear the field) — a real loss for a product where
   steering mid-work is common; aids lose their labels and need a tap to
   discover.

## Recommendation

**Roolit.** It is the only direction where the row reads by meaning (left fills
the message, right sends it) and where the visual weight follows that meaning:
one primary (Send), one distinct mode (Ohjaa), everything else quiet. It keeps
every aid visible and labelled on desktop, so it loses nothing that is used
today, and it never hides Stop. Ankkuroitu fixes the jump but leaves the
hierarchy as it is (ink Stop, the stray accent arrow) and splits Stop from
Send; Yksi painike is the cleanest look but costs Stop during typing, which is
exactly when someone is steering.

Implementation in production would be small: move `DictationControl` before
the spacer, put the chip/Stop/Send in one right-hand group, draw Liitä like the
other aids (or give all aids the same surface), and fix the two phone
specificity issues above.

## Decisions for later review

- **Phone aids are icon-only in both states** (all directions). Alternatives:
  labels at rest and icons while working (today; it reflows the row), or labels
  always (does not fit 360–390 px). Chosen because a stable row is the brief
  and the icons are the familiar ones (paperclip, `/`, `@`, mic).
- **Phone chip drops its swap arrow** (directions only), so the working row
  fits 360 px. Alternative: keep the arrow and shorten the label to the icon.
  The chip is still the toggle, and its tooltip/aria label names both modes.
- **Liitä drawn like the other aids** (directions). Alternative: give all aids
  the `--ah-control` surface the primitive would give them. The quiet style
  keeps the row from looking like four buttons competing with Send; the
  primitive rule is about text buttons on a page, and the row's aids already
  read as controls inside the field box.
- **Roolit's Stop is an outlined circle**, not the ink fill. Alternative: keep
  the ink fill (then Stop is the heaviest control whenever the field is empty).
  Kept outlined so Send is the one primary; worth Jari's eye.
- **Not prototyped:** the empty-conversation model picker (in Roolit it would
  start the right group, left of where the chip appears), shell `!` mode (shell
  label replaces Komennot as today; Sanele hidden as today), the running-command
  chip (right group, left of Stop) and the dictation pill. None of them changes
  the axis; they follow the chosen grouping.

## Evidence

`evidence/*.avif` (DSF 2): each image stacks rest over working for one
direction — `*-tyopoyta-vaalea` (desktop, light) and `*-puhelin-tumma` (phone
390 px, dark); `*-haamut-tyopoyta-tumma` shows the dashed ghost of the rest
positions over the working row for *Nyt* (Sanele and Send ghosts miss) and
*Roolit* (every ghost lands on its button). Position measurements (each
button's left edge at rest and working, desktop and phone at 360 and 390 px,
empty and typed field) were run in headless Chromium against the committed
file; console clean, interactions clicked (menus, mode chip, Send with text,
Stop, picker keys).
