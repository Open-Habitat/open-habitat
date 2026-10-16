// Product companion. pi-processes remains the sole registry, log and signal owner.
import net from 'node:net';
import { chmodSync, readFileSync } from 'node:fs';

const live = p => ['running', 'terminating', 'terminate_timeout'].includes(p.status);
const token = p => `pt_${p.startTime}`;
const maxFrame = 256 * 1024;
export default function (pi) {
  let server, context, extensionVersion = null, shuttingDown = false;
  const launchedAt = Date.now();
  const sockets = new Set();
  const watchers = new Set();
  const outputLeases = new Map();
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
  pi.on('session_shutdown', () => {
    for (const socket of sockets) socket.destroy();
    server?.close(); server = undefined;
  });
}
