# Attention sound, round 6: an emblem for each of the ten sounds, on the Settings page

## Saatesanat

Tässä on Asetukset › Äänet lopullisilla kymmenellä äänellä ja valitsemillasi
B Renkaat -laatoilla. Jokaisella äänellä on nyt oma merkki samassa
rengasperheessä, ja kolme suuntaa tekevät sen eri tavoin. A laittaa
renkaiden keskelle äänen esineen: kalimban, marimban laatat, pisaran, kaksi
lasia, kulhon, jääpuikot ja niin edelleen. B jättää kuvan pois ja antaa
renkaiden muodon kertoa esineen: vesirenkaat ovat soikeita, jää
kuusikulmaista, kahden lasin renkaat menevät limittäin ja kuplat ovat
erillään. C taivuttaa renkaan äänen omien osasävelten mukaan, joten lasista
tulee soikio, kalimbasta kuusi aaltoa ja jäästä tähti. Kaikissa kolmessa
renkaat leviävät soidessa lyönti kerrallaan.

Samalla sivulla ovat jo päätetyt valinnat. Äänet ovat oletuksena päällä.
Lyhyet tai Pitkät on yksi valinta kaikille äänille, ja sivun äänet soivat
valitulla pituudella. Keskustelu, jota katsot, on oletuksena hiljaa.
Hiljennä yöllä seuraa laitteen tummaa tilaa, eikä tunteja voi muokata.
Työtiloille valitaan ääni samoista kymmenestä. Lopussa on tämän laitteen
mykistys ja voimakkuus. Yläpalkin ”Agentti valmis” -painikkeista kuulee,
soisiko ääni nyt ja millä äänellä.

Suosittelen A:ta. Esineen tunnistaa ja nimeää katseella myös pienenä
työtilan rivillä, ja renkaat pitävät kymmenen merkkiä yhtenä perheenä.

## Built page

`design-system/prototypes/dist/attention-sound-icons/offline.html` (fonts
embedded) and `index.html` (without fonts), built with
`node design-system/prototypes/rounds/2026-11-21-attention-sound-icons/build.mjs`.
Sources, URL parameters and check commands are in the round's `NOTES.md`.

`check.mjs` passed 1972 checks with a clean console. The round directory
holds no audio, image or HTML file. The page was checked in three
directions × five situations at 1440 and 390 px, in Päivä, Yö and Korkea
kontrasti. In each theme the ten emblems of every direction were rasterised
and compared pairwise. The flows checked were both lengths, the keyboard,
the "agent finished" rules, workspace sounds, mute, night and off. Reduced
motion, English and a phone flow were checked too.

Screenshots (not committed): `/var/tmp/agent-keep/attention-sound-icons/check/`.

## Axis and directions

Axis: **what gives each of the ten sounds its own emblem within the B
Renkaat ring family.** The page, the tiles and every other row are the same
in all three directions. Each emblem is still at rest, the chosen tile is
drawn stronger, and while a sound plays each strike spreads outward at its
own onset in the length being played.

- **A Esine renkaissa.** A pictogram of the object sits inside one ring per
  strike, as in round 3's B. The ten pictograms are kalimba tines on a box,
  graded marimba bars, vibraphone bars over a vibrato wave, the Habitat mark
  on a bar, a drop, two glasses clinking, hanging chime tubes, rising
  bubbles, a bowl with a mallet, and icicles. The long-ringing sounds
  (Vibrafoni, Lasit, Kulho) get a dotted halo. Pictograms are the most
  recognisable and nameable option, and they survive at 32 px. Because the
  rings are shared, the pictogram carries all the difference: rasterised,
  Kalimba and Marimba are the most alike whole emblems (0.24 of the ink
  differs), while the pictograms alone differ by at least 0.55.
- **B Väreilyn muoto.** There is no picture. The geometry of the rings says
  the object:
  - Kalimba: three small ring sets, one per tine, at the notes' heights.
  - Marimba: nested stadium rings.
  - Vibrafoni: solid rings alternating with dashed shimmer rings.
  - Tunnus puu: the Habitat mark built from ring arches and a sun.
  - Pisara: oval water rings below a falling drop.
  - Lasit: two interfering ring sets.
  - Tuulikello: five small rings on a swinging arc.
  - Kuplat: free circles shrinking upward.
  - Kulho: one broad ring with off-centre neighbours, the beating.
  - Jääpuikot: hexagons.

  Ripples start from the strike's own spot, so Tuulikello's tubes and
  Kuplat's bubbles each ring where they are. It is the quietest and most
  abstract direction, and the most distinct when rasterised (at least 0.79
  of the ink differs). The shape has to be learned rather than read.
- **C Värähtelykuvio.** A cymatics figure: the ring bent by the sound's
  partials. Lasit is the wine glass's (2,0) rim mode, an oval. Kalimba
  shows its tine's ≈ 5.95× overtone as six waves, Marimba its 3.99× as four.
  Tunnus puu has three lobes for the motif's three notes. Kulho is the
  bowl's degenerate pair, two crossed ovals. Pisara is an egg heavier
  below, Vibrafoni a fine shimmer, Tuulikello five lobes, Kuplat an
  irregular blob, and Jääpuikot an eight-point star. It is the most
  "sound-like" idea, and when playing the figure spreads and twists
  slightly. At rest several figures read as variants of one wavy ring,
  and at 32 px only the strongest (oval, star) stay distinct.

Shared: the ten tiles form one radio group in a 5-column grid on a
desktop, 4 or 3 columns in between and 2 on a phone, ordered instruments
first, then nature and objects. Tab reaches the chosen tile, arrows and
Home/End move the choice and play, and focus is visible. With reduced
motion nothing spreads and the playing tile still says *Soi*. High contrast
draws every ring at full strength.

## Recommendation

**A Esine renkaissa.** It is the only direction where a person can name a
sound from its emblem without having heard it ("the drop", "the bowl").
That matters most where the emblem appears without a tile around it: the
workspace rows here, and later the conversation menu or a rail row that
just rang. The rings keep the ten together as one family, and they carry
the playing animation unchanged from the B Renkaat Jari chose. B is a good
second if pictograms feel too literal. Its shapes are distinct and calm,
but they have to be learned. C is the most interesting idea and the
weakest at rest.

## Decisions for later review

- **The emblem at rest comes from the short recipe and does not change
  with Lyhyet/Pitkät.** The alternative was to redraw the rings per length
  (Kuplat has five strikes short and seven long). An emblem is an identity,
  and it should not change when an unrelated setting does. The ripples
  while playing do follow the chosen length.
- **Lyhyet is the default.** Alternative: Pitkät. Jari found the longer
  sounds a bit long in round 4, and round 5's page defaulted to short.
- **Choosing a length plays the chosen sound in that length.** Alternative:
  a silent switch. Hearing the difference is the point of the choice, and
  the row says what each length means.
- **One flat grid of ten, not two family groups.** Alternative: round 3's
  family headings. Ten tiles fit two rows on a desktop, and with headings
  the groups of four and six would leave holes in the grid.
- **No "events" checkboxes.** Round 3 showed "on valmis / kysyy". Jari kept
  one sound for both, and the brief listed the decided choices without
  them, so the intro sentence says the sound plays for both. This is easy
  to add back if a separate toggle is wanted.
- **Workspace sounds have "Sama kuin yllä (Kalimba)" as the first option**
  and a ▶ listen button on the row. The row's emblem shows the effective
  sound. The alternative was a mini tile picker per workspace, which
  doubles the page's targets on a phone.
- **This device's mute and volume stay at the foot of the page.** The
  account menu's Äänet row (round 5 A) is the quick route, and the row
  here says so.
- **Round 5's `synth.mjs` is imported, not copied**, so there is one source
  while both rounds are in the tree. NOTES.md says to copy it if round 5 is
  pruned first.

## Storage and host needs

Nothing new beyond round 3's proposal. The length setting is one more
personal key (`length`: `short`|`long`, missing = `short`), and workspace
sounds are a personal map from workspace to sound id. Both are kept in the
person's preferences. Night uses the device's `prefers-color-scheme`, and
"conversation in view" is decided in the browser from state it already has.
No authority moves.

## Questions for Jari

1. **A, B or C?** Or A in Settings, with B's ripple shape used for the
   playing animation (for example the hexagon spreading for Jääpuikot)?
2. Are the ten **pictograms in A** right? Is one wrong or unclear? Tunnus
   puu (the Habitat mark on a bar) and Vibrafoni (bars over a wave) are the
   least obvious.
3. Should **Lyhyet** stay the default, and should choosing a length play
   the sound as here?
4. In the workspace rows, is a **menu with a listen button** enough, or
   should each workspace get the same tiles?
