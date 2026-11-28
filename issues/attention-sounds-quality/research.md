# Why our attention sounds fall short of a reference system sound

## Tiivistelmä Jarille

Mittasin kaikki kymmenen huomioääntä molemmissa pituuksissa skriptillä
(`design-system/prototypes/rounds/2026-11-28-aanet-laatu-1/analyze.mjs`,
joka ajaa tuotannon `soundSynth.ts`:n sellaisenaan). Applen Glass-ääntä ei
ole tällä koneella, eikä siitä löydy julkaistua spektrimittausta, joten
vertailukohta on sen luonne (yksi lyöty lasi, kirkas, soi itsestään
loppuun) ja lyödyn lasin fysiikka.

Äänissämme ei ole naksahduksia, säröä eikä äänekkyysongelmaa: kaikki ovat
täsmälleen −17 LUFS, huiput −7…−10 dBTP, ja ne ovat siistejä 48 kHz
stereoääniä. Vika on sävyssä ja hännässä:

1. **Liian tummat ja kapeat.** 95 % energiasta on alle 0,4–1,8 kHz:n, ja
   yli 6 kHz:n osuus on −55…−107 dB. Oletusäänessä Kalimbassa ei ole
   yhtään osasäveltä perussävelten yläpuolella 45 dB:n sisällä. Syyt:
   kaikkien äänten 6,5 kHz:n alipäästö (kierroksen 2 linjaus "ei
   terävyyttä yli ~6 kHz"), pehmeät kosketukset ja heikot, nopeasti
   sammuvat yläsävelet. Lasista puuttuu juuri se kimallus, jonka vuoksi
   lasi kuulostaa lasilta.
2. **Häntä katkaistaan.** Lyhyissä versioissa vaimennuskäyrä jyrkentää
   loppua 1,6–6,6-kertaiseksi alkuun verrattuna (jopa −239 dB/s); viimeinen
   isku sammuu 0,2–0,6 sekunnissa. Ääni ei soi loppuun vaan tukahtuu.
3. **Liian monta iskua.** 2–7 iskua 0,1–0,6 sekunnissa on pieni sävelmä,
   kun vertailuääni on yksi tapahtuma, ja myöhemmät iskut ehtivät soida
   vain hetken.
4. Lisäksi oktaavia perussävelen alapuolella soiva moodi (−24…−35 dB),
   rungon resonanssit ja tömähdys vievät väriä matalaan keskialueeseen.

Tein kolme ehdotussarjaa samoista kymmenestä äänestä, äänekkyydeltään
tasattuina: **A Avattu** (vain tekniset korjaukset), **B Kirkas** (lisäksi
kirkkaampi rekisteri ja huojuvat yläsävelet) ja **C Yksi isku** (B:n äänet
yhtenä eleenä). Suosittelen **B:tä**: se korjaa kaikki kolme vikaa mutta
pitää jokaisen äänen eleen, joten työtilojen äänet erottuvat toisistaan.
Mittaus ei korvaa kuuntelua; tärkein kuunneltava asia on, kuulostaako B:n
avattu yläpää läppärin kaiuttimista kimaltavalta vai kirkuvalta.

## The reference

Glass is one of macOS's built-in alert sounds and dates from Mac OS 9
([Six Colors][sixcolors]); it ships as an AIFF in `/System/Library/Sounds`
([Free Pascal wiki][fpc]). No published waveform or spectral analysis of
it was found, and no copy exists on this Linux host, so it was not
measured and no part of it is used. What can be said from its name and the
way it is commonly heard is qualitative: one struck glass, bright and
clear, a single event that rings out by itself, quiet rather than loud.

The physics of that character is well described:

- **A tap excites many modes.** Rubbing a glass sounds mostly its lowest
  bending mode; striking it excites the higher ones as well (Rossing,
  *Acoustics of the glass harmonica*, JASA 95, 1994; [Jundt et al.
  2006][jundt]). Those higher modes are what make a strike sound like
  glass rather than like a sine tone.
- **They are inharmonic.** A glass bowl vibrates roughly like a thin ring,
  whose bending modes follow f_m ∝ m(m²−1)/√(m²+1), m = 2, 3, 4, … —
  ratios 1 : 2.83 : 5.42 : 8.77 : 12.9 (Fletcher & Rossing, *The Physics of
  Musical Instruments*, ch. on bells and plates). Real glasses deviate (the
  stem and the curved bowl pull the upper modes around); a modal glass
  example in the ChucK book uses 1206, 2240, 3919 and 5965 Hz, ratios about
  1 : 1.86 : 3.25 : 4.95 ([ChucK listing 7.10][chuck]). Either way, a
  1–2 kHz glass has partials well above 6 kHz.
- **Hardness sets brightness.** A short contact (a hard tap) passes the
  high modes; a soft, long contact filters them (≈ −12 dB/octave above
  0.6 / contact time). Our renderer already models this.
- **Near-degenerate mode pairs beat.** An imperfect round object splits each
  mode into two a few cents apart; their slow beating is the shimmer of a
  glass or bell.
- **Earcon practice.** An attention sound need not be loud or jarring to be
  noticed ([Microsoft UX guidelines][ms]); one heard many times a day must
  stay pleasant on repetition ([Material Design][material]); on macOS
  notification sounds mix with other audio ([Apple HIG][hig]).

## Our sounds and how they are made

All ten are synthesised in the browser by `web/src/app/soundSynth.ts`, the
renderer of round `2026-11-21-attention-sounds-4`; no sample file ships.
Each sound is a few struck voices (modal synthesis: decaying sines at an
instrument's mode ratios, each split into a beating pair, weighted by a
contact spectrum, with a thump and band-passed strike noise), then a body
filter, a Gaussian damping curve, six early-reflection taps, an 8-line FDN
reverb, a 90 Hz high-pass, a 6.5 kHz 4th-order low-pass, and loudness
normalisation to −17 LUFS momentary maximum with a −3 dBFS ceiling.

## Measurements

`node design-system/prototypes/rounds/2026-11-28-aanet-laatu-1/analyze.mjs`
(Node 22, no packages; `--json` writes every number, `--wav` writes WAVs
outside the repository). Every render is 48 kHz stereo, no sample is
clipped, DC is under 3·10⁻⁵, and the first 5 ms carry −53…−95 dB of their
energy above 8 kHz (no onset click). Columns: length; maximum momentary and
integrated loudness (BS.1770, [ITU][bs1770]); true peak (4× oversampled);
strikes; 10→90 % rise per strike (later strikes over a ringing earlier one
read long); spectral centroid; the frequency under which 95 % of the energy
lies; energy above 6 kHz; decay rate over the 150 ms after the last strike's
peak and over the last 150 ms before the final fade; their ratio (above
~1.5 the tail is being choked by a gain curve, not decaying); time from the
last peak to −40 dB; L/R correlation.

| Sound / length | s | LUFS-M | LUFS-I | dBTP | strikes | rise ms | centroid Hz | 95 % below Hz | > 6 kHz dB | decay early / late dB/s | late ÷ early | last peak → −40 dB s | L/R corr. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| kalimba short | 0.72 | −17.0 | −19.3 | −7.6 | 3 | 1.8 / 1.5 / 4.0 | 1033 | 1178 | −55 | −57 / −227 | 3.9 | 0.37 | 0.80 |
| kalimba long | 1.35 | −17.0 | −20.0 | −8.5 | 3 | 1.8 / 3.5 / 5.3 | 1029 | 1177 | −60 | −44 / −94 | 2.1 | 0.90 | 0.78 |
| marimba short | 0.70 | −17.0 | −19.5 | −7.3 | 3 | 7.0 / 4.8 / 6.5 | 921 | 1050 | −60 | −71 / −210 | 3.0 | 0.36 | 0.77 |
| marimba long | 1.30 | −17.0 | −19.8 | −8.6 | 3 | 7.0 / 6.8 / 9.8 | 922 | 1050 | −67 | −51 / −78 | 1.5 | 0.79 | 0.69 |
| vibrafoni short | 0.78 | −17.0 | −20.7 | −7.9 | 2 | 13.8 / 2.0 | 760 | 881 | −92 | −30 / −122 | 4.1 | 0.56 | 0.60 |
| vibrafoni long | 1.50 | −17.0 | −22.0 | −8.7 | 2 | 15.8 / 2.0 | 734 | 880 | −103 | −22 / −77 | 3.5 | 1.14 | 0.60 |
| tunnus-puu short | 0.72 | −17.0 | −19.5 | −7.6 | 3 | 2.0 / 6.0 / 9.0 | 999 | 1482 | −61 | −36 / −239 | 6.6 | 0.36 | 0.83 |
| tunnus-puu long | 1.30 | −17.0 | −20.3 | −8.5 | 3 | 6.3 / 2.0 / 12.0 | 949 | 1480 | −67 | −37 / −53 | 1.4 | 0.76 | 0.81 |
| pisara short | 0.68 | −17.0 | −19.5 | −7.5 | 3 | 1.3 / 1.8 / 2.0 | 1390 | 1778 | −62 | −112 / −121 | 1.1 | 0.34 | 0.84 |
| pisara long | 1.25 | −17.0 | −20.2 | −7.7 | 3 | 1.3 / 1.8 / 2.0 | 1448 | 1821 | −64 | −102 / −87 | 0.8 | 0.41 | 0.80 |
| lasit short | 0.78 | −17.0 | −19.8 | −7.5 | 2 | 1.0 / 2.5 | 1130 | 1179 | −68 | −84 / −171 | 2.0 | 0.47 | 0.84 |
| lasit long | 1.45 | −17.0 | −20.4 | −8.3 | 2 | 1.0 / 3.0 | 1098 | 1178 | −76 | −57 / −79 | 1.4 | 0.94 | 0.79 |
| tuulikello short | 0.78 | −17.0 | −19.1 | −9.0 | 5 | 1.0 / 1.3 / 4.3 / 13.5 / 1.5 | 994 | 1318 | −57 | −30 / −168 | 5.7 | 0.40 | 0.75 |
| tuulikello long | 1.45 | −17.0 | −19.8 | −10.1 | 5 | 1.3 / 1.3 / 2.5 / 17.3 / 18.8 | 1027 | 1318 | −59 | −24 / −67 | 2.8 | 0.95 | 0.71 |
| kuplat short | 0.60 | −17.0 | −19.5 | −7.3 | 5 | 2.3 / 3.3 / 3.3 / 2.8 / 2.0 | 783 | 1047 | −103 | −197 / −172 | 0.9 | 0.19 | 0.78 |
| kuplat long | 1.20 | −17.0 | −21.9 | −7.1 | 7 | 2.3 / 3.3 / 3.3 / 2.8 / 2.0 / 1.8 / 1.3 | 852 | 1130 | −102 | −180 / −106 | 0.6 | 0.26 | 0.76 |
| kulho short | 0.80 | −17.0 | −20.8 | −7.9 | 1 | 2.8 | 382 | 396 | −101 | −87 / −93 | 1.1 | 0.58 | 0.86 |
| kulho long | 1.50 | −17.0 | −20.7 | −9.0 | 1 | 2.8 | 390 | 395 | −107 | −81 / −79 | 1.0 | 1.21 | 0.81 |
| jaapuikot short | 0.72 | −17.0 | −19.0 | −7.3 | 3 | 2.8 / 1.5 / 1.5 | 980 | 1317 | −57 | −88 / −142 | 1.6 | 0.34 | 0.79 |
| jaapuikot long | 1.38 | −17.0 | −19.5 | −7.9 | 3 | 10.8 / 2.5 / 4.3 | 1012 | 1317 | −60 | −59 / −81 | 1.4 | 0.80 | 0.71 |

Partials of the first strike (strongest = 0 dB, peaks within 45 dB),
long length:

- **Lasit** (A5): 880 Hz; 2044 Hz (×2.32) −15 dB; 3742 Hz (×4.25) −35 dB;
  and 439 Hz (×0.5) −26 dB. Nothing above 4 kHz.
- **Kalimba** (B5): 986 Hz and its beating partners; 494 Hz (×0.5)
  −24 dB. The tine's 5.95× mode (5.9 kHz) is not within 45 dB.
- **Jääpuikot** (E6): 1317 Hz; 3458 Hz (×2.63) −16 dB; 659 Hz (×0.5)
  −35 dB.

## What is wrong, concretely

1. **Too dark and too narrow (the main cause).** The centroid sits at
   380–1450 Hz and 95 % of the energy is below 0.4–1.8 kHz; energy above
   6 kHz is −55 to −107 dB. A struck glass's identity is in the modes above
   its fundamental, and ours are missing or 15–35 dB down. Three things
   compound: the 6.5 kHz 4th-order low-pass on every sound (round 2's
   reading of "no harshness above ~6 kHz"); soft contacts (kalimba 0.45 ms
   puts the contact corner near 1.3 kHz; glass 0.15 ms); and upper-mode
   amplitudes of 0.015–0.32 with decay constants of 20–280 ms. The
   inharmonic share of the partial energy is 0–4 % for glass, ice and the
   tubes, which physically are strongly inharmonic: their upper modes are
   too weak to register. Harshness is usually heard in noise and in a broad
   2–5 kHz band; sparse, quickly decaying high partials are shimmer, and
   the low-pass removes both.
2. **The tail is choked.** In the short length of the arpeggios the late decay rate is 1.6 to 6.6 times the early one (−120 to −239 dB/s), because a Gaussian damping
   curve takes the dry sound from unity at 0.36–0.42 s to −60 dB at
   0.63–0.74 s. The last strike reaches −40 dB in 0.19–0.58 s. The long
   length is gentler but still 1.4–3.5× for the pitched sounds. A struck
   object that is "damped" this way sounds muted by a hand, not rung.
3. **Busy gestures.** Eight of ten sounds are arpeggios of 2–7 strikes over
   0.1–0.6 s. A three-note figure reads as a jingle rather than a single
   object, and each later strike has less of the fixed length left to ring
   in, which is why the damping above is needed at all.
4. **Low-mid colouring.** Every struck mode table has an octave-below
   mode (ratio 0.5) at −24 to −35 dB, which no tine or glass has; kalimba
   and marimba add body resonances (180–1150 Hz) and a thump. Together
   they pull the colour toward a hollow, woody low-mid.
5. **Minor: discrete early reflections.** Six taps 6–34 ms apart at gains
   0.07–0.2 comb-filter a tonal sound by about ±1.7 dB; the smaller room
   also reads as "boxy" next to a dry or diffuse alert.

Not wrong: loudness is consistent (every sound −17.0 LUFS-M, integrated
−19 to −22), there is 7–10 dB of true-peak headroom, nothing clips, the
attacks are click-free (1–3 ms rises for most first strikes; the marimba's yarn mallet and the vibraphone's tremolo read 7–16 ms), and the stereo image is moderate (L/R correlation 0.60–0.86,
side 6–11 dB under mid). At the default 70 % volume the gain is 0.49
(−6.2 dB), so the sounds play near −23 LUFS-M: quiet, as an alert should be.

## Candidates

Round `design-system/prototypes/rounds/2026-11-28-aanet-laatu-1/` renders
the current set beside three candidate sets of the same ten sounds
(`candidates.mjs`, our own synthesis), all normalised by the same meter.

- **A Avattu** keeps the gestures and instruments and fixes the engine:
  low-pass at 12 kHz, contacts 20–40 % shorter, upper modes 1.5× stronger, no octave-below mode, weaker body resonances, no thump, Lasit on a thin ring's ratios (above), no early taps (four
  allpasses into the FDN instead), and no damping curve: each voice's decay
  is set so it falls ~45 dB by the end of the length.
- **B Kirkas** adds a brighter register for metal, glass and ice (+3 to +7 semitones; wood stays where it is), the objects' higher modes (glass and
  bowl on the ring ratios above, the tube on free–free bar ratios) with
  stronger, wider beating pairs, very short contacts, at most three
  strikes 15 % closer together, and the spectrum open to 16 kHz.
- **C Yksi isku** is B struck as one gesture: the notes 14 ms apart (drops
  and bubbles 50 ms), so the whole length rings from the first instant.

| Set | centroid Hz (median) | 95 % below Hz (median) | > 6 kHz dB (median) | late decay dB/s (median / steepest) | last peak → −40 dB s (median) | max dBTP | LUFS-M |
|---|---|---|---|---|---|---|---|
| current | 994 | 1178 | −64 | −94 / −239 | 0.56 | −7.1 | −17.0…−17.0 |
| A | 1075 | 1178 | −52 | −73 / −146 | 0.59 | −3.9 | −17.0…−17.0 |
| B | 1422 | 1573 | −52 | −56 / −131 | 0.56 | −4.5 | −17.0…−17.0 |
| C | 1359 | 1568 | −66 | −53 / −139 | 0.63 | −3.6 | −17.0…−17.0 |

The median hides the families: in B the glass, ice, tube and kalimba sounds
carry −23 to −27 dB above 6 kHz (from −55 to −76), Lasit's partials are
1319 Hz, 3725 Hz (×2.83) −8 dB, 7.1 kHz (×5.42) −18 dB and 11.5 kHz (×8.76)
−30 dB, and Kalimba's tine mode at 7.8 kHz is back at −18 dB. Wood and
water stay warm on purpose. No candidate has a damping curve; the steepest
late decays are the drops and bubbles, which are that brief by nature.
The check (`check.mjs`) holds every render of all four sets to −17 ±0.3
LUFS-M, a true peak under −2.9 dBFS, no clipping and a last 50 ms under
−50 dBFS.

**Recommendation: B Kirkas.** It removes all three measured faults and
brings in the glass-and-metal shimmer of the reference while keeping each
sound's gesture, so per-workspace sounds stay distinguishable and Tunnus
puu stays the Habitat motif. A is too timid: its centroid moves only from
994 to 1075 Hz. C comes closest to "one struck object", but its rolled
chords make Marimba and Tunnus puu nearly the same major chord on the same
wood, and per-workspace sounds must be told apart.

**Risk to listen for.** B moves energy into 3–8 kHz and its first 5 ms
carry −27 to −34 dB above 8 kHz (current −53 to −66). On small laptop
speakers that is where "bright" turns "piercing". If it does, the remedy is
to lower the added modes by about 3 dB or bring the low-pass to 12 kHz, not
to return to 6.5 kHz.

[sixcolors]: https://sixcolors.com/?p=2008
[fpc]: https://wiki.freepascal.org/macOS_NSSound
[jundt]: https://www.phys.unsw.edu.au/music/people/publications/Jundtetal2006.pdf
[chuck]: https://chuck.cs.princeton.edu/doc/examples/book/digital-artists/chapter7/Listing7.10.ck
[ms]: https://learn.microsoft.com/en-us/windows/win32/uxguide/vis-sound
[material]: https://m2.material.io/design/sound/applying-sound-to-ui.html
[hig]: https://developer.apple.com/design/human-interface-guidelines/playing-audio
[bs1770]: https://www.itu.int/rec/R-REC-BS.1770
