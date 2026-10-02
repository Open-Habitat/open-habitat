import { describe, expect, it, vi } from "vitest";
import type { ConversationPager } from "./conversationPager";
import { ConversationStore } from "./conversationStore";
import { visibleEntryKeys } from "./useReadingPosition";
import type { HistoryPage } from "./history";

const id = (n: number) =>
  `pi:${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`;
const page = (
  agent_id: string,
  keys: string[],
  next_before?: string,
): HistoryPage => ({
  schema_version: 1,
  agent_id,
  native_revision: "rev",
  boundary_found: true,
  older_complete: !next_before,
  next_before,
  entries: keys.map((entry_key) => ({
    entry_key,
    kind: "assistant",
    content: { media_type: "text/plain", text: entry_key, complete: true },
  })),
});
function setup() {
  let resolve!: (p: HistoryPage) => void;
  const tail = vi.fn(
    () =>
      new Promise<HistoryPage>((r) => {
        resolve = r;
      }),
  );
  const pager = {
    tail,
    older: vi.fn(),
    reconnect: vi.fn(),
    cancelAll: vi.fn(),
  } as unknown as ConversationPager;
  const store = new ConversationStore("person", pager);
  return { store, tail, finish: (p: HistoryPage) => resolve(p) };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
describe("recent conversation windows", () => {
  it("keeps confirmed missing history empty when a speculative tail 404 races status", async () => {
    let reject!: (error: Error) => void;
    const pager = {
      tail: () =>
        new Promise<HistoryPage>((_resolve, fail) => {
          reject = fail;
        }),
      older: vi.fn(),
      reconnect: vi.fn(),
      cancelAll: vi.fn(),
    } as unknown as ConversationPager;
    const store = new ConversationStore("person", pager);
    store.view(id(1));
    store.view(id(1), true);
    reject(new Error("history_missing"));
    await flush();
    expect(store.read(id(1))?.state).toBe("empty");
    const second = new ConversationStore("person", {
      ...pager,
      tail: () => Promise.reject(new Error("history_missing")),
    } as unknown as ConversationPager);
    second.view(id(1));
    await flush();
    second.view(id(1), true);
    expect(second.read(id(1))?.state).toBe("empty");
  });
  it("does not publish a pre-invalidation page after snapshot reconciliation", async () => {
    const resolves: Array<(p: HistoryPage) => void> = [];
    const tail = vi.fn(
      () => new Promise<HistoryPage>((resolve) => resolves.push(resolve)),
    );
    const pager = {
      tail,
      older: vi.fn(),
      reconnect: vi.fn(),
      cancelAll: vi.fn(),
    } as unknown as ConversationPager;
    const store = new ConversationStore("person", pager);
    store.view(id(1));
    store.reconcileStale();
    expect(pager.cancelAll).toHaveBeenCalledOnce();
    expect(tail).toHaveBeenCalledTimes(2);
    resolves[0](page(id(1), ["obsolete"]));
    await flush();
    expect(store.read(id(1))?.state).toBe("loading");
    resolves[1](page(id(1), ["latest"]));
    await flush();
    expect(store.read(id(1))?.entries.map((entry) => entry.entry_key)).toEqual([
      "latest",
    ]);
  });
  it("opens once, returns the same snapshot on a warm switch and never requests again", async () => {
    const { store, tail, finish } = setup();
    const first = store.view(id(1));
    expect(first.state).toBe("loading");
    finish(page(id(1), ["a", "b"]));
    await flush();
    const ready = store.view(id(1));
    expect(store.view(id(1))).toBe(ready);
    expect(tail).toHaveBeenCalledTimes(1);
  });
  it("replays events racing a page and replaces saved native keys", async () => {
    const { store, finish } = setup();
    store.view(id(1));
    // A queued delta is not published ahead of the page.
    const event = {
      resource: { agent_id: id(1) },
      kind: "assistant.delta",
      payload: { text: "live" },
      cursor: "ev1:11111111-1111-4111-8111-111111111111:2",
      server_instance_id: "11111111-1111-4111-8111-111111111111",
      sequence: 2,
      event_id: "evt",
    };
    store.applyEvent(event as never);
    finish(page(id(1), ["a"]));
    await flush();
    store.applyPage(id(1), page(id(1), ["a", "b"], "a"));
    expect(store.read(id(1))?.entries.map((e) => e.entry_key)).toEqual([
      "a",
      "b",
    ]);
    store.applyPage(id(1), {
      ...page(id(1), ["b"]),
      entries: [
        {
          ...page(id(1), ["b"]).entries[0],
          content: {
            media_type: "text/plain",
            text: "updated",
            complete: true,
          },
        },
      ],
    });
    expect(store.read(id(1))?.entries.at(-1)?.content.text).toBe("updated");
  });
  it("joins older pages only at the boundary; append does not invalidate the cursor", async () => {
    const { store, finish } = setup();
    store.view(id(1));
    finish(page(id(1), ["b", "c"], "b"));
    await flush();
    store.applyPage(id(1), page(id(1), ["c", "d"], "c"));
    store.applyPage(id(1), page(id(1), ["a", "b"], "a"), "older");
    expect(store.read(id(1))?.entries.map((e) => e.entry_key)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    store.applyPage(id(1), page(id(1), ["z"], "z"), "older");
    expect(store.read(id(1))?.state).toBe("stale");
  });
  it("evicts the oldest whole window on the 51st view, retaining metadata", async () => {
    const { store, tail } = setup();
    for (let n = 1; n <= 51; n++) store.view(id(n));
    store.view(id(1));
    expect(tail).toHaveBeenCalledTimes(52);
    store.dispose();
    expect(store.read(id(1))).toBeUndefined();
  });
  it("does not revive a disposed person's late page; confirmed missing is empty", async () => {
    const { store, finish } = setup();
    store.view(id(1));
    store.confirmMissing(id(1));
    expect(store.read(id(1))?.state).toBe("empty");
    store.dispose();
    finish(page(id(1), ["old"]));
    await flush();
    expect(store.read(id(1))).toBeUndefined();
  });
  it("rejects contradictory ordering and a page that does not touch its boundary", async () => {
    const { store, finish } = setup();
    store.view(id(1));
    finish(page(id(1), ["a", "b", "c"], "a"));
    await flush();
    store.applyPage(id(1), page(id(1), ["b", "a", "c"]));
    expect(store.read(id(1))?.state).toBe("stale");
    expect(store.read(id(1))?.entries.map((e) => e.entry_key)).toEqual([
      "a",
      "b",
      "c",
    ]);
    store.applyPage(id(1), page(id(1), ["b", "c"]));
    store.applyPage(id(1), page(id(1), ["z", "b"], "z"), "older");
    expect(store.read(id(1))?.state).toBe("stale");
  });
  it("reads backwards through a long break, replacing if no shared key exists", async () => {
    const { store, finish } = setup();
    store.view(id(1));
    finish(page(id(1), ["a", "b"], "a"));
    await flush();
    store.applyPage(id(1), page(id(1), ["x", "y"], "x"));
    expect(store.read(id(1))?.entries.map((e) => e.entry_key)).toEqual([
      "x",
      "y",
    ]);
  });
  it("a confirmed missing history opens empty without a request", () => {
    const { store, tail } = setup();
    expect(store.view(id(1), true).state).toBe("empty");
    expect(tail).not.toHaveBeenCalled();
  });
  it("replays a racing persisted assistant over provisional text without duplicating the key", async () => {
    const { store, finish } = setup();
    const agent = id(1);
    store.view(agent);
    const cursor = "ev1:11111111-1111-4111-8111-111111111111:";
    store.setLive(agent, {
      cursor: `${cursor}0`,
      instance: "11111111-1111-4111-8111-111111111111",
      sequence: 0,
      fragments: [],
      truncated: false,
    });
    const event = (
      sequence: number,
      kind: string,
      payload: Record<string, unknown>,
    ) => ({
      resource: { agent_id: agent },
      kind,
      payload,
      cursor: `${cursor}${sequence}`,
      server_instance_id: "11111111-1111-4111-8111-111111111111",
      sequence,
      event_id: `evt${sequence}`,
    });
    store.routeEvent(event(1, "assistant.delta", { text: "working" }) as never);
    store.routeEvent(
      event(2, "history.entry", {
        entry_key: "a",
        entry_kind: "assistant",
        content: { media_type: "text/plain", text: "saved", complete: true },
      }) as never,
    );
    finish(page(agent, ["a"]));
    await flush();
    expect(store.read(agent)?.entries).toHaveLength(1);
    expect(store.read(agent)?.entries[0].content.text).toBe("saved");
    expect(store.read(agent)?.live?.fragments).toHaveLength(0);
  });
  it("a journal gap retains the last window but marks it stale", async () => {
    const { store, finish } = setup();
    store.view(id(1));
    finish(page(id(1), ["a"]));
    await flush();
    store.setLive(id(1), {
      cursor: "ev1:11111111-1111-4111-8111-111111111111:0",
      instance: "11111111-1111-4111-8111-111111111111",
      sequence: 0,
      fragments: [],
      truncated: false,
    });
    store.routeEvent({
      resource: { agent_id: id(1) },
      kind: "assistant.delta",
      payload: { text: "missed" },
      cursor: "ev1:11111111-1111-4111-8111-111111111111:2",
      server_instance_id: "11111111-1111-4111-8111-111111111111",
      sequence: 2,
      event_id: "gap",
    } as never);
    expect(store.read(id(1))?.state).toBe("stale");
    expect(store.read(id(1))?.entries.map((e) => e.entry_key)).toEqual(["a"]);
  });
  it("bounded reconnect finds a shared key through newer pages", async () => {
    const agent = id(1);
    const pager = {
      tail: vi.fn().mockResolvedValue(page(agent, ["a", "b"], "a")),
      older: vi.fn(),
      reconnect: vi.fn().mockResolvedValue({
        pages: [page(agent, ["c", "d"], "c"), page(agent, ["b", "c"], "b")],
        met: true,
      }),
      cancelAll: vi.fn(),
    } as unknown as ConversationPager;
    const store = new ConversationStore("person", pager);
    store.view(agent);
    await flush();
    await store.reconnect(agent);
    expect(store.read(agent)?.entries.map((e) => e.entry_key)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(store.read(agent)?.state).toBe("ready");
  });
  it("holds a cold window for status proof while accepting early stream deltas", () => {
    const { store, tail } = setup();
    const agent = id(1);
    store.view(agent, false, true);
    expect(tail).not.toHaveBeenCalled();
    store.setLive(agent, {
      cursor: "ev1:11111111-1111-4111-8111-111111111111:0",
      instance: "11111111-1111-4111-8111-111111111111",
      sequence: 0,
      fragments: [],
      truncated: false,
    });
    store.routeEvent({
      resource: { agent_id: agent },
      kind: "assistant.delta",
      payload: { text: "early" },
      cursor: "ev1:11111111-1111-4111-8111-111111111111:1",
      server_instance_id: "11111111-1111-4111-8111-111111111111",
      sequence: 1,
      event_id: "early",
    } as never);
    store.view(agent, true);
    expect(store.read(agent)?.live?.fragments).toHaveLength(1);
    expect(store.read(agent)?.state).toBe("empty");
    expect(tail).not.toHaveBeenCalled();
  });
  it("seeds a late read-only window from the routed journal, not an older snapshot", () => {
    const { store } = setup();
    const snapshot = {
      identity: { web_identity_id: "person" },
      event_cursor: "ev1:11111111-1111-4111-8111-111111111111:5",
      agents: [{ agent_id: id(1), live_tail: [] }],
    };
    store.applySnapshot(snapshot as never);
    for (const sequence of [6, 7, 8])
      store.routeEvent({
        resource: { agent_id: id(2) },
        kind: "assistant.delta",
        payload: { text: "other" },
        cursor: `ev1:11111111-1111-4111-8111-111111111111:${sequence}`,
        server_instance_id: "11111111-1111-4111-8111-111111111111",
        sequence,
        event_id: `e${sequence}`,
      } as never);
    expect(store.view(id(1), false, true).live?.sequence).toBe(8);
  });
  it("marks a gap stale and advances the cursor before reconnecting", async () => {
    const { store, finish } = setup();
    store.view(id(1));
    finish(page(id(1), ["a"]));
    await flush();
    store.setLive(id(1), {
      cursor: "ev1:11111111-1111-4111-8111-111111111111:0",
      instance: "11111111-1111-4111-8111-111111111111",
      sequence: 0,
      fragments: [],
      truncated: false,
    });
    store.routeEvent({
      resource: { agent_id: id(1) },
      kind: "snapshot.invalidated",
      payload: { reason: "source_changed" },
      cursor: "ev1:11111111-1111-4111-8111-111111111111:1",
      server_instance_id: "11111111-1111-4111-8111-111111111111",
      sequence: 1,
      event_id: "change",
    } as never);
    expect(store.read(id(1))?.live?.sequence).toBe(1);
    expect(store.read(id(1))?.state).toBe("stale");
  });
  it("anchors rendered rows rather than raw native entries when tools group", () => {
    const entries = page(id(1), ["tool-a", "tool-b", "user"]).entries;
    entries[0].kind = "tool";
    entries[1].kind = "tool";
    entries[2].kind = "user";
    expect(visibleEntryKeys(entries)).toEqual(["tool-a", "user"]);
  });
  it("refreshes a background controlled status on a router notification, not on view", async () => {
    const agent = id(1);
    const fresh = { agent_id: agent, state: "idle" };
    const statusReader = vi.fn().mockResolvedValue(fresh);
    const pager = {
      tail: vi.fn(),
      older: vi.fn(),
      reconnect: vi.fn(),
      cancelAll: vi.fn(),
    } as unknown as ConversationPager;
    const store = new ConversationStore("person", pager, 50, statusReader);
    store.applyStatus(agent, { agent_id: agent, state: "accepted" } as never);
    store.view(agent, true);
    expect(statusReader).not.toHaveBeenCalled();
    store.routeEvent({
      resource: { agent_id: agent },
      kind: "turn.settled",
      payload: {},
      cursor: "ev1:11111111-1111-4111-8111-111111111111:1",
      server_instance_id: "11111111-1111-4111-8111-111111111111",
      sequence: 1,
      event_id: "settle",
    } as never);
    expect(store.statusStale(agent)).toBe(true);
    await flush();
    expect(statusReader).toHaveBeenCalledTimes(1);
    expect(store.status(agent)?.state).toBe("idle");
    expect(store.statusStale(agent)).toBe(false);
  });
  it("keeps a nested recovery read owning the loading flag after the original tail settles", async () => {
    const agent = id(1);
    let finishTail!: (p: HistoryPage) => void;
    let finishRecovery!: (p: { pages: HistoryPage[]; met: boolean }) => void;
    const pager = {
      tail: vi.fn(
        () =>
          new Promise<HistoryPage>((resolve) => {
            finishTail = resolve;
          }),
      ),
      reconnect: vi.fn(
        () =>
          new Promise<{ pages: HistoryPage[]; met: boolean }>((resolve) => {
            finishRecovery = resolve;
          }),
      ),
      older: vi.fn(),
      cancelAll: vi.fn(),
    } as unknown as ConversationPager;
    const store = new ConversationStore("person", pager);
    store.view(agent);
    store.setLive(agent, {
      cursor: "ev1:11111111-1111-4111-8111-111111111111:0",
      instance: "11111111-1111-4111-8111-111111111111",
      sequence: 0,
      fragments: [],
      truncated: false,
    });
    const event = (sequence: number) => ({
      resource: { agent_id: agent },
      kind: "assistant.delta",
      payload: { text: "delta" },
      cursor: `ev1:11111111-1111-4111-8111-111111111111:${sequence}`,
      server_instance_id: "11111111-1111-4111-8111-111111111111",
      sequence,
      event_id: `e${sequence}`,
    });
    store.routeEvent(event(2) as never); // sequence 1 was missed while the page was loading
    finishTail(page(agent, ["a"]));
    await flush();
    expect(store.read(agent)?.live?.sequence).toBe(2);
    store.routeEvent(event(4) as never);
    expect(store.read(agent)?.live?.sequence).toBe(2); // queued behind reconnect
    finishRecovery({
      pages: [page(agent, ["b", "c"]), page(agent, ["a", "b"])],
      met: true,
    });
    await flush();
    expect(store.read(agent)?.live?.sequence).toBe(4); // gap starts nested reconnect
    store.routeEvent(event(5) as never);
    expect(store.read(agent)?.live?.sequence).toBe(4); // still queued behind nested read
    finishRecovery({ pages: [page(agent, ["a", "b", "c"])], met: true });
    await flush();
    expect(store.read(agent)?.live?.sequence).toBe(5);
  });
  it("background text deltas notify only their window, not sidebar metadata", () => {
    const { store } = setup();
    const agent = id(1);
    store.view(agent, true);
    store.setLive(agent, {
      cursor: "ev1:11111111-1111-4111-8111-111111111111:0",
      instance: "11111111-1111-4111-8111-111111111111",
      sequence: 0,
      fragments: [],
      truncated: false,
    });
    const metadata = vi.fn();
    const windowListener = vi.fn();
    store.subscribeMetadata(metadata);
    store.subscribe(agent, windowListener);
    store.routeEvent({
      resource: { agent_id: agent },
      kind: "assistant.delta",
      payload: { text: "background" },
      cursor: "ev1:11111111-1111-4111-8111-111111111111:1",
      server_instance_id: "11111111-1111-4111-8111-111111111111",
      sequence: 1,
      event_id: "delta",
    } as never);
    expect(windowListener).toHaveBeenCalledTimes(1);
    expect(metadata).not.toHaveBeenCalled();
  });
  it("a daemon restart resets the live cursor and retains stale saved content", async () => {
    const { store, tail, finish } = setup();
    const agent = id(1);
    store.applySnapshot({
      identity: { web_identity_id: "person" },
      event_cursor: "ev1:11111111-1111-4111-8111-111111111111:1",
      agents: [{ agent_id: agent, live_tail: [] }],
    } as never);
    store.view(agent);
    finish(page(agent, ["saved"]));
    await flush();
    store.applySnapshot({
      identity: { web_identity_id: "person" },
      event_cursor: "ev1:22222222-2222-4222-8222-222222222222:0",
      agents: [{ agent_id: agent, live_tail: [] }],
    } as never);
    expect(store.read(agent)?.live?.instance).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
    expect(store.read(agent)?.entries.map((e) => e.entry_key)).toEqual([
      "saved",
    ]);
    expect(store.read(agent)?.state).toBe("stale");
    expect(tail).toHaveBeenCalledTimes(1);
  });
  it("treats cached control status as stale across a daemon restart", async () => {
    const agent = id(1);
    const statusReader = vi
      .fn()
      .mockResolvedValue({ agent_id: agent, state: "idle" });
    const pager = {
      tail: vi.fn(),
      older: vi.fn(),
      reconnect: vi.fn(),
      cancelAll: vi.fn(),
    } as unknown as ConversationPager;
    const store = new ConversationStore("person", pager, 50, statusReader);
    store.applySnapshot({
      identity: { web_identity_id: "person" },
      event_cursor: "ev1:11111111-1111-4111-8111-111111111111:1",
      agents: [],
    } as never);
    store.applyStatus(agent, { agent_id: agent, state: "accepted" } as never);
    store.applySnapshot({
      identity: { web_identity_id: "person" },
      event_cursor: "ev1:22222222-2222-4222-8222-222222222222:0",
      agents: [],
    } as never);
    expect(store.statusStale(agent)).toBe(true);
    await flush();
    expect(store.status(agent)?.state).toBe("idle");
    expect(store.statusStale(agent)).toBe(false);
  });
  it("a same-instance resnapshot does not invalidate the active status a second time", async () => {
    const agent = id(1);
    const statusReader = vi.fn().mockRejectedValue(new Error("offline"));
    const pager = {
      tail: vi.fn(),
      older: vi.fn(),
      reconnect: vi.fn(),
      cancelAll: vi.fn(),
    } as unknown as ConversationPager;
    const store = new ConversationStore("person", pager, 50, statusReader);
    const snapshot = {
      identity: { web_identity_id: "person" },
      event_cursor: "ev1:11111111-1111-4111-8111-111111111111:1",
      agents: [],
    };
    store.applySnapshot(snapshot as never);
    store.applyStatus(agent, { agent_id: agent, state: "idle" } as never);
    store.reseed(
      {
        ...snapshot,
        event_cursor: "ev1:11111111-1111-4111-8111-111111111111:2",
      } as never,
      agent,
    );
    await flush();
    expect(statusReader).not.toHaveBeenCalled();
    expect(store.statusStale(agent)).toBe(false);
  });
});
