import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const pkg = resolve(here, 'node_modules/@earendil-works/pi-coding-agent');
function run(home, action, selected = '') {
  const child = spawnSync(process.execPath, ['--import', join(here, 'mock.mjs'), resolve(here, '../pi_models_helper.mjs'),
    join(pkg, 'dist/index.js'), join(pkg, 'package.json'), action, selected],
    {env: {HOME: home, PATH: process.env.PATH, PI_OFFLINE: '1'}, encoding: 'utf8', timeout: 12000});
  assert.equal(child.stderr, '');
  return {code: child.status, result: JSON.parse(child.stdout)};
}
test('real 1.3 catalog/settings: newest numbered family candidates, no credential migration or unrelated resolvers', async () => {
  const home = await mkdtemp(join(tmpdir(), 'pi-models-'));
  try {
    const dir = join(home, '.pi/agent');
    await mkdir(dir, {recursive: true});
    const credentials = {'openai-codex': {type: 'oauth', access: 'synthetic', refresh: 'private-refresh', expires: Date.now() + 3600000}};
    await writeFile(join(dir, 'auth.json'), JSON.stringify(credentials), {mode: 0o600});
    const ids = ['gpt-99.9-sol', 'gpt-99.10-sol', 'gpt-99-sol', 'gpt-99-luna', 'gpt-99-terra', 'gpt-99-astra', 'gpt-5.5', 'gpt-100-sol-preview'];
    await writeFile(join(dir, 'models-store.json'), JSON.stringify({'openai-codex': {lastModified: 4102444800000,
      models: ids.map(id => ({provider: 'openai-codex', id, name: id, api: 'openai-codex-responses', input: ['text'], contextWindow: 128000, maxTokens: 4096}))}}));
    await writeFile(join(dir, 'models.json'), JSON.stringify({providers: {unrelated: {api: 'openai-completions', baseUrl: 'http://invalid', apiKey: '!echo executed >&2; exit 1', models: [{id: 'test'}]}}}));
    await writeFile(join(dir, 'settings.json'), JSON.stringify({theme: 'dark', defaultProvider: 'openai', defaultModel: 'native-default'}));
    const listed = run(home, 'list');
    assert.equal(listed.code, 0);
    assert.deepEqual(listed.result.models.map(m => m.id), ['gpt-99-luna', 'gpt-99-terra', 'gpt-99.10-sol', 'gpt-99-astra']);
    assert.equal(listed.result.default_provider, 'openai');
    assert.equal(listed.result.default_model, 'native-default');
    assert.equal(run(home, 'select', 'gpt-5.5').code, 1);
    const selected = run(home, 'select', 'gpt-99.10-sol');
    assert.equal(selected.code, 0);
    assert.equal(selected.result.default_provider, 'openai-codex');
    assert.equal(selected.result.default_model, 'gpt-99.10-sol');
    assert.equal(JSON.parse(await readFile(join(dir, 'settings.json'))).theme, 'dark');
    assert.deepEqual(JSON.parse(await readFile(join(dir, 'auth.json'))), credentials);
  } finally { await rm(home, {recursive: true, force: true}); }
});
