import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, writeFile, readFile, rm, symlink, chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const pkg = resolve(here, 'node_modules/@earendil-works/pi-coding-agent');
function run(home, action, selected = '', thinking = '', provider = '', runtimePkg = pkg) {
  const child = spawnSync(process.execPath, ['--import', join(here, 'mock.mjs'), resolve(here, '../pi_models_helper.mjs'),
    join(runtimePkg, 'dist/index.js'), join(runtimePkg, 'package.json'), action, selected],
    {env: {HOME: home, PATH: process.env.PATH, PI_OFFLINE: '1', OH_PI_THINKING: thinking, OH_PI_PROVIDER: provider}, encoding: 'utf8', timeout: 12000});
  assert.equal(child.stderr, '');
  return {code: child.status, result: JSON.parse(child.stdout)};
}
test('real 1.3 catalog/settings: complete candidate catalog and native thinking levels, no credential migration or unrelated resolvers', async () => {
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
    for (const id of ids) assert.ok(listed.result.models.some(m => m.id === id), id);
    assert.deepEqual(listed.result.models.find(m => m.id === 'gpt-99-sol').thinking_levels, ['off']);
    assert.equal(listed.result.default_provider, 'openai');
    assert.equal(listed.result.default_model, 'native-default');
    assert.equal(run(home, 'select', 'gpt-5.5').code, 0);
    assert.equal(run(home, 'select', 'not-a-model').code, 1);
    assert.equal(run(home, 'select', 'gpt-99-sol', 'xhigh').code, 1);
    const selected = run(home, 'select', 'gpt-99.10-sol', 'off');
    assert.equal(selected.code, 0);
    assert.equal(selected.result.default_provider, 'openai-codex');
    assert.equal(selected.result.default_model, 'gpt-99.10-sol');
    assert.equal(selected.result.default_thinking, 'off');
    assert.equal(JSON.parse(await readFile(join(dir, 'settings.json'))).theme, 'dark');
    assert.deepEqual(JSON.parse(await readFile(join(dir, 'auth.json'))), credentials);
  } finally { await rm(home, {recursive: true, force: true}); }
});

test('Pi 1.3 persists assistant refusal model/provider/error in native session history', async () => {
  const {SessionManager} = await import(join(pkg, 'dist/index.js'));
  const home = await mkdtemp(join(tmpdir(), 'pi-model-history-'));
  try {
    const session = SessionManager.create(home, join(home, 'sessions'));
    session.appendMessage({role:'user',content:[{type:'text',text:'synthetic turn'}],timestamp:Date.now()});
    session.appendMessage({role:'assistant',api:'openai-codex-responses',provider:'openai-codex',model:'gpt-5.5',content:[],stopReason:'error',errorMessage:'The model is not supported with this ChatGPT account',timestamp:Date.now(),usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}});
    const rows=(await readFile(session.getSessionFile(),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
    const last=rows.at(-1);
    assert.equal(last.type,'message');
    assert.equal(last.message.stopReason,'error');
    assert.equal(last.message.provider,'openai-codex');
    assert.equal(last.message.model,'gpt-5.5');
    assert.match(last.message.errorMessage,/not supported.*account/);
    assert.ok(Number.isFinite(Date.parse(last.timestamp)));
  } finally {await rm(home,{recursive:true,force:true})}
});

// No synthetic token is copied to Pi. The catalog is not an entitlement claim.
test('declared bridge loads with pinned Pi 1.3 and writes a provider-qualified native default', async () => {
  const home = await mkdtemp(join(tmpdir(), 'pi-claude-models-'));
  try {
    const listed = run(home, 'list');
    assert.equal(listed.code, 0);
    const models = listed.result.models.filter(m => m.provider === 'claude-bridge');
    assert.ok(models.some(m => m.id === 'claude-fable-5-1'));
    assert.ok(models.every(m => !/-20\d{6}$/.test(m.id)));
    const model = models.find(m => m.id === 'claude-fable-5-1');
    const selected = run(home, 'select', model.id, model.thinking_levels[0], 'claude-bridge');
    assert.equal(selected.code, 0);
    assert.equal(selected.result.default_provider, 'claude-bridge');
    assert.equal(selected.result.default_model, model.id);
    const settings = JSON.parse(await readFile(join(home,'.pi/agent/settings.json'),'utf8'));
    assert.equal(settings.defaultProvider, 'claude-bridge');
    const cli = spawnSync(process.execPath, [join(pkg,'dist/bundle/cli.js'),'--list-models','claude-bridge'],
      {env:{HOME:home,PATH:process.env.PATH,PI_OFFLINE:'1'},encoding:'utf8',timeout:12000});
    assert.equal(cli.status,0,cli.stderr);
    assert.match(cli.stdout,/claude-fable-5-1/);
    assert.deepEqual(JSON.parse(await readFile(join(home,'.pi/agent/auth.json'),'utf8')), {});
    await assert.rejects(readFile(join(home,'.claude/.credentials.json')), {code:'ENOENT'});
  } finally { await rm(home,{recursive:true,force:true}); }
});

test('installed bridge settings survive generation pruning and selection never pins a release', async () => {
  const home = await mkdtemp(join(tmpdir(), 'bridge-generation-'));
  try {
    const installation = join(home, 'installation');
    const runtime = join(installation, 'generations/current-release/payloads/core/runtime');
    await mkdir(runtime, {recursive: true});
    await symlink(join(here, 'node_modules'), join(runtime, 'node_modules'));
    await symlink(runtime, join(installation, 'core'));
    const runtimePkg = join(runtime, 'node_modules/@earendil-works/pi-coding-agent');
    const stable = join(installation, 'core/node_modules/pi-claude-bridge/src/index.ts');
    const old = join(installation, 'generations/pruned-release/payloads/core/runtime/node_modules/pi-claude-bridge/src/index.ts');
    const dir = join(home, '.pi/agent');
    await mkdir(dir, {recursive: true});
    const custom = join(home, 'custom/pi-claude-bridge/src/index.ts');
    const initial = {theme: 'dark', defaultProvider: 'openai', defaultModel: 'personal-default', extensions: [custom, old, stable, old]};
    await writeFile(join(dir, 'settings.json'), JSON.stringify(initial));
    if (process.getuid() !== 0) {
      await chmod(join(dir, 'settings.json'), 0o444);
      const readonly = run(home, 'list', '', '', '', runtimePkg);
      assert.equal(readonly.code, 0);
      assert.deepEqual(JSON.parse(await readFile(join(dir, 'settings.json'))), initial);
      const model = readonly.result.models.find(m => m.provider === 'claude-bridge');
      assert.equal(run(home, 'select', model.id, model.thinking_levels[0], 'claude-bridge', runtimePkg).code, 1);
      await chmod(join(dir, 'settings.json'), 0o600);
    }
    const listed = run(home, 'list', '', '', '', runtimePkg);
    assert.equal(listed.code, 0);
    const repaired = JSON.parse(await readFile(join(dir, 'settings.json')));
    assert.deepEqual(repaired, {...initial, extensions: [custom, stable]});
    const bytes = await readFile(join(dir, 'settings.json'), 'utf8');
    assert.equal(run(home, 'initialize-claude', '', '', '', runtimePkg).code, 0);
    assert.equal(await readFile(join(dir, 'settings.json'), 'utf8'), bytes);
    // A new selection has no legacy path to migrate.
    await writeFile(join(dir, 'settings.json'), JSON.stringify({theme: 'dark'}));
    const model = listed.result.models.find(m => m.provider === 'claude-bridge');
    assert.equal(run(home, 'select', model.id, model.thinking_levels[0], 'claude-bridge', runtimePkg).code, 0);
    assert.deepEqual(JSON.parse(await readFile(join(dir, 'settings.json'))).extensions, [stable]);
    const cli = spawnSync(process.execPath, [join(pkg, 'dist/bundle/cli.js'), '--list-models', 'claude-bridge'],
      {env: {HOME: home, PATH: process.env.PATH, PI_OFFLINE: '1'}, encoding: 'utf8', timeout: 12000});
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /claude-fable-5-1/);
  } finally { await rm(home, {recursive: true, force: true}); }
});

test('pinned native Claude status recognizes only a synthetic default-store subscription', async () => {
  const home = await mkdtemp(join(tmpdir(), 'claude-native-status-'));
  try {
    const dir = join(home,'.claude'); await mkdir(dir,{mode:0o700});
    await writeFile(join(dir,'.credentials.json'),JSON.stringify({claudeAiOauth:{accessToken:'SYNTHETIC-NOT-A-TOKEN',refreshToken:'SYNTHETIC-ONLY',expiresAt:Date.now()+3600000,scopes:['user:inference','user:profile'],subscriptionType:'pro',rateLimitTier:'default_claude_ai'}}),{mode:0o600});
    assert.equal(process.platform,'linux'); // this exercises the native Linux file store, not a host keychain
    const native = spawnSync(join(here,`node_modules/@anthropic-ai/claude-agent-sdk-linux-${process.arch}/claude`), ['auth','status','--json'],
      {env:{HOME:home,PATH:'/usr/bin:/bin',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',DISABLE_TELEMETRY:'1'},encoding:'utf8',timeout:12000});
    assert.equal(native.status,0);
    const status=JSON.parse(native.stdout);
    assert.equal(status.loggedIn,true);
    assert.equal(status.authMethod,'claude.ai');
    assert.equal(status.email,null);
    assert.ok(!native.stdout.includes('SYNTHETIC-NOT-A-TOKEN'));
  } finally {await rm(home,{recursive:true,force:true})}
});
