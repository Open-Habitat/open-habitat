import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduledWakeMessage, scheduledWakeType, validScheduledWake, validWakeCancel, wakeCancelMessage, wakeInBranch } from '../process-extension.mjs';

const wake = { id: 'wk_0123456789abcdef', at: '2026-11-19T07:00:00Z', set_at: '2026-11-17T13:12:00Z', fired_at: '2026-11-19T10:36:00Z', note: 'Remind the person to remove backup-2024', late_seconds: 12960 };

test('the wake message carries the note and the lateness for the agent, and the details for the person', () => {
  assert.ok(validScheduledWake(wake));
  const m = scheduledWakeMessage(wake);
  assert.equal(m.customType, scheduledWakeType);
  assert.match(m.content, /backup-2024/);
  assert.match(m.content, /216 minutes/);
  assert.deepEqual(m.details, { schema_version: 1, ...wake });
  const onTime = scheduledWakeMessage({ ...wake, late_seconds: undefined });
  assert.doesNotMatch(onTime.content, /wake is late/);
});

test('malformed wakes and cancellations are refused before anything is sent', () => {
  for (const bad of [{ ...wake, id: 'wk_x' }, { ...wake, note: ' ' }, { ...wake, note: 'x'.repeat(1001) }, { ...wake, fired_at: 'soon' }, { ...wake, late_seconds: 0 }])
    assert.equal(validScheduledWake(bad), false, JSON.stringify(bad));
  const cancel = { id: wake.id, at: wake.at, note: wake.note, reason: 'archived', cancelled_at: wake.set_at };
  assert.ok(validWakeCancel(cancel));
  assert.equal(validWakeCancel({ ...cancel, reason: 'agent' }), false, 'the agent\'s own cancel is never told back');
  assert.match(wakeCancelMessage([cancel]).content, /archived/);
});

test('a wake already in the branch is recognised, so a retry starts no second turn', () => {
  const context = branch => ({ sessionManager: { getBranch: () => branch } });
  const sent = { type: 'custom_message', customType: scheduledWakeType, details: { id: wake.id } };
  assert.equal(wakeInBranch(context([sent]), wake.id), true);
  assert.equal(wakeInBranch(context([{ type: 'message', message: { role: 'custom', customType: scheduledWakeType, details: { id: wake.id } } }]), wake.id), true);
  assert.equal(wakeInBranch(context([sent]), 'wk_fedcba9876543210'), false);
  assert.equal(wakeInBranch({ sessionManager: { getBranch: () => { throw new Error('gone'); } } }, wake.id), false);
});
