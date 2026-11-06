import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { History, captureAll, captureFile, isCheckpoint, restoreVersions, rewindEnabled, toolInputPaths, toolPath, trackingPath, CHECKPOINT } from '../rewind-extension.mjs';

test('the files an edit or write names, as better-pi-rewind reads them', () => {
  assert.deepEqual(toolInputPaths('write', { path: 'a.txt', content: 'x' }), ['a.txt']);
  assert.deepEqual(toolInputPaths('edit', { path: 'a.txt', edits: [{ rename: 'b.txt' }] }), ['a.txt', 'b.txt']);
  assert.deepEqual(toolInputPaths('edit', { input: '*** Update File: src/x.py\n*** Move to: src/y.py\n' }), ['src/x.py', 'src/y.py']);
  assert.deepEqual(toolInputPaths('bash', { command: 'echo > a.txt' }), [], 'a command is never tracked');
  assert.deepEqual(toolInputPaths('write', { path: 'https://example.invalid/x' }), []);
});

test('a tracking path is relative inside the workspace and absolute outside it', () => {
  assert.equal(trackingPath('/w/p', 'src/a.py'), 'src/a.py');
  assert.equal(trackingPath('/w/p', '/w/p/b.py'), 'b.py');
  assert.equal(trackingPath('/w/p', '../q/c.py'), '/w/q/c.py');
});

test('the history keeps each path\'s first copy and ignores records it cannot trust', () => {
  const snap = (user, files) => ({ type: 'custom', customType: CHECKPOINT, data: { version: 1, kind: 'snapshot', userEntryId: user, cwd: '/w', timestamp: 't', files } });
  const v = (name) => ({ backupFileName: name, storeId: 's' });
  const h = new History([
    snap('u1', {}),
    { type: 'custom', customType: CHECKPOINT, data: { version: 1, kind: 'update', userEntryId: 'u1', files: { 'a': v(null) } } },
    snap('u2', { 'a': v('aa') }),
    snap('u3', { '../../etc/passwd': v('../escape') }),
    { type: 'custom', customType: 'other', data: {} },
  ]);
  assert.deepEqual(h.paths(), ['a']);
  assert.equal(h.version(h.get('u1'), 'a').backupFileName, null, 'the file did not exist before the first turn');
  assert.equal(h.version(h.get('u2'), 'a').backupFileName, 'aa');
  assert.equal(h.get('u3'), undefined, 'an unsafe copy name is not a checkpoint');
  assert.equal(isCheckpoint({ version: 1, kind: 'snapshot', userEntryId: 'u', cwd: 'relative', files: {} }), false);
});

test('copies are named by content, a restore replaces, removes and recreates files, and never writes through a symlink', async () => {
  const root = await mkdtemp(join(tmpdir(), 'oh-rewind-'));
  try {
    const cwd = join(root, 'w'), dir = join(root, 'agent');
    await mkdir(cwd);
    await writeFile(join(cwd, 'a.txt'), 'one\n');
    await writeFile(join(cwd, 'same.txt'), 'one\n');
    const first = await captureAll(['a.txt', 'same.txt', 'new.txt'], cwd, dir, 'store');
    assert.deepEqual(first.errors, []);
    assert.equal(first.files['a.txt'].backupFileName, first.files['same.txt'].backupFileName, 'identical content is one copy');
    assert.equal(first.files['new.txt'].backupFileName, null);
    assert.equal((await readdir(join(dir, 'file-history', 'store'))).length, 1);
    await writeFile(join(cwd, 'a.txt'), 'two\n');
    await writeFile(join(cwd, 'new.txt'), 'created\n');
    await rm(join(cwd, 'same.txt'));
    const result = await restoreVersions(Object.entries(first.files), cwd, dir);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.changed.sort(), ['a.txt', 'new.txt', 'same.txt']);
    assert.equal(await readFile(join(cwd, 'a.txt'), 'utf8'), 'one\n');
    assert.equal(await readFile(join(cwd, 'same.txt'), 'utf8'), 'one\n');
    await assert.rejects(readFile(join(cwd, 'new.txt')), /ENOENT/);
    assert.deepEqual((await restoreVersions(Object.entries(first.files), cwd, dir)).changed, [], 'a second restore changes nothing');

    await writeFile(join(root, 'outside.txt'), 'keep\n');
    await rm(join(cwd, 'a.txt'));
    await symlink(join(root, 'outside.txt'), join(cwd, 'a.txt'));
    const refused = await restoreVersions([['a.txt', first.files['a.txt']]], cwd, dir);
    assert.equal(refused.errors.length, 1);
    assert.equal(await readFile(join(root, 'outside.txt'), 'utf8'), 'keep\n', 'the symlink target is untouched');
    await assert.rejects(captureFile(join(cwd, 'a.txt'), dir, 'store'), /regular file/);
    await assert.rejects(captureFile(join(cwd, 'x'), dir, '../escape'), /invalid store/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('nothing is copied unless the person turned the feature on', async () => {
  const home = await mkdtemp(join(tmpdir(), 'oh-rewind-home-'));
  try {
    assert.equal(rewindEnabled(home), false);
    await mkdir(join(home, '.config', 'open-habitat'), { recursive: true });
    await writeFile(join(home, '.config', 'open-habitat', 'preferences.json'), '{"experimental":{"rewind-conversation":true}}');
    assert.equal(rewindEnabled(home), true);
    await writeFile(join(home, '.config', 'open-habitat', 'preferences.json'), '{broken');
    assert.equal(rewindEnabled(home), false);
  } finally { await rm(home, { recursive: true, force: true }); }
});

test('a tool path resolves as Pi resolves it: ~, a leading @ and file:// are what the tool wrote', () => {
  assert.equal(toolPath('~/notes.txt', '/w', '/home/p'), '/home/p/notes.txt');
  assert.equal(toolPath('@src/a.py', '/w', '/home/p'), '/w/src/a.py');
  assert.equal(toolPath('file:///tmp/x', '/w', '/home/p'), '/tmp/x');
  assert.equal(toolPath('a\u00A0b.txt', '/w', '/home/p'), '/w/a b.txt');
  assert.deepEqual(toolInputPaths('write', { path: ' padded.txt' }), [' padded.txt'], 'Pi does not trim a path');
});

test('a path a checkpoint could not copy has no version there, not the first copy', () => {
  const v = (name) => ({ backupFileName: name, storeId: 's' });
  const h = new History([
    { type: 'custom', customType: CHECKPOINT, data: { version: 1, kind: 'snapshot', userEntryId: 'u1', cwd: '/w', timestamp: 't', files: {} } },
    { type: 'custom', customType: CHECKPOINT, data: { version: 1, kind: 'update', userEntryId: 'u1', files: { a: v(null) } } },
    { type: 'custom', customType: CHECKPOINT, data: { version: 1, kind: 'snapshot', userEntryId: 'u2', cwd: '/w', timestamp: 't', files: {}, unavailable: ['a'] } },
  ]);
  assert.equal(h.version(h.get('u2'), 'a'), undefined);
  assert.equal(h.version(h.get('u1'), 'a').backupFileName, null);
});
