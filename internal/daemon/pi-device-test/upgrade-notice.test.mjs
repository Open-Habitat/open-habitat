import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import companion, { branchFacts, catchUpMessage, upgradeNoticeMessage, upgradeNoticeType, validUpgradeNotice } from '../process-extension.mjs';

const now = Date.parse('2026-11-23T12:00:00Z');
const notice = { schedule_id: 'a'.repeat(32), revision: 1, version: '0.9.0', announced_at: '2026-11-23T12:00:00Z', deadline: '2026-11-23T12:02:00Z' };

test('the announcement tells the agent what the stop does to it, from the daemon\'s fields', () => {
  assert.ok(validUpgradeNotice(notice));
  const m = upgradeNoticeMessage(notice, 'busy', [], now);
  assert.equal(m.customType, upgradeNoticeType);
  assert.match(m.content, /^\[Open Habitat\] Habitat will be upgraded to 0\.9\.0\. In about 2 minutes, at 12:02 UTC, Habitat stops this conversation's Pi/);
  for (const fact of [/process-tool logs are lost/, /Files under \/tmp are deleted/, /XDG_RUNTIME_DIR=\/run\/user\/\$\(id -u\) systemd-run --user --unit=<name> <command>/, /Do not push, merge or call work finished just\s+because of the deadline|Do not push, merge or call work finished just because of the deadline/, /Habitat starts you again on its own with a second message/])
    assert.match(m.content, fact);
  assert.deepEqual(m.details, { schema_version: 1, schedule_id: notice.schedule_id, revision: 1, version: '0.9.0', deadline: notice.deadline, variant: 'busy' });
  const idle = upgradeNoticeMessage(notice, 'idle', [{ id: 'proc_aaaa', name: 'dev server', command: 'npm run dev' }], now + 90000);
  assert.match(idle.content, /In about 1 minute, at/);
  assert.match(idle.content, /will be killed at the stop:\n- proc_aaaa "dev server": npm run dev/);
  assert.deepEqual(idle.details.processes, [{ id: 'proc_aaaa', name: 'dev server' }]);
  for (const bad of [{ ...notice, schedule_id: 'x' }, { ...notice, revision: 0 }, { ...notice, version: '../x' }, { ...notice, deadline: '2026-11-23T14:00:00Z' }, { ...notice, deadline: '2026-11-23T11:00:00Z' }])
    assert.equal(validUpgradeNotice(bad), false, JSON.stringify(bad));
});

function ask(path, q) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(path);
    socket.setTimeout(6000, () => socket.destroy(new Error('timeout')));
    let input = '';
    socket.on('connect', () => socket.write(JSON.stringify(q) + '\n'));
    socket.on('error', reject);
    socket.on('data', b => { input += b; const n = input.indexOf('\n'); if (n >= 0) { resolve(JSON.parse(input.slice(0, n))); socket.destroy(); } });
  });
}

const launchEnv = ['OH_PROCESS_SOCKET', 'OPEN_HABITAT_STOP_CAUSE', 'OPEN_HABITAT_STOPPED_AT', 'OPEN_HABITAT_STOP_DETAIL', 'OPEN_HABITAT_CONVERSATION_ID', 'OPEN_HABITAT_LAUNCH_GENERATION'];
async function withCompanion(env, body) {
  const previous = Object.fromEntries(launchEnv.map(k => [k, process.env[k]]));
  for (const k of launchEnv) delete process.env[k];
  const directory = await mkdtemp(join(tmpdir(), 'oh-upgrade-notice-test-'));
  const path = join(directory, 'p.sock');
  Object.assign(process.env, { OH_PROCESS_SOCKET: path, OPEN_HABITAT_CONVERSATION_ID: 'pi:s1', OPEN_HABITAT_LAUNCH_GENERATION: 'g1', ...env });
  try { await body(path); } finally {
    for (const k of launchEnv) previous[k] === undefined ? delete process.env[k] : process.env[k] = previous[k];
    await rm(directory, { recursive: true, force: true });
  }
}

function fakePi({ idle, processes = [] }) {
  const hooks = new Map(), sent = [], branch = [];
  const pi = {
    on: (k, f) => hooks.set(k, f),
    events: { on() {}, emit(channel, q) { if (channel === 'processes:request:list') q.reply(processes); } },
    sendMessage: (m, o) => { sent.push([m, o]); branch.push({ type: 'custom_message', ...m }); },
  };
  companion(pi);
  const ctx = { cwd: undefined, isIdle: () => idle.value, sessionManager: { _persist() {}, getBranch: () => branch, getSessionId: () => 's1' } };
  return { hooks, sent, branch, ctx };
}

test('a running turn is steered once; reconnects and rereads do not repeat it', () => withCompanion({}, async path => {
  const idle = { value: false };
  const { hooks, sent, ctx } = fakePi({ idle });
  await hooks.get('session_start')({}, ctx);
  const future = { ...notice, announced_at: new Date(Date.now()).toISOString(), deadline: new Date(Date.now() + 120000).toISOString() };
  const tell = (extra = {}) => ask(path, { op: 'upgrade_notice', session_id: 's1', generation: 'g1', notice: future, ...extra });
  assert.deepEqual((await tell({ generation: 'g0' })).data, { outcome: 'not_delivered', reason: 'conversation_mismatch' });
  assert.equal((await tell({ notice: { ...future, revision: 'x' } })).error, 'invalid_request');
  assert.deepEqual((await tell()).data, { outcome: 'told', variant: 'busy' });
  assert.deepEqual(sent.map(([m, o]) => [m.details.variant, o]), [['busy', { deliverAs: 'steer' }]]);
  assert.deepEqual((await tell()).data, { outcome: 'told' });
  assert.equal(sent.length, 1, 'told once per schedule revision');
  // A new revision of the schedule is told again.
  assert.deepEqual((await tell({ notice: { ...future, revision: 2 } })).data, { outcome: 'told', variant: 'busy' });
  hooks.get('session_shutdown')();
}));

test('an idle agent is woken only when it has processes to lose; otherwise it hears at its next turn before the deadline', () => withCompanion({}, async path => {
  const idle = { value: true };
  const running = [{ id: 'proc_aaaa', name: 'build', command: 'make', status: 'running', startTime: 1 }];
  {
    const { hooks, sent, ctx } = fakePi({ idle, processes: running });
    await hooks.get('session_start')({}, ctx);
    const future = { ...notice, announced_at: new Date().toISOString(), deadline: new Date(Date.now() + 120000).toISOString() };
    assert.deepEqual((await ask(path, { op: 'upgrade_notice', session_id: 's1', generation: 'g1', notice: future })).data, { outcome: 'told', variant: 'idle' });
    assert.deepEqual(sent[0][1], { triggerTurn: true });
    assert.match(sent[0][0].content, /proc_aaaa "build": make/);
    hooks.get('session_shutdown')();
  }
}));

test('nothing to lose: no turn is started, a turn the person starts in time is steered, and a withdrawal or the deadline drops it', () => withCompanion({}, async path => {
  const idle = { value: true };
  const { hooks, sent, ctx } = fakePi({ idle });
  await hooks.get('session_start')({}, ctx);
  const future = { ...notice, announced_at: new Date().toISOString(), deadline: new Date(Date.now() + 120000).toISOString() };
  const tell = () => ask(path, { op: 'upgrade_notice', session_id: 's1', generation: 'g1', notice: future });
  assert.deepEqual((await tell()).data, { outcome: 'held' });
  assert.equal(sent.length, 0, 'an idle agent with nothing running is not woken');
  hooks.get('agent_start')({});
  assert.deepEqual(sent.map(([m, o]) => [m.details.variant, o]), [['busy', { deliverAs: 'steer' }]]);
  assert.deepEqual((await tell()).data, { outcome: 'told' }, 'the daemon learns it was given');
  hooks.get('agent_start')({});
  assert.equal(sent.length, 1);
  const other = { ...future, schedule_id: 'b'.repeat(32) };
  assert.deepEqual((await ask(path, { op: 'upgrade_notice', session_id: 's1', generation: 'g1', notice: other })).data, { outcome: 'held' });
  assert.deepEqual((await ask(path, { op: 'upgrade_notice_withdraw', session_id: 's1', generation: 'g1', schedule_id: other.schedule_id })).data, { outcome: 'withdrawn' });
  hooks.get('agent_start')({});
  assert.equal(sent.length, 1, 'a withdrawn schedule is not told');
  const late = { ...future, schedule_id: 'c'.repeat(32), announced_at: new Date(Date.now() - 180000).toISOString(), deadline: new Date(Date.now() - 1000).toISOString() };
  assert.deepEqual((await ask(path, { op: 'upgrade_notice', session_id: 's1', generation: 'g1', notice: late })).data, { outcome: 'not_delivered', reason: 'deadline_passed' });
  hooks.get('session_shutdown')();
}));

test('a turn the restart cut is woken with its own catch-up, and only then', () => {
  const said = (role, extra = {}) => ({ type: 'message', message: { role, ...extra } });
  const prompt = said('user'), call = said('assistant', { stopReason: 'toolUse' }), result = said('toolResult'), answer = said('assistant', { stopReason: 'stop' });
  const mark = { type: 'custom', customType: 'oh-restart-stop', data: { schema_version: 1 } }, aborted = said('assistant', { stopReason: 'aborted' });
  assert.equal(branchFacts([prompt, call, mark, result, aborted]).restartCut, true, 'saved as aborted after the mark');
  assert.equal(branchFacts([prompt, call, mark]).restartCut, true, 'Pi died before saving anything after the mark');
  assert.equal(branchFacts([prompt, call, result, answer]).restartCut, false, 'a finished turn');
  assert.equal(branchFacts([prompt, call]).restartCut, false, 'a crash leaves no mark');
  assert.equal(branchFacts([prompt, aborted]).restartCut, false, 'the person\'s stop');
  assert.equal(branchFacts([prompt, call, mark, aborted, { type: 'custom_message', customType: 'oh-resume-catch-up', details: {} }, answer]).restartCut, false, 'already woken and finished');
  const stopped = { cause: 'restart', at: '2026-11-23T12:03:10Z' };
  const none = { settled: [], rearm: [], available: true };
  const m = catchUpMessage([], none, stopped, true, 'turn_cut', '0.9.0');
  assert.match(m.content, /^\[Open Habitat\] This conversation's Pi stopped at 2026-11-23T12:03:10Z when Habitat's server restarted \(Habitat now runs 0\.9\.0\)\. The turn you were working on was cut off/);
  assert.match(m.content, /If the work was already done, say so in one line and stop\./);
  assert.match(m.content, /The process tool's list is\s+now empty|The process tool's list is now empty/);
  assert.deepEqual([m.details.woke, m.details.interrupted_turn, m.details.version], ['turn_cut', true, '0.9.0']);
  const withProcess = catchUpMessage([{ id: 'proc_aaaa', name: 'tests', command: 'go test ./...', startTime: 1 }], none, stopped, true, 'turn_cut', 'bad version!');
  assert.match(withProcess.content, /  - proc_aaaa "tests": go test \.\/\.\.\./);
  assert.doesNotMatch(withProcess.content, /now runs/);
  assert.equal(catchUpMessage([], none, stopped, false, 'turn_cut', '0.9.0'), null, 'no cut turn, no such wake');
  assert.equal(catchUpMessage([], none, { ...stopped, cause: 'crash' }, true, 'turn_cut', '0.9.0'), null, 'only a restart');
});
