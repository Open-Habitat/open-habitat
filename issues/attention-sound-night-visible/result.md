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
