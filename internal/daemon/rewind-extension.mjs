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
// What differs from better-pi-rewind: the daemon asks through one command
// instead of a terminal selector; copies are named by their content, so an
// unchanged file is one copy however many turns track it; a restore first
// copies the files as they are, so the replaced continuation can be returned
// to with its files and a files-only restore can be undone; a restore never
// writes through a symlink; there is no Git reset.
import { createHash, randomUUID } from 'node:crypto';
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
  return data?.version === VERSION && validUnavailable(data.unavailable) && (data.kind === 'snapshot' || data.kind === 'update') && ID.test(data.userEntryId ?? '') && validFiles(data.files) && (data.kind === 'update' || typeof data.cwd === 'string' && isAbsolute(data.cwd));
}

// better-pi-rewind's CheckpointHistory: one checkpoint per person's message,
// the files it had copied, and every path ever tracked in the session with
// its first copy (the state before anything here touched it).
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
      this.checkpoints.set(record.userEntryId, { userEntryId: record.userEntryId, cwd: record.cwd, files: { ...record.files }, unavailable: new Set(record.unavailable ?? []) });
    } else {
      const checkpoint = this.checkpoints.get(record.userEntryId);
      if (!checkpoint) return;
      Object.assign(checkpoint.files, record.files);
      for (const p of record.unavailable ?? []) if (!record.files[p]) checkpoint.unavailable.add(p);
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

const report = (ctx, outcome, extra = {}) => {
  try { ctx.ui.notify(OUTCOME + JSON.stringify({ outcome, ...extra }), outcome === 'done' ? 'info' : 'error'); } catch { /* No UI: the daemon reports an unknown outcome. */ }
};
const restoredFiles = (result) => ({ restored: result.changed.length, errors: result.errors.length, paths: result.changed });
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
    append({ version: VERSION, kind: 'snapshot', userEntryId: entry.id, cwd: ctx.cwd, timestamp: new Date().toISOString(), files: captured.files, ...(unavailable.length ? { unavailable } : {}) });
    s.current = entry.id;
  });
  // Before an edit or write first touches a file in a turn, copy it.
  pi.on('tool_call', async (event, ctx) => {
    if (event.toolName !== 'edit' && event.toolName !== 'write') return;
    const s = current(ctx);
    const checkpoint = s.current ? s.history.get(s.current) : undefined;
    if (!checkpoint) return;
    const files = {}, unavailable = [];
    for (const input of toolInputPaths(event.toolName, event.input)) {
      const absolute = toolPath(input, ctx.cwd);
      const path = trackingPath(checkpoint.cwd, absolute);
      if (checkpoint.files[path] || checkpoint.unavailable.has(path) || files[path]) continue;
      try { files[path] = await captureFile(absolute, dir, s.storeId); } catch { unavailable.push(path); }
    }
    if (Object.keys(files).length || unavailable.length) append({ version: VERSION, kind: 'update', userEntryId: checkpoint.userEntryId, files, ...(unavailable.length ? { unavailable } : {}) });
  });

  async function rewind(args, ctx, s) {
    const sm = ctx.sessionManager;
    const entry = sm.getEntry(args.entry);
    const branch = sm.getBranch();
    if (!isUser(entry) || !branch.some((e) => e.id === entry.id)) return report(ctx, 'not_found');
    const checkpoint = s.history.get(entry.id);
    if (args.files && !checkpoint) return report(ctx, 'no_checkpoint');
    const leaf = sm.getLeafId();
    const later = branch.slice(branch.findIndex((e) => e.id === entry.id));
    let before, restore;
    if (args.files) {
      // The files as the agent left them, so this continuation can be
      // returned to with its files, or a files-only restore undone.
      // A file that cannot be copied now is left as it is.
      before = await captureAll(s.history.paths(), checkpoint.cwd, dir, s.storeId);
      restore = await restoreVersions(checkpointVersions(s.history, checkpoint).filter(([p]) => before.files[p]), checkpoint.cwd, dir);
      restore.errors.push(...before.errors);
    }
    const data = { version: VERSION, action: args.conversation ? 'rewind' : 'files', at: entry.id, ...counts(later), cwd: checkpoint?.cwd ?? ctx.cwd, files: restore ? restoredFiles(restore) : null, ...(before ? { before: before.files } : {}) };
    if (args.conversation) {
      // Pi's navigation puts a person's message or a custom message back in
      // the field instead of landing on it, so such a leaf (an unanswered
      // message, this extension's own note) gets an anchor to return to.
      const leafEntry = leaf ? sm.getEntry(leaf) : undefined;
      if (isUser(leafEntry) || leafEntry?.type === 'custom_message') pi.appendEntry(ANCHOR, {});
      const left = sm.getLeafId();
      const result = await ctx.navigateTree(entry.id);
      if (result.cancelled) {
        if (before) await restoreVersions(Object.entries(before.files), checkpoint.cwd, dir);
        return report(ctx, 'cancelled');
      }
      data.left = left;
      pi.appendEntry(MARKER, data);
    } else {
      pi.appendEntry(MARKER, data);
      if (restore.changed.length) pi.sendMessage({ customType: NOTE, content: filesNote(restore.changed.length), display: false }, { triggerTurn: false });
    }
    rebuild(ctx);
    report(ctx, 'done', { restored: restore?.changed.length ?? 0, errors: restore?.errors.length ?? 0 });
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
    if (!continuation(sm, sm.getLeafId(), sm.getBranch(target.id)).length) return report(ctx, 'not_switchable');
    const leafEntry = sm.getEntry(sm.getLeafId());
    if (isUser(leafEntry) || leafEntry?.type === 'custom_message') pi.appendEntry(ANCHOR, {});
    const leaf = sm.getLeafId();
    const left = continuation(sm, leaf, sm.getBranch(target.id));
    const cwd = typeof marker.data.cwd === 'string' && isAbsolute(marker.data.cwd) ? marker.data.cwd : ctx.cwd;
    let before, restore;
    if (args.files) {
      const paths = [...new Set([...Object.keys(marker.data.before), ...trackedSince(branch, marker.id).keys()])];
      before = await captureAll(paths, cwd, dir, s.storeId);
      const versions = new Map([...trackedSince(branch, marker.id), ...Object.entries(marker.data.before)]);
      restore = await restoreVersions([...versions].filter(([p]) => before.files[p]), cwd, dir);
      restore.errors.push(...before.errors);
    }
    const result = await ctx.navigateTree(target.id);
    if (result.cancelled) {
      if (before) await restoreVersions(Object.entries(before.files), cwd, dir);
      return report(ctx, 'cancelled');
    }
    pi.appendEntry(MARKER, { version: VERSION, action: 'switch', at: left[0].id, left: leaf, ...counts(left), cwd, files: restore ? restoredFiles(restore) : null, ...(before ? { before: before.files } : {}) });
    rebuild(ctx);
    report(ctx, 'done', { restored: restore?.changed.length ?? 0, errors: restore?.errors.length ?? 0 });
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
    // The files as they are now: a hand edit or a later turn's work since the
    // restore has no other copy.
    const before = await captureAll(versions.map(([p]) => p), cwd, dir, s.storeId);
    const restore = await restoreVersions(versions.filter(([p]) => before.files[p]), cwd, dir);
    restore.errors.push(...before.errors);
    pi.appendEntry(MARKER, { version: VERSION, action: 'undo', of: marker.id, cwd, files: restoredFiles(restore), before: before.files });
    if (restore.changed.length) pi.sendMessage({ customType: NOTE, content: undoNote(restore.changed.length), display: false }, { triggerTurn: false });
    rebuild(ctx);
    report(ctx, 'done', { restored: restore.changed.length, errors: restore.errors.length });
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
