import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import companion, { waitRuns } from '../process-extension.mjs';

// Shared with the daemon's TestTaskfleetWaitSharedGrammar so the two grammars agree.
test('waitRuns recognises exactly the daemon\'s Taskfleet wait shapes', async () => {
  const { cases } = JSON.parse(await readFile(new URL('../testdata/taskfleet-wait-grammar.json', import.meta.url), 'utf8'));
  assert.ok(cases.length > 0);
  for (const c of cases) assert.deepEqual(waitRuns(c.command), c.run_ids, c.command);
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
  const api = { on: (k, f) => hooks.set(k, f), events: {
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
  records = [{ id: 'proc_abcd', name: 'fixture', startTime: now, status: 'running' }];
  const branch = [{ message: { role: 'toolResult', toolName: 'process', details: { action: 'start', process: records[0], notify: { onSuccess: 'turn', onFailure: 'context' } } } }];
  try {
    await hooks.get('session_start')({}, { sessionManager: { getBranch: () => branch } });
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    const list = await request(path, { op: 'list' });
    assert.equal(list.data.records[0].wakes_agent, true);
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
    await request(path, { op: 'shutdown' });
    assert.equal(kills.length, 2);
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
