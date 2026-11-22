import assert from "node:assert/strict";
import { chmod, lstat, mkdir, readFile, readlink, rm, stat, symlink, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
	compareTurn,
	compareWithWorkingTree,
	diffFiles,
	listTurns,
	pathsChangedSince,
	restorePaths,
	snapshotNow,
	windowEnd,
} from "../src/turn-snapshots/read.ts";
import { storeDirectory, takeSnapshot, type SnapshotLimits } from "../src/turn-snapshots/store.ts";
import { TURN_SNAPSHOT_VERSION, type TurnSnapshotRecord } from "../src/turn-snapshots/types.ts";
import { createFixture, git, type Fixture } from "./turn-snapshot-helpers.ts";

async function boundary(
	fixture: Fixture,
	userEntryId: string,
	phase: "start" | "end",
	limits: Partial<SnapshotLimits> = {},
): Promise<TurnSnapshotRecord> {
	const result = await takeSnapshot({
		agentDir: fixture.agentDir,
		storeId: "session-1",
		cwd: fixture.project,
		sessionFile: fixture.sessionFile,
		label: `${userEntryId}-${phase}`,
		limits,
	});
	return {
		version: TURN_SNAPSHOT_VERSION,
		userEntryId,
		phase,
		tree: result.tree,
		reason: result.reason,
		store: "session-1",
		root: result.root,
		cwd: fixture.project,
		timestamp: result.startedAt,
		skipped: result.skipped,
		...(phase === "end" ? { outcome: "completed" as const, stat: null } : {}),
	};
}

async function indexAndRefs(fixture: Fixture): Promise<string> {
	const dir = storeDirectory(fixture.agentDir, "session-1");
	const index = await readFile(join(dir, "index"));
	const refs = await git(fixture.project, "--git-dir", dir, "for-each-ref");
	return `${index.toString("base64")}\n${refs}`;
}

test("groups records into turns, including steered and unsettled windows", () => {
	const record = (userEntryId: string, phase: "start" | "end") =>
		({ userEntryId, phase }) as unknown as TurnSnapshotRecord;
	const turns = listTurns([record("m1", "start"), record("m1", "end"), record("m2", "start"), record("m3", "start"), record("m3", "end"), record("m4", "start")]);
	assert.deepEqual(
		turns.map((turn) => [turn.userEntryId, turn.end ? "settled" : turn.nextStart ? `until ${turn.nextStart.userEntryId}` : "open"]),
		[
			["m1", "settled"],
			["m2", "until m3"],
			["m3", "settled"],
			["m4", "open"],
		],
	);
	assert.equal(windowEnd(turns[1]!)?.userEntryId, "m3");
});

test("compares a turn, a file's diff and the files as they are now without touching the store's index", async () => {
	const fixture = await createFixture("read-compare");
	const start = await boundary(fixture, "m1", "start");
	await writeFile(join(fixture.project, "a.txt"), "one\nTWO\nthree\n");
	await writeFile(join(fixture.project, "new.txt"), "new\n");
	const end = await boundary(fixture, "m1", "end");

	const [turn] = listTurns([start, end]);
	const comparison = await compareTurn(fixture.agentDir, turn!);
	assert.deepEqual(
		comparison.files.map((file) => [file.path, file.status, file.additions, file.deletions]),
		[
			["a.txt", "modified", 1, 1],
			["new.txt", "added", 1, 0],
		],
	);
	const limited = await compareTurn(fixture.agentDir, turn!, { maxFiles: 1 });
	assert.equal(limited.files.length, 1);
	assert.equal(limited.truncated, true);

	const diff = await diffFiles(fixture.agentDir, "session-1", start.tree!, end.tree!, ["a.txt"]);
	assert.match(diff.patch, /^-two$/m);
	assert.match(diff.patch, /^\+TWO$/m);
	assert.doesNotMatch(diff.patch, /new\.txt/);

	await writeFile(join(fixture.project, "later.txt"), "between turns\n");
	await unlink(join(fixture.project, "keep.txt"));
	const before = await indexAndRefs(fixture);
	const now = await compareWithWorkingTree(fixture.agentDir, start);
	assert.equal(await indexAndRefs(fixture), before, "the store's index and refs are unchanged");
	assert.deepEqual(
		now.files.map((file) => [file.path, file.status]).sort(),
		[
			["a.txt", "modified"],
			["keep.txt", "deleted"],
			["later.txt", "added"],
			["new.txt", "added"],
		],
	);
});

test("collects the paths changed in agent windows since a message, leaving between-turn changes out", async () => {
	const fixture = await createFixture("read-since");
	const m1Start = await boundary(fixture, "m1", "start");
	await writeFile(join(fixture.project, "a.txt"), "agent turn one\n");
	const m1End = await boundary(fixture, "m1", "end");
	await writeFile(join(fixture.project, "keep.txt"), "the person, between turns\n");
	const m2Start = await boundary(fixture, "m2", "start");
	await writeFile(join(fixture.project, "steered.txt"), "before steering\n");
	const m3Start = await boundary(fixture, "m3", "start");
	await writeFile(join(fixture.project, "after.txt"), "after steering\n");
	const m3End = await boundary(fixture, "m3", "end");

	const records = [m1Start, m1End, m2Start, m3Start, m3End];
	assert.deepEqual(await pathsChangedSince(fixture.agentDir, records, "m1"), {
		paths: ["a.txt", "after.txt", "steered.txt"],
		incomplete: false,
	});
	assert.deepEqual((await pathsChangedSince(fixture.agentDir, records, "m3")).paths, ["after.txt"]);

	const missing = { ...m2Start, tree: null, reason: "time-budget" as const, root: null };
	assert.equal((await pathsChangedSince(fixture.agentDir, [m1Start, m1End, missing, m3Start, m3End], "m1")).incomplete, true);
});

test("restores contents, modes, links, deletions and creations from a tree", async () => {
	const fixture = await createFixture("read-restore");
	const { project } = fixture;
	await writeFile(join(project, "run.sh"), "#!/bin/sh\necho hi\n");
	await chmod(join(project, "run.sh"), 0o755);
	await symlink("a.txt", join(project, "link"));
	const start = await boundary(fixture, "m1", "start");

	await writeFile(join(project, "a.txt"), "changed by a script\n");
	await unlink(join(project, "keep.txt"));
	await chmod(join(project, "run.sh"), 0o644);
	await unlink(join(project, "link"));
	await symlink("keep.txt", join(project, "link"));
	await mkdir(join(project, "gen"));
	await writeFile(join(project, "gen", "output.txt"), "generated\n");
	const end = await boundary(fixture, "m1", "end");

	const { paths } = await pathsChangedSince(fixture.agentDir, [start, end], "m1");
	const result = await restorePaths(fixture.agentDir, start, paths);
	assert.deepEqual(result.errors, []);
	assert.equal(result.changedFiles.length, 5);
	assert.equal(await readFile(join(project, "a.txt"), "utf8"), "one\ntwo\nthree\n");
	assert.equal(await readFile(join(project, "keep.txt"), "utf8"), "unchanged\n");
	assert.equal((await stat(join(project, "run.sh"))).mode & 0o111, 0o111);
	assert.equal(await readlink(join(project, "link")), "a.txt");
	await assert.rejects(lstat(join(project, "gen", "output.txt")));

	const again = await restorePaths(fixture.agentDir, start, paths);
	assert.deepEqual(again, { changedFiles: [], errors: [] }, "matching files are left untouched");
	const after = await boundary(fixture, "m2", "start");
	assert.equal(after.tree, start.tree, "a restore followed by a snapshot gives the target tree");
});

test("refuses paths outside the root, inside .git, through symlinked directories, or skipped by the snapshot", async () => {
	const fixture = await createFixture("read-refuse");
	const { project } = fixture;
	await writeFile(join(project, "huge.bin"), "z".repeat(4096));
	const start = await boundary(fixture, "m1", "start", { maxFileBytes: 1024 });
	assert.equal(start.skipped.paths[0]?.path, "huge.bin");

	const outside = join(fixture.root, "outside");
	await mkdir(outside);
	await rm(join(project, "src"), { recursive: true });
	await symlink(outside, join(project, "src"));

	const result = await restorePaths(fixture.agentDir, start, ["../escape.txt", ".git/config", "src/move-me.txt", "huge.bin"]);
	assert.deepEqual(result.changedFiles, []);
	assert.deepEqual(
		result.errors.map((error) => error.error),
		[
			"Not a restorable path",
			"Not a restorable path",
			"The snapshot did not record this path",
			`${join(project, "src")} is a symbolic link`,
		],
	);
	await assert.rejects(stat(join(outside, "move-me.txt")), "nothing is written through the link");
	assert.equal((await stat(join(project, "huge.bin"))).size, 4096, "a skipped file is not removed");
});

test("takes a snapshot on demand under its own ref", async () => {
	const fixture = await createFixture("read-now");
	const result = await snapshotNow({
		agentDir: fixture.agentDir,
		storeId: "session-1",
		cwd: fixture.project,
		sessionFile: fixture.sessionFile,
		labelPrefix: "undo",
	});
	assert.ok(result.tree);
	assert.match(result.ref ?? "", /^refs\/snapshots\/\d+\/undo-[0-9a-f-]{36}$/);
});

test("does not remove a file that was ignored when the snapshot was taken", async () => {
	const fixture = await createFixture("read-ignored");
	const { project } = fixture;
	await writeFile(join(project, ".gitignore"), "ignored/\nlocal.env\n");
	await writeFile(join(project, "local.env"), "SECRET=kept\n");
	const start = await boundary(fixture, "m1", "start");
	// The run stops ignoring the file, so it appears in the end snapshot as if it were new.
	await writeFile(join(project, ".gitignore"), "ignored/\n");
	const end = await boundary(fixture, "m1", "end");

	const { paths } = await pathsChangedSince(fixture.agentDir, [start, end], "m1");
	assert.deepEqual(paths, [".gitignore", "local.env"]);
	const result = await restorePaths(fixture.agentDir, start, paths);
	assert.deepEqual(result.errors.map((error) => error.error), ["Ignore rules changed since the snapshot; not removed"]);
	assert.equal(await readFile(join(project, "local.env"), "utf8"), "SECRET=kept\n");
	assert.equal(await readFile(join(project, ".gitignore"), "utf8"), "ignored/\nlocal.env\n");
});

test("restores files with checkout conversions byte for byte", async () => {
	const fixture = await createFixture("read-eol");
	const { project } = fixture;
	await writeFile(join(project, ".gitattributes"), "*.bat text eol=crlf\n");
	await writeFile(join(project, "run.bat"), "echo one\r\necho two\r\n");
	const start = await boundary(fixture, "m1", "start");
	await writeFile(join(project, "run.bat"), "echo changed\r\n");
	const end = await boundary(fixture, "m1", "end");
	const result = await restorePaths(fixture.agentDir, start, ["run.bat"]);
	assert.deepEqual(result.errors, []);
	assert.equal(await readFile(join(project, "run.bat"), "utf8"), "echo one\r\necho two\r\n");
	assert.notEqual(end.tree, start.tree);
	const again = await restorePaths(fixture.agentDir, start, ["run.bat"]);
	assert.deepEqual(again.changedFiles, [], "an identical converted file is left untouched");
});

test("brings back a file that the run replaced by a directory", async () => {
	const fixture = await createFixture("read-file-dir");
	const { project } = fixture;
	const start = await boundary(fixture, "m1", "start");
	await unlink(join(project, "keep.txt"));
	await mkdir(join(project, "keep.txt"));
	await writeFile(join(project, "keep.txt", "child.txt"), "inside\n");
	const end = await boundary(fixture, "m1", "end");
	const { paths } = await pathsChangedSince(fixture.agentDir, [start, end], "m1");
	const result = await restorePaths(fixture.agentDir, start, paths);
	assert.deepEqual(result.errors, []);
	assert.equal(await readFile(join(project, "keep.txt"), "utf8"), "unchanged\n");
});

test("does not remove an older file even when the ignore rules changed back, or a self-ignoring .gitignore hid it", async () => {
	const fixture = await createFixture("read-ignored-later");
	const { project } = fixture;
	await writeFile(join(project, ".gitignore"), "ignored/\nsecrets.env\n");
	await writeFile(join(project, "secrets.env"), "USER DATA\n");
	await mkdir(join(project, "data"));
	await writeFile(join(project, "data", ".gitignore"), "*\n");
	await writeFile(join(project, "data", "keep.csv"), "1,2\n");
	await new Promise((resolve) => setTimeout(resolve, 20));
	const m1Start = await boundary(fixture, "m1", "start");
	await writeFile(join(project, ".gitignore"), "ignored/\n");
	await unlink(join(project, "data", ".gitignore"));
	const m1End = await boundary(fixture, "m1", "end");
	const m2Start = await boundary(fixture, "m2", "start");
	await writeFile(join(project, ".gitignore"), "ignored/\nsecrets.env\n");
	const m2End = await boundary(fixture, "m2", "end");

	const { paths } = await pathsChangedSince(fixture.agentDir, [m1Start, m1End, m2Start, m2End], "m1");
	assert.deepEqual(paths, [".gitignore", "data/keep.csv", "secrets.env"]);
	const result = await restorePaths(fixture.agentDir, m1Start, paths);
	assert.deepEqual(result.changedFiles, [], ".gitignore already has its earlier content");
	assert.deepEqual(result.errors.map((error) => error.error), [
		"The file is older than the snapshot; not removed",
		"The file is older than the snapshot; not removed",
	]);
	assert.equal(await readFile(join(project, "secrets.env"), "utf8"), "USER DATA\n");
	assert.equal(await readFile(join(project, "data", "keep.csv"), "utf8"), "1,2\n");
});
