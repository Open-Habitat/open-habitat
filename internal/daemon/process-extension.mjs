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
// The daemon's narrow Taskfleet wait grammar (processes_linux.go taskfleetWait).
export function waitRuns(command) {
  if (typeof command !== 'string' || /[|&;<>($`\\"'\n\r)]/.test(command)) return [];
  const words = command.trim().split(/\s+/);
  const bin = words[0] ?? '';
  if (words.length < 4 || !(bin === 'taskfleet' || bin.startsWith('/') && bin.endsWith('/taskfleet')) || words[1] !== 'run' || words[2] !== 'wait') return [];
  const ids = [];
  for (let i = 3; i < words.length; ++i) {
    const w = words[i];
    if (['--all', '--any', '--fail-on-error', '--progress', '--json'].includes(w)) continue;
    if (['--timeout', '--poll-interval', '--output'].includes(w)) {
      const v = words[++i];
      if (v === undefined || w === '--output' && !['json', 'jsonl', 'text'].includes(v)) return [];
      if (w !== '--output' && !/^[1-9][0-9]*$|^[0-9.]+(ns|us|µs|ms|s|m|h)([0-9.]+(ns|us|µs|ms|s|m|h))*$/.test(v)) return [];
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
export function branchFacts(branch) {
  const open = new Map(), order = [], reported = new Set(), runs = new Set();
  for (const entry of branch) {
    const m = entry?.message;
    const custom = entry?.type === 'custom_message' ? entry : m?.role === 'custom' ? m : null;
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
  return { open: order.filter(p => open.get(p.id) === p), reported, runs };
}
function taskfleet(args, cwd) {
  return new Promise(resolve => execFile('taskfleet', args, { cwd, timeout: 2500, maxBuffer: 4 << 20, env: process.env }, (error, stdout) => {
    if (error) { resolve(null); return; }
    try { const v = JSON.parse(stdout); resolve(v?.schema_version === 1 ? v.data : null); } catch { resolve(null); }
  }));
}
function spinoffState(r) {
  if (r.landed) return 'merged';
  if (r.stalled) return 'stalled';
  if (r.attention_required || r.awaiting_input) return 'awaiting';
  return { done: 'not_merged', failed: 'failed', cancelled: 'cancelled' }[r.status] ?? null;
}
// Only the user's own Taskfleet records: runs this conversation created that
// settled after the branch's last entry, and the ones it was waiting for.
export async function readSpinoffs({ sessionId, cwd, since, waited, reported, read = taskfleet }) {
  const result = { settled: [], rearm: [] };
  const list = await read(['run', 'list', '--output', 'json'], cwd);
  if (!Array.isArray(list?.runs)) return result;
  const belongs = r => typeof r?.source_repo === 'string' && r.source_repo.startsWith('/') &&
    runPattern.test(r?.run_id ?? '') && ['spinoff', 'research', 'technical-decision', 'fan-out'].includes(r.kind) && r.agent_owner !== 'caller' && r.created_by_run_id == null && r.created_by_session?.harness === 'pi' && r.created_by_session.session_id === sessionId;
  const mine = list.runs.filter(belongs);
  const live = r => ['pending', 'running'].includes(r.status) && !r.attention_required && !r.awaiting_input && !r.stalled;
  // A waited-for run is always looked at; the rest only up to a bounded number of reads.
  const others = mine.filter(r => !waited.has(r.run_id) && !live(r)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 20);
  await Promise.all([...mine.filter(r => waited.has(r.run_id)), ...others].map(async r => {
    const title = String(r.title ?? '').slice(0, 200);
    // List is inventory; show carries the verified landed flag, stall and update time.
    const d = await read(['run', 'show', r.run_id, '--output', 'json'], cwd);
    if (d?.run_id !== r.run_id || !belongs(d)) return;
    const state = spinoffState(d);
    if (!state) {
      if (waited.has(r.run_id) && live(d)) result.rearm.push({ run_id: r.run_id, title });
      return;
    }
    // A stall is computed when read and never advances the record's time, and
    // anything the agent was waiting for is news; others must be newer than the branch.
    const fresh = waited.has(r.run_id) || state === 'stalled' || Date.parse(d.manifest?.updated_at ?? '') > since;
    if (fresh && !reported.has(`${r.run_id}:${state}`)) result.settled.push({ run_id: r.run_id, title, state });
  }));
  return result;
}
const stateText = { merged: 'finished and merged', not_merged: 'finished, not merged', failed: 'failed', cancelled: 'cancelled', awaiting: 'is waiting for you (needs attention)', stalled: 'stalled (its supervisor stopped)' };
export function catchUpMessage(processes, spinoffs) {
  if (!processes.length && !spinoffs.settled.length) return null;
  const lines = ['[Open Habitat] This conversation\'s Pi had stopped (for example a server restart) and was started again for the message that follows. While it was stopped:'];
  if (processes.length) {
    lines.push('', 'Background processes that were cut off when Pi stopped (they are no longer running and their output is gone):');
    for (const p of processes) lines.push(`- ${p.id} "${p.name.slice(0, 200)}": ${p.command.slice(0, 300)}`);
  }
  if (spinoffs.settled.length) {
    lines.push('', 'Spinoffs that settled:');
    for (const r of spinoffs.settled) lines.push(`- ${r.run_id} "${r.title}" ${stateText[r.state]}`);
  }
  if (spinoffs.rearm.length) {
    const ids = spinoffs.rearm.map(r => r.run_id).join(' ');
    lines.push('', `Still running, and your wait for them was cut off: ${spinoffs.rearm.map(r => `${r.run_id} "${r.title}"`).join(', ')}. Nothing will tell you when they settle unless you wait again: start \`taskfleet run wait ${ids} --output json\` with the process tool (notify on exit), as you did before.`);
  }
  return {
    customType: catchUpType, display: true, content: lines.join('\n'),
    details: { schema_version: 1, processes: processes.map(p => ({ id: p.id, startTime: p.startTime })), spinoffs: spinoffs.settled.map(r => ({ run_id: r.run_id, state: r.state })), rearm: spinoffs.rearm.map(r => r.run_id) },
  };
}
export default function (pi) {
  let server, context, extensionVersion = null, shuttingDown = false;
  const launchedAt = Date.now();
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
  function wakes(p, branch) {
    // Only this child's native start results count. Never rehydrate old owners.
    for (let i = branch.length - 1; i >= 0; --i) {
      const m = branch[i].message;
      const d = m?.details;
      if (m?.role !== 'toolResult' || m.toolName !== 'process' || d?.action !== 'start') continue;
      if (d.process?.id === p.id && d.process?.startTime === p.startTime && p.startTime >= launchedAt) {
        return d.notify?.onSuccess === 'turn' || d.notify?.onFailure === 'turn';
      }
    }
    return null; // Pending log watches are not observable in 0.10.9.
  }
  async function operation(q) {
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
        if (Buffer.byteLength(input) > 8192) { socket.destroy(); return; }
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
    try {
      const branch = ctx.sessionManager.getBranch();
      if (!branch?.length) return null;
      const facts = branchFacts(branch);
      const processes = facts.open.filter(p => p.startTime < launchedAt && !facts.reported.has(key(p))).slice(-20);
      const waited = new Set(processes.filter(p => p.wakes).flatMap(p => waitRuns(p.command)));
      const sessionId = ctx.sessionManager.getSessionId?.();
      const since = branch.reduce((t, e) => Math.max(t, Date.parse(e?.timestamp ?? '') || 0), 0);
      const spinoffs = typeof sessionId === 'string' && sessionId && ctx.cwd
        ? readSpinoffs({ sessionId, cwd: ctx.cwd, since, waited, reported: facts.runs }).catch(() => ({ settled: [], rearm: [] }))
        : Promise.resolve({ settled: [], rearm: [] });
      return { processes, spinoffs };
    } catch { return null; }
  }
  pi.on('before_agent_start', async () => {
    const pending = catchUp;
    catchUp = null;
    if (!pending) return;
    let timer;
    const spinoffs = await Promise.race([pending.spinoffs, new Promise(resolve => { timer = setTimeout(() => resolve({ settled: [], rearm: [] }), 3000); })]);
    clearTimeout(timer);
    const message = catchUpMessage(pending.processes, spinoffs);
    return message ? { message } : undefined;
  });
  pi.on('session_shutdown', () => {
    for (const socket of sockets) socket.destroy();
    server?.close(); server = undefined;
  });
}
