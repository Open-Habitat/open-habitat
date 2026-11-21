import { test } from 'node:test';
import assert from 'node:assert/strict';
import companion, { askPermission, permissionApiKey, permissionBlock, permissionPrefix, permissionQuestion, permissionReasons } from '../process-extension.mjs';

const question = {
  action: 'Delete the mail folder ‘Invoices 2024’',
  consequence: 'The folder and its 37 messages are removed.',
  account: { provider: 'Microsoft', address: 'person@example.test' },
  call: { area: 'ms-admin', tool: 'delete-mail-folder', arguments: { mailFolderId: 'AAMkExample' } },
};
const ui = answer => {
  const asked = [];
  return { asked, ctx: { hasUI: true, signal: undefined, ui: { confirm: async (title, message, opts) => { asked.push({ title, message, opts }); return typeof answer === 'function' ? answer(opts) : answer; } } } };
};

test('the question travels as one prefixed confirm and only a yes allows', async () => {
  const yes = ui(true);
  assert.deepEqual(await askPermission(yes.ctx, question), { allowed: true });
  assert.equal(yes.asked.length, 1);
  assert.ok(yes.asked[0].title.startsWith(permissionPrefix));
  assert.deepEqual(JSON.parse(yes.asked[0].title.slice(permissionPrefix.length)), { ...question, call: { ...question.call, arguments: '{"mailFolderId":"AAMkExample"}' } });
  assert.equal(yes.asked[0].message, question.action);
  for (const answer of [false, undefined, 'true', 1]) {
    assert.deepEqual(await permissionBlock(ui(answer).ctx, question), { block: true, reason: permissionReasons.denied });
  }
  assert.equal(await permissionBlock(ui(true).ctx, question), undefined);
  const failing = { hasUI: true, ui: { confirm: async () => { throw new Error('closed'); } } };
  assert.equal((await askPermission(failing, question)).allowed, false);
});

test('no UI and a malformed question block without asking', async () => {
  assert.deepEqual(await askPermission({ hasUI: false, ui: { confirm: async () => true } }, question), { allowed: false, reason: permissionReasons.noBrowser });
  assert.deepEqual(await askPermission(undefined, question), { allowed: false, reason: permissionReasons.noBrowser });
  for (const bad of [null, {}, { ...question, action: '  ' }, { ...question, consequence: 3 }, { ...question, call: { area: 'x' } }, { ...question, account: { provider: 'Microsoft' } }]) {
    const asking = ui(true);
    assert.deepEqual(await askPermission(asking.ctx, bad), { allowed: false, reason: permissionReasons.invalid });
    assert.equal(asking.asked.length, 0);
  }
});

test('the turn signal goes with the question, so Stop answers it as not allowed', async () => {
  const controller = new AbortController();
  const asking = ui(opts => new Promise(resolve => opts.signal.addEventListener('abort', () => resolve(false))));
  asking.ctx.signal = controller.signal;
  const pending = askPermission(asking.ctx, question);
  controller.abort();
  assert.equal((await pending).allowed, false);
});

test('the parts are normalised to the contract bounds', () => {
  const q = permissionQuestion({ ...question, action: 'a\nb c ' + 'ä'.repeat(400), call: { area: 'x', tool: 'y', arguments: 'line\n\tnext\u0007' } });
  assert.equal([...q.action].length, 300);
  assert.ok(q.action.startsWith('a b c '));
  assert.ok(q.action.endsWith('…'));
  assert.equal(q.call.arguments, 'line\n\tnext');
  assert.equal(permissionQuestion({ ...question, account: undefined }).account, undefined);
});

test('loading the companion registers the API for other extensions', () => {
  delete globalThis[permissionApiKey];
  const previous = process.env.OH_PROCESS_SOCKET;
  delete process.env.OH_PROCESS_SOCKET;
  try {
    companion({ on() {}, appendEntry() {}, registerTool() {}, registerCommand() {}, events: { on() {}, emit() {} } });
  } catch { /* Registration comes first; the rest needs a full Pi. */ }
  if (previous !== undefined) process.env.OH_PROCESS_SOCKET = previous;
  const api = globalThis[permissionApiKey];
  assert.equal(api.ask, askPermission);
  assert.equal(api.block, permissionBlock);
  assert.ok(Object.isFrozen(api));
});
