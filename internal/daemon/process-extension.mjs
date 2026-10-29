// Product companion. pi-processes remains the sole registry, log and signal owner.
import net from 'node:net';
import { execFile } from 'node:child_process';
import { chmodSync, readFileSync } from 'node:fs';

const live = p => ['running', 'terminating', 'terminate_timeout'].includes(p.status);
const token = p => `pt_${p.startTime}`;
const maxFrame = 256 * 1024;
const catchUpType = 'oh-resume-catch-up';
const runPattern = /^[0-9a-hjkmnp-tv-z]{26}$/;
const key = p => `${p.id}:${p.startTime}`;
// The daemon's narrow Taskfleet wait grammar (processes_linux.go taskfleetWait),
// including its one literal leading `cd <path> &&`. Both are tested against
// testdata/taskfleet-wait-grammar.json so they cannot drift apart again.
const waitRefused = /[|&;<>($`\\"'\n\r)]/;
const waitExpanded = /[|&;<>($`\\"'\n\r)#*?[\]{}=]/;
const waitDuration = /^(?:[0-9]+|(?:(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:ns|us|µs|μs|ms|s|m|h))+)$/;
export function waitRuns(command) {
  if (typeof command !== 'string' || /[\n\r]/.test(command)) return [];
  let words = command.split(/[ \t]+/).filter(Boolean);
  if (words.length > 3 && words[0] === 'cd' && words[2] === '&&') {
    if (waitExpanded.test(words[1])) return [];
    words = words.slice(3);
  }
  if (waitRefused.test(words.join(' '))) return [];
  const bin = words[0] ?? '';
  if (words.length < 4 || waitExpanded.test(bin) || bin.replace(/\/+$/, '').split('/').pop() !== 'taskfleet' || bin !== 'taskfleet' && !bin.startsWith('/') || words[1] !== 'run' || words[2] !== 'wait') return [];
  const ids = [];
  for (let i = 3; i < words.length; ++i) {
    const w = words[i];
    if (['--all', '--any', '--fail-on-error', '--progress', '--json', '--terminal'].includes(w)) continue;
    if (['--timeout', '--check-in', '--poll-interval', '--output'].includes(w)) {
      const v = words[++i];
      if (v === undefined) return [];
      if (w === '--output') {
        if (!['json', 'jsonl', 'text'].includes(v)) return [];
      } else if (!waitDuration.test(v) || !/[1-9]/.test(v)) return [];
      continue;
    }
    if (!runPattern.test(w) || ids.length >= 20) return [];
    ids.push(w);
  }
  return ids;
}
// What the branch says about process lifetimes and earlier catch-ups. Same
// rule as the daemon's tray (process_interrupted_linux.go): a start without an
// end notification or stop result. Graceful shutdown stops leave no record.
// turnCut is the daemon's branchScan.turnCut: the last message leaves a turn
// unfinished (a prompt, tool call or tool result nobody answered).
export function branchFacts(branch) {
  const open = new Map(), order = [], reported = new Set(), runs = new Set();
  let turnCut = false;
  for (const entry of branch) {
    const m = entry?.message;
    const custom = entry?.type === 'custom_message' ? entry : m?.role === 'custom' ? m : null;
    // Only the turn's own messages decide, not a `!command` or a custom message.
    if (entry?.type === 'message' && ['user', 'assistant', 'toolResult'].includes(m?.role)) turnCut = m.role !== 'assistant' || m.stopReason === 'toolUse';
    if (m?.role === 'toolResult' && m.toolName === 'process') {
      const d = m.details;
      if (d?.action === 'start' && /^proc_[a-f0-9]{4}$/.test(d.process?.id ?? '') && d.process.startTime > 0) {
        open.delete(d.process.id);
        if (d.notify?.onSuccess === 'ignore') continue; // a silent success leaves no record
        const p = { id: d.process.id, name: String(d.process.name ?? ''), command: String(d.process.command ?? ''), startTime: d.process.startTime, wakes: d.notify?.onSuccess === 'turn' || d.notify?.onFailure === 'turn' };
        open.set(p.id, p); order.push(p);
      } else if (d?.action === 'stop' && d.result?.ok === true && d.result.info?.id) open.delete(d.result.info.id); // a failed stop leaves it live
    } else if (custom?.customType === 'ad-process:notification') {
      if (['success', 'failure', 'crash', 'killed'].includes(custom.details?.kind)) open.delete(custom.details.processId);
    } else if (custom?.customType === catchUpType) {
      for (const p of custom.details?.processes ?? []) reported.add(key(p));
      for (const r of custom.details?.spinoffs ?? []) runs.add(`${r.run_id}:${r.state}`);
    }
  }
  return { open: order.filter(p => open.get(p.id) === p), reported, runs, turnCut };
}
function taskfleet(args, cwd, timeout = 2500) {
  return new Promise(resolve => execFile('taskfleet', args, { cwd, timeout, maxBuffer: 4 << 20, env: process.env }, (error, stdout) => {
    // Without Taskfleet no run exists (the daemon's rest report agrees): an
    // empty inventory, not an unread one.
    if (error) { resolve(error.code === 'ENOENT' && args[1] === 'list' ? { runs: [] } : null); return; }
    try { const v = JSON.parse(stdout); resolve(v?.schema_version === 1 ? v.data : null); } catch { resolve(null); }
  }));
}
function spinoffState(r) {
  if (r.landed) return 'merged';
  if (r.stalled) return 'stalled';
  if (r.attention_required || r.awaiting_input) return 'awaiting';
  return { done: 'not_merged', failed: 'failed', cancelled: 'cancelled' }[r.status] ?? null;
}
// A run this conversation's Pi created itself (the daemon's belongsSpinoff).
const ownRun = sessionId => r => typeof r?.source_repo === 'string' && r.source_repo.startsWith('/') &&
  runPattern.test(r?.run_id ?? '') && ['spinoff', 'research', 'technical-decision', 'fan-out'].includes(r.kind) && r.agent_owner !== 'caller' && r.created_by_run_id == null && r.created_by_session?.harness === 'pi' && r.created_by_session.session_id === sessionId;
// Still working on its own: a default `run wait` would not have returned yet.
const liveRun = r => ['pending', 'running'].includes(r.status) && !r.attention_required && !r.awaiting_input && !r.stalled;
// Only the user's own Taskfleet records: runs this conversation created that
// settled after the branch's last entry, and the ones it was waiting for.
const unread = Object.freeze({ settled: [], rearm: [], available: false });
// An unread inventory is not an empty one: available says whether it was read.
export async function readSpinoffs({ sessionId, cwd, since, waited, reported, read = taskfleet }) {
  const result = { settled: [], rearm: [], available: true };
  const list = await read(['run', 'list', '--output', 'json'], cwd);
  if (!Array.isArray(list?.runs)) return unread;
  const belongs = ownRun(sessionId), live = liveRun;
  const mine = list.runs.filter(belongs);
  // A waited-for run is always looked at; the rest only up to a bounded number of reads.
  const others = mine.filter(r => !waited.has(r.run_id) && !live(r)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 20);
  await Promise.all([...mine.filter(r => waited.has(r.run_id)), ...others].map(async r => {
    const title = String(r.title ?? '').slice(0, 200);
    // List is inventory; show carries the verified landed flag, stall and update time.
    const d = await read(['run', 'show', r.run_id, '--output', 'json'], cwd);
    if (d === null) result.available = false;
    if (d?.run_id !== r.run_id || !belongs(d)) return;
    const state = spinoffState(d);
    if (!state) {
      if (waited.has(r.run_id) && live(d)) result.rearm.push({ run_id: r.run_id, title });
      return;
    }
    // A stall is computed when read and never advances the record's time, and
    // anything the agent was waiting for is news; others must be newer than the branch.
    const fresh = waited.has(r.run_id) || state === 'stalled' || Date.parse(d.manifest?.updated_at ?? '') > since;
    if (fresh && !reported.has(`${r.run_id}:${state}`)) result.settled.push({ run_id: r.run_id, title, state, ...runReport(d, state) });
  }));
  // The daemon's card lists them in the same order (rest_linux.go).
  result.settled.sort((a, b) => (a.ended_at ?? '').localeCompare(b.ended_at ?? '') || a.run_id.localeCompare(b.run_id));
  return result;
}
// Taskfleet's own report of a settled run, as the person's card shows it
// (rest_linux.go runSummary): the worker's summary, when it ended, and the
// branch kept when the work was not merged.
function runReport(d, state) {
  const out = {};
  let summary = typeof d.report?.summary === 'string' ? d.report.summary : '';
  const reason = typeof d.report?.reason === 'string' ? d.report.reason : '';
  if (reason && reason !== summary) summary = summary ? `${summary}\n\n${reason}` : reason;
  if (summary) out.summary = summary.slice(0, 2000);
  if (['done', 'failed', 'cancelled'].includes(d.status) && Number.isFinite(Date.parse(d.manifest?.updated_at ?? ''))) out.ended_at = d.manifest.updated_at;
  if (state !== 'merged') {
    const kept = (Array.isArray(d.preserved_work) ? d.preserved_work : []).find(p => typeof p?.branch === 'string' && p.branch && p.branch_present);
    if (kept) out.branch = kept.branch.slice(0, 300);
  }
  return out;
}
// The rest this Pi was started from, as the daemon saw it and passed it at
// launch (rest_linux.go restEnv); the person's card names the same stop.
const stopCauses = {
  idle: 'after ten idle minutes (Habitat stops an idle Pi)',
  room: 'to make room for another conversation (only a few run at once)',
  person: 'because the person stopped it',
  crash: 'unexpectedly: Pi ended without being asked',
  restart: 'when Habitat\'s server restarted, for example for an upgrade (at the latest then)',
};
export function stopFact(env = process.env) {
  const cause = env.OPEN_HABITAT_STOP_CAUSE, at = env.OPEN_HABITAT_STOPPED_AT;
  if (!stopCauses[cause] || !Number.isFinite(Date.parse(at ?? ''))) return null;
  // The daemon's own account of a crash (rest_linux.go crashDetail). Kept in
  // the catch-up, it is in the native history when the journal has rotated.
  const detail = env.OPEN_HABITAT_STOP_DETAIL;
  return cause === 'crash' && typeof detail === 'string' && detail && detail.length <= 500 && !/[\u0000-\u001f]/.test(detail) ? { cause, at, detail } : { cause, at };
}
// Each state is Taskfleet's own report; a stall is Taskfleet's liveness
// verdict, which a live worker can contradict, so it is not restated as fact.
const stateText = { merged: 'finished and merged', not_merged: 'finished, not merged', failed: 'failed', cancelled: 'cancelled', awaiting: 'is waiting for you (needs attention)', stalled: 'is reported stalled by Taskfleet (check `taskfleet run show` before relying on that)' };
export function catchUpMessage(processes, spinoffs, stopped = null, turnCut = false) {
  const news = processes.length || spinoffs.settled.length;
  const cut = !!stopped && turnCut;
  // Nothing was cut off and nothing settled: the person saw no card, and the
  // agent is told nothing either (Jari, 2026-10-28). An unread Taskfleet is
  // still not told as nothing.
  if (!news && !cut && (!stopped || spinoffs.available !== false)) return null;
  const lines = stopped
    ? [`[Open Habitat] This conversation's Pi stopped at ${stopped.at} ${stopCauses[stopped.cause]}${stopped.detail ? ` (${stopped.detail})` : ''}, and was started again for the message that follows. The person saw this same report from Habitat before writing, so answer their message rather than retelling it.${cut ? ' The turn it was working on was cut off: its last step above never finished.' : ''}${news ? ' While it was stopped:' : spinoffs.available === false ? '' : ' Nothing settled meanwhile.'}`]
    : ['[Open Habitat] This conversation\'s Pi had stopped (for example a server restart) and was started again for the message that follows. While it was stopped:'];
  if (processes.length) {
    lines.push('', 'Background processes that were cut off when Pi stopped (they are no longer running and their output is gone):');
    for (const p of processes) lines.push(`- ${p.id} "${p.name.slice(0, 200)}": ${p.command.slice(0, 300)}`);
  }
  if (spinoffs.settled.length) {
    lines.push('', 'Spinoffs whose state changed:');
    for (const r of spinoffs.settled) {
      lines.push(`- ${r.run_id} "${r.title}" ${stateText[r.state]}${r.ended_at ? ` (${r.ended_at})` : ''}${r.branch ? `; branch ${r.branch} kept` : ''}`);
      if (r.summary) lines.push(`  Taskfleet's summary: ${r.summary.replace(/\s*\n\s*/g, ' ')}`);
    }
  }
  if (spinoffs.available === false) lines.push('', 'Habitat could not read every Taskfleet record just now, so runs that settled may be missing here; check `taskfleet run list` before relying on this.');
  if (spinoffs.rearm.length) {
    const ids = spinoffs.rearm.map(r => r.run_id).join(' ');
    lines.push('', `Still running, and your wait for them was cut off: ${spinoffs.rearm.map(r => `${r.run_id} "${r.title}"`).join(', ')}. Nothing will tell you when they settle unless you wait again: start \`taskfleet run wait ${ids} --output json\` with the process tool (notify on exit), as you did before.`);
  }
  return {
    customType: catchUpType, display: true, content: lines.join('\n'),
    // The daemon presents these details to the person (restart_linux.go).
    details: {
      schema_version: 1,
      ...(stopped ? { stopped } : {}),
      ...(cut ? { interrupted_turn: true } : {}),
      processes: processes.map(p => ({ id: p.id, startTime: p.startTime, name: p.name.slice(0, 200) })),
      spinoffs: spinoffs.settled.map(r => ({ run_id: r.run_id, state: r.state, title: r.title, ...(r.summary ? { summary: r.summary } : {}), ...(r.ended_at ? { ended_at: r.ended_at } : {}), ...(r.branch ? { branch: r.branch } : {}) })),
      rearm: spinoffs.rearm.map(r => ({ run_id: r.run_id, title: r.title })),
    },
  };
}
const reminderType = 'oh-wait-reminder';
// A wait the agent is woken by whichever way it ends: `run wait` exits 0 when
// the runs settle and non-zero on a check-in or timeout, and pi-processes
// wakes on each only if asked to. The tray's ◉ (either one) is looser.
const wakesOnBoth = notify => notify?.onSuccess === 'turn' && notify?.onFailure === 'turn';
// The runs whose latest word in the branch is a turn-end reminder rather than a
// waking wait the agent started for them. A declined reminder stands until the
// agent waits for that run again; once that wait has returned (`--any`,
// `--check-in`), forgetting to start the next one is reminded again.
export function remindedRuns(branch) {
  const reminded = new Set();
  for (const entry of branch) {
    const m = entry?.message;
    const custom = entry?.type === 'custom_message' ? entry : m?.role === 'custom' ? m : null;
    if (custom?.customType === reminderType) {
      for (const id of custom.details?.runs ?? []) reminded.add(id);
    } else if (m?.role === 'toolResult' && m.toolName === 'process') {
      const d = m.details;
      if (d?.action === 'start' && wakesOnBoth(d.notify)) for (const id of waitRuns(d.process?.command)) reminded.delete(id);
    }
  }
  return reminded;
}
// Agent-worker wait model A: the conversation's own live runs that no running,
// agent-waking process waits for. Taskfleet is read with a short bound; an
// error, timeout or missing inventory says nothing, never "remind".
export async function uncoveredRuns({ sessionId, cwd, waits, read = taskfleet }) {
  const list = await read(['run', 'list', '--output', 'json'], cwd, 1500);
  if (!Array.isArray(list?.runs)) return null;
  const covered = new Set(waits.flatMap(command => waitRuns(command)));
  return list.runs.filter(ownRun(sessionId)).filter(liveRun).filter(r => !covered.has(r.run_id))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map(r => ({ run_id: r.run_id, title: String(r.title ?? '').slice(0, 200) }));
}
// One visible marker per uncovered set that still has a run nobody has been
// reminded of; the agent may wait or decline.
export function waitReminder(uncovered, reminded) {
  if (!uncovered?.length || uncovered.every(r => reminded.has(r.run_id))) return null;
  const listed = uncovered.slice(0, 20); // the wait grammar takes at most twenty runs
  const lines = [`[Open Habitat] ${uncovered.length === 1 ? 'A Taskfleet run you started is' : `${uncovered.length} Taskfleet runs you started are`} still working, and nothing is waiting for ${uncovered.length === 1 ? 'it' : 'them'}, so nothing will wake you when ${uncovered.length === 1 ? 'it settles' : 'they settle'}:`];
  for (const r of listed) lines.push(`- ${r.run_id} "${r.title}"`);
  if (uncovered.length > listed.length) lines.push(`- and ${uncovered.length - listed.length} more (\`taskfleet run list\`)`);
  lines.push('', `To be woken when the first of them settles, start \`taskfleet run wait ${listed.map(r => r.run_id).join(' ')} --any --output json\` with the process tool (notify on exit). If you do not mean to wait, say briefly why; you will not be reminded about these runs again unless you wait for them later.`);
  return {
    type: 'custom_message', customType: reminderType, display: true, content: lines.join('\n'),
    details: { schema_version: 1, runs: uncovered.map(r => r.run_id), titles: uncovered.map(r => r.title) },
  };
}
export default function (pi) {
  let server, context, extensionVersion = null, shuttingDown = false;
  const launchedAt = Date.now();
  // The rest belongs to this launch only. Left in the environment it would
  // pass to every tool, tmux window and nested Pi this one starts, each of
  // which would then claim the same stop as its own.
  let launchStop = stopFact();
  delete process.env.OPEN_HABITAT_STOP_CAUSE;
  delete process.env.OPEN_HABITAT_STOPPED_AT;
  delete process.env.OPEN_HABITAT_STOP_DETAIL;
  const sockets = new Set();
  const watchers = new Set();
  const outputLeases = new Map();
  let catchUp = null; // this Pi's first run learns what happened while it was stopped
  const ask = (channel, args = {}, allOwners = false) => new Promise((resolve, reject) => {
    let done = false;
    const replies = [];
    const timer = setTimeout(() => { if (!done) { done = true; reject(new Error('extension_missing')); } }, channel === 'command:kill' ? 4500 : 200);
    pi.events.emit(`processes:${channel}`, { ...args, reply(value) {
      if (done) return;
      replies.push(value);
      queueMicrotask(() => {
        if (done) return;
        done = true; clearTimeout(timer);
        if (channel.startsWith('request:') && replies.length !== 1 && !allOwners) reject(new Error('duplicate_owner'));
        else resolve(allOwners ? replies : replies[0]);
      });
    } });
  });
  function send(socket, value) {
    const line = JSON.stringify(value) + '\n';
    if (Buffer.byteLength(line) > maxFrame || socket.writableLength > maxFrame) { socket.destroy(); return; }
    socket.write(line);
  }
  function wakes(p, branch, rule = n => n?.onSuccess === 'turn' || n?.onFailure === 'turn') {
    // Only this child's native start results count. Never rehydrate old owners.
    for (let i = branch.length - 1; i >= 0; --i) {
      const m = branch[i].message;
      const d = m?.details;
      if (m?.role !== 'toolResult' || m.toolName !== 'process' || d?.action !== 'start') continue;
      if (d.process?.id === p.id && d.process?.startTime === p.startTime && p.startTime >= launchedAt) {
        return rule(d.notify);
      }
    }
    return null; // Pending log watches are not observable in 0.10.9.
  }
  async function operation(q) {
    if (q.op === 'notice') {
      const n = q.notice;
      if (!context || shuttingDown || !n || !/^[0-9a-fA-F-]{36}$/.test(n.notice_id ?? '') || n.origin !== 'agent' || typeof n.text !== 'string' || !n.text.trim() || Buffer.byteLength(n.text) > 4096 || !Number.isFinite(Date.parse(n.timestamp))) throw new Error('invalid_request');
      // A native session switch must not redirect an old controller launch's
      // notice into a new conversation in the same Pi process. These values
      // come from the daemon's launch, never from the caller's notice text.
      if (context.sessionManager.getSessionId?.() !== q.session_id || process.env.OPEN_HABITAT_CONVERSATION_ID !== `pi:${q.session_id}` || process.env.OPEN_HABITAT_LAUNCH_GENERATION !== q.generation) return { written: false, reason: 'conversation_mismatch' };
      // appendEntry can update Pi's memory before a filesystem error. Never use
      // that branch as persistence evidence, and never retry it here.
      try { pi.appendEntry('oh-agent-notice', n); return { written: true }; }
      catch { return { written: false, reason: 'native_write_failed' }; }
    }
    // Refuse ambiguous managers before dispatching ANY browser control. Shutdown
    // is different: it intentionally stops every native owner in this Pi.
    const inventories = await ask('request:list', {}, q.op === 'shutdown');
    if (q.op === 'list') {
      const records = inventories;
      if (!Array.isArray(records) || records.length > 200) throw new Error('inventory_unavailable');
      const branch = context.sessionManager.getBranch();
      return { records: records.map(p => ({
        id: p.id, name: p.name, command: String(p.command ?? '').slice(0, 8192),
        startTime: p.startTime, endTime: p.endTime, status: p.status,
        exitCode: p.exitCode, signal: p.signal, endReason: p.endReason,
        wakes_agent: wakes(p, branch),
      })), protocol: 1, extension_version: extensionVersion };
    }
    if (q.op === 'clear') { await ask('command:clear'); return { result: 'cleared' }; }
    if (q.op === 'shutdown') {
      shuttingDown = true;
      const records = inventories.flat();
      await Promise.all(records.filter(live).map(p => ask('command:kill', { id: p.id, signal: 'SIGKILL', timeoutMs: 3000 })));
      return { result: 'stopped' };
    }
    if (!/^proc_[a-f0-9]{4}$/.test(q.id ?? '') || typeof q.token !== 'string') throw new Error('invalid_request');
    const p = await ask('request:get', { id: q.id });
    if (!p || token(p) !== q.token) throw new Error('stale_process');
    // No await between the comparison and bus dispatch: an ID cannot be reissued
    // on the JS event loop in this critical section.
    if (q.op === 'stop') {
      if (typeof q.force !== 'boolean') throw new Error('invalid_request');
      const r = await ask('command:kill', { id: q.id, signal: q.force ? 'SIGKILL' : 'SIGTERM', timeoutMs: 3000 });
      return { result: r.ok ? 'killed' : r.reason === 'timeout' ? 'terminate_timeout' : r.reason === 'not_found' ? 'not_found' : 'error' };
    }
    if (q.op === 'output') {
      if (!Number.isInteger(q.tail_lines) || q.tail_lines < 1 || q.tail_lines > 2000) throw new Error('invalid_request');
      const all = await ask('request:combined_output', { id: q.id, tailLines: q.tail_lines });
      const previous = outputLeases.get(q.id);
      outputLeases.set(q.id, { until: Date.now() + 3000, last: previous?.last ?? 0 });
      if (!Array.isArray(all)) throw new Error('output_unavailable');
      let bytes = 0, wireBytes = 0;
      const lines = [];
      for (const l of all.slice(-q.tail_lines).reverse()) {
        if (!['stdout', 'stderr'].includes(l.type) || typeof l.text !== 'string') continue;
        const text = Buffer.from(l.text).subarray(0, 16384).toString('utf8');
        if (bytes + Buffer.byteLength(text) > 128 * 1024) break;
        const line = { stream: l.type, text };
        const encoded = Buffer.byteLength(JSON.stringify(line)) + 1;
        if (wireBytes + encoded > maxFrame - 4096) break;
        bytes += Buffer.byteLength(text);
        wireBytes += encoded;
        lines.unshift(line);
      }
      return { lines, omitted_before: null, retention_restarted: lines.some(l => l.text === '[log truncated at 64 MB — earlier output discarded]') ? true : null };
    }
    throw new Error('invalid_request');
  }
  const hint = (kind, id) => {
    if (kind === 'process.output') {
      const lease = outputLeases.get(id), now = Date.now();
      if (!lease || lease.until < now) { outputLeases.delete(id); return; }
      if (now - lease.last < 1000) return;
      lease.last = now;
    }
    for (const s of watchers) send(s, { kind, ...(id ? { process_id: id } : {}) });
  };
  pi.on('tool_call', event => {
    if (shuttingDown && event.toolName === 'process' && event.input?.action === 'start') return { block: true, reason: 'Pi is shutting down' };
  });
  pi.events.on('processes:changed', () => hint('process.changed'));
  pi.events.on('processes:output_changed', e => hint('process.output', e.id));
  pi.on('session_start', async (_event, ctx) => {
    context = ctx;
    catchUp = prepareCatchUp(ctx);
    try { extensionVersion = JSON.parse(readFileSync(process.env.OH_PROCESS_PACKAGE, 'utf8')).version; } catch { extensionVersion = null; }
    const path = process.env.OH_PROCESS_SOCKET;
    if (!path || server) return;
    server = net.createServer(socket => {
      if (sockets.size >= 8) { socket.destroy(); return; }
      sockets.add(socket);
      socket.on('error', () => {});
      socket.on('close', () => { sockets.delete(socket); watchers.delete(socket); });
      socket.setTimeout(6000, () => socket.destroy());
      let input = '';
      socket.on('data', chunk => {
        input += chunk.toString('utf8');
        if (Buffer.byteLength(input) > 32768) { socket.destroy(); return; }
        const n = input.indexOf('\n');
        if (n < 0) return;
        socket.removeAllListeners('data');
        let q;
        try { q = JSON.parse(input.slice(0, n)); } catch { socket.destroy(); return; }
        if (q?.op === 'watch') {
          watchers.add(socket); socket.setTimeout(0); send(socket, { kind: 'process.changed' }); return;
        }
        operation(q).then(data => { send(socket, { ok: true, data }); socket.end(); }, e => {
          send(socket, { ok: false, error: ['stale_process', 'invalid_request', 'extension_missing', 'duplicate_owner'].includes(e.message) ? e.message : 'bridge_unavailable' }); socket.end();
        });
      });
    });
    server.on('error', () => { for (const socket of sockets) socket.destroy(); });
    await new Promise(resolve => server.listen(path, () => { chmodSync(path, 0o600); resolve(); }));
  });
  // ADR 0017 as amended: a non-triggering context message on the first run,
  // which only the person's send starts after a restart (ADR 0020).
  function prepareCatchUp(ctx) {
    const stopped = launchStop; // the first session this Pi opens woke from it
    launchStop = null;
    try {
      const branch = ctx.sessionManager.getBranch();
      if (!branch?.length) return null;
      const facts = branchFacts(branch);
      const processes = facts.open.filter(p => p.startTime < launchedAt && !facts.reported.has(key(p))).slice(-20);
      const waited = new Set(processes.filter(p => p.wakes).flatMap(p => waitRuns(p.command)));
      const sessionId = ctx.sessionManager.getSessionId?.();
      const since = branch.reduce((t, e) => Math.max(t, Date.parse(e?.timestamp ?? '') || 0), 0);
      const read = () => typeof sessionId === 'string' && sessionId && ctx.cwd
        ? readSpinoffs({ sessionId, cwd: ctx.cwd, since, waited, reported: facts.runs }).catch(() => unread)
        : Promise.resolve(unread);
      return { processes, spinoffs: read(), read, at: Date.now(), stopped, turnCut: facts.turnCut };
    } catch { return null; }
  }
  pi.on('before_agent_start', async () => {
    const pending = catchUp;
    catchUp = null;
    if (!pending) return;
    // Typing woke this Pi ahead of the message: the person has watched the
    // card follow Taskfleet since, so the agent is told what they now see. A
    // Pi started by the send itself uses the read its start began.
    const current = Date.now() - pending.at > 2000 ? pending.read() : pending.spinoffs;
    let timer;
    const spinoffs = await Promise.race([current, new Promise(resolve => { timer = setTimeout(() => resolve(unread), 3000); })]);
    clearTimeout(timer);
    const message = catchUpMessage(pending.processes, spinoffs, pending.stopped, pending.turnCut);
    return message ? { message } : undefined;
  });
  // A completed run only: Escape or an error is the person's or the provider's
  // stop, not a turn to extend. An earlier handler's continuation reaches this
  // boundary again, so it is checked then. canContinue is false at every
  // ordinary end (the last message is the assistant's); the reminder itself is
  // what lets Pi continue, and Pi checks that again after committing it.
  pi.on('agent_before_settle', async (event, ctx) => {
    if (shuttingDown || event?.outcome !== 'completed' || event.continue) return;
    let timer;
    const reminder = await Promise.race([remindAtSettle(ctx ?? context).catch(() => null), new Promise(resolve => { timer = setTimeout(() => resolve(null), 2000); })]);
    clearTimeout(timer);
    // Returned entries replace the drafts so far; keep earlier handlers'.
    return reminder ? { entries: [...(event.entries ?? []), reminder], continue: true } : undefined;
  });
  async function remindAtSettle(ctx) {
    const sessionId = ctx?.sessionManager?.getSessionId?.();
    if (typeof sessionId !== 'string' || !sessionId || !ctx.cwd) return null;
    const branch = ctx.sessionManager.getBranch();
    const records = await ask('request:list');
    if (!Array.isArray(records)) return null;
    const waits = records.filter(p => p.status === 'running' && wakes(p, branch, wakesOnBoth) === true).map(p => p.command);
    const uncovered = await uncoveredRuns({ sessionId, cwd: ctx.cwd, waits });
    return waitReminder(uncovered, remindedRuns(branch));
  }
  pi.on('session_shutdown', () => {
    for (const socket of sockets) socket.destroy();
    server?.close(); server = undefined;
  });
}
