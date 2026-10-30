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

# Kierros 2: dictation states of the row (riff)

Prototype: `issues/proto-composer-actions/prototypes/toimintorivi-riff/index.html`
(one offline file, production tokens and fonts embedded, round 1's frame and
the verbatim picker; Jari's guide in `NOTES.md` beside it). Brief: Jari's
response of 30.10. He wants to riff rather than pick, likes today's Sanele
button and listening state (the control grows, with *Valmis*), and asks what
the row looks like when Sanele is pressed and while it listens, plus a
shortcut to start dictation and Enter as *Valmis*.

**Axis:** where and how the listening state grows. Shared rule, carried over
from round 1: a control that exists in two neighbouring states keeps its
position (rest ↔ pressed ↔ listening ↔ finishing, and listening ↔
listening while the agent works). Picker: *Nyt* (production, the baseline)
and three directions. Toolbar states: Levossa, Työssä, Painettu, Kuuntelee,
Kuuntelee + työ, Viimeistely, plus *▶ Kulku*, which plays rest → press →
listening → Valmis → finishing → text in the field. *Haamut* draws the
counterpart state's controls (listening ↔ rest, pressed ↔ listening) as
dashed outlines.

## Host facts (production code on main)

- **The pill replaces the mic in its slot.** `DictationControl`
  (`web/src/components/composer/Dictation.tsx:217`) renders either the mic
  (`.ah-crow-btn`) or the recording pill `.ah-dictation-pill` (dot, five
  level bars, time, state label, and a *Valmis* chip inside; the whole pill
  is the stop button). Styles: `composer.css:930–1045`. The slot
  `.ah-dictation-slot` (`:960`) sits right of the spacer, so the pill grows
  leftwards into the empty middle. Sanele still jumps when the agent starts
  or stops working mid-dictation, for round 1's reason.
- **While dictating** the field is replaced by a read-only live box
  (`DictationLive`, min-height 66 px, confirmed text plus the dimmed guess,
  a red caret), and the box edge turns the recording colour
  (`.ah-cbox-dictating`, `composer.css:930`). Liitä, Komennot and Tiedosto
  are disabled (`Composer.tsx:1226`, `:1370`). On a phone
  (`composer.css:1165`, max-width 440 px) the aids and spacer are hidden and
  the pill takes the row (`flex: 1`).
- **Speech is captured before the connection is open, but the UI says
  "connecting".** `Dictation.start` (`web/src/app/dictation.ts:124`) opens
  the microphone and the audio capture first, then mints the Soniox session.
  From the moment the capture runs, frames are buffered (`frame`, `:278`,
  `pending.push` at `:291`, up to `bufferedSeconds = 30`, `:49`) and sent
  when the socket opens; the level meter also moves during this time. The
  pill nonetheless shows grey bars and "Yhdistetään…"
  (`Dictation.tsx:267`, `.busy` at `:285`) and the field "Yhdistetään
  Sonioxiin…", which tells the person to wait. Nothing is captured before
  the browser grants the microphone (the first-time permission prompt).
- **Stopping during `connecting` drops what was buffered**
  (`dictation.ts:377`: release and end with the empty `final`). Today that
  is harmless because the UI says to wait; once the pressed state invites
  speech, Valmis during connecting must wait for the socket and flush the
  buffer instead. That belongs to the parallel `dictation-fast-start-keys`
  work, which measures and shortens this phase.
- **Esc and Valmis both finish and keep the text** (`Dictation.tsx:171`,
  pill title "Lopeta sanelu (Esc). Teksti jää kenttään."). There is no
  cancel. Send during dictation finishes first and then sends what was said
  (`Composer.tsx:815`). Enter currently adds a newline in the live box; the
  parallel worker makes Enter = Valmis. Its shortcut choice was not known
  when this round was built, so the prototype uses the placeholder
  `Ctrl+Shift+Space` / `⌘⇧Space`.
- **Phone overflow in production (prototype reproduction, not confirmed
  live):** at 360–390 px with the agent working, the pill's min-content
  (dot, bars, time and the *Valmis* chip, with `min-width: 0` and no
  overflow handling) exceeds the space left by the mode chip, Stop and Send,
  so *Valmis* is drawn over the Ohjaa chip (`r2-nyt-puhelin-tumma.avif`,
  bottom right).

## Directions

Common to all three: the pressed state immediately shows the red, moving
level meter and "kuuntelee · yhdistää…", and the field says "Puhu vain, ääni
tallentuu jo. Sanat tulevat, kun yhteys aukeaa." Every direction adds a
cancel × that returns the field to what it was. *Valmis* carries an Enter hint
on desktop, and the Sanele tooltip names the shortcut. Ohjaa stays its own chip
(accent-soft as in round 1's *Roolit*, or ringed as in *Ankkuroitu*).
Measured in headless Chromium for every pair of neighbouring states, desktop
and phone at 390 and 360 px: no clickable control that exists in both
states moves in any direction (only *Palkki*'s bar changes its own length),
and nothing overflows the row.

1. **Paikallaan: the control grows in place.** Row order: round 1's
   *Roolit*, with **Sanele moved to the first place of the left group**
   (Sanele, Liitä, Komennot, Tiedosto | spacer | Ohjaa, Stop, Send). The
   pill is today's pill (same colours, dot, bars, time, label, *Valmis*
   chip) plus × and an Enter hint. It grows rightwards from Sanele's left
   edge as a layer over the aids, which keep their places underneath
   (they are disabled while dictating anyway). Its width is fixed (384 px
   desktop, 156 px phone), so *Valmis* and × stay put whatever the label
   says and whether or not the agent works. On a phone the pill is bars,
   ×, *Valmis*. *Decides:* the leftmost slot is the only place that can
   grow on desktop and on a 360 px phone without pushing anything. *Cost:*
   Sanele moves from the right edge (next to Send) to the left edge, and the
   aids are hidden while dictating.
2. **Palkki: the row turns into a listening bar.** Row order: round 1's
   *Ankkuroitu* (aids | spacer | Ohjaa, Stop, divider | Sanele, Send). On
   press the whole left part becomes one wide bar (×, dot, time, label, a
   scrolling waveform, "Enter valmis"). Sanele's slot, fixed at the same
   width, becomes *Valmis*, so the finger that started dictation finishes
   it in the same spot. Send stays anchored. *Decides:* dictation is a
   sending-side control next to Send, as today. *Cost:* when Ohjaa and Stop
   appear mid-dictation the bar's right end shortens (its controls are at
   the anchored left, so nothing clickable moves). On a phone *Valmis* is an
   icon-only ✓, because the slot is one icon wide.
3. **Kenttä: the field is the listening surface.** Row order: round 1's
   *Roolit* unchanged (Liitä, Komennot, Tiedosto, Sanele | spacer | Ohjaa,
   Stop, Send). The row does not change at all except that Sanele becomes a
   same-width *Valmis*. A strip appears inside the top of the field box
   (dot, time, label, waveform, "Enter valmis", ×), and the live text
   follows below. *Decides:* the row is only for actions; listening is a
   state of the field. *Cost:* the grown control Jari likes becomes a strip
   in the field, which also grows one strip taller. On a phone *Valmis* is
   an icon-only ✓.

## Recommendation

**Paikallaan.** It keeps the listening look Jari likes almost as it is,
fixes both of today's defects (the jump when the agent starts working and the
phone overlap), and makes the pressed state invite speech. It builds directly
on round 1's *Roolit* recommendation: Sanele is an input aid and leads that
group, so the one growing control has the whole empty middle to grow into on
every width. *Palkki* is the choice if Sanele should stay next to Send
(start and finish in the same spot is its strength). *Kenttä* has the
calmest row but trades away the grown control.

For implementation: the pill's width becomes fixed and its slot moves left
of the aids (as a positioned layer over them), the pressed state uses the
live colours and the "kuuntelee · yhdistää" label, Valmis during
`connecting` must keep the buffered audio (see host facts), and a cancel
action is added to the engine (stop without putting `final` into the field).
Per the 30.10. rule, this ships as an experimental feature behind
Kokeelliset ominaisuudet unless Jari asks to see it at once.

## Decisions for later review (round 2)

- **A cancel ×** in every direction (sanottu ei jää kenttään). Alternatives:
  no cancel (today; Esc and Valmis keep the text, and the person deletes by
  hand), or Esc = cancel. Chosen as a separate × because the brief asks for
  cancel and the parallel worker keeps Esc as it is ("Esc toimii kuten
  ennen"). Cancel has no key.
- **Pressed state wording "kuuntelee · yhdistää…" with red, live bars**
  instead of grey "Yhdistetään…". Alternative: keep the grey connecting
  look until the socket opens. Chosen because audio is already captured
  (host facts), and the honest message is "speak now". It depends on Valmis
  during connecting flushing the buffer.
- **Shortcut placeholder `Ctrl+Shift+Space` / `⌘⇧Space`**, shown in the
  Sanele tooltip and the *Valmis* title; it toggles start and finish in the
  prototype. The real key comes from `dictation-fast-start-keys`.
  Alternative: no shortcut hint until that lands.
- **Paikallaan: Sanele first in the left group**, which changes round 1's
  *Roolit* (Sanele last). Alternative: Sanele last and the pill growing from
  there, which on a 360 px phone with the agent working leaves too little
  room (measured).
- **Paikallaan: fixed pill width** (384 px desktop, 156 px phone; the phone
  pill drops the dot, time and label). Alternative: width by content, which
  moves *Valmis* whenever the label changes or the agent starts working
  (measured in the first build).
- **Palkki and Kenttä: *Valmis* icon-only on a phone.** Alternative: a
  wider Sanele slot at rest on a phone, so the label fits, at the cost of
  row room at rest.
- **Hints only on desktop** (Enter kbd in *Valmis*, "Enter valmis", the
  shortcut tooltip). A phone has no keyboard hints.
- **Not prototyped:** the first-time microphone permission prompt, the
  hold-to-talk variant (pill label "päästä irti…"), the 10-minute ceiling
  note and the error notices; they live above or below the field and
  don't change the axis.

## Evidence (round 2)

`evidence/r2-*.avif` (DSF 2): `*-tyopoyta-vaalea` stacks rest (with the
Sanele tooltip hovered where the direction has one), pressed, listening,
listening while working and finishing for one direction; `*-puhelin-tumma`
shows rest, pressed, listening and listening while working at 360 px;
`*-haamut-tyopoyta-tumma` shows listening and listening-while-working with
the rest-state ghosts. Checks run in headless Chromium against the committed
file. Positions of every row control in six states × three widths
(desktop, 390 px, 360 px) were compared across seven state pairs. In
*Paikallaan* and *Kenttä* nothing moves; in *Palkki* only the bar's own
length changes; *Nyt* reproduces production's jumps. A click-through per
direction covered: Sanele → Enter leaves the dictated text in the field, ×
restores the field (*Nyt* has no cancel; Esc keeps the text), the shortcut
starts dictation, and Send during dictation finishes and sends. The console was clean.
