// node blocks/alice-06-planning-memo/assets.mjs
//
// The block's showpiece is a real transcription. This script
//
//   1. speaks a 54-second passage of the planning meeting with three Piper
//      voices (Alice, Bob, Carol; the lines are LINES below; Carol's is lowered a
//      little so the two women differ more), levels them and
//      adds a little room with ffmpeg, as a phone on the table would record it;
//   2. transcribes that audio on the CPU with faster-whisper (large-v3-turbo,
//      int8) and tells the speakers apart with sherpa-onnx (pyannote
//      segmentation 3.0 + a WeSpeaker embedding model). Neither program is told
//      the script or who speaks when;
//   3. renders the waveform from the audio with ffmpeg showwavespic and encodes
//      the passage as AAC in an MP4;
//   4. writes the memo as a Word file with pandoc from block.js's Markdown;
//   5. prints the transcript as the TRANSCRIPT literal that block.js carries.
//      If the audio changes, paste the new literal there.
//
// Output: $ETUSIVU_ASSETS/alice-06-planning-memo/wave.webp and meeting.mp4.
// The .docx is not a shippable format; it goes to $MEMO_WORK for its size.
//
// Needs ffmpeg, pandoc, ImageMagick and a Python with piper-tts,
// faster-whisper, sherpa-onnx and numpy:
//   uv venv --python 3.12 $TMPDIR/venv
//   uv pip install --python $TMPDIR/venv/bin/python piper-tts faster-whisper sherpa-onnx numpy
//   MEMO_PY=$TMPDIR/venv/bin/python node blocks/alice-06-planning-memo/assets.mjs
// Voices and models (about 2.2 GB) are downloaded once into $MEMO_CACHE
// (default $TMPDIR/alice-06-cache). Sources and licences are in NOTES.md.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const ID = 'alice-06-planning-memo';
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), ID);
const cache = process.env.MEMO_CACHE || join(tmpdir(), 'alice-06-cache');
const work = process.env.MEMO_WORK || join(tmpdir(), 'alice-06-work');
const py = process.env.MEMO_PY || 'python3';
for (const d of [out, work, join(cache, 'voices'), join(cache, 'models')]) mkdirSync(d, { recursive: true });
const run = (cmd, args, opt = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', maxBuffer: 1 << 26, ...opt });

// ---------- What is said ----------
const LINES = [
  ["Alice", "Okay, next on the list is the winter prints. Carol, where are we with those?"],
  ["Carol", "All six designs are printed and photographed. I finished the last two yesterday."],
  ["Bob", "Two shops have already asked me when they can order them."],
  ["Alice", "Then let's not wait. Could we put them on the shop page on Monday?"],
  ["Carol", "Monday works for me. I still need Friday to write the descriptions and choose the photographs."],
  ["Alice", "Great, so that's decided. The winter prints go on the shop page on Monday."],
  ["Bob", "What about the new tote bag? People want to see it from every side before they buy."],
  ["Carol", "I could make a short turning film of it. Ten seconds, the bag going round once."],
  ["Alice", "I like that. Carol, that one is yours. Could you have it ready by Wednesday?"],
  ["Carol", "Yes, Wednesday is fine."],
  ["Bob", "And I'll tell the two shops today that the winter prints are coming."],
  ["Alice", "Perfect. The next thing on my list is wholesale orders."],
];

// ---------- Voices and models ----------
const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en';
const K2 = 'https://github.com/k2-fsa/sherpa-onnx/releases/download';
const fetchTo = (url, file) => { if (!existsSync(file)) { console.log(`fetching ${url}`); run('curl', ['-sfL', url, '-o', file]); } };
for (const v of ['en_GB/cori/high/en_GB-cori-high', 'en_US/norman/medium/en_US-norman-medium', 'en_US/ljspeech/high/en_US-ljspeech-high']) {
  for (const ext of ['onnx', 'onnx.json']) fetchTo(`${HF}/${v}.${ext}`, join(cache, 'voices', `${v.split('/').pop()}.${ext}`));
}
fetchTo(`${K2}/speaker-recongition-models/wespeaker_en_voxceleb_resnet34_LM.onnx`, join(cache, 'models/wespeaker_en_voxceleb_resnet34_LM.onnx'));
if (!existsSync(join(cache, 'models/sherpa-onnx-pyannote-segmentation-3-0/model.onnx'))) {
  fetchTo(`${K2}/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2`, join(cache, 'models/seg.tar.bz2'));
  run('tar', ['xjf', join(cache, 'models/seg.tar.bz2'), '-C', join(cache, 'models')]);
}

// ---------- 1. Speak ----------
const SPEAK = String.raw`import json, sys, wave, subprocess, os, time
import numpy as np
cache, out = sys.argv[1], sys.argv[2]
LINES = json.load(open(sys.argv[3]))
VOICES = {'Alice': 'en_GB-cori-high', 'Bob': 'en_US-norman-medium', 'Carol': 'en_US-ljspeech-high'}
from piper import PiperVoice
try:
    from piper import SynthesisConfig
except Exception:
    SynthesisConfig = None
voices = {k: PiperVoice.load(f'{cache}/voices/{v}.onnx') for k, v in VOICES.items()}
SR = 22050
# Carol's voice is lowered and slowed a little (resampled), so the two women are easier to tell apart.
SHIFT = {'Carol': 1.08}
rng = np.random.default_rng(19)
parts, truth, t = [np.zeros(int(SR * 0.6), np.int16)], [], 0.6
for who, text in LINES:
    v = voices[who]
    chunks = [c.audio_int16_array for c in v.synthesize(text)]
    a = np.concatenate(chunks)
    if who in SHIFT: a = np.interp(np.arange(0, len(a), 1 / SHIFT[who]), np.arange(len(a)), a.astype(np.float32)).astype(np.int16)
    assert v.config.sample_rate == SR
    # level the three voices to the same loudness
    a = (a.astype(np.float32) * (3000.0 / (np.sqrt(np.mean(a.astype(np.float32) ** 2)) + 1e-9))).clip(-32000, 32000).astype(np.int16)
    truth.append([who, round(t, 2), round(t + len(a) / SR, 2), text])
    gap = float(rng.uniform(0.28, 0.6))
    parts += [a, np.zeros(int(SR * gap), np.int16)]
    t += len(a) / SR + gap
pcm = np.concatenate(parts)
with wave.open(f'{out}/dry.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
json.dump(truth, open(f'{out}/truth.json', 'w'), indent=1)
print('synth', round(len(pcm) / SR, 1), 's')
`;
// ---------- 2. Transcribe and tell the speakers apart ----------
const TRANSCRIBE = String.raw`import json, sys, time, wave
import numpy as np
cache, out, model_name = sys.argv[1], sys.argv[2], sys.argv[3]
PROMPT = 'Example Studio planning meeting with Alice, Bob and Carol: the winter prints, the shop page, the tote bag, wholesale orders.'
wav = f'{out}/planning.wav'
with wave.open(wav) as w:
    sr = w.getframerate(); pcm = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
dur = len(pcm) / sr
from faster_whisper import WhisperModel
m = WhisperModel(model_name, device='cpu', compute_type='int8', cpu_threads=8, download_root=f'{cache}/whisper')
t0 = time.time()
segs, info = m.transcribe(pcm, language='en', word_timestamps=True, vad_filter=True, condition_on_previous_text=False, beam_size=5, initial_prompt=PROMPT)
words = [{'w': w.word, 's': round(w.start, 2), 'e': round(w.end, 2)} for s in segs for w in s.words]
t_asr = time.time() - t0
import sherpa_onnx
cfg = sherpa_onnx.OfflineSpeakerDiarizationConfig(
    segmentation=sherpa_onnx.OfflineSpeakerSegmentationModelConfig(pyannote=sherpa_onnx.OfflineSpeakerSegmentationPyannoteModelConfig(model=f'{cache}/models/sherpa-onnx-pyannote-segmentation-3-0/model.onnx')),
    embedding=sherpa_onnx.SpeakerEmbeddingExtractorConfig(model=f'{cache}/models/wespeaker_en_voxceleb_resnet34_LM.onnx'),
    clustering=sherpa_onnx.FastClusteringConfig(num_clusters=-1, threshold=0.5),
    min_duration_on=0.3, min_duration_off=0.3)
sd = sherpa_onnx.OfflineSpeakerDiarization(cfg)
t0 = time.time()
res = sd.process(pcm).sort_by_start_time()
t_dia = time.time() - t0
dia = [{'s': round(r.start, 2), 'e': round(r.end, 2), 'k': int(r.speaker)} for r in res]
# Sentences from the words; each sentence goes to the speaker who talks through most of it.
sents = []
for wd in words:
    if not sents or sents[-1]['done']: sents.append({'s': wd['s'], 'e': wd['e'], 'text': wd['w'].strip(), 'done': False})
    else: sents[-1]['e'] = wd['e']; sents[-1]['text'] += wd['w']
    sents[-1]['done'] = wd['w'].rstrip()[-1:] in '.?!'
def who(x):
    ov = {}
    for d in dia:
        o = min(x['e'], d['e']) - max(x['s'], d['s'])
        if o > 0: ov[d['k']] = ov.get(d['k'], 0) + o
    if ov: return max(ov, key=ov.get)
    mid = (x['s'] + x['e']) / 2
    return min(dia, key=lambda d: min(abs(d['s'] - mid), abs(d['e'] - mid)))['k']
turns = []
for x in sents:
    k = who(x)
    if turns and turns[-1]['k'] == k: turns[-1]['e'] = x['e']; turns[-1]['text'] += ' ' + x['text']
    else: turns.append({'k': k, 's': x['s'], 'e': x['e'], 'text': x['text']})
json.dump({'duration': round(dur, 2), 'model': model_name, 'asr_seconds': round(t_asr, 1), 'diar_seconds': round(t_dia, 1), 'speakers': len({d['k'] for d in dia}), 'diarization': dia, 'turns': turns, 'words': words}, open(f'{out}/transcript.json', 'w'), indent=1)
print(f'{dur:.1f} s audio · whisper {model_name} {t_asr:.1f} s · diarization {t_dia:.1f} s · {len({d["k"] for d in dia})} speakers')
for t in turns: print(f"SPEAKER_{t['k']:02d} {t['s']:6.2f}-{t['e']:6.2f}  {t['text']}")
`;
writeFileSync(join(work, 'lines.json'), JSON.stringify(LINES));
writeFileSync(join(work, 'speak.py'), SPEAK);
writeFileSync(join(work, 'transcribe.py'), TRANSCRIBE);
console.log(run(py, [join(work, 'speak.py'), cache, work, join(work, 'lines.json')]).trim());
// The room: two short early reflections, a rumble filter and a limiter; 16 kHz mono, as Whisper reads it.
run('ffmpeg', ['-v', 'error', '-y', '-i', join(work, 'dry.wav'), '-af', 'aecho=0.8:0.5:22|37:0.12|0.07,highpass=f=90,alimiter=limit=0.9', '-ac', '1', '-ar', '16000', join(work, 'planning.wav')]);
console.log(run(py, [join(work, 'transcribe.py'), cache, work, 'large-v3-turbo'], { env: { ...process.env, HF_HOME: join(cache, 'hf') } }).trim());

// ---------- 3. Waveform and audio ----------
// ffmpeg draws the wave white on transparent. ImageMagick turns that inside out:
// a white sheet with the wave cut out of it. The block lays it over a band of
// colour per speaker, so the wave shows in the colour of whoever is talking
// (an <img>, because a CSS mask does not load from file://).
run('ffmpeg', ['-v', 'error', '-y', '-i', join(work, 'planning.wav'), '-filter_complex', 'volume=3.2,showwavespic=s=1600x160:colors=white:scale=sqrt:draw=full', '-frames:v', '1', join(work, 'wave.png')]);
run('convert', [join(work, 'wave.png'), '-alpha', 'extract', '-negate', join(work, 'hole.png')]);
run('convert', ['-size', '1600x160', 'xc:white', join(work, 'hole.png'), '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', '-define', 'webp:lossless=true', '-define', 'webp:method=6', join(out, 'wave.webp')]);
// The 22 kHz original (before the 16 kHz copy for Whisper), with the same room, as AAC.
run('ffmpeg', ['-v', 'error', '-y', '-i', join(work, 'dry.wav'), '-af', 'aecho=0.8:0.5:22|37:0.12|0.07,highpass=f=90,alimiter=limit=0.9', '-vn', '-ac', '1', '-c:a', 'aac', '-b:a', '56k', '-movflags', '+faststart', join(out, 'meeting.mp4')]);

// ---------- 4. The memo as a Word file ----------
const { memoMarkdown } = await import('./block.js');
writeFileSync(join(work, 'memo-2026-11-19.md'), memoMarkdown());
run('pandoc', [join(work, 'memo-2026-11-19.md'), '-o', join(work, 'memo-2026-11-19.docx')]);

// ---------- 5. What block.js carries ----------
const t = JSON.parse(readFileSync(join(work, 'transcript.json'), 'utf8'));
// Piper's voices vary a little from run to run, and so does what the diarizer makes of them.
if (t.turns.length !== LINES.length) console.warn(`\nNOTE: ${LINES.length} lines were spoken and the diarizer found ${t.turns.length} turns. Run again for a take where it tells them apart, or show it as it is.`);
const lit = { duration: t.duration, model: t.model, speakers: t.speakers, diarization: t.diarization.map((d) => [d.s, d.e, d.k]), turns: t.turns.map((x) => [x.k, x.s, x.e, x.text]) };
console.log(`\nconst TRANSCRIPT = ${JSON.stringify(lit).replace(/\],\[/g, '],\n  [').replace(/"(diarization|turns)":\[\[/g, '\n  "$1":[\n  [')};\n`);
for (const f of [join(out, 'wave.webp'), join(out, 'meeting.mp4'), join(work, 'memo-2026-11-19.docx')]) console.log(`${f}  ${(statSync(f).size / 1e3).toFixed(1)} KB`);
