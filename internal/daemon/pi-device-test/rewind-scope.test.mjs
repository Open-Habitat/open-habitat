// What Palaa tähän may write: only what the agent changed from the chosen
// message on, never a file Git ignores (decided 21.11.2026). Drives the
// production extension's hooks and /oh-rewind command against a synthetic
// home, workspace and session tree with real turn snapshots.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const { default: extension, CHECKPOINT } = await import('../rewind-extension.mjs');
const { takeSnapshot } = await import('../turn-snapshots/src/turn-snapshots/store.ts');

// A home with the switch on, a workspace and a Pi-like session tree: entries
// have parents, navigation moves the leaf as Pi's does (a person's message
// goes back into the field, so the leaf becomes its parent).
async function harness({ repository = true } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'oh-rewind-scope-'));
  const oldHome = process.env.HOME;
  process.env.HOME = root;
  const ws = join(root, 'workspace'), agent = join(root, '.pi', 'agent'), outside = join(root, 'notes');
  await mkdir(ws); await mkdir(agent, { recursive: true }); await mkdir(outside);
  await mkdir(join(root, '.config', 'open-habitat'), { recursive: true });
  await writeFile(join(root, '.config', 'open-habitat', 'preferences.json'), JSON.stringify({ experimental: { 'rewind-conversation': true } }));
  const session = join(agent, 'session.jsonl');
  await writeFile(session, '');
  const git = (...args) => execFileSync('git', ['-C', ws, ...args], { env: { PATH: process.env.PATH, HOME: root, GIT_CONFIG_NOSYSTEM: '1' } });
  await writeFile(join(ws, '.gitignore'), 'ignored.txt\n');
  await writeFile(join(ws, 'a.txt'), 'initial\n');
  await writeFile(join(ws, 'ignored.txt'), 'ignored initial\n');
  await writeFile(join(outside, 'out.txt'), 'outside initial\n');
  if (repository) {
    git('init', '-q', '-b', 'main');
    git('add', '.'); git('-c', 'user.name=Synthetic', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'initial');
  }
  const entries = [], hooks = new Map(), commands = new Map(), outcomes = [];
  let seq = 0, leaf = null;
  const add = (entry) => { const e = { ...entry, id: entry.id ?? `e${++seq}`, parentId: leaf }; entries.push(e); leaf = e.id; return e; };
  const byId = (id) => entries.find((e) => e.id === id);
  const branchOf = (id) => { const out = []; for (let e = id ? byId(id) : undefined; e; e = e.parentId ? byId(e.parentId) : undefined) out.unshift(e); return out; };
  const pi = {
    on: (name, fn) => hooks.set(name, fn),
    appendEntry: (customType, data) => add({ type: 'custom', customType, data }),
    registerCommand: (name, command) => commands.set(name, command),
    sendMessage: (m) => add({ type: 'custom_message', customType: m.customType }),
  };
  extension(pi);
  const ctx = {
    cwd: ws, isIdle: () => true, hasPendingMessages: () => false,
    ui: { notify: (text) => outcomes.push(JSON.parse(text.slice('oh-rewind:'.length))) },
    navigateTree: async (id) => { const e = byId(id); leaf = e.type === 'message' && e.message.role === 'user' ? e.parentId : id; await hooks.get('session_tree')({}, ctx); return { cancelled: false }; },
    sessionManager: {
      getEntries: () => entries, getBranch: (id = leaf) => branchOf(id), getSessionId: () => 'session', getSessionFile: () => session,
      getEntry: byId, getLeafId: () => leaf,
    },
  };
  const snapshot = async (userEntryId, phase) => {
    const s = await takeSnapshot({ agentDir: agent, storeId: 'session', cwd: ws, sessionFile: session, label: `${userEntryId}-${phase}-${seq}` });
    if (repository) assert.ok(s.tree, `snapshot ${userEntryId} ${phase}`);
    add({ type: 'custom', customType: 'turn-snapshot', data: { version: 1, userEntryId, phase, tree: s.tree, store: 'session', root: s.root, cwd: ws, timestamp: s.startedAt, reason: s.reason, skipped: s.skipped, ...(phase === 'end' ? { outcome: 'completed' } : {}) } });
  };
  // One turn: the person's message, its start snapshot, the agent's writes
  // through the write tool (copied first by the hook), an end snapshot and
  // a reply.
  const turn = async (id, writes = [], shell = async () => {}) => {
    add({ id, type: 'message', message: { role: 'user', content: [{ type: 'text', text: id }] } });
    await snapshot(id, 'start');
    await hooks.get('message_end')({ message: { role: 'user' } }, ctx);
    await hooks.get('message_start')({ message: { role: 'assistant' } }, ctx);
    for (const [path, content] of writes) {
      await hooks.get('tool_call')({ toolName: 'write', input: { path, content } }, ctx);
      await writeFile(path.startsWith('/') ? path : join(ws, path), content);
    }
    await shell();
    await snapshot(id, 'end');
    add({ id: `${id}-reply`, type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'done' }] } });
  };
  const command = async (args) => { await commands.get('oh-rewind').handler(JSON.stringify(args), ctx); return outcomes.at(-1); };
  const read = (path) => readFile(path.startsWith('/') ? path : join(ws, path), 'utf8');
  await hooks.get('session_start')({}, ctx);
  const close = async () => { process.env.HOME = oldHome; await rm(root, { recursive: true, force: true }); };
  return { ws, outside, entries, turn, command, read, close, markers: () => entries.filter((e) => e.customType === 'oh-rewind'), add, git, rebuild: () => hooks.get('session_tree')({}, ctx) };
}

test('a file only the person changed since the chosen message stays, even if an earlier turn tracked it', async () => {
  const h = await harness();
  try {
    await h.turn('u1', [['a.txt', 'agent first turn\n']]);
    await h.turn('u2');
    await writeFile(join(h.ws, 'a.txt'), 'person after second turn\n');
    const done = await h.command({ action: 'rewind', entry: 'u2', conversation: false, files: true });
    assert.equal(done.outcome, 'done');
    assert.equal(await h.read('a.txt'), 'person after second turn\n', 'no agent run from u2 on changed it');
    assert.equal(done.restored, 0);
    // From u1 on the agent did change it: it goes back whole, as the sheet warns.
    assert.equal((await h.command({ action: 'rewind', entry: 'u1', conversation: false, files: true })).restored, 1);
    assert.equal(await h.read('a.txt'), 'initial\n');
  } finally { await h.close(); }
});

test('an ignored file the agent wrote is never restored, from its copies or a snapshot', async () => {
  const h = await harness();
  try {
    await h.turn('u1', [['a.txt', 'agent first turn\n'], ['ignored.txt', 'agent ignored edit\n']]);
    const done = await h.command({ action: 'rewind', entry: 'u1', conversation: false, files: true });
    assert.deepEqual([done.outcome, done.restored, done.errors], ['done', 1, 0]);
    assert.equal(await h.read('a.txt'), 'initial\n');
    assert.equal(await h.read('ignored.txt'), 'agent ignored edit\n');
    // It is still copied for a switch back, never written.
    const marker = h.markers().at(-1);
    assert.ok(marker.data.before['ignored.txt']);
    assert.deepEqual(marker.data.files.paths, []);
  } finally { await h.close(); }
});

test('the copies still restore what no snapshot can see: a file outside the repository the agent wrote', async () => {
  const h = await harness();
  const out = join(h.outside, 'out.txt');
  try {
    await h.turn('u1', [[out, 'agent outside u1\n']]);
    await h.turn('u2', [[out, 'agent outside u2\n']]);
    await h.turn('u3');
    // Restore to u2: the agent wrote it in u2, so it goes back to the u2 copy.
    const done = await h.command({ action: 'rewind', entry: 'u2', conversation: false, files: true });
    assert.deepEqual([done.restored, done.errors], [1, 0]);
    assert.equal(await readFile(out, 'utf8'), 'agent outside u1\n');
    // And the restore can be undone.
    const undone = await h.command({ action: 'undo', marker: h.markers().at(-1).id });
    assert.deepEqual([undone.outcome, undone.restored], ['done', 1]);
    assert.equal(await readFile(out, 'utf8'), 'agent outside u2\n');
    // Restore to u3: nothing the agent did from u3 on touched it.
    await writeFile(out, 'person outside\n');
    assert.equal((await h.command({ action: 'rewind', entry: 'u3', conversation: false, files: true })).restored, 0);
    assert.equal(await readFile(out, 'utf8'), 'person outside\n');
  } finally { await h.close(); }
});

test('a folder that is not a repository keeps its copies, limited to what the agent wrote since', async () => {
  const h = await harness({ repository: false });
  try {
    await h.turn('u1', [['a.txt', 'agent first turn\n'], ['ignored.txt', 'agent plain edit\n']]);
    await h.turn('u2');
    await writeFile(join(h.ws, 'a.txt'), 'person\n');
    assert.equal((await h.command({ action: 'rewind', entry: 'u2', conversation: false, files: true })).restored, 0);
    assert.equal(await h.read('a.txt'), 'person\n');
    // Without Git nothing is ignored; a .gitignore there means nothing.
    assert.equal((await h.command({ action: 'rewind', entry: 'u1', conversation: false, files: true })).restored, 2);
    assert.equal(await h.read('a.txt'), 'initial\n');
    assert.equal(await h.read('ignored.txt'), 'ignored initial\n');
  } finally { await h.close(); }
});

test('switching back to a replaced continuation leaves files neither it nor this branch changed', async () => {
  const h = await harness();
  const out = join(h.outside, 'out.txt'), other = join(h.outside, 'other.txt');
  try {
    await writeFile(other, 'other initial\n');
    await h.turn('u1', [[out, 'agent out u1\n'], [other, 'agent other u1\n']]);
    await h.turn('u2', [[other, 'agent other u2\n']]);
    // Back before u2 with files: other.txt goes back, out.txt was not the
    // agent's since u2 and stays.
    await writeFile(out, 'person out\n');
    const rewound = await h.command({ action: 'rewind', entry: 'u2', conversation: true, files: true });
    assert.deepEqual([rewound.outcome, rewound.restored], ['done', 1]);
    assert.equal(await readFile(other, 'utf8'), 'agent other u1\n');
    assert.equal(await readFile(out, 'utf8'), 'person out\n');
    // On the new branch the person edits out.txt again; switching back must
    // not lay the old continuation's copy over it.
    await writeFile(out, 'person out again\n');
    const marker = h.markers().at(-1);
    const switched = await h.command({ action: 'switch', marker: marker.id, files: true });
    assert.deepEqual([switched.outcome, switched.restored, switched.errors], ['done', 1, 0]);
    assert.equal(await readFile(other, 'utf8'), 'agent other u2\n', 'what the rewind changed comes back');
    assert.equal(await readFile(out, 'utf8'), 'person out again\n');
  } finally { await h.close(); }
});

test('switching back restores what this branch\'s agent wrote, but not an ignored file', async () => {
  const h = await harness();
  const out = join(h.outside, 'out.txt');
  try {
    await h.turn('u1', [[out, 'agent out u1\n'], ['ignored.txt', 'agent ignored u1\n']]);
    await h.turn('u2');
    await h.command({ action: 'rewind', entry: 'u2', conversation: true, files: true });
    await h.turn('v2', [[out, 'agent out v2\n'], ['ignored.txt', 'agent ignored v2\n']]);
    const marker = h.markers().at(-1);
    const switched = await h.command({ action: 'switch', marker: marker.id, files: true });
    assert.deepEqual([switched.outcome, switched.restored], ['done', 1]);
    assert.equal(await readFile(out, 'utf8'), 'agent out u1\n');
    assert.equal(await h.read('ignored.txt'), 'agent ignored v2\n');
  } finally { await h.close(); }
});

test('a turn recorded before edits were named still restores every path it tracked', async () => {
  const h = await harness({ repository: false });
  try {
    await h.turn('u1', [['a.txt', 'agent first turn\n']]);
    // u2's checkpoint as an older extension wrote it: no list of edits.
    h.add({ id: 'u2', type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'u2' }] } });
    const copy = h.entries.find((e) => e.customType === CHECKPOINT && e.data.kind === 'update').data.files['a.txt'];
    h.add({ type: 'custom', customType: CHECKPOINT, data: { version: 1, kind: 'snapshot', userEntryId: 'u2', cwd: h.ws, timestamp: 't', files: { 'a.txt': copy } } });
    await h.rebuild();
    await writeFile(join(h.ws, 'a.txt'), 'changed in u2, by someone\n');
    assert.equal((await h.command({ action: 'rewind', entry: 'u2', conversation: false, files: true })).restored, 1);
    assert.equal(await h.read('a.txt'), 'initial\n');
  } finally { await h.close(); }
});

test('a broken repository configuration is no answer about ignored files, not "no repository"', async () => {
  const { ignoredFiles } = await import('../rewind-extension.mjs');
  const h = await harness();
  try {
    const plain = join(h.outside, 'out.txt');
    assert.deepEqual(await ignoredFiles([join(h.ws, 'ignored.txt'), join(h.ws, 'a.txt'), plain]), { ignored: new Set([join(h.ws, 'ignored.txt')]), unknown: new Set() });
    // Git exits 128 for this as it does outside a repository.
    await writeFile(join(h.ws, '.git', 'config'), '[core\nbroken');
    const broken = await ignoredFiles([join(h.ws, 'ignored.txt'), plain]);
    assert.deepEqual([...broken.unknown], [join(h.ws, 'ignored.txt')]);
    assert.equal(broken.ignored.size, 0);
  } finally { await h.close(); }
});

test('a snapshot never writes a file Git ignores now, which its undo point could not hold', async () => {
  const h = await harness();
  try {
    await writeFile(join(h.ws, 'conf.local'), 'at the message\n');
    // A command in the turn removes the untracked file and ignores it.
    await h.turn('u1', [], async () => {
      await rm(join(h.ws, 'conf.local'));
      await writeFile(join(h.ws, '.gitignore'), 'ignored.txt\nconf.local\n');
    });
    await writeFile(join(h.ws, 'conf.local'), 'written later, ignored now\n');
    const done = await h.command({ action: 'rewind', entry: 'u1', conversation: false, files: true });
    assert.equal(done.outcome, 'done');
    assert.equal(await h.read('conf.local'), 'written later, ignored now\n');
    assert.equal(await h.read('.gitignore'), 'ignored.txt\n', 'the rest of the turn goes back');
    const undone = await h.command({ action: 'undo', marker: h.markers().at(-1).id });
    assert.equal(undone.outcome, 'done');
    assert.equal(await h.read('conf.local'), 'written later, ignored now\n', 'undo leaves it too');
  } finally { await h.close(); }
});
