import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ExtensionRunner, SessionManager } from '@earendil-works/pi-coding-agent';
import companion, { guardSessionWrites } from '../process-extension.mjs';

function scratch(t) {
  const dir = fs.mkdtempSync(join(tmpdir(), 'oh-tail-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function fixture(t) {
  const dir = scratch(t);
  const sm = SessionManager.create(dir, dir);
  sm.appendMessage({ role: 'user', content: 'saved', timestamp: 1 });
  return { sm, file: sm.getSessionFile(), saved: fs.readFileSync(sm.getSessionFile()) };
}

// Exercise the pinned _persist and _appendEntry, not a substitute appender.
// Only the filesystem call is faulted: it writes `torn(data)` to the session
// file, then reports EDQUOT, as a write cut short at a full quota does.
function failing(name, sm, torn, run) {
  const original = fs[name];
  const error = Object.assign(new Error('synthetic full quota'), { code: 'EDQUOT' });
  fs[name] = (target, data, ...args) => {
    const ours = typeof target === 'number' || target === sm.getSessionFile();
    const cut = ours ? torn(Buffer.from(data)) : undefined;
    if (cut === undefined) return original(target, data, ...args);
    original(target, cut, ...args);
    throw error;
  };
  syncBuiltinESMExports();
  try { assert.throws(run, e => e === error); }
  finally { fs[name] = original; syncBuiltinESMExports(); }
  return error;
}
const tear = (sm, torn = data => data.subarray(0, 53)) =>
  failing('appendFileSync', sm, torn, () => sm.appendCustomEntry('failed', { text: 'x'.repeat(1000) }));
const foreign = () => Buffer.from('{"not":"this call\'s"');

const lines = file => fs.readFileSync(file, 'utf8').trimEnd().split('\n');

test('pinned Pi glues a later successful entry onto the failed append and loses it on reload', t => {
  const { sm, file, saved } = fixture(t);
  const leaf = sm.getLeafId();
  tear(sm);
  assert.equal(sm.getLeafId(), leaf, 'native rollback restores the parent');
  assert.equal(fs.statSync(file).size, saved.length + 53);
  const next = sm.appendCustomEntry('next', { kept: true });
  assert.throws(() => JSON.parse(lines(file).at(-1)));
  assert.ok(sm.getEntry(next), 'successful append exists in live memory');
  assert.equal(SessionManager.open(file).getEntry(next), undefined, 'loader silently skips the glued line');
});

test('a torn append is cut back to the file it extended, and the conversation carries on', t => {
  const { sm, file, saved } = fixture(t);
  let stops = 0;
  guardSessionWrites(sm, () => { stops++; });
  const leaf = sm.getLeafId();
  tear(sm);
  assert.deepEqual(fs.readFileSync(file), saved, 'exactly the failed call\'s bytes are gone');
  assert.equal(sm.getLeafId(), leaf);
  tear(sm, () => Buffer.alloc(0)); // nothing written: nothing to cut
  assert.deepEqual(fs.readFileSync(file), saved);
  const next = sm.appendCustomEntry('next', { kept: true });
  const reopened = SessionManager.open(file);
  assert.equal(reopened.getEntry(next)?.parentId, leaf);
  for (const line of lines(file)) JSON.parse(line);
  assert.equal(stops, 0, 'a proven rollback does not stop Pi');
});

test('a first write cut short removes the file it created, so the next write starts it again', t => {
  const dir = scratch(t);
  const sm = SessionManager.create(dir, dir);
  guardSessionWrites(sm, () => assert.fail('a proven rollback does not stop Pi'));
  let calls = 0;
  // The first flush writes the header, then the message: cut the message.
  failing('writeFileSync', sm, data => (++calls === 2 ? data.subarray(0, 20) : undefined),
    () => sm.appendMessage({ role: 'user', content: 'lost', timestamp: 1 }));
  assert.equal(fs.existsSync(sm.getSessionFile()), false);
  const id = sm.appendMessage({ role: 'user', content: 'again', timestamp: 2 });
  assert.ok(SessionManager.open(sm.getSessionFile()).getEntry(id));
});

test('bytes not proven to be the failed call\'s are kept, later appends refused and Pi stopped, also across reload', async t => {
  // The watchdog stays armed until the process ends; keep it off this one.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { sm, file, saved } = fixture(t);
  const hooks = new Map();
  const socket = process.env.OH_PROCESS_SOCKET;
  delete process.env.OH_PROCESS_SOCKET;
  t.after(() => { if (socket !== undefined) process.env.OH_PROCESS_SOCKET = socket; });
  companion({ on: (name, fn) => hooks.set(name, fn), events: { on() {}, emit() {} } });
  // The pinned runner exposes the actual manager through its typed context.
  // If that becomes a facade, installation must fail, not silently claim
  // that writes are protected.
  const runner = new ExtensionRunner([], {}, undefined, sm, {});
  let aborts = 0, shutdowns = 0;
  runner.abortFn = () => { aborts++; };
  runner.shutdownHandler = () => { shutdowns++; };
  await hooks.get('session_start')({}, runner.createContext());
  t.after(() => hooks.get('session_shutdown')({ type: 'session_shutdown', reason: 'quit' }));
  const leaf = sm.getLeafId();
  const error = tear(sm, foreign);
  const torn = fs.readFileSync(file);
  assert.equal(torn.length, saved.length + foreign().length);
  // Another synchronous append can come before the shutdown microtask.
  assert.throws(() => sm.appendCustomEntry('notice', {}), e => e === error);
  assert.equal(sm.getLeafId(), leaf);
  await Promise.resolve();
  assert.equal(aborts, 1);
  assert.equal(shutdowns, 1);
  // /reload does not make the same failed writer safe again.
  await hooks.get('session_start')({ reason: 'reload' }, runner.createContext());
  assert.throws(() => sm.appendMessage({ role: 'user', content: 'later', timestamp: 2 }), e => e === error);
  assert.deepEqual(fs.readFileSync(file), torn, 'no byte appended, truncated or rewritten');
  assert.notEqual(torn.at(-1), 10, 'damage stays an unterminated final tail for the daemon to cut');
});

test('a first write refused because someone else created the file removes nothing', t => {
  const dir = scratch(t);
  const sm = SessionManager.create(dir, dir);
  let stops = 0;
  guardSessionWrites(sm, () => { stops++; });
  const open = fs.openSync;
  fs.openSync = (p, flags, ...a) => {
    if (p === sm.getSessionFile() && flags === 'wx') fs.writeFileSync(p, ''); // the other creator wins
    return open(p, flags, ...a);
  };
  syncBuiltinESMExports();
  try { assert.throws(() => sm.appendMessage({ role: 'user', content: 'x', timestamp: 1 }), { code: 'EEXIST' }); }
  finally { fs.openSync = open; syncBuiltinESMExports(); }
  assert.equal(fs.existsSync(sm.getSessionFile()), true, 'their file stays');
  assert.throws(() => sm.appendMessage({ role: 'user', content: 'y', timestamp: 2 }), { code: 'EEXIST' });
});

test('a bigger tail than the call could write, or an unknown starting size, is not cut', t => {
  for (const unknownSize of [false, true]) {
    const { sm, file, saved } = fixture(t);
    let stops = 0;
    guardSessionWrites(sm, () => { stops++; });
    const stat = fs.statSync;
    if (unknownSize) {
      fs.statSync = (p, ...a) => { if (p === file) throw Object.assign(new Error('EIO'), { code: 'EIO' }); return stat(p, ...a); };
      syncBuiltinESMExports();
    }
    try { tear(sm, unknownSize ? data => data.subarray(0, 53) : data => Buffer.concat([data, Buffer.from('more')])); }
    finally { fs.statSync = stat; syncBuiltinESMExports(); }
    assert.ok(fs.statSync(file).size > saved.length, 'the tail is left for the daemon');
    assert.throws(() => sm.appendCustomEntry('blocked', {}), { code: 'EDQUOT' });
  }
});

test('in-memory sessions keep native behavior, and a missing seam fails setup', t => {
  const memory = SessionManager.inMemory('/synthetic');
  guardSessionWrites(memory, () => assert.fail('in-memory append failed'));
  assert.ok(memory.getEntry(memory.appendCustomEntry('memory', {})));
  assert.throws(() => guardSessionWrites({}, () => {}), /session_write_guard_unavailable/);
});

function rpc(t, file, command) {
  const dir = scratch(t);
  const cli = fileURLToPath(new URL('./node_modules/@earendil-works/pi-coding-agent/dist/cli.js', import.meta.url));
  const child = spawn(process.execPath, [cli, '--mode', 'rpc', '--no-extensions', '--no-skills', '--no-prompt-templates', '--no-themes',
    '-e', fileURLToPath(new URL('../process-extension.mjs', import.meta.url)),
    '-e', fileURLToPath(new URL('./fixtures/session-write-rpc.mjs', import.meta.url)), '--session', file], {
    cwd: dir, env: { PATH: process.env.PATH, HOME: dir, PI_CODING_AGENT_DIR: join(dir, 'agent'), TMPDIR: tmpdir() },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
  const out = { stdout: '', stderr: '' };
  child.stdout.on('data', b => { out.stdout += b; });
  child.stderr.on('data', b => { out.stderr += b; });
  child.stdin.write(`${JSON.stringify({ id: 'tear-test', type: 'prompt', message: command })}\n`);
  return { child, out };
}
const rows = stdout => stdout.split('\n').filter(Boolean).map(line => JSON.parse(line));

test('native RPC: a torn append is undone and the same Pi keeps writing', { timeout: 15000 }, async t => {
  const { file } = fixture(t);
  const { child, out } = rpc(t, file, '/tear prefix');
  const deadline = Date.now() + 10000;
  while (!fs.existsSync(`${file}.test-proof`) && Date.now() < deadline) await new Promise(r => setTimeout(r, 50));
  assert.ok(fs.existsSync(`${file}.test-proof`), out.stderr);
  assert.equal(child.exitCode, null, 'Pi was not stopped');
  child.stdin.end();
  await once(child, 'close');
  const reopened = SessionManager.open(file);
  assert.ok(reopened.getEntries().some(e => e.type === 'custom' && e.customType === 'after-room'));
  for (const line of lines(file)) JSON.parse(line);
  assert.doesNotMatch(out.stderr, /session_write_failed/);
});

test('native RPC: unproven bytes stop Pi with its input still open and the tail untouched', { timeout: 15000 }, async t => {
  const { file } = fixture(t);
  const { child, out } = rpc(t, file, '/tear foreign');
  // Deliberately do not close stdin: EOF would hide a broken shutdown hook.
  const [code, signal] = await once(child, 'close');
  assert.equal(signal, null, out.stderr);
  assert.equal(code, 0, out.stderr);
  assert.match(out.stderr, /session_write_failed/);
  assert.ok(rows(out.stdout).some(row => row.type === 'extension_error' && row.error === 'synthetic full quota'), out.stdout);
  assert.deepEqual(fs.readFileSync(file), fs.readFileSync(`${file}.test-proof`));
  assert.notEqual(fs.readFileSync(file).at(-1), 10);
});

for (const mode of ['hang', 'hang-shutdown']) test(`native RPC: when Pi ${mode === 'hang' ? 'cannot become idle' : 'hangs in a later shutdown handler'}, the companion still ends it in bounded time`, { timeout: 30000 }, async t => {
  const { file } = fixture(t);
  const started = Date.now();
  const { child, out } = rpc(t, file, `/tear ${mode}`);
  const [code, signal] = await once(child, 'close');
  assert.ok(code === 143 || signal === 'SIGTERM', `${code} ${signal} ${out.stderr}`);
  assert.ok(Date.now() - started < 25000);
  assert.match(out.stderr, /session_write_failed/);
  assert.deepEqual(fs.readFileSync(file), fs.readFileSync(`${file}.test-proof`));
});
