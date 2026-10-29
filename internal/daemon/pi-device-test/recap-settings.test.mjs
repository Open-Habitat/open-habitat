import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {recapSettings, withinBytes} from '../recap-extension.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const helper = resolve(here, '../recap_settings_helper.mjs');
const pkg = resolve(here, 'node_modules/@earendil-works/pi-coding-agent');
const run = (home, value) => new Promise((done, fail) => {
  const proc = spawn(process.execPath, [helper, join(pkg, 'dist/index.js'), join(pkg, 'package.json'), JSON.stringify(value)],
    {env: {HOME: home, PATH: process.env.PATH, PI_OFFLINE: '1'}, stdio: ['ignore', 'pipe', 'pipe']});
  let out = '';
  proc.stdout.on('data', s => out += s);
  proc.on('error', fail);
  proc.on('exit', code => done({code, out: out.trim()}));
});

test("the helper writes only openHabitat.recap under Pi's lock and the extension reads it back", async () => {
  const home = await mkdtemp(join(tmpdir(), 'pi-recap-settings-'));
  try {
    const agent = join(home, '.pi', 'agent');
    await mkdir(agent, {recursive: true, mode: 0o700});
    await writeFile(join(agent, 'settings.json'), JSON.stringify({defaultModel: 'gpt-6-luna', openHabitat: {other: true}}), {mode: 0o600});
    const value = {level: 'custom', delaySeconds: 300, model: 'claude-bridge/claude-sonnet-5-5', words: 25, nextWords: 10, messages: 16, historyTokens: 4000, messageTokens: 500, responseTokens: 256, firstAfterTurns: 2};
    assert.deepEqual(await run(home, value), {code: 0, out: '{"saved":true}'});
    const stored = JSON.parse(await readFile(join(agent, 'settings.json'), 'utf8'));
    assert.equal(stored.defaultModel, 'gpt-6-luna');
    assert.deepEqual(stored.openHabitat, {other: true, recap: value});
    assert.deepEqual(recapSettings(agent), {words: 25, nextWords: 10, messages: 16, historyTokens: 4000, messageTokens: 500, responseTokens: 256, firstAfterTurns: 2,
      model: {provider: 'claude-bridge', id: 'claude-sonnet-5-5'}});
  } finally { await rm(home, {recursive: true, force: true}); }
});

test('a hand-edited value out of bounds is the default, the rest still apply', async () => {
  const agent = await mkdtemp(join(tmpdir(), 'pi-recap-read-'));
  try {
    await writeFile(join(agent, 'settings.json'), JSON.stringify({openHabitat: {recap: {words: 500, messages: 8, responseTokens: '1024', model: 'not a model'}}}));
    const s = recapSettings(agent);
    assert.equal(s.words, 40);
    assert.equal(s.messages, 8);
    assert.equal(s.responseTokens, 512);
    assert.equal(s.model, undefined);
    await writeFile(join(agent, 'settings.json'), '{broken');
    assert.equal(recapSettings(agent).messages, 64);
  } finally { await rm(agent, {recursive: true, force: true}); }
});

test("a long recap in a multi-byte script still fits the daemon's native reader", () => {
  const text = withinBytes('한'.repeat(640), 1280);
  assert.ok(Buffer.byteLength(text) <= 1280);
  assert.equal(text, '한'.repeat(426));
  assert.equal(withinBytes('ok', 1280), 'ok');
});
