# alice-06-planning-memo

Alice · 11:24 · “Here's this morning's planning. A memo and the tasks, please.”

## What the reader sees

Beside the conversation: a strip with a play button and the waveform of a
minute of the meeting, coloured by who is speaking; under it the memo as a
sheet of paper (letterhead, three decisions with their minute, seven tasks
with owner, date and minute). “Transcript” shows the same minute as text,
speaker by speaker. Pressing play plays the minute, fills the waveform and
marks the line being spoken.

## The showpiece is real

The minute is real audio and its transcript is the programs' own output.
`assets.mjs`:

1. speaks twelve lines (in the script, `LINES`) with three Piper voices,
   levels them and adds a little room with ffmpeg;
2. transcribes the result on the CPU with faster-whisper and tells the
   speakers apart with sherpa-onnx. Neither is given the script or the turn
   times. Each sentence goes to the speaker who talks through most of it;
3. draws the waveform with ffmpeg `showwavespic` and encodes the audio;
4. prints the result as the `TRANSCRIPT` literal that `block.js` carries.

The take on the page: 55.9 s, 12 lines spoken, 12 turns found, every turn
with the right speaker. The words are shown untouched, including the two the
program got wrong: “short-turning film” (spoken: short turning film) and, at
13:19, “the Winter Prince are coming” (spoken: the winter prints). The note
under the transcript says that the voices are synthetic and the words and
speaker changes are the programs' output.

What is not from the programs:

- **The names.** The diarizer says `SPEAKER_00/01/02`; `WHO` in `block.js`
  maps them to Carol, Alice and Bob. In the story that is the agent's step
  (its second thought: the invite has three names, and SPEAKER_00 answers when
  SPEAKER_01 says “Carol”).
- **The clock.** The passage is shown as 12:31–13:26 of a 58-minute
  recording: `OFFSET` adds 12 min 31 s to the real times. The 58-minute
  recording is the story; only this minute exists.
- **The rest of the memo.** Decision 1 and three tasks (descriptions, the
  turning film, telling the two shops) come from the minute, with their times
  computed from the transcript. Decisions 2 and 3 and the other four tasks are
  round 6's content, said elsewhere in the hour.
- **The tool outputs for the whole hour** (ffmpeg's lines for a 58:12 file,
  “58:12 of audio … 3 speakers”, “642 more lines”) are written for the story
  in the programs' formats. The five transcript lines quoted there are the
  real ones.

Piper's voices vary a little between runs, so a new run gives a slightly
different take, and the diarizer may merge two turns. The script says so when
the turn count differs from the lines spoken; run it again, and paste the
printed literal into `block.js`. Carol's voice is lowered and slowed 8 % in
the script so the two women differ more: without that, one of two takes had
two of her turns merged into Alice's; with it, four of four takes came out
right.

## What changed and why

- The view: recording strip, typeset memo and transcript replace round 6's
  small memo mock. The memo is now one page with a letterhead, a table of
  tasks and times in a column, as a Word memo would look.
- Tasks: 7 as before, now two for Alice, three for Bob, two for Carol (round 6:
  three, two, two), because the minute that is really transcribed contains
  three tasks and they had to be in the memo. The reply says so.
- The work: two thoughts (the second is how the voices got their names),
  ffmpeg, the transcription with five real lines, the calendar invite, the
  memo file, pandoc, and the two task files as edits.
- Copy: the left-hand text is tighter and says “the studio's own server” and
  “every decision tied to its minute”. The reply leads with the result and
  ends on “Nothing was sent.”
- Time: 19 min 04 s (11:05 to 11:24).

## Assets

`MEMO_PY=<python> node blocks/alice-06-planning-memo/assets.mjs` writes into
`$ETUSIVU_ASSETS/alice-06-planning-memo/`:

| File | What | Made with |
|---|---|---|
| `meeting.mp4` | 55.9 s, AAC mono 56 kb/s in MP4, 406 KB, no video track | piper-tts 1.8.0 (voices below), numpy, ffmpeg 6.1.1 `aecho`, `highpass`, `alimiter`, `-c:a aac -movflags +faststart` |
| `wave.webp` | 1600 × 160, 3 KB, lossless | ffmpeg `volume=3.2,showwavespic=s=1600x160:colors=white:scale=sqrt:draw=full`, then ImageMagick 6.9.12 cuts the wave out of a white sheet |

and, outside the shipped assets (`$MEMO_WORK`), `memo-2026-11-19.docx`
(pandoc 3.1.3 from `memoMarkdown()` in `block.js`; 11.0 KB, the size the offer
card states) and `transcript.json`. A copy of the .docx and the 16 kHz WAV is
in `~/src/open-habitat-dev/worker-results/etusivu-extra/alice-06-planning-memo/`.

Programs: faster-whisper 1.2.1 on CTranslate2 4.9.1, model `large-v3-turbo`
(`int8`, 8 threads, `vad_filter`, an `initial_prompt` naming the meeting's
subjects); sherpa-onnx 2.0.3 offline speaker diarization. Setup:

```
uv venv --python 3.12 $TMPDIR/venv
uv pip install --python $TMPDIR/venv/bin/python piper-tts faster-whisper sherpa-onnx numpy
```

Measured here, on a guest that twenty workers were loading at the time:
transcription 30 s and diarization 23 s for the 56 s passage. An earlier run
with the small.en model misheard much more (“Winter Prince” throughout, “Two
shots”), which is why the large model is used.

The MP4 holds only sound. The contract says no audio track unless it matters;
here the sound is the asset. It is loaded only when the reader presses play
(`preload="none"`).

## Sources and licenses

Nothing from a third party is shipped as such; the shipped audio is speech
synthesised with these voices, and the models below only read it.

| What | Source | Licence as read |
|---|---|---|
| Voice `en_GB-cori-high` (Alice) | `huggingface.co/rhasspy/piper-voices`, `en/en_GB/cori/high` | MODEL_CARD: dataset LibriVox, “License: public domain” |
| Voice `en_US-norman-medium` (Bob) | same repository, `en/en_US/norman/medium` | MODEL_CARD: dataset LibriVox, “License: public domain” |
| Voice `en_US-ljspeech-high` (Carol) | same repository, `en/en_US/ljspeech/high` | MODEL_CARD: LJ Speech dataset, “License: public domain” |
| pyannote segmentation 3.0 (ONNX) | `github.com/k2-fsa/sherpa-onnx` release `speaker-segmentation-models` | LICENSE in the archive: MIT, © 2022 CNRS |
| `wespeaker_en_voxceleb_resnet34_LM.onnx` | same project, release `speaker-recongition-models` | not read; used only to compare voices, nothing of it ships |
| Whisper `large-v3-turbo` (CTranslate2) | `huggingface.co/mobiuslabsgmbh/faster-whisper-large-v3-turbo` | not read; used only to transcribe, nothing of it ships |

Considered and not used because of their licence: `en_US-ryan-high`
(MODEL_CARD: CC BY-NC-SA 4.0). No attribution is required by the three voices
used. The meeting's lines were written for this block.

## Assumptions about the product

- The environment has a transcription script (`tools/transcribe.py`) on top of
  faster-whisper and a diarizer, installed by the person or their agent. Not
  something Open Habitat ships.
- Nineteen minutes for 58 minutes of audio on the studio's server is an
  assumption about that server; it was not measured (see the loaded-guest
  numbers above: about half real time for the transcription alone).
- The speakers are named by the agent from the calendar invite and the
  conversation, and the reply says so.
- Tasks go into files (`notes/open.md`, `team/tasks.md`); nothing is sent.

## For Jari

- The transcript shows the two mishearings as they came out. That is the
  honest version and the note under it says “untouched”; a new take could come
  out clean if they bother you.
- The offered .docx is pandoc's plain rendering of the Markdown; the sheet in
  the view is drawn in HTML to look the way a styled Word memo would. They hold
  the same content, not the same typography.
- On the desktop the view (strip, tabs, one-page memo) fills the sticky
  screen, so the conversation is above the fold of the screen on arrival.

## Engine needs

- **Audio.** There is no kit piece for sound and no audio format in the
  budget table, so the sound is an audio-only `.mp4` in an `<audio>` element
  with the block's own play button. `audio(src)` in the kit and `.m4a`/`.opus`
  in `check.mjs` would say what it is.
- `check.mjs` presses only `.vid-play`, `.op-b`, `[data-set]`, `.ah-offer-b`
  and `[data-undo]`. The play button here could not take the class
  `.vid-play`, because `engine/views.css` positions that class absolutely for
  the video stand-in. It was pressed by hand in headless Chromium (plays,
  switches to the transcript, console clean). A neutral hook such as
  `[data-press]` would let the check cover block buttons.
- The block CSS check splits selectors on every comma, so `:is(td, th)` is
  refused; written as two selectors.
- A CSS `mask-image` on an asset does not load from `file://` (CORS), which is
  how the check opens the page. The waveform is therefore an `<img>` of a
  white sheet with the wave cut out, over the speaker colours; it assumes the
  strip's background is white.
- The offer card cannot link to a real file, and `.docx` is not an allowed
  asset format, so the real Word file is not offered for download.
