import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import companion from '../process-extension.mjs';

// The actual bridge must turn a native EDQUOT exception into an explicit failed
// write rather than an acknowledgement or a model prompt. Kernel enforcement is
// separately live acceptance, not claimed by this injected filesystem exception.
test('notice bridge exposes native write failure without processes or model calls', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oh-notice-'));
  const previous = process.env.OH_PROCESS_SOCKET;
  const previousId = process.env.OPEN_HABITAT_CONVERSATION_ID;
  const previousGeneration = process.env.OPEN_HABITAT_LAUNCH_GENERATION;
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const generation = '33333333-3333-4333-8333-333333333333';
  process.env.OPEN_HABITAT_CONVERSATION_ID = `pi:${sessionId}`;
  process.env.OPEN_HABITAT_LAUNCH_GENERATION = generation;
  const socketPath = path.join(dir, 'bridge.sock');
  process.env.OH_PROCESS_SOCKET = socketPath;
  const hooks = new Map();
  let fail = true, calls = 0, activeSessionId = sessionId;
  companion({
    on: (name, handler) => hooks.set(name, handler),
    events: { on() {}, emit() { assert.fail('notice must not consult the process manager'); } },
    appendEntry(type, notice) {
      calls++;
      assert.equal(type, 'oh-agent-notice');
      assert.equal(notice.text, 'Quota full <script>data</script>');
      if (fail) throw Object.assign(new Error('synthetic EDQUOT private path'), { code: 'EDQUOT' });
    },
    sendMessage() { assert.fail('notice must not prompt the model'); },
  });
  const request = q => new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let data = '';
    socket.setTimeout(2000, () => socket.destroy(new Error('bridge timeout')));
    socket.on('error', reject);
    socket.on('connect', () => socket.write(JSON.stringify(q) + '\n'));
    socket.on('data', chunk => { data += chunk; });
    socket.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
  });
  try {
    await hooks.get('session_start')({}, { sessionManager: { getBranch: () => [], getSessionId: () => activeSessionId } });
    const notice = { notice_id: '22222222-2222-4222-8222-222222222222', origin: 'agent', timestamp: '2026-10-21T10:00:00Z', text: 'Quota full <script>data</script>', persistence: 'unknown' };
    const failed = await request({ op: 'notice', notice, session_id: sessionId, generation });
    assert.deepEqual(failed, { ok: true, data: { written: false, reason: 'native_write_failed' } });
    assert.ok(!JSON.stringify(failed).includes('private path'));
    assert.deepEqual(await request({ op: 'notice', notice, session_id: '44444444-4444-4444-8444-444444444444', generation }), { ok: true, data: { written: false, reason: 'conversation_mismatch' } });
    assert.equal(calls, 1, 'another native session never reaches the writer');
    fail = false;
    assert.deepEqual(await request({ op: 'notice', notice, session_id: sessionId, generation }), { ok: true, data: { written: true } });
    assert.equal(calls, 2, 'neither request retries');
    activeSessionId = '44444444-4444-4444-8444-444444444444';
    assert.deepEqual(await request({ op: 'notice', notice, session_id: sessionId, generation }), { ok: true, data: { written: false, reason: 'conversation_mismatch' } });
    assert.equal(calls, 2, 'native session switch cannot redirect an old launch notice');
  } finally {
    hooks.get('session_shutdown')();
    if (previous === undefined) delete process.env.OH_PROCESS_SOCKET;
    else process.env.OH_PROCESS_SOCKET = previous;
    if (previousId === undefined) delete process.env.OPEN_HABITAT_CONVERSATION_ID;
    else process.env.OPEN_HABITAT_CONVERSATION_ID = previousId;
    if (previousGeneration === undefined) delete process.env.OPEN_HABITAT_LAUNCH_GENERATION;
    else process.env.OPEN_HABITAT_LAUNCH_GENERATION = previousGeneration;
    await rm(dir, { recursive: true, force: true });
  }
});
