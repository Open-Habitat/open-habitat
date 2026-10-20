import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const pkg = resolve(here, 'node_modules/@earendil-works/pi-coding-agent');
function run(home, action) {
  const child = spawnSync(process.execPath, ['--import', join(here, 'mock.mjs'), resolve(here, '../pi_models_helper.mjs'),
    join(pkg, 'dist/index.js'), join(pkg, 'package.json'), action, ''],
    {env: {HOME: home, PATH: process.env.PATH, PI_OFFLINE: '1'}, encoding: 'utf8', timeout: 12000});
  assert.equal(child.status, 0, child.stdout + child.stderr);
  return JSON.parse(child.stdout);
}

test('Claude sign-in initializes native Opus/medium, reads do not, and saved choices survive sign-in', async () => {
  const home = await mkdtemp(join(tmpdir(), 'claude-default-'));
  const dir = join(home, '.pi/agent');
  const path = join(dir, 'settings.json');
  try {
    await mkdir(dir, {recursive: true});
    const initial = {theme: 'dark', extensions: ['/synthetic/extension']};
    await writeFile(path, JSON.stringify(initial), {mode: 0o600});
    assert.equal(run(home, 'list').default_model, null);
    assert.deepEqual(JSON.parse(await readFile(path)), initial);
    const result = run(home, 'initialize-claude');
    assert.equal(result.default_provider, 'claude-bridge');
    assert.equal(result.default_model, 'claude-opus-5-5');
    assert.equal(result.default_thinking, 'medium');
    const initialized = JSON.parse(await readFile(path));
    assert.equal(initialized.theme, 'dark');
    assert.equal(initialized.modelThinkingLevels['claude-bridge/claude-opus-5-5'], 'medium');
    assert.ok(initialized.extensions.includes('/synthetic/extension'));
    assert.ok(initialized.extensions.some(p => p.endsWith('/pi-claude-bridge/src/index.ts')));
    for (const saved of [initialized,
      {...initial, defaultProvider: 'claude-bridge', defaultModel: 'claude-fable-5-1', defaultThinkingLevel: 'high'},
      {...initial, defaultProvider: 'openai-codex', defaultModel: 'gpt-5.5', defaultThinkingLevel: 'off'},
      {...initial, defaultModel: 'custom-model'},
      {...initial, defaultProvider: 'anthropic'}]) {
      const bytes = JSON.stringify(saved);
      await writeFile(path, bytes);
      run(home, 'initialize-claude');
      assert.equal(await readFile(path, 'utf8'), bytes, 'saved choice must remain byte-for-byte unchanged');
    }
    await writeFile(path, JSON.stringify({...initial, defaultThinkingLevel: 'high'}));
    assert.equal(run(home, 'initialize-claude').default_thinking, 'high');
    await assert.rejects(readFile(join(home, '.claude/.credentials.json')), {code: 'ENOENT'});
  } finally { await rm(home, {recursive: true, force: true}); }
});
