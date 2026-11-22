import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, readdir, readFile, rename, rm, stat, symlink, unlink, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import test from "node:test";
import { compareTrees } from "../src/turn-snapshots/read.ts";
import { baseGitEnv, runGit } from "../src/turn-snapshots/git.ts";
import { diffTreeNumstat, storeDirectory, summarizeNumstat, takeSnapshot } from "../src/turn-snapshots/store.ts";
import { createFixture, git, type Fixture } from "./turn-snapshot-helpers.ts";

async function listTree(dir: string): Promise<string> {
	const lines: string[] = [];
	async function walk(current: string): Promise<void> {
		for (const name of (await readdir(current)).sort()) {
			const path = join(current, name);
			const info = await lstat(path);
			if (info.isDirectory()) await walk(path);
			else {
				const name = relative(dir, path);
				// Git refreshes the modification time of an existing object it would otherwise write
				// again (also through alternates); the object's content and name do not change.
				const time = name.startsWith(`objects`) ? "" : ` ${info.mtimeMs}`;
				lines.push(`${name} ${info.size}${time}`);
			}
		}
	}
	await walk(dir);
	return createHash("sha256").update(lines.join("\n")).digest("hex");
}

function snapshot(fixture: Fixture, label: string, limits = {}) {
	return takeSnapshot({
		agentDir: fixture.agentDir,
		storeId: "session-1",
		cwd: fixture.project,
		sessionFile: fixture.sessionFile,
		label,
		limits,
	});
}

test("records shell edits, deletions, renames, new files, binaries, links and modes without writing the workspace's .git", async () => {
	const fixture = await createFixture("store-capture");
	const { project } = fixture;
	const gitBefore = await listTree(join(project, ".git"));
	const start = await snapshot(fixture, "m1-start");
	assert.equal(start.reason, null);
	assert.ok(start.tree);
	assert.equal(start.root, project);

	await writeFile(join(project, "a.txt"), "one\nTWO\nthree\nfour\n");
	await unlink(join(project, "keep.txt"));
	await rename(join(project, "src", "move-me.txt"), join(project, "src", "moved.txt"));
	await mkdir(join(project, "new-dir"));
	await writeFile(join(project, "new-dir", "created.txt"), "fresh\n");
	await writeFile(join(project, "blob.bin"), Buffer.from([0, 1, 2, 3, 0, 255, 254]));
	await symlink("a.txt", join(project, "link-to-a"));
	await writeFile(join(project, "script.sh"), "#!/bin/sh\n");
	await chmod(join(project, "script.sh"), 0o755);
	await mkdir(join(project, "ignored"));
	await writeFile(join(project, "ignored", "cache.txt"), "never recorded\n");

	const end = await snapshot(fixture, "m1-end");
	assert.ok(end.tree);
	assert.equal(end.skipped.count, 0);
	assert.equal(await listTree(join(project, ".git")), gitBefore, "the workspace repository is never written");

	const comparison = await compareTrees(fixture.agentDir, "session-1", start.tree, end.tree);
	const byPath = new Map(comparison.files.map((file) => [file.path, file]));
	assert.deepEqual(byPath.get("a.txt"), { path: "a.txt", status: "modified", additions: 2, deletions: 1 });
	assert.equal(byPath.get("keep.txt")?.status, "deleted");
	assert.deepEqual(byPath.get("src/moved.txt")?.status, "renamed");
	assert.equal(byPath.get("src/moved.txt")?.oldPath, "src/move-me.txt");
	assert.equal(byPath.get("new-dir/created.txt")?.status, "added");
	assert.equal(byPath.get("blob.bin")?.additions, null, "a binary file has no line counts");
	assert.equal(byPath.get("link-to-a")?.status, "added");
	assert.equal(byPath.get("script.sh")?.status, "added");
	assert.equal(byPath.has("ignored/cache.txt"), false, "ignored files are not recorded");

	const tree = await git(project, "--git-dir", storeDirectory(fixture.agentDir, "session-1"), "ls-tree", "-r", end.tree);
	assert.match(tree, /^120000 blob \S+\tlink-to-a$/m);
	assert.match(tree, /^100755 blob \S+\tscript\.sh$/m);

	const stat = summarizeNumstat(await diffTreeNumstat(storeDirectory(fixture.agentDir, "session-1"), start.tree, end.tree));
	assert.equal(stat.files, comparison.files.length);
	assert.equal(stat.additions, 2 + 1 + 1 + 1);
});

test("borrows the workspace's objects and keeps the store private", async () => {
	const fixture = await createFixture("store-layout");
	const result = await snapshot(fixture, "m1-start");
	assert.ok(result.tree);
	const dir = storeDirectory(fixture.agentDir, "session-1");
	const alternates = await readFile(join(dir, "objects", "info", "alternates"), "utf8");
	assert.equal(alternates.trim(), join(fixture.project, ".git", "objects"));
	assert.equal((await stat(dir)).mode & 0o777, 0o700);
	const looseObjects = await git(fixture.project, "--git-dir", dir, "count-objects");
	// Nothing is new: the index matches HEAD, so every object already exists in the workspace repository.
	assert.match(looseObjects, /^0 objects/);
	const hooks = await readdir(join(dir, "hooks")).catch(() => []);
	assert.deepEqual(hooks, [], "no hook templates are installed");
	const ref = await git(fixture.project, "--git-dir", dir, "for-each-ref", "--format=%(objecttype) %(refname)");
	assert.match(ref, /^tree refs\/snapshots\/\d+\/m1-start$/);
});

test("names files left out by the size limits instead of storing them or stale content", async () => {
	const fixture = await createFixture("store-limits");
	const { project } = fixture;
	const start = await snapshot(fixture, "m1-start");
	assert.ok(start.tree);
	await writeFile(join(project, "a.txt"), "x".repeat(2048));
	await writeFile(join(project, "big-new.txt"), "y".repeat(4096));
	await writeFile(join(project, "small-1.txt"), "s".repeat(600));
	await writeFile(join(project, "small-2.txt"), "t".repeat(600));

	const end = await snapshot(fixture, "m1-end", { maxFileBytes: 1024, maxSnapshotBytes: 1000 });
	assert.ok(end.tree);
	const reasons = Object.fromEntries(end.skipped.paths.map((item) => [item.path, item.reason]));
	assert.equal(reasons["a.txt"], "file-too-large");
	assert.equal(reasons["big-new.txt"], "file-too-large");
	assert.equal(Object.values(reasons).filter((reason) => reason === "snapshot-too-large").length, 1);
	assert.equal(end.skipped.count, 3);
	assert.equal(end.skipped.truncated, false);

	const listing = await git(project, "--git-dir", storeDirectory(fixture.agentDir, "session-1"), "ls-tree", "-r", "--name-only", end.tree);
	assert.doesNotMatch(listing, /^a\.txt$/m, "a skipped tracked file keeps no stale content in the tree");
	assert.doesNotMatch(listing, /^big-new\.txt$/m);

	const listed = await snapshot(fixture, "m2-start", { maxFileBytes: 1024, maxSnapshotBytes: 1000, maxListedSkipped: 1 });
	assert.equal(listed.skipped.paths.length, 1);
	assert.equal(listed.skipped.truncated, true);
});

test("returns an explicit reason when no snapshot can be taken", async () => {
	const fixture = await createFixture("store-reasons");
	const plain = join(fixture.root, "plain");
	await mkdir(plain);
	const outside = await takeSnapshot({
		agentDir: fixture.agentDir,
		storeId: "session-1",
		cwd: plain,
		sessionFile: fixture.sessionFile,
		label: "m1-start",
	});
	assert.deepEqual([outside.tree, outside.reason], [null, "not-a-repository"]);

	const overBudget = await snapshot(fixture, "m1-start", { timeBudgetMs: 0 });
	assert.deepEqual([overBudget.tree, overBudget.reason], [null, "time-budget"]);

	await writeFile(join(fixture.project, ".gitattributes"), "*.psd filter=lfs diff=lfs merge=lfs -text\n");
	const filtered = await snapshot(fixture, "m1-start");
	assert.deepEqual([filtered.tree, filtered.reason], [null, "unsupported-repository"]);
	await rm(join(fixture.project, ".gitattributes"));

	await git(fixture.project, "config", "core.sparseCheckout", "true");
	const sparse = await snapshot(fixture, "m1-start");
	assert.deepEqual([sparse.tree, sparse.reason], [null, "unsupported-repository"]);
});

test("ignores inherited GIT_* variables and the user's hooks", async () => {
	const fixture = await createFixture("store-env");
	const marker = join(fixture.root, "hook-ran");
	await writeFile(join(fixture.project, ".git", "hooks", "post-index-change"), `#!/bin/sh\ntouch '${marker}'\n`);
	await chmod(join(fixture.project, ".git", "hooks", "post-index-change"), 0o755);
	const previous = { dir: process.env.GIT_DIR, index: process.env.GIT_INDEX_FILE };
	process.env.GIT_DIR = join(fixture.root, "nowhere");
	process.env.GIT_INDEX_FILE = join(fixture.root, "nowhere-index");
	try {
		const result = await snapshot(fixture, "m1-start");
		assert.ok(result.tree, result.error);
		await writeFile(join(fixture.project, "a.txt"), "changed\n");
		const next = await snapshot(fixture, "m1-end");
		assert.ok(next.tree, next.error);
		assert.notEqual(next.tree, result.tree);
	} finally {
		if (previous.dir === undefined) delete process.env.GIT_DIR;
		else process.env.GIT_DIR = previous.dir;
		if (previous.index === undefined) delete process.env.GIT_INDEX_FILE;
		else process.env.GIT_INDEX_FILE = previous.index;
	}
	await assert.rejects(stat(marker), "no hook of the workspace runs");
});

test("records a linked worktree against the shared object directory and its own index", async () => {
	const fixture = await createFixture("store-worktree");
	const linked = join(fixture.root, "linked");
	await git(fixture.project, "worktree", "add", "--quiet", "-b", "side", linked);
	await writeFile(join(linked, "a.txt"), "worktree edit\n");
	const result = await takeSnapshot({
		agentDir: fixture.agentDir,
		storeId: "session-2",
		cwd: join(linked, "src"),
		sessionFile: fixture.sessionFile,
		label: "m1-start",
	});
	assert.ok(result.tree, result.error);
	assert.equal(result.root, linked);
	const dir = storeDirectory(fixture.agentDir, "session-2");
	assert.equal((await readFile(join(dir, "objects", "info", "alternates"), "utf8")).trim(), join(fixture.project, ".git", "objects"));
	const content = await git(linked, "--git-dir", dir, "cat-file", "blob", `${result.tree}:a.txt`);
	assert.equal(content, "worktree edit");
});

test("a later snapshot with no changes gives the same tree", async () => {
	const fixture = await createFixture("store-stable");
	const first = await snapshot(fixture, "m1-start");
	const second = await snapshot(fixture, "m1-end");
	assert.ok(first.tree);
	assert.equal(second.tree, first.tree);
});

test("sees edits to entries the workspace marks skip-worktree or assume-unchanged", async () => {
	const fixture = await createFixture("store-flags");
	await git(fixture.project, "update-index", "--skip-worktree", "keep.txt");
	await git(fixture.project, "update-index", "--assume-unchanged", "a.txt");
	await writeFile(join(fixture.project, "keep.txt"), "local edit\n");
	await writeFile(join(fixture.project, "a.txt"), "another local edit\n");
	const result = await snapshot(fixture, "m1-start");
	assert.ok(result.tree, result.error);
	const dir = storeDirectory(fixture.agentDir, "session-1");
	assert.equal(await git(fixture.project, "--git-dir", dir, "cat-file", "blob", `${result.tree}:keep.txt`), "local edit");
	assert.equal(await git(fixture.project, "--git-dir", dir, "cat-file", "blob", `${result.tree}:a.txt`), "another local edit");
	assert.match(await git(fixture.project, "ls-files", "-v", "keep.txt"), /^S /, "the workspace's own flags stay");
});

test("output over the limit is a truncated prefix and never a success", async () => {
	const fixture = await createFixture("store-output");
	const full = await runGit(["-C", fixture.project, "cat-file", "-p", "HEAD"], { cwd: fixture.project }, baseGitEnv());
	assert.equal(full.code, 0);
	const limited = await runGit(["-C", fixture.project, "cat-file", "-p", "HEAD"], { cwd: fixture.project, maxOutputBytes: 10 }, baseGitEnv());
	assert.equal(limited.failure, "output-limit");
	assert.equal(limited.code, null);
	assert.deepEqual(limited.stdout, full.stdout.subarray(0, 10));
});

test("keeps Git's racy-clean check when seeding the index", async () => {
	const fixture = await createFixture("store-racy");
	const file = join(fixture.project, "racy.txt");
	await writeFile(file, "aaaa\n");
	await git(fixture.project, "add", "racy.txt");
	// Same size, same second, after staging: only a content check can see it.
	await writeFile(file, "bbbb\n");
	const result = await snapshot(fixture, "m1-start");
	assert.ok(result.tree, result.error);
	const recorded = await git(fixture.project, "--git-dir", storeDirectory(fixture.agentDir, "session-1"), "cat-file", "blob", `${result.tree}:racy.txt`);
	assert.equal(recorded, "bbbb");
});
