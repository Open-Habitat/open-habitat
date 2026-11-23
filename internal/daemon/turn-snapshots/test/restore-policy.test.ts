import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { checkIgnore, ignoredFiles, restoreWithUndo, scopeFiles } from '../src/turn-snapshots/restore-policy.ts';
import { restorePaths } from '../src/turn-snapshots/read.ts';
import { takeSnapshot } from '../src/turn-snapshots/store.ts';
import type { TurnSnapshotRecord } from '../src/turn-snapshots/types.ts';
import { createFixture, type Fixture } from './turn-snapshot-helpers.ts';

async function target(f: Fixture): Promise<TurnSnapshotRecord> {
  const s = await takeSnapshot({ agentDir: f.agentDir, storeId: 'session', cwd: f.project, sessionFile: f.sessionFile, label: 'start' });
  assert.ok(s.tree);
  return { version: 1, userEntryId: 'u1', phase: 'start', tree: s.tree, reason: s.reason, store: 'session', root: s.root, cwd: f.project, timestamp: s.startedAt, skipped: s.skipped };
}
const options = (f: Fixture) => ({ agentDir: f.agentDir, storeId: 'session', sessionFile: f.sessionFile });

test('fallback scope excludes earlier tracked and currently ignored paths, but permits edited outside paths and legacy checkpoints', async () => {
  const f = await createFixture('policy-scope');
  try {
    await mkdir(join(f.project, 'ignored'));
    const outside = join(f.root, 'outside.txt');
    await writeFile(outside, 'outside');
    const paths = ['a.txt', 'keep.txt', 'ignored/output.txt', outside];
    const edits = { paths: new Set(['a.txt', 'ignored/output.txt', outside]), legacy: false };
    const scoped = await scopeFiles(paths, f.project, edits);
    assert.deepEqual([...scoped.scope], ['a.txt', outside]);
    assert.deepEqual(scoped.errors, []);
    assert.deepEqual([...(await scopeFiles(paths, f.project, { paths: new Set(), legacy: true })).scope], ['a.txt', 'keep.txt', outside]);
    // A config error and a plain folder both exit 128; only the latter means
    // no repository. A broken repository must not permit fallback writes.
    await writeFile(join(f.project, '.git', 'config'), '[core\nbroken');
    assert.equal(await checkIgnore(f.project, ['a.txt']), null);
    assert.deepEqual(await ignoredFiles([join(f.project, 'a.txt'), outside]), { ignored: new Set(), unknown: new Set([join(f.project, 'a.txt')]) });
    assert.equal((await scopeFiles(paths, f.project, edits)).scope.has('a.txt'), false);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('restore preserves an over-20-MiB file absent from its undo snapshot', async () => {
  const f = await createFixture('policy-large');
  try {
    const start = await target(f);
    const large = Buffer.alloc(21 * 1024 * 1024, 'x');
    await writeFile(join(f.project, 'a.txt'), large);
    await writeFile(join(f.project, 'keep.txt'), 'agent edit');
    const r = await restoreWithUndo(options(f), start, ['a.txt', 'keep.txt']);
    assert.deepEqual(await readFile(join(f.project, 'a.txt')), large);
    assert.equal(r.covered.has(join(f.project, 'a.txt')), false);
    assert.deepEqual(r.changed, ['keep.txt']);
    assert.deepEqual(r.undo?.paths, ['keep.txt']);
    assert.ok(r.errors.some(e => e.path === 'a.txt'));
    assert.equal(await readFile(join(f.project, 'keep.txt'), 'utf8'), 'unchanged\n');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('ignore scope is frozen before restoring .gitignore; undo only contains actual writes', async () => {
  const f = await createFixture('policy-ignore');
  try {
    await writeFile(join(f.project, 'local.conf'), 'at start');
    const start = await target(f);
    await writeFile(join(f.project, '.gitignore'), 'ignored/\nlocal.conf\n');
    await writeFile(join(f.project, 'local.conf'), 'later private work');
    const scoped = await scopeFiles(['local.conf'], f.project, { paths: new Set(['local.conf']), legacy: false });
    const r = await restoreWithUndo(options(f), start, ['local.conf', '.gitignore', 'keep.txt']);
    assert.equal(await readFile(join(f.project, 'local.conf'), 'utf8'), 'later private work');
    assert.equal(await readFile(join(f.project, '.gitignore'), 'utf8'), 'ignored/\n');
    assert.deepEqual([...scoped.scope], []);
    assert.deepEqual(r.changed, ['.gitignore']);
    assert.deepEqual(r.undo?.paths, ['.gitignore']);
    assert.ok(r.undo);
    const undo: TurnSnapshotRecord = { ...start, ...r.undo, phase: 'start' };
    await restorePaths(f.agentDir, undo, r.undo.paths);
    assert.equal(await readFile(join(f.project, '.gitignore'), 'utf8'), 'ignored/\nlocal.conf\n');
    assert.equal(await readFile(join(f.project, 'local.conf'), 'utf8'), 'later private work');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('target skips and unavailable stores leave paths to fallback without writing them', async () => {
  const f = await createFixture('policy-missing');
  try {
    const start = await target(f);
    await writeFile(join(f.project, 'a.txt'), 'later work');
    const skipped = { ...start, skipped: { count: 1, truncated: false, paths: [{ path: 'a.txt', reason: 'file-too-large' as const }] } };
    const r = await restoreWithUndo(options(f), skipped, ['a.txt']);
    assert.equal(r.covered.size, 0);
    assert.equal(r.undo, null);
    const missing = await restoreWithUndo(options(f), start, async () => { throw new Error('store unavailable'); });
    assert.equal(missing.covered.size, 0);
    assert.equal(missing.errors.length, 1);
    assert.equal(await readFile(join(f.project, 'a.txt'), 'utf8'), 'later work');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
