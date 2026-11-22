import assert from "node:assert/strict";
import { mkdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { registerStoreReferrer, sweepSnapshotStores } from "../src/turn-snapshots/retention.ts";
import { storeDirectory, takeSnapshot } from "../src/turn-snapshots/store.ts";
import { createFixture, git, type Fixture } from "./turn-snapshot-helpers.ts";

const DAY = 24 * 60 * 60 * 1000;

async function record(fixture: Fixture, storeId: string, sessionFile: string, label: string, when: Date): Promise<string> {
	const result = await takeSnapshot({ agentDir: fixture.agentDir, storeId, cwd: fixture.project, sessionFile, label, now: when });
	assert.ok(result.tree, result.error);
	return result.tree;
}

async function age(path: string, when: Date): Promise<void> {
	await utimes(path, when, when);
}

/** Makes a store look untouched since `when`. */
async function quiet(fixture: Fixture, storeId: string, when: Date): Promise<void> {
	const dir = storeDirectory(fixture.agentDir, storeId);
	for (const path of ["index", "refs/snapshots", "turn-snapshot.json"]) await age(join(dir, path), when).catch(() => {});
}

async function refs(fixture: Fixture, storeId: string): Promise<string[]> {
	const output = await git(fixture.project, "--git-dir", storeDirectory(fixture.agentDir, storeId), "for-each-ref", "--format=%(refname)");
	return output ? output.split("\n") : [];
}

test("removes a deleted conversation's store, drops old snapshots and runs once a day", async () => {
	const fixture = await createFixture("retention");
	const now = new Date();
	const old = new Date(now.getTime() - 100 * DAY);
	const recent = new Date(now.getTime() - 10 * DAY);

	const goneSession = join(fixture.agentDir, "sessions", "gone.jsonl");
	await writeFile(goneSession, "");
	await record(fixture, "gone", goneSession, "m1-start", recent);
	await rm(goneSession);
	await age(join(storeDirectory(fixture.agentDir, "gone"), "turn-snapshot.json"), old);

	const youngSession = join(fixture.agentDir, "sessions", "young.jsonl");
	await record(fixture, "young", youngSession, "m1-start", now);

	await record(fixture, "mixed", fixture.sessionFile, "m1-start", old);
	await writeFile(join(fixture.project, "a.txt"), "recent turn\n");
	await record(fixture, "mixed", fixture.sessionFile, "m2-start", recent);
	await age(join(storeDirectory(fixture.agentDir, "mixed"), "index"), old);

	await record(fixture, "stale", fixture.sessionFile, "m1-start", old);
	await quiet(fixture, "stale", old);
	await record(fixture, "busy", fixture.sessionFile, "m1-start", old);
	await record(fixture, "active", fixture.sessionFile, "m1-start", old);

	const backups = join(fixture.agentDir, "file-history", "backups-only");
	await mkdir(backups);
	await writeFile(join(backups, "abc@123"), "a per-file backup");

	const result = await sweepSnapshotStores(fixture.agentDir, { now, activeStoreId: "active" });
	assert.equal(result.ran, true);
	assert.deepEqual(result.errors, []);
	assert.deepEqual(result.removedStores.sort(), ["gone", "stale"]);
	await assert.rejects(stat(storeDirectory(fixture.agentDir, "gone")));
	await assert.rejects(stat(storeDirectory(fixture.agentDir, "stale")));
	assert.ok(await stat(join(fixture.agentDir, "file-history", "gone")), "only tree.git is removed");
	assert.ok(await stat(storeDirectory(fixture.agentDir, "young")), "a young store waits for its session file");
	assert.ok(await stat(storeDirectory(fixture.agentDir, "busy")), "a store written within the hour is not removed whole");
	assert.deepEqual(await refs(fixture, "busy"), []);
	assert.deepEqual((await refs(fixture, "mixed")).map((ref) => ref.split("/").at(-1)), ["m2-start"]);
	assert.deepEqual(await refs(fixture, "active"), [], "the active store loses old refs but is kept");
	assert.ok(await stat(storeDirectory(fixture.agentDir, "active")));
	assert.ok(await stat(join(backups, "abc@123")), "directories without recorder metadata are untouched");

	const second = await sweepSnapshotStores(fixture.agentDir, { now });
	assert.equal(second.ran, false, "the sweep runs at most once a day");
	const forced = await sweepSnapshotStores(fixture.agentDir, { now, force: true });
	assert.equal(forced.ran, true);
	const tomorrow = await sweepSnapshotStores(fixture.agentDir, { now: new Date(now.getTime() + DAY + 1000) });
	assert.equal(tomorrow.ran, true);
});

test("garbage collection keeps every tree a remaining ref names", async () => {
	const fixture = await createFixture("retention-gc");
	const now = new Date();
	await writeFile(join(fixture.project, "untracked.txt"), "only in the old snapshot\n");
	await record(fixture, "s", fixture.sessionFile, "m1-start", new Date(now.getTime() - 100 * DAY));
	await writeFile(join(fixture.project, "untracked.txt"), "kept by the recent snapshot\n");
	const kept = await record(fixture, "s", fixture.sessionFile, "m2-start", now);
	await age(join(storeDirectory(fixture.agentDir, "s"), "index"), new Date(now.getTime() - DAY));

	const result = await sweepSnapshotStores(fixture.agentDir, { now, force: true });
	assert.deepEqual(result.errors, []);
	assert.equal(result.droppedRefs, 1);
	const dir = storeDirectory(fixture.agentDir, "s");
	const content = await git(fixture.project, "--git-dir", dir, "cat-file", "blob", `${kept}:untracked.txt`);
	assert.equal(content, "kept by the recent snapshot");
	await git(fixture.project, "--git-dir", dir, "fsck", "--no-dangling");
});

test("keeps a deleted conversation's store while a fork still names it", async () => {
	const fixture = await createFixture("retention-fork");
	const now = new Date();
	const parentSession = join(fixture.agentDir, "sessions", "parent.jsonl");
	const forkSession = join(fixture.agentDir, "sessions", "fork.jsonl");
	await writeFile(parentSession, "");
	await writeFile(forkSession, "");
	await record(fixture, "parent", parentSession, "m1-start", now);
	await registerStoreReferrer(fixture.agentDir, "parent", "fork", forkSession);
	await rm(parentSession);
	await quiet(fixture, "parent", new Date(now.getTime() - 2 * DAY));

	const kept = await sweepSnapshotStores(fixture.agentDir, { now, force: true });
	assert.deepEqual(kept.removedStores, []);
	assert.ok(await stat(storeDirectory(fixture.agentDir, "parent")));

	await rm(forkSession);
	const removed = await sweepSnapshotStores(fixture.agentDir, { now, force: true });
	assert.deepEqual(removed.removedStores, ["parent"]);
});
