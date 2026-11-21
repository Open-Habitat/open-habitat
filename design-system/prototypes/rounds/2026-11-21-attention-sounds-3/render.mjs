#!/usr/bin/env node
// Renders every sound of synth.mjs in Node, checks the limits and compares its
// 16-bit stereo PCM fingerprint with fingerprints.json, so a change to a recipe
// or the renderer shows up as a changed fingerprint instead of a silent drift.
//
// The limits apply to the sounds this round offers (the polished nine and the
// new candidates). Round 2's versions are carried only for comparison: they
// are checked for their fingerprints, which were the same as round 2's own
// fingerprints.json when this round was built, so "before" is what Jari heard.
// Their tail figures are printed too, because they show the truncation.
//
//   node render.mjs                 # check and verify fingerprints
//   node render.mjs --update        # rewrite fingerprints.json after an intended change
//   node render.mjs --wav <dir>     # also write <id>.wav (48 kHz, 16-bit stereo) outside the repo
//
// Exit 1 when a sound breaks a limit or a fingerprint differs.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOUNDS, BEFORE, ALL, DEFAULT_SOUND, SAMPLE_RATE, MAX_DUR, TARGET_LUFS, PEAK_CEIL, TAIL_CEIL, RAW_TAIL_CEIL, renderSound, measure, toPcm16 } from './synth.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const update = args.includes('--update');
const wavIdx = args.indexOf('--wav');
const wavDir = wavIdx >= 0 ? args[wavIdx + 1] : null;
const fpFile = join(here, 'fingerprints.json');
const known = update || !existsSync(fpFile) ? {} : JSON.parse(readFileSync(fpFile, 'utf8'));

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
const fresh = SOUNDS.filter(s => !s.before);
if (fresh.length < 4 || fresh.length > 6) problems.push(`${fresh.length} new candidates; the round asks for 4–6`);
if (SOUNDS.length - fresh.length !== 9) problems.push(`${SOUNDS.length - fresh.length} polished sounds; Jari kept 9`);
for (const s of SOUNDS) if (s.before && !BEFORE.some(b => b.id === s.before)) problems.push(`${s.id}: before ${s.before} missing`);
if (new Set(ALL.map(s => s.id)).size !== ALL.length) problems.push('duplicate sound ids');
for (const s of ALL) if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) problems.push(`${s.id}: id is not a stable kebab-case slug`);
if (!SOUNDS.some(s => s.id === DEFAULT_SOUND)) problems.push(`default ${DEFAULT_SOUND} missing`);
const dB = (x) => +(20 * Math.log10(Math.max(x, 1e-9))).toFixed(1);
const t0 = Date.now();
for (const s of ALL) {
  const x = renderSound(s);
  const m = measure(x);
  const pcm = toPcm16(x);
  const fp = createHash('sha256').update(Buffer.from(pcm.buffer)).digest('hex');
  prints[s.id] = fp;
  const at = `${s.id} ${s.name}`;
  if (!s.reference) {
    if (m.duration > MAX_DUR + 1e-9) problems.push(`${at}: ${m.duration.toFixed(3)} s, over ${MAX_DUR} s`);
    if (m.peak > PEAK_CEIL + 1e-6) problems.push(`${at}: peak ${m.peak.toFixed(3)} over the ceiling`);
    if (Math.abs(m.lufs - TARGET_LUFS) > 1) problems.push(`${at}: loudness ${m.lufs.toFixed(2)} LUFS, target ${TARGET_LUFS} ±1 (peak-limited?)`);
    if (m.first > 1e-4) problems.push(`${at}: starts with a click (${m.first.toFixed(5)})`);
    if (m.tail50 > TAIL_CEIL) problems.push(`${at}: last 50 ms peak ${dB(m.tail50)} dBFS, limit −50 (truncated tail)`);
    if (x.rawTail > RAW_TAIL_CEIL) problems.push(`${at}: last 50 ms before the fade ${dB(x.rawTail)} dBFS, limit −45 (the fade is cutting the sound off)`);
    if (m.audible < 0.25) problems.push(`${at}: audible only ${m.audible.toFixed(3)} s`);
    if (m.above6k > -30) problems.push(`${at}: ${m.above6k.toFixed(1)} dB of the energy above 6 kHz (limit −30 dB)`);
    if (m.width < 0.03) problems.push(`${at}: too little stereo width (${m.width.toFixed(3)})`);
  }
  if (!update && known[s.id] !== fp) problems.push(`${at}: fingerprint ${fp.slice(0, 12)} ≠ ${String(known[s.id]).slice(0, 12)}`);
  if (wavDir) { mkdirSync(wavDir, { recursive: true }); writeFileSync(join(wavDir, `${s.id}.wav`), wav(pcm)); }
  rows.push({ id: s.id, ms: Math.round(m.duration * 1000), lufsM: +m.lufs.toFixed(2), peak: dB(m.peak), tail50: dB(m.tail50), rawTail: dB(x.rawTail), hi6k: +m.above6k.toFixed(1), width: +m.width.toFixed(3) });
}
const ms = Date.now() - t0;
if (update) writeFileSync(fpFile, JSON.stringify(prints, null, 2) + '\n');
console.table(rows);
console.log(`rendered ${ALL.length} sounds in ${ms} ms`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`${ALL.length} sounds OK${update ? ', fingerprints.json rewritten' : ', fingerprints match'}`);
