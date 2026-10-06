import { describe, expect, it, vi } from "vitest";
import type { ConversationPager } from "./conversationPager";
import { ConversationStore } from "./conversationStore";
import type { HistoryPage } from "./history";
import { rowIndexOf, visibleEntryKeys } from "./useReadingPosition";
import type { HistoryEntry } from "./history";

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
  it("seeds a new window from a concurrent older snapshot without losing routed events", () => {
    const { store } = setup();
    const instance = "11111111-1111-4111-8111-111111111111";
    const frame = {
      resource: { agent_id: id(1) },
      kind: "assistant.delta",
      payload: { text: "tail", content_index: 0 },
      cursor: `ev1:${instance}:7`,
      server_instance_id: instance,
      sequence: 7,
      event_id: "evt_12345678",
      emitted_at: "2026-10-02T10:00:00Z",
      schema_version: 1,
    };
    store.applySnapshot({
      identity: { web_identity_id: "person" },
      event_cursor: `ev1:${instance}:5`,
      agents: [],
    } as never);
    store.routeEvent({
      ...frame,
      sequence: 8,
      cursor: `ev1:${instance}:8`,
    } as never);
    store.applySnapshot({
      identity: { web_identity_id: "person" },
      event_cursor: `ev1:${instance}:7`,
      agents: [{ agent_id: id(1), live_tail: [frame] }],
    } as never);
    expect(store.view(id(1), true).live).toMatchObject({
      sequence: 8,
      truncated: true,
    });
  });
  it("releases a queued active status frame without a second background status request", async () => {
    const { store, finish } = setup();
    const agent = id(1),
      instance = "11111111-1111-4111-8111-111111111111";
    store.applySnapshot({
      identity: { web_identity_id: "person" },
      event_cursor: `ev1:${instance}:0`,
      agents: [{ agent_id: agent, live_tail: [] }],
    } as never);
    store.view(agent);
    store.routeEvent(
      {
        resource: { agent_id: agent },
        kind: "turn.settled",
        payload: {},
        cursor: `ev1:${instance}:1`,
        server_instance_id: instance,
        sequence: 1,
        event_id: "evt_12345678",
      } as never,
      agent,
    );
    finish(page(agent, ["a"]));
    await flush();
    expect(store.read(agent)?.live?.sequence).toBe(1);
    expect(store.statusStale(agent)).toBe(false);
  });
  it("does not read deferred cold history on invalidation or reseed before status proof", () => {
    const { store, tail } = setup();
    const instance = "11111111-1111-4111-8111-111111111111";
    const snap = {
      identity: { web_identity_id: "person" },
      event_cursor: `ev1:${instance}:1`,
      agents: [{ agent_id: id(1), live_tail: [] }],
    } as never;
    store.applySnapshot(snap);
    store.view(id(1), false, true);
    store.routeEvent({
      resource: { agent_id: id(1) },
      kind: "snapshot.invalidated",
      payload: { reason: "source_changed" },
      cursor: `ev1:${instance}:1`,
      server_instance_id: instance,
      sequence: 1,
      event_id: "evt_12345678",
    } as never);
    store.reconcileStale();
    store.reseed(snap);
    expect(tail).not.toHaveBeenCalled();
    store.view(id(1)); // Cold status has now proved readable history.
    expect(tail).toHaveBeenCalledTimes(1);
  });
  it("keeps a history entry before cold status proof in loading until the tail joins", () => {
    const { store, tail } = setup();
    const instance = "11111111-1111-4111-8111-111111111111";
    store.applySnapshot({
      identity: { web_identity_id: "person" },
      event_cursor: `ev1:${instance}:0`,
      agents: [{ agent_id: id(1), live_tail: [] }],
    } as never);
    store.view(id(1), false, true);
    store.routeEvent({
      resource: { agent_id: id(1) },
      kind: "history.entry",
      payload: {
        entry_key: "native",
        entry_kind: "assistant",
        content: { media_type: "text/plain", text: "answer", complete: true },
      },
      cursor: `ev1:${instance}:1`,
      server_instance_id: instance,
      sequence: 1,
      event_id: "evt_12345678",
      native_key: "native",
    } as never);
    expect(store.read(id(1))?.state).toBe("loading");
    store.view(id(1));
    expect(tail).toHaveBeenCalledTimes(1);
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
  it("does not let an earlier settlement clear a newer turn when status refresh fails", async () => {
    const agent = id(1);
    const pager = {
      tail: vi.fn().mockResolvedValue(page(agent, ["previous"])),
      older: vi.fn(),
      reconnect: vi.fn(),
      cancelAll: vi.fn(),
    } as unknown as ConversationPager;
    const store = new ConversationStore("person", pager, 50, async () => {
      throw new Error("status unavailable");
    });
    store.view(agent);
    await flush();
    store.applyStatus(agent, {
      agent_id: agent,
      turn_settled: { native_key: "previous", state: "settled" },
    } as never);
    const instance = "11111111-1111-4111-8111-111111111111";
    store.setLive(agent, {
      cursor: `ev1:${instance}:0`,
      instance,
      sequence: 0,
      fragments: [],
      truncated: false,
    });
    const frame = (
      sequence: number,
      kind: string,
      payload: Record<string, unknown>,
    ) => ({
      resource: { agent_id: agent },
      kind,
      payload,
      cursor: `ev1:${instance}:${sequence}`,
      server_instance_id: instance,
      sequence,
      event_id: `evt_abcdefgh${sequence}`,
    });
    store.routeEvent(
      frame(1, "command.changed", { state: "pending" }) as never,
      agent,
    );
    expect(store.statusStale(agent)).toBe(true);
    store.routeEvent(
      frame(2, "assistant.delta", {
        text: "new turn",
        content_index: 0,
      }) as never,
      agent,
    );
    store.applyPage(agent, page(agent, ["previous", "current"]), "reconnect");
    expect(
      store
        .read(agent)
        ?.live?.fragments.some((event) => event.kind === "assistant.delta"),
    ).toBe(true);
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
    expect(visibleEntryKeys(entries)).toEqual(["tool-a", "tool-b", "user"]);
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

describe("attention markers", () => {
  it("notices confirmed history errors once, keeps seen errors visible, and does not turn unavailable into an error", () => {
    const { store } = setup();
    const agentId = id(1);
    const observation = (history: string) => ({
      identity: { web_identity_id: "person" },
      event_cursor: "ev1:11111111-1111-4111-8111-111111111111:1",
      agents: [{ agent_id: agentId, history }],
    });
    store.applySnapshot(observation("unavailable") as never);
    expect(store.readMetadata().attention.size).toBe(0);
    store.applySnapshot(observation("corrupt") as never);
    expect(store.readMetadata().attention.get(agentId)).toBe("new");
    store.setVisible(agentId);
    expect(store.readMetadata().attention.get(agentId)).toBe("seen");
    store.applySnapshot(observation("corrupt") as never);
    expect(store.readMetadata().attention.get(agentId)).toBe("seen");
    store.applySnapshot(observation("readable") as never);
    expect(store.readMetadata().attention.has(agentId)).toBe(false);
    store.setVisible(undefined);
    store.applySnapshot(observation("missing") as never);
    expect(store.readMetadata().attention.get(agentId)).toBe("new");
  });
  it("orders new events across views, preserves seen waiting, and clears on the next command", () => {
    const { store } = setup();
    const agent = id(1);
    const event = (
      kind: string,
      sequence: number,
      payload: Record<string, unknown> = {},
    ) => ({
      resource: { agent_id: agent },
      kind,
      payload,
      cursor: `ev1:11111111-1111-4111-8111-111111111111:${sequence}`,
      server_instance_id: "11111111-1111-4111-8111-111111111111",
      sequence,
      event_id: `evt-${sequence}`,
    });
    store.routeEvent(event("turn.settled", 1) as never);
    expect(store.readMetadata().attention.get(agent)).toBe("new");
    store.setVisible(agent);
    expect(store.readMetadata().attention.get(agent)).toBe("seen");
    store.setVisible(undefined);
    store.routeEvent(
      event("question.requested", 2, { request_id: "q1" }) as never,
    );
    expect(store.readMetadata().attention.get(agent)).toBe("new");
    store.setVisible(agent);
    store.applyStatus(agent, {
      agent_id: agent,
      state: "accepted",
      pending_question: { request_id: "q1" },
    } as never);
    expect(store.readMetadata().attention.get(agent)).toBe("seen");
    store.routeEvent(
      event("command.changed", 3, { state: "pending" }) as never,
    );
    expect(store.readMetadata().attention.has(agent)).toBe(false);
    store.dispose();
    expect(store.readMetadata().attention.size).toBe(0);
  });
});

it("retains a result anchor when paging joins it into its native call", () => {
  const tool: HistoryEntry = {
    entry_key: "r",
    kind: "tool",
    tool_call_id: "c",
    content: { media_type: "text/plain", text: "result", complete: true },
  };
  const call: HistoryEntry = {
    entry_key: "a",
    kind: "assistant",
    content: { media_type: "text/plain", text: "", complete: true },
    blocks: [{ type: "toolCall", tool_call_id: "c", tool_name: "read" }],
  };
  expect(rowIndexOf([tool], "r")).toBe(0);
  expect(rowIndexOf([call, tool], "r")).toBe(0);
  expect(visibleEntryKeys([call, tool])).toEqual(["a"]);
});
