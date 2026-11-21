#!/usr/bin/env node
// Renders every sound of synth.mjs in Node, checks the limits and compares its
// 16-bit stereo PCM fingerprint with fingerprints.json, so a change to a recipe
// or the renderer shows up as a changed fingerprint instead of a silent drift.
//
// Every offered sound has two renders, `<id>/short` and `<id>/long`, and each
// is checked against its own length band (LENGTHS). Round 4's versions
// (`r4-<id>`) are carried only for comparison and checked for their
// fingerprints. While round 4's directory is in the tree, they are also
// compared with its fingerprints.json, which proves that "Kierros 4" on the
// page is exactly what Jari heard.
//
//   node render.mjs                 # check and verify fingerprints
//   node render.mjs --update        # rewrite fingerprints.json after an intended change
//   node render.mjs --wav <dir>     # also write <key>.wav (48 kHz, 16-bit stereo) outside the repo
//
// Exit 1 when a sound breaks a limit or a fingerprint differs.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOUNDS, BEFORE, ALL, DEFAULT_SOUND, SAMPLE_RATE, LENGTHS, TARGET_LUFS, PEAK_CEIL, TAIL_CEIL, RAW_TAIL_CEIL, renderSound, measure, toPcm16 } from './synth.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const update = args.includes('--update');
const wavIdx = args.indexOf('--wav');
const wavDir = wavIdx >= 0 ? args[wavIdx + 1] : null;
const fpFile = join(here, 'fingerprints.json');
const known = update || !existsSync(fpFile) ? {} : JSON.parse(readFileSync(fpFile, 'utf8'));
const r4File = join(here, '../2026-11-21-attention-sounds-3/fingerprints.json');
const r4Known = existsSync(r4File) ? JSON.parse(readFileSync(r4File, 'utf8')) : null;

function wav(pcm) {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SAMPLE_RATE, 24); h.writeUInt32LE(SAMPLE_RATE * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const problems = [];
const prints = {};
const rows = [];
const redone = SOUNDS.filter(s => s.redone);
if (SOUNDS.length > 15) problems.push(`${SOUNDS.length} sounds; at most 15`);
if (redone.length !== 5) problems.push(`${redone.length} redone candidates; round 4 had 5`);
if (SOUNDS.length - redone.length !== 9) problems.push(`${SOUNDS.length - redone.length} kept sounds; Jari kept 9`);
for (const s of SOUNDS) if (!BEFORE.some(b => b.id === s.r4)) problems.push(`${s.id}: round 4 version ${s.r4} missing`);
if (new Set(SOUNDS.map(s => s.id)).size !== SOUNDS.length || new Set(ALL.map(s => s.key)).size !== ALL.length) problems.push('duplicate ids');
for (const s of [...SOUNDS, ...BEFORE]) if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) problems.push(`${s.id}: id is not a stable kebab-case slug`);
if (!SOUNDS.some(s => s.id === DEFAULT_SOUND)) problems.push(`default ${DEFAULT_SOUND} missing`);
const dB = (x) => +(20 * Math.log10(Math.max(x, 1e-9))).toFixed(1);
const t0 = Date.now();
for (const s of ALL) {
  const x = renderSound(s);
  const m = measure(x);
  const pcm = toPcm16(x);
  const fp = createHash('sha256').update(Buffer.from(pcm.buffer)).digest('hex');
  prints[s.key] = fp;
  const at = s.key;
  if (!s.reference) {
    const [lo, hi] = LENGTHS[s.length];
    if (m.duration < lo - 1e-9 || m.duration > hi + 1e-9) problems.push(`${at}: ${m.duration.toFixed(3)} s, outside ${lo}–${hi} s`);
    if (m.peak > PEAK_CEIL + 1e-6) problems.push(`${at}: peak ${m.peak.toFixed(3)} over the ceiling`);
    if (Math.abs(m.lufs - TARGET_LUFS) > 0.5) problems.push(`${at}: loudness ${m.lufs.toFixed(2)} LUFS, target ${TARGET_LUFS} ±0.5 (peak-limited?)`);
    if (m.first > 1e-4) problems.push(`${at}: starts with a click (${m.first.toFixed(5)})`);
    if (m.tail50 > TAIL_CEIL) problems.push(`${at}: last 50 ms peak ${dB(m.tail50)} dBFS, limit −50 (truncated tail)`);
    if (x.rawTail > RAW_TAIL_CEIL) problems.push(`${at}: last 50 ms before the fade ${dB(x.rawTail)} dBFS, limit −45 (the fade is cutting the sound off)`);
    if (m.audible < 0.25) problems.push(`${at}: audible only ${m.audible.toFixed(3)} s`);
    if (m.above6k > -30) problems.push(`${at}: ${m.above6k.toFixed(1)} dB of the energy above 6 kHz (limit −30 dB)`);
    if (m.width < 0.03) problems.push(`${at}: too little stereo width (${m.width.toFixed(3)})`);
  } else if (r4Known && r4Known[s.of] !== fp) problems.push(`${at}: differs from round 4's own fingerprint`);
  if (!update && known[s.key] !== fp) problems.push(`${at}: fingerprint ${fp.slice(0, 12)} ≠ ${String(known[s.key]).slice(0, 12)}`);
  if (wavDir) { mkdirSync(wavDir, { recursive: true }); writeFileSync(join(wavDir, `${s.key.replace('/', '-')}.wav`), wav(pcm)); }
  rows.push({ key: s.key, ms: Math.round(m.duration * 1000), lufsM: +m.lufs.toFixed(2), peak: dB(m.peak), tail50: dB(m.tail50), rawTail: dB(x.rawTail), hi6k: +m.above6k.toFixed(1), width: +m.width.toFixed(3) });
}
const ms = Date.now() - t0;
if (update) writeFileSync(fpFile, JSON.stringify(prints, null, 2) + '\n');
console.table(rows);
console.log(`rendered ${ALL.length} sounds in ${ms} ms`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`${ALL.length} renders OK${update ? ', fingerprints.json rewritten' : ', fingerprints match'}${r4Known ? '; round 4 versions match round 4' : ''}`);
