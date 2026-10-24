import { network } from './synthetic-entra.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

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
  const request = {client_id: client, tenant_id: tenant, address: 'person@example.test', refresh_token: 'synthetic-refresh-original'};
  await importGrant(request, {networkClient});
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
  state.omitScope = 'Mail.Send';
  await assert.rejects(importGrant(request, {networkClient}), /missing_scopes/);
  delete state.omitScope;
  state.cancelled = true;
  await assert.rejects(importGrant(request, {networkClient}));
  state.cancelled = false;
  for (const [name, bytes] of before) assert.equal(await fs.readFile(path.join(directory, name), 'utf8'), bytes, 'failed replacement altered native credentials');
  const manager = new AuthManager({auth: {clientId: client, authority: `https://login.microsoftonline.com/${request.tenant_id}`}, system: {networkClient, loggerOptions: {loggerCallback() {}}}}, scopes, {expectedUsername: request.address}, new DefaultTokenCacheStorage());
  await manager.loadTokenCache();
  const beforeRefresh = state.polls;
  assert.ok((await manager.getToken()).startsWith('synthetic-access-'));
  assert.equal(state.polls, beforeRefresh + 1, 'native tool did not silently refresh reloaded state');
  const reloaded = new AuthManager(manager.config, scopes, {expectedUsername: request.address}, new DefaultTokenCacheStorage());
  await reloaded.loadTokenCache();
  assert.ok((await reloaded.getToken()).startsWith('synthetic-access-'));
  for (const audience of ['common', 'organizations', 'consumers']) await assert.rejects(importGrant({...request, tenant_id: audience}, {networkClient}), /invalid_input/);
  console.log('PASS work native import/reload/rotation/refusal');

  // verify: the tenant's answer becomes a fixed state from MSAL's codes.
  const graph = status => async (url, options) => {
    assert.equal(url, 'https://graph.microsoft.com/v1.0/me');
    assert.match(options.headers.Authorization, /^Bearer synthetic-access-/);
    return new Response('{}', {status});
  };
  const stored = await fs.readFile(process.env.MS365_MCP_TOKEN_CACHE_PATH, 'utf8');
  const polls = state.polls;
  assert.equal(await verifyGrant(request, {networkClient}, graph(200)), 'ok');
  assert.equal(state.polls, polls + 1, 'verify did not ask the tenant');
  assert.notEqual(await fs.readFile(process.env.MS365_MCP_TOKEN_CACHE_PATH, 'utf8'), stored, 'rotated grant not persisted in the native store');
  assert.equal(await verifyGrant(request, {networkClient}, graph(503)), 'unreachable');
  assert.equal(await verifyGrant(request, {networkClient}, async () => { throw Error('offline'); }), 'unreachable');
  const cases = [
    [{refuse: true}, 'refused'],
    [{refuse: true, codes: [700082]}, 'refused'],
    [{refuse: 'interaction_required', codes: [50076]}, 'refused'],
    [{refuse: 'invalid_client', codes: [700016]}, 'refused'],
    [{refuse: true, codes: [50020]}, 'outside_tenant'],
    [{refuse: true, codes: [90072]}, 'outside_tenant'],
    [{unavailable: true}, 'unreachable'],
    [{cancelled: true}, 'unreachable'],
  ];
  for (const [answer, expected] of cases) {
    Object.assign(state, answer);
    assert.equal(await verifyGrant(request, {networkClient}, graph(200)), expected, JSON.stringify(answer));
    for (const key of Object.keys(answer)) delete state[key];
  }
  // The grant still works once the tenant answers again.
  assert.equal(await verifyGrant(request, {networkClient}, graph(200)), 'ok');
  assert.equal(await verifyGrant({...request, address: 'other@example.test'}, {networkClient}, graph(200)), 'refused');
  await assert.rejects(verifyGrant({...request, tenant_id: 'common'}, {networkClient}, graph(200)), /invalid_input/);
  process.env.MS365_MCP_TOKEN_CACHE_PATH = path.join(root, 'missing', '.token-cache.json');
  process.env.MS365_MCP_SELECTED_ACCOUNT_PATH = path.join(root, 'missing', '.selected-account.json');
  assert.equal(await verifyGrant(request, {networkClient}, graph(200)), 'refused');
  console.log('PASS work native verify states');
}
await fs.rm(root, {recursive: true});
