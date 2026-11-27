// Private, bounded stdin/stdout protocol for the same-user daemon. No secrets
// on argv and no native exceptions on stdout/stderr. `verify` answers a fixed
// state, and with ok the granted scopes, for the stored grant; without arguments a grant is imported
// and the account MSAL recorded for it is answered by its immutable identifiers.
import { importGrant, verifyGrant } from './microsoft-native.mjs';
const verify = process.argv.length === 3 && process.argv[2] === 'verify';
let input = '';
try {
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input) > 65536) throw Error('invalid_input');
  }
  if (process.argv.length > 2 && !verify) throw Error('invalid_input');
  const request = JSON.parse(input);
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw Error('invalid_input');
  const keys = Object.keys(request).filter(key => !(verify && key === 'tool_options')).sort().join(',');
  const shapes = verify ? ['address,client_id,tenant_id', 'client_id,home_account_id,tenant_id'] : ['client_id,refresh_token,tenant_id'];
  if (!shapes.includes(keys)) throw Error('invalid_input');
  if (verify && request.tool_options !== undefined) {
    const options = request.tool_options;
    if (!options || typeof options !== 'object' || Object.keys(options).sort().join(',') !== 'allowedScopes,enabledTools,orgMode' ||
        typeof options.orgMode !== 'boolean' || typeof options.enabledTools !== 'string' || typeof options.allowedScopes !== 'string') throw Error('invalid_input');
  }
  if (verify) {
    const answer = await verifyGrant(request);
    // The tool's logger may hold the event loop open; exit once written.
    process.stdout.write(JSON.stringify(answer) + '\n', () => process.exit(0));
    await new Promise(() => {});
  }
  const account = await importGrant(request);
  process.stdout.write(JSON.stringify({success: true, account}) + '\n');
} catch (error) {
  process.stdout.write(JSON.stringify({success: false, reason: error?.message === 'account_mismatch' ? 'account_mismatch' : 'native_failed'}) + '\n');
  process.exitCode = 1;
}
