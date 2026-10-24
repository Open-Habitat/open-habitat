// Test-only entry point. Not included in the sealed profile.
import { importGrant } from './microsoft-native.mjs';
import { network } from './synthetic-entra.mjs';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
await importGrant(request, {networkClient: network(request.tenant_id)});
process.stdout.write('{"success":true}\n');
