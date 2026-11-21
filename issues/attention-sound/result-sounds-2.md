# Prototype round 2: richer and more varied attention sounds

Round `design-system/prototypes/rounds/2026-11-21-attention-sounds-2/`,
built with
`node design-system/prototypes/rounds/2026-11-21-attention-sounds-2/build.mjs`
into `design-system/prototypes/dist/2026-11-21-attention-sounds-2.html`.
Synthesis, build and check are described in the round's `NOTES.md`.

## Saatesanat

Tässä on 21 uutta omaa huomioääntä neljänä perheenä, ja vertailuksi
kierroksen 1 Ovi. Valitsin vaihtaa perhettä. Jokaisen äänen voi soittaa
kerran tai neljästi peräkkäin, ja *Ovi ensin* soittaa ensin vanhan Ovin
ja heti perään uuden äänen, jolloin eron kuulee suoraan. *Soita kaikki*
käy läpi koko perheen.

Äänet on tehty nyt huolellisemmin. Lyödyt esineet (marimba, kalimba,
lasit, kellot, kulho) rakentuvat soittimen omista ylä-äänisuhteista ja
pehmeästä kapulan iskusta. Kantele näppäillään kielimallilla. Tunnelmat
ovat paisuvia sointuja. Kaikki soivat stereona pienessä tai isommassa
huoneessa, jonka kaiku lasketaan koodissa. Äänekkyys on tasattu korvan
mukaan, joten mikään ääni ei hyppää esiin muita kovempana. Terävä
yläpää on suodatettu pois, ja jokainen ääni loppuu alle 1,2 sekunnissa
ilman naksahdusta. Mitään valmista näytettä tai valmistajan ääntä ei ole
mukana, vaan jokainen ääni syntyy sivulla omasta reseptistään.

Suosittelen oletusääneksi **Tunnus puuta**. Se on Habitatin oma kolmen
sävelen aihe (kaksi kaarta nousevana kvinttinä ja aurinko pehmeästi
niiden yllä) marimban lämpimällä puulla. Asetuksiin ehdotan lyhytlistaksi
Tunnus puu, Kalimba, Kantele, Pisara ja Hehku: yksi oma, kaksi soitinta,
yksi esine ja yksi tunnelma. Lopussa on neljä kysymystä.

## Axis and families

The axis is the kind of sound. Every new sound is stereo, at most 1.2 s
long, normalised to −17 LUFS momentary maximum with a −3 dBFS peak
ceiling, and keeps less than −30 dB of its energy above 6 kHz.

| Family | Line | Sounds (id) |
| --- | --- | --- |
| **A Soittimet** | Short two- and three-note motifs on familiar instruments: warm, recognisable, clearly music. | Marimba (`marimba`), Kalimba (`kalimba`), Celesta (`celesta`), Vibrafoni (`vibrafoni`), Kantele (`kantele`), Sähköpiano (`sahkopiano`) |
| **B Luonto ja esineet** | Objects in a room rather than melodies. | Pisara (`pisara`), Puupala (`puupala`), Lasit (`lasit`), Tuulikello (`tuulikello`), Kuplat (`kuplat`), Kulho (`kulho`) |
| **C Tunnelmat** | Swells and soft pings in a large room: the calmest family, the easiest to miss in a noisy room. | Aamu (`aamu`), Hehku (`hehku`), Henkäys (`henkays`), Kaiku (`kaiku`), Usva (`usva`) |
| **D Habitat-tunnus** | One Open Habitat motif, D5 → A5 → soft F♯6, in four timbres, with round 1's Ovi for comparison. | **Tunnus puu** (`tunnus-puu`), Tunnus kello (`tunnus-kello`), Tunnus kieli (`tunnus-kieli`), Tunnus pehmeä (`tunnus-pehmea`); reference Ovi (kierros 1) (`r1-ovi`) |

The ids are stable lowercase slugs that the parallel Settings tiles round
and a product implementation can reuse. `r1-ovi` is only a comparison and
is not proposed for Settings.

What each family decides:

- **A** gives the most immediate "pleasant" sound, because these are
  instruments people already like. The risk is that the sounds resemble
  other apps' marimba or kalimba tones. The notes and rhythm here are our
  own, but the timbres are common.
- **B** answers "varied" best: every sound is a different object.
  Puupala and Kuplat are the shortest and least intrusive. Kulho and
  Tuulikello ring the longest.
- **C** is the gentlest family. Its sounds swell rather than strike, so
  they never startle, but in a noisy room they are the easiest to miss.
  They work best as a personal choice, not as the default.
- **D** is Habitat's own. One motif in several timbres is recognisable as
  Habitat whichever timbre a person picks. Rounds 3 and 4 (per repository,
  per conversation) can transpose it or vary its last note.

## Recommendation

Make **Tunnus puu** (`tunnus-puu`) the default. It combines what A does
best (a warm, liked timbre: a marimba bar's partials with a soft yarn
mallet and a small room) with what D gives (our own melody, derived from
the mark). It is rising, which suits "your turn". It sits in the middle
register at 587–1480 Hz, which carries through laptop speakers without
being shrill, and it lasts about a second.

For the short list in Settings, use Tunnus puu, Kalimba, Kantele, Pisara
and Hehku. Offer the rest under "Lisää ääniä", or as the full list, since
they cost nothing to keep.

Compared with round 1: Ovi was a single dry mono FM mallet. The new sounds
have physical partials, mallet transients, a computed room, stereo and
equal perceived loudness. The *Ovi ensin* button on every card makes the
difference audible.

## Decisions for later review

- **Loudness reference: −17 LUFS momentary maximum, peak ceiling −3 dBFS.**
  The alternatives were peak normalisation (round 1) and integrated
  loudness. A short sound is judged by its loudest moment, and integrated
  loudness would make sparse sounds such as Puupala too loud. At −17,
  every sound is at least 2 dB under the ceiling. Round 1's Ovi was
  peak-normalised to −6 dBFS, about −13 LUFS-M, so the new set is about
  4 dB quieter at the same volume setting (question 3).
- **Tone ceiling: a 6.5 kHz 4th-order low-pass on everything (4–4.5 kHz
  extra on plucks), checked as < −30 dB energy above 6 kHz.** The brief
  asked for "no harshness above ~6 kHz". A hard 6 kHz cut would dull the
  bells and glass more than necessary.
- **Render at 48 kHz always and let the browser resample.** The other
  option was round 1's approach of rendering at the context's own rate.
  A fixed rate makes the samples, and the fingerprints, the same on every
  device, and resampling is inaudible.
- **Habitat motif D5 → A5 → F♯6.** This is round 1's Ovi (the two arches)
  plus round 1's "sun" note as a soft third note, so the motif has a
  phrase shape and stays continuous with round 1.
- **The rules simulation is not repeated.** Round 1 settled the rules and
  Jari accepted them on 21.11. This page is about the sounds only.

## Questions for Jari

1. Is **Tunnus puu** a good default, or does one of the others sound more
   pleasant to you, for example Kalimba or Tunnus pehmeä?
2. Should Settings offer all 21 sounds or only a short list of about
   five? If a short list, which sounds should be on it?
3. Is the default level right? All sounds are equally loud. If they feel
   too quiet or too loud at the 70 % volume, the fix is one number.
4. For per-repository sounds (round 3): should they be variations of the
   Habitat motif (other notes in the same timbre), or simply a choice
   among these 21 sounds?

## Evidence

- Check: `check.mjs` passed with 408 checks: render limits and
  fingerprints, the round directory free of audio, images, HTML and files
  over 100 KB, 1280 and 390 px in Päivä, Yö and Korkea kontrasti, an
  OfflineAudioContext pass of every sound through the page's own chain,
  and the play buttons. The console stayed clean.
- Screenshots: `/var/tmp/agent-keep/attention-sounds-2/check/`.
- Rendered WAVs (48 kHz 16-bit stereo, about 230 KB each, not committed):
  `/var/tmp/agent-keep/attention-sounds-2/wav/`. 64 kbit/s Opus (7–17 KB
  each): `/var/tmp/agent-keep/attention-sounds-2/opus/`.
