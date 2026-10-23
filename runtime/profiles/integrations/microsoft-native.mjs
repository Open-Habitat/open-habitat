// Same-UID private protocol adapter, not a credential broker. The caller owns
// staging/publication; only the pinned tool's native encrypted stores are written.
import { PublicClientApplication } from '@azure/msal-node';
import { DefaultTokenCacheStorage, wrapCache, unwrapCache } from '@softeria/ms-365-mcp-server/dist/token-cache-storage.js';

export const scopes = ['User.Read', 'Mail.ReadWrite', 'Mail.Send', 'Calendars.ReadWrite', 'Contacts.ReadWrite'];

export function application(clientId, tenant, system = {}) {
  return new PublicClientApplication({
    auth: { clientId, authority: `https://login.microsoftonline.com/${tenant}` },
    system: { ...system, loggerOptions: { loggerCallback() {}, piiLoggingEnabled: false } },
  });
}

export async function importGrant({client_id, tenant_id, address, refresh_token}, system = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(client_id) ||
      !/^(common|consumers|organizations|[0-9a-f-]{36})$/i.test(tenant_id) ||
      typeof address !== 'string' || !address || typeof refresh_token !== 'string' || !refresh_token) throw Error('invalid_input');
  const app = application(client_id, tenant_id, system);
  // MSAL, not host code, creates the account/refresh records and owns rotation.
  const result = await app.acquireTokenByRefreshToken({ refreshToken: refresh_token, scopes, forceCache: true });
  if (!result?.account || result.account.username.toLowerCase() !== address.toLowerCase()) throw Error('account_mismatch');
  const granted = new Set(result.scopes.map(scope => scope.replace(/^https:\/\/graph\.microsoft\.com\//i, '').toLowerCase()));
  if (scopes.some(scope => !granted.has(scope.toLowerCase()))) throw Error('missing_scopes');
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
