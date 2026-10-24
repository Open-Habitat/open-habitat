// Private, bounded stdin/stdout protocol for the same-user daemon. No secrets
// on argv and no native exceptions on stdout/stderr. `verify` answers a fixed
// state for the stored grant; without arguments a grant is imported.
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
  if (Object.keys(request).sort().join(',') !== (verify ? 'address,client_id,tenant_id' : 'address,client_id,refresh_token,tenant_id')) throw Error('invalid_input');
  if (verify) {
    const state = await verifyGrant(request);
    // The tool's logger may hold the event loop open; exit once written.
    process.stdout.write(JSON.stringify({state}) + '\n', () => process.exit(0));
    await new Promise(() => {});
  }
  await importGrant(request);
  process.stdout.write('{"success":true}\n');
} catch (error) {
  process.stdout.write(JSON.stringify({success: false, reason: error?.message === 'account_mismatch' ? 'account_mismatch' : 'native_failed'}) + '\n');
  process.exitCode = 1;
}
