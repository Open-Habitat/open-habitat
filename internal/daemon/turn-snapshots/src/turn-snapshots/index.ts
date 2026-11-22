// Public read, compare, snapshot-now and restore functions for turn
// snapshots, exported as `better-pi-rewind/snapshots`. A host with its own UI
// can load the recorder extension alone and use these against the same
// session entries and store.
export {
	TURN_SNAPSHOT_ENTRY_TYPE,
	TURN_SNAPSHOT_VERSION,
	isTurnSnapshotRecord,
	turnSnapshotsFromEntries,
	type NoSnapshotReason,
	type SkipReason,
	type SkippedPath,
	type SkippedSummary,
	type TurnOutcome,
	type TurnSnapshotGit,
	type TurnSnapshotPhase,
	type TurnSnapshotRecord,
	type TurnSnapshotStat,
} from "./types.ts";
export {
	compareTrees,
	compareTurn,
	compareWithWorkingTree,
	diffFiles,
	isSettled,
	listTurns,
	pathsChangedSince,
	restorePaths,
	snapshotNow,
	windowEnd,
	type ChangeStatus,
	type ChangedFile,
	type Comparison,
	type RestoreResult,
	type SnapshotNowOptions,
	type Turn,
} from "./read.ts";
export { DEFAULT_SNAPSHOT_LIMITS, storeDirectory, type SnapshotLimits, type SnapshotResult } from "./store.ts";
export { DEFAULT_RETENTION_MS, sweepSnapshotStores, type SweepOptions, type SweepResult } from "./retention.ts";
