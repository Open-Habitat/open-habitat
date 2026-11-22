# Night quiet made visible: prototype round `2026-11-22-night-quiet`

## Saatesanat

Kolme tapaa kertoa Asetukset › Äänet -sivun yläosassa, että äänet ovat
hiljaa, koska on yö. A lisää sivun ylimmäksi tilarivin. B laittaa tilan
itse Äänet-kytkimeen. C käyttää A:n tilariviä, mutta määrittelee yön
kellonaikana (oletus 22–7) eikä laitteen tummana tilana. Valitse
yläpalkista tilanne *Klo 14.10, laite tummassa tilassa koko päivän*:
A ja B ovat hiljaa keskellä päivää, ja juuri niin sinulle kävi. C soi.
Kaikissa suunnissa laattojen yllä lukee, että kuuntelu ohittaa
yöhiljaisuuden, ja *Soita silti* soittaa tämän yön tällä laitteella.
Suosittelen C:tä.

## Axis and directions

Axis: where the page says that sounds are quiet because it is night, and
what defines night. Everything else is today's Äänet page.

- **A Tilarivi**: the first thing under the heading is a status line,
  "Äänet ovat nyt hiljaa: on yö". It gives the reason (dark mode plus
  Hiljennä yöllä on), says when sound returns, and offers *Soita silti*
  and *Yön asetukset* (scrolls to the night row). Night stays dark mode.
  This direction decides only where the state is told.
- **B Pääkytkin**: no separate line. The Äänet row carries a Yö tag, the
  words "Päällä, mutta nyt hiljaa: on yö", a moon in the Päällä segment,
  the reason and *Soita silti*. Hiljennä yöllä moves into the same card
  right under it. This direction decides that night belongs to the master
  switch.
- **C Kello**: A's status line, and Hiljennä yöllä becomes a clock window,
  Alkaa klo 22.00 – Päättyy klo 7.00, editable. The line says when sound
  returns ("hiljaa klo 7.00 asti"). Dark mode has no effect. This direction
  also decides what night means.

In every direction:

- While night silences, a note above the tiles says that listening
  (pressing a tile, Testaa ääni) skips night quiet and the agent's sounds
  stay quiet. Under Testaa ääni it says "Testi soi myös yöllä". This is
  the honest statement of today's behaviour: a preview plays at night.
- The account menu's Äänet row reads the same state. A shows text only
  ("Hiljaa yön takia: laite on tummassa tilassa"). B adds the Yö tag and
  *Soita silti*. C says "Yö: hiljaa klo 7.00 asti" and offers *Soita silti
  tänä yönä*.

## Recommendation: C Kello

Dark mode is a theme. It is not a time of day. Many people keep it on
all day, and for them Hiljennä yöllä means no sound at all, which is what
happened on the test server. Only the clock fixes that; a status line by
itself (A, B) explains the silence but does not make it right. With a
clock, night is predictable: the line can say "until 7.00", which A and B
cannot, because they do not know when the device will switch. A's line,
which C keeps, is the clearest place for the state, and it disappears in
the daytime. B hides the state inside a row that looks the same as
any other row, and it moves the night choice away from "Milloin soi".

## What the view assumes from the host

Nothing new for A and B: night is still `prefers-color-scheme: dark` in the
browser. C needs the window in the account preferences, for example
`sound.night_start` and `sound.night_end` as whole hours. The daemon then
stores and bounds them like the other sound choices, and the contract
changes (`contracts/v1/`). The browser compares the window with the
device's local clock. *Soita silti* needs no host: it is this browser's
state, like mute and volume.

## Decisions for later review

- **The override is per device and lasts until the next night.** In C,
  that is the next start time. In A and B, it lasts until the device next
  turns to night, which is the only edge they can see. Alternatives: an
  account-wide override, or a fixed number of hours. Night is a property of
  the device's moment, and mute is already per device.
- **The clock window is account-wide but read in the device's local
  time.** The alternative is a per-device window. One person keeps one
  sleep rhythm, and a device in another time zone should follow its own
  clock.
- **Whole hours only, start 18–02, end 04–11.** This keeps the menus
  short. Minutes can come later if someone needs them.
- **The status line shows only for night.** Off-everywhere and
  device-muted keep production's notes. See the questions.
- **Hour labels read "klo 22.00".** A label of digits alone has no
  letters, so production's `ControlButton` draws the menu as an icon
  square. The word keeps it a text button. The implementation should keep
  the word or give the hour menu an explicit presentation.
- **The tiles go three to a row beside the phone frame.** Production steps
  the columns by window width. The desktop stage is narrower than the
  window, so the round steps them as production would at that width.

## Questions for Jari

1. C: is a clock window the right meaning of night, and is 22–7 the right
   default? Or should "Laitteen tumma tila" stay as a second choice beside
   the clock?
2. Should the same status line also say "Tämä laite on mykistetty" and
   "Äänet ovat pois kaikilta laitteilta" at the top, so that every silence
   reads the same way? Today these are notes at the bottom of the page.
3. Is *Soita silti* right as a one-night, this-device override? Or is
   switching Hiljennä yöllä off enough, with no override at all?

## Build and checks

- Build: `node design-system/prototypes/rounds/2026-11-22-night-quiet/build.mjs`
  writes `design-system/prototypes/dist/night-quiet/offline.html` (open
  directly) and `index.html` (no fonts, for Glasspad). Directions:
  A Tilarivi, B Pääkytkin, C Kello.
- `check.mjs`: 90 checks passed. It covers the round directory (no images
  or HTML, nothing over 100 KB), the picker, desktop 1440 px in light and
  dark for each direction, and the status line as the first element (A,
  C) or the master card's night state (B). It checks the preview and test
  notes, the menu's state, tile choice at night, *Soita silti* and
  *Hiljennä taas* from the page and from the menu, and the darkday
  scenario (A and B silent, C plays). It also checks C's start moved to
  0.00 making 23.40 day, day with no status, English, and a 390 px phone
  in light and dark with the night state on the first screen and no
  sideways scroll. The console is clean.
- Evidence (not committed): screenshots at
  `/var/tmp/agent-keep/attention-sound-night-visible/shots/`.
- No production code changed.

# Kierros 2: every silence on the top line? `2026-11-22-night-quiet-2`

## Saatesanat

Valitsit C:n, ja kysyit, pitäisikö sama ylärivi kertoa myös mykistys ja
Pois kaikilta. Tässä kolme vastausta. A näyttää aina yhden syyn, vahvimman,
ja sen yhden korjauksen; kun korjaat sen, rivi kertoo seuraavan. B luettelee
kaikki syyt kerralla, kullakin oma painikkeensa. C kertoo vain yön, ja
mykistys jää laitekortin loppuun kuten nyt. Oletustilanne on klo 23.40
mykistetyllä laitteella: C sanoo ylhäällä "on yö", vaikka ääni ei soisi
aamullakaan, koska laite on mykistetty. Kokeile myös tilannetta *pois
kaikilta ja mykistetty* ja paina A:n painikkeita järjestyksessä.
Painikkeet muuttavat oikean asetuksen, ohituksia ei ole. Suosittelen A:ta.

## Axis and directions

Axis: which silences the top status line tells, and how many at once.
Night, the clock window and the rest of the page are round 1's C in every
direction.

- **A Vahvin syy**: one line, always the strongest active reason with its
  one fix. Order: off on all devices › this device muted › night. Fixing
  one reveals the next. Production's bottom notes go away.
- **B Kaikki syyt**: "Äänet ovat hiljaa tällä laitteella", the count, and
  every reason on its own row with its own fix. While sounds are off
  everywhere, the other rows say "ei vaikuta, ennen kuin äänet ovat
  päällä". Bottom notes go away.
- **C Vain yö**: the line tells only the clock's night, and only while
  sounds are on. Off everywhere shows in the Äänet switch right below; the
  mute stays the device card's control and production's bottom note.

Fixes in every direction are the real settings: *Laita äänet päälle*,
*Poista mykistys*, *Ota yöhiljaisuus pois*; the night line also has *Muuta
aikaa*, which scrolls to the clock row. A toast says which setting changed
and where to turn it back. The account menu's Äänet row keeps production's
order (off › muted › night) in every direction.

## Recommendation: A Vahvin syy

The question the line answers is "why do I not hear anything right now?",
and the honest answer is the first thing that stands in the way. A gives
that in one sentence and one button, in the same shape whatever the
reason, so the page reads the same for night, a muted phone and sounds
turned off. Fixing it shows the next reason at once, so nobody fixes
the wrong thing and wonders why it is still quiet. B is complete, but at
night on a muted device it shows two or three rows, and when everything is
off, two of them say they have no effect. That is the clutter the line
was meant to remove. C is the smallest change, but in the default situation
it says "on yö" while the device is muted. The line then names the
wrong reason, and the real one is at the bottom of the page again, which is
the problem that started this issue.

## What the view assumes from the host

Nothing beyond round 1's C (`sound.night_start` / `sound.night_end` in the
account preferences, being built in `attention-sound-night-clock-impl`).
Off everywhere and the device mute are existing state; the line only reads
them and writes them through the existing setters.

## Decisions for later review

- **Strongest-first order is off › muted › night.** Off reaches every
  device and stays until changed. A mute is this device's lasting choice.
  Night ends by itself in the morning. The alternative is night first,
  because it is the most surprising, but then fixing it would leave the
  person still in silence for a reason they were not told. This is the
  same order the account menu already uses.
- **A shows no hint of further reasons.** One could add "Myös: yö
  22–7" under the strongest one. That turns A into B. Fixing reveals the
  next reason immediately anyway.
- **The listening notes (preview plays at night, Testi soi myös yöllä)
  show only when night is the only silence.** A muted device previews at
  volume 0, so "Kuuntelu soi silti" would be false there.
- **The status line takes the slashed speaker for off and muted, the
  moon for night.** These are the icons the menu row and production's notes
  use.

## Questions for Jari

1. A, B or C? In A, is the order off › muted › night right?
2. When the agent's sound is off on all devices, should the line also say
   "Kuuntelu toimii silti" (as now), or is that noise at the top?
3. Should the account menu's Äänet row use the same words and fix as the
   line (for example *Poista mykistys* in the menu), or stay as it is?

## Build and checks

- Build: `node design-system/prototypes/rounds/2026-11-22-night-quiet-2/build.mjs`
  writes `design-system/prototypes/dist/night-quiet-2/offline.html` (open
  directly) and `index.html` (no fonts, for Glasspad). Directions:
  A Vahvin syy, B Kaikki syyt, C Vain yö.
- `check.mjs`: 216 checks passed. It covers the round directory (no images
  or HTML, nothing over 100 KB) and the picker. On desktop at 1440 px in
  light and dark, it runs every direction in every situation and checks
  that the line is first on the page and names exactly the promised
  reasons. It checks the bottom notes (only C keeps them), the menu row,
  A walking off › muted › night by its fixes with real settings changing,
  B fixing row by row, *Muuta aikaa* reaching the clock, moving the start
  so the night line goes away, and C keeping the mute note. It also checks
  English, and a 390 px phone in light and dark with the line on the first
  screen and no sideways scroll. The console is clean.
- Evidence (not committed): screenshots at
  `/var/tmp/agent-keep/attention-sound-night-visible/shots-2/`.
- No production code changed.
