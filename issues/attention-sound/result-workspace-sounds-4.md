# Attention sound: the workspace's sound in a strip of buttons sized by kind (round 4)

## Saatesanat

Tämä kierros jatkaa kierroksen 3 B:tä. Nyt painikkeiden koko riippuu siitä,
mitä kukin tarvitsee. Kuvake ja Ääni ovat neliöitä, joissa työtilan kirjain
ja äänen merkki näkyvät isoina. Nimi on matalampi ja leveämpi painike, jossa
näkyy itse nimi. Koko tulee painikkeen lajista eikä arvosta, joten mikään ei
liiku, kun ääni vaihtuu. Kaikki muu on ennallaan.

Suunnat eroavat järjestyksessä ja mittasuhteissa. A:ssa kaikki kolme ovat
samalla rivillä ja yhtä korkeita. B:ssä Nimi on matala palkki kahden
isomman neliön yllä. C:ssä Nimi tulee ensin, ja neliöissä on pelkkä kuva:
sana ja arvo ovat neliön alla.

Suosittelen B:tä. Vain siinä Nimi on oikeasti matalampi kuin neliöt, kuten
pyysit. Merkki näkyy siinä suurimpana (76 px), ja nauha on puhelimessa
täsmälleen sama kuin työpöydällä. Hintana on korkeus: nauha vie noin 220 px,
kun A vie 128 px. A on lähimpänä kierroksen 3 B:tä ja matalin, mutta siinä
Nimi on yhtä korkea kuin neliöt, eli ei matalampi vaan vain leveämpi.

## Built page

`design-system/prototypes/dist/workspace-sound-strip-4/offline.html` (fonts
embedded) and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-21-workspace-sound-strip-4/build.mjs`.
A copy of the built page that outlives the worktree:
`/var/tmp/agent-keep/attention-sound-workspace-sounds-4/offline.html`.
Sources, URL parameters and check commands are in the round's `NOTES.md`.

`check.mjs` passed 1643 checks with a clean console. The round directory
holds no audio, image or HTML file. All three variants were checked at 1440
and 390 px in Päivä, Yö and Korkea kontrasti. Each was checked with the
picker closed for kotisivu (own sound Pisara) and for aurinkokello (Kalimba ·
oletus), and with the picker open.

What the check measures for sizing and no shift:

- **Sized by kind.** Kuvake and Ääni have the same box within half a pixel,
  and the framed square is square. Nimi is at least 1.15 times as wide as it
  is high and wider than the squares. These hold in every variant, width,
  theme and scenario, and in English on desktop and phone.
- **Nothing cut.** No value is clipped or ellipsised, and no label, picture
  or value spills out of its button. The synthetic workspace names fit on
  one line, so an identifier is never broken mid-word.
- **Value-independent boxes.** The boxes for Pisara and for Kalimba · oletus
  are identical.
- **No shift.** In each variant, at 1440 and 390 px and in English on both
  widths, the choice goes through Sama kuin oletus, Jääpuikot, Tunnus puu,
  Kuplat, Lasit and Pisara. The three strip buttons, the pop-up and the
  workspace name must all stay within half a pixel. The Settings rows get
  the same test.
- **The variants differ.** A is ordered Kuvake–Nimi–Ääni in one row of one
  height. In B, Nimi sits above the squares, spanning both, and the squares
  are at least twice as high as Nimi. C is ordered Nimi–Kuvake–Ääni in one
  row, with the label under the square's frame. On a phone the whole strip
  is visible in every variant.
- **The rail** has no note, with or without hover.

At 1440 Päivä each variant's flow was clicked through:

- ▶ plays without choosing.
- A press on a card chooses and plays.
- Arrows move the choice.
- ▶ on Sama kuin oletus plays the default.
- Valmis and Esc close the pop-up and return focus to the Ääni button.

Also checked: the length link, long sounds, sounds off, the strip's emblem
rippling on "agent finished", English, and a phone flow.

Screenshots (not committed):
`/var/tmp/agent-keep/attention-sound-workspace-sounds-4/check/`.

## Axis and variants

Axis: **the arrangement and proportions of the mixed strip.** There are two
kinds of button. A square (Kuvake, Ääni) shows the workspace letter or the
sound's emblem large. A flat button (Nimi) shows the name itself in large
monospace. The kind sets the size, never the value.

- **A Yksi rivi (one row).** Kuvake–Nimi–Ääni, all 128 px high. The squares
  are 128 × 128 with the label on top, the picture (emblem 52 px) and the
  value in a two-line box. Nimi is 300 × 128. On a phone the squares are
  104 px (emblem 40 px), Nimi takes the rest (about 134 px), and the name
  drops to 14 px so it fits on one line.
- **B Nimi ylhäällä (name on top).** Nimi is a 60 px bar as wide as the two
  squares below it together (306 px), with the label inline before the
  name. The squares are 148 × 148 with the emblem at 76 px. The size is the
  same on a phone, where it fits as it is.
- **C Sanat ruutujen alla (words under the squares).** Nimi–Kuvake–Ääni in
  one row. The framed boxes are 104 px high. The squares hold only the
  picture (emblem 64 px), and the label and value sit under the frame in a
  caption of fixed height. Nimi's frame is 260 px wide, with "Nimi" under it.
  On a phone the squares are 96 px (emblem 56 px) and Nimi takes the rest.

Shared, unchanged from round 3: rename lives in the strip as Nimi; Kuvake
and Nimi are placeholders; no rail note; round 7's recommended emblems; the
picker and the Settings rows.

## Recommendation

**B Nimi ylhäällä.** It is the only variant where Nimi is actually flatter
than the squares, which was the point of your note. In A, Nimi is as high
as the squares, so it is only wider. B also gives the emblem the most room:
at 76 px it is the largest it has been in the strip. And it is the only
variant that is identical on desktop and phone, so nothing in the strip
needs a separate phone design.

The cost is height. B's strip is about 218 px against A's 128 px, before
the conversations begin. If the head should stay low, A is the choice.
C reads well on the desktop, but its captions under the frames make the
strip's lower edge ragged: "Kalimba · oletus" takes two lines where Kirjain
takes one, inside the same fixed box.

## Decisions for later review

- **A's phone layout keeps one row.** On a phone A's Nimi is about 134 × 104
  px, so it is barely flatter than the squares. The alternative was moving
  Nimi to its own row, but that is B. I kept A recognisable as one row and
  let the check accept a 1.15 aspect ratio.
- **The name never breaks inside an identifier for the synthetic names.**
  A's phone name drops to 14 px for that. A real workspace name longer than
  about 13 characters will still wrap within Nimi's box rather than be cut.
  No ellipsis is used, because the name is an identifier people copy.
- **B's Nimi puts the label inline before the name**, not above it. At 60 px
  this keeps the bar visibly flat. Above the name, the bar would need about
  72 px.
- **In C the button has no frame of its own; the box carries it.** Hover
  and the open state outline the box, while focus outlines the whole
  button, caption included, because the caption is part of the press
  target.
- **A card press still chooses and plays**, as in round 3.

## Storage and host needs

Unchanged from round 1. The person's preferences hold a personal map from
workspace to sound id, where a missing entry means Sama kuin oletus. Kuvake
and Nimi would use the existing workspace icon and rename paths. No
authority moves.

## Questions for Jari

1. **A, B or C?** Or B as recommended?
2. In B, is about 218 px of strip under the head acceptable, or should the
   head stay as low as A's single row?
3. In A, Nimi is as high as the squares. Is that "flatter enough", or does
   Nimi have to be visibly lower than the squares, as in B?
4. Should Kuvake and Nimi open their real editors in the next round?
