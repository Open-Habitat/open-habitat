import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getSessionPath, parseJsonl } from 'cc-session-io';
import companion, { bridgeTranscriptPath, bridgeTranscriptType, guardBridgeTranscript, transcriptDamage } from '../process-extension.mjs';

// A Claude Code transcript as the full-disk incident left it: a record cut
// mid-JSON, the next record appended straight after it, then later records.
const rec = (n, parent) => JSON.stringify({ type: n % 2 ? 'user' : 'assistant', uuid: `00000000-0000-4000-8000-00000000000${n}`, parentUuid: parent, message: { content: `synthetic ${n}` } });
const intact = `${rec(1, null)}\n${rec(2, '00000000-0000-4000-8000-000000000001')}\n`;
const torn = rec(3, '00000000-0000-4000-8000-000000000002').slice(0, 60);
const glued = `${intact}${torn}${rec(4, '00000000-0000-4000-8000-000000000003')}\n${rec(5, '00000000-0000-4000-8000-000000000004')}\n`;

const piSession = '11111111-1111-4111-8111-111111111111';
const ccSession = '22222222-2222-4222-8222-222222222222';

async function fixture(transcript, { long = false } = {}) {
  const home = await mkdtemp(path.join(os.tmpdir(), 'oh-bt-'));
  const cwd = path.join(home, long ? 'w'.repeat(240) : 'work space');
  await mkdir(cwd, { recursive: true });
  const env = { PI_CODING_AGENT_DIR: path.join(home, 'agent'), CLAUDE_CONFIG_DIR: path.join(home, 'claude') };
  const sessions = path.join(env.PI_CODING_AGENT_DIR, 'claude-bridge', 'sessions');
  await mkdir(sessions, { recursive: true });
  const hash = createHash('sha256').update(piSession, 'utf16le').digest('hex');
  await writeFile(path.join(sessions, `s-${hash}.json`), JSON.stringify({ version: 1, ccSessionId: ccSession, cwd, model: 'synthetic', promptDigest: 'x', digests: [], uuids: [], cuttable: [] }));
  const file = getSessionPath(ccSession, cwd, env.CLAUDE_CONFIG_DIR);
  if (transcript !== undefined) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, transcript);
    const old = new Date(Date.now() - 60_000);
    await utimes(file, old, old);
  }
  return { home, cwd, env, file };
}

test('the transcript path is the one the pinned bridge and cc-session-io use', async () => {
  for (const long of [false, true]) {
    const f = await fixture(undefined, { long });
    try {
      assert.equal(bridgeTranscriptPath(piSession, { env: f.env, home: f.home }), f.file);
      assert.equal(bridgeTranscriptPath('33333333-3333-4333-8333-333333333333', { env: f.env, home: f.home }), null);
    } finally { await rm(f.home, { recursive: true, force: true }); }
  }
});

test('damage follows the bridge reader: only a torn tail is tolerated, a glued line is not', () => {
  // The pinned bridge's readTranscript parses every terminated line with
  // cc-session-io's parseJsonl: the incident's failure on every turn.
  assert.throws(() => parseJsonl(glued.slice(0, glued.lastIndexOf('\n') + 1)), SyntaxError);
  assert.doesNotThrow(() => parseJsonl(intact));
  assert.deepEqual(transcriptDamage(intact), { damage: null, verified: Buffer.byteLength(intact) });
  assert.equal(transcriptDamage(intact + torn).damage, 'torn');
  assert.equal(transcriptDamage(intact + rec(3, null)).damage, 'unterminated');
  const g = transcriptDamage(glued);
  assert.equal(g.damage, 'interior');
  assert.equal(g.line, 3);
  assert.equal(g.verified, Buffer.byteLength(intact));
});

test('a glued line sets the whole transcript aside unchanged, so the bridge rebuilds from Pi', async () => {
  const f = await fixture(glued);
  try {
    const decision = await guardBridgeTranscript(f.file);
    assert.equal(decision.action, 'set_aside');
    assert.equal(decision.damage, 'interior');
    assert.equal(decision.line, 3);
    await assert.rejects(stat(f.file), { code: 'ENOENT' });
    const kept = path.join(path.dirname(f.file), decision.kept);
    assert.match(decision.kept, /^22222222-2222-4222-8222-222222222222\.jsonl\.damaged-\d{8}T\d{6}Z$/);
    assert.equal(await readFile(kept, 'utf8'), glued, 'every original byte is kept');
    assert.deepEqual((await readdir(path.dirname(f.file))).filter(n => n.endsWith('.jsonl')), [], 'nothing left that Claude Code or the bridge reads');
  } finally { await rm(f.home, { recursive: true, force: true }); }
});

test('a complete final record without its newline gets one, so the next append starts on its own line', async () => {
  const f = await fixture(intact + rec(3, null));
  try {
    const decision = await guardBridgeTranscript(f.file);
    assert.equal(decision.action, 'newline');
    assert.equal(await readFile(f.file, 'utf8'), `${intact}${rec(3, null)}\n`);
    assert.equal(await guardBridgeTranscript(f.file), null);
  } finally { await rm(f.home, { recursive: true, force: true }); }
});

test('an intact transcript is left alone and later checks read only what was appended', async () => {
  const f = await fixture(intact);
  const verified = new Map();
  try {
    assert.equal(await guardBridgeTranscript(f.file, { verified }), null);
    assert.equal(verified.get(f.file).offset, Buffer.byteLength(intact));
    await writeFile(f.file, `${intact}${torn}${rec(4, null)}\n`);
    const old = new Date(Date.now() - 60_000);
    await utimes(f.file, old, old);
    const decision = await guardBridgeTranscript(f.file, { verified });
    assert.equal(decision.action, 'set_aside');
    assert.equal(decision.line, 1, 'counted from the verified offset');
  } finally { await rm(f.home, { recursive: true, force: true }); }
});

test('a damaged file still being written is left alone', async () => {
  const f = await fixture(glued);
  try {
    await utimes(f.file, new Date(), new Date());
    let clock = Date.now();
    const decision = await guardBridgeTranscript(f.file, { now: () => clock, wait: async () => { clock += 250; await utimes(f.file, new Date(clock), new Date(clock)); } });
    assert.equal(decision.action, 'busy');
    assert.equal(await readFile(f.file, 'utf8'), glued);
  } finally { await rm(f.home, { recursive: true, force: true }); }
});

test('before a run on the bridge the companion repairs and records its decision; other providers are not checked', async () => {
  const f = await fixture(glued);
  const saved = { agent: process.env.PI_CODING_AGENT_DIR, claude: process.env.CLAUDE_CONFIG_DIR };
  process.env.PI_CODING_AGENT_DIR = f.env.PI_CODING_AGENT_DIR;
  process.env.CLAUDE_CONFIG_DIR = f.env.CLAUDE_CONFIG_DIR;
  const handlers = [];
  const entries = [];
  const errors = [];
  const consoleError = console.error;
  console.error = line => errors.push(line);
  try {
    companion({
      on: (name, handler) => { if (name === 'before_agent_start') handlers.push(handler); },
      events: { on() {}, emit() {} },
      appendEntry: (type, data) => entries.push({ type, data }),
    });
    const ctx = provider => ({ model: { provider }, sessionManager: { getSessionId: () => piSession, getBranch: () => [] } });
    for (const h of handlers) await h({}, ctx('openai-codex'));
    assert.equal(entries.length, 0);
    assert.equal(await readFile(f.file, 'utf8'), glued);
    for (const h of handlers) await h({}, ctx('claude-bridge'));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].type, bridgeTranscriptType);
    assert.equal(entries[0].data.action, 'set_aside');
    assert.match(errors.join('\n'), /claude-bridge transcript set_aside/);
    await assert.rejects(stat(f.file), { code: 'ENOENT' });
  } finally {
    console.error = consoleError;
    for (const [k, v] of [['PI_CODING_AGENT_DIR', saved.agent], ['CLAUDE_CONFIG_DIR', saved.claude]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    await rm(f.home, { recursive: true, force: true });
  }
});
