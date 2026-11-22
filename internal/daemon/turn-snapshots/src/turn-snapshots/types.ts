import { isAbsolute } from "node:path";

/**
 * The session custom entry type. The name says what is recorded and nothing
 * about which UI reads it, so another package can own the recorder later
 * without a format change.
 */
export const TURN_SNAPSHOT_ENTRY_TYPE = "turn-snapshot";
export const TURN_SNAPSHOT_VERSION = 1;

export type TurnSnapshotPhase = "start" | "end";
export type TurnOutcome = "completed" | "aborted" | "error";

/** Why a boundary has no tree. A reader falls back instead of guessing. */
export type NoSnapshotReason =
	| "git-unavailable"
	| "not-a-repository"
	| "unsupported-repository"
	| "time-budget"
	| "snapshot-failed";

/** Why a single path was left out of an otherwise complete tree. */
export type SkipReason =
	| "file-too-large"
	| "snapshot-too-large"
	| "unreadable"
	| "nested-repository"
	| "special-file";

export interface SkippedPath {
	/** Path relative to `root`, with forward slashes. */
	path: string;
	reason: SkipReason;
}

export interface SkippedSummary {
	count: number;
	/** The first skipped paths; `truncated` says whether more exist. */
	paths: SkippedPath[];
	truncated: boolean;
}

export interface TurnSnapshotGit {
	head: string;
	branch: string | null;
}

export interface TurnSnapshotStat {
	files: number;
	additions: number;
	deletions: number;
}

export interface TurnSnapshotRecord {
	version: typeof TURN_SNAPSHOT_VERSION;
	/** The user message whose run this boundary belongs to. */
	userEntryId: string;
	phase: TurnSnapshotPhase;
	/** Tree object id in the store, or null when no snapshot was taken. */
	tree: string | null;
	/** Set exactly when `tree` is null. */
	reason: NoSnapshotReason | null;
	/** Session id that owns the store holding `tree`. A forked session keeps its parent's. */
	store: string;
	/** The directory the tree describes: the repository top level. */
	root: string | null;
	cwd: string;
	/** When the snapshot began. A file older than this existed at the boundary. */
	timestamp: string;
	git?: TurnSnapshotGit;
	skipped: SkippedSummary;
	/** End entries only. */
	outcome?: TurnOutcome;
	/** End entries only: this run's own start → end comparison, with rename detection. */
	stat?: TurnSnapshotStat | null;
}

const SAFE_ID = /^[A-Za-z0-9._@-]+$/;
const SKIP_REASONS = new Set<string>([
	"file-too-large",
	"snapshot-too-large",
	"unreadable",
	"nested-repository",
	"special-file",
]);
const NO_SNAPSHOT_REASONS = new Set<string>([
	"git-unavailable",
	"not-a-repository",
	"unsupported-repository",
	"time-budget",
	"snapshot-failed",
]);

export function isSafeStoreId(value: unknown): value is string {
	return typeof value === "string" && value !== "." && value !== ".." && SAFE_ID.test(value);
}

function isCount(value: unknown): value is number {
	return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isSkipped(value: unknown): value is SkippedSummary {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Partial<SkippedSummary>;
	return (
		isCount(candidate.count) &&
		typeof candidate.truncated === "boolean" &&
		Array.isArray(candidate.paths) &&
		candidate.paths.every(
			(item) =>
				typeof item === "object" &&
				item !== null &&
				typeof (item as SkippedPath).path === "string" &&
				SKIP_REASONS.has((item as SkippedPath).reason),
		)
	);
}

function isStat(value: unknown): value is TurnSnapshotStat {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Partial<TurnSnapshotStat>;
	return isCount(candidate.files) && isCount(candidate.additions) && isCount(candidate.deletions);
}

export function isTurnSnapshotRecord(value: unknown): value is TurnSnapshotRecord {
	if (typeof value !== "object" || value === null) return false;
	const c = value as Partial<TurnSnapshotRecord>;
	if (c.version !== TURN_SNAPSHOT_VERSION) return false;
	if (typeof c.userEntryId !== "string" || c.userEntryId.length === 0) return false;
	if (c.phase !== "start" && c.phase !== "end") return false;
	if (c.tree === null) {
		if (typeof c.reason !== "string" || !NO_SNAPSHOT_REASONS.has(c.reason)) return false;
	} else if (typeof c.tree !== "string" || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(c.tree) || c.reason !== null) {
		return false;
	}
	if (!isSafeStoreId(c.store)) return false;
	if (c.root !== null && (typeof c.root !== "string" || !isAbsolute(c.root))) return false;
	if (c.tree !== null && c.root === null) return false;
	if (typeof c.cwd !== "string" || typeof c.timestamp !== "string") return false;
	if (!isSkipped(c.skipped)) return false;
	if (c.git !== undefined) {
		if (typeof c.git !== "object" || c.git === null) return false;
		if (typeof c.git.head !== "string" || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(c.git.head)) return false;
		if (c.git.branch !== null && (typeof c.git.branch !== "string" || !c.git.branch.startsWith("refs/"))) return false;
	}
	if (c.phase === "end") {
		if (c.outcome !== "completed" && c.outcome !== "aborted" && c.outcome !== "error") return false;
		if (c.stat !== undefined && c.stat !== null && !isStat(c.stat)) return false;
	} else if (c.outcome !== undefined || c.stat !== undefined) {
		return false;
	}
	return true;
}

interface EntryLike {
	type: string;
	customType?: string;
	data?: unknown;
}

/** Valid turn-snapshot records in entry order; malformed entries are ignored. */
export function turnSnapshotsFromEntries(entries: readonly EntryLike[]): TurnSnapshotRecord[] {
	const records: TurnSnapshotRecord[] = [];
	for (const entry of entries) {
		if (entry.type !== "custom" || entry.customType !== TURN_SNAPSHOT_ENTRY_TYPE) continue;
		if (isTurnSnapshotRecord(entry.data)) records.push(entry.data);
	}
	return records;
}
