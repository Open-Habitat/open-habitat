# Prototype round 1: the attention sounds and when they play

Round `design-system/prototypes/rounds/2026-11-17-attention-sounds/`, built
with `node design-system/prototypes/rounds/2026-11-17-attention-sounds/build.mjs`
into `design-system/prototypes/dist/2026-11-17-attention-sounds.html`.
Build, check and synthesis are in the round's `NOTES.md`.

## Saatesanat

Tässä on kaksitoista omaa huomioääntä kolmena perheenä sekä pieni
simuloitu sivupalkki, josta näkee, milloin ääni soi. Valitsin vaihtaa
perhettä. Jokaisen äänen voi soittaa kerran tai neljästi peräkkäin, jolloin
kuulee, kestääkö se toistoa työpäivän mittaan. "Sivupalkin ääni" valitsee,
mikä ääni soi simulaatiossa. Kaikki äänet syntyvät sivulla koodista (alle
sekunnin reseptit), joten mitään valmistajan ääntä tai kolmannen osapuolen
näytettä ei ole mukana.

Suosittelen perhettä C, Habitat-aiheet, ja oletusääneksi **Ovea**: kaksi
pehmeää lyöntiä nousevana kvinttinä, "ovi aukeaa". Se on lyhyt, ei muistuta
käyttöjärjestelmän ääniä ja on johdettu merkistä (kaksi kaarta ja aurinko).
Samasta soundista saa myöhemmin työtilakohtaiset muunnelmat vain säveliä
vaihtamalla. Säännöt ovat simulaation alla ja tässä alempana. Tärkeimmät
ovat nämä: ääni soi vain, kun vuoro siirtyy sinulle agentin takia; kolmen
sekunnin sisällä tulee yksi ääni, vaikka valmistuisi useampi keskustelu;
avoinna oleva keskustelu, jota katsot, ei soi.

Kysymykset lopussa koskevat lähinnä sitä, saako kysymyksellä olla oma
äänensä ja soiko katsomasi keskustelu hiljaa vai ei lainkaan.

## Axis and families

The axis is the character of the sound. Within a family, every sound is
under one second, peak-normalised to the same ceiling and ends in a
damped release. The check (`check.mjs`) asserts all of this through an
`OfflineAudioContext`.

| Family | Line | Sounds |
| --- | --- | --- |
| **A Kellot** | Soft bells and chimes: the familiar "done" sound, which rings longest. | Kide (one bell, C6), Kaksi kelloa (G5→C6), Tuulikello (three tube chimes), Kulho (low bowl with gentle beating) |
| **B Puu ja lasi** | Short taps on wood and glass: dry, unobtrusive, like a knock on a door. | Koputus (two wood knocks), Marimba (E5→A5), Lasi (spoon on a glass), Pisara (two water drops) |
| **C Habitat-aiheet** | Motifs derived from the mark, two arches a fifth apart with the sun above them, all in one soft timbre. | **Ovi** (D5→A5), Aurinko (D5 A5 F♯6), Kaaret (A4+E5 together), Ilta (A5→D5, falling) |

What each family decides:

- **A** sounds like a "finished" chime. It carries well across a room and
  is recognisable, but it rings longest, sits closest to what operating
  systems and chat apps already use, and its higher bells (Tuulikello,
  Kide) are the most likely to tire the ear over a day.
- **B** is the least intrusive. Koputus suits a "someone is at the door"
  meaning. The sounds are short (0.4–0.8 s), but against a noisy room
  they are the easiest to miss, and Lasi and Pisara read as
  notification sounds from other apps.
- **C** is Habitat's own sound. All four use one FM-mallet timbre, so
  they are recognisable as Habitat even with different notes. That is
  what per-repository and per-conversation sounds (rounds 3 and 4) need:
  a family whose members are told apart by melody, not by timbre.

## Recommendation

Use family **C**, with **Ovi** as the default sound. Offer all twelve in
Settings for the first version. A and B cost nothing to keep, and
someone who finds the motif too musical can choose Koputus.

Reasons: Ovi is short (it rings for about 0.7 s) and rising, which suits
"your turn". It sits in the middle register (587/880 Hz), where it is
neither shrill nor muddy through laptop speakers. Repeated, it is
pleasant rather than alarming (the Neljästi button is the test). Because
it is derived from the mark, it does not borrow anything from a platform
vendor.

## Recommended rules (the simulated rail)

1. **A sound plays on an edge into Sinun vuorosi caused by the agent**:
   a new reply (`attention: new`), a question (`pending_question`), or a
   turn whose end leaves no worker running. In `railNow` terms, this is a
   conversation that was not in `yours` and now is, with `attention`,
   `pendingQuestion` or a worker-free settled turn as the reason.
2. **No sound when the agent places itself elsewhere.** `agent_section`
   `running` or `quiet` holds the reply out of Sinun vuorosi, so there is
   no edge. A turn that ends while a worker still runs stays in
   Käynnissä. The sound comes when the work ends and the reply claims the
   turn ("Työntekijä valmis").
3. **One sound per 3 s.** The first arrival plays immediately, and
   arrivals inside the window merge into it. Three conversations finishing
   400 ms apart give one sound, and the log says the others were merged.
4. **No sound for the conversation being looked at**: the tab is visible,
   the window is focused and that conversation is open. Another
   conversation, another tab or a hidden or unfocused window does sound.
   Of three finishing while one is open, the other two give one sound.
5. **Personal volume and Äänet pois.** The default is 70 %, mapped as
   `(v/100)²`. *Vähennä liikettä* does not mute sound, matching the
   dictation cues, but it stops the row's arrival animation. Sound is
   never the only signal: the row, its mark and the tab title
   (production's browser conversation already prefixes the title with
   "Agentti tarvitsee huomiota ·" for a background finish) say the same.
6. **Locked audio is reported, not lost.** Browsers keep an
   `AudioContext` suspended until the person has interacted with the page.
   Habitat creates and resumes it on the first `pointerdown`/`keydown`
   anywhere. If a sound should play before that, the rail shows once:
   "Ääni ei soinut. Selain soittaa ääniä vasta, kun olet käyttänyt
   sivua." with **Ota äänet käyttöön**, which unlocks and plays the sound
   as confirmation. This mostly happens after a reload of a tab left in
   the background.
7. **Loading or reconnecting is silent.** Conversations already waiting
   when the snapshot first arrives, or arriving in the first snapshot
   after a reconnect, form the baseline. Only later edges sound. (This
   rule is stated on the page, not simulated.)
8. **One tab plays.** With Habitat open in several tabs, only one plays
   (the focused one, otherwise the most recently focused), coordinated
   with `BroadcastChannel` or a Web Lock. (Stated, not simulated.)

## Host needs

None for this round. Detection, playing, volume and mute all live in the
browser. The chosen sound is a personal setting, which belongs to the
parallel Settings round.

## Decisions for later review

- **Sounds are rendered from recipes in the browser, not shipped as
  files.** The alternative is WAV/Opus assets. Recipes are ~5 kB of
  code, transpose freely for per-repository variants and carry no binary
  in git. `render.mjs` still writes byte-identical WAVs and verifies
  SHA-256 fingerprints if files are ever preferred.
- **One sound for every kind of "your turn".** The alternative is a
  distinct sound for a question. One sound keeps the personal and
  per-repository choice meaningful (a sound means "this place needs
  you"), and the rail's line already says it is a question. This is also
  listed as a question below.
- **The coalescing window is 3 s, leading edge.** Trailing-edge or
  per-conversation windows were the alternatives. Leading edge gives
  immediate feedback, and 3 s is longer than a typical burst of workers
  finishing together.
- **No sound at all for the conversation being looked at.** A much
  quieter sound was the alternative. The person sees the reply arrive,
  and the dictation and title cues already follow the same "only when
  away" idea.
- **Default volume is 70 % with a squared curve.** This gives a peak
  around −12 dBFS, which is gentle at normal system volume.
- **Reduced motion does not mute** (same as the dictation cues). Sound
  is not motion.

## Questions for Jari

1. Should a question (agent asks) get its own sound, for example the
   recommended sound with an added third note (Aurinko for a question,
   Ovi for a reply)? Or is one sound for every "your turn" right, as
   recommended?
2. Is "no sound for the conversation you are looking at" right, or would
   you like a much quieter sound there too, for example when you look at
   the terminal while the conversation is open on another screen? (The
   rule already sounds when the window is not focused.)
3. Is family C with Ovi the right default, or does another sound appeal
   more after listening, for example Koputus as the drier choice?
4. Should Habitat have quiet hours, or another way to stop sounds outside
   working hours, or is Äänet pois enough for now?

Evidence (not committed): screenshots in
`/var/tmp/agent-keep/attention-sounds/check/`, rendered WAVs in
`/var/tmp/agent-keep/attention-sounds/wav/`.
