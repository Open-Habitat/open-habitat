import assert from 'node:assert/strict';
const scopes = ['User.Read', 'Mail.ReadWrite', 'Mail.Send', 'Calendars.ReadWrite', 'Contacts.ReadWrite'];
const client = '00000000-0000-0000-0000-000000000001';
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
export function network(tenant, state = {polls: 0}) {
  return {
    async sendGetRequestAsync(url) {
      const body = url.includes('/discovery/instance') ? {
        tenant_discovery_endpoint: `https://login.microsoftonline.com/${tenant}/v2.0/.well-known/openid-configuration`,
        metadata: [{ preferred_network: 'login.microsoftonline.com', preferred_cache: 'login.windows.net', aliases: ['login.microsoftonline.com', 'login.windows.net'] }],
      } : {
        authorization_endpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
        token_endpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
        end_session_endpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/logout`,
        issuer: `https://login.microsoftonline.com/${tenant}/v2.0`,
        jwks_uri: `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
      };
      return {headers: {}, status: 200, body};
    },
    async sendPostRequestAsync(url, options) {
      state.polls++;
      if (state.cancelled) throw Error("cancelled");
      const form = new URLSearchParams(options.body);
      assert.equal(form.get('grant_type'), 'refresh_token');
      assert.equal(form.get('client_id'), client);
      assert.ok(["refresh-secret", "synthetic-refresh-original"].includes(form.get("refresh_token")) || form.get("refresh_token").startsWith("synthetic-refresh"));
      for (const scope of scopes) assert.ok(form.get('scope').includes(scope));
      if (state.unavailable) return {headers: {}, status: 503, body: {error: 'temporarily_unavailable', error_description: state.description ?? 'synthetic outage'}};
      if (state.refuse) return {headers: {}, status: 400, body: {error: state.refuse === true ? 'invalid_grant' : state.refuse, error_description: 'synthetic refusal', error_codes: state.codes ?? [70008]}};
      const now = Math.floor(Date.now()/1000);
      return {headers: {}, status: 200, body: {
        token_type: 'Bearer', scope: scopes.filter(scope => scope !== state.omitScope).join(' '), expires_in: state.expiresIn ?? 1,
        access_token: 'synthetic-access-' + state.polls, refresh_token: 'synthetic-refresh-' + state.polls,
        client_info: b64({uid: 'synthetic-user', utid: tenant}),
        id_token: b64({alg: 'none'}) + '.' + b64({aud: client, iss: `https://login.microsoftonline.com/${tenant}/v2.0`, iat: now, nbf: now, exp: now+3600, tid: tenant, oid: 'synthetic-user', sub: 'synthetic-user', preferred_username: 'person@example.test', name: 'Synthetic Person'}) + '.synthetic',
      }};
    },
  };
}
