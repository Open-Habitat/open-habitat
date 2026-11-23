// Optional restore policy for snapshot consumers. No host commands or session
// entry names live here: the caller selects edited paths and owns navigation.
import { spawn } from 'node:child_process';
import { lstat, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { SkippedSummary, TurnSnapshotRecord } from './types.ts';

export interface PathError { path: string; error: string }
export interface UndoPoint {
  store: string;
  tree: string;
  root: string;
  cwd: string;
  timestamp: string;
  skipped: SkippedSummary;
  paths: string[];
}
export interface RestoreOptions {
  agentDir: string;
  storeId: string;
  sessionFile?: string | null;
  labelPrefix?: string;
}
export interface RestoreResult {
  covered: Set<string>;
  changed: string[];
  errors: PathError[];
  undo: UndoPoint | null;
}
const isNotFound = (e: unknown) => (e as NodeJS.ErrnoException)?.code === 'ENOENT';
const resolveTracking = (cwd: string, path: string) => isAbsolute(path) ? path : resolve(cwd, path);
let snapshotModule: Promise<typeof import('./index.ts')> | undefined;
const snapshotsModule = () => (snapshotModule ??= import('./index.ts'));

type GitResult = { code: number | 'unavailable' | null; stdout: Buffer; stderr: string };
// Workspace ignore rules are intentionally read from the workspace's own
// configuration, unlike the snapshot store's isolated hashing configuration.
function workspaceGit(args: string[], cwd: string, input?: string, ms = 5000): Promise<GitResult> {
  return new Promise((done) => {
    const env: NodeJS.ProcessEnv = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('GIT_')) env[k] = v;
    Object.assign(env, { GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' });
    let out = Buffer.alloc(0), err = '', settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (code: GitResult['code']) => { if (!settled) { settled = true; clearTimeout(timer); done({ code, stdout: out, stderr: err }); } };
    let child;
    try { child = spawn('git', ['-c', 'core.fsmonitor=false', '-C', cwd, ...args], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] }); } catch { return finish(null); }
    timer = setTimeout(() => { child.kill('SIGKILL'); finish(null); }, ms);
    child.on('error', (e: NodeJS.ErrnoException) => finish(e.code === 'ENOENT' ? 'unavailable' : null));
    child.stdout.on('data', (c: Buffer) => { if (out.length < 4 << 20) out = Buffer.concat([out, c]); });
    child.stderr.on('data', (c: Buffer) => { if (err.length < 65536) err += c.toString('utf8'); });
    child.on('close', (code) => finish(code));
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');
  });
}
export const notARepository = (stderr: string) => /^fatal: not a git repository/m.test(stderr);
async function nearestFolder(file: string) {
  for (let d = dirname(file); ; d = dirname(d)) {
    try { if ((await stat(d)).isDirectory()) return d; } catch { /* Try its parent. */ }
    if (dirname(d) === d) return undefined;
  }
}
// Absolute paths, grouped by their nearest existing folder so nested and
// outside repositories use their own rules. Unknown means leave it alone.
export async function ignoredFiles(files: string[]): Promise<{ ignored: Set<string>; unknown: Set<string> }> {
  const ignored = new Set<string>(), unknown = new Set<string>(), groups = new Map<string, string[]>();
  for (const file of files) {
    const folder = await nearestFolder(file);
    if (!folder) { unknown.add(file); continue; }
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder)!.push(file);
  }
  for (const [folder, group] of groups) {
    const names = group.map((f) => relative(folder, f));
    const listed = await checkIgnore(folder, names);
    for (const [i, f] of group.entries()) if (!listed) unknown.add(f); else if (listed.has(names[i]!)) ignored.add(f);
  }
  return { ignored, unknown };
}
// Relative names ignored now, or null when Git cannot say. A broken config
// also exits 128; only Git's no-repository message means no ignore rules.
export async function checkIgnore(folder: string, names: string[]): Promise<Set<string> | null> {
  if (!names.length) return new Set();
  const r = await workspaceGit(['check-ignore', '-z', '--stdin'], folder, names.join('\0') + '\0');
  if (r.code === 0) return new Set(r.stdout.toString('utf8').split('\0').filter(Boolean));
  if (r.code === 1 || r.code === 'unavailable') return new Set();
  const inside = await workspaceGit(['rev-parse', '--is-inside-work-tree'], folder);
  return inside.code === 128 && notARepository(inside.stderr) ? new Set() : null;
}

// Decide this BEFORE restoring snapshots: restoring .gitignore must not
// enlarge the fallback scope. Legacy checkpoints without edit attribution
// may opt into all tracked paths; decoding those checkpoints is the caller's.
export async function scopeFiles(paths: string[], cwd: string, { paths: edited, legacy }: { paths: Set<string>; legacy: boolean }): Promise<{ scope: Set<string>; errors: PathError[] }> {
  const named = paths.filter((p) => legacy || edited.has(p));
  const { ignored, unknown } = await ignoredFiles(named.map((p) => resolveTracking(cwd, p)));
  const scope = new Set<string>(), errors: PathError[] = [];
  for (const p of named) {
    const file = resolveTracking(cwd, p);
    if (unknown.has(file)) errors.push({ path: p, error: 'Git could not tell whether the file is ignored' });
    else if (!ignored.has(file)) scope.add(p);
  }
  return { scope, errors };
}

const absoluteUnder = (root: string, paths: string[]) => new Set(paths.map((p) => resolve(root, ...p.split('/'))));
const rootRelative = (root: string, files: string[]) => files.map((f) => relative(root, f).split(sep).join('/'));
const skippedBy = (summary?: SkippedSummary) => {
  const skipped = (summary?.paths ?? []).map((p) => p.path);
  return (path: string) => skipped.some((s) => path === s || path.startsWith(`${s}/`));
};
// Best effort, not a transaction with concurrent writers. Every overwritten
// existing file must be held by the undo tree. `covered` uses absolute paths;
// `changed` and undo.paths are root-relative and contain only actual writes.
export async function restoreWithUndo(options: RestoreOptions, target: TurnSnapshotRecord, pathsOrFind: string[] | (() => Promise<string[]>)): Promise<RestoreResult> {
  try {
    return await restoreFromSnapshot(options, target, typeof pathsOrFind === 'function' ? await pathsOrFind() : pathsOrFind);
  } catch (e) {
    return { covered: new Set(), changed: [], errors: [{ path: target.root ?? target.cwd, error: e instanceof Error ? e.message : String(e) }], undo: null };
  }
}
async function restoreFromSnapshot({ agentDir: dir, storeId, sessionFile = null, labelPrefix = 'rewind' }: RestoreOptions, target: TurnSnapshotRecord, all: string[]): Promise<RestoreResult> {
  const m = await snapshotsModule();
  if (!target.root || !target.tree) throw new Error('target has no snapshot tree');
  // Skipped target paths belong to the per-file fallback, not this tree.
  const inTarget = skippedBy(target.skipped);
  let paths = all.filter((p) => !inTarget(p));
  const ignored = await checkIgnore(target.root, paths);
  const unanswered = ignored ? [] : paths;
  paths = ignored ? paths.filter((p) => !ignored.has(p)) : [];
  if (!paths.length) return { covered: new Set(), changed: [], errors: unanswered.map((p) => ({ path: p, error: 'Git could not tell whether the file is ignored' })), undo: null };
  const now = await m.snapshotNow({ agentDir: dir, storeId, cwd: target.cwd, sessionFile, labelPrefix });
  // A truncated skip list cannot prove which paths have a usable undo copy.
  if (!now.tree || now.root !== target.root || now.skipped?.truncated) return { covered: new Set(), changed: [], errors: paths.map((p) => ({ path: p, error: `no undo point (${now.reason ?? (now.skipped?.truncated ? 'too many skipped files' : 'different repository')})` })), undo: null };
  const inUndo = skippedBy(now.skipped);
  const held = await inTree(dir, storeId, now.tree, target.root, paths);
  const unsaved = paths.filter((p) => inUndo(p) || !held(p));
  paths = paths.filter((p) => !inUndo(p) && held(p));
  const result = await m.restorePaths(dir, target, paths);
  const changed = rootRelative(target.root, result.changedFiles);
  return { covered: absoluteUnder(target.root, paths), changed, errors: [...unanswered.map((p) => ({ path: p, error: 'Git could not tell whether the file is ignored' })), ...result.errors, ...unsaved.map((p) => ({ path: p, error: 'not in the undo point' }))], undo: { store: storeId, tree: now.tree, root: now.root, cwd: target.cwd, timestamp: now.startedAt, skipped: now.skipped, paths: changed } };
}
// A missing disk path needs no backup; any other path must occur in the tree.
async function inTree(dir: string, storeId: string, tree: string, root: string, paths: string[]): Promise<(path: string) => boolean> {
  const { storeGit, storeDirectory } = await import('./store.ts');
  const onDisk: string[] = [];
  for (const p of paths) { try { await lstat(resolve(root, ...p.split('/'))); onDisk.push(p); } catch (e) { if (!isNotFound(e)) onDisk.push(p); } }
  const listed = new Set<string>();
  for (let i = 0; i < onDisk.length; i += 200) {
    const r = await storeGit(storeDirectory(dir, storeId), ['ls-tree', '-r', '-z', '--full-tree', '--name-only', tree, '--', ...onDisk.slice(i, i + 200)], { timeoutMs: 10_000, env: { GIT_LITERAL_PATHSPECS: '1' } });
    if (r.code !== 0) return () => false;
    for (const name of r.stdout.toString('utf8').split('\0')) if (name) listed.add(name);
  }
  const absent = new Set(onDisk.filter((p) => !listed.has(p)));
  return (p) => !absent.has(p);
}
