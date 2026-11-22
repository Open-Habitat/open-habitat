import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { chmod, copyFile, lstat, mkdir, readFile, readlink, realpath, rename, rm, rmdir, symlink, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { GIT_OBJECT_ID, gitError, isolatedGitEnv, splitNul } from "./git.ts";
import {
	DEFAULT_SNAPSHOT_LIMITS,
	adHocLabel,
	diffTreeNumstat,
	probeWorkspace,
	snapshotWorkTree,
	storeDirectory,
	storeExists,
	storeGit,
	takeSnapshot,
	type NumstatEntry,
	type SnapshotLimits,
	type SnapshotResult,
	type StoreHandle,
} from "./store.ts";
import type { SkippedSummary, TurnSnapshotRecord } from "./types.ts";

export type ChangeStatus = "added" | "modified" | "deleted" | "renamed" | "copied" | "type-changed";

export interface ChangedFile {
	/** Path relative to the snapshot root, with forward slashes. */
	path: string;
	oldPath?: string;
	status: ChangeStatus;
	/** null for a binary file. */
	additions: number | null;
	deletions: number | null;
}

export interface Comparison {
	files: ChangedFile[];
	/** True when more files changed than `maxFiles` allowed to be returned. */
	truncated: boolean;
}

export interface Turn {
	userEntryId: string;
	start: TurnSnapshotRecord;
	end?: TurnSnapshotRecord;
	/** The next turn's start, when this turn has no end of its own (steered, or the host stopped). */
	nextStart?: TurnSnapshotRecord;
}

/**
 * Groups the records of one conversation branch (in branch order) into
 * turns. The agent's window of a turn runs from its start to its end, or to
 * the next start when the run was steered or never settled.
 */
export function listTurns(records: readonly TurnSnapshotRecord[]): Turn[] {
	const turns: Turn[] = [];
	let open: Turn | undefined;
	for (const record of records) {
		if (record.phase === "start") {
			if (open && !open.end) open.nextStart = record;
			open = { userEntryId: record.userEntryId, start: record };
			turns.push(open);
		} else if (open && !open.end && record.userEntryId === open.userEntryId) {
			open.end = record;
		}
	}
	return turns;
}

/** Whether a turn settled with an end entry of its own. */
export function isSettled(turn: Turn): boolean {
	return turn.end !== undefined;
}

/** The record that closes a turn's agent window, if any. */
export function windowEnd(turn: Turn): TurnSnapshotRecord | undefined {
	return turn.end ?? turn.nextStart;
}

function statusFromLetter(letter: string): ChangeStatus | undefined {
	switch (letter[0]) {
		case "A":
			return "added";
		case "M":
			return "modified";
		case "D":
			return "deleted";
		case "R":
			return "renamed";
		case "C":
			return "copied";
		case "T":
			return "type-changed";
		default:
			return undefined;
	}
}

function parseNameStatus(output: Buffer): Array<{ status: ChangeStatus; path: string; oldPath?: string }> {
	const fields = splitNul(output);
	const entries: Array<{ status: ChangeStatus; path: string; oldPath?: string }> = [];
	for (let index = 0; index < fields.length; ) {
		const letter = fields[index++]!;
		const status = statusFromLetter(letter);
		if (status === "renamed" || status === "copied") {
			const oldPath = fields[index++];
			const path = fields[index++];
			if (oldPath !== undefined && path !== undefined) entries.push({ status, path, oldPath });
		} else {
			const path = fields[index++];
			if (status && path !== undefined) entries.push({ status, path });
		}
	}
	return entries;
}

function joinComparison(
	statuses: ReturnType<typeof parseNameStatus>,
	counts: readonly NumstatEntry[],
	maxFiles: number,
): Comparison {
	const byPath = new Map(counts.map((entry) => [entry.path, entry]));
	const files = statuses.map((entry): ChangedFile => {
		const count = byPath.get(entry.path);
		return {
			path: entry.path,
			...(entry.oldPath !== undefined ? { oldPath: entry.oldPath } : {}),
			status: entry.status,
			additions: count ? count.additions : null,
			deletions: count ? count.deletions : null,
		};
	});
	return { files: files.slice(0, maxFiles), truncated: files.length > maxFiles };
}

function requireTree(tree: string | null | undefined): string {
	if (!tree || !GIT_OBJECT_ID.test(tree)) throw new Error("The turn has no snapshot");
	return tree;
}

/** Files, kinds of change and line counts between two trees of one store. */
export async function compareTrees(
	agentDir: string,
	storeId: string,
	from: string,
	to: string,
	options: { maxFiles?: number; timeoutMs?: number } = {},
): Promise<Comparison> {
	const dir = storeDirectory(agentDir, storeId);
	requireTree(from);
	requireTree(to);
	const timeoutMs = options.timeoutMs ?? 10_000;
	const [names, counts] = await Promise.all([
		storeGit(dir, ["diff-tree", "-r", "-M", "-z", "--name-status", from, to], { timeoutMs }),
		diffTreeNumstat(dir, from, to, { timeoutMs }),
	]);
	if (names.code !== 0) throw gitError(names, "diff-tree failed");
	return joinComparison(parseNameStatus(names.stdout), counts, options.maxFiles ?? 1_000);
}

/** The files of one turn's agent window. */
export async function compareTurn(
	agentDir: string,
	turn: Turn,
	options: { maxFiles?: number; timeoutMs?: number } = {},
): Promise<Comparison> {
	const end = windowEnd(turn);
	if (!end) throw new Error("The turn has not ended");
	if (end.store !== turn.start.store) throw new Error("The turn's snapshots are in different stores");
	return compareTrees(agentDir, turn.start.store, requireTree(turn.start.tree), requireTree(end.tree), options);
}

/** The unified diff of the given paths between two trees, bounded by `maxBytes`. */
export async function diffFiles(
	agentDir: string,
	storeId: string,
	from: string,
	to: string,
	paths: readonly string[],
	options: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<{ patch: string; truncated: boolean }> {
	const dir = storeDirectory(agentDir, storeId);
	const maxBytes = options.maxBytes ?? 1024 * 1024;
	const result = await storeGit(
		dir,
		["diff-tree", "-p", "-r", "-M", "--no-ext-diff", "--no-textconv", "--no-color", requireTree(from), requireTree(to), "--", ...paths],
		{ timeoutMs: options.timeoutMs ?? 10_000, maxOutputBytes: maxBytes, env: { GIT_LITERAL_PATHSPECS: "1" } },
	);
	if (result.failure === "output-limit") return { patch: result.stdout.toString("utf8"), truncated: true };
	if (result.code !== 0) throw gitError(result, "diff-tree failed");
	return { patch: result.stdout.toString("utf8"), truncated: false };
}

async function openStore(agentDir: string, record: TurnSnapshotRecord, deadline: number): Promise<StoreHandle> {
	if (!record.root) throw new Error("The turn has no snapshot");
	if (!(await storeExists(agentDir, record.store))) throw new Error("The snapshot store no longer exists");
	const probed = await probeWorkspace(record.cwd, deadline);
	if (probed.kind === "none") throw new Error(`The working tree cannot be read (${probed.reason})`);
	if (probed.probe.root !== record.root) throw new Error("The working directory now belongs to a different repository");
	return { dir: storeDirectory(agentDir, record.store), storeId: record.store, probe: probed.probe };
}

/**
 * Compares a recorded tree with the files as they are now: what restoring
 * that tree would change. Works on a private copy of the store's index, so
 * the store's own index and refs are left as they were.
 */
export async function compareWithWorkingTree(
	agentDir: string,
	record: TurnSnapshotRecord,
	options: { maxFiles?: number; limits?: Partial<SnapshotLimits> } = {},
): Promise<Comparison & { skipped: SkippedSummary }> {
	const tree = requireTree(record.tree);
	const limits = { ...DEFAULT_SNAPSHOT_LIMITS, ...options.limits };
	const deadline = Date.now() + limits.timeBudgetMs;
	const store = await openStore(agentDir, record, deadline);
	const scratchIndex = join(dirname(store.dir), `.compare-index-${randomUUID()}`);
	try {
		await copyFile(join(store.dir, "index"), scratchIndex).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		});
		const now: SnapshotResult = await snapshotWorkTree(store, limits, deadline, scratchIndex);
		if (now.tree === null) throw new Error(`The working tree could not be read (${now.reason})`);
		const comparison = await compareTrees(agentDir, record.store, tree, now.tree, options);
		return { ...comparison, skipped: now.skipped };
	} finally {
		await rm(scratchIndex, { force: true });
		await rm(`${scratchIndex}.lock`, { force: true });
	}
}

/**
 * The paths that changed in any agent window from the turn of `userEntryId`
 * onward, along the branch the records describe. `incomplete` is true when a
 * window has no snapshot at either end; such a window's changes are unknown.
 */
export async function pathsChangedSince(
	agentDir: string,
	records: readonly TurnSnapshotRecord[],
	userEntryId: string,
): Promise<{ paths: string[]; incomplete: boolean }> {
	const turns = listTurns(records);
	const first = turns.findIndex((turn) => turn.userEntryId === userEntryId);
	if (first === -1) throw new Error("The message has no turn snapshot");
	const paths = new Set<string>();
	let incomplete = false;
	for (const turn of turns.slice(first)) {
		const end = windowEnd(turn);
		if (!turn.start.tree) {
			incomplete = true;
			continue;
		}
		if (end && end.tree && end.store === turn.start.store && end.root === turn.start.root) {
			const comparison = await compareTrees(agentDir, turn.start.store, turn.start.tree, end.tree, { maxFiles: Number.MAX_SAFE_INTEGER });
			for (const file of comparison.files) {
				paths.add(file.path);
				if (file.oldPath) paths.add(file.oldPath);
			}
		} else if (!end) {
			// The last run is still open: its window reaches the files as they are now.
			const comparison = await compareWithWorkingTree(agentDir, turn.start, { maxFiles: Number.MAX_SAFE_INTEGER });
			for (const file of comparison.files) {
				paths.add(file.path);
				if (file.oldPath) paths.add(file.oldPath);
			}
		} else {
			incomplete = true;
		}
	}
	return { paths: [...paths].sort(), incomplete };
}

export interface SnapshotNowOptions {
	agentDir: string;
	storeId: string;
	cwd: string;
	sessionFile: string | null;
	/** Ref label prefix; a unique suffix is added. */
	labelPrefix?: string;
	limits?: Partial<SnapshotLimits>;
}

/** A snapshot outside the turn boundaries, for example an undo point taken just before a restore. */
export function snapshotNow(options: SnapshotNowOptions): Promise<SnapshotResult> {
	return takeSnapshot({
		agentDir: options.agentDir,
		storeId: options.storeId,
		cwd: options.cwd,
		sessionFile: options.sessionFile,
		label: adHocLabel(options.labelPrefix),
		...(options.limits ? { limits: options.limits } : {}),
	});
}

export interface RestoreResult {
	/** Absolute paths that were written or removed. */
	changedFiles: string[];
	errors: Array<{ path: string; error: string }>;
}

function validRelativePath(path: string): boolean {
	if (path.length === 0 || path.startsWith("/") || path.includes("\0") || path.includes("\\")) return false;
	const parts = path.split("/");
	return parts.every((part) => part !== "" && part !== "." && part !== ".." && part.toLowerCase() !== ".git");
}

interface TreeEntry {
	mode: string;
	type: string;
	object: string;
}

async function lsTree(dir: string, tree: string, paths: readonly string[]): Promise<Map<string, TreeEntry>> {
	const entries = new Map<string, TreeEntry>();
	for (let index = 0; index < paths.length; index += 500) {
		const chunk = paths.slice(index, index + 500);
		const result = await storeGit(dir, ["ls-tree", "-z", "--full-tree", tree, "--", ...chunk], {
			timeoutMs: 10_000,
			env: { GIT_LITERAL_PATHSPECS: "1" },
		});
		if (result.code !== 0) throw gitError(result, "ls-tree failed");
		for (const record of splitNul(result.stdout)) {
			const tab = record.indexOf("\t");
			const [mode, type, object] = record.slice(0, tab).split(" ");
			if (mode && type && object) entries.set(record.slice(tab + 1), { mode, type, object });
		}
	}
	return entries;
}

function blobId(content: Buffer, objectIdLength: number): string {
	const algorithm = objectIdLength === 64 ? "sha256" : "sha1";
	return createHash(algorithm).update(`blob ${content.length}\0`).update(content).digest("hex");
}

async function symlinkMatches(filePath: string, entry: TreeEntry): Promise<boolean> {
	try {
		if (!(await lstat(filePath)).isSymbolicLink()) return false;
		return blobId(Buffer.from(await readlink(filePath), "utf8"), entry.object.length) === entry.object;
	} catch {
		return false;
	}
}

async function sameFile(left: string, right: string): Promise<boolean> {
	const [a, b] = await Promise.all([lstat(left), lstat(right)]);
	if (!a.isFile() || !b.isFile() || a.size !== b.size) return false;
	if ((a.mode & 0o111) !== (b.mode & 0o111)) return false;
	const [x, y] = await Promise.all([readFile(left), readFile(right)]);
	return x.equals(y);
}

/**
 * Walks the parent directories of a path below `root`, refusing any that is a
 * symlink. Missing ones are created when `create` is set; otherwise the walk
 * returns undefined at the first missing one.
 */
async function safeParent(root: string, relativePath: string, create = true): Promise<string | undefined> {
	const parts = relativePath.split("/");
	parts.pop();
	let current = root;
	for (const part of parts) {
		current = join(current, part);
		try {
			const info = await lstat(current);
			if (info.isSymbolicLink()) throw new Error(`${current} is a symbolic link`);
			if (!info.isDirectory()) throw new Error(`${current} is not a directory`);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			if (!create) return undefined;
			await mkdir(current);
		}
	}
	return current;
}

/**
 * Writes a blob as Git would check it out: `cat-file --filters` applies the
 * built-in end-of-line and working-tree-encoding conversions named by the
 * workspace's attributes, so a CRLF or UTF-16 file comes back as it was.
 * (Repositories with external filter drivers are never recorded.)
 */
async function writeBlob(store: StoreHandle, path: string, object: string, destination: string, mode: number): Promise<void> {
	const args = [
		"--git-dir",
		store.dir,
		"--work-tree",
		store.probe.root,
		...store.probe.configArgs,
		"-c",
		"core.fsmonitor=false",
		"cat-file",
		"--filters",
		`--path=${path}`,
		object,
	];
	const child = spawn("git", args, {
		cwd: store.probe.root,
		env: isolatedGitEnv(),
		stdio: ["ignore", "pipe", "pipe"],
		windowsHide: true,
	});
	let stderr = "";
	child.stderr.on("data", (chunk: Buffer) => {
		if (stderr.length < 16 * 1024) stderr += chunk.toString("utf8");
	});
	const exited = new Promise<number | null>((resolveExit, rejectExit) => {
		child.on("error", rejectExit);
		child.on("close", resolveExit);
	});
	try {
		await pipeline(child.stdout, createWriteStream(destination, { flags: "wx", mode }));
	} catch (error) {
		child.kill("SIGKILL");
		await exited.catch(() => {});
		throw error;
	}
	const code = await exited;
	if (code !== 0) throw new Error(stderr.trim() || "cat-file failed");
}

async function readBlobText(dir: string, object: string): Promise<string> {
	const result = await storeGit(dir, ["cat-file", "blob", object], { timeoutMs: 10_000, maxOutputBytes: 64 * 1024 });
	if (result.code !== 0) throw gitError(result, "cat-file failed");
	return result.stdout.toString("utf8");
}

async function removePath(root: string, path: string, snapshotTime: number): Promise<boolean> {
	if ((await safeParent(root, path, false)) === undefined) return false;
	const target = join(root, ...path.split("/"));
	let info;
	try {
		info = await lstat(target);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw error;
	}
	if (info.isDirectory()) throw new Error("A directory is in the way");
	// Absence from the tree means "did not exist" only for a file the snapshot could see.
	// One older than the moment the snapshot began existed then, ignored or otherwise
	// unrecorded. A coarse file system clock can only make a file look older, which refuses.
	if (!Number.isFinite(snapshotTime) || info.mtimeMs < snapshotTime || (info.birthtimeMs > 0 && info.birthtimeMs < snapshotTime)) {
		throw new Error("The file is older than the snapshot; not removed");
	}
	await unlink(target);
	return true;
}

async function writePath(store: StoreHandle, path: string, entry: TreeEntry): Promise<boolean> {
	const root = store.probe.root;
	if (entry.mode === "160000") throw new Error("A nested repository cannot be restored");
	if (entry.type !== "blob") throw new Error("Not a file in the snapshot");
	const target = join(root, ...path.split("/"));
	if (entry.mode === "120000" && (await symlinkMatches(target, entry))) return false;
	const parent = (await safeParent(root, path))!;
	let existing = await lstat(target).catch(() => undefined);
	if (existing?.isDirectory()) {
		// A file the run replaced by a directory: only an empty directory gives way.
		try {
			await rmdir(target);
		} catch {
			throw new Error("A directory is in the way");
		}
		existing = undefined;
	}

	const temporary = join(parent, `.${path.split("/").at(-1)}.turn-snapshot-${randomUUID()}.tmp`);
	try {
		if (entry.mode === "120000") {
			await symlink(await readBlobText(store.dir, entry.object), temporary);
		} else {
			const executable = entry.mode === "100755";
			const baseMode = existing?.isFile() ? existing.mode & 0o666 : 0o644;
			const mode = executable ? baseMode | ((baseMode & 0o444) >> 2) : baseMode;
			await writeBlob(store, path, entry.object, temporary, mode);
			await chmod(temporary, mode);
			if (existing?.isFile() && (await sameFile(temporary, target))) {
				await rm(temporary, { force: true });
				return false;
			}
		}
		// rename replaces a symlink at the target instead of writing through it.
		await rename(temporary, target);
	} catch (error) {
		await rm(temporary, { force: true });
		throw error;
	}
	return true;
}

function isProtectedBySkip(record: TurnSnapshotRecord, path: string): boolean {
	return record.skipped.paths.some((item) => item.path === path || path.startsWith(`${item.path}/`));
}

/**
 * Whether any `.gitignore` differs between the tree and the files now. A
 * file that was ignored when the tree was taken is absent from it without
 * having been absent from disk, so removals are only safe when the ignore
 * rules are the same as then.
 */
async function ignoreRulesChanged(store: StoreHandle, tree: string): Promise<boolean> {
	const recorded = await storeGit(store.dir, ["ls-tree", "-r", "-z", "--full-tree", tree], { timeoutMs: 10_000, maxOutputBytes: 256 * 1024 * 1024 });
	if (recorded.code !== 0) throw gitError(recorded, "ls-tree failed");
	const then = new Map<string, string>();
	for (const record of splitNul(recorded.stdout)) {
		const tab = record.indexOf("\t");
		const path = record.slice(tab + 1);
		if (path === ".gitignore" || path.endsWith("/.gitignore")) then.set(path, record.slice(0, tab).split(" ")[2]!);
	}
	const listed = await storeGit(store.dir, ["ls-files", "-z", "-c", "-o", "--exclude-standard", "--", ":(glob)**/.gitignore"], {
		workTree: store.probe,
		timeoutMs: 10_000,
		env: { GIT_OPTIONAL_LOCKS: "0" },
	});
	if (listed.code !== 0) throw gitError(listed, "ls-files failed");
	const now = new Set(splitNul(listed.stdout));
	for (const path of then.keys()) now.add(path);
	for (const path of now) {
		const content = await readFile(join(store.probe.root, ...path.split("/"))).catch(() => undefined);
		const recordedId = then.get(path);
		if (content === undefined) {
			if (recordedId !== undefined) return true;
			continue;
		}
		if (recordedId === undefined || blobId(content, recordedId.length) !== recordedId) return true;
	}
	return false;
}

/**
 * Puts each path back to its content in `record`'s tree: written whole
 * through a temporary name and a rename, never through a symlink, with Git's
 * executable bit and checkout conversions. A path missing from the tree is
 * removed, unless the snapshot skipped it (or skipped too many paths to
 * say), the ignore rules changed since, or the file is older than the
 * snapshot, since then its absence does not mean it did not exist. Removals run first, deepest first, so a file the
 * run replaced by a directory can come back. Restore is per path; one
 * failure is reported and the others continue. Git's own state is never
 * touched.
 */
export async function restorePaths(
	agentDir: string,
	record: TurnSnapshotRecord,
	paths: readonly string[],
): Promise<RestoreResult> {
	const tree = requireTree(record.tree);
	const store = await openStore(agentDir, record, Date.now() + 10_000);
	const root = store.probe.root;
	if ((await realpath(root)) !== (await realpath(record.root!))) throw new Error("The working directory now belongs to a different repository");
	const changedFiles: string[] = [];
	const errors: RestoreResult["errors"] = [];
	const valid = [...new Set(paths)].filter((path) => {
		if (validRelativePath(path)) return true;
		errors.push({ path, error: "Not a restorable path" });
		return false;
	});
	const entries = await lsTree(store.dir, tree, valid);
	const removals = valid.filter((path) => !entries.has(path)).sort((a, b) => b.split("/").length - a.split("/").length);
	const writes = valid.filter((path) => entries.has(path)).sort((a, b) => a.split("/").length - b.split("/").length);
	const rulesChanged = removals.length > 0 && (await ignoreRulesChanged(store, tree));

	for (const path of removals) {
		const absolute = join(root, ...path.split("/"));
		if (record.skipped.truncated || isProtectedBySkip(record, path)) {
			errors.push({ path: absolute, error: "The snapshot did not record this path" });
			continue;
		}
		if (rulesChanged) {
			errors.push({ path: absolute, error: "Ignore rules changed since the snapshot; not removed" });
			continue;
		}
		try {
			if (await removePath(root, path, Date.parse(record.timestamp))) changedFiles.push(absolute);
		} catch (error) {
			errors.push({ path: absolute, error: error instanceof Error ? error.message : String(error) });
		}
	}
	for (const path of writes) {
		const absolute = join(root, ...path.split("/"));
		try {
			if (await writePath(store, path, entries.get(path)!)) changedFiles.push(absolute);
		} catch (error) {
			errors.push({ path: absolute, error: error instanceof Error ? error.message : String(error) });
		}
	}
	return { changedFiles, errors };
}
