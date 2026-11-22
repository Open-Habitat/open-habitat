// Run by TestMicrosoftMCPToolsPinnedServer against the patched pinned runtime.
// The Graph client is a fake: no credentials, network or tenant is involved.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const [runtime, enabledTools] = process.argv.slice(2);
const { registerGraphTools } = await import(pathToFileURL(join(runtime, 'node_modules/@softeria/ms-365-mcp-server/dist/graph-tools.js')));
const calls = [];
const tools = new Map();
registerGraphTools({
  server: { _requestHandlers: new Map() },
  registerTool(name, config, run) { tools.set(name, { config, run }); },
}, {
  serialize: JSON.stringify,
  async graphRequest(path, options) {
    calls.push({ path, options });
    return { content: [{ type: 'text', text: JSON.stringify(path.endsWith('/createUploadSession') ? { uploadUrl: 'https://upload.example.test/session' } : { id: 'saved-item' }) }] };
  },
}, { orgMode: true, enabledTools, allowedScopes: 'Files.ReadWrite.All Sites.ReadWrite.All' });
async function invoke(name, args) {
  const tool = tools.get(name);
  assert.ok(tool, name);
  const result = await tool.run(tool.config.inputSchema.parse(args));
  assert.ok(!result.isError, JSON.stringify(result));
  return result;
}
await invoke('upload-file-content', { driveId: 'drive-A', driveItemId: 'existing-item', body: Buffer.from('synthetic bytes').toString('base64'), confirm: true });
assert.equal(calls[0].path, '/drives/drive-A/items/existing-item/content');
assert.equal(calls[0].options.method, 'PUT');
assert.ok(Buffer.isBuffer(calls[0].options.body));
assert.equal(calls[0].options.body.toString(), 'synthetic bytes');
const body = { item: { '@microsoft.graph.conflictBehavior': 'fail' } };
const session = await invoke('create-upload-session', { driveId: 'drive-A', driveItemId: 'parent-item:/new file.txt:', body, confirm: true });
// This verifies the pinned adapter's serialization, not Graph's path parser.
assert.equal(decodeURIComponent(calls[1].path), '/drives/drive-A/items/parent-item:/new file.txt:/createUploadSession');
assert.equal(calls[1].options.method, 'POST');
assert.deepEqual(JSON.parse(calls[1].options.body), body);
assert.equal(JSON.parse(session.content[0].text).uploadUrl, 'https://upload.example.test/session');
assert.equal(calls.length, 2); // creating a session does not send the file bytes
for (const [name, method, suffix, body] of [
  ['create-onedrive-folder', 'POST', '/children', { name: 'Reports', folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }],
  ['move-rename-onedrive-item', 'PATCH', '', { name: 'Renamed.txt', parentReference: { id: 'new-parent' } }],
  ['copy-drive-item', 'POST', '/copy', { name: 'Copy.txt', parentReference: { driveId: 'drive-B', id: 'target-parent' } }],
]) {
  await invoke(name, { driveId: 'drive-A', driveItemId: 'item-B', body, confirm: true });
  const call = calls.at(-1);
  assert.equal(call.path, '/drives/drive-A/items/item-B' + suffix);
  assert.equal(call.options.method, method);
  assert.deepEqual(JSON.parse(call.options.body), body);
}
console.log('Pinned file write adapters: synthetic request checks passed');
