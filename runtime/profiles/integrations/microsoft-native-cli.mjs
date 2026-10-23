// Private, bounded stdin/stdout protocol for the same-user daemon. No secrets
// on argv and no native exceptions on stdout/stderr.
import { importGrant } from './microsoft-native.mjs';
let input = '';
try {
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input) > 65536) throw Error('invalid_input');
  }
  const request = JSON.parse(input);
  if (Object.keys(request).sort().join(',') !== 'address,client_id,refresh_token,tenant_id') throw Error('invalid_input');
  await importGrant(request);
  process.stdout.write('{"success":true}\n');
} catch (error) {
  process.stdout.write(JSON.stringify({success: false, reason: error?.message === 'account_mismatch' ? 'account_mismatch' : 'native_failed'}) + '\n');
  process.exitCode = 1;
}
