import { access, mkdir, readdir, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gitError } from "./git.ts";
import { SNAPSHOT_REF_PREFIX, STORE_META_FILE, readStoreMeta, storeDirectory, storeGit } from "./store.ts";
import { isSafeStoreId } from "./types.ts";

export const DEFAULT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SWEEP_MARKER = ".turn-snapshot-sweep";

export interface SweepOptions {
	/** Snapshots older than this are dropped. */
	retentionMs?: number;
	/** The caller's own store: never removed whole. The caller sweeps while it is not recording into it. */
	activeStoreId?: string;
	now?: Date;
	/** Ignore the once-a-day marker. */
	force?: boolean;
}

export interface SweepResult {
	ran: boolean;
	removedStores: string[];
	droppedRefs: number;
	errors: Array<{ store: string; error: string }>;
}

function exists(path: string): Promise<boolean> {
	return access(path).then(
		() => true,
		() => false,
	);
}

const BUSY_WINDOW_MS = 60 * 60 * 1000;

async function recentlyWritten(path: string, now: Date): Promise<boolean> {
	try {
		return now.getTime() - (await stat(path)).mtimeMs < BUSY_WINDOW_MS;
	} catch {
		return false;
	}
}

async function storeRecentlyActive(dir: string, now: Date): Promise<boolean> {
	for (const path of [join(dir, "index"), join(dir, "refs", "snapshots"), join(dir, "packed-refs")]) {
		if (await recentlyWritten(path, now)) return true;
	}
	return false;
}

const REFERRERS_DIR = "referrers";

async function hasLiveReferrer(dir: string): Promise<boolean> {
	const referrersDir = join(dir, REFERRERS_DIR);
	const names = await readdir(referrersDir).catch(() => [] as string[]);
	let live = false;
	for (const name of names) {
		if (!isSafeStoreId(name)) continue;
		const sessionFile = (await readFile(join(referrersDir, name), "utf8").catch(() => "")).trim();
		if (sessionFile && (await exists(sessionFile))) live = true;
		else await rm(join(referrersDir, name), { force: true });
	}
	return live;
}

/**
 * Records that the session `referrerId` (a fork) carries entries whose
 * trees live in `storeId`, so the sweep keeps that store while the fork's
 * session file exists, even after the owning conversation is deleted.
 */
export async function registerStoreReferrer(
	agentDir: string,
	storeId: string,
	referrerId: string,
	referrerSessionFile: string,
): Promise<void> {
	if (!isSafeStoreId(referrerId) || storeId === referrerId) return;
	const dir = storeDirectory(agentDir, storeId);
	if (!(await readStoreMeta(dir))) return;
	const referrersDir = join(dir, REFERRERS_DIR);
	await mkdir(referrersDir, { recursive: true, mode: 0o700 });
	const path = join(referrersDir, referrerId);
	const current = await readFile(path, "utf8").catch(() => undefined);
	if (current?.trim() !== referrerSessionFile) await writeFile(path, `${referrerSessionFile}\n`, { mode: 0o600 });
}

async function dueForSweep(markerPath: string, now: Date): Promise<boolean> {
	try {
		const info = await stat(markerPath);
		return now.getTime() - info.mtimeMs >= SWEEP_INTERVAL_MS;
	} catch {
		return true;
	}
}

/**
 * Keeps snapshot stores bounded. A store whose session file is gone is
 * removed (the conversation was deleted); snapshots older than the retention
 * period lose their refs and the store is garbage-collected, or removed when
 * nothing is left in it. Runs at most once a day unless forced. Only
 * directories carrying the recorder's own metadata are touched, and only
 * their `tree.git`; per-file backups beside them are left alone.
 */
export async function sweepSnapshotStores(agentDir: string, options: SweepOptions = {}): Promise<SweepResult> {
	const now = options.now ?? new Date();
	const retentionMs = options.retentionMs ?? DEFAULT_RETENTION_MS;
	const historyDir = join(agentDir, "file-history");
	const markerPath = join(historyDir, SWEEP_MARKER);
	const result: SweepResult = { ran: false, removedStores: [], droppedRefs: 0, errors: [] };
	if (!(await exists(historyDir))) return result;
	if (!options.force && !(await dueForSweep(markerPath, now))) return result;
	// Claim the day first, so a failing store does not make every session start retry the sweep.
	await writeFile(markerPath, "", { mode: 0o600 });
	await utimes(markerPath, now, now);
	result.ran = true;

	const names = await readdir(historyDir).catch(() => [] as string[]);
	for (const storeId of names) {
		if (!isSafeStoreId(storeId)) continue;
		const dir = storeDirectory(agentDir, storeId);
		const meta = await readStoreMeta(dir);
		if (!meta) continue;
		const active = storeId === options.activeStoreId;
		try {
			// A host may create the session file only after the first reply, so a young store is left alone.
			// A fork's entries keep naming its parent's store, so the store stays while a fork lives.
			if (
				!active &&
				meta.sessionFile !== null &&
				!(await exists(meta.sessionFile)) &&
				!(await recentlyWritten(join(dir, STORE_META_FILE), now)) &&
				!(await hasLiveReferrer(dir))
			) {
				await rm(dir, { recursive: true, force: true });
				result.removedStores.push(storeId);
				continue;
			}

			const listed = await storeGit(dir, ["for-each-ref", "--format=%(refname)", SNAPSHOT_REF_PREFIX], { timeoutMs: 30_000 });
			if (listed.code !== 0) throw gitError(listed, "for-each-ref failed");
			const refs = listed.stdout.toString("utf8").split("\n").map((line) => line.trim()).filter(Boolean);
			const cutoff = now.getTime() - retentionMs;
			const expired = refs.filter((ref) => {
				const stamp = Number(ref.slice(SNAPSHOT_REF_PREFIX.length).split("/", 1)[0]);
				return Number.isSafeInteger(stamp) && stamp < cutoff;
			});
			if (expired.length === 0) continue;

			// Another process may be recording into a resumed old session right now; its new ref
			// would not be in this listing. A store touched within the hour is only pruned.
			if (!active && expired.length === refs.length && !(await storeRecentlyActive(dir, now))) {
				await rm(dir, { recursive: true, force: true });
				result.removedStores.push(storeId);
				result.droppedRefs += expired.length;
				continue;
			}
			const deleted = await storeGit(dir, ["update-ref", "--stdin", "-z"], {
				timeoutMs: 30_000,
				input: Buffer.from(expired.map((ref) => `delete ${ref}\0\0`).join(""), "utf8"),
			});
			if (deleted.code !== 0) throw gitError(deleted, "update-ref failed");
			result.droppedRefs += expired.length;
			if (!active && (await recentlyWritten(join(dir, "index"), now))) {
				// A recorder may be between writing objects and naming them; collect on a later day.
				continue;
			}
			const collected = await storeGit(dir, ["gc", "--quiet", "--prune=now"], { timeoutMs: 120_000 });
			if (collected.code !== 0) throw gitError(collected, "gc failed");
		} catch (error) {
			result.errors.push({ store: storeId, error: error instanceof Error ? error.message : String(error) });
		}
	}
	return result;
}
