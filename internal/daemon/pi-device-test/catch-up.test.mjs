import { test } from 'node:test';
import assert from 'node:assert/strict';
import companion, { branchFacts, readSpinoffs, catchUpMessage } from '../process-extension.mjs';

const start = (id, startTime, command = 'sleep 9', notify = { onSuccess: 'turn', onFailure: 'turn' }) =>
  ({ type: 'message', message: { role: 'toolResult', toolName: 'process', details: { action: 'start', process: { id, name: id, command, startTime }, notify } } });
const ended = (id, kind = 'success') => ({ type: 'custom_message', customType: 'ad-process:notification', details: { processId: id, kind } });

test('the branch, not a host store, says which processes never ended', () => {
  const facts = branchFacts([
    start('proc_aaaa', 1), ended('proc_aaaa'),
    start('proc_aaaa', 2), // a reused ID is a different process
    start('proc_bbbb', 3), ended('proc_bbbb', 'log_match'), // a log match is not an end
    start('proc_cccc', 4, 'true', { onSuccess: 'ignore' }), // a silent success proves nothing
    start('proc_dddd', 5), { type: 'message', message: { role: 'toolResult', toolName: 'process', details: { action: 'stop', result: { ok: true, info: { id: 'proc_dddd' } } } } },
    start('proc_ffff', 5), { type: 'message', message: { role: 'toolResult', toolName: 'process', details: { action: 'stop', result: { ok: false, reason: 'timeout', info: { id: 'proc_ffff' } } } } },
    start('proc_eeee', 6),
    { type: 'custom_message', customType: 'oh-resume-catch-up', details: { processes: [{ id: 'proc_eeee', startTime: 6 }], spinoffs: [{ run_id: 'r', state: 'merged' }] } },
  ]);
  assert.deepEqual(facts.open.map(p => `${p.id}:${p.startTime}`), ['proc_aaaa:2', 'proc_bbbb:3', 'proc_ffff:5', 'proc_eeee:6']);
  assert.ok(facts.reported.has('proc_eeee:6') && facts.runs.has('r:merged'));
});

const run = (id, extra = {}) => ({ run_id: id, kind: 'spinoff', status: 'done', title: 't', created_at: '2026-10-16T10:00:00Z', source_repo: '/w', created_by_session: { harness: 'pi', session_id: 's1' }, created_by_run_id: null, ...extra });
const ids = { own: '01m531x6y92ggdqcmb1exzmn00', old: '01m531x6y92ggdqcmb1exzmn01', other: '01m531x6y92ggdqcmb1exzmn02', live: '01m531x6y92ggdqcmb1exzmn03', idle: '01m531x6y92ggdqcmb1exzmn04', told: '01m531x6y92ggdqcmb1exzmn05' };

test('only this conversation\'s spinoffs that settled after its last entry, or that it was waiting for', async () => {
  const since = Date.parse('2026-10-16T12:00:00Z');
  const runs = [
    run(ids.own, { landed: true, manifest: { updated_at: '2026-10-16T12:30:00Z' } }),
    run(ids.old, { manifest: { updated_at: '2026-10-16T11:00:00Z' } }),
    run(ids.other, { created_by_session: { harness: 'pi', session_id: 's2' }, manifest: { updated_at: '2026-10-16T12:30:00Z' } }),
    run(ids.live, { status: 'running' }),
    run(ids.idle, { status: 'running' }),
    run(ids.told, { status: 'failed', manifest: { updated_at: '2026-10-16T12:30:00Z' } }),
  ];
  const read = async args => args[1] === 'list' ? { runs } : runs.find(r => r.run_id === args[2]);
  const result = await readSpinoffs({ sessionId: 's1', cwd: '/w', since, waited: new Set([ids.live]), reported: new Set([`${ids.told}:failed`]), read });
  assert.deepEqual(result.settled.map(r => [r.run_id, r.state]), [[ids.own, 'merged']]);
  assert.deepEqual(result.rearm.map(r => r.run_id), [ids.live], 'only a wait the agent had started is restored');
  assert.deepEqual(await readSpinoffs({ sessionId: 's1', cwd: '/w', since, waited: new Set(), reported: new Set(), read: async () => null }), { settled: [], rearm: [] }, 'missing Taskfleet tells nothing');
  assert.equal(catchUpMessage([], { settled: [], rearm: result.rearm }), null, 'a restored wait alone is not news');
});

test('the first run after Pi starts gets one context message, and only when there is news', async () => {
  const hooks = new Map();
  const previous = process.env.OH_PROCESS_SOCKET;
  delete process.env.OH_PROCESS_SOCKET;
  try {
    companion({ on: (k, f) => hooks.set(k, f), events: { on() {}, emit() {} } });
    const ctx = branch => ({ cwd: '/nonexistent-oh-test', sessionManager: { getBranch: () => branch, getSessionId: () => 's1' } });
    await hooks.get('session_start')({}, ctx([start('proc_aaaa', 1), ended('proc_aaaa')]));
    assert.equal(await hooks.get('before_agent_start')({}), undefined);
    await hooks.get('session_start')({}, ctx([start('proc_bbbb', 1, 'npm run dev')]));
    const first = await hooks.get('before_agent_start')({});
    assert.equal(first.message.customType, 'oh-resume-catch-up');
    assert.match(first.message.content, /proc_bbbb "proc_bbbb": npm run dev/);
    assert.deepEqual(first.message.details.processes, [{ id: 'proc_bbbb', startTime: 1 }]);
    assert.equal(await hooks.get('before_agent_start')({}), undefined, 'later runs are not told again');
  } finally {
    if (previous !== undefined) process.env.OH_PROCESS_SOCKET = previous;
  }
});

test('subdirectory checkouts, waited runs beyond the newest twenty, and stalls the record\'s time cannot show', async () => {
  const since = Date.parse('2026-10-16T12:00:00Z');
  const id = n => `01m531x6y92ggdqcmb1exzm${String(n).padStart(3, '0')}`;
  const older = { created_at: '2026-10-16T09:00:00Z', manifest: { updated_at: '2026-10-16T09:00:00Z' } };
  const runs = [
    ...Array.from({ length: 25 }, (_, n) => run(id(n), { manifest: { updated_at: '2026-10-16T11:00:00Z' } })),
    run(id(100), { ...older, status: 'running' }), // waited, still running
    run(id(101), { ...older, status: 'running', stalled: true }), // waited, its supervisor died
    run(id(102), { ...older, created_at: '2026-10-16T11:30:00Z', source_repo: '/w/web', landed: true, manifest: { updated_at: '2026-10-16T12:30:00Z' } }), // created from a subdirectory
    run(id(103), { ...older, source_repo: '/w-other', landed: true, manifest: { updated_at: '2026-10-16T12:30:00Z' } }),
  ];
  const read = async args => args[1] === 'list' ? { runs } : runs.find(r => r.run_id === args[2]);
  const top = async dir => dir.startsWith('/w/') || dir === '/w' ? '/w' : dir;
  const result = await readSpinoffs({ sessionId: 's1', cwd: '/w', since, waited: new Set([id(100), id(101)]), reported: new Set(), read, top });
  assert.deepEqual(result.rearm.map(r => r.run_id), [id(100)]);
  assert.deepEqual(result.settled.map(r => [r.run_id, r.state]).sort(), [[id(101), 'stalled'], [id(102), 'merged']]);
});
