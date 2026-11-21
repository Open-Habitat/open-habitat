#!/usr/bin/env node
// Renders every sound of synth.mjs in Node, checks the limits and compares its
// 16-bit stereo PCM fingerprint with fingerprints.json, so a change to a recipe
// or the renderer shows up as a changed fingerprint instead of a silent drift.
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
import { SOUNDS, FAMILIES, RECOMMENDED, SAMPLE_RATE, MAX_DUR, TARGET_LUFS, PEAK_CEIL, renderSound, measure, toPcm16 } from './synth.mjs';

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
const fresh = SOUNDS.filter(s => !s.reference);
if (fresh.length < 16 || fresh.length > 24) problems.push(`${fresh.length} new sounds; the round asks for 16–24`);
if (new Set(SOUNDS.map(s => s.id)).size !== SOUNDS.length) problems.push('duplicate sound ids');
for (const s of SOUNDS) if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) problems.push(`${s.id}: id is not a stable kebab-case slug`);
for (const f of FAMILIES) if (!SOUNDS.some(s => s.family === f.id)) problems.push(`family ${f.id} is empty`);
for (const id of [RECOMMENDED.sound, ...RECOMMENDED.shortlist]) if (!SOUNDS.some(s => s.id === id)) problems.push(`recommended ${id} missing`);
const t0 = Date.now();
for (const s of SOUNDS) {
  const x = renderSound(s);
  const m = measure(x);
  const pcm = toPcm16(x);
  const fp = createHash('sha256').update(Buffer.from(pcm.buffer)).digest('hex');
  prints[s.id] = fp;
  const at = `${s.id} ${s.name}`;
  if (m.duration > MAX_DUR + 1e-9) problems.push(`${at}: ${m.duration.toFixed(3)} s, over ${MAX_DUR} s`);
  if (m.peak > PEAK_CEIL + 1e-6) problems.push(`${at}: peak ${m.peak.toFixed(3)} over the ceiling`);
  if (Math.abs(m.lufs - TARGET_LUFS) > 1) problems.push(`${at}: loudness ${m.lufs.toFixed(2)} LUFS, target ${TARGET_LUFS} ±1 (peak-limited?)`);
  if (m.first > 1e-4) problems.push(`${at}: starts with a click (${m.first.toFixed(5)})`);
  if (m.tailRms > 0.002) problems.push(`${at}: tail not silent (rms ${m.tailRms.toFixed(4)})`);
  if (m.audible < 0.25) problems.push(`${at}: audible only ${m.audible.toFixed(3)} s`);
  if (!s.reference && m.above6k > -30) problems.push(`${at}: ${m.above6k.toFixed(1)} dB of the energy above 6 kHz (limit −30 dB)`);
  if (!s.reference && m.width < 0.01) problems.push(`${at}: no stereo width (${m.width.toFixed(3)})`);
  if (!update && known[s.id] !== fp) problems.push(`${at}: fingerprint ${fp.slice(0, 12)} ≠ ${String(known[s.id]).slice(0, 12)}`);
  if (wavDir) { mkdirSync(wavDir, { recursive: true }); writeFileSync(join(wavDir, `${s.id}.wav`), wav(pcm)); }
  rows.push({ id: s.id, ms: Math.round(m.duration * 1000), audible: Math.round(m.audible * 1000), lufsM: +m.lufs.toFixed(2), peak: +m.peak.toFixed(3), hi6k: +m.above6k.toFixed(1), width: +m.width.toFixed(3) });
}
const ms = Date.now() - t0;
if (update) writeFileSync(fpFile, JSON.stringify(prints, null, 2) + '\n');
console.table(rows);
console.log(`rendered ${SOUNDS.length} sounds in ${ms} ms`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`${SOUNDS.length} sounds OK${update ? ', fingerprints.json rewritten' : ', fingerprints match'}`);
