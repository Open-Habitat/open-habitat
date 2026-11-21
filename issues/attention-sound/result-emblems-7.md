# Attention sound, round 7: three variants of every ripple emblem

## Saatesanat

Valitsit B Väreilyn muodon, joten tässä jokainen kymmenestä merkistä on
kolmena muunnelmana nykyisen rinnalla. Jokaisella kolmikolla on oma
ajatuksensa, ja se lukee rivin otsikossa. Useimmissa kolmikko on
kirjaimellisempi, abstraktimpi ja liikkeellisempi versio. Kalimballe ja
Kulholle tein rohkeimmat vaihtoehdot, kuten pyysit. Kalimbassa ne ovat
kielet, koko soitin ja yksi heilahtava kieli. Kulhossa ne ovat kulho
vinosta, huojunta renkaan paksuutena ja nuijan kierros spiraalina.

Ensimmäinen näkymä, *Vertailurivit*, näyttää kymmenen ääntä riveinä. Jokainen
merkki on rivillä kahdessa koossa: laatan koossa ja työtilarivin koossa.
Merkkiä painamalla ääni soi, ja väreily leviää lyönti kerrallaan. Kunkin
muunnelman alla on *Asetuksiin*. Toinen näkymä, *Asetuksissa*, on kierroksen
6 Asetukset › Äänet valitsemillasi muunnelmilla. Siellä näet, miltä
kymmenen merkkiä näyttävät yhdessä laattoina ja työtilariveillä.
Suosittelemani muunnelmat ovat valmiiksi valittuina. *Kaikki nykyiset*
palauttaa kierroksen 6 sarjan vertailtavaksi.

Äänet ovat ennallaan, ja Lyhyet on oletus.

Suosittelen seitsemään ääneen uutta muunnelmaa ja kolmeen nykyistä.
Suurimmat muutokset ovat Kalimba 2 *Koko soitin* ja Kulho 3 *Kiertävä nuija*.

## Built page

`design-system/prototypes/dist/attention-sound-emblems-7/offline.html` (fonts
embedded) and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-21-attention-sound-emblems-7/build.mjs`.
The picker has two views, *Vertailurivit* and *Asetuksissa*. Sources,
URL parameters and check commands are in the round's `NOTES.md`.
`?valinta=0000000000` opens with round 6's set, and any ten digits 0–3 open
with a chosen set.

`check.mjs` passed 1481 checks with a clean console. The round directory
holds no audio, image or HTML file. Both views were checked at 1440 and
390 px in Päivä, Yö and Korkea kontrasti, and the Settings view in all five
situations. Rasterised at 1440, the four emblems in every row differ
pairwise by at least 0.56 of their ink (Kulho 0 and 2 are the closest). All
forty emblems differ by at least that much, and the ten in the Settings
grid by at least 0.79, both with the recommended set and with round 6's.
Every one of the forty cells plays its sound with one ripple per strike.
Pitkät plays the long recipe. A chosen variant appears in the Settings
tiles, `?valinta=` works, and round 6's Settings flow, reduced motion,
English and a phone flow were checked too.

Screenshots (not committed): `/var/tmp/agent-keep/attention-sound-emblems-7/check/`.

## What each trio tries

Variant 0 is round 6's B in every row. The other three variants of each
sound follow that row's stated idea. All of them stay inside the ring
family: there is no picture, the rings or ring-like outlines carry the
object, and while the sound plays each strike spreads from its own origin
in that origin's shape.

- **Kalimba**: three bold readings of the instrument.
  1. *Kolme kieltä*: three tines as long as their notes, each with its own ring.
  2. *Koko soitin*: five tines in a V on the box, the three that sound drawn strong. Each strike ripples up its own tine. This is the boldest variant.
  3. *Näppäys*: one tine swinging from its root, its outlines leaning in turn.
- **Marimba**: more literal, more abstract, more motion.
  1. *Laatat*: three graded bar rings stacked.
  2. *Puun syy*: square-cornered growth rings.
  3. *Lyönnit kulkevat*: three bar rings stepping up and to the right.
- **Vibrafoni**: three sources of the shimmer.
  1. *Kaksi laattaa*: two bars inside a dashed shimmer ring.
  2. *Värinä*: a gently undulating middle ring.
  3. *Tuuletin*: broken rings whose gaps turn, from the rotating fan discs.
- **Tunnus puu**: the mark.
  1. *Merkki*: the mark drawn tighter, with interlocking arches, the sun beside it and one ring around.
  2. *Kolme säveltä*: arches rising from a line, one per note, each as large as its note is strong.
  3. *Aurinko soi*: the sun's rings radiate above two small arches.
- **Pisara**: how many drops, the splash, and the surface from the side.
  1. *Kolme pisaraa*: three oval ring sets, one per drop.
  2. *Kruunu*: a splash crown and two droplets above the rings.
  3. *Pinta sivulta*: a damped wave line under a drop.
- **Lasit**: the touch, the angle, the ring-on.
  1. *Kilahdus*: two rings touching at one point, with a spark there.
  2. *Lasin reuna*: two tilted rims leaning together.
  3. *Sointi jää*: the second glass higher and smaller, inside a dashed ring for the long ring-on.
- **Tuulikello**: the tubes from the front, in the wind, and from below.
  1. *Putket*: five tubes hanging from a bar, each as long as its note.
  2. *Tuulessa*: five tilted ovals swinging.
  3. *Kehä*: the chime seen from below, five rings on a circle around the clapper.
- **Kuplat**: the surface, the cluster, the rise.
  1. *Pintaan*: bubbles rise to a surface line, and an oval ring forms where they reach it.
  2. *Vaahto*: a cluster of near-touching rings.
  3. *Huojuva nousu*: squashing ovals rising in a wiggle.
- **Kulho**: the boldest readings.
  1. *Kulhon suu*: the bowl at an angle, with a heavy oval rim and rings inside it.
  2. *Huojunta*: one heavy ring that thickens and thins around its circumference, the beating made visible.
  3. *Kiertävä nuija*: a spiral winding out to the mallet's dot, for the long singing ring.
- **Jääpuikot**: the icicle's shape, the crystal's shape, the falling taps.
  1. *Puikot*: three icicle-shaped rings hanging from an eave.
  2. *Kide*: hexagons turned 30° in turn.
  3. *Helähdys*: three small hexagon sets stepping down.

## Recommendation per sound

| Sound | Recommended | Why |
|---|---|---|
| Kalimba | **2 Koko soitin** | The only kalimba emblem that a person names as a kalimba without having heard it. It holds up at 32 px, and its three strong tines match the three notes. 1 is calmer but reads as "bars". 3 is too thin at row size. |
| Marimba | **1 Laatat** | Graded bars say "mallet instrument" directly, and stacked horizontally they are not confused with Kalimba's upright tines. |
| Vibrafoni | **2 Värinä** | Vibrato is what tells the vibraphone apart from the marimba, and one undulating ring says it calmly. 3 Tuuletin reads as a loading spinner, and 1 is too close to Marimba 1 when both are chosen. |
| Tunnus puu | **1 Merkki** | It is closest to the actual Habitat mark. The enclosing ring keeps it in the family, and the sound is the mark's motif. |
| Pisara | **0 (keep)** | The oval rings under a drop already say the word exactly. 2 Kruunu is a good alternative if a livelier one is wanted. |
| Lasit | **1 Kilahdus** | The touching point is the clink. It is clearer than round 6's interference, which at 32 px blurs into one blob. |
| Tuulikello | **0 (keep)** | Round 6's rings on a swinging arc are already distinct. 1 Putket, the other good option, would put three "hanging/standing sticks" emblems (with Kalimba 2 and Jääpuikot 1) side by side in the grid. |
| Kuplat | **1 Pintaan** | The surface line gives the bubbles a direction and a place to arrive. 2 Vaahto is the most distinct, but it is static. |
| Kulho | **3 Kiertävä nuija** | It is the boldest, and the only one that shows both the rubbing gesture and the long ring-on. 2 Huojunta is the strongest abstract option, but it can read as an eye. |
| Jääpuikot | **2 Kide** | It keeps the hexagon idea Jari already liked and makes it more crystalline. 1 Puikot is more literal, but it crowds the grid next to Kalimba 2 and Tuulikello. |

## Decisions for later review

- **Variant 0 is round 6's emblem, unchanged, and is offered as a choice.**
  The alternative was three new variants only. Keeping the current one in
  the row makes "better than now?" the question, and the recommendation
  keeps it for three sounds.
- **The Settings set starts as the recommendation, not as round 6's set.**
  The alternative was to start at the current set. Starting with the
  recommendation shows the proposal where it will live. *Kaikki nykyiset*
  is one press away.
- **Choices are a radio per row, not a press on the emblem.** Pressing an
  emblem only plays it, so listening never changes the choice. The
  Settings tiles still choose on press, as in round 6.
- **Workspace-row size is shown in every cell** beside a synthetic
  workspace name, rather than in a separate size strip, so each variant is
  judged at both sizes at once.
- **Kalimba 2 and Tuulikello 1 use stroke outlines of tines and tubes
  rather than concentric rings.** This stretches the family slightly, and
  the brief asked for bold alternatives. Each ripple still spreads in the
  outline's own shape.
- **The phone layout shows the four cells as a 2 × 2 grid.** The
  alternative, a horizontal scroller, hides variants.
- Round 6's phone bug, where the 32 px workspace emblem grew to 64 px
  below 600 px, is fixed in this round's CSS. It needs the same care in
  implementation.

## Storage and host needs

None beyond round 6. The emblem is a static asset per sound id, and no
setting chooses the variant. The variant is decided here and ships as the
emblem.

## Questions for Jari

1. **Kalimba**: is 2 *Koko soitin* the one, or is it too much of a picture
   for the ring family? Would you rather have 1 *Kolme kieltä*?
2. **Kulho**: is 3 *Kiertävä nuija* (the spiral) right, or is 2
   *Huojunta* (the thick and thin ring) better?
3. Should **Pisara and Tuulikello** keep round 6's emblems as recommended,
   or should they change too?
4. Is any variant here wrong in a way the rows do not show, for example
   when it plays? Each trio can be riffed again from your choice.
