import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, chmod, copyFile, lstat, mkdir, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { devNull, homedir } from "node:os";
import { join, resolve } from "node:path";
import {
	GIT_OBJECT_ID,
	baseGitEnv,
	gitError,
	isolatedGitEnv,
	runGit,
	splitNul,
	type GitResult,
	type GitRunOptions,
} from "./git.ts";
import {
	isSafeStoreId,
	type NoSnapshotReason,
	type SkipReason,
	type SkippedPath,
	type SkippedSummary,
	type TurnSnapshotStat,
} from "./types.ts";

export interface SnapshotLimits {
	/** Largest file stored by one snapshot. Larger new or changed files are skipped and named. */
	maxFileBytes: number;
	/** Most new content one snapshot may store. Later files are skipped and named. */
	maxSnapshotBytes: number;
	/** Wall-clock budget for one snapshot, including the workspace probe. */
	timeBudgetMs: number;
	/** How many skipped paths an entry names before it says `truncated`. */
	maxListedSkipped: number;
}

export const DEFAULT_SNAPSHOT_LIMITS: SnapshotLimits = {
	maxFileBytes: 20 * 1024 * 1024,
	maxSnapshotBytes: 200 * 1024 * 1024,
	timeBudgetMs: 2_000,
	maxListedSkipped: 200,
};

export const STORE_DIR_NAME = "tree.git";
export const STORE_META_FILE = "turn-snapshot.json";
export const SNAPSHOT_REF_PREFIX = "refs/snapshots/";

/**
 * Workspace settings that change how Git hashes or matches working-tree
 * files. The store reads no system or global configuration, so these are
 * copied from the workspace's effective configuration; nothing that can run
 * a program (hooks, filters, fsmonitor, textconv) is copied.
 */
const COPIED_CORE_KEYS = [
	"autocrlf",
	"eol",
	"filemode",
	"symlinks",
	"ignorecase",
	"precomposeunicode",
	"trustctime",
	"checkstat",
] as const;

export interface WorkspaceProbe {
	root: string;
	objectsDir: string;
	indexPath: string;
	excludeFrom?: string;
	configArgs: string[];
}

export type ProbeResult = { kind: "ok"; probe: WorkspaceProbe } | { kind: "none"; reason: NoSnapshotReason; root: string | null };

export interface StoreHandle {
	dir: string;
	storeId: string;
	probe: WorkspaceProbe;
}

export interface SnapshotResult {
	/** When the snapshot began (ISO 8601); anything older than this existed when it was taken. */
	startedAt: string;
	tree: string | null;
	reason: NoSnapshotReason | null;
	root: string | null;
	skipped: SkippedSummary;
	ref?: string;
	/** Present when a snapshot failed for an unexpected reason; for diagnostics only. */
	error?: string;
}

const EMPTY_SKIPPED: SkippedSummary = { count: 0, paths: [], truncated: false };

export function storeDirectory(agentDir: string, storeId: string): string {
	if (!isSafeStoreId(storeId)) throw new Error("Invalid turn-snapshot store ID");
	return join(agentDir, "file-history", storeId, STORE_DIR_NAME);
}

function exists(path: string): Promise<boolean> {
	return access(path).then(
		() => true,
		() => false,
	);
}

function workspaceGit(args: readonly string[], options: GitRunOptions): Promise<GitResult> {
	return runGit(["-c", "core.fsmonitor=false", ...args], options, baseGitEnv());
}

/** Runs Git against the private store. `root` is supplied only for commands that look at the working tree. */
export function storeGit(
	dir: string,
	args: readonly string[],
	options: Omit<GitRunOptions, "cwd"> & { workTree?: WorkspaceProbe },
): Promise<GitResult> {
	const prefix = ["--git-dir", dir];
	if (options.workTree) prefix.push("--work-tree", options.workTree.root, ...options.workTree.configArgs);
	prefix.push("-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false", "-c", "gc.auto=0");
	return runGit([...prefix, ...args], { ...options, cwd: options.workTree?.root ?? dir }, isolatedGitEnv());
}

function expandHome(path: string): string {
	if (path === "~") return homedir();
	if (path.startsWith("~/")) return join(homedir(), path.slice(2));
	return path;
}

async function attributesUseFilters(probe: { root: string }, infoAttributes: string, attributesFile: string | undefined, deadline: number): Promise<boolean> {
	const listed = await workspaceGit(
		["-C", probe.root, "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ":(glob)**/.gitattributes"],
		{ cwd: probe.root, deadline },
	);
	if (listed.code !== 0) throw gitError(listed, "Could not list attribute files");
	const files = [
		...splitNul(listed.stdout).map((path) => join(probe.root, path)),
		infoAttributes,
		...(attributesFile ? [attributesFile] : []),
	];
	for (const file of files) {
		let text: string;
		try {
			text = await readFile(file, "utf8");
		} catch {
			continue;
		}
		for (const line of text.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			if (/(?:^|\s)filter=/.test(trimmed)) return true;
		}
	}
	return false;
}

/**
 * Finds the repository that holds `cwd` and the settings the store borrows
 * from it. Reads the workspace; writes nothing.
 */
export async function probeWorkspace(cwd: string, deadline: number): Promise<ProbeResult> {
	const revParse = await workspaceGit(
		[
			"-C",
			cwd,
			"rev-parse",
			"--path-format=absolute",
			"--show-toplevel",
			"--git-path",
			"objects",
			"--git-path",
			"index",
			"--git-path",
			"info/exclude",
			"--git-path",
			"info/attributes",
		],
		{ cwd, deadline },
	);
	if (revParse.failure === "unavailable") return { kind: "none", reason: "git-unavailable", root: null };
	if (revParse.failure === "timeout") return { kind: "none", reason: "time-budget", root: null };
	if (revParse.code !== 0) return { kind: "none", reason: "not-a-repository", root: null };
	const [root, objectsDir, indexPath, infoExclude, infoAttributes] = revParse.stdout.toString("utf8").trimEnd().split("\n");
	if (!root || !objectsDir || !indexPath || !infoExclude || !infoAttributes) {
		return { kind: "none", reason: "not-a-repository", root: null };
	}

	const keys = [...COPIED_CORE_KEYS, "sparsecheckout", "splitindex", "excludesfile", "attributesfile"];
	const configResult = await workspaceGit(
		["-C", root, "config", "-z", "--get-regexp", `^core\\.(${keys.join("|")})$`],
		{ cwd: root, deadline },
	);
	if (configResult.failure === "timeout") return { kind: "none", reason: "time-budget", root };
	const config = new Map<string, string>();
	if (configResult.code === 0) {
		for (const record of splitNul(configResult.stdout)) {
			const newline = record.indexOf("\n");
			const key = (newline === -1 ? record : record.slice(0, newline)).toLowerCase();
			config.set(key, newline === -1 ? "true" : record.slice(newline + 1));
		}
	}
	const isTrue = (key: string) => /^(?:true|yes|on|1)$/i.test(config.get(key) ?? "");
	if (isTrue("core.sparsecheckout") || isTrue("core.splitindex")) {
		return { kind: "none", reason: "unsupported-repository", root };
	}

	const attributesFile = config.get("core.attributesfile");
	try {
		if (await attributesUseFilters({ root }, infoAttributes, attributesFile ? expandHome(attributesFile) : undefined, deadline)) {
			return { kind: "none", reason: "unsupported-repository", root };
		}
	} catch {
		return { kind: "none", reason: Date.now() >= deadline ? "time-budget" : "snapshot-failed", root };
	}

	const configArgs: string[] = [];
	for (const key of COPIED_CORE_KEYS) {
		const value = config.get(`core.${key}`);
		if (value !== undefined) configArgs.push("-c", `core.${key}=${value}`);
	}
	const configuredExcludes = config.get("core.excludesfile");
	const xdg = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
	const excludesFile = configuredExcludes ? expandHome(configuredExcludes) : join(xdg, "git", "ignore");
	// Point at an empty file when there is none, so the store never falls back to a default of its own.
	configArgs.push("-c", `core.excludesFile=${(await exists(excludesFile)) ? excludesFile : devNull}`);

	return {
		kind: "ok",
		probe: {
			root,
			objectsDir,
			indexPath,
			...((await exists(infoExclude)) ? { excludeFrom: infoExclude } : {}),
			configArgs,
		},
	};
}

interface StoreMeta {
	version: 1;
	root: string;
	sessionFile: string | null;
}

async function readMeta(dir: string): Promise<StoreMeta | undefined> {
	try {
		const value = JSON.parse(await readFile(join(dir, STORE_META_FILE), "utf8")) as Partial<StoreMeta>;
		if (value.version !== 1 || typeof value.root !== "string") return undefined;
		return { version: 1, root: value.root, sessionFile: typeof value.sessionFile === "string" ? value.sessionFile : null };
	} catch {
		return undefined;
	}
}

export async function readStoreMeta(dir: string): Promise<StoreMeta | undefined> {
	return readMeta(dir);
}

/**
 * Creates or updates the private store. Its configuration is its own, its
 * objects borrow the workspace repository's through `alternates`, and its
 * index starts as a copy of the workspace's index so Git's stat cache is warm.
 * The workspace's `.git` is only read.
 */
export async function ensureStore(
	agentDir: string,
	storeId: string,
	probe: WorkspaceProbe,
	sessionFile: string | null,
	deadline: number,
): Promise<StoreHandle> {
	const dir = storeDirectory(agentDir, storeId);
	if (!(await exists(join(dir, "HEAD")))) {
		await mkdir(join(agentDir, "file-history", storeId), { recursive: true, mode: 0o700 });
		const init = await runGit(["init", "--bare", "--quiet", "--template=", dir], { cwd: agentDir, deadline }, isolatedGitEnv());
		if (init.code !== 0) throw gitError(init, "Could not create the snapshot store");
		await chmod(dir, 0o700);
		for (const [key, value] of [
			["gc.auto", "0"],
			["core.fsmonitor", "false"],
			["core.untrackedCache", "false"],
			["core.logAllRefUpdates", "false"],
		] as const) {
			const result = await runGit(["--git-dir", dir, "config", key, value], { cwd: dir, deadline }, isolatedGitEnv());
			if (result.code !== 0) throw gitError(result, "Could not configure the snapshot store");
		}
	}

	const alternatesPath = join(dir, "objects", "info", "alternates");
	const alternates = `${probe.objectsDir}\n`;
	const currentAlternates = await readFile(alternatesPath, "utf8").catch(() => undefined);
	if (currentAlternates !== alternates) {
		await mkdir(join(dir, "objects", "info"), { recursive: true });
		await writeFile(alternatesPath, alternates, { mode: 0o600 });
	}

	const meta = await readMeta(dir);
	const indexPath = join(dir, "index");
	if (meta && resolve(meta.root) !== resolve(probe.root)) {
		// The stat cache describes another directory; start over from the new workspace's index.
		await rm(indexPath, { force: true });
	}
	if (!meta || meta.root !== probe.root || meta.sessionFile !== sessionFile) {
		const next: StoreMeta = { version: 1, root: probe.root, sessionFile };
		await writeFile(join(dir, STORE_META_FILE), `${JSON.stringify(next)}\n`, { mode: 0o600 });
	}
	if (!(await exists(indexPath)) && (await exists(probe.indexPath))) {
		await copyFile(probe.indexPath, indexPath);
		await chmod(indexPath, 0o600);
		// Keep the original time: Git re-reads entries not older than the index file
		// ("racily clean"), and a fresh time would make it trust their stat data.
		const source = await stat(probe.indexPath);
		await utimes(indexPath, source.atime, source.mtime);
		try {
			await clearIndexSuppressionFlags(dir, probe, deadline);
		} catch (error) {
			await rm(indexPath, { force: true });
			throw error;
		}
	}
	return { dir, storeId, probe };
}

/**
 * The copied index may mark entries skip-worktree or assume-unchanged, which
 * makes `ls-files -m` pass over edits to them. The store compares every file,
 * so those marks are cleared in its own copy.
 */
async function clearIndexSuppressionFlags(dir: string, probe: WorkspaceProbe, deadline: number): Promise<void> {
	const listed = await storeGit(dir, ["ls-files", "-z", "-v"], { workTree: probe, deadline, env: { GIT_OPTIONAL_LOCKS: "0" } });
	if (listed.code !== 0) throw gitError(listed, "ls-files failed");
	const records = splitNul(listed.stdout).filter((record) => record.length > 2);
	// `S`/`s`: skip-worktree; a lowercase tag: assume-unchanged. Git applies one mark per call.
	const skipWorktree = records.filter((record) => record[0] === "S" || record[0] === "s").map((record) => record.slice(2));
	const assumeUnchanged = records.filter((record) => /[a-z]/.test(record[0]!)).map((record) => record.slice(2));
	for (const [flag, paths] of [
		["--no-skip-worktree", skipWorktree],
		["--no-assume-unchanged", assumeUnchanged],
	] as const) {
		if (paths.length === 0) continue;
		const cleared = await storeGit(dir, ["update-index", "-z", flag, "--stdin"], { workTree: probe, deadline, input: nulList(paths) });
		if (cleared.code !== 0) throw gitError(cleared, "update-index failed");
	}
}

interface Classified {
	add: string[];
	remove: string[];
	forceRemove: string[];
	skipped: SkippedPath[];
}

async function mapLimited<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;
	async function worker(): Promise<void> {
		while (next < items.length) {
			const index = next++;
			results[index] = await fn(items[index]!);
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

async function classify(
	root: string,
	tracked: ReadonlySet<string>,
	untracked: readonly string[],
	limits: SnapshotLimits,
): Promise<Classified> {
	const result: Classified = { add: [], remove: [], forceRemove: [], skipped: [] };
	const candidates = [...tracked].map((path) => ({ path, tracked: true }));
	for (const path of untracked) if (!tracked.has(path)) candidates.push({ path, tracked: false });

	const facts = await mapLimited(candidates, 32, async (candidate) => {
		if (candidate.path.endsWith("/")) return { ...candidate, kind: "nested" as const, size: 0 };
		try {
			const info = await lstat(join(root, candidate.path));
			if (info.isSymbolicLink()) return { ...candidate, kind: "link" as const, size: info.size };
			if (info.isDirectory()) return { ...candidate, kind: "directory" as const, size: 0 };
			if (!info.isFile()) return { ...candidate, kind: "special" as const, size: 0 };
			const readable = await access(join(root, candidate.path), constants.R_OK).then(
				() => true,
				() => false,
			);
			return { ...candidate, kind: readable ? ("file" as const) : ("unreadable" as const), size: info.size };
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (code === "ENOENT" || code === "ENOTDIR") return { ...candidate, kind: "missing" as const, size: 0 };
			return { ...candidate, kind: "unreadable" as const, size: 0 };
		}
	});

	let storedBytes = 0;
	const skip = (path: string, isTracked: boolean, reason: SkipReason) => {
		result.skipped.push({ path: path.replace(/\/$/, ""), reason });
		// A tracked path keeps no stale content: it is left out of the tree and named instead.
		if (isTracked) result.forceRemove.push(path);
	};
	for (const fact of facts) {
		switch (fact.kind) {
			case "missing":
				result.remove.push(fact.path);
				break;
			case "directory":
				// A tracked file replaced by a directory: drop the file; the directory's files arrive as untracked.
				if (fact.tracked) result.forceRemove.push(fact.path);
				break;
			case "nested":
				skip(fact.path, false, "nested-repository");
				break;
			case "special":
				skip(fact.path, fact.tracked, "special-file");
				break;
			case "unreadable":
				skip(fact.path, fact.tracked, "unreadable");
				break;
			case "link":
				result.add.push(fact.path);
				break;
			case "file":
				if (fact.size > limits.maxFileBytes) {
					skip(fact.path, fact.tracked, "file-too-large");
				} else if (storedBytes + fact.size > limits.maxSnapshotBytes) {
					skip(fact.path, fact.tracked, "snapshot-too-large");
				} else {
					storedBytes += fact.size;
					result.add.push(fact.path);
				}
				break;
		}
	}
	return result;
}

function nulList(paths: readonly string[]): Buffer {
	return Buffer.from(paths.map((path) => `${path}\0`).join(""), "utf8");
}

function noSnapshot(reason: NoSnapshotReason, root: string | null, error?: unknown): SnapshotResult {
	return {
		startedAt: "",
		tree: null,
		reason,
		root,
		skipped: EMPTY_SKIPPED,
		...(error ? { error: error instanceof Error ? error.message : String(error) } : {}),
	};
}

function failureReason(result: GitResult): NoSnapshotReason {
	if (result.failure === "timeout") return "time-budget";
	if (result.failure === "unavailable") return "git-unavailable";
	return "snapshot-failed";
}

const SAFE_LABEL = /^[A-Za-z0-9._-]{1,200}$/;

export function snapshotRefName(label: string, now: Date): string {
	if (!SAFE_LABEL.test(label)) throw new Error("Invalid snapshot label");
	return `${SNAPSHOT_REF_PREFIX}${now.getTime()}/${label}`;
}

export interface TakeSnapshotOptions {
	agentDir: string;
	storeId: string;
	cwd: string;
	sessionFile: string | null;
	/** Names the ref that keeps the tree, for example `<entry id>-start`. */
	label: string;
	limits?: Partial<SnapshotLimits>;
	now?: Date;
}

/**
 * Records the working tree of the repository that holds `cwd` as one tree in
 * the private store. Only paths that differ from the store's index are read;
 * limits apply per path before anything is stored, and what is left out is
 * named. Never throws: a snapshot that cannot be taken returns `tree: null`
 * and a reason.
 */
export async function takeSnapshot(options: TakeSnapshotOptions): Promise<SnapshotResult> {
	const startedAt = new Date().toISOString();
	const result = await takeSnapshotInner(options);
	return { ...result, startedAt };
}

async function takeSnapshotInner(options: TakeSnapshotOptions): Promise<SnapshotResult> {
	const limits = { ...DEFAULT_SNAPSHOT_LIMITS, ...options.limits };
	const now = options.now ?? new Date();
	const deadline = Date.now() + limits.timeBudgetMs;
	let root: string | null = null;
	try {
		const probed = await probeWorkspace(options.cwd, deadline);
		if (probed.kind === "none") return noSnapshot(probed.reason, probed.root);
		root = probed.probe.root;
		const store = await ensureStore(options.agentDir, options.storeId, probed.probe, options.sessionFile, deadline);
		const written = await snapshotWorkTree(store, limits, deadline);
		if (written.tree === null) return written;

		const ref = snapshotRefName(options.label, now);
		const kept = await storeGit(store.dir, ["update-ref", ref, written.tree], { deadline });
		if (kept.code !== 0) return noSnapshot(failureReason(kept), root, gitError(kept, "update-ref failed"));
		return { ...written, ref };
	} catch (error) {
		return noSnapshot(Date.now() >= deadline ? "time-budget" : "snapshot-failed", root, error);
	}
}

/**
 * Brings the store's index (or `indexFile`, a private copy of it) in line
 * with the working tree and writes the tree. Returns `tree: null` with a
 * reason instead of throwing for Git failures.
 */
export async function snapshotWorkTree(
	store: StoreHandle,
	limits: SnapshotLimits,
	deadline: number,
	indexFile?: string,
): Promise<SnapshotResult> {
	const workTree = store.probe;
	const root = workTree.root;
	const indexEnv: Record<string, string> = indexFile ? { GIT_INDEX_FILE: indexFile } : {};
	const lockPath = indexFile ? `${indexFile}.lock` : join(store.dir, "index.lock");
	let indexWriteStarted = false;
	try {
		const excludeArgs = workTree.excludeFrom ? [`--exclude-from=${workTree.excludeFrom}`] : [];
		const readEnv = { ...indexEnv, GIT_OPTIONAL_LOCKS: "0" };
		const [changed, others] = await Promise.all([
			storeGit(store.dir, ["ls-files", "-z", "-m", "-d"], { workTree, deadline, env: readEnv }),
			storeGit(store.dir, ["ls-files", "-z", "-o", "--exclude-standard", ...excludeArgs], { workTree, deadline, env: readEnv }),
		]);
		if (changed.code !== 0) return noSnapshot(failureReason(changed), root, gitError(changed, "ls-files failed"));
		if (others.code !== 0) return noSnapshot(failureReason(others), root, gitError(others, "ls-files failed"));

		const classified = await classify(root, new Set(splitNul(changed.stdout)), splitNul(others.stdout), limits);
		if (Date.now() >= deadline) return noSnapshot("time-budget", root);

		if (classified.forceRemove.length > 0) {
			indexWriteStarted = true;
			const removed = await storeGit(store.dir, ["update-index", "-z", "--force-remove", "--stdin"], {
				workTree,
				deadline,
				env: indexEnv,
				input: nulList(classified.forceRemove),
			});
			if (removed.code !== 0) return noSnapshot(failureReason(removed), root, gitError(removed, "update-index failed"));
		}
		const updates = [...classified.add, ...classified.remove];
		if (updates.length > 0) {
			indexWriteStarted = true;
			const updated = await storeGit(store.dir, ["update-index", "-z", "--add", "--remove", "--replace", "--stdin"], {
				workTree,
				deadline,
				env: indexEnv,
				input: nulList(updates),
			});
			if (updated.code !== 0) return noSnapshot(failureReason(updated), root, gitError(updated, "update-index failed"));
		}

		const written = await storeGit(store.dir, ["write-tree"], { workTree, deadline, env: indexEnv });
		if (written.code !== 0) return noSnapshot(failureReason(written), root, gitError(written, "write-tree failed"));
		const tree = written.stdout.toString("utf8").trim();
		if (!GIT_OBJECT_ID.test(tree)) return noSnapshot("snapshot-failed", root, new Error("write-tree returned no object id"));

		const listed = classified.skipped.slice(0, limits.maxListedSkipped);
		return {
			startedAt: "",
			tree,
			reason: null,
			root,
			skipped: {
				count: classified.skipped.length,
				paths: listed,
				truncated: classified.skipped.length > listed.length,
			},
		};
	} finally {
		if (indexWriteStarted && Date.now() >= deadline) {
			// A Git process stopped by the budget leaves its lock behind; it was ours.
			await rm(lockPath, { force: true }).catch(() => {});
		}
	}
}

export interface NumstatEntry {
	path: string;
	oldPath?: string;
	/** null for a binary file. */
	additions: number | null;
	deletions: number | null;
}

export function parseNumstat(output: Buffer): NumstatEntry[] {
	const fields = splitNul(output);
	const entries: NumstatEntry[] = [];
	for (let index = 0; index < fields.length; index += 1) {
		const field = fields[index]!;
		const match = /^(-|\d+)\t(-|\d+)\t(.*)$/s.exec(field);
		if (!match) continue;
		const additions = match[1] === "-" ? null : Number(match[1]);
		const deletions = match[2] === "-" ? null : Number(match[2]);
		if (match[3] === "") {
			// A rename or copy: the old and new paths follow as separate fields.
			const oldPath = fields[index + 1];
			const path = fields[index + 2];
			index += 2;
			if (oldPath !== undefined && path !== undefined) entries.push({ path, oldPath, additions, deletions });
		} else {
			entries.push({ path: match[3]!, additions, deletions });
		}
	}
	return entries;
}

export function summarizeNumstat(entries: readonly NumstatEntry[]): TurnSnapshotStat {
	return entries.reduce<TurnSnapshotStat>(
		(total, entry) => ({
			files: total.files + 1,
			additions: total.additions + (entry.additions ?? 0),
			deletions: total.deletions + (entry.deletions ?? 0),
		}),
		{ files: 0, additions: 0, deletions: 0 },
	);
}

/** Files and line counts between two trees of one store, with rename detection. */
export async function diffTreeNumstat(
	dir: string,
	from: string,
	to: string,
	options: { timeoutMs?: number } = {},
): Promise<NumstatEntry[]> {
	if (!GIT_OBJECT_ID.test(from) || !GIT_OBJECT_ID.test(to)) throw new Error("Invalid tree id");
	const result = await storeGit(
		dir,
		["diff-tree", "-r", "-M", "-z", "--numstat", "--no-ext-diff", "--no-textconv", from, to],
		{ timeoutMs: options.timeoutMs ?? 10_000 },
	);
	if (result.code !== 0) throw gitError(result, "diff-tree failed");
	return parseNumstat(result.stdout);
}

/** A unique ref label for a snapshot outside the turn boundaries, such as an undo point. */
export function adHocLabel(prefix = "manual"): string {
	return `${prefix}-${randomUUID()}`;
}

export async function storeExists(agentDir: string, storeId: string): Promise<boolean> {
	try {
		return (await stat(join(storeDirectory(agentDir, storeId), "HEAD"))).isFile();
	} catch {
		return false;
	}
}
