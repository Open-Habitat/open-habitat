// Test-only entry point. Not included in the sealed profile.
import { importGrant } from './microsoft-native.mjs';
import { network } from './synthetic-entra.mjs';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
const tenant = request.tenant_id === 'consumers' ? '9188040d-6c67-4c5b-b112-36a304b66dad' : '00000000-0000-0000-0000-000000000002';
await importGrant(request, {networkClient: network(tenant)});
process.stdout.write('{"success":true}\n');
