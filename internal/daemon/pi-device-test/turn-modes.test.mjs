// ADR 0038 turn modes against the pinned Pi: the companion's tool_call guard
// with a hostile handler before it and an indifferent one after it, Pi's own
// codemode for nested calls, parallel batches, the owner's per-call approval,
// revocation during a run (also with the revoke message lost), a restart
// between a participant's message and a scheduled wake, and an extension's
// sendUserMessage after a participant's turn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { approvalPrefix, grantHolds, participantMessage, participantMessageType, releaseLineMessage, turnModeFromBranch, turnModeType, turnReasons, validParticipantMessage, validReleaseLine, waitingRequests } from '../process-extension.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const cli = resolve(here, 'node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js');
const companion = resolve(here, '../process-extension.mjs');
const fixtures = resolve(here, 'fixtures/turn-modes');

const subject = 'github:4242';
const stamp = () => new Date().toISOString();
const message = (extra = {}) => ({ message_id: randomUUID(), subject, display_name: 'Example Guest', role: 'participant', generation: 3, text: 'Please delete the build directory.', at: stamp(), ...extra });

// The scripted provider: each request gets the next reply the test queued.
// A reply is a list of tool calls ({name, args}) or a text; it may wait for
// a promise before it is sent, so the test can act between two calls.
function provider() {
  const queue = [], requests = [];
  const server = http.createServer((req, res) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', async () => {
      const body = JSON.parse(data);
      requests.push(body);
      const reply = queue.shift() ?? { text: 'Done.' };
      if (reply.wait) await reply.wait;
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const chunk = (delta, finish = null) => res.write(`data: ${JSON.stringify({ id: 'synthetic', object: 'chat.completion.chunk', created: 0, model: 'fixture-model', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);
      if (reply.calls) {
        chunk({ role: 'assistant', tool_calls: reply.calls.map((c, index) => ({ index, id: c.id ?? `call_${randomUUID().slice(0, 8)}`, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) });
        chunk({}, 'tool_calls');
      } else {
        chunk({ role: 'assistant', content: reply.text ?? 'Done.' });
        chunk({}, 'stop');
      }
      res.end('data: [DONE]\n\n');
    });
  });
  return { queue, requests, server, listen: () => new Promise(r => server.listen(0, '127.0.0.1', r)) };
}

// One Pi in RPC mode, as the daemon runs it, with the companion's bridge.
async function launch(t, f, { sessionId = randomUUID(), membersRecord } = {}) {
  const generation = randomUUID();
  const socket = join(f.root, `b-${generation.slice(0, 8)}.sock`);
  const child = spawn(process.execPath, [cli, '--mode', 'rpc', '--provider', 'fixture', '--model', 'fixture-model',
    '--session-dir', f.sessions, '--session-id', sessionId, '--tools', 'mark,codemode',
    '--extension', join(fixtures, 'fixture.mjs'), '--extension', join(fixtures, 'hostile-before.mjs'),
    '--extension', companion, '--extension', join(fixtures, 'hostile-after.mjs')], {
    cwd: f.cwd, stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      HOME: f.root, PATH: process.env.PATH, PI_CODING_AGENT_DIR: join(f.root, 'agent'), PI_OFFLINE: '1',
      FIXTURE_URL: f.url, MARK_FILE: f.marks, HOSTILE_LOG: f.hostile, OH_PROCESS_SOCKET: socket,
      OPEN_HABITAT_CONVERSATION_ID: `pi:${sessionId}`, OPEN_HABITAT_LAUNCH_GENERATION: generation,
      ...(membersRecord ? { OPEN_HABITAT_MEMBERS_RECORD: membersRecord } : {}),
    },
  });
  const events = [], waiters = new Set();
  let buffer = '', stderr = '';
  const answers = []; // queued answers for approval questions
  const questions = [];
  child.stderr.on('data', c => { stderr += c; });
  child.stdout.on('data', c => {
    buffer += c;
    let n;
    while ((n = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, n); buffer = buffer.slice(n + 1);
      let frame; try { frame = JSON.parse(line); } catch { continue; }
      events.push(frame);
      if (frame.type === 'extension_ui_request' && frame.method === 'select') {
        questions.push(frame);
        const value = answers.shift() ?? 'deny';
        child.stdin.write(JSON.stringify({ type: 'extension_ui_response', id: frame.id, value }) + '\n');
      }
      for (const w of waiters) w();
    }
  });
  const until = (predicate, label, ms = 20000) => new Promise((ok, fail) => {
    const check = () => { const found = events.find(predicate); if (found) { waiters.delete(check); clearTimeout(timer); ok(found); } };
    const timer = setTimeout(() => { waiters.delete(check); fail(new Error(`timed out waiting for ${label}\n${stderr.slice(-2000)}`)); }, ms);
    waiters.add(check); check();
  });
  let seq = 0;
  const rpc = async (command) => {
    const id = `req_${++seq}`;
    child.stdin.write(JSON.stringify({ ...command, id }) + '\n');
    return until(e => e.type === 'response' && e.id === id, command.type);
  };
  // Settled runs so far; waitSettled waits for the next one.
  const settledCount = () => events.filter(e => e.type === 'agent_settled').length;
  const waitSettled = async (before) => until(() => settledCount() > before, 'agent_settled');
  // goEscape writes the request as Go's encoding/json does (<, > and & as
  // \u003c and so on), the daemon's own encoding.
  const bridge = (request, { goEscape = false } = {}) => new Promise((ok, fail) => {
    const c = net.createConnection(socket);
    let data = '';
    c.on('error', fail);
    c.on('data', d => { data += d; });
    c.on('end', () => { try { ok(JSON.parse(data)); } catch (e) { fail(e); } });
    let line = JSON.stringify({ session_id: sessionId, generation, ...request });
    if (goEscape) line = line.replace(/[<>&]/g, ch => `\\u00${ch.charCodeAt(0).toString(16)}`);
    c.write(line + '\n');
  });
  await rpc({ type: 'get_state' });
  for (let i = 0; i < 100 && !existsSync(socket); i++) await new Promise(r => setTimeout(r, 50));
  const closed = new Promise(r => child.on('close', r));
  const stop = async () => { child.kill('SIGKILL'); await closed; };
  t.after(stop);
  return { child, events, rpc, until, bridge, settledCount, waitSettled, answers, questions, stop, sessionId };
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'oh-tm-'));
  const p = provider();
  await p.listen();
  const f = { root, cwd: join(root, 'work'), sessions: join(root, 'sessions'), marks: join(root, 'marks'), hostile: join(root, 'hostile'), url: `http://127.0.0.1:${p.server.address().port}/v1`, provider: p };
  await mkdir(f.cwd, { recursive: true });
  await mkdir(join(root, 'agent'), { recursive: true });
  await writeFile(f.marks, ''); await writeFile(f.hostile, '');
  t.after(async () => { p.server.close(); await rm(root, { recursive: true, force: true }); });
  return f;
}
const marks = async f => (await readFile(f.marks, 'utf8')).split('\n').filter(Boolean);
const hostileSaw = async f => (await readFile(f.hostile, 'utf8')).split('\n').filter(Boolean);
// The tool results of the latest provider request, as the model reads them.
const toolResults = body => body.messages.filter(m => m.role === 'tool').map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)));
const branchOf = (f, sessionId) => {
  const file = readdirSync(f.sessions, { recursive: true }).map(String).find(n => n.endsWith('.jsonl') && n.includes(sessionId));
  return readFileSync(join(f.sessions, file), 'utf8').trim().split('\n').map(l => JSON.parse(l));
};
const codemode = labels => ({ name: 'codemode', args: { code: labels.map(l => `await tools.mark({ label: ${JSON.stringify(l)} });`).join('\n') + '\nreturn "ok";' } });
const record = async (f, role, generation) => {
  const path = join(f.root, 'conversation-members.json');
  await writeFile(path, JSON.stringify({ schema_version: 1, generation, conversations: { [`pi:${f.sessionId}`]: { cwd: f.cwd, members: [{ subject, display_name: 'Example Guest', role, state: 'joined', generation, invited_at: stamp(), joined_at: stamp(), updated_at: stamp() }] } } }), { mode: 0o600 });
  return path;
};

test('a participant\'s turn blocks a parallel batch and nested codemode calls, whatever other handlers return', async t => {
  const f = await fixture(t);
  const pi = await launch(t, f);
  f.provider.queue.push({ calls: [{ name: 'mark', args: { label: 'batch-a' } }, { name: 'mark', args: { label: 'batch-b' } }, codemode(['nested-1', 'nested-2'])] });
  const before = pi.settledCount();
  assert.deepEqual((await pi.bridge({ op: 'participant_message', message: message() })).data, { delivered: true });
  await pi.waitSettled(before);
  assert.deepEqual(await marks(f), [], 'no call of the batch ran');
  assert.deepEqual(await hostileSaw(f), [], 'the handler after the companion never saw a blocked call');
  // terminate: the run ends after the blocked batch, with no further request.
  assert.equal(f.provider.requests.length, 1);
  const executed = pi.events.filter(e => e.type === 'tool_execution_end');
  assert.equal(executed.length, 3);
  assert.ok(executed.every(e => e.isError && JSON.stringify(e.result).includes('no tools')), JSON.stringify(executed));
  // A participant cannot start a run while one is in progress.
  f.provider.queue.push({ text: 'Owner answer.', wait: new Promise(r => setTimeout(r, 1500)) });
  const busyFrom = pi.settledCount();
  const mark = pi.events.length;
  await pi.rpc({ type: 'prompt', message: 'owner writes' });
  await pi.until(e => e.type === 'agent_start' && pi.events.indexOf(e) >= mark, 'owner run');
  assert.deepEqual((await pi.bridge({ op: 'participant_message', message: message() })).data, { delivered: false, reason: 'busy' });
  await pi.waitSettled(busyFrom);
  // The owner's own message gives tools back.
  f.provider.queue.push({ calls: [{ name: 'mark', args: { label: 'owner' } }] }, { text: 'Done.' });
  const ownerFrom = pi.settledCount();
  await pi.rpc({ type: 'prompt', message: 'owner asks for a mark' });
  await pi.waitSettled(ownerFrom);
  assert.deepEqual(await marks(f), ['owner']);
});

test('the longest participant message reaches the companion even as Go escapes it', async t => {
  const f = await fixture(t);
  const pi = await launch(t, f);
  f.provider.queue.push({ text: 'Read it.' });
  const from = pi.settledCount();
  const reply = await pi.bridge({ op: 'participant_message', message: message({ text: '<'.repeat(16000) }) }, { goEscape: true });
  assert.deepEqual(reply.data, { delivered: true });
  await pi.waitSettled(from);
});

test('an extension\'s sendUserMessage after a participant\'s turn keeps it text-only', async t => {
  const f = await fixture(t);
  const pi = await launch(t, f);
  f.provider.queue.push({ text: 'I would delete it.' });
  let from = pi.settledCount();
  await pi.bridge({ op: 'participant_message', message: message() });
  await pi.waitSettled(from);
  f.provider.queue.push({ calls: [{ name: 'mark', args: { label: 'from-extension' } }] });
  from = pi.settledCount();
  await pi.rpc({ type: 'prompt', message: '/ext-send' });
  await pi.waitSettled(from);
  assert.deepEqual(await marks(f), []);
  const blocked = pi.events.filter(e => e.type === 'tool_execution_end').at(-1);
  assert.ok(blocked?.isError && JSON.stringify(blocked.result).includes('no tools'), JSON.stringify(blocked));
  // The decision is in the branch, so a restart would read it the same way.
  assert.equal(turnModeFromBranch(branchOf(f, pi.sessionId)).mode, 'text_only');
});

test('a queued owner follow-up the owner cleared transfers nothing to a later extension message', async t => {
  const f = await fixture(t);
  const pi = await launch(t, f);
  // A shared conversation: a participant spoke first.
  f.provider.queue.push({ text: 'I would.' });
  let from = pi.settledCount();
  const request = message();
  await pi.bridge({ op: 'participant_message', message: request });
  await pi.waitSettled(from);
  // The owner's run; during it they queue a follow-up and clear it again.
  let go;
  f.provider.queue.push({ text: 'Owner answer.', wait: new Promise(r => { go = r; }) });
  from = pi.settledCount();
  const mark = pi.events.length;
  await pi.rpc({ type: 'prompt', message: 'owner writes' });
  await pi.until(e => e.type === 'agent_start' && pi.events.indexOf(e) >= mark, 'owner run');
  await pi.rpc({ type: 'follow_up', message: 'never mind' });
  await pi.rpc({ type: 'clear_queue' });
  go();
  await pi.waitSettled(from);
  // Another participant message, then an extension's user message.
  f.provider.queue.push({ text: 'I would too.' });
  from = pi.settledCount();
  const second = message({ text: 'And the cache.' });
  await pi.bridge({ op: 'participant_message', message: second });
  await pi.waitSettled(from);
  f.provider.queue.push({ text: 'Extension turn.' });
  from = pi.settledCount();
  await pi.rpc({ type: 'prompt', message: '/ext-send' });
  await pi.waitSettled(from);
  const branch = branchOf(f, pi.sessionId);
  assert.equal(turnModeFromBranch(branch).mode, 'text_only', 'a restart now would give no tools');
  assert.deepEqual(waitingRequests(branch).map(w => w.message_id), [second.message_id], 'the extension message settles no request');
});

test('a restart between a participant\'s message and a scheduled wake keeps the wake text-only', async t => {
  const f = await fixture(t);
  const sessionId = randomUUID();
  let pi = await launch(t, f, { sessionId });
  f.provider.queue.push({ text: 'I would delete it.' });
  let from = pi.settledCount();
  await pi.bridge({ op: 'participant_message', message: message() });
  await pi.waitSettled(from);
  await pi.stop();
  pi = await launch(t, f, { sessionId });
  f.provider.queue.push({ calls: [{ name: 'mark', args: { label: 'woken' } }] });
  from = pi.settledCount();
  const wake = { id: 'wk_0123456789abcdef', at: stamp(), set_at: stamp(), fired_at: stamp(), note: 'check the build' };
  const woke = await pi.bridge({ op: 'scheduled_wake', wake });
  assert.equal(woke.data.woken, true);
  await pi.waitSettled(from);
  assert.deepEqual(await marks(f), []);
  assert.deepEqual(await hostileSaw(f), []);
});

test('per-call approval asks about every call, nested ones too, one at a time, with the complete arguments', async t => {
  const f = await fixture(t);
  const pi = await launch(t, f);
  const request = message();
  f.provider.queue.push({ text: 'I would mark three things.' });
  let from = pi.settledCount();
  await pi.bridge({ op: 'participant_message', message: request });
  await pi.waitSettled(from);
  const line = { line_id: randomUUID(), kind: 'continue', mode: 'approve_each', request: request.message_id, subject, display_name: request.display_name, at: stamp() };
  // The codemode call itself, then its two nested calls: allow, allow, deny.
  f.provider.queue.push({ calls: [codemode(['nested-ok', 'nested-denied'])] }, { calls: [{ name: 'mark', args: { label: 'par-1' } }, { name: 'mark', args: { label: 'par-2\nsecond line' } }, { name: 'mark', args: { label: 'par-3' } }] }, { text: 'Done.' });
  pi.answers.push('allow', 'allow', 'deny', 'allow', 'allow_all');
  from = pi.settledCount();
  assert.deepEqual((await pi.bridge({ op: 'release', line })).data, { delivered: true });
  await pi.waitSettled(from);
  assert.deepEqual(await marks(f), ['nested-ok', 'par-1', 'par-2\nsecond line', 'par-3'].flatMap(l => l.split('\n')));
  const asked = pi.questions.map(q => JSON.parse(q.title.slice(approvalPrefix.length)));
  // codemode, nested-ok, nested-denied, par-1, par-2 (Salli kaikki lets par-3 go unasked).
  assert.equal(asked.length, 5, JSON.stringify(asked));
  assert.deepEqual(asked.map(q => q.tool), ['codemode', 'mark', 'mark', 'mark', 'mark']);
  assert.ok(asked[1].parent_call_id && asked[2].parent_call_id, 'nested calls are asked about with their parent');
  assert.equal(JSON.parse(asked[4].arguments).label, 'par-2\nsecond line', 'the arguments are complete, line breaks included');
  assert.ok(asked.every(q => q.request === request.message_id));
  assert.deepEqual(pi.questions.map(q => q.options), Array(5).fill(['allow', 'deny', 'allow_all']));
  // Each answer is a native entry, and Salli kaikki is recorded as the run's mode.
  const branch = branchOf(f, pi.sessionId);
  assert.deepEqual(branch.filter(e => e.type === 'custom' && e.customType === 'oh-approval').map(e => e.data.answer), ['allowed', 'allowed', 'denied', 'allowed', 'allow_all']);
  assert.equal(turnModeFromBranch(branch).mode, 'tools');
  assert.deepEqual(waitingRequests(branch), [], 'the release settled the request');
});

test('a release names only a waiting request; declining writes the line and starts no run', async t => {
  const f = await fixture(t);
  const pi = await launch(t, f);
  const first = message(), second = message({ text: 'And the cache too.' });
  for (const m of [first, second]) {
    f.provider.queue.push({ text: 'I would.' });
    const from = pi.settledCount();
    await pi.bridge({ op: 'participant_message', message: m });
    await pi.waitSettled(from);
  }
  assert.deepEqual(waitingRequests(branchOf(f, pi.sessionId)).map(w => w.message_id), [first.message_id, second.message_id]);
  const unknown = { line_id: randomUUID(), kind: 'continue', mode: 'tools', request: randomUUID(), subject, display_name: 'Example Guest', at: stamp() };
  assert.deepEqual((await pi.bridge({ op: 'release', line: unknown })).data, { delivered: false, reason: 'not_waiting' });
  const requests = f.provider.requests.length;
  const decline = { line_id: randomUUID(), kind: 'declined', request: first.message_id, subject, display_name: 'Example Guest', at: stamp() };
  assert.deepEqual((await pi.bridge({ op: 'release', line: decline })).data, { delivered: true });
  assert.deepEqual((await pi.bridge({ op: 'release', line: decline })).data, { delivered: true, reason: 'already_delivered' });
  assert.equal(f.provider.requests.length, requests, 'declining starts no run');
  // The owner's own message settles the newest waiting request only.
  f.provider.queue.push({ text: 'Owner answer.' });
  const from = pi.settledCount();
  await pi.rpc({ type: 'prompt', message: 'owner writes' });
  await pi.waitSettled(from);
  assert.deepEqual(waitingRequests(branchOf(f, pi.sessionId)), []);
});

for (const lost of [false, true]) {
  test(`taking full rights back during a run blocks its next call${lost ? ', even when the revoke message is lost' : ''}`, async t => {
    const f = await fixture(t);
    f.sessionId = randomUUID();
    const path = await record(f, 'full_rights', 5);
    const pi = await launch(t, f, { sessionId: f.sessionId, membersRecord: path });
    let go;
    const revoked = new Promise(r => { go = r; });
    f.provider.queue.push({ calls: [{ name: 'mark', args: { label: 'before' } }] }, { calls: [{ name: 'mark', args: { label: 'after' } }], wait: revoked }, { text: 'Done.' });
    const from = pi.settledCount();
    await pi.bridge({ op: 'participant_message', message: message({ role: 'full_rights', generation: 5 }) });
    await pi.until(e => e.type === 'tool_execution_end', 'first call');
    await record(f, 'participant', 6);
    if (!lost) assert.deepEqual((await pi.bridge({ op: 'grant', grant: { subject, role: 'participant', generation: 6, removed: false } })).data, { told: true });
    go();
    await pi.waitSettled(from);
    assert.deepEqual(await marks(f), ['before']);
    const last = pi.events.filter(e => e.type === 'tool_execution_end').at(-1);
    assert.ok(last.isError && JSON.stringify(last.result).includes('full rights away'), JSON.stringify(last));
  });
}

test('a full-rights message gets tools only while the record gives them; the record is read, not the message', async t => {
  const f = await fixture(t);
  f.sessionId = randomUUID();
  const path = await record(f, 'participant', 7);
  const pi = await launch(t, f, { sessionId: f.sessionId, membersRecord: path });
  f.provider.queue.push({ calls: [{ name: 'mark', args: { label: 'claimed' } }] });
  const from = pi.settledCount();
  // A message that claims full rights the record does not give.
  await pi.bridge({ op: 'participant_message', message: message({ role: 'full_rights', generation: 7 }) });
  await pi.waitSettled(from);
  assert.deepEqual(await marks(f), []);
});

test('web tools follow the grant as tool calls do, also when the revoke message was lost', async t => {
  const f = await fixture(t);
  f.sessionId = randomUUID();
  const path = await record(f, 'full_rights', 5);
  const handlers = {};
  const saved = process.env.OPEN_HABITAT_MEMBERS_RECORD;
  process.env.OPEN_HABITAT_MEMBERS_RECORD = path;
  t.after(() => { if (saved === undefined) delete process.env.OPEN_HABITAT_MEMBERS_RECORD; else process.env.OPEN_HABITAT_MEMBERS_RECORD = saved; });
  const { default: load } = await import('../process-extension.mjs');
  load({ on: (name, h) => { (handlers[name] ??= []).push(h); }, appendEntry() {}, registerTool() {}, registerCommand() {}, sendMessage() {}, events: { on() {}, emit() {} } });
  assert.equal(process.env.OPEN_HABITAT_MEMBERS_RECORD, undefined, 'the record path is not left for tools');
  const ctx = { sessionManager: { getBranch: () => [], getSessionId: () => f.sessionId }, cwd: f.cwd };
  const saved2 = process.env.OH_PROCESS_SOCKET;
  delete process.env.OH_PROCESS_SOCKET; // no bridge socket here
  for (const h of handlers.session_start) await h({}, ctx);
  if (saved2 !== undefined) process.env.OH_PROCESS_SOCKET = saved2;
  const api = globalThis[Symbol.for('open-habitat.turn-mode')];
  const event = { messageType: 'custom', message: participantMessage(message({ role: 'full_rights', generation: 5 })) };
  for (const h of handlers.before_agent_start) await h(event, ctx);
  assert.equal(api.webTools(), true, 'a full-rights run has its web tools');
  await record(f, 'participant', 6);
  assert.equal(api.webTools(), false, 'the record took them away; no message was needed');
  const verdict = await handlers.tool_call[0]({ toolName: 'mark', toolCallId: 'c1', input: {} }, ctx);
  assert.ok(verdict?.block && verdict.terminate, 'and the next call is blocked');
});

test('pure rules: messages, release lines, branch rebuild, waiting requests and the grant check', () => {
  const m = message();
  assert.ok(validParticipantMessage(m));
  for (const bad of [{ ...m, role: 'owner' }, { ...m, text: ' ' }, { ...m, text: 'x'.repeat(16001) }, { ...m, display_name: 'a\nb' }, { ...m, generation: 0 }, { ...m, subject: 'unix:1000' }])
    assert.equal(validParticipantMessage(bad), false, JSON.stringify(bad).slice(0, 80));
  const built = participantMessage({ ...m, text: '/skill:dangerous run rm -rf' });
  assert.equal(built.customType, participantMessageType);
  assert.ok(built.content.startsWith('[Open Habitat] "Example Guest"'), 'Habitat opens the message; the text cannot claim a role');
  assert.ok(built.content.endsWith('/skill:dangerous run rm -rf'));
  const line = { line_id: randomUUID(), kind: 'continue', mode: 'tools', request: m.message_id, subject, display_name: 'Example Guest', at: stamp() };
  assert.ok(validReleaseLine(line));
  assert.equal(validReleaseLine({ ...line, kind: 'declined' }), false, 'a decline names no mode');
  assert.equal(validReleaseLine({ ...line, mode: 'text_only' }), false);
  assert.equal(releaseLineMessage(line).details.mode, 'tools');
  const user = { type: 'message', message: { role: 'user', content: 'x' } };
  const pmsg = (role = 'participant', id = m.message_id) => ({ type: 'custom_message', customType: participantMessageType, details: { role, message_id: id, subject } });
  const entry = (mode, by, covers = 0) => ({ type: 'custom', customType: turnModeType, data: { schema_version: 1, mode, by, covers } });
  assert.deepEqual(turnModeFromBranch([]), { mode: 'tools', shared: false });
  assert.equal(turnModeFromBranch([user, pmsg()]).mode, 'text_only');
  assert.equal(turnModeFromBranch([pmsg(), user]).mode, 'tools', 'a terminal turn is the owner\'s');
  assert.equal(turnModeFromBranch([pmsg(), entry('text_only', 'kept', 1), user]).mode, 'text_only', 'an extension\'s user message keeps the mode');
  assert.equal(turnModeFromBranch([entry('tools', 'participant'), pmsg('full_rights')]).mode, 'text_only', 'full rights are not rebuilt from history');
  assert.equal(turnModeFromBranch([pmsg(), { type: 'custom_message', customType: 'oh-conversation-line', details: { kind: 'continue', mode: 'approve_each' } }]).mode, 'approve_each');
  assert.deepEqual(waitingRequests([pmsg('full_rights')]), [], 'a full-rights message is no waiting request');
  const a = randomUUID(), b = randomUUID();
  assert.deepEqual(waitingRequests([pmsg('participant', a), pmsg('participant', b), user]).map(w => w.message_id), [a], 'the owner settles the newest');
  const read = role => () => JSON.stringify({ schema_version: 1, conversations: { 'pi:x': { members: [{ subject, role, state: 'joined', generation: 9 }] } } });
  assert.equal(grantHolds('/r', 'pi:x', subject, 9, read('full_rights')), true);
  assert.equal(grantHolds('/r', 'pi:x', subject, 8, read('full_rights')), false, 'any change since the run began');
  assert.equal(grantHolds('/r', 'pi:x', subject, 9, read('participant')), false);
  assert.equal(grantHolds('/r', 'pi:x', subject, 9, () => { throw new Error('gone'); }), false, 'an unreadable record fails closed');
  assert.equal(grantHolds(null, 'pi:x', subject, 9, read('full_rights')), false);
  assert.match(turnReasons.textOnly, /no tools/);
});
