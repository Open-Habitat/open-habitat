# Prototype round 4: polishing the accepted attention sounds

The round lives in `design-system/prototypes/rounds/2026-11-21-attention-sounds-3/`.
Build it with
`node design-system/prototypes/rounds/2026-11-21-attention-sounds-3/build.mjs`,
which writes `design-system/prototypes/dist/2026-11-21-attention-sounds-3.html`.
The round's `NOTES.md` describes the synthesis, the build and the check. This
is the fourth sound round; the round directory is the third in the
`attention-sounds` series.

## Saatesanat

Tässä ovat 21.11. hyväksymäsi yhdeksän ääntä hiottuina, ja Kalimba on
oletuksena. Valitsimen ensimmäinen näkymä näyttää jokaisen äänen parina
kierroksen 2 version kanssa. *Uusi* soittaa hiotun ja *Kierros 2* vanhan
version, ja *Vertaa* soittaa ne peräkkäin. Aaltokuvissa näkyy, miten vanha
katkesi ja miten uusi hiljenee.

Kulho ja Lasit eivät enää lopu seinään. Vika oli sama kaikissa kierroksen
2 äänissä, vaikka se kuului selvimmin näissä kahdessa: loppuhäivytys alkoi
silloin, kun ääni ja kaiku vielä soivat. Nyt kulho ja lasit saavat soida
täyteen, ja sitten ne vaimenevat pehmeästi niin kuin käsi koskisi niihin.
Kaiku on lyhyempi, joten huone ehtii hiljentyä itse ennen äänen loppua.
Kulho ja Lasit kestävät nyt 1,6 sekuntia, muut 1,1–1,55 sekuntia.

Syvyyttä tuovat kolme lisäystä: soittimen runko (marimban ja vibrafonin
resonaattoriputki, kalimban puulaatikko), perussävelen hitaasti huojuva
pari toisella puolella ja hento oktaavia matalampi pohjasävel. Lisäksi
lyönti kuuluu nyt pienessä huoneessa varhaisten heijastusten kautta.
Äänekkyys on täsmälleen sama kuin ennen, koska tasoitus mittaa korvan
painotuksella.

Toinen näkymä tuo viisi uutta ehdokasta samoilla tyyleillä kuin
hyväksytyt: Sävelrumpu, Harppu, Kitara, Kivi lampeen ja Jääpuikot.
Kolmas näkymä näyttää koko valikoiman sellaisena kuin Asetukset sen
listaisi. Lopussa on kolme kysymystä.

## The list

All sounds are at −17 LUFS-M with a −3 dBFS peak ceiling and at most 1.6 s
long. Every sound has died away on its own before its buffer ends: its last
50 ms peak at −58 dBFS or lower even before the final guard fade. Seven
of the nine round 2 versions sat at −21…−29 dBFS there (Pisara −57,
Kuplat −81).

| Group | Sound (`id`) | Status | What changed or what it is |
| --- | --- | --- | --- |
| Soittimet | **Kalimba** (`kalimba`) | polished, **default** | wooden box resonances (240/520 Hz), beating partner, low partial, small room; 1.4 s |
| Soittimet | Marimba (`marimba`) | polished | resonator tube on the fundamental, low octave, small room; 1.35 s |
| Soittimet | Vibrafoni (`vibrafoni`) | polished | resonator, low octave, damping 0.8 → 1.4 s instead of a cut; 1.55 s |
| Soittimet | Tunnus puu (`tunnus-puu`) | polished | the polished marimba playing the Habitat motif; 1.35 s |
| Soittimet | Sävelrumpu (`savelrumpu`) | new candidate | steel tongue drum, A4 → E5, rubber mallet |
| Soittimet | Harppu (`harppu`) | new candidate | rising harp arpeggio C5, G5, E6 (clean modal strings, not the rejected kantele model) |
| Soittimet | Kitara (`kitara`) | new candidate | soft nylon-string E major, strummed with the fingers, with a body |
| Luonto ja esineet | Pisara (`pisara`) | polished | low "plup" under each drop, cave reflections, reverb 0.9 s instead of 1.1 s; 1.4 s |
| Luonto ja esineet | Lasit (`lasit`) | polished, ending fixed | rings for 0.85 s, then damps 0.85 → 1.4 s, reverb 0.85 s; 1.6 s |
| Luonto ja esineet | Tuulikello (`tuulikello`) | polished | beating pairs, low octave, airy reflections, damping 1.0 → 1.45 s; 1.6 s |
| Luonto ja esineet | Kuplat (`kuplat`) | polished | one larger, low bubble underneath, small-pool reflections; 1.1 s |
| Luonto ja esineet | Kulho (`kulho`) | polished, ending fixed | rings for 0.7 s, then a soft hand-on-rim damping 0.7 → 1.4 s, reverb 1.0 s instead of 1.4 s, low body partial; 1.6 s |
| Luonto ja esineet | Kivi lampeen (`kivi-lampeen`) | new candidate | low "plump" of a pebble with a splash, two small bubbles after it |
| Luonto ja esineet | Jääpuikot (`jaapuikot`) | new candidate | three icicles tapped descending E6, C6, A5, crisper than Tuulikello |

The round 2 versions are on the page as `r2-<id>`, for comparison only.

Dropped as decided on 21.11.: Celesta, Kantele, Sähköpiano, Puupala, all of
Tunnelmat, and every Tunnus except Tunnus puu.

## Decisions for later review

- **Length budget up to 1.6 s for the bowl, glasses and chimes.** The
  alternative was to keep 1.2 s and damp sooner. At 1.2 s a bowl that stops
  ringing at 0.5 s sounds muted rather than natural, and the brief allowed
  ~1.6 s. Kalimba, Marimba and Tunnus puu stay at 1.35–1.4 s, because
  their natural decay ends sooner.
- **Natural decay is checked before the fade, not only after it.** The
  required check, last 50 ms below −50 dBFS, can be met by any steep enough
  fade, and that is exactly the wall Jari heard. So `render.mjs` also
  requires the last 50 ms to be below −45 dBFS before the final guard fade.
  Seven of round 2's nine sounds fail that test by 16–24 dB.
- **"Depth" is weight, beating and room, not level.** Every polished sound
  keeps −17 LUFS-M. The low partial raises sample peaks by 1–2 dB, but the
  K-weighted loudness, the measure the ear tracks, is unchanged.
- **Five new candidates: two plucked strings, one instrument and two
  natural objects.** Plucks were made as modal strings, not Karplus–Strong,
  because the KS Kantele was rejected and the modal tone is cleaner through
  small speakers.
- **Order in Settings: instruments first, then nature.** Kalimba, the
  default, comes first. Tunnus puu sits among the instruments because it is
  a marimba. The alternative order was "default, then alphabetical".

## Questions for Jari

1. Do Kulho and Lasit now end naturally? Is 1.6 s too long for a "something
   became ready" sound, or does it feel right?
2. Did the polish keep the character you liked, or did some sound (for
   example Marimba or Kalimba with its new body) become worse than its
   round 2 version? *Vertaa* plays them back to back.
3. Which of the five new candidates go into the final set: Sävelrumpu,
   Harppu, Kitara, Kivi lampeen, Jääpuikot?

## Evidence

- `check.mjs` passed with 486 checks: render limits, natural-decay tails and
  fingerprints; the round directory free of audio, images, HTML and files
  over 100 KB; 1280 and 390 px in Päivä, Yö and Korkea kontrasti; an
  OfflineAudioContext pass of all 23 sounds through the page's chain; and
  the play buttons. The console stayed clean.
- The round 2 recipes carried as "before" were confirmed bit-identical
  (SHA-256 of 16-bit PCM) to round 2's `fingerprints.json` when this round
  was built.
- Screenshots: `/var/tmp/agent-keep/attention-sounds-3/check/`.
- WAVs (48 kHz 16-bit stereo, not committed):
  `/var/tmp/agent-keep/attention-sounds-3/wav/`.
