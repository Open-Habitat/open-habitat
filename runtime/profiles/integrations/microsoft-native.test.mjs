import { network } from './synthetic-entra.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

// All transport is synthetic; the pinned MSAL and MCP AuthManager/storage are
// real. Never accept a provider endpoint override in the production helper.
const client = '00000000-0000-0000-0000-000000000001';
const tenant = '00000000-0000-0000-0000-000000000002';
const root = await fs.mkdtemp(path.join(process.env.TMPDIR || '/var/tmp', 'oh-msal-'));
process.env.HOME = root;
process.env.MS365_MCP_LOG_DIR = path.join(root, 'logs');
process.env.MS365_MCP_USE_KEYTAR = 'false';
const { importGrant, verifyGrant, scopes } = await import('./microsoft-native.mjs');
const { default: AuthManager } = await import('@softeria/ms-365-mcp-server/dist/auth.js');
const { DefaultTokenCacheStorage, resetCacheKeyForTests } = await import('@softeria/ms-365-mcp-server/dist/token-cache-storage.js');

{
  const directory = path.join(root, 'work');
  await fs.mkdir(directory, {mode: 0o700});
  process.env.MS365_MCP_TOKEN_CACHE_PATH = path.join(directory, '.token-cache.json');
  process.env.MS365_MCP_SELECTED_ACCOUNT_PATH = path.join(directory, '.selected-account.json');
  resetCacheKeyForTests();
  const state = {polls: 0, refuse: false};
  const networkClient = network(tenant, state);
  const request = {client_id: client, tenant_id: tenant, address: 'person@example.test', refresh_token: 'synthetic-refresh-original', tool_options: {orgMode: true, enabledTools: '^(create-draft-email|send-mail|get-current-user)$', allowedScopes: scopes.join(' ')}};
  await importGrant(request, {networkClient});
  assert.ok(state.lastScope.split(' ').includes('https://graph.microsoft.com/.default'), 'import named permissions');
  const before = new Map();
  for (const name of ['.token-cache.json', '.cache-key', '.selected-account.json']) {
    const file = path.join(directory, name);
    assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
    before.set(name, await fs.readFile(file, 'utf8'));
  }
  assert.ok(!before.get('.token-cache.json').includes('synthetic-refresh'));
  await assert.rejects(importGrant({...request, address: 'other@example.test'}, {networkClient}), /account_mismatch/);
  state.refuse = true;
  await assert.rejects(importGrant(request, {networkClient}));
  state.refuse = false;
  // The identity read is required; any other permission may be missing.
  state.omitScope = 'User.Read';
  await assert.rejects(importGrant(request, {networkClient}), /missing_scopes/);
  delete state.omitScope;
  state.cancelled = true;
  await assert.rejects(importGrant(request, {networkClient}));
  state.cancelled = false;
  for (const [name, bytes] of before) assert.equal(await fs.readFile(path.join(directory, name), 'utf8'), bytes, 'failed replacement altered native credentials');
  const manager = new AuthManager({auth: {clientId: client, authority: `https://login.microsoftonline.com/${request.tenant_id}`}, system: {networkClient, loggerOptions: {loggerCallback() {}}}}, scopes, {expectedUsername: request.address}, new DefaultTokenCacheStorage());
  await manager.loadTokenCache();
  state.expectedRefresh = 'synthetic-refresh-1';
  const beforeRefresh = state.polls;
  assert.ok((await manager.getToken()).startsWith('synthetic-access-'));
  assert.equal(state.polls, beforeRefresh + 1, 'native tool did not silently refresh reloaded state');
  const reloaded = new AuthManager(manager.config, scopes, {expectedUsername: request.address}, new DefaultTokenCacheStorage());
  await reloaded.loadTokenCache();
  assert.ok((await reloaded.getToken()).startsWith('synthetic-access-'));
  assert.ok((await manager.getToken(true)).startsWith('synthetic-access-'), 'long-lived manager did not observe another native writer rotation');
  delete state.expectedRefresh;
  for (const audience of ['common', 'organizations', 'consumers']) await assert.rejects(importGrant({...request, tenant_id: audience}, {networkClient}), /invalid_input/);
  console.log('PASS work native import/reload/rotation/refusal');

  // verify: the tenant's answer becomes a fixed state from MSAL's codes.
  const graph = status => async (url, options) => {
    assert.equal(url, 'https://graph.microsoft.com/v1.0/me');
    assert.match(options.headers.Authorization, /^Bearer synthetic-access-/);
    return new Response('{}', {status});
  };
  // Access tokens now outlive the checks: a cached one must not answer.
  state.expiresIn = 3600;
  const stored = await fs.readFile(process.env.MS365_MCP_TOKEN_CACHE_PATH, 'utf8');
  const polls = state.polls;
  const verified = await verifyGrant(request, {networkClient}, graph(200));
  assert.equal(verified.state, 'ok');
  for (const scope of ['User.Read', 'Mail.Send']) assert.ok(verified.scopes.includes(scope), JSON.stringify(verified));
  assert.equal((await verifyGrant(request, {networkClient}, graph(200))).state, 'ok');
  assert.equal(state.polls, polls + 4, 'verify did not ask the tenant for both discovery and tool scopes');
  // A narrower grant is named as the tenant answered it.
  state.omitScope = 'Mail.Send';
  assert.equal((await verifyGrant({...request, tool_options: undefined}, {networkClient}, graph(200))).state, 'ok', 'alignment discovery must not require obsolete named scopes');
  assert.equal((await verifyGrant(request, {networkClient}, graph(200))).state, 'refused', 'discovery must not mask a refused tool acquisition');
  const narrower = await verifyGrant({...request, tool_options: {orgMode: true, enabledTools: '^(create-draft-email|get-current-user)$', allowedScopes: 'User.Read Mail.ReadWrite'}}, {networkClient}, graph(200));
  assert.equal(narrower.state, 'ok');
  assert.ok(!narrower.scopes.includes('Mail.Send') && narrower.scopes.includes('Mail.ReadWrite'), JSON.stringify(narrower));
  delete state.omitScope;
  assert.notEqual(await fs.readFile(process.env.MS365_MCP_TOKEN_CACHE_PATH, 'utf8'), stored, 'rotated grant not persisted in the native store');
  assert.equal((await verifyGrant(request, {networkClient}, graph(503))).state, 'unreachable');
  assert.equal((await verifyGrant(request, {networkClient}, async () => { throw Error('offline'); })).state, 'unreachable');
  const cases = [
    [{refuse: true}, 'refused'],
    [{refuse: true, codes: [700082]}, 'refused'],
    [{refuse: 'interaction_required', codes: [50076]}, 'refused'],
    [{refuse: 'invalid_client', codes: [700016]}, 'refused'],
    [{refuse: true, codes: [50020]}, 'outside_tenant'],
    [{refuse: true, codes: [90072]}, 'outside_tenant'],
    [{unavailable: true}, 'unreachable'],
    // MSAL picks its interaction-required class from description text too.
    [{unavailable: true, description: 'synthetic outage; login_required'}, 'unreachable'],
    [{cancelled: true}, 'unreachable'],
  ];
  for (const [answer, expected] of cases) {
    Object.assign(state, answer);
    assert.deepEqual(await verifyGrant(request, {networkClient}, graph(200)), {state: expected}, JSON.stringify(answer));
    for (const key of Object.keys(answer)) delete state[key];
  }
  // The grant still works once the tenant answers again.
  assert.equal((await verifyGrant(request, {networkClient}, graph(200))).state, 'ok');
  assert.equal((await verifyGrant({...request, address: 'other@example.test'}, {networkClient}, graph(200))).state, 'refused');
  await assert.rejects(verifyGrant({...request, tenant_id: 'common'}, {networkClient}, graph(200)), /invalid_input/);
  // An idle native child has already read the key. Reconnect imports into a
  // fresh directory/process, then publishes that entire directory, as Go does.
  // No real tenant or wall-clock expiry is involved.
  state.expiresIn = 1;
  await importGrant(request, {networkClient});
  const old = new AuthManager(manager.config, scopes, {expectedUsername: request.address}, new DefaultTokenCacheStorage());
  await old.loadTokenCache();
  const oldAccount = await old.getCurrentAccount();
  const stage = path.join(root, 'reconnect');
  await fs.mkdir(stage, {mode: 0o700});
  const childEnv = {...process.env, MS365_MCP_TOKEN_CACHE_PATH: path.join(stage, '.token-cache.json'), MS365_MCP_SELECTED_ACCOUNT_PATH: path.join(stage, '.selected-account.json')};
  const imports = `import {importGrant} from ${JSON.stringify(new URL('./microsoft-native.mjs', import.meta.url).href)}; import {network} from ${JSON.stringify(new URL('./synthetic-entra.mjs', import.meta.url).href)};`;
  execFileSync(process.execPath, ['--input-type=module', '-e', imports + `await importGrant(${JSON.stringify(request)}, {networkClient: network(${JSON.stringify(tenant)}, {polls: 1000})});`], {env: childEnv, timeout: 15000, stdio: 'pipe'});
  const previous = path.join(root, 'previous');
  await fs.rename(directory, previous);
  await fs.rename(stage, directory);
  state.expectedRefresh = 'synthetic-refresh-1001';
  // Force the next native tool acquisition through MSAL rather than its token
  // shortcut. The old child cannot decrypt the replacement with its old key.
  await assert.rejects(old.msalApp.acquireTokenSilent({account: oldAccount, scopes, forceRefresh: true}), /invalid_grant/);
  // A fresh child (what the slot now guarantees after publication) reads the
  // new key and rotates the new grant. Another fresh process must consume that
  // rotation rather than the original token.
  const freshCode = imports + `import AuthManager from '@softeria/ms-365-mcp-server/dist/auth.js'; import {DefaultTokenCacheStorage} from '@softeria/ms-365-mcp-server/dist/token-cache-storage.js'; const state = {polls: 2000, expectedRefresh: 'synthetic-refresh-1001'}; const m = new AuthManager({auth: {clientId: ${JSON.stringify(client)}, authority: 'https://login.microsoftonline.com/${tenant}'}, system: {networkClient: network(${JSON.stringify(tenant)}, state), loggerOptions: {loggerCallback(){}}}}, ${JSON.stringify(scopes)}, {expectedUsername: ${JSON.stringify(request.address)}}, new DefaultTokenCacheStorage()); await m.loadTokenCache(); if (!(await m.getToken()).startsWith('synthetic-access-')) throw Error('no token');`;
  execFileSync(process.execPath, ['--input-type=module', '-e', freshCode], {cwd: path.dirname(new URL(import.meta.url).pathname), env: process.env, timeout: 15000, stdio: 'pipe'});
  execFileSync(process.execPath, ['--input-type=module', '-e', freshCode.replace("polls: 2000, expectedRefresh: 'synthetic-refresh-1001'", "polls: 3000, expectedRefresh: 'synthetic-refresh-2001'")], {cwd: path.dirname(new URL(import.meta.url).pathname), env: process.env, timeout: 15000, stdio: 'pipe'});
  console.log('PASS reconnect reproduces stale key; restarted native children consume rotation');
  process.env.MS365_MCP_TOKEN_CACHE_PATH = path.join(root, 'missing', '.token-cache.json');
  process.env.MS365_MCP_SELECTED_ACCOUNT_PATH = path.join(root, 'missing', '.selected-account.json');
  assert.equal((await verifyGrant(request, {networkClient}, graph(200))).state, 'refused');
  // Exercise the real private CLI parser, not just the exported function. With
  // no cache it must refuse before network access, not reject our wire shape.
  const {refresh_token, ...probe} = request;
  const cli = input => spawnSync(process.execPath, [new URL('./microsoft-native-cli.mjs', import.meta.url).pathname, 'verify'], {input: JSON.stringify(input), env: process.env, encoding: 'utf8', timeout: 15000});
  const valid = cli(probe);
  assert.equal(valid.status, 0, valid.stderr);
  assert.deepEqual(JSON.parse(valid.stdout), {state: 'refused'});
  for (const tool_options of [null, [], {orgMode: true}, {...probe.tool_options, allowedScopes: 5}, {...probe.tool_options, unexpected: true}]) {
    const bad = cli({...probe, tool_options});
    assert.equal(bad.status, 1);
    assert.deepEqual(JSON.parse(bad.stdout), {success: false, reason: 'native_failed'});
  }
  console.log('PASS work native verify states and private CLI wire shape');
}
await fs.rm(root, {recursive: true});
