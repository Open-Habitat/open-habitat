// Same-UID private protocol adapter, not a credential broker. The caller owns
// staging/publication; only the pinned tool's native encrypted stores are written.
import { AuthError, PublicClientApplication } from '@azure/msal-node';
import AuthManager from '@softeria/ms-365-mcp-server/dist/auth.js';
import { DefaultTokenCacheStorage, wrapCache, unwrapCache } from '@softeria/ms-365-mcp-server/dist/token-cache-storage.js';

export const scopes = ['User.Read', 'Mail.ReadWrite', 'Mail.Send', 'Calendars.ReadWrite', 'Contacts.ReadWrite'];
// What the tenant consented to the application, never a permission it did
// not: naming one would fail the whole request when an organisation granted
// less. The tenant's answer names the grant; the daemon reads it from there.
const granted = ['https://graph.microsoft.com/.default'];
const graphName = scope => scope.replace(/^https:\/\/graph\.microsoft\.com\//i, '');

export function application(clientId, tenant, system = {}) {
  return new PublicClientApplication({
    auth: { clientId, authority: `https://login.microsoftonline.com/${tenant}` },
    system: { ...system, loggerOptions: { loggerCallback() {}, piiLoggingEnabled: false } },
  });
}

function validate({client_id, tenant_id, address}) {
  if (!/^[0-9a-f-]{36}$/i.test(client_id) ||
      // Single tenant: the organisation's Directory (tenant) ID, never an audience keyword.
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenant_id) ||
      typeof address !== 'string' || !address) throw Error('invalid_input');
}

export async function importGrant({client_id, tenant_id, address, refresh_token}, system = {}) {
  validate({client_id, tenant_id, address});
  if (typeof refresh_token !== 'string' || !refresh_token) throw Error('invalid_input');
  const app = application(client_id, tenant_id, system);
  // MSAL, not host code, creates the account/refresh records and owns rotation.
  const result = await app.acquireTokenByRefreshToken({ refreshToken: refresh_token, scopes: granted, forceCache: true });
  if (!result?.account || result.account.username.toLowerCase() !== address.toLowerCase()) throw Error('account_mismatch');
  // The tool needs the identity read; any other scope may be missing.
  if (!result.scopes.some(scope => graphName(scope).toLowerCase() === 'user.read')) throw Error('missing_scopes');
  const accounts = await app.getTokenCache().getAllAccounts();
  if (accounts.length !== 1 || accounts[0].homeAccountId !== result.account.homeAccountId) throw Error('account_mismatch');
  const storage = new DefaultTokenCacheStorage();
  await storage.save('token-cache', wrapCache(app.getTokenCache().serialize()));
  await storage.save('selected-account', wrapCache(JSON.stringify({accountId: result.account.homeAccountId})));
  // Fail closed if the encrypted native store cannot be loaded by a fresh MSAL
  // instance. The daemon publishes this directory only after its own checks.
  const reloaded = application(client_id, tenant_id, system);
  const raw = await storage.load('token-cache');
  reloaded.getTokenCache().deserialize(unwrapCache(raw).data);
  const loaded = await reloaded.getTokenCache().getAllAccounts();
  if (loaded.length !== 1 || loaded[0].homeAccountId !== result.account.homeAccountId) throw Error('native_reload_failed');
}

// The tenant refused the grant: these codes, never the error's text, decide.
// (MSAL's InteractionRequiredAuthError class is also chosen by matching the
// error description, so the class alone is not a code.) The user is not in
// the tenant's directory (AADSTS50020, 50034) or must first be invited into
// it as a guest (90072); a new sign-in cannot help.
const outsideTenant = new Set(['50020', '50034', '90072']);
const refusals = new Set([
  'invalid_grant', 'interaction_required', 'consent_required', 'login_required', 'bad_token',
  'invalid_client', 'unauthorized_client', 'access_denied',
  // MSAL's own: the store holds no usable refresh token.
  'no_tokens_found', 'refresh_token_expired',
]);

function classify(error) {
  if (!(error instanceof AuthError)) return 'unreachable';
  if (outsideTenant.has(String(error.errorNo ?? ''))) return 'outside_tenant';
  if (refusals.has(error.errorCode)) return 'refused';
  // Network, discovery, temporarily_unavailable and 5xx decide nothing.
  return 'unreachable';
}

// The pinned tool's --verify-login reports every silent-acquisition failure
// as the same text. This runs a refresh through the tool's own
// AuthManager and store, so a rotated refresh token is persisted exactly as
// the tool would, and answers with a fixed code: ok, refused, outside_tenant
// or unreachable. With ok it also names the scopes of the tenant's answer.
export async function verifyGrant({client_id, tenant_id, address}, system = {}, graph = fetch) {
  validate({client_id, tenant_id, address});
  const manager = new AuthManager({
    auth: { clientId: client_id, authority: `https://login.microsoftonline.com/${tenant_id}` },
    system: { ...system, loggerOptions: { loggerCallback() {}, piiLoggingEnabled: false } },
  }, scopes, {expectedUsername: address}, new DefaultTokenCacheStorage());
  let account;
  try {
    // A store that is missing, unreadable or holds another account only a
    // new sign-in replaces.
    await manager.loadTokenCache();
    account = (await manager.msalApp.getTokenCache().getAllAccounts()).find(a => a.username?.toLowerCase() === address.toLowerCase());
  } catch {
    return {state: 'refused'};
  }
  if (!account) return {state: 'refused'};
  let result;
  try {
    // Always asked of the tenant: a cached access token proves nothing about
    // the grant, and after a tenant change it is the previous tenant's.
    result = await manager.msalApp.acquireTokenSilent({account, scopes: granted, forceRefresh: true});
  } catch (error) {
    return {state: classify(error)};
  }
  // As the tool's own check: a token is not a reachable mailbox.
  try {
    const response = await graph('https://graph.microsoft.com/v1.0/me', {headers: {Authorization: `Bearer ${result.accessToken}`}, signal: AbortSignal.timeout(15000)});
    if (!response.ok) return {state: 'unreachable'};
  } catch {
    return {state: 'unreachable'};
  }
  const names = (result.scopes ?? []).map(graphName).filter(scope => /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(scope)).slice(0, 64);
  return {state: 'ok', scopes: names};
}
