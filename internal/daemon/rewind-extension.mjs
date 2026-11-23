// Palaa tähän: return a browser conversation to an earlier message of the
// person's, and optionally the files the agent changed after it. Loaded only
// by the daemon-owned Pi RPC child. Pi stays the sole history writer: the
// conversation moves with Pi's own in-place tree navigation (as `/tree` does),
// what happened is a custom entry in the same session file, and file copies
// stay in the person's own ~/.pi/agent/file-history/<session>/. Nothing here
// keeps a store of its own.
//
// The checkpoint capture, the tracked-path rules and the restore are adapted
// from better-pi-rewind (https://github.com/raine/better-pi-rewind, commit
// e42fa9c), which carries this notice:
//
//   MIT License
//
//   Copyright (c) 2026 Raine
//
//   Permission is hereby granted, free of charge, to any person obtaining a copy
//   of this software and associated documentation files (the "Software"), to deal
//   in the Software without restriction, including without limitation the rights
//   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//   copies of the Software, and to permit persons to whom the Software is
//   furnished to do so, subject to the following conditions:
//
//   The above copyright notice and this permission notice shall be included in all
//   copies or substantial portions of the Software.
//
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
//   SOFTWARE.
//
// Turn snapshots (turn-snapshots/, the recorder Habitat carries as its
// better-pi-rewind contribution) are the first source when a message has
// them: every file under the repository that the agent's runs changed from
// that message on goes back, whatever tool changed it, and a snapshot taken
// just before is the undo point. The per-file copies below then cover only
// what the snapshots do not (files outside the repository, files a snapshot
// skipped, a store that is gone), and are the whole mechanism for messages
// recorded before. Either way only what the agent changed from that message
// on goes back, and nothing Git ignores (Jari 21.11.2026): a file only the
// person changed since, or a build output the agent wrote, stays as it is.
//
// What differs from better-pi-rewind: the daemon asks through one command
// instead of a terminal selector; copies are named by their content, so an
// unchanged file is one copy however many turns track it; a restore first
// copies the files as they are, so the replaced continuation can be returned
// to with its files and a files-only restore can be undone; a restore never
// writes through a symlink; there is no Git reset.
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream, readFileSync } from 'node:fs';
import { chmod, copyFile, lstat, mkdir, rename, stat, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const CHECKPOINT = 'oh-rewind-checkpoint';
export const MARKER = 'oh-rewind';
// The custom message that tells the agent its files changed under it.
export const NOTE = 'oh-rewind-note';
// Gives a leaf Pi's navigation cannot land on something to land on.
const ANCHOR = 'oh-rewind-anchor';
const VERSION = 1;
// The person's switch, kept by their daemon (account_preferences_linux.go).
// Read at every turn: without it nothing is copied.
const FEATURE = 'rewind-conversation';
// The daemon reads the outcome from the RPC stream before the prompt's own
// response (rewind_linux.go), as it does for the recap.
const OUTCOME = 'oh-rewind:';
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE = /^[A-Za-z0-9._@-]+$/;
const safe = (v) => typeof v === 'string' && v !== '.' && v !== '..' && SAFE.test(v);

export function rewindEnabled(home = homedir()) {
  try {
    return JSON.parse(readFileSync(join(home, '.config', 'open-habitat', 'preferences.json'), 'utf8'))?.experimental?.[FEATURE] === true;
  } catch { return false; }
}
export const agentDir = (home = homedir()) => join(home, '.pi', 'agent');
const store = (dir, id) => {
  if (!safe(id)) throw new Error('invalid store');
  return join(dir, 'file-history', id);
};
const isNotFound = (e) => e?.code === 'ENOENT';
const message = (e) => (e instanceof Error ? e.message : String(e));

// better-pi-rewind src/tool-input-paths.ts: the files an edit or write call names.
function addPath(paths, value) {
  if (typeof value !== 'string' || !value.trim() || /^(?!file:)[a-z][a-z0-9+.-]*:\/\//i.test(value.trim())) return;
  paths.add(value);
}
// Pi's own resolution of a tool's path (resolveToCwd in Pi 1.3): Unicode
// spaces, a leading @, ~ and file:// are what the tool itself writes to.
const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
export function toolPath(input, cwd, home = homedir()) {
  let p = input.replace(UNICODE_SPACES, ' ');
  if (p.startsWith('@')) p = p.slice(1);
  if (p === '~') p = home;
  else if (p.startsWith('~/')) p = join(home, p.slice(2));
  else if (/^file:\/\//.test(p)) p = fileURLToPath(p);
  return resolve(cwd, p);
}
const unquote = (v) => { const t = v.trim(); return (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")) ? t.slice(1, -1) : t; };
export function toolInputPaths(toolName, input) {
  if ((toolName !== 'edit' && toolName !== 'write') || typeof input !== 'object' || input === null) return [];
  const paths = new Set();
  addPath(paths, input.path);
  if (toolName === 'edit' && Array.isArray(input.edits)) for (const edit of input.edits) if (edit && typeof edit === 'object') addPath(paths, edit.rename);
  const text = input.input;
  if (toolName !== 'edit' || typeof text !== 'string') return [...paths];
  for (const m of text.matchAll(/^\[(.+)#[0-9a-f]{4}\]\s*$/gim)) addPath(paths, m[1]);
  for (const m of text.matchAll(/^\*\*\* (?:Add|Update|Delete) File:\s*(.+?)\s*$/gim)) addPath(paths, m[1]);
  for (const m of text.matchAll(/^\*\*\* Move to:\s*(.+?)\s*$/gim)) addPath(paths, m[1]);
  for (const m of text.matchAll(/^MV\s+(.+?)\s*$/gim)) addPath(paths, unquote(m[1] ?? ''));
  return [...paths];
}

// A tracking path is relative to the checkpoint's working directory when the
// file is inside it, absolute otherwise.
export function trackingPath(cwd, file) {
  const absolute = resolve(cwd, file);
  const rel = relative(cwd, absolute);
  if (rel === '') return '.';
  if (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)) return rel;
  return absolute;
}
export const resolveTracking = (cwd, path) => (isAbsolute(path) ? path : resolve(cwd, path));

function validVersion(v) {
  return v && typeof v === 'object' && (v.backupFileName === null || safe(v.backupFileName)) && safe(v.storeId) && (v.mode === undefined || Number.isSafeInteger(v.mode));
}
function validFiles(files) {
  return files && typeof files === 'object' && !Array.isArray(files) && Object.entries(files).every(([p, v]) => typeof p === 'string' && p !== '' && !p.includes('\0') && validVersion(v));
}
const validUnavailable = (u) => u === undefined || (Array.isArray(u) && u.length <= 10000 && u.every((p) => typeof p === 'string' && p !== ''));
export function isCheckpoint(data) {
  return data?.version === VERSION && validUnavailable(data.unavailable) && validUnavailable(data.edited) && (data.kind === 'snapshot' || data.kind === 'update') && ID.test(data.userEntryId ?? '') && validFiles(data.files) && (data.kind === 'update' || typeof data.cwd === 'string' && isAbsolute(data.cwd));
}

// better-pi-rewind's CheckpointHistory: one checkpoint per person's message,
// the files it had copied, the paths its turn's edits and writes named, and
// every path ever tracked in the session with its first copy (the state
// before anything here touched it). A checkpoint written before turns named
// their edits has no such list (edited is null).
export class History {
  constructor(entries = []) {
    this.checkpoints = new Map();
    this.order = [];
    this.tracked = new Set();
    this.first = new Map();
    for (const e of entries) if (e?.type === 'custom' && e.customType === CHECKPOINT && isCheckpoint(e.data)) this.apply(e.data);
  }
  apply(record) {
    if (record.kind === 'snapshot') {
      if (!this.checkpoints.has(record.userEntryId)) this.order.push(record.userEntryId);
      this.checkpoints.set(record.userEntryId, { userEntryId: record.userEntryId, cwd: record.cwd, files: { ...record.files }, unavailable: new Set(record.unavailable ?? []), edited: Array.isArray(record.edited) ? new Set(record.edited) : null });
    } else {
      const checkpoint = this.checkpoints.get(record.userEntryId);
      if (!checkpoint) return;
      Object.assign(checkpoint.files, record.files);
      for (const p of record.unavailable ?? []) if (!record.files[p]) checkpoint.unavailable.add(p);
      for (const p of record.edited ?? []) checkpoint.edited?.add(p);
    }
    for (const [path, version] of Object.entries(record.files)) {
      this.tracked.add(path);
      if (!this.first.has(path)) this.first.set(path, version);
    }
  }
  get(id) { return this.checkpoints.get(id); }
  latest() { const id = this.order.at(-1); return id ? this.checkpoints.get(id) : undefined; }
  paths() { return [...this.tracked]; }
  // A path the checkpoint could not copy has no version there: falling back
  // to an older copy would restore the wrong content.
  version(checkpoint, path) { return checkpoint.files[path] ?? (checkpoint.unavailable.has(path) ? undefined : this.first.get(path)); }
}

async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

// A copy is named by its content: an unchanged file tracked over many turns
// is one copy. A missing file is recorded so a restore removes what the
// agent created.
export async function captureFile(file, dir, storeId) {
  const folder = store(dir, storeId);
  let info;
  try { info = await lstat(file); } catch (e) { if (isNotFound(e)) return { backupFileName: null, storeId }; throw e; }
  if (!info.isFile()) throw new Error('not a regular file');
  await mkdir(folder, { recursive: true, mode: 0o700 });
  // The name is the hash of the bytes copied, not of the file as it was a
  // moment earlier: a writer between the two must not mislabel the copy.
  const temporary = join(folder, `.${randomUUID()}`);
  let name;
  try {
    await copyFile(file, temporary);
    await chmod(temporary, 0o600);
    name = (await hashFile(temporary)).slice(0, 40);
    try { await stat(join(folder, name)); await unlink(temporary); } catch (e) {
      if (!isNotFound(e)) throw e;
      await rename(temporary, join(folder, name));
    }
  } catch (e) {
    await unlink(temporary).catch(() => {});
    throw e;
  }
  return { backupFileName: name, mode: info.mode & 0o7777, storeId };
}

export async function captureAll(paths, cwd, dir, storeId) {
  const files = {}, errors = [];
  await Promise.all(paths.map(async (path) => {
    try { files[path] = await captureFile(resolveTracking(cwd, path), dir, storeId); } catch (e) { errors.push({ path, error: message(e) }); }
  }));
  return { files, errors };
}

async function differs(file, version, dir) {
  let info;
  try { info = await lstat(file); } catch (e) { if (isNotFound(e)) return version.backupFileName !== null; throw e; }
  if (version.backupFileName === null) return true;
  if (!info.isFile()) return true;
  const backup = join(store(dir, version.storeId), version.backupFileName);
  const copy = await stat(backup);
  if ((version.mode !== undefined && (info.mode & 0o7777) !== version.mode) || info.size !== copy.size) return true;
  return (await hashFile(file)).slice(0, 40) !== version.backupFileName;
}

// One file back to a copy. A symlink is never written through: it is
// refused as it stands. The copy lands under a temporary name and is
// renamed over the file, so a reader sees the old or the new content.
async function restoreFile(file, version, dir) {
  let info;
  try { info = await lstat(file); } catch (e) { if (!isNotFound(e)) throw e; }
  if (info && !info.isFile()) throw new Error('not a regular file');
  if (version.backupFileName === null) {
    if (!info) return false;
    await unlink(file);
    return true;
  }
  if (info && !(await differs(file, version, dir))) return false;
  const source = join(store(dir, version.storeId), version.backupFileName);
  await mkdir(dirname(file), { recursive: true });
  const temporary = join(dirname(file), `.oh-rewind-${randomUUID()}`);
  try {
    await copyFile(source, temporary);
    await chmod(temporary, version.mode ?? 0o644);
    await rename(temporary, file);
  } catch (e) {
    await unlink(temporary).catch(() => {});
    throw e;
  }
  return true;
}

// Restores each path to its version, best effort, one file at a time.
export async function restoreVersions(versions, cwd, dir) {
  const changed = [], errors = [];
  for (const [path, version] of versions) {
    try { if (await restoreFile(resolveTracking(cwd, path), version, dir)) changed.push(path); } catch (e) { errors.push({ path, error: message(e) }); }
  }
  return { changed, errors };
}
export const checkpointVersions = (history, checkpoint) => history.paths().flatMap((p) => { const v = history.version(checkpoint, p); return v ? [[p, v]] : []; });

const text = (content) => typeof content === 'string' ? content : Array.isArray(content) ? content.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n') : '';
const isUser = (e) => e?.type === 'message' && e.message?.role === 'user';
const isReply = (e) => e?.type === 'message' && e.message?.role === 'assistant' && text(e.message.content).trim() !== '';

// The person's messages and the agent's replies on a path of entries, a
// reply per answered message as the timeline shows one turn: text the agent
// wrote between its tool calls is part of the same reply.
export function counts(entries) {
  let own = 0, replies = 0, waiting = false;
  for (const e of entries) {
    if (isUser(e)) { own++; waiting = true; } else if (waiting && isReply(e)) { replies++; waiting = false; }
  }
  return { own, replies };
}
// The entries of the continuation ending at `leaf` that `branch` does not share.
export function continuation(sm, leaf, branch) {
  const shared = new Set(branch.map((e) => e.id));
  return sm.getBranch(leaf).filter((e) => !shared.has(e.id));
}

// Paths first tracked on the active branch after `after`: their first copy
// there is their state when this branch left them alone.
function trackedSince(branch, after) {
  const versions = new Map();
  let seen = after === undefined;
  for (const e of branch) {
    if (!seen) { seen = e.id === after; continue; }
    if (e.type === 'custom' && e.customType === CHECKPOINT && isCheckpoint(e.data))
      for (const [p, v] of Object.entries(e.data.files)) if (!versions.has(p)) versions.set(p, v);
  }
  return versions;
}

// What the agent's edits and writes named on a path of entries that starts
// at a person's message: the turns from that message on. A turn recorded
// before checkpoints named their edits (legacy) may have edited any path it
// tracked, so for it every tracked path counts, as it always did.
export function editedOn(entries) {
  const paths = new Set();
  let legacy = false;
  for (const e of entries) {
    if (e?.type !== 'custom' || e.customType !== CHECKPOINT || !isCheckpoint(e.data)) continue;
    if (e.data.kind === 'snapshot' && !Array.isArray(e.data.edited)) legacy = true;
    // An update is written only when an edit or write names a path.
    if (e.data.kind === 'update') for (const p of [...Object.keys(e.data.files), ...(e.data.unavailable ?? [])]) paths.add(p);
    for (const p of e.data.edited ?? []) paths.add(p);
  }
  return { paths, legacy };
}

// Git run as the person on their own workspace, read-only: the recorder's
// rules for which configuration to trust do not apply to a question Git
// answers from the workspace's own ignore files. Stopped after `ms`.
function workspaceGit(args, cwd, input, ms = 5000) {
  return new Promise((done) => {
    const env = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('GIT_')) env[k] = v;
    Object.assign(env, { GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' });
    let out = Buffer.alloc(0), err = '', settled = false;
    const finish = (code) => { if (!settled) { settled = true; clearTimeout(timer); done({ code, stdout: out, stderr: err }); } };
    let child;
    try { child = spawn('git', ['-c', 'core.fsmonitor=false', '-C', cwd, ...args], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] }); } catch { return finish(null); }
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish(null); }, ms);
    child.on('error', (e) => finish(e?.code === 'ENOENT' ? 'unavailable' : null));
    child.stdout.on('data', (c) => { if (out.length < 4 << 20) out = Buffer.concat([out, c]); });
    child.stderr.on('data', (c) => { if (err.length < 65536) err += c.toString('utf8'); });
    child.on('close', (code) => finish(code));
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');
  });
}
// Git's own message (LC_ALL=C) for a folder in no repository.
export const notARepository = (stderr) => /^fatal: not a git repository/m.test(stderr);
async function nearestFolder(file) {
  for (let d = dirname(file); ; d = dirname(d)) {
    try { if ((await stat(d)).isDirectory()) return d; } catch { /* Not there (any more): its parent. */ }
    if (dirname(d) === d) return undefined;
  }
}
// The files (absolute) Git ignores now, asked from each file's nearest
// existing folder, so a file in another or a nested repository is asked
// there and one in no repository is not ignored. A file Git could not
// answer for is unknown; the caller leaves it alone.
export async function ignoredFiles(files) {
  const ignored = new Set(), unknown = new Set(), groups = new Map();
  for (const file of files) {
    const folder = await nearestFolder(file);
    if (!folder) { unknown.add(file); continue; }
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(file);
  }
  for (const [folder, group] of groups) {
    const names = group.map((f) => relative(folder, f));
    const listed = await checkIgnore(folder, names);
    for (const [i, f] of group.entries()) if (!listed) unknown.add(f); else if (listed.has(names[i])) ignored.add(f);
  }
  return { ignored, unknown };
}
// The names (relative to folder) Git ignores, or null when it cannot say.
// Outside every repository nothing is ignored. Any other failure (a timeout,
// a broken configuration, which also exits 128) is no answer.
export async function checkIgnore(folder, names) {
  if (!names.length) return new Set();
  const r = await workspaceGit(['check-ignore', '-z', '--stdin'], folder, names.join('\0') + '\0');
  if (r.code === 0) return new Set(r.stdout.toString('utf8').split('\0').filter(Boolean));
  if (r.code === 1 || r.code === 'unavailable') return new Set();
  const inside = await workspaceGit(['rev-parse', '--is-inside-work-tree'], folder);
  return inside.code === 128 && notARepository(inside.stderr) ? new Set() : null;
}

// Which of the per-file copies' paths a restore may write: one an edit or a
// write named in `entries` (see editedOn) that Git does not ignore. The rest
// were changed, if at all, by somebody else, or are ignored files that are
// never touched (Jari 21.11.2026). A path whose ignore status Git could not
// tell is left as it is and counted as an error.
export async function fallbackScope(paths, cwd, entries) {
  const { paths: edited, legacy } = editedOn(entries);
  const named = paths.filter((p) => legacy || edited.has(p));
  const { ignored, unknown } = await ignoredFiles(named.map((p) => resolveTracking(cwd, p)));
  const scope = new Set(), errors = [];
  for (const p of named) {
    const file = resolveTracking(cwd, p);
    if (unknown.has(file)) errors.push({ path: p, error: 'Git could not tell whether the file is ignored' });
    else if (!ignored.has(file)) scope.add(p);
  }
  return { scope, errors };
}

// ---------- Turn snapshots ----------

// The recorder's module is TypeScript; it is loaded the first time a
// restore needs it, so a Pi start does not pay for it.
let snapshotModule;
const snapshotsModule = () => (snapshotModule ??= import('./turn-snapshots/src/turn-snapshots/index.ts'));
export const SNAPSHOT = 'turn-snapshot';
const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
// The message's start snapshot on a path of entries, without loading the module.
export const startSnapshot = (entries, userEntryId) => entries.find((e) => e?.type === 'custom' && e.customType === SNAPSHOT && e.data?.version === 1 && e.data.phase === 'start' && e.data.userEntryId === userEntryId && typeof e.data.tree === 'string' && OBJECT_ID.test(e.data.tree))?.data;

// A marker's undo point: the snapshot taken just before a restore and the
// root-relative paths that restore changed.
function validUndoPoint(u) {
  return u && typeof u === 'object' && safe(u.store) && typeof u.tree === 'string' && OBJECT_ID.test(u.tree) && typeof u.root === 'string' && isAbsolute(u.root) && typeof u.cwd === 'string' && isAbsolute(u.cwd) && typeof u.timestamp === 'string' && Array.isArray(u.paths) && u.paths.length <= 100000 && u.paths.every((p) => typeof p === 'string' && p !== '');
}
const undoRecord = (u) => ({ version: 1, userEntryId: 'oh-rewind', phase: 'start', tree: u.tree, reason: null, store: u.store, root: u.root, cwd: u.cwd, timestamp: u.timestamp, skipped: u.skipped ?? { count: 0, paths: [], truncated: false } });
const absoluteUnder = (root, paths) => new Set(paths.map((p) => resolve(root, ...p.split('/'))));
const rootRelative = (root, files) => files.map((f) => relative(root, f).split(sep).join('/'));

// Puts the paths back to `target`'s tree after taking a snapshot of the
// files as they are (the undo point). Without an undo point nothing is
// restored from the snapshot: the person's later work in those files would
// have no other copy. `covered` is every path the snapshots answer for, so
// the per-file copies leave them alone; without an undo point they answer
// for none and the copies restore what they track.
export async function restoreSnapshot(dir, ctx, storeId, target, pathsOrFind) {
  // A store the retention sweep removed, or a tree Git cannot read: the
  // snapshots answer for nothing and the per-file copies do what they can.
  try { return await restoreFromSnapshot(dir, ctx, storeId, target, typeof pathsOrFind === 'function' ? await pathsOrFind() : pathsOrFind); } catch (e) {
    return { covered: new Set(), changed: [], errors: [{ path: target.root, error: message(e) }], undo: null };
  }
}
// A path a snapshot left out (too large, unreadable): it, or anything under
// a skipped directory.
const skippedBy = (summary) => {
  const skipped = (summary?.paths ?? []).map((p) => p.path);
  return (path) => skipped.some((s) => path === s || path.startsWith(`${s}/`));
};
async function restoreFromSnapshot(dir, ctx, storeId, target, all) {
  const m = await snapshotsModule();
  // A path the target snapshot skipped has no content there: the per-file
  // copies answer for it.
  const inTarget = skippedBy(target.skipped);
  let paths = all.filter((p) => !inTarget(p));
  // A file Git ignores now is not written either (Jari 21.11.2026), nor one
  // Git cannot say about; the per-file copies' scope leaves them too.
  const ignored = await checkIgnore(target.root, paths);
  const unanswered = ignored ? [] : paths;
  paths = ignored ? paths.filter((p) => !ignored.has(p)) : [];
  if (!paths.length) return { covered: new Set(), changed: [], errors: unanswered.map((p) => ({ path: p, error: 'Git could not tell whether the file is ignored' })), undo: null };
  const now = await m.snapshotNow({ agentDir: dir, storeId, cwd: target.cwd, sessionFile: ctx.sessionManager.getSessionFile?.() ?? null, labelPrefix: 'oh-rewind' });
  // Every file the restore overwrites must be in the undo point: one the
  // undo snapshot skipped (or a skip list too long to name them all) is left
  // to the per-file copies.
  if (!now.tree || now.root !== target.root || now.skipped?.truncated) return { covered: new Set(), changed: [], errors: paths.map((p) => ({ path: p, error: `no undo point (${now.reason ?? (now.skipped?.truncated ? 'too many skipped files' : 'different repository')})` })), undo: null };
  const inUndo = skippedBy(now.skipped);
  // A file on disk that the undo point does not hold (one that became
  // ignored without Git saying so here, or a race) has no other copy.
  const held = await inTree(dir, storeId, now.tree, target.root, paths);
  const unsaved = paths.filter((p) => inUndo(p) || !held(p));
  paths = paths.filter((p) => !inUndo(p) && held(p));
  const result = await m.restorePaths(dir, target, paths);
  const changed = rootRelative(target.root, result.changedFiles);
  return { covered: absoluteUnder(target.root, paths), changed, errors: [...unanswered.map((p) => ({ path: p, error: 'Git could not tell whether the file is ignored' })), ...result.errors, ...unsaved.map((p) => ({ path: p, error: 'not in the undo point' }))], undo: { store: storeId, tree: now.tree, root: now.root, cwd: target.cwd, timestamp: now.startedAt, skipped: now.skipped, paths: changed } };
}
// Whether each root-relative path either is missing on disk or is in `tree`.
// A path Git cannot list is treated as not held.
async function inTree(dir, storeId, tree, root, paths) {
  const { storeGit, storeDirectory } = await import('./turn-snapshots/src/turn-snapshots/store.ts');
  const onDisk = [];
  for (const p of paths) { try { await lstat(resolve(root, ...p.split('/'))); onDisk.push(p); } catch (e) { if (!isNotFound(e)) onDisk.push(p); } }
  const listed = new Set();
  for (let i = 0; i < onDisk.length; i += 200) {
    const r = await storeGit(storeDirectory(dir, storeId), ['ls-tree', '-r', '-z', '--full-tree', '--name-only', tree, '--', ...onDisk.slice(i, i + 200)], { timeoutMs: 10_000, env: { GIT_LITERAL_PATHSPECS: '1' } });
    if (r.code !== 0) return () => false;
    for (const name of r.stdout.toString('utf8').split('\0')) if (name) listed.add(name);
  }
  const absent = new Set(onDisk.filter((p) => !listed.has(p)));
  return (p) => !absent.has(p);
}
// The paths the agent's runs changed from the first run in `records` on.
async function changedSince(dir, records, userEntryId) {
  const m = await snapshotsModule();
  return (await m.pathsChangedSince(dir, records, userEntryId)).paths;
}
const snapshotRecords = async (entries) => (await snapshotsModule()).turnSnapshotsFromEntries(entries);
// Back to the undo point for what a restore changed, best effort.
async function returnTo(dir, undo) {
  if (!undo?.paths.length) return;
  const m = await snapshotsModule();
  await m.restorePaths(dir, undoRecord(undo), undo.paths).catch(() => {});
}

const report = (ctx, outcome, extra = {}) => {
  try { ctx.ui.notify(OUTCOME + JSON.stringify({ outcome, ...extra }), outcome === 'done' ? 'info' : 'error'); } catch { /* No UI: the daemon reports an unknown outcome. */ }
};
// paths are the per-file copies' tracking paths a restore changed; what it
// changed from a snapshot is in the marker's undo point.
const restoredFiles = (result, snap) => ({ restored: result.changed.length + (snap?.changed.length ?? 0), errors: result.errors.length + (snap?.errors.length ?? 0), paths: result.changed });
const filesNote = (n) => `The person restored ${n === 1 ? 'one file' : `${n} files`} you changed to how ${n === 1 ? 'it was' : 'they were'} earlier in this conversation. Your later edits to ${n === 1 ? 'it are' : 'them are'} gone; read a file again before relying on its content.`;
const undoNote = (n) => `The person undid the earlier file restore: ${n === 1 ? 'the file is' : `${n} files are`} again as you left ${n === 1 ? 'it' : 'them'}.`;

export default function (pi) {
  const dir = agentDir();
  let state, pending = false;
  const rebuild = (ctx) => {
    const history = new History(ctx.sessionManager.getEntries());
    const branch = new History(ctx.sessionManager.getBranch());
    state = { history, storeId: ctx.sessionManager.getSessionId(), current: branch.latest()?.userEntryId, waiting: false };
    return state;
  };
  const current = (ctx) => (!state || state.storeId !== ctx.sessionManager.getSessionId() ? rebuild(ctx) : state);
  const append = (record) => { pi.appendEntry(CHECKPOINT, record); state.history.apply(record); };

  pi.on('session_start', async (_event, ctx) => { rebuild(ctx); });
  pi.on('session_tree', async (_event, ctx) => { rebuild(ctx); });
  pi.on('message_end', async (event, ctx) => { if (event.message?.role === 'user') current(ctx).waiting = true; });
  // A turn's checkpoint: as the agent starts answering the person's message,
  // copy every file tracked so far, as it is now.
  pi.on('message_start', async (event, ctx) => {
    if (event.message?.role !== 'assistant') return;
    const s = current(ctx);
    if (!s.waiting) return;
    s.waiting = false;
    const entry = [...ctx.sessionManager.getBranch()].reverse().find(isUser);
    if (!entry) return;
    if (s.history.get(entry.id)) { s.current = entry.id; return; }
    if (!rewindEnabled()) { s.current = undefined; return; }
    const captured = await captureAll(s.history.paths(), ctx.cwd, dir, s.storeId);
    const unavailable = captured.errors.map((e) => e.path);
    append({ version: VERSION, kind: 'snapshot', userEntryId: entry.id, cwd: ctx.cwd, timestamp: new Date().toISOString(), files: captured.files, edited: [], ...(unavailable.length ? { unavailable } : {}) });
    s.current = entry.id;
  });
  // Before an edit or write first touches a file in a turn, copy it, and
  // name it as edited in this turn: that is what a restore may give back.
  pi.on('tool_call', async (event, ctx) => {
    if (event.toolName !== 'edit' && event.toolName !== 'write') return;
    const s = current(ctx);
    const checkpoint = s.current ? s.history.get(s.current) : undefined;
    if (!checkpoint) return;
    const files = {}, unavailable = [], edited = [];
    for (const input of toolInputPaths(event.toolName, event.input)) {
      const absolute = toolPath(input, ctx.cwd);
      const path = trackingPath(checkpoint.cwd, absolute);
      if (edited.includes(path) || checkpoint.edited?.has(path)) continue;
      edited.push(path);
      if (checkpoint.files[path] || checkpoint.unavailable.has(path)) continue;
      try { files[path] = await captureFile(absolute, dir, s.storeId); } catch { unavailable.push(path); }
    }
    if (edited.length) append({ version: VERSION, kind: 'update', userEntryId: checkpoint.userEntryId, files, edited, ...(unavailable.length ? { unavailable } : {}) });
  });

  async function rewind(args, ctx, s) {
    const sm = ctx.sessionManager;
    const entry = sm.getEntry(args.entry);
    const branch = sm.getBranch();
    if (!isUser(entry) || !branch.some((e) => e.id === entry.id)) return report(ctx, 'not_found');
    const checkpoint = s.history.get(entry.id);
    const start = startSnapshot(branch, entry.id);
    if (args.files && !checkpoint && !start) return report(ctx, 'no_checkpoint');
    const leaf = sm.getLeafId();
    const later = branch.slice(branch.findIndex((e) => e.id === entry.id));
    let before, restore, snap;
    if (args.files) {
      const cwd = checkpoint?.cwd ?? ctx.cwd;
      // Which copies may be written is decided on the files as they are,
      // before a snapshot writes anything: a .gitignore the snapshot puts
      // back must not change what counts as ignored, and the preview judges
      // the files as they are.
      const scoped = checkpoint ? await fallbackScope(s.history.paths(), cwd, later) : { scope: new Set(), errors: [] };
      // Every file the agent's runs changed from this message on, back to
      // the message's start snapshot, with an undo point.
      if (start) snap = await restoreSnapshot(dir, ctx, s.storeId, start, async () => changedSince(dir, await snapshotRecords(branch), entry.id));
      // The files as the agent left them, so this continuation can be
      // returned to with its files, or a files-only restore undone.
      // A file that cannot be copied now is left as it is.
      // Every tracked path is copied (a switch back needs them), but only
      // what the agent's edits and writes named from this message on, and
      // Git does not ignore, is restored.
      const uncovered = (p) => !snap?.covered.has(resolveTracking(cwd, p));
      const tracked = checkpoint ? s.history.paths().filter(uncovered) : [];
      before = await captureAll(tracked, cwd, dir, s.storeId);
      const { scope } = scoped;
      restore = checkpoint ? await restoreVersions(checkpointVersions(s.history, checkpoint).filter(([p]) => scope.has(p) && before.files[p]), cwd, dir) : { changed: [], errors: [] };
      restore.errors.push(...before.errors.filter((e) => scope.has(e.path)), ...scoped.errors.filter((e) => uncovered(e.path)));
    }
    const data = { version: VERSION, action: args.conversation ? 'rewind' : 'files', at: entry.id, ...counts(later), cwd: checkpoint?.cwd ?? ctx.cwd, files: restore ? restoredFiles(restore, snap) : null, ...(before ? { before: before.files } : {}), ...(snap?.undo ? { snapshot: snap.undo } : {}) };
    if (args.conversation) {
      // Pi's navigation puts a person's message or a custom message back in
      // the field instead of landing on it, so such a leaf (an unanswered
      // message, this extension's own note) gets an anchor to return to.
      const leafEntry = leaf ? sm.getEntry(leaf) : undefined;
      if (isUser(leafEntry) || leafEntry?.type === 'custom_message') pi.appendEntry(ANCHOR, {});
      const left = sm.getLeafId();
      const result = await ctx.navigateTree(entry.id);
      if (result.cancelled) {
        // Only what this restore wrote goes back to its copy.
        if (before) await restoreVersions(Object.entries(before.files).filter(([p]) => restore.changed.includes(p)), data.cwd, dir);
        await returnTo(dir, snap?.undo);
        return report(ctx, 'cancelled');
      }
      data.left = left;
      pi.appendEntry(MARKER, data);
    } else {
      pi.appendEntry(MARKER, data);
      if (data.files.restored) pi.sendMessage({ customType: NOTE, content: filesNote(data.files.restored), display: false }, { triggerTurn: false });
    }
    rebuild(ctx);
    report(ctx, 'done', { restored: data.files?.restored ?? 0, errors: data.files?.errors ?? 0 });
  }

  // Back to the continuation a rewind replaced, which is a leaf of its own
  // in the same tree; the one left now becomes the row.
  async function switchBack(args, ctx, s) {
    const sm = ctx.sessionManager;
    const marker = sm.getEntry(args.marker);
    const branch = sm.getBranch();
    if (marker?.type !== 'custom' || marker.customType !== MARKER || !['rewind', 'switch'].includes(marker.data?.action) || !branch.some((e) => e.id === marker.id)) return report(ctx, 'not_found');
    const target = sm.getEntry(marker.data.left);
    // Pi's navigation puts a person's message back in the field instead of
    // landing on it; such a leaf cannot be continued as it was.
    if (!target || target.type === 'custom_message' || isUser(target)) return report(ctx, 'not_switchable');
    if (args.files && !validFiles(marker.data.before)) return report(ctx, 'no_checkpoint');
    const point = validUndoPoint(marker.data.snapshot) ? marker.data.snapshot : null;
    if (!continuation(sm, sm.getLeafId(), sm.getBranch(target.id)).length) return report(ctx, 'not_switchable');
    const leafEntry = sm.getEntry(sm.getLeafId());
    if (isUser(leafEntry) || leafEntry?.type === 'custom_message') pi.appendEntry(ANCHOR, {});
    const leaf = sm.getLeafId();
    const left = continuation(sm, leaf, sm.getBranch(target.id));
    const cwd = typeof marker.data.cwd === 'string' && isAbsolute(marker.data.cwd) ? marker.data.cwd : ctx.cwd;
    let before, restore, snap;
    if (args.files) {
      // Decided before a snapshot writes anything, as in a rewind.
      const sinceMarker = branch.slice(branch.findIndex((e) => e.id === marker.id) + 1);
      const scoped = await fallbackScope([...new Set([...Object.keys(marker.data.before), ...trackedSince(branch, marker.id).keys()])], cwd, sinceMarker);
      if (point) {
        // Back to the files as the replaced continuation left them: what the
        // rewind changed, and what this branch's runs have changed since.
        snap = await restoreSnapshot(dir, ctx, s.storeId, undoRecord(point), async () => {
          const after = await snapshotRecords(sinceMarker);
          const first = after.find((r) => r.phase === 'start');
          const since = first ? await changedSince(dir, after, first.userEntryId) : [];
          return [...new Set([...point.paths, ...since])].sort();
        });
      }
      const keep = (p) => !snap?.covered.has(resolveTracking(cwd, p));
      const paths = [...new Set([...Object.keys(marker.data.before), ...trackedSince(branch, marker.id).keys()])].filter(keep);
      before = await captureAll(paths, cwd, dir, s.storeId);
      const versions = new Map([...trackedSince(branch, marker.id), ...Object.entries(marker.data.before)]);
      // What goes back: what the rewind's copies changed (its own writes,
      // ignored or not), and what this branch's edits and writes named since
      // and Git does not ignore. A file the person changed since and neither
      // touched stays.
      const own = Array.isArray(marker.data.files?.paths) ? marker.data.files.paths.filter((p) => typeof p === 'string') : [];
      const scope = new Set([...scoped.scope, ...own]);
      restore = await restoreVersions([...versions].filter(([p]) => scope.has(p) && keep(p) && before.files[p]), cwd, dir);
      restore.errors.push(...before.errors.filter((e) => scope.has(e.path)), ...scoped.errors.filter((e) => keep(e.path) && !scope.has(e.path)));
    }
    const result = await ctx.navigateTree(target.id);
    if (result.cancelled) {
      if (before) await restoreVersions(Object.entries(before.files).filter(([p]) => restore.changed.includes(p)), cwd, dir);
      await returnTo(dir, snap?.undo);
      return report(ctx, 'cancelled');
    }
    const files = restore ? restoredFiles(restore, snap) : null;
    pi.appendEntry(MARKER, { version: VERSION, action: 'switch', at: left[0].id, left: leaf, ...counts(left), cwd, files, ...(before ? { before: before.files } : {}), ...(snap?.undo ? { snapshot: snap.undo } : {}) });
    rebuild(ctx);
    report(ctx, 'done', { restored: files?.restored ?? 0, errors: files?.errors ?? 0 });
  }

  // Undo a files-only restore: the files go back to how the agent left them.
  async function undo(args, ctx, s) {
    const sm = ctx.sessionManager;
    const marker = sm.getEntry(args.marker);
    const branch = sm.getBranch();
    if (marker?.type !== 'custom' || marker.customType !== MARKER || marker.data?.action !== 'files' || !validFiles(marker.data.before) || !branch.some((e) => e.id === marker.id)) return report(ctx, 'not_found');
    if (branch.some((e) => e.type === 'custom' && e.customType === MARKER && e.data?.action === 'undo' && e.data.of === marker.id)) return report(ctx, 'already_undone');
    const cwd = typeof marker.data.cwd === 'string' && isAbsolute(marker.data.cwd) ? marker.data.cwd : ctx.cwd;
    // Only what that restore changed goes back: later work, including files
    // the agent created since, is not this restore's to undo.
    const changed = new Set(Array.isArray(marker.data.files?.paths) ? marker.data.files.paths : []);
    const versions = Object.entries(marker.data.before).filter(([p]) => changed.has(p));
    // What the restore changed from a snapshot goes back to its undo point,
    // after a new one: a hand edit or a later turn's work since the restore
    // has no other copy.
    const point = validUndoPoint(marker.data.snapshot) ? marker.data.snapshot : null;
    const snap = point ? await restoreSnapshot(dir, ctx, s.storeId, undoRecord(point), point.paths) : null;
    // The files as they are now, for the same reason.
    const before = await captureAll(versions.map(([p]) => p), cwd, dir, s.storeId);
    const restore = await restoreVersions(versions.filter(([p]) => before.files[p]), cwd, dir);
    restore.errors.push(...before.errors);
    const files = restoredFiles(restore, snap);
    pi.appendEntry(MARKER, { version: VERSION, action: 'undo', of: marker.id, cwd, files, before: before.files, ...(snap?.undo ? { snapshot: snap.undo } : {}) });
    if (files.restored) pi.sendMessage({ customType: NOTE, content: undoNote(files.restored), display: false }, { triggerTurn: false });
    rebuild(ctx);
    report(ctx, 'done', { restored: files.restored, errors: files.errors });
  }

  pi.registerCommand('oh-rewind', {
    description: 'Return the conversation or files to an earlier message (Habitat)',
    handler: async (raw, ctx) => {
      if (pending) return report(ctx, 'busy');
      let args;
      try { args = JSON.parse(raw); } catch { return report(ctx, 'invalid'); }
      const ok = args && typeof args === 'object' && (
        args.action === 'rewind' && ID.test(args.entry ?? '') && typeof args.conversation === 'boolean' && typeof args.files === 'boolean' && (args.conversation || args.files)
        || args.action === 'switch' && ID.test(args.marker ?? '') && typeof args.files === 'boolean'
        || args.action === 'undo' && ID.test(args.marker ?? ''));
      if (!ok) return report(ctx, 'invalid');
      pending = true;
      try {
        // Pi refuses to move the tree while a turn runs; the person chose
        // to stop it (Pysäytä ja palaa).
        if (!ctx.isIdle()) {
          if (args.stop !== true) return report(ctx, 'turn_running');
          ctx.abort();
          await ctx.waitForIdle();
        }
        if (ctx.hasPendingMessages()) return report(ctx, 'queued');
        const s = current(ctx);
        if (args.action === 'rewind') await rewind(args, ctx, s);
        else if (args.action === 'switch') await switchBack(args, ctx, s);
        else await undo(args, ctx, s);
      } catch (error) {
        report(ctx, 'failed', { detail: message(error).slice(0, 200) });
      } finally { pending = false; }
    },
  });
}
