import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import companion, { liveWaitRuns, waitOperands, waitRuns } from '../process-extension.mjs';

// Shared with the daemon's TestTaskfleetWaitSharedGrammar so the two grammars agree.
test('waitRuns recognises exactly the daemon\'s Taskfleet wait shapes', async () => {
  const { cases } = JSON.parse(await readFile(new URL('../testdata/taskfleet-wait-grammar.json', import.meta.url), 'utf8'));
  assert.ok(cases.length > 0);
  for (const c of cases) {
    assert.deepEqual(waitRuns(c.command), c.run_ids, c.command);
    assert.deepEqual(waitOperands(c.command), c.operands ?? c.run_ids, c.command);
  }
});

function request(path, q) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(path);
    socket.setTimeout(6000, () => socket.destroy(new Error('timeout')));
    let input = '';
    socket.on('connect', () => socket.write(JSON.stringify(q) + '\n'));
    socket.on('error', reject);
    socket.on('data', b => { input += b; const n = input.indexOf('\n'); if (n >= 0) { resolve(JSON.parse(input.slice(0, n))); socket.destroy(); } });
  });
}
test('companion uses native authority, fences reused IDs and bounds logs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'oh-companion-test-'));
  const path = join(directory, 'p.sock');
  const previous = process.env.OH_PROCESS_SOCKET;
  process.env.OH_PROCESS_SOCKET = path;
  const hooks = new Map(), bus = new Map();
  const appended = [];
  const api = { on: (k, f) => hooks.set(k, f), appendEntry: (type, data) => appended.push([type, data]), events: {
    on(k, f) { bus.set(k, [...(bus.get(k) ?? []), f]); },
    emit(k, q) { for (const f of bus.get(k) ?? []) f(q); },
  } };
  companion(api);
  let records = [], kills = [];
  api.events.on('processes:request:list', q => q.reply(records));
  api.events.on('processes:request:get', q => q.reply(records.find(p => p.id === q.id)));
  api.events.on('processes:request:combined_output', q => q.reply(Array.from({ length: 2000 }, () => ({ type: 'stderr', text: '<script>secret output</script>' + 'a'.repeat(1000) }))));
  api.events.on('processes:command:kill', q => { kills.push(q); q.reply({ ok: true }); });
  api.events.on('processes:command:clear', q => { records = records.filter(p => p.status === 'running'); q.reply(1); });
  const now = Date.now();
  records = [{ id: 'proc_abcd', name: 'fixture', command: 'taskfleet run wait 01m531x6y92ggdqcmb1exzmn10', startTime: now, status: 'running' }];
  const branch = [{ message: { role: 'toolResult', toolName: 'process', details: { action: 'start', process: records[0], notify: { onSuccess: 'turn', onFailure: 'context' } } } }];
  try {
    await hooks.get('session_start')({}, { sessionManager: { getBranch: () => branch } });
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    const list = await request(path, { op: 'list' });
    assert.equal(list.data.records[0].wakes_agent, true);
    assert.deepEqual(list.data.records[0].run_ids, ['01m531x6y92ggdqcmb1exzmn10']);
    const hints = [];
    let ready, outputReady;
    const watching = new Promise(resolve => { ready = resolve; });
    const outputHint = new Promise(resolve => { outputReady = resolve; });
    const watch = net.createConnection(path);
    let buffered = '';
    watch.on('error', () => {});
    watch.on('connect', () => watch.write(JSON.stringify({ op: 'watch' }) + '\n'));
    watch.on('data', chunk => {
      buffered += chunk;
      let n;
      while ((n = buffered.indexOf('\n')) >= 0) {
        const frame = JSON.parse(buffered.slice(0, n)); buffered = buffered.slice(n + 1);
        hints.push(frame); ready();
        if (frame.kind === 'process.output') outputReady();
      }
    });
    await watching;
    api.events.emit('processes:output_changed', { id: 'proc_abcd' });
    await request(path, { op: 'list' });
    await new Promise(setImmediate);
    assert.equal(hints.filter(h => h.kind === 'process.output').length, 0, 'no output hints without an explicit output view');

    const output = await request(path, { op: 'output', id: 'proc_abcd', token: `pt_${now}`, tail_lines: 2000 });
    assert.ok(output.ok);
    assert.ok(output.data.lines.length < 2000);
    assert.ok(Buffer.byteLength(JSON.stringify(output)) < 256 * 1024);
    for (let i = 0; i < 100; ++i) api.events.emit('processes:output_changed', { id: 'proc_abcd' });
    await outputHint;
    await request(path, { op: 'list' });
    await new Promise(setImmediate);
    assert.equal(hints.filter(h => h.kind === 'process.output').length, 1, 'chatty output is coalesced');
    const clock = Date.now;
    try {
      const expired = Date.now() + 4000; Date.now = () => expired;
      api.events.emit('processes:output_changed', { id: 'proc_abcd' });
    } finally { Date.now = clock; }
    await request(path, { op: 'list' });
    await new Promise(setImmediate);
    assert.equal(hints.filter(h => h.kind === 'process.output').length, 1, 'closed/paused output lease expires');
    watch.destroy();

    // A cleared ID is legal for the native manager to reissue in the same Pi.
    records[0] = { ...records[0], startTime: now + 1 };
    const stale = await request(path, { op: 'stop', id: 'proc_abcd', token: `pt_${now}`, force: false });
    assert.equal(stale.error, 'stale_process');
    assert.equal(kills.length, 0);
    const current = await request(path, { op: 'stop', id: 'proc_abcd', token: `pt_${now + 1}`, force: true });
    assert.equal(current.data.result, 'killed');
    assert.equal(kills[0].signal, 'SIGKILL');
    // Old start metadata is not evidence for the reused record's wake conditions.
    assert.equal((await request(path, { op: 'list' })).data.records[0].wakes_agent, null);
    records.push({ id: 'proc_bcde', startTime: now, status: 'exited' });
    await request(path, { op: 'clear' });
    assert.equal(records.length, 1);
    assert.equal(appended.length, 0);
    // The person's stop is recorded in the branch, so no later wake overrules it.
    await request(path, { op: 'shutdown', person: true });
    assert.equal(kills.length, 2);
    assert.deepEqual(appended, [['oh-person-stop', { schema_version: 1 }]]);
    api.events.on('processes:request:list', q => q.reply([]));
    const duplicate = await request(path, { op: 'list' });
    assert.equal(duplicate.error, 'duplicate_owner');
    const denied = await request(path, { op: 'stop', id: 'proc_abcd', token: `pt_${now + 1}`, force: true });
    assert.equal(denied.error, 'duplicate_owner');
    assert.equal(kills.length, 2, 'ambiguous owners must never receive a browser kill');

  } finally {
    hooks.get('session_shutdown')();
    if (previous === undefined) delete process.env.OH_PROCESS_SOCKET; else process.env.OH_PROCESS_SOCKET = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
// The daemon's own stop marks a running turn, so the reply Pi aborts on its
// way down reads as cut by the restart; an idle Pi's branch is left alone.
for (const idle of [false, true]) test(`a restart's shutdown ${idle ? 'leaves an idle branch alone' : 'marks the running turn'}`, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'oh-restart-stop-'));
  const path = join(directory, 'p.sock');
  const previous = process.env.OH_PROCESS_SOCKET;
  process.env.OH_PROCESS_SOCKET = path;
  const hooks = new Map(), bus = new Map(), appended = [];
  const api = { on: (k, f) => hooks.set(k, f), appendEntry: (type, data) => appended.push([type, data]), events: {
    on(k, f) { bus.set(k, [...(bus.get(k) ?? []), f]); },
    emit(k, q) { for (const f of bus.get(k) ?? []) f(q); },
  } };
  companion(api);
  api.events.on('processes:request:list', q => q.reply([]));
  try {
    await hooks.get('session_start')({}, { sessionManager: { getBranch: () => [] }, isIdle: () => idle });
    assert.equal((await request(path, { op: 'shutdown', person: false, restart: true })).data.result, 'stopped');
    assert.deepEqual(appended, idle ? [] : [['oh-restart-stop', { schema_version: 1 }]]);
  } finally {
    hooks.get('session_shutdown')();
    if (previous === undefined) delete process.env.OH_PROCESS_SOCKET; else process.env.OH_PROCESS_SOCKET = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
test('foreground bash pipeline exposes expanded waits without inventing a background process', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'oh-pipe-'));
  const path = join(directory, 'p.sock');
  const previous = process.env.OH_PROCESS_SOCKET;
  process.env.OH_PROCESS_SOCKET = path;
  const hooks = new Map();
  let records = [], child;
  companion({ on: (k, f) => hooks.set(k, f), events: {
    on() {}, emit(k, q) { if (k === 'processes:request:list') q.reply(records); },
  } });
  const id = '01m531x6y92ggdqcmb1exzmn10';
  try {
    await hooks.get('session_start')({}, { sessionManager: { getBranch: () => [] } });
    await writeFile(join(directory, 'wait.c'), '#include <unistd.h>\nint main(void) { sleep(30); return 0; }\n');
    execFileSync('cc', [join(directory, 'wait.c'), '-o', join(directory, 'taskfleet')]);
    await writeFile(join(directory, 'active.txt'), `${id}\n`);
    const command = `cd "${directory}" && taskfleet run wait $(tr '\\n' ' ' < active.txt) --any --output json 2>&1 | grep . | head -4`;
    // Pi emits execution_start before the shell is spawned.
    await hooks.get('tool_execution_start')({ toolName: 'bash', toolCallId: 'call1' });
    child = spawn('/bin/bash', ['-c', command], { env: { ...process.env, PATH: `${directory}:${process.env.PATH}` }, detached: true, stdio: 'ignore' });
    let observed;
    for (let n = 0; n < 100; n++) {
      observed = await liveWaitRuns(child.pid);
      if (observed?.length) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.deepEqual(observed, [id], 'the argv scanner already sees the expanded pipeline');
    // Foreground bash has no pi-processes record: the old inventory lost it here.
    const list = await request(path, { op: 'list' });
    assert.deepEqual(list.data.foreground_run_ids, [id]);
    assert.deepEqual(list.data.records, [], 'no fake process row or stop target');
    records = [{ pid: child.pid, command, status: 'running' }];
    assert.deepEqual((await request(path, { op: 'list' })).data.foreground_run_ids, [], 'managed backgrounds are not foreground waits');
    records = [];
    await hooks.get('tool_execution_end')({ toolName: 'bash', toolCallId: 'call1' });
    assert.deepEqual((await request(path, { op: 'list' })).data.foreground_run_ids, [], 'a surviving child after tool completion is not a foreground wait');
  } finally {
    if (child?.exitCode === null && child?.signalCode === null) { process.kill(-child.pid, 'SIGKILL'); await once(child, 'exit'); }
    hooks.get('session_shutdown')();
    if (previous === undefined) delete process.env.OH_PROCESS_SOCKET; else process.env.OH_PROCESS_SOCKET = previous;
    await rm(directory, { recursive: true, force: true });
  }
});

test('missing owner is unavailable, not an empty inventory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'oh-companion-test-'));
  const path = join(directory, 'p.sock');
  const previous = process.env.OH_PROCESS_SOCKET;
  process.env.OH_PROCESS_SOCKET = path;
  const hooks = new Map();
  companion({ on: (k, f) => hooks.set(k, f), events: { on() {}, emit() {} } });
  try {
    await hooks.get('session_start')({}, { sessionManager: { getBranch: () => [] } });
    assert.equal((await request(path, { op: 'list' })).error, 'extension_missing');
  } finally {
    hooks.get('session_shutdown')();
    if (previous === undefined) delete process.env.OH_PROCESS_SOCKET; else process.env.OH_PROCESS_SOCKET = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
