# Sanelun raja – kierros 1

- **Nyt**: tuotanto sellaisenaan. 10 minuutin katto, harmaa rivi kentän yllä minuuttia ennen (punainen 20 s ennen), ei ääntä, sanelu loppuu hiljaa ja ilmoitus kertoo, että teksti on kentässä.
- **1 Kuuluva varoitus**: katto pysyy 10 minuutissa. Palkissa on koko ajan ”/ 10:00”, ja viimeisellä minuutilla aika vaihtuu sirulla näkyväksi ”0:58 jäljellä” -lukemaksi. Äänimerkki soi minuuttia ja 10 s ennen sekä lopussa.
- **2 Tunnin ketju**: selain ketjuttaa Soniox-istunnot 10 minuutin välein katkotta, ja raja on tunti. Aikaa ei näytetä ennen viimeistä minuuttia; sen jälkeen varoitus ja äänimerkit ovat samat kuin 1:ssä.
- **3 Tauko päättää**: sama tunnin ketju, mutta tunnin kohdalla sanelu päättyy vasta seuraavaan taukoon (enintään 30 s). Jäljellä oleva aika näkyy palkin alareunassa hupenevana viivana.

Suositus: **2 Tunnin ketju**. Issue `proto-dictation-limit`; suositus ja
päätökset ovat issuen `result.md`:ssä.

## What happens today (step 1)

Read from `web/src/app/dictation.ts`, `web/src/components/composer/Dictation.tsx`
and `internal/daemon/speech_linux.go`, and reproduced with the host-backed
spec `web/tests/speech-input.spec.ts` › "the dictation warns a minute before
the ten-minute ceiling and ends there with the text". That spec uses a fake
Soniox and Playwright's clock, so it is the ten minutes compressed rather than
a shortened ceiling. It passed on this branch's base.

- The daemon mints a single-use temporary key with
  `max_session_duration_seconds: 600` (`SpeechMaxSessionSeconds`). The
  contract fixes `max_session_seconds` at the constant 600.
- The browser counts from the moment the microphone opens. That is never
  later than when Soniox's stream starts, so the browser always gets to stop
  first. Every audio frame (every 100 ms) and every 250 ms tick checks
  `now - startedAt >= stopAtMs` (598 s), and `finish(run, "ceiling")` then:
  closes the microphone, sends Soniox the empty frame that ends the stream,
  waits up to 4 s for `finished`, and `end()` commits any remaining guess.
  The composer's `onEnd` writes the text at the caret and the field becomes
  ordinary text again, with the notice "Sanelu päättyi 10 minuutin kattoon ·
  Kaikki sanottu on kentässä" and **Jatka sanelua**.
- **Transcribed text is not lost at the ceiling.** In the pilot's report,
  the lost five minutes were spoken *after* the stop. The microphone was
  already closed, so those words never reached Soniox. The defect is that
  the stop is easy to miss, not that text is dropped.
- How the warning looks: `DictationCeiling` puts a line above the field from
  9:00, "Sanelu päättyy 0:58 kuluttua · Kaikki sanottu jää kenttään", with a
  clock icon. From 20 s left it turns red (`urgent`). Nothing can be heard,
  so a person looking away or walking about (the very case dictation exists
  for) gets no signal at all. The line is mounted only at 9:00, as a new
  `role="status"` element whose text changes every second. A screen reader
  may miss the first announcement (a live region inserted with its content
  is often not read) and may then read every second.
- The pill/bar shows elapsed time (`2:14`) with no hint of a limit until
  the last minute.

## Research: Soniox limits and cost

Primary sources (read 15.11.2026):

- Limits and quotas, <https://docs.soniox.com/stt/rt/limits-and-quotas>:
  "Each real-time session is capped at 300 minutes. To continue beyond
  this, open a new session." The cap is fixed. 10 concurrent streams and
  100 requests per minute by default, both raisable.
- Temporary API key, <https://docs.soniox.com/stt/api-reference/auth/create_temporary_api_key>:
  `expires_in_seconds` 1–3600; `single_use`; `max_session_duration_seconds`
  1–18000, the maximum WebSocket connection length (dropped when exceeded;
  no limit if unset). **Our 10 minutes is our own setting, not Soniox's.**
- Error handling, <https://docs.soniox.com/stt/rt/error-handling>: a session
  past its maximum closes with 413 `max_duration_reached`; "to continue,
  open a new WebSocket connection". 503 asks the client to restart at once.
- Manual finalization, <https://docs.soniox.com/stt/rt/manual-finalization>:
  `{"type":"finalize"}` makes all audio so far final and answers with a
  `<fin>` token, and the session continues. Billing is for the full stream
  duration.
- Keepalive, <https://docs.soniox.com/stt/rt/connection-keepalive>: a stream
  with no audio or keepalive for 20 s ends with 408. Audio frames flow all
  the time while dictating, so this does not bite.
- Pricing, <https://soniox.com/pricing>: real-time $0.12 per hour, so 10 min
  costs $0.02 and an hour $0.12.

So a stream cannot be "continued" past its cap, but a second session can
follow it with no gap the person notices. The engine already does this once
on a drop (`reconnect`): it mints a new key, buffers up to 30 s of audio
while the socket opens, and commits the guess so nothing is lost.

### Length or chaining: the recommendation

Chain sessions in the browser, keep each stream at 600 s (no daemon or
contract change), and set one dictation's limit at **60 minutes**.

- Chaining: about 30 s before a stream's 600 s, mint the next key. At the
  next pause of at least 300 ms (or at 590 s at the latest), send `finalize`
  to the old stream, start sending frames to the new one, and send the
  empty frame to the old one. Hold the new stream's tokens until the old
  one's `finished`, so the text stays in order. This is the existing
  reconnect path, made deliberate and early instead of reactive.
- Why a limit at all: a forgotten microphone keeps listening and streaming
  a room to a third party. Cost hardly matters ($0.12/h). An hour covers
  any real explanation. Ten minutes is short enough that a person who speaks
  at length will reach it.
- Why not Soniox's 300 min: a 600 s key is the one provider token in the
  contract, and a short key limits what a leaked one can do. Chaining keeps
  that and costs one mint per 10 min, well under the daemon's 10 per
  minute.
- Trade-offs: a word spoken exactly at a chain boundary may lose some
  context and recognition. Switching at a pause makes that rare. Each mint
  can fail like a drop, and the drop path handles that.

## The directions

Axis: how the limit is announced and where it is. All three keep the end
the same: the text lands in the field as ordinary text, the microphone is
off, and one action (Jatka sanelua) starts a new dictation after the kept
text. The difference is how far away the limit is and how it is announced.

- **Sound**: one soft 660 Hz tone at one minute, two at ten seconds, a
  falling pair at the end. Each is about 0.2 s at a low level: a signal,
  not an alarm. The browser's echo cancellation removes the page's own
  output from the microphone. Even without it, a short sine tone is not
  speech, so it would not show in the text. A person dictating is speaking
  and often not looking, so sound is the only channel that reliably reaches
  them. Screen-reader users get the announcement as well. Kuuntele merkki in
  each scene plays the tone.
- **Announcements**: one persistent `role="status"` region per composer,
  mounted when the dictation starts. It speaks once at one minute, once at
  ten seconds (3: "ends at your next pause") and once at the end. The
  ticking time is not in it.
- **Visual**: 1 always shows the limit ("2:14 / 10:00"). 2 and 3 show
  nothing until the last minute, because a limit an hour away is not worth
  the space. The last minute turns the time into a "0:58 jäljellä" chip
  (red at ten seconds) with a note above the field. 3 keeps the elapsed
  time and drains a line along the bar instead.
- **Connection dropped**: the note says the microphone still listens and
  how much audio is held ("Ääntä tallessa 0:07"). With chaining, the drop
  is the same path as a planned switch.

Nyt is production as it is: Composer and the real Dictation engine, with
only the microphone, socket and clock scripted. The directions keep the
engine, field, bar and Valmis. They hide production's time, note and notice
and draw their own in the same places: the time in the bar (a portal), the
note in Composer's `beforeField`, and the notice below the composer. Toista
loppu plays the last 15 s to the limit with its tones, and the words said
meanwhile end up in the field. `?theme=light|dark|contrast&lang=fi|en`
selects the starting theme and language.

## What the host would need

For direction 2, the browser only:

- `dictation.ts`: a dictation-wide limit (60 min) and warnings at limit
  −60 s and −10 s, separate from the per-stream `stopAtMs`. A planned
  rollover before each stream's 598 s, as above. Keep a pre-minted key
  only for the switch (a key opens a stream within 60 s, so it is minted
  about 30 s ahead). Allow more than one reconnect: on a drop, keep
  reconnecting while audio is buffered, and raise `bufferedSeconds` from 30
  to about 120 (16 kHz × 2 B × 120 s ≈ 3.8 MB).
- `Dictation.tsx`: the persistent live region and threshold announcements;
  the last-minute chip in the bar and the pill; the new note and end
  notice texts; the tones (Web Audio, no asset).
- Daemon and contract: **no change**. `max_session_seconds` stays 600 per
  stream, and the mint rate limit (10/min) already covers one mint per 10
  minutes. The dictation-wide limit is a browser rule. If the site key is
  shared, the operator's exposure is still bounded by the mint limit: at
  most one stream per mint, at most 10 minutes each.
- Optional, later: a Sanelu setting to turn the tones off.

## Build and check

```
node design-system/prototypes/rounds/2026-11-15-dictation-limit/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-15-dictation-limit/check.mjs <out>/offline.html <out>/shots [--quick]
```

The full check ran 866 checks with a clean console: four directions at 1440
and 390 in three themes in Finnish and Päivä in English, the played end with
its tones, Jatka sanelua and Kuuntele merkki, plus reduced motion and forced
colours.
