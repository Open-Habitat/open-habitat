#!/usr/bin/env node
// Renders every sound of synth.mjs in Node, checks it and compares its 16-bit
// PCM fingerprint with fingerprints.json, so a change to a recipe or to the
// renderer shows up as a changed fingerprint instead of a silent drift.
//
//   node render.mjs                       # check and verify fingerprints
//   node render.mjs --update              # rewrite fingerprints.json after an intended change
//   node render.mjs --wav <dir>           # also write <id>-<name>.wav (48 kHz, 16-bit mono)
//
// Exit 1 when a sound breaks a limit or a fingerprint differs.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOUNDS, FAMILIES, SAMPLE_RATE, PEAK, renderSound, measure, toPcm16 } from './synth.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const update = args.includes('--update');
const wavIdx = args.indexOf('--wav');
const wavDir = wavIdx >= 0 ? args[wavIdx + 1] : null;
const fpFile = join(here, 'fingerprints.json');
const known = update ? {} : JSON.parse(readFileSync(fpFile, 'utf8'));

function wav(pcm) {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SAMPLE_RATE, 24); h.writeUInt32LE(SAMPLE_RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const problems = [];
const prints = {};
const rows = [];
if (SOUNDS.length < 8 || SOUNDS.length > 12) problems.push(`${SOUNDS.length} sounds; the round asks for 8–12`);
for (const f of FAMILIES) if (!SOUNDS.some(s => s.family === f.id)) problems.push(`family ${f.id} is empty`);
for (const s of SOUNDS) {
  const x = renderSound(s);
  const m = measure(x);
  const pcm = toPcm16(x);
  const fp = createHash('sha256').update(Buffer.from(pcm.buffer)).digest('hex');
  prints[s.id] = fp;
  const bytes = 44 + pcm.byteLength;
  const at = `${s.id} ${s.name}`;
  if (m.duration >= 1) problems.push(`${at}: ${m.duration.toFixed(3)} s, not under 1 s`);
  if (Math.abs(m.peak - PEAK * (s.level ?? 1)) > 1e-6) problems.push(`${at}: peak ${m.peak} off target`);
  if (m.peak > 0.6) problems.push(`${at}: peak ${m.peak.toFixed(3)} too loud`);
  if (m.first > 0.01) problems.push(`${at}: starts with a click (${m.first.toFixed(4)})`);
  if (m.tailRms > 0.002) problems.push(`${at}: tail not silent (rms ${m.tailRms.toFixed(4)})`);
  if (m.audible < 0.15) problems.push(`${at}: audible only ${m.audible.toFixed(3)} s`);
  if (bytes > 100 * 1024) problems.push(`${at}: WAV would be ${bytes} bytes, over 100 KB`);
  if (!update && known[s.id] !== fp) problems.push(`${at}: fingerprint ${fp.slice(0, 12)} ≠ ${String(known[s.id]).slice(0, 12)}`);
  if (wavDir) { mkdirSync(wavDir, { recursive: true }); writeFileSync(join(wavDir, `${s.id}-${s.name.replace(/\W+/g, '_')}.wav`), wav(pcm)); }
  rows.push({ id: s.id, name: s.name, ms: Math.round(m.duration * 1000), audibleMs: Math.round(m.audible * 1000), peak: +m.peak.toFixed(3), rms: +m.rms.toFixed(4), wavBytes: bytes, sha256: fp.slice(0, 16) });
}
if (update) writeFileSync(fpFile, JSON.stringify(prints, null, 2) + '\n');
console.table(rows);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`${SOUNDS.length} sounds OK${update ? ', fingerprints.json rewritten' : ', fingerprints match'}`);
