// Every tool the Claude bridge serves from Pi reaches Pi's tool_call before it
// runs (ADR 0038 section 4). The pinned pi-claude-bridge, with the release's
// own patch (runtime/core/bridge-patch.json), drives a stand-in Claude Code
// that calls the served tool the way Claude Code does: a tool_use block in its
// stream and a tools/call on the bridge's in-process MCP server. The bridge
// must run nothing itself: the call is Pi's, so the companion's turn mode
// decides it. The same patch turns Claude Code's built-in WebSearch and
// WebFetch, which run outside Pi's dispatch, off for a turn without tools.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const cli = resolve(here, 'node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js');
const companion = resolve(here, '../process-extension.mjs');
const fixtures = resolve(here, 'fixtures/turn-modes');
const patch = JSON.parse(readFileSync(resolve(here, '../../../runtime/core/bridge-patch.json'), 'utf8'));

async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'oh-bt-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  // The bridge as the release ships it: the pinned source with the patch.
  const bridge = join(root, 'bridge');
  await cp(resolve(here, 'node_modules/pi-claude-bridge'), bridge, { recursive: true });
  const index = join(bridge, 'src/index.ts');
  const source = await readFile(index, 'utf8');
  assert.equal(source.split(patch.old).length, 2, 'the release patch applies exactly once to the pinned bridge');
  await writeFile(index, source.replace(patch.old, patch.new));
  await symlink(resolve(here, 'node_modules'), join(bridge, 'node_modules'));
  const agent = join(root, 'agent');
  await mkdir(agent, { recursive: true });
  const fake = join(root, 'claude');
  await cp(join(fixtures, 'fake-claude.mjs'), fake);
  await chmod(fake, 0o700);
  await writeFile(join(agent, 'claude-bridge.json'), JSON.stringify({ provider: { pathToClaudeCodeExecutable: fake } }), { mode: 0o600 });
  const f = { root, agent, cwd: join(root, 'work'), marks: join(root, 'marks'), log: join(root, 'claude.log'), hostile: join(root, 'hostile'), index };
  await mkdir(f.cwd);
  await writeFile(f.marks, ''); await writeFile(f.log, ''); await writeFile(f.hostile, '');
  return f;
}

async function launch(t, f) {
  const sessionId = randomUUID(), generation = randomUUID();
  const socket = join(f.root, 'b.sock');
  const child = spawn(process.execPath, [cli, '--mode', 'rpc', '--provider', 'claude-bridge', '--model', 'claude-opus-4-5', '--tools', 'mark',
    '--session-dir', join(f.root, 'sessions'), '--session-id', sessionId,
    '--extension', f.index, '--extension', join(fixtures, 'fixture.mjs'), '--extension', companion, '--extension', join(fixtures, 'hostile-after.mjs')], {
    cwd: f.cwd, stdio: ['pipe', 'pipe', 'pipe'],
    env: { HOME: f.root, PATH: process.env.PATH, PI_CODING_AGENT_DIR: f.agent, CLAUDE_CONFIG_DIR: join(f.root, 'claude-config'), PI_OFFLINE: '1',
      FIXTURE_URL: 'http://127.0.0.1:9/v1', MARK_FILE: f.marks, HOSTILE_LOG: f.hostile, FAKE_CLAUDE_LOG: f.log, OH_PROCESS_SOCKET: socket,
      OPEN_HABITAT_CONVERSATION_ID: `pi:${sessionId}`, OPEN_HABITAT_LAUNCH_GENERATION: generation },
  });
  const closed = new Promise(r => child.on('close', r));
  t.after(async () => { child.kill('SIGKILL'); await closed; });
  const events = [], waiters = new Set();
  let buffer = '', stderr = '';
  child.stderr.on('data', c => { stderr += c; });
  child.stdout.on('data', c => {
    buffer += c;
    let n;
    while ((n = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, n); buffer = buffer.slice(n + 1);
      try { events.push(JSON.parse(line)); } catch { continue; }
      for (const w of waiters) w();
    }
  });
  const until = (predicate, label, ms = 30000) => new Promise((ok, fail) => {
    const check = () => { const found = events.find(predicate); if (found) { waiters.delete(check); clearTimeout(timer); ok(found); } };
    const timer = setTimeout(() => { waiters.delete(check); fail(new Error(`timed out waiting for ${label}\n${stderr.slice(-3000)}\n${readFileSync(f.log, 'utf8').slice(-2000)}`)); }, ms);
    waiters.add(check); check();
  });
  child.stdin.write(JSON.stringify({ type: 'get_state', id: 'state' }) + '\n');
  await until(e => e.type === 'response' && e.id === 'state', 'get_state');
  for (let i = 0; i < 100 && !existsSync(socket); i++) await new Promise(r => setTimeout(r, 50));
  const bridgeOp = request => new Promise((ok, fail) => {
    const c = net.createConnection(socket);
    let data = '';
    c.on('error', fail);
    c.on('data', d => { data += d; });
    c.on('end', () => { try { ok(JSON.parse(data)); } catch (e) { fail(e); } });
    c.write(JSON.stringify({ session_id: sessionId, generation, ...request }) + '\n');
  });
  return { child, events, until, bridgeOp };
}

const claudeLog = async f => (await readFile(f.log, 'utf8')).split('\n').filter(Boolean).map(l => JSON.parse(l));
const toolsArg = argv => { const a = argv.find(x => x.startsWith('--tools=')); return a === undefined ? null : a.slice('--tools='.length); };

test('a served tool the bridge forwards runs through Pi\'s tool_call: blocked in a participant\'s turn', async t => {
  const f = await setup(t);
  const pi = await launch(t, f);
  const message = { message_id: randomUUID(), subject: 'github:4242', display_name: 'Example Guest', role: 'participant', generation: 2, text: 'Mark it.', at: new Date().toISOString() };
  assert.deepEqual((await pi.bridgeOp({ op: 'participant_message', message })).data, { delivered: true });
  await pi.until(e => e.type === 'agent_settled', 'agent_settled');
  const log = await claudeLog(f);
  assert.equal(log.find(l => l.error), undefined, JSON.stringify(log));
  // Pi received the call the bridge forwarded and the companion blocked it
  // with terminate, so the run ended there; the bridge replaces its parked
  // Claude Code query at the next turn.
  const ended = pi.events.filter(e => e.type === 'tool_execution_end');
  assert.equal(ended.length, 1, JSON.stringify(ended));
  assert.equal(ended[0].toolName, 'mark');
  assert.ok(ended[0].isError && JSON.stringify(ended[0].result).includes('no tools'), JSON.stringify(ended[0]));
  assert.deepEqual((await readFile(f.marks, 'utf8')).split('\n').filter(Boolean), [], 'the tool did not run');
  assert.deepEqual((await readFile(f.hostile, 'utf8')).split('\n').filter(Boolean), []);
  assert.equal(toolsArg(log[0].argv), '', 'no built-in WebSearch or WebFetch in a turn without tools');
});

test('the same call in the owner\'s turn runs once, through Pi, with the web tools on', async t => {
  const f = await setup(t);
  const pi = await launch(t, f);
  pi.child.stdin.write(JSON.stringify({ type: 'prompt', message: 'Mark it.', id: 'p1' }) + '\n');
  await pi.until(e => e.type === 'agent_settled', 'agent_settled');
  const log = await claudeLog(f);
  assert.match(JSON.stringify(log.find(l => l.mcp)?.mcp), /marked via-bridge/);
  assert.deepEqual((await readFile(f.marks, 'utf8')).split('\n').filter(Boolean), ['via-bridge'], 'Pi ran it, once');
  assert.equal((await readFile(f.hostile, 'utf8')).split('\n').filter(Boolean).length, 1, 'the call went through Pi\'s tool_call');
  assert.equal(toolsArg(log[0].argv), 'WebSearch,WebFetch');
});
