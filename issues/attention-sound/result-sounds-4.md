# Prototype round 5: richer, more natural sounds in a short and a long length

The round lives in `design-system/prototypes/rounds/2026-11-21-attention-sounds-4/`.
Build it with
`node design-system/prototypes/rounds/2026-11-21-attention-sounds-4/build.mjs`,
which writes `design-system/prototypes/dist/2026-11-21-attention-sounds-4.html`.
The round's `NOTES.md` describes the synthesis, the build and the check.

## Saatesanat

Tässä ovat kaikki 14 ääntä uudelleen tehtyinä. Jokainen on nyt lyhyenä
(0,6–0,8 s) ja pitkänä (1,2–1,5 s), ja jokaisen vieressä on kierroksen 4
versio. Kortin *Lyhyt*, *Pitkä* ja *Kierros 4* soittavat kukin yhden
version, ja *Vertaa* soittaa ne peräkkäin: ensin kierroksen 4, sitten
lyhyen ja lopuksi pitkän. Yläreunan *Pituus*-valinta päättää, kumpi pituus
soi *Neljästi*-painikkeesta, valikoiman riveistä ja *Soita kaikki*
-painikkeesta.

Ensimmäisessä näkymässä ovat hyväksytyt yhdeksän ääntä, toisessa viisi
uudelleen tehtyä ja kolmannessa koko valikoima Asetusten järjestyksessä,
oletuksena Kalimba. Äänekkyys on sama kuin ennen.

Digitaalisuuden suurin syy oli se, että jokainen osasävel soi taulukon
voimakkuudella riippumatta siitä, millä ääntä lyötiin. Nyt nuijan, peukalon
tai sormen kosketus pehmentää yläsävelet niin kuin oikeasti. Jokainen
osasävel on kaksi hieman eri vireistä värähtelyä, joista toinen sammuu
nopeammin. Siitä syntyy oikean esineen huojunta ja kaksivaiheinen
sammuminen. Osasävelet ovat myös lievästi epävireisiä, niin kuin oikeassa
esineessä. Runko on nyt suodin, jonka läpi koko ääni kulkee: kalimban
laatikko, kitaran koppa, harpun kaikupohja ja rummun kuori. Huone on
tiheämpi, ja Kivi lampeen soi ulkona rannan kaikuineen.

Lyhyt versio ei ole pitkästä leikattu. Se on sama esine nopeammin
vaimennettuna, ja se hiljenee itse ennen loppuaan. Lopussa on kolme
kysymystä, joista tärkein on, mitkä äänet tulevat lopulliseen
valikoimaan.

## Built page

`design-system/prototypes/dist/2026-11-21-attention-sounds-4.html` (fonts
embedded, ~233 kB, opens directly in a browser).

## The list

Every render is at −17.0 LUFS-M (±0.5 LU, tighter than round 4's ±1) with a
−3 dBFS peak ceiling. Each one dies away on its own: before the final guard
fade, the last 50 ms peak at −53 dBFS or lower.

| Group | Sound (`id`) | Status | Short | Long | What changed |
| --- | --- | --- | --- | --- | --- |
| Soittimet | **Kalimba** (`kalimba`) | kept, **default** | 0.72 s | 1.35 s | thumb contact and knock through a three-resonance box (240/520/1150 Hz), split modes, slight detuning |
| Soittimet | Marimba (`marimba`) | kept | 0.70 s | 1.30 s | yarn mallet (1.1 ms) darkens the upper modes, split modes, thump |
| Soittimet | Vibrafoni (`vibrafoni`) | kept | 0.78 s | 1.50 s | cord mallet, split modes, damping like a lifted pedal |
| Soittimet | Tunnus puu (`tunnus-puu`) | kept | 0.72 s | 1.30 s | the new marimba playing the Habitat motif |
| Soittimet | Sävelrumpu (`savelrumpu`) | redone | 0.76 s | 1.42 s | rubber mallet (2.5 ms), untuned plate modes, shell resonances 150/330/620 Hz |
| Soittimet | Harppu (`harppu`) | redone | 0.76 s | 1.42 s | triangle-plucked strings with two polarisations, settling pitch, soundboard; F4 C5 A5 |
| Soittimet | Kitara (`kitara`) | redone | 0.78 s | 1.45 s | six-string E major down-strum, soft thumb, body 100/205/410/800 Hz |
| Luonto ja esineet | Pisara (`pisara`) | kept | 0.68 s | 1.25 s | bubbles keep rising through their life, deeper cave reflections |
| Luonto ja esineet | Lasit (`lasit`) | kept | 0.78 s | 1.45 s | hard contact, beating split modes |
| Luonto ja esineet | Tuulikello (`tuulikello`) | kept | 0.78 s | 1.45 s | wooden clapper, split modes; tubes swing tighter in the short length |
| Luonto ja esineet | Kuplat (`kuplat`) | kept | 0.60 s | 1.20 s | rising bubbles; the long length has two late small bubbles |
| Luonto ja esineet | Kulho (`kulho`) | kept | 0.80 s | 1.50 s | felt mallet (4 ms) and thump, modes split by 10 cents for the slow beating |
| Luonto ja esineet | Kivi lampeen (`kivi-lampeen`) | redone | 0.62 s | 1.25 s | splash, rising cavity bubble and pinch-off bubble, random splash droplets, outdoors with a shore echo |
| Luonto ja esineet | Jääpuikot (`jaapuikot`) | redone | 0.72 s | 1.38 s | tapered ice rod, strong detuning, 0.12 ms tap, sympathetic neighbours |

Round 4's versions are on the page as `r4-<id>`, for comparison only. They
are bit-identical to what Jari heard in round 4.

## Decisions for later review

- **Short 0.6–0.8 s, long 1.2–1.5 s.** The brief allowed up to 1.6 s for
  the long length. I kept the long lengths at or below 1.5 s because Jari
  found round 4's longest sounds (1.6 s) a bit long. The alternative was to
  keep 1.6 s for Kulho and Lasit.
- **A short sound is the same object damped sooner, not a long sound cut
  off.** Every decay time is scaled by 0.45–0.55, and arpeggios tighten by
  15–25 %. The alternative, a fade on the long render, would bring back the
  "into a wall" ending. The raw-tail check would fail it.
- **The page defaults to Lyhyt.** Jari found the sounds too long, so the
  short length is what *Soita kaikki* and the set play first. Long is one
  press away.
- **Harppu moved down to F4, C5, A5** from C5, G5, E6. A harp's colour is in
  its middle register, and the old high E6 was the thinnest note of round 4.
  The alternative was the old notes with the new string model.
- **Kitara strums six strings E3–E5** instead of four from E4. The low
  strings excite the body, and that is where a guitar's colour comes from.
- **Kivi lampeen's droplets are seeded random.** Each render is the same,
  but droplet times and pitches are irregular, which is what makes water
  sound like water rather than a pattern.
- **Loudness tolerance tightened to ±0.5 LU.** All renders land on −17.0,
  so short and long lengths of the same sound are equally loud.
- **The Settings choice of length is not designed here.** If both lengths
  stay, Settings needs a "Lyhyt / Pitkä" choice next to the sound. I left
  that for the Settings round. The alternative is one length per sound,
  chosen by Jari now.

## Questions for Jari

1. **Which sounds go into the final set?** All 14, or a subset? In
   particular, which of the five redone ones (Sävelrumpu, Harppu, Kitara,
   Kivi lampeen, Jääpuikot) now have enough colour?
2. **Short or long, or both?** Should the person choose the length in
   Settings, or should every sound have one fixed length (and which one)?
3. Did any kept sound lose character it had in round 4? *Vertaa* plays
   round 4, short and long back to back.

## Evidence

- `check.mjs` passed with 750 checks. They cover the render limits for
  both lengths of every sound, natural-decay tails and fingerprints, and
  round 4's versions matching round 4's own fingerprints. The round
  directory was free of audio, images, HTML and files over 100 KB. Pages
  rendered at 1280 and 390 px in Päivä, Yö and Korkea kontrasti. All 42
  renders passed through the page's audio chain in an
  `OfflineAudioContext`. The play, compare, repeat and play-all buttons
  worked in both lengths. The console stayed clean.
- Screenshots: `/var/tmp/agent-keep/attention-sounds-4/check/`.
- WAVs (48 kHz 16-bit stereo, not committed):
  `/var/tmp/agent-keep/attention-sounds-4/wav/`.
- The sounds were judged by measurement and physics, not by ear. No
  listening test was possible in the worker. Jari's listening is the
  judgement.
