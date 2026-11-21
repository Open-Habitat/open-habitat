# Attention sound: the workspace's sound in the head's settings strip (round 3)

## Saatesanat

Tämä kierros jatkaa C Asetusnauhaa. Työtilan otsikon alla on kolme
asetuspainiketta: Kuvake, Nimi ja Ääni. Kaikki kolme ovat aina samankokoisia,
olipa sana tai arvo miten pitkä tahansa, eikä mikään liiku, kun ääni
vaihtuu. Suunnat eroavat nauhan muodossa. A:ssa on kolme neliöruutua, joissa
iso kuva on keskellä ja arvo sen alla. B:ssä on kolme yhtä leveää matalaa
painiketta, joissa kuva on vasemmalla. C on yksi reunustettu nauha, joka on
jaettu kolmeen yhtä leveään osaan.

Sivupalkin riveillä ei ole enää nuottia. Merkit ovat kierroksen 7
suositellut. Valitsin on sama kuin edellisellä kierroksella: kortin
painallus valitsee ja soittaa, ja ▶ soittaa valitsematta. Oletuskin näkyy
(”Kalimba · oletus”).

Suosittelen A:ta. Siinä painikkeet ovat aidosti samankokoisia ja merkki
näkyy suurimpana. Puhelimessakin kaikki kolme mahtuvat rinnakkain, eikä
mitään tarvitse vierittää. B on selkein lukea mutta vie puhelimessa kolme
riviä. C on siistein yhtenä esineenä, mutta puhelimessa Ääni jää
näkymän ulkopuolelle.

## Built page

`design-system/prototypes/dist/workspace-sound-strip-3/offline.html` (fonts
embedded) and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-21-workspace-sound-strip-3/build.mjs`.
A copy of the built page that outlives the worktree:
`/var/tmp/agent-keep/attention-sound-workspace-sounds-3/offline.html`.
Sources, URL parameters and check commands are in the round's `NOTES.md`.

`check.mjs` passed 1296 checks with a clean console. The round directory
holds no audio, image or HTML file. All three variants were checked at 1440
and 390 px in Päivä, Yö and Korkea kontrasti, each with the picker closed
for kotisivu (own sound Pisara) and for aurinkokello (Kalimba · oletus), and
with the picker open.

What the check measures for equal size and no shift:

- In every variant, width, theme and scenario, Kuvake, Nimi and Ääni have
  the same width and height within half a pixel. They are measured again in
  English, where the values are longer ("Motif, wood · default").
- No strip value is clipped or cut with an ellipsis.
- The boxes are identical for Pisara and for Kalimba · oletus.
- In each variant's strip, at 1440 and 390 px and in English, the choice
  moves through Sama kuin oletus, Jääpuikot, Tunnus puu, Kuplat, Lasit and
  Pisara. All three strip buttons, the pop-up and the workspace name must
  stay within half a pixel. The Settings rows get the same test.
- The variants differ visibly. A's tiles are square at 1440 and three across
  on a phone. B's buttons are at least 2.5 times as wide as they are high,
  and stacked on a phone. C's segments touch each other, the whole strip
  fits at 1440, and on a phone it scrolls sideways inside itself without
  widening the page.
- The rail rows hold no note, with or without hover.

At 1440 Päivä, each variant's flow was clicked through: ▶ plays without
choosing, a press chooses and plays, arrows move the choice, the ▶ on Sama
kuin oletus plays the default, and Valmis and Esc close and return focus to
the Ääni button. Also checked: the length link, long sounds, sounds off,
"agent finished" making the strip's emblem ripple, English, and a phone
flow.

Screenshots (not committed): `/var/tmp/agent-keep/attention-sound-workspace-sounds-3/check/`.

## Axis and variants

Axis: **the form of the settings strip when all its buttons are the same
size.** Every button has the same three parts: a small label with an icon
(image, pencil, note), a large picture (the workspace's letter, "Aa", the
sound's 44 px emblem) and the value. The size always comes from the grid,
never from the button's own content.

- **A Ruudut (tiles).** Three squares of 152 × 152 px. The label is at the
  top, the picture in the middle, and the value below it in a box two lines
  high. A value breaks only before "· oletus". On a phone the three tiles
  share the width (about 114 × 140 px), and a long workspace name wraps
  within the tile's two lines.
- **B Leveät painikkeet (wide buttons).** Three equal columns of the head's
  width, at most 840 px, all 72 px high. The picture is on the left and the
  label sits above a one-line value. On a phone the buttons stack into equal
  64 px rows.
- **C Yhtenäinen nauha (one strip).** One bordered object cut into three
  equal segments, 68 px high. The segments are as wide as the widest
  content. For the sound that means every value it can take, so the width
  never changes. On a phone the strip keeps its size and scrolls sideways
  with snapping. Kuvake shows first, and Ääni has to be scrolled to.

Shared:

- **Rename moves into the strip** (Nimi), so the action row keeps Copy path,
  Archive and New conversation. Kuvake and Nimi are placeholders and do
  nothing in this round.
- **The rail has no sound control**, not even on hover.
- **The picker and the Settings rows** are round 2's, unchanged.

## Recommendation

**A Ruudut.** Of the three, it makes "the same size" visible. The buttons
are equal squares, not just equal columns. The emblem is the largest thing
in the button, which is how you said it works best. And it is the only
variant that keeps all three settings in view on a phone without scrolling
or a taller head. B reads fastest on the desktop, but on a phone it becomes
three full-width rows, about 210 px of head before the conversations begin.
C is the tidiest single object on the desktop, but on a phone it hides the
sound, the one setting this round is about.

## Decisions for later review

- **A press on a card still chooses and also plays the sound.** The
  alternative is a silent choice, with ▶ as the only way to listen. Playing
  on choose confirms what the workspace will sound like now. It matches the
  Settings tiles, where a press plays and chooses, and the press is a
  deliberate act in a pop-up opened to choose a sound, so the sound is
  expected. ▶ is there for listening without changing the choice.
- **Equal size comes from the grid, not from reserving the widest value**
  (A and B). In A, the tile size is fixed and the value has a fixed
  two-line box. In B, the columns are equal fractions of the head. Only C,
  whose segments size to content, keeps round 2's ghost values, so that the
  sound's segment is always as wide as its longest possible value.
- **No value is cut with an ellipsis** in the default sound names. A long
  workspace name in A wraps within two lines. In B it would be cut with an
  ellipsis. A real installation can have names longer than the synthetic
  ones, so this is where A and B would differ.
- **The rail row's right edge is left empty.** Production's rail shows a
  `…` workspace menu there. This page leaves it out so the sound note's
  absence is unambiguous, and the menu itself is not part of this round.
- **The Nimi picture is "Aa"**, not a second pencil, because the label
  already carries the pencil. Kuvake shows the workspace's letter, as
  production's workspace icon does by default.
- **The emblems are round 7's recommended variants** (Kalimba 2, Marimba 1,
  Vibrafoni 2, Tunnus puu 1, Pisara 0, Lasit 1, Tuulikello 0, Kuplat 1,
  Kulho 3, Jääpuikot 2), as you asked.

## Storage and host needs

Unchanged from round 1. The person's preferences hold a personal map from
workspace to sound id, where a missing entry means Sama kuin oletus. The
strip and Settings read and write the same map. Kuvake and Nimi would use
the existing workspace icon and rename paths. No authority moves.

## Questions for Jari

1. **A, B or C?** Or A as recommended?
2. On a phone, is A's three-across with a two-line value good, or would you
   rather have B's stacked rows or C's sideways scroll?
3. Should a **card press keep playing** the sound as it chooses it (kept
   here), or choose silently?
4. Rename now lives in the strip as Nimi. Is it right to **remove it from
   the action row**, and should Kuvake and Nimi open their real editors in
   the next round?
