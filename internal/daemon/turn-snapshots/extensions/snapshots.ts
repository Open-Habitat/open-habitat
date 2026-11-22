// Turn-snapshot recorder. Records the working tree at the start and the
// settle of every run into the conversation's private Git store and writes a
// `turn-snapshot` session entry per boundary. It has no UI: `/rewind`, or a
// host with its own UI, reads the entries through `better-pi-rewind/snapshots`.
import { getAgentDir, type ExtensionAPI, type ExtensionContext, type SessionEntry } from "@earendil-works/pi-coding-agent";
import { captureGitCheckpoint } from "../src/git-history.ts";
import { registerRunSettledHandler } from "../src/host-adapter.ts";
import { registerStoreReferrer, sweepSnapshotStores } from "../src/turn-snapshots/retention.ts";
import {
	diffTreeNumstat,
	storeDirectory,
	summarizeNumstat,
	takeSnapshot,
	type SnapshotLimits,
} from "../src/turn-snapshots/store.ts";
import {
	TURN_SNAPSHOT_ENTRY_TYPE,
	TURN_SNAPSHOT_VERSION,
	isSafeStoreId,
	turnSnapshotsFromEntries,
	type TurnOutcome,
	type TurnSnapshotPhase,
	type TurnSnapshotRecord,
	type TurnSnapshotStat,
} from "../src/turn-snapshots/types.ts";

/**
 * One recorder per process. A person may install this package while a host
 * also loads its own copy; both instances share `globalThis`, the first to
 * start a session records and any other stays passive.
 */
const RECORDER_SLOT = Symbol.for("turn-snapshot.recorder");

function claimSlot(token: object): boolean {
	const scope = globalThis as unknown as Record<symbol, object | undefined>;
	const holder = scope[RECORDER_SLOT];
	if (holder !== undefined && holder !== token) return false;
	scope[RECORDER_SLOT] = token;
	return true;
}

function releaseSlot(token: object): void {
	const scope = globalThis as unknown as Record<symbol, object | undefined>;
	if (scope[RECORDER_SLOT] === token) delete scope[RECORDER_SLOT];
}

interface OpenTurn {
	userEntryId: string;
	tree: string | null;
	store: string;
}

interface RecorderState {
	storeId: string;
	sessionFile: string | null;
	pendingUserMessage: boolean;
	lastStopReason?: string;
	open?: OpenTurn;
}

export interface RecorderOptions {
	limits?: Partial<SnapshotLimits>;
	retentionMs?: number;
}

function latestUserEntry(entries: readonly SessionEntry[]): SessionEntry | undefined {
	for (let index = entries.length - 1; index >= 0; index -= 1) {
		const entry = entries[index]!;
		if (entry.type === "message" && entry.message.role === "user") return entry;
	}
	return undefined;
}

function refLabel(userEntryId: string, phase: TurnSnapshotPhase): string {
	const safe = userEntryId.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "entry";
	return `${safe}-${phase}`;
}

function outcomeOf(stopReason: string | undefined): TurnOutcome {
	if (stopReason === "aborted") return "aborted";
	if (stopReason === "error") return "error";
	return "completed";
}

export function createSnapshotRecorder(options: RecorderOptions = {}) {
	return function snapshotRecorder(pi: ExtensionAPI): void {
		const agentDir = getAgentDir();
		const token = {};
		let active = false;
		let state: RecorderState | undefined;
		let queue: Promise<unknown> = Promise.resolve();
		let lastBoundary: Promise<unknown> = Promise.resolve();

		// Boundaries and the sweep run one at a time, in event order.
		function enqueue<T>(task: () => Promise<T>): Promise<T> {
			const next = queue.then(task, task);
			queue = next.catch(() => {});
			return next;
		}

		function currentState(ctx: ExtensionContext): RecorderState | undefined {
			const storeId = ctx.sessionManager.getSessionId();
			if (!isSafeStoreId(storeId)) return undefined;
			if (!state || state.storeId !== storeId) {
				state = { storeId, sessionFile: ctx.sessionManager.getSessionFile() ?? null, pendingUserMessage: false };
			}
			return state;
		}

		async function record(
			ctx: ExtensionContext,
			current: RecorderState,
			userEntryId: string,
			phase: TurnSnapshotPhase,
			extra: (tree: string | null) => Promise<Partial<TurnSnapshotRecord>>,
		): Promise<TurnSnapshotRecord> {
			const [snapshot, git] = await Promise.all([
				takeSnapshot({
					agentDir,
					storeId: current.storeId,
					cwd: ctx.cwd,
					sessionFile: current.sessionFile,
					label: refLabel(userEntryId, phase),
					...(options.limits ? { limits: options.limits } : {}),
				}),
				captureGitCheckpoint(ctx.cwd).catch(() => undefined),
			]);
			const entry: TurnSnapshotRecord = {
				version: TURN_SNAPSHOT_VERSION,
				userEntryId,
				phase,
				tree: snapshot.tree,
				reason: snapshot.reason,
				store: current.storeId,
				root: snapshot.root,
				cwd: ctx.cwd,
				timestamp: snapshot.startedAt,
				...(git ? { git: { head: git.head, branch: git.branch } } : {}),
				skipped: snapshot.skipped,
				...(await extra(snapshot.tree)),
			};
			pi.appendEntry(TURN_SNAPSHOT_ENTRY_TYPE, entry);
			return entry;
		}

		async function turnStat(store: string, from: string | null, to: string | null): Promise<TurnSnapshotStat | null> {
			if (!from || !to) return null;
			try {
				return summarizeNumstat(await diffTreeNumstat(storeDirectory(agentDir, store), from, to));
			} catch {
				return null;
			}
		}

		function beginSession(ctx: ExtensionContext): void {
			state = undefined;
			const current = currentState(ctx);
			if (!current?.sessionFile) return;
			// A fork carries its parent's entries; mark the stores they name as still in use.
			const sessionFile = current.sessionFile;
			const inherited = new Set(
				turnSnapshotsFromEntries(ctx.sessionManager.getEntries())
					.map((record) => record.store)
					.filter((store) => store !== current.storeId),
			);
			void enqueue(async () => {
				for (const store of inherited) await registerStoreReferrer(agentDir, store, current.storeId, sessionFile);
			}).catch(() => {});
			// Sweeping old stores is not on the person's path; the first boundary waits behind it
			// in the queue, so the sweep never collects this session's store mid-write.
			void enqueue(() =>
				sweepSnapshotStores(agentDir, {
					activeStoreId: current.storeId,
					...(options.retentionMs !== undefined ? { retentionMs: options.retentionMs } : {}),
				}),
			).catch(() => {});
		}

		pi.on("session_start", async (_event, ctx) => {
			active = claimSlot(token);
			if (active) beginSession(ctx);
		});

		// OMP switches sessions in place (fork, new, resume) and reports it as `session_switch`.
		(pi as unknown as { on(event: string, handler: (event: unknown, ctx: ExtensionContext) => Promise<void>): void }).on(
			"session_switch",
			async (_event, ctx) => {
				if (active) beginSession(ctx);
			},
		);

		pi.on("message_end", async (event, ctx) => {
			if (!active) return;
			const current = currentState(ctx);
			if (!current) return;
			if (event.message.role === "user") current.pendingUserMessage = true;
			else if (event.message.role === "assistant") current.lastStopReason = event.message.stopReason;
		});

		pi.on("message_start", async (event, ctx) => {
			if (!active || event.message.role !== "assistant") return;
			const current = currentState(ctx);
			if (!current?.pendingUserMessage) return;
			current.pendingUserMessage = false;
			// Without a session file nothing would keep the entries, and no sweep could find the store.
			if (!current.sessionFile) return;
			const entry = latestUserEntry(ctx.sessionManager.getBranch());
			if (!entry || current.open?.userEntryId === entry.id) return;
			await (lastBoundary = enqueue(async () => {
				const recorded = await record(ctx, current, entry.id, "start", async () => ({}));
				// A start while another run is open (a steering message, or a host that never settled)
				// closes that window; readers see it as start → start.
				current.open = { userEntryId: entry.id, tree: recorded.tree, store: recorded.store };
				current.lastStopReason = undefined;
			}).catch(() => {}));
		});

		registerRunSettledHandler(pi, async (ctx) => {
			if (!active) return;
			const current = currentState(ctx);
			const open = current?.open;
			if (!current || !open) return;
			current.open = undefined;
			await (lastBoundary = enqueue(() =>
				record(ctx, current, open.userEntryId, "end", async (tree) => ({
					outcome: outcomeOf(current.lastStopReason),
					stat: open.store === current.storeId ? await turnStat(open.store, open.tree, tree) : null,
				})),
			).catch(() => {}));
		});

		pi.on("session_shutdown", async () => {
			// Let a boundary in flight append its entry; the daily sweep is not waited for.
			await lastBoundary;
			releaseSlot(token);
			active = false;
			state = undefined;
		});
	};
}

export default createSnapshotRecorder();
