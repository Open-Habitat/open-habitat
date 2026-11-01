import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import companion, { liveWaitRuns, remindedRuns, uncoveredRuns, waitReminder } from '../process-extension.mjs';

const ids = { a: '01m531x6y92ggdqcmb1exzmn10', b: '01m531x6y92ggdqcmb1exzmn11', c: '01m531x6y92ggdqcmb1exzmn12', foreign: '01m531x6y92ggdqcmb1exzmn13', asks: '01m531x6y92ggdqcmb1exzmn14' };
const run = (id, extra = {}) => ({ run_id: id, kind: 'spinoff', status: 'running', title: `t-${id.slice(-2)}`, created_at: `2026-10-27T10:00:${id.slice(-2)}Z`, source_repo: '/w', created_by_session: { harness: 'pi', session_id: 's1' }, created_by_run_id: null, ...extra });
const runs = [run(ids.a), run(ids.b), run(ids.foreign, { created_by_session: { harness: 'pi', session_id: 's2' } }), run(ids.asks, { attention_required: true }), run(ids.c, { status: 'done' })];
const start = (command, startTime = 1, notify = { onSuccess: 'turn', onFailure: 'turn' }) =>
  ({ type: 'message', message: { role: 'toolResult', toolName: 'process', details: { action: 'start', process: { id: 'proc_aaaa', name: 'wait', command, startTime }, notify } } });

test('only own live runs no waking wait covers, and a failed read says nothing', async () => {
  const read = async () => ({ runs });
  const all = await uncoveredRuns({ sessionId: 's1', cwd: '/w', waits: [], read });
  assert.deepEqual(all.map(r => r.run_id), [ids.a, ids.b], 'not another conversation\'s, an attention or a settled run');
  const one = await uncoveredRuns({ sessionId: 's1', cwd: '/w', waits: [`cd /w && taskfleet run wait ${ids.a} --check-in 45m --output json`], read });
  assert.deepEqual(one.map(r => r.run_id), [ids.b], 'the shared wait grammar decides coverage');
  assert.deepEqual(await uncoveredRuns({ sessionId: 's1', cwd: '/w', waits: [`taskfleet run wait ${ids.a} ${ids.b} --any --output json`], read }), []);
  assert.equal(await uncoveredRuns({ sessionId: 's1', cwd: '/w', waits: [], read: async () => null }), null);
  assert.deepEqual(await uncoveredRuns({ sessionId: 's1', cwd: '/w', waits: ['npm test'], read }), all);
  assert.equal(await uncoveredRuns({ sessionId: 's1', cwd: '/w', waits: ['taskfleet run wait $(cat active.txt)'], read }), null);
});

test('expanded waits use live argv, with bounded unknown rather than false coverage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'oh-expanded-wait-'));
  let child;
  try {
    const source = join(directory, 'wait.c'), binary = join(directory, 'taskfleet');
    await writeFile(source, '#include <unistd.h>\nint main(void) { sleep(30); return 0; }\n');
    execFileSync('cc', [source, '-o', binary]);
    await writeFile(join(directory, 'active.txt'), `${ids.a}\n`);
    const command = `"${binary}" run wait $(tr '\\n' ' ' < active.txt) --any; :`;
    child = spawn('/bin/sh', ['-c', command], { cwd: directory, detached: true, stdio: 'ignore' });
    // Wait for the shell to finish expanding and start the native executable.
    let observed;
    for (let n = 0; n < 100; n++) {
      observed = await liveWaitRuns(child.pid);
      if (observed?.length) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.deepEqual(observed, [ids.a]);
    const uncovered = await uncoveredRuns({ sessionId: 's1', cwd: directory, waits: [{ command, pid: child.pid }], read: async () => ({ runs }) });
    assert.deepEqual(uncovered.map(r => r.run_id), [ids.b], 'only the actually expanded id is covered');
    assert.equal(await liveWaitRuns(child.pid, { uid: process.getuid() + 1 }), null, 'foreign ownership is not read');
    assert.equal(await liveWaitRuns(-1), null);
    assert.equal(await uncoveredRuns({ sessionId: 's1', cwd: directory, waits: [{ command, pid: -1 }], read: async () => ({ runs }) }), null, 'unreadable expansion cannot claim nothing waits');
    // A single argv containing two IDs cannot be interpreted as two arguments.
    process.kill(-child.pid, 'SIGKILL'); await once(child, 'exit');
    child = spawn(binary, ['run', 'wait', `${ids.a} ${ids.b}`], { detached: true, stdio: 'ignore' });
    assert.equal(await liveWaitRuns(child.pid), null);
    process.kill(-child.pid, 'SIGKILL'); await once(child, 'exit');
    child = spawn(binary, ['run', 'wait', ids.a, 'x'.repeat(40000)], { detached: true, stdio: 'ignore' });
    assert.equal(await liveWaitRuns(child.pid), null, 'oversized argv is unknown');
    process.kill(-child.pid, 'SIGKILL'); await once(child, 'exit');
    child = spawn('/bin/sleep', ['30'], { detached: true, stdio: 'ignore' });
    assert.deepEqual(await liveWaitRuns(child.pid), [], 'a complete non-wait tree covers nothing');
    const notWaiting = await uncoveredRuns({ sessionId: 's1', cwd: directory, waits: [{ command: 'sleep 30', pid: child.pid }], read: async () => ({ runs }) });
    assert.deepEqual(notWaiting.map(r => r.run_id), [ids.a, ids.b]);
    assert.equal(await uncoveredRuns({ sessionId: 's1', cwd: directory, waits: [{ command, pid: child.pid }], read: async () => ({ runs }) }), null, 'a wait still expanding is unknown');
  } finally {
    if (child?.exitCode === null && child?.signalCode === null) { process.kill(-child.pid, 'SIGKILL'); await once(child, 'exit'); }
    await rm(directory, { recursive: true, force: true });
  }
});

test('a reminder once per uncovered set, again after a wait for it has returned', () => {
  const uncovered = [{ run_id: ids.a, title: 'one' }, { run_id: ids.b, title: 'two' }];
  const first = waitReminder(uncovered, remindedRuns([]));
  assert.equal(first.customType, 'oh-wait-reminder');
  assert.equal(first.display, true);
  assert.match(first.content, new RegExp(`taskfleet run wait ${ids.a} ${ids.b} --any --output json`));
  assert.match(first.content, /say briefly why/);
  assert.deepEqual(first.details.runs, [ids.a, ids.b]);

  const declined = [first];
  assert.equal(waitReminder(uncovered, remindedRuns(declined)), null, 'a declined set is not repeated');
  assert.equal(waitReminder([uncovered[1]], remindedRuns(declined)), null, 'nor what is left of it');
  assert.ok(waitReminder([...uncovered, { run_id: ids.c, title: 'new' }], remindedRuns(declined)), 'a new run is news');
  // The agent waited, the wait returned for one run, and it forgot to wait again.
  const rewaited = [...declined, start(`taskfleet run wait ${ids.a} ${ids.b} --any --output json`)];
  assert.deepEqual(waitReminder([uncovered[1]], remindedRuns(rewaited)).details.runs, [ids.b]);
  // A wait that does not wake the agent when the runs settle is not the agent waiting.
  for (const notify of [{ onSuccess: 'context', onFailure: 'context' }, { onSuccess: 'context', onFailure: 'turn' }, { onSuccess: 'turn', onFailure: 'context' }]) {
    assert.equal(waitReminder(uncovered, remindedRuns([...declined, start(`taskfleet run wait ${ids.a} --output json`, 1, notify)])), null, JSON.stringify(notify));
  }
  assert.equal(waitReminder([], new Set()), null);
});

test('more than twenty runs: the command stays within the wait grammar', () => {
  const many = Array.from({ length: 23 }, (_, n) => ({ run_id: `01m531x6y92ggdqcmb1exzm${String(n).padStart(3, '0')}`, title: '' }));
  const r = waitReminder(many, new Set());
  assert.equal(r.content.match(/taskfleet run wait ([0-9a-z ]+) --any/)[1].split(' ').length, 20);
  assert.match(r.content, /and 3 more/);
  assert.equal(r.details.runs.length, 23);
});

// The hook against a real child process: Taskfleet's error, slowness and the
// live pi-processes inventory are the boundaries that decide the reminder.
test('agent_before_settle: reminds once, not when covered, not on Taskfleet error or timeout', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'oh-wait-reminder-test-'));
  const fake = join(directory, 'taskfleet');
  const previous = { path: process.env.PATH, socket: process.env.OH_PROCESS_SOCKET };
  process.env.PATH = `${directory}:${previous.path}`;
  delete process.env.OH_PROCESS_SOCKET;
  const taskfleet = async body => { await writeFile(fake, `#!/bin/sh\n${body}\n`); await chmod(fake, 0o700); };
  await writeFile(join(directory, 'list.json'), JSON.stringify({ schema_version: 1, data: { runs } }));
  try {
    const hooks = new Map(), bus = new Map();
    const api = { on: (k, f) => hooks.set(k, f), events: { on(k, f) { bus.set(k, [...(bus.get(k) ?? []), f]); }, emit(k, q) { for (const f of bus.get(k) ?? []) f(q); } } };
    companion(api);
    let records = [];
    api.events.on('processes:request:list', q => q.reply(records));
    const branch = [];
    const ctx = { cwd: directory, sessionManager: { getBranch: () => branch, getSessionId: () => 's1' } };
    await hooks.get('session_start')({}, ctx);
    // An ordinary end: the last message is the assistant's, so Pi cannot continue yet.
    const settle = (extra = {}) => hooks.get('agent_before_settle')({ type: 'agent_before_settle', outcome: 'completed', continue: false, entries: [], context: { canContinue: false }, ...extra }, ctx);

    await taskfleet('exit 1');
    assert.equal(await settle(), undefined, 'a Taskfleet error is no reminder');
    await taskfleet('sleep 5');
    const began = Date.now();
    assert.equal(await settle(), undefined, 'a slow Taskfleet is no reminder');
    assert.ok(Date.now() - began < 2500, 'and the turn end is not held long');

    await taskfleet(`cat '${join(directory, 'list.json')}'`);
    assert.equal(await settle({ outcome: 'aborted' }), undefined, 'Escape ends the run');
    assert.equal(await settle({ continue: true }), undefined, 'another continuation comes back here');
    const earlier = { type: 'custom', customType: 'other-extension' };
    const reminded = await settle({ entries: [earlier] });
    assert.equal(reminded.continue, true);
    assert.equal(reminded.entries[0], earlier, 'an earlier handler\'s draft is kept');
    assert.equal(reminded.entries.length, 2);
    assert.deepEqual(reminded.entries[1].details.runs, [ids.a, ids.b]);

    branch.push(reminded.entries[1]);
    assert.equal(await settle(), undefined, 'the same set is reminded once');

    const now = Date.now() + 1;
    const command = `taskfleet run wait ${ids.a} ${ids.b} --any --output json`;
    branch.push({ type: 'message', message: { role: 'toolResult', toolName: 'process', details: { action: 'start', process: { id: 'proc_bbbb', name: 'wait', command, startTime: now }, notify: { onSuccess: 'turn', onFailure: 'turn' } } } });
    records = [{ id: 'proc_bbbb', name: 'wait', command, startTime: now, status: 'running' }];
    assert.equal(await settle(), undefined, 'a running waking wait covers the runs');
    records = [{ ...records[0], status: 'exited' }];
    assert.deepEqual((await settle()).entries[0].details.runs, [ids.a, ids.b], 'its return without a new wait is reminded');
    // A fresh conversation whose only wait is silent when the runs settle.
    branch.splice(0, branch.length, { type: 'message', message: { role: 'toolResult', toolName: 'process', details: { action: 'start', process: { id: 'proc_bbbb', name: 'wait', command, startTime: now }, notify: { onSuccess: 'context', onFailure: 'turn' } } } });
    records = [{ ...records[0], status: 'running' }];
    assert.ok(await settle(), 'a wait silent on success does not cover them');
    records = [];
    api.events.on('processes:request:list', q => q.reply([]));
    assert.equal(await settle(), undefined, 'an ambiguous process inventory is no reminder');
  } finally {
    process.env.PATH = previous.path;
    if (previous.socket !== undefined) process.env.OH_PROCESS_SOCKET = previous.socket;
    await rm(directory, { recursive: true, force: true });
  }
});
