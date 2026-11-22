import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import type { ExtensionAPI, SessionEntry } from "@earendil-works/pi-coding-agent";
import { createSnapshotRecorder } from "../extensions/snapshots.ts";
import { compareTurn, listTurns } from "../src/turn-snapshots/read.ts";
import { TURN_SNAPSHOT_ENTRY_TYPE, isTurnSnapshotRecord, turnSnapshotsFromEntries, type TurnSnapshotRecord } from "../src/turn-snapshots/types.ts";
import { createFixture, type Fixture } from "./turn-snapshot-helpers.ts";

type Handler = (event: any, context: any) => Promise<any> | any;

class MockPi {
	readonly handlers = new Map<string, Handler[]>();
	readonly entries: SessionEntry[];
	constructor(entries: SessionEntry[], extra: Record<string, unknown> = {}) {
		this.entries = entries;
		Object.assign(this, extra);
	}

	on(event: string, handler: Handler): void {
		this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
	}

	appendEntry(customType: string, data: unknown): void {
		this.entries.push({
			type: "custom",
			id: `custom-${this.entries.length}`,
			parentId: this.entries.at(-1)?.id ?? null,
			timestamp: new Date().toISOString(),
			customType,
			data,
		} as SessionEntry);
	}

	async emit(event: string, payload: unknown, context: unknown): Promise<void> {
		for (const handler of this.handlers.get(event) ?? []) await handler(payload, context);
	}
}

interface Harness {
	fixture: Fixture;
	entries: SessionEntry[];
	context: unknown;
	user(id: string, text: string): Promise<void>;
	assistant(stopReason?: string): Promise<void>;
	records(): TurnSnapshotRecord[];
	restore(): void;
}

async function harness(name: string): Promise<Harness> {
	const fixture = await createFixture(name);
	const previous = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = fixture.agentDir;
	const entries: SessionEntry[] = [];
	const context = {
		cwd: fixture.project,
		hasUI: false,
		ui: { notify: () => {} },
		sessionManager: {
			getEntries: () => entries,
			getBranch: () => entries,
			getSessionId: () => "session-rec",
			getSessionFile: () => fixture.sessionFile,
		},
	};
	return {
		fixture,
		entries,
		context,
		async user(id, text) {
			const message = { role: "user", content: [{ type: "text", text }], timestamp: Date.now() };
			entries.push({ type: "message", id, parentId: entries.at(-1)?.id ?? null, timestamp: new Date().toISOString(), message } as SessionEntry);
			for (const pi of pis) await pi.emit("message_end", { type: "message_end", message }, context);
		},
		async assistant(stopReason = "stop") {
			const message = { role: "assistant", content: [], stopReason };
			for (const pi of pis) await pi.emit("message_start", { type: "message_start", message }, context);
			for (const pi of pis) await pi.emit("message_end", { type: "message_end", message }, context);
		},
		records: () => turnSnapshotsFromEntries(entries),
		restore() {
			if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previous;
		},
	};
}

let pis: MockPi[] = [];

async function load(h: Harness, count = 1, extra: Record<string, unknown> = {}): Promise<MockPi[]> {
	pis = Array.from({ length: count }, () => new MockPi(h.entries, extra));
	for (const pi of pis) createSnapshotRecorder()(pi as unknown as ExtensionAPI);
	for (const pi of pis) await pi.emit("session_start", { type: "session_start", reason: "startup" }, h.context);
	return pis;
}

async function shutdown(h: Harness): Promise<void> {
	for (const pi of pis) await pi.emit("session_shutdown", { type: "session_shutdown", reason: "quit" }, h.context);
	pis = [];
}

test("records start and settle of a run, with the run's file and line counts", async () => {
	const h = await harness("ext-run");
	try {
		const [pi] = await load(h);
		await h.user("m1", "reformat the file");
		await h.assistant("toolUse");
		// The agent changes files through the shell; no edit or write call names them.
		await writeFile(join(h.fixture.project, "a.txt"), "ONE\ntwo\nthree\nfour\n");
		await writeFile(join(h.fixture.project, "generated.txt"), "made by a script\n");
		await h.assistant("stop");
		await pi!.emit("agent_end", { type: "agent_end", messages: [] }, h.context);
		assert.equal(h.records().length, 1, "agent_end alone does not end a run on Pi");
		await pi!.emit("agent_settled", { type: "agent_settled" }, h.context);

		const records = h.records();
		assert.deepEqual(records.map((record) => [record.userEntryId, record.phase]), [
			["m1", "start"],
			["m1", "end"],
		]);
		const [start, end] = records;
		assert.ok(records.every(isTurnSnapshotRecord));
		assert.equal(start!.store, "session-rec");
		assert.equal(start!.root, h.fixture.project);
		assert.match(start!.git?.head ?? "", /^[0-9a-f]{40}$/);
		assert.equal(start!.git?.branch, "refs/heads/main");
		assert.equal(end!.outcome, "completed");
		assert.deepEqual(end!.stat, { files: 2, additions: 3, deletions: 1 });
		const custom = h.entries.filter((entry) => entry.type === "custom");
		assert.ok(custom.every((entry) => (entry as { customType?: string }).customType === TURN_SNAPSHOT_ENTRY_TYPE));

		const comparison = await compareTurn(h.fixture.agentDir, listTurns(records)[0]!);
		assert.deepEqual(comparison.files.map((file) => file.path), ["a.txt", "generated.txt"]);
	} finally {
		await shutdown(h);
		h.restore();
	}
});

test("a steering message closes the open window and an aborted run says so", async () => {
	const h = await harness("ext-steer");
	try {
		const [pi] = await load(h);
		await h.user("m1", "start working");
		await h.assistant("toolUse");
		await h.user("m2", "actually, do this instead");
		await h.assistant("aborted");
		await pi!.emit("agent_settled", { type: "agent_settled" }, h.context);
		assert.deepEqual(h.records().map((record) => [record.userEntryId, record.phase, record.outcome]), [
			["m1", "start", undefined],
			["m2", "start", undefined],
			["m2", "end", "aborted"],
		]);
		const turns = listTurns(h.records());
		assert.equal(turns[0]!.nextStart?.userEntryId, "m2");
	} finally {
		await shutdown(h);
		h.restore();
	}
});

test("a second recorder in the same process stays passive", async () => {
	const h = await harness("ext-duplicate");
	try {
		const loaded = await load(h, 2);
		await h.user("m1", "hello");
		await h.assistant();
		for (const pi of loaded) await pi.emit("agent_settled", { type: "agent_settled" }, h.context);
		assert.equal(h.records().length, 2);
	} finally {
		await shutdown(h);
		h.restore();
	}
	const next = await harness("ext-duplicate-after");
	try {
		await load(next);
		await next.user("m1", "after the first recorder shut down");
		await next.assistant();
		assert.equal(next.records().length, 1, "the slot is released at shutdown");
	} finally {
		await shutdown(next);
		next.restore();
	}
});

test("records nothing without a session file, and a plain folder records why", async () => {
	const h = await harness("ext-reasons");
	try {
		(h.context as { sessionManager: { getSessionFile: () => undefined } }).sessionManager.getSessionFile = () => undefined;
		await load(h);
		await h.user("m1", "in memory");
		await h.assistant();
		assert.equal(h.records().length, 0);
	} finally {
		await shutdown(h);
		h.restore();
	}

	const plain = await harness("ext-plain");
	try {
		(plain.context as { cwd: string }).cwd = plain.fixture.root;
		const [pi] = await load(plain);
		await plain.user("m1", "outside a repository");
		await plain.assistant();
		await pi!.emit("agent_settled", { type: "agent_settled" }, plain.context);
		assert.deepEqual(plain.records().map((record) => [record.phase, record.tree, record.reason, record.stat]), [
			["start", null, "not-a-repository", undefined],
			["end", null, "not-a-repository", null],
		]);
	} finally {
		await shutdown(plain);
		plain.restore();
	}
});

test("on OMP the terminal agent_end settles the run", async () => {
	const h = await harness("ext-omp");
	try {
		const [pi] = await load(h, 1, { logger: {}, typebox: {} });
		await h.user("m1", "hello");
		await h.assistant();
		await pi!.emit("agent_end", { type: "agent_end", messages: [], willContinue: true }, h.context);
		assert.equal(h.records().length, 1, "a continuing run is not settled");
		await pi!.emit("agent_end", { type: "agent_end", messages: [] }, h.context);
		assert.deepEqual(h.records().map((record) => record.phase), ["start", "end"]);
	} finally {
		await shutdown(h);
		h.restore();
	}
});

test("a forked session registers itself with the stores its inherited entries name", async () => {
	const h = await harness("ext-fork");
	try {
		const parent = {
			version: 1,
			userEntryId: "m0",
			phase: "start",
			tree: null,
			reason: "time-budget",
			store: "parent-session",
			root: null,
			cwd: h.fixture.project,
			timestamp: new Date().toISOString(),
			skipped: { count: 0, paths: [], truncated: false },
		};
		const parentStore = join(h.fixture.agentDir, "file-history", "parent-session", "tree.git");
		await mkdir(parentStore, { recursive: true });
		await writeFile(join(parentStore, "turn-snapshot.json"), JSON.stringify({ version: 1, root: h.fixture.project, sessionFile: "/nowhere" }));
		h.entries.push({ type: "custom", id: "c0", parentId: null, timestamp: parent.timestamp, customType: TURN_SNAPSHOT_ENTRY_TYPE, data: parent } as SessionEntry);
		await load(h);
		await h.user("m1", "after the fork");
		await h.assistant();
		assert.equal((await readFile(join(parentStore, "referrers", "session-rec"), "utf8")).trim(), h.fixture.sessionFile);
	} finally {
		await shutdown(h);
		h.restore();
	}
});
