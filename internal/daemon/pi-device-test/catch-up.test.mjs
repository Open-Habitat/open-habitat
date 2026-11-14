import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import companion, { branchFacts, readSpinoffs, catchUpMessage, stopFact } from '../process-extension.mjs';

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

test('the last message says whether Pi stopped in the middle of a turn', () => {
  const said = (role, extra = {}) => ({ type: 'message', message: { role, ...extra } });
  const prompt = said('user'), call = said('assistant', { stopReason: 'toolUse' }), result = said('toolResult'), answer = said('assistant', { stopReason: 'stop' });
  const title = { type: 'session_info', name: 'otsikko' };
  assert.equal(branchFacts([prompt, call, result, answer, title]).turnCut, false, 'an answered turn ends with the answer, whatever follows it');
  assert.equal(branchFacts([prompt]).turnCut, true, 'an unanswered prompt');
  assert.equal(branchFacts([prompt, call]).turnCut, true, 'a tool call without its result');
  assert.equal(branchFacts([prompt, call, result]).turnCut, true, 'a tool result the model never answered');
  assert.equal(branchFacts([prompt, said('assistant', { stopReason: 'aborted' })]).turnCut, false, 'an aborted reply ended its turn');
  const restart = { type: 'custom', customType: 'oh-restart-stop', data: { schema_version: 1 } }, aborted = said('assistant', { stopReason: 'aborted' });
  assert.equal(branchFacts([prompt, restart, aborted]).turnCut, true, 'a reply the daemon\'s restart aborted was cut');
  assert.equal(branchFacts([prompt, call, restart, result, said('assistant', { stopReason: 'error' })]).turnCut, true, 'a tool the restart aborted was cut');
  assert.equal(branchFacts([prompt, restart, aborted, prompt, aborted]).turnCut, false, 'a mark from an earlier turn does not make the person\'s stop a cut');
  assert.equal(branchFacts([prompt, answer, restart]).turnCut, false, 'a restart while idle cuts nothing');
  const woken = { type: 'custom_message', customType: 'oh-resume-catch-up', details: {} };
  assert.equal(branchFacts([prompt, restart, aborted, woken, aborted]).turnCut, false, 'a stop in an automatically woken run is not the restart\'s');
  assert.equal(branchFacts([prompt, restart, aborted, woken, said('assistant', { stopReason: 'error' })]).turnCut, false, 'a provider error in a woken run is not the restart\'s');
  const shell = said('bashExecution', { command: 'git status' }), note = said('custom', { customType: 'oh-resume-catch-up' });
  assert.equal(branchFacts([prompt, call, result, shell]).turnCut, true, 'the person\'s !command does not finish the agent\'s turn');
  assert.equal(branchFacts([prompt, note]).turnCut, true, 'a custom message after the prompt is not its answer');
  assert.equal(branchFacts([prompt, answer, shell]).turnCut, false);
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
  const read = async args => {
    assert.ok(!args.includes('--repo'), 'creator attribution must discover runs in all repositories');
    return args[1] === 'list' ? { runs } : runs.find(r => r.run_id === args[2]);
  };
  const result = await readSpinoffs({ sessionId: 's1', cwd: '/w', since, waited: new Set([ids.live]), reported: new Set([`${ids.told}:failed`]), read });
  assert.deepEqual(result.settled.map(r => [r.run_id, r.state]), [[ids.own, 'merged']]);
  assert.deepEqual(result.rearm.map(r => r.run_id), [ids.live], 'only a wait the agent had started is restored');
  assert.deepEqual(await readSpinoffs({ sessionId: 's1', cwd: '/w', since, waited: new Set(), reported: new Set(), read: async () => null }), { settled: [], rearm: [], available: false }, 'missing Taskfleet tells nothing, and says it was not read');
  assert.equal(catchUpMessage([], { settled: [], rearm: result.rearm }), null, 'a restored wait alone is not news');
});

test('without Taskfleet installed no run exists, which is an empty inventory, not an unread one', async () => {
  const path = process.env.PATH;
  process.env.PATH = '/nonexistent-oh-test';
  try {
    assert.deepEqual(await readSpinoffs({ sessionId: 's1', cwd: '/', since: 0, waited: new Set(), reported: new Set() }), { settled: [], rearm: [], available: true });
  } finally { process.env.PATH = path; }
});

// Each test owns the variables the daemon passes at launch: this suite may
// itself run under a Habitat Pi, whose own stop must not leak in.
const launchEnv = ['OH_PROCESS_SOCKET', 'OPEN_HABITAT_STOP_CAUSE', 'OPEN_HABITAT_STOPPED_AT', 'OPEN_HABITAT_STOP_DETAIL', 'OPEN_HABITAT_CONVERSATION_ID', 'OPEN_HABITAT_LAUNCH_GENERATION'];
async function withLaunchEnv(env, body) {
  const previous = Object.fromEntries(launchEnv.map(k => [k, process.env[k]]));
  for (const k of launchEnv) delete process.env[k];
  Object.assign(process.env, env);
  try { await body(); } finally {
    for (const k of launchEnv) previous[k] === undefined ? delete process.env[k] : process.env[k] = previous[k];
  }
}

test('the first run after Pi starts gets one context message, and only when there is news', () => withLaunchEnv({}, async () => {
  const hooks = new Map();
  {
    companion({ on: (k, f) => hooks.set(k, f), events: { on() {}, emit() {} } });
    const ctx = branch => ({ cwd: '/nonexistent-oh-test', sessionManager: { getBranch: () => branch, getSessionId: () => 's1' } });
    await hooks.get('session_start')({}, ctx([start('proc_aaaa', 1), ended('proc_aaaa')]));
    assert.equal(await hooks.get('before_agent_start')({}), undefined);
    await hooks.get('session_start')({}, ctx([start('proc_bbbb', 1, 'npm run dev')]));
    const first = await hooks.get('before_agent_start')({});
    assert.equal(first.message.customType, 'oh-resume-catch-up');
    assert.match(first.message.content, /proc_bbbb "proc_bbbb": npm run dev/);
    assert.deepEqual(first.message.details.processes, [{ id: 'proc_bbbb', startTime: 1, name: 'proc_bbbb' }]);
    assert.equal(await hooks.get('before_agent_start')({}), undefined, 'later runs are not told again');
  }
}));

test('the stop the daemon passed is this launch\'s alone: its first session takes it, and nothing Pi starts inherits it', () => withLaunchEnv({ OPEN_HABITAT_STOP_CAUSE: 'crash', OPEN_HABITAT_STOPPED_AT: '2026-10-28T07:03:43Z', OPEN_HABITAT_STOP_DETAIL: 'Pi exited with status 1; Habitat had not closed its input' }, async () => {
  const hooks = new Map();
  companion({ on: (k, f) => hooks.set(k, f), events: { on() {}, emit() {} } });
  assert.equal(process.env.OPEN_HABITAT_STOP_CAUSE, undefined, 'a tool, tmux window or nested Pi would claim this stop as its own');
  assert.equal(process.env.OPEN_HABITAT_STOPPED_AT, undefined);
  assert.equal(process.env.OPEN_HABITAT_STOP_DETAIL, undefined);
  const said = (role, extra = {}) => ({ type: 'message', message: { role, ...extra } });
  const cut = [said('user'), said('assistant', { stopReason: 'toolUse' })];
  const ctx = branch => ({ cwd: undefined, sessionManager: { getBranch: () => branch, getSessionId: () => 's1' } });
  await hooks.get('session_start')({}, ctx(cut));
  const first = await hooks.get('before_agent_start')({});
  assert.deepEqual(first.message.details.stopped, { cause: 'crash', at: '2026-10-28T07:03:43Z', detail: 'Pi exited with status 1; Habitat had not closed its input' });
  assert.equal(first.message.details.interrupted_turn, true);
  await hooks.get('session_start')({}, ctx(cut));
  assert.equal(await hooks.get('before_agent_start')({}), undefined, 'a later session in this Pi did not wake from that stop');
}));

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

test('Habitat\'s own wake gives the agent its catch-up as a turn, once, and never ahead of the person', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'oh-wake-test-'));
  const path = join(directory, 'p.sock');
  try {
    await withLaunchEnv({ OH_PROCESS_SOCKET: path, OPEN_HABITAT_STOP_CAUSE: 'crash', OPEN_HABITAT_STOPPED_AT: '2026-10-28T19:26:55Z', OPEN_HABITAT_CONVERSATION_ID: 'pi:s1', OPEN_HABITAT_LAUNCH_GENERATION: 'g1' }, async () => {
      const hooks = new Map(), sent = [];
      companion({ on: (k, f) => hooks.set(k, f), events: { on() {}, emit() {} }, sendMessage: (m, o) => sent.push([m, o]) });
      const ctx = { cwd: undefined, sessionManager: { getBranch: () => [start('proc_aaaa', 1, `taskfleet run wait ${ids.own} --output json`)], getSessionId: () => 's1' } };
      await hooks.get('session_start')({}, ctx);
      const wake = (extra = {}) => ask(path, { op: 'wake', session_id: 's1', generation: 'g1', reason: 'settled', ...extra });
      assert.equal((await wake({ reason: 'later' })).error, 'invalid_request', 'only the daemon\'s fixed reasons');
      assert.deepEqual((await wake({ generation: 'g0' })).data, { woken: false, reason: 'conversation_mismatch' });
      assert.deepEqual((await wake()).data, { woken: true });
      assert.equal(sent.length, 1);
      const [message, options] = sent[0];
      assert.deepEqual(options, { triggerTurn: true });
      assert.equal(message.customType, 'oh-resume-catch-up');
      assert.equal(message.details.woke, 'settled');
      assert.deepEqual(message.details.stopped, { cause: 'crash', at: '2026-10-28T19:26:55Z' });
      assert.match(message.content, /started it again on its own, without a message from the person, because the Taskfleet runs it was waiting for have settled/);
      assert.doesNotMatch(message.content, /answer their message/);
      assert.equal(await hooks.get('before_agent_start')({}), undefined, 'the wake\'s turn is not told twice');
      assert.deepEqual((await wake()).data, { woken: false, reason: 'told' });
      // The person's message came first: it carries the catch-up, and a wake after it does nothing.
      await hooks.get('session_start')({}, ctx);
      assert.equal((await hooks.get('before_agent_start')({})).message.details.woke, undefined);
      assert.deepEqual((await wake()).data, { woken: false, reason: 'told' });
      assert.equal(sent.length, 1);
      hooks.get('session_shutdown')();
    });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a wake needs news of its own', () => {
  const stopped = { cause: 'restart', at: '2026-10-28T19:26:55Z' };
  assert.equal(catchUpMessage([], { settled: [], rearm: [], available: false }, stopped, true, 'cut_off'), null, 'a cut turn or an unread inventory is no reason to wake');
  const woken = catchUpMessage([{ id: 'proc_aaaa', name: 'odotus', command: 'until curl -sf x; do sleep 5; done', startTime: 1 }], { settled: [], rearm: [], available: true }, stopped, false, 'cut_off');
  assert.match(woken.content, /a background process it was waiting for was cut off with it and will never report back/);
  assert.equal(woken.details.woke, 'cut_off');
});

test('cross-workspace attribution, waited runs beyond the newest twenty, and stalls the record\'s time cannot show', async () => {
  const since = Date.parse('2026-10-16T12:00:00Z');
  const id = n => `01m531x6y92ggdqcmb1exzm${String(n).padStart(3, '0')}`;
  const older = { created_at: '2026-10-16T09:00:00Z', manifest: { updated_at: '2026-10-16T09:00:00Z' } };
  const runs = [
    ...Array.from({ length: 25 }, (_, n) => run(id(n), { manifest: { updated_at: '2026-10-16T11:00:00Z' } })),
    run(id(100), { ...older, status: 'running' }), // waited, still running
    run(id(101), { ...older, status: 'running', stalled: true }), // waited, its supervisor died
    run(id(102), { ...older, created_at: '2026-10-16T11:30:00Z', source_repo: '/w/web', landed: true, manifest: { updated_at: '2026-10-16T12:30:00Z' } }), // created from a subdirectory
    run(id(103), { ...older, created_at: '2026-10-16T11:31:00Z', source_repo: '/w-other', landed: true, manifest: { updated_at: '2026-10-16T12:30:00Z' } }),
  ];
  const read = async args => {
    assert.ok(!args.includes('--repo'), 'creator attribution must discover runs in all repositories');
    return args[1] === 'list' ? { runs } : runs.find(r => r.run_id === args[2]);
  };
  const result = await readSpinoffs({ sessionId: 's1', cwd: '/w', since, waited: new Set([id(100), id(101)]), reported: new Set(), read });
  assert.deepEqual(result.rearm.map(r => r.run_id), [id(100)]);
  assert.deepEqual(result.settled.map(r => [r.run_id, r.state]).sort(), [[id(101), 'stalled'], [id(102), 'merged'], [id(103), 'merged']]);
});


test('a run-show must still belong to the parent before catch-up or rearming', async () => {
  const read = async args => args[1] === 'list' ? { runs: [run(ids.live, { status: 'running', source_repo: '/other' })] } : run(ids.live, { created_by_session: { harness: 'pi', session_id: 's2' }, landed: true });
  const result = await readSpinoffs({ sessionId: 's1', cwd: '/w', since: 0, waited: new Set([ids.live]), reported: new Set(), read });
  assert.deepEqual(result, { settled: [], rearm: [], available: true });
});

test('a stall is attributed to Taskfleet and the details carry what the person sees', () => {
  const message = catchUpMessage([], { settled: [{ run_id: ids.own, title: 'release', state: 'stalled' }], rearm: [{ run_id: ids.live, title: 'wait' }] });
  assert.match(message.content, /"release" is reported stalled by Taskfleet/);
  assert.doesNotMatch(message.content, /supervisor stopped/);
  assert.deepEqual(message.details.spinoffs, [{ run_id: ids.own, state: 'stalled', title: 'release' }]);
  assert.deepEqual(message.details.rearm, [{ run_id: ids.live, title: 'wait' }]);
});

test('the agent\'s catch-up and the person\'s card follow one settlement rule', async () => {
  const { readFile } = await import('node:fs/promises');
  const { cases } = JSON.parse(await readFile(new URL('../testdata/catch-up-runs.json', import.meta.url), 'utf8'));
  for (const c of cases) {
    const read = async args => args[1] === 'list' ? { runs: c.runs } : c.runs.find(r => r.run_id === args[2]);
    const result = await readSpinoffs({ sessionId: c.session, cwd: '/w', since: Date.parse(c.since), waited: new Set(c.waited), reported: new Set(c.reported), read });
    assert.deepEqual(result.settled.map(({ title, ...r }) => r), c.settled, c.name);
    assert.deepEqual(result.rearm.map(r => r.run_id), c.rearm, c.name);
  }
});

test('the catch-up names the stop the person\'s card named, and says nothing when nothing happened', () => {
  const stopped = stopFact({ OPEN_HABITAT_STOP_CAUSE: 'idle', OPEN_HABITAT_STOPPED_AT: '2026-10-26T18:20:00Z' });
  assert.deepEqual(stopped, { cause: 'idle', at: '2026-10-26T18:20:00Z' });
  assert.equal(stopFact({ OPEN_HABITAT_STOP_CAUSE: 'nap', OPEN_HABITAT_STOPPED_AT: '2026-10-26T18:20:00Z' }), null, 'an unknown cause is no claim');
  assert.equal(stopFact({}), null);
  assert.equal(catchUpMessage([], { settled: [], rearm: [], available: true }, stopped), null, 'nothing cut off and nothing settled is not news (Jari, 2026-10-28)');
  const cut = catchUpMessage([], { settled: [], rearm: [], available: true }, stopped, true);
  assert.deepEqual(cut.details.stopped, stopped);
  assert.equal(cut.details.interrupted_turn, true);
  assert.match(cut.content, /2026-10-26T18:20:00Z/);
  assert.match(cut.content, /turn it was working on was cut off/);
  assert.match(cut.content, /Nothing settled meanwhile/);
  assert.equal(catchUpMessage([], { settled: [], rearm: [], available: true }, null, true), null, 'a cut turn is told only with the stop that cut it');
  const unread = catchUpMessage([], { settled: [], rearm: [], available: false }, stopped);
  assert.doesNotMatch(unread.content, /Nothing settled/, 'an unread inventory is not an empty one');
  assert.match(unread.content, /could not read/);
  const detail = "Habitat closed Pi's input after no reply from Pi to get_commands within 4s, which ends Pi; Pi exited with status 0";
  const crash = stopFact({ OPEN_HABITAT_STOP_CAUSE: 'crash', OPEN_HABITAT_STOPPED_AT: '2026-10-28T18:22:57Z', OPEN_HABITAT_STOP_DETAIL: detail });
  assert.deepEqual(crash, { cause: 'crash', at: '2026-10-28T18:22:57Z', detail });
  const crashed = catchUpMessage([], { settled: [], rearm: [], available: true }, crash, true);
  assert.ok(crashed.content.includes(`Pi ended without being asked (${detail}), and was started again`), 'the daemon\'s account of the crash is kept in the native history');
  assert.deepEqual(crashed.details.stopped, crash);
  assert.deepEqual(stopFact({ OPEN_HABITAT_STOP_CAUSE: 'idle', OPEN_HABITAT_STOPPED_AT: '2026-10-28T18:22:57Z', OPEN_HABITAT_STOP_DETAIL: detail }), { cause: 'idle', at: '2026-10-28T18:22:57Z' }, 'a detail belongs to a crash only');
  assert.deepEqual(stopFact({ OPEN_HABITAT_STOP_CAUSE: 'crash', OPEN_HABITAT_STOPPED_AT: '2026-10-28T18:22:57Z', OPEN_HABITAT_STOP_DETAIL: 'two\nlines' }), { cause: 'crash', at: '2026-10-28T18:22:57Z' });
  const told = catchUpMessage([], { settled: [{ run_id: ids.own, title: 'csv', state: 'not_merged', summary: 'Vienti valmis.\n\nTörmäys.', branch: 'wt/csv', ended_at: '2026-10-26T18:41:00Z' }], rearm: [] }, stopped);
  assert.match(told.content, /Vienti valmis\. Törmäys\./, 'the agent reads the summary the person saw');
  assert.deepEqual(told.details.spinoffs, [{ run_id: ids.own, state: 'not_merged', title: 'csv', summary: 'Vienti valmis.\n\nTörmäys.', ended_at: '2026-10-26T18:41:00Z', branch: 'wt/csv' }]);
});

test('a named worker\'s round report is told by its round and name, and a told round is keyed by it', () => {
  const run = { run_id: '01m531x6y92ggdqcmb1exzmn20', title: 'Prototyyppi', state: 'round_reported', round: 3, name: 'proto-a', summary: 'Kierros 3 valmis.' };
  const msg = catchUpMessage([], { settled: [run], rearm: [], available: true }, { cause: 'idle', at: '2026-10-26T18:20:00Z' }, false, 'settled');
  assert.match(msg.content, /named worker `proto-a`\) reported round 3 and waits for your next message \(`taskfleet run message proto-a`\)/);
  assert.match(msg.content, /Taskfleet's summary: Kierros 3 valmis\./);
  assert.deepEqual(msg.details.spinoffs, [{ run_id: run.run_id, state: 'round_reported', title: 'Prototyyppi', round: 3, name: 'proto-a', summary: 'Kierros 3 valmis.' }]);
  const told = branchFacts([{ type: 'custom_message', customType: msg.customType, details: msg.details }]);
  assert.deepEqual([...told.runs], [`${run.run_id}:round_reported:3`], 'the next round is news again');
});
