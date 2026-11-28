import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import companion, { permissionPrefix, permissionReasons } from '../process-extension.mjs';
import hook, { describe, guardedTools, parseTool, readEntry } from '../microsoft-permission.mjs';

// The account, folder and people are synthetic.
const address = 'aino.virtanen@contoso.test';

function home(t, relayReply) {
  const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'ms-perm-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.pi', 'agent'), { recursive: true });
  const relay = join(dir, 'relay');
  // A stand-in for `open-habitat mcp-relay`: answers initialize and one
  // tools/call with relayReply, and records how it was started.
  writeFileSync(relay, `#!${process.execPath}
const fs = require('node:fs');
fs.appendFileSync(${JSON.stringify(join(dir, 'relay-runs'))}, JSON.stringify(process.argv.slice(2)) + '\\n');
let buf = '';
process.stdin.on('data', (c) => {
  buf += c;
  let i;
  while ((i = buf.indexOf('\\n')) >= 0) {
    const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
    if (m.method === 'initialize') process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'x' } } }) + '\\n');
    if (m.method === 'tools/call') {
      fs.appendFileSync(${JSON.stringify(join(dir, 'relay-calls'))}, JSON.stringify(m.params) + '\\n');
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: JSON.stringify(${JSON.stringify(relayReply ?? null)}) }] } }) + '\\n');
    }
  }
});
`, { mode: 0o700 });
  const entry = (area) => ({ command: relay, args: ['mcp-relay', 'microsoft', '--account', address, '--area', area], env: {}, description: 'x' });
  writeFileSync(join(dir, '.pi', 'agent', 'mcp.json'), JSON.stringify({ mcpServers: { 'ms-admin': entry('admin'), 'ms-mail': entry('mail'), 'ms-files': entry('files'), 'other': { command: '/bin/true' } } }));
  return dir;
}

function loaded() {
  const handlers = {};
  // Loading the companion registers the permission API, as in a browser
  // conversation.
  companion({ on() {}, appendEntry() {}, registerTool() {}, registerCommand() {}, events: { on() {}, emit() {} } });
  hook({ on: (name, fn) => { if (name === 'tool_call') handlers.hook = fn; } });
  return { hook: handlers.hook };
}

const ui = (answer) => {
  const asked = [];
  return { asked, ctx: { hasUI: true, ui: { confirm: async (title) => { asked.push(JSON.parse(title.slice(permissionPrefix.length))); return answer; } } } };
};

test('Pi tool names map to the area entry and the Microsoft tool', () => {
  assert.deepEqual(parseTool('mcp__ms_admin__delete_mail_folder'), { server: 'ms-admin', prefix: 'ms', area: 'admin', tool: 'delete-mail-folder' });
  assert.deepEqual(parseTool('mcp__ms2_calendar__cancel_calendar_event'), { server: 'ms2-calendar', prefix: 'ms2', area: 'calendar', tool: 'cancel-calendar-event' });
  for (const other of ['bash', 'mcp__mine__delete_mail_folder', 'mcp__ms_other__x', 'mcp__habitat_microsoft_x__send_mail', undefined]) {
    assert.equal(parseTool(other), null);
  }
  for (const t of guardedTools) assert.match(t, /^(delete-|send-|reply-|forward-|cancel-calendar-event$|create-my-calendar-permission$|update-my-calendar-permission$|share-drive-item$|create-drive-item-share-link$)/);
});

test('the entry is read only when it is a Habitat relay entry', (t) => {
  const dir = home(t);
  assert.deepEqual(readEntry('ms-admin', dir), { command: join(dir, 'relay'), account: address });
  assert.equal(readEntry('other', dir), null);
  assert.equal(readEntry('ms2-files', dir), null);
});

test('a deletion asks with the looked-up name and count, and no is a block', async (t) => {
  const dir = home(t, { value: [{ id: 'AAMkOther', displayName: 'Muut' }, { id: 'AAMkExample', displayName: 'Laskut 2024', totalItemCount: 37, childFolderCount: 0 }] });
  const saved = process.env.HOME;
  process.env.HOME = dir;
  t.after(() => { process.env.HOME = saved; });
  const { hook } = loaded();
  const no = ui(false);
  const result = await hook({ toolName: 'mcp__ms_admin__delete_mail_folder', input: { mailFolderId: 'AAMkExample' } }, no.ctx);
  assert.deepEqual(result, { block: true, reason: permissionReasons.denied });
  assert.equal(no.asked.length, 1);
  assert.deepEqual(no.asked[0], {
    action: 'Poista postikansio ’Laskut 2024’',
    consequence: 'Kansio, sen 37 viestiä poistetaan postilaatikosta.',
    account: { provider: 'Microsoft', address },
    call: { area: 'ms-admin', tool: 'delete-mail-folder', arguments: '{"mailFolderId":"AAMkExample"}' },
  });
  // The lookup was one read through the account's admin area.
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'relay-runs'), 'utf8').trim()), ['mcp-relay', 'microsoft', '--account', address, '--area', 'admin']);
  assert.equal(JSON.parse(readFileSync(join(dir, 'relay-calls'), 'utf8').trim()).name, 'list-mail-folders');
  const yes = ui(true);
  assert.equal(await hook({ toolName: 'mcp__ms_admin__delete_mail_folder', input: { mailFolderId: 'AAMkExample' } }, yes.ctx), undefined);
});

test('a failed lookup names the item by its ID', async (t) => {
  const dir = home(t, null);
  const saved = process.env.HOME;
  process.env.HOME = dir;
  t.after(() => { process.env.HOME = saved; });
  const { hook } = loaded();
  const no = ui(false);
  await hook({ toolName: 'mcp__ms_mail__delete_mail_message', input: { messageId: 'AAMkMsg' } }, no.ctx);
  assert.equal(no.asked[0].action, 'Poista viesti (tunniste AAMkMsg)');
  assert.equal(no.asked[0].account.address, address);
});

test('without a browser the call is blocked and nothing is looked up', async (t) => {
  const dir = home(t, { value: [] });
  const saved = process.env.HOME;
  process.env.HOME = dir;
  t.after(() => { process.env.HOME = saved; });
  const { hook } = loaded();
  const result = await hook({ toolName: 'mcp__ms_admin__delete_calendar', input: { calendarId: 'c1' } }, { hasUI: false });
  assert.deepEqual(result, { block: true, reason: permissionReasons.noBrowser });
  assert.equal(existsSync(join(dir, 'relay-runs')), false);
});

test('file deletion and sharing require approval for the same account and exact call', async (t) => {
  const dir = home(t, { name: 'Budget', folder: { childCount: 3 } });
  const saved = process.env.HOME;
  process.env.HOME = dir;
  t.after(() => { process.env.HOME = saved; });
  const { hook } = loaded();
  for (const tool of ['delete-onedrive-file', 'share-drive-item', 'create-drive-item-share-link']) {
    const input = { driveId: 'drive-A', driveItemId: 'item-B', body: { scope: 'anonymous', type: 'edit', recipients: [{ email: 'person@example.test' }], roles: ['write'], sendInvitation: true } };
    const event = { toolName: `mcp__ms_files__${tool.replaceAll('-', '_')}`, input };
    const denied = ui(false);
    assert.deepEqual(await hook(event, denied.ctx), { block: true, reason: permissionReasons.denied });
    assert.equal(denied.asked.length, 1);
    assert.equal(denied.asked[0].account.address, address);
    assert.deepEqual(denied.asked[0].call, { area: 'ms-files', tool, arguments: JSON.stringify(input) });
    assert.ok(denied.asked[0].action.includes('Budget'));
    assert.equal(await hook(event, ui(true).ctx), undefined);
    assert.deepEqual(await hook(event, { hasUI: false }), { block: true, reason: permissionReasons.noBrowser });
  }
  const calls = readFileSync(join(dir, 'relay-calls'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(calls.length, 6); // no lookup when no browser can answer
  for (const call of calls) assert.deepEqual(call, { name: 'get-drive-item', arguments: { driveId: 'drive-A', driveItemId: 'item-B', select: 'name,folder' } });
});

test('other calls pass untouched', async () => {
  const { hook } = loaded();
  const asking = ui(false);
  for (const name of ['mcp__ms_files__search_query', 'mcp__ms_files__upload_file_content', 'mcp__ms_files__create_upload_session', 'mcp__ms_files__create_onedrive_folder', 'mcp__ms_files__move_rename_onedrive_item', 'mcp__ms_files__copy_drive_item', 'mcp__ms_mail__create_draft_email', 'mcp__ms_admin__list_mail_folders', 'bash']) {
    assert.equal(await hook({ toolName: name, input: {} }, asking.ctx), undefined);
  }
  assert.equal(asking.asked.length, 0);
});

test('every guarded call reads as plain words, with lookups or without', async () => {
  const reads = {
    'get-drive-item': { name: 'Budget', folder: { childCount: 3 } },
    'get-mail-message': { subject: 'Tarjous', from: { emailAddress: { name: 'Ville' } }, toRecipients: [{ emailAddress: { name: 'Ville' } }], ccRecipients: [{ emailAddress: { address: 'liisa@contoso.test' } }] },
    'get-calendar-event': { subject: 'Palaveri', start: { dateTime: '2026-11-24T10:00:00' }, attendees: [{}, {}, {}], isOrganizer: true },
    'get-specific-calendar-event': { subject: 'Palaveri', start: { dateTime: '2026-11-24T10:00:00' }, attendees: [], isOrganizer: false },
    'get-outlook-contact': { displayName: 'Ville Virtanen' },
    'list-mail-attachments': { value: [{ id: 'a1', name: 'lasku.pdf' }] },
    'list-contact-folders': { value: [{ id: 'f1', displayName: 'Asiakkaat' }] },
    'list-calendars': { value: [{ id: 'c1', name: 'Perhe' }] },
    'list-focused-inbox-overrides': { value: [{ id: 'o1', senderEmailAddress: { address: 'uutiset@example.test' } }] },
    'list-my-calendar-permissions': { value: [{ id: 'p1', emailAddress: { name: 'Ville' } }] },
    'list-mail-folders': { value: [{ id: 'm1', displayName: 'Laskut', totalItemCount: 2, childFolderCount: 1 }] },
  };
  const inputs = {
    'delete-onedrive-file': { driveId: 'd', driveItemId: 'f' },
    'share-drive-item': { driveId: 'd', driveItemId: 'f', body: { recipients: [{ email: 'person@example.test' }], roles: ['write'], sendInvitation: true } },
    'create-drive-item-share-link': { driveId: 'd', driveItemId: 'f', body: { type: 'edit', scope: 'anonymous' } },
    'delete-mail-message': { messageId: 'x' }, 'delete-mail-attachment': { messageId: 'x', attachmentId: 'a1' },
    'send-mail': { body: { Message: { subject: 'Hei', toRecipients: [{ emailAddress: { address: 'ville@contoso.test' } }] } } },
    'send-draft-message': { messageId: 'x' }, 'reply-mail-message': { messageId: 'x', body: {} }, 'reply-all-mail-message': { messageId: 'x', body: {} },
    'forward-mail-message': { messageId: 'x', body: { ToRecipients: [{ emailAddress: { address: 'a@b.test' } }, { emailAddress: { name: 'Bea' } }] } },
    'delete-calendar-event': { eventId: 'e' }, 'delete-specific-calendar-event': { calendarId: 'c', eventId: 'e' }, 'cancel-calendar-event': { eventId: 'e', body: {} },
    'forward-calendar-event': { eventId: 'e', body: { ToRecipients: [{ emailAddress: { address: 'a@b.test' } }] } },
    'delete-outlook-contact': { contactId: 'k' }, 'delete-mail-folder': { mailFolderId: 'm1' }, 'delete-focused-inbox-override': { inferenceClassificationOverrideId: 'o1' },
    'delete-calendar': { calendarId: 'c1' }, 'create-my-calendar-permission': { body: { emailAddress: { name: 'Ville', address: 'ville@contoso.test' }, role: 'read' } },
    'update-my-calendar-permission': { calendarPermissionId: 'p1', body: { role: 'write' } }, 'delete-my-calendar-permission': { calendarPermissionId: 'p1' },
    'delete-contact-folder': { contactFolderId: 'f1' },
  };
  assert.deepEqual(new Set(Object.keys(inputs)), guardedTools);
  for (const tool of guardedTools) {
    const looked = await describe(tool, inputs[tool], async (_area, name) => reads[name] ?? null);
    const blind = await describe(tool, inputs[tool], async () => null);
    for (const d of [looked, blind]) {
      assert.ok(d.action && d.consequence && !d.action.startsWith('Microsoft-kutsu'), `${tool}: ${JSON.stringify(d)}`);
      assert.ok(!/undefined|null|\[object/.test(d.action + d.consequence), `${tool}: ${JSON.stringify(d)}`);
    }
  }
  assert.equal((await describe('cancel-calendar-event', inputs['cancel-calendar-event'], async (_a, n) => reads[n])).consequence, 'Peruutus lähtee heti 3 osallistujalle, ja tapahtuma poistuu kalenterista.');
  assert.equal((await describe('create-my-calendar-permission', inputs['create-my-calendar-permission'], async () => null)).action, 'Jaa kalenterisi henkilölle Ville');
  assert.equal((await describe('forward-mail-message', inputs['forward-mail-message'], async (_a, n) => reads[n])).consequence, 'Viesti lähtee heti 2 vastaanottajalle: a@b.test, Bea.');
  // The pinned server moves a deleted message to Deleted Items, even one already there.
  assert.equal((await describe('delete-mail-message', inputs['delete-mail-message'], async (_a, n) => reads[n])).consequence, 'Viesti lähettäjältä Ville siirtyy Poistetut-kansioon, josta sen voi palauttaa.');
});
