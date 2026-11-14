import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConversationPager } from "./conversationPager";
import { ConversationStore, unreadableHistory } from "./conversationStore";
import type { HistoryEntry, HistoryPage } from "./history";
import { rowIndexOf, visibleEntryKeys } from "./useReadingPosition";

describe("history state in a controlled conversation", () => {
  const agent = { history: "missing" } as Parameters<
    typeof unreadableHistory
  >[0];
  it("does not call an unwritten empty controller history a failure", () => {
    expect(unreadableHistory(agent, true)).toBe(false);
    expect(
      unreadableHistory(agent, true, { native_history: "missing" } as never),
    ).toBe(false);
    expect(unreadableHistory(agent, false)).toBe(true);
  });
  it("preserves real failure and newer positive evidence", () => {
    expect(
      unreadableHistory(agent, true, {
        turn_settled: { native_key: "x" },
      } as never),
    ).toBe(true);
    expect(
      unreadableHistory(agent, false, { native_history: "present" } as never),
    ).toBe(false);
    expect(unreadableHistory({ history: "corrupt" } as never, true)).toBe(true);
  });
});

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
afterEach(() => {
  vi.useRealTimers();
});
describe("recent conversation windows", () => {
  it.each(["not_started", "failed"])(
    "refreshes active pending %s receipts without erasing the live answer",
    async (execution) => {
      const agent = id(1);
      const { tail } = setup();
      const status = {
        agent_id: agent,
        state: execution === "failed" ? "start_failed" : "starting",
        start_problem: execution === "failed" ? "pi_start_failed" : "",
      };
      const reader = vi.fn().mockResolvedValue(status);
      const pager = {
        tail,
        cancelAll: vi.fn(),
      } as unknown as ConversationPager;
      const store = new ConversationStore("person", pager, 50, reader);
      store.applyStatus(agent, { agent_id: agent, state: "starting" } as never);
      store.view(agent);
      const instance = "11111111-1111-4111-8111-111111111111";
      const frame = {
        resource: { agent_id: agent },
        kind: "assistant.delta",
        payload: { text: "still answering", content_index: 0 },
        cursor: `ev1:${instance}:1`,
        server_instance_id: instance,
        sequence: 1,
        event_id: "evt_abcdefgh1",
      };
      store.setLive(agent, {
        cursor: frame.cursor,
        instance,
        sequence: 1,
        fragments: [frame as never],
        truncated: true,
      });
      store.routeEvent(
        {
          ...frame,
          kind: "command.changed",
          sequence: 2,
          cursor: `ev1:${instance}:2`,
          payload: {
            client_command_id: "queued-send",
            acceptance: "pending",
            execution,
            ...(execution === "failed"
              ? { error_code: "pi_start_failed" }
              : {}),
          },
        } as never,
        agent,
      );
      expect(reader).toHaveBeenCalledWith(agent);
      expect(store.read(agent)?.live?.fragments).toEqual([frame]);
      expect(store.read(agent)?.live?.truncated).toBe(true);
      await flush();
      expect(store.status(agent)).toMatchObject(status);
      expect(store.statusStale(agent)).toBe(false);
      store.dispose();
    },
  );
  it("drops the pre-login controller status so reopening reads native state", () => {
    const { store } = setup();
    const agent = id(14);
    store.applyStatus(agent, {
      agent_id: agent,
      state: "idle",
      auth_error: "pi_auth_failed",
    } as never);
    expect(store.status(agent)?.auth_error).toBe("pi_auth_failed");
    store.discardStatus(agent);
    expect(store.status(agent)).toBeUndefined();
  });
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
  it("applies an active status frame during a read without a second background status request", async () => {
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
    // Without a seeded cursor the stream needs recovery, not a guessed delta.
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
  it.each(["tail", "reconnect"] as const)(
    "keeps exhaustion at the retained oldest entry during %s refresh",
    async (mode) => {
      const { store, finish } = setup();
      store.view(id(1));
      finish(page(id(1), ["b", "c"], "b"));
      await flush();
      store.applyPage(id(1), page(id(1), ["a", "b"]), "older");
      expect(store.read(id(1))?.next).toBeUndefined();
      store.applyPage(id(1), page(id(1), ["c", "d"], "c"), mode);
      expect(store.read(id(1))?.entries.map((e) => e.entry_key)).toEqual([
        "a",
        "b",
        "c",
        "d",
      ]);
      expect(store.read(id(1))?.next).toBeUndefined();
    },
  );
  it("replaces what the held range had after the branch point when Pi moved to another branch", async () => {
    const { store, finish } = setup();
    store.view(id(1));
    finish(page(id(1), ["a", "b", "c", "d"]));
    await flush();
    // Palaa tähän before c: the leaf is now a marker after b.
    store.applyPage(id(1), page(id(1), ["a", "b", "m"]));
    expect(store.read(id(1))?.entries.map((e) => e.entry_key)).toEqual([
      "a",
      "b",
      "m",
    ]);
    // An ordinary append still keeps the held range.
    store.applyPage(id(1), page(id(1), ["m", "n"]));
    expect(store.read(id(1))?.entries.map((e) => e.entry_key)).toEqual([
      "a",
      "b",
      "m",
      "n",
    ]);
    // A reconnect's older page is not the leaf and drops nothing.
    store.applyPage(id(1), page(id(1), ["b", "x"]), "reconnect");
    expect(store.read(id(1))?.entries.map((e) => e.entry_key)).toContain("n");
  });
  it("updates the cursor when a refresh proves the same or an earlier left boundary complete", async () => {
    const { store, finish } = setup();
    store.view(id(1));
    finish(page(id(1), ["b", "c"], "b"));
    await flush();
    store.applyPage(id(1), page(id(1), ["b", "c", "d"]), "reconnect");
    expect(store.read(id(1))?.next).toBeUndefined();
    store.applyPage(id(1), page(id(1), ["a", "b"], "a"));
    expect(store.read(id(1))?.next).toBe("a");
    store.applyPage(id(1), page(id(1), ["z", "a"]), "reconnect");
    expect(store.read(id(1))?.next).toBeUndefined();
    // Exhaustion cannot survive a disjoint replacement window.
    store.applyPage(id(1), page(id(1), ["x", "y"], "x"));
    expect(store.read(id(1))?.next).toBe("x");
  });
  it("exhausts the reopened live case's 25 + 26 entry pages, including native settings", async () => {
    // Metadata-only shape of the live case: 52 native records, minus the
    // header and hidden prompt. Settings are entries; the shared key counts
    // in both HTTP pages. All keys and contents here are invented.
    const { store, finish } = setup();
    const agent = id(1);
    const keys = Array.from({ length: 50 }, (_, i) => `entry${i}`);
    const oldest = page(agent, keys.slice(0, 26));
    oldest.entries[0].kind = "model_change";
    oldest.entries[0].entry_type = "model_change";
    oldest.entries[1].kind = "unknown";
    oldest.entries[1].entry_type = "thinking_level_change";
    oldest.entries[2].kind = "user";
    const tail = page(agent, keys.slice(25), keys[25]);
    store.view(agent);
    finish(tail);
    await flush();
    expect(store.read(agent)?.next).toBe(keys[25]);
    store.applyPage(agent, oldest, "older");
    expect(store.read(agent)?.entries.map((entry) => entry.entry_key)).toEqual(
      keys,
    );
    expect(store.read(agent)?.next).toBeUndefined();
    store.applyPage(agent, tail, "reconnect");
    store.applyPage(agent, tail, "tail");
    expect(store.read(agent)?.next).toBeUndefined();
    expect(store.read(agent)?.entries).toHaveLength(50);
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
  it("keeps an unwritten new conversation empty through stream recovery, then reads once", async () => {
    const { store, tail, finish } = setup();
    const agent = id(1);
    store.view(agent, true);
    // A stream recovery and a window gap prove nothing about native history.
    store.markAllStale();
    store.setLive(agent, {
      cursor: "ev1:11111111-1111-4111-8111-111111111111:0",
      instance: "11111111-1111-4111-8111-111111111111",
      sequence: 0,
      fragments: [],
      truncated: false,
    });
    const reconnect = vi.mocked(
      (store as unknown as { pager: ConversationPager }).pager.reconnect,
    );
    reconnect.mockRejectedValue(new Error("history_missing"));
    store.routeEvent({
      resource: { agent_id: agent },
      kind: "assistant.delta",
      payload: { text: "missed" },
      cursor: "ev1:11111111-1111-4111-8111-111111111111:2",
      server_instance_id: "11111111-1111-4111-8111-111111111111",
      sequence: 2,
      event_id: "gap",
    } as never);
    await flush();
    expect(store.read(agent)?.state).toBe("empty");
    expect(store.readMetadata().historyReadFailures.has(agent)).toBe(false);
    // The owed read finds what Pi wrote meanwhile.
    store.reconcileStale();
    expect(tail).toHaveBeenCalledTimes(1);
    finish(page(agent, ["first"]));
    await flush();
    expect(store.read(agent)?.state).toBe("ready");
  });
  it("still reports a failed read of an empty window", async () => {
    const { store } = setup();
    const agent = id(1);
    store.view(agent, true);
    vi.mocked(
      (store as unknown as { pager: ConversationPager }).pager.reconnect,
    ).mockRejectedValue(new Error("history_unavailable"));
    await store.reconnect(agent);
    expect(store.read(agent)?.state).toBe("error");
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
      frame(1, "command.changed", {
        client_command_id: "queued-send",
        acceptance: "pending",
        execution: "not_started",
      }) as never,
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
  it("a journal gap is missed until a native read begun after it joins", async () => {
    const agent = id(1);
    const reads: ((value: { pages: HistoryPage[]; met: boolean }) => void)[] =
      [];
    const pager = {
      tail: vi.fn().mockResolvedValue(page(agent, ["a"])),
      older: vi.fn(),
      reconnect: vi.fn(
        () =>
          new Promise((resolve) => {
            reads.push(resolve);
          }),
      ),
      cancelAll: vi.fn(),
    } as unknown as ConversationPager;
    const store = new ConversationStore("person", pager);
    store.view(agent);
    await flush();
    const instance = "11111111-1111-4111-8111-111111111111";
    store.setLive(agent, {
      cursor: `ev1:${instance}:0`,
      instance,
      sequence: 0,
      fragments: [],
      truncated: false,
    });
    // A read already under way cannot hold what the gap's events carried.
    void store.reconnect(agent);
    store.routeEvent({
      resource: { agent_id: agent },
      kind: "assistant.delta",
      payload: { text: "missed" },
      cursor: `ev1:${instance}:2`,
      server_instance_id: instance,
      sequence: 2,
      event_id: "gap",
    } as never);
    expect(store.read(agent)?.live?.missed).toBe(true);
    reads[0]({ pages: [page(agent, ["a", "b"])], met: true });
    await flush();
    expect(store.read(agent)?.live?.missed).toBe(true);
    expect(reads).toHaveLength(2);
    reads[1]({ pages: [page(agent, ["a", "b", "c"])], met: true });
    await flush();
    expect(store.read(agent)?.live?.missed).toBe(false);
    expect(store.read(agent)?.entries.map((e) => e.entry_key)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
  it("a new conversation opened behind the stream has missed nothing", () => {
    const instance = "11111111-1111-4111-8111-111111111111";
    const frame = (sequence: number, agent_id: string) => ({
      resource: { agent_id },
      kind: "snapshot.invalidated",
      payload: { reason: "agent_created" },
      cursor: `ev1:${instance}:${sequence}`,
      server_instance_id: instance,
      sequence,
      event_id: `evt_abcdefgh${sequence}`,
    });
    const { store } = setup();
    const empty = id(1);
    const saved = id(2);
    store.applySnapshot({
      identity: { web_identity_id: "person" },
      event_cursor: `ev1:${instance}:2`,
      agents: [
        { agent_id: empty, history: "missing", live_tail: [] },
        { agent_id: saved, history: "readable", live_tail: [] },
      ],
    } as never);
    // The router is ahead of the applied snapshot when the views open.
    store.routeEvent(frame(3, empty) as never);
    store.view(empty);
    store.view(saved);
    expect(store.read(empty)?.live?.missed).toBeFalsy();
    expect(store.read(empty)?.live?.truncated).toBe(false);
    expect(store.read(empty)?.live?.sequence).toBe(3);
    // A conversation with history may have had entries in the gap.
    expect(store.read(saved)?.live?.missed).toBe(true);
    store.routeEvent({
      ...frame(4, empty),
      kind: "assistant.delta",
      payload: { text: "first", content_index: 0 },
    } as never);
    expect(store.read(empty)?.live?.missed).toBeFalsy();
    expect(store.read(empty)?.live?.fragments).toHaveLength(1);
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
  it("keeps a contiguous view through a native invalidation and reads after the snapshot", async () => {
    const { store, finish } = setup();
    store.view(id(1));
    finish(page(id(1), ["a"]));
    await flush();
    const live = {
      cursor: "ev1:11111111-1111-4111-8111-111111111111:0",
      instance: "11111111-1111-4111-8111-111111111111",
      sequence: 0,
      fragments: [],
      truncated: false,
    };
    store.setLive(id(1), live);
    const invalidation = (sequence: number) =>
      ({
        resource: { agent_id: id(1) },
        kind: "snapshot.invalidated",
        payload: { reason: "source_changed" },
        cursor: `ev1:11111111-1111-4111-8111-111111111111:${sequence}`,
        server_instance_id: "11111111-1111-4111-8111-111111111111",
        sequence,
        event_id: `change-${sequence}`,
      }) as never;
    store.routeEvent(invalidation(1));
    expect(store.read(id(1))?.live?.sequence).toBe(1);
    expect(store.read(id(1))?.state).toBe("ready");
    // The read waits for the snapshot that answers the invalidation; only a
    // failed read shows the history as stale.
    const pager = (store as unknown as { pager: ConversationPager }).pager;
    const reconnect = vi.mocked(pager.reconnect);
    expect(reconnect).not.toHaveBeenCalled();
    reconnect.mockRejectedValueOnce(new Error("offline"));
    store.reconcileStale();
    expect(reconnect).toHaveBeenCalledTimes(1);
    await flush();
    expect(store.read(id(1))?.state).toBe("stale");
    // A gap is still stale at once.
    store.setLive(id(1), live);
    store.routeEvent(invalidation(5));
    expect(store.read(id(1))?.state).toBe("stale");
  });
  it("keeps streamed text through a process notification and joins history quietly", async () => {
    const { store, finish } = setup();
    store.view(id(1));
    finish(page(id(1), ["a"]));
    await flush();
    const instance = "11111111-1111-4111-8111-111111111111";
    const delta = {
      resource: { agent_id: id(1) },
      kind: "assistant.delta",
      payload: { text: "kesken", content_index: 0 },
      cursor: `ev1:${instance}:1`,
      server_instance_id: instance,
      sequence: 1,
      event_id: "delta",
    };
    store.setLive(id(1), {
      cursor: `ev1:${instance}:0`,
      instance,
      sequence: 0,
      fragments: [],
      truncated: false,
    });
    store.routeEvent(delta as never);
    const pager = (store as unknown as { pager: ConversationPager }).pager;
    let answer!: (value: unknown) => void;
    vi.mocked(pager.reconnect).mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }) as never,
    );
    store.routeEvent({
      resource: { agent_id: id(1) },
      kind: "process.notification",
      payload: {},
      cursor: `ev1:${instance}:2`,
      server_instance_id: instance,
      sequence: 2,
      event_id: "note",
    } as never);
    expect(pager.reconnect).toHaveBeenCalledTimes(1);
    expect(store.read(id(1))).toMatchObject({
      state: "ready",
      live: { sequence: 2, truncated: false, fragments: [delta] },
    });
    store.routeEvent({
      ...delta,
      sequence: 3,
      cursor: `ev1:${instance}:3`,
      payload: { text: " jatkuu", content_index: 0 },
    } as never);
    // A frame for a different conversation must advance this window's cursor
    // too, or the next local delta looks like a gap.
    store.routeEvent({
      ...delta,
      resource: { agent_id: id(2) },
      sequence: 4,
      cursor: `ev1:${instance}:4`,
    } as never);
    store.routeEvent({
      ...delta,
      kind: "tool.updated",
      sequence: 5,
      cursor: `ev1:${instance}:5`,
      payload: { tool_call_id: "call", tool_name: "read", text: "progress" },
    } as never);
    expect(store.read(id(1))?.live).toMatchObject({
      sequence: 5,
      fragments: [
        { payload: { text: "kesken jatkuu" } },
        { kind: "tool.updated", payload: { text: "progress" } },
      ],
    });
    answer({ pages: [page(id(1), ["a", "note"])], met: true });
    await flush();
    expect(store.read(id(1))?.entries.map((e) => e.entry_key)).toEqual([
      "a",
      "note",
    ]);
    expect(store.read(id(1))?.live).toMatchObject({
      sequence: 5,
      fragments: [
        { payload: { text: "kesken jatkuu" } },
        { kind: "tool.updated", payload: { text: "progress" } },
      ],
    });
  });
  it("retires a reply Pi saved before taking a queued message, once a read begun after its turn joins", async () => {
    // Pi's own order: the reply's message ends (and is written), its turn
    // ends, and the run goes on with the follow-up without agent_end. The
    // daemon publishes the run's entries only when it settles.
    const { store, finish } = setup();
    store.view(id(1));
    finish(page(id(1), ["a"]));
    await flush();
    const instance = "11111111-1111-4111-8111-111111111111";
    const frame = (
      sequence: number,
      kind: string,
      payload: Record<string, unknown>,
    ) =>
      ({
        resource: { agent_id: id(1) },
        kind,
        payload,
        cursor: `ev1:${instance}:${sequence}`,
        server_instance_id: instance,
        sequence,
        event_id: `frame-${sequence}`,
      }) as never;
    store.setLive(id(1), {
      cursor: `ev1:${instance}:0`,
      instance,
      sequence: 0,
      fragments: [],
      truncated: false,
    });
    const pager = (store as unknown as { pager: ConversationPager }).pager;
    const reads: ((value: unknown) => void)[] = [];
    vi.mocked(pager.reconnect).mockImplementation(
      () =>
        new Promise((resolve) => {
          reads.push(resolve);
        }) as never,
    );
    store.routeEvent(
      frame(1, "assistant.delta", { text: "Vastaus", content_index: 0 }),
    );
    // A read begun before the turn ended may predate the saved reply.
    store.routeEvent(frame(2, "process.notification", {}));
    store.routeEvent(frame(3, "pi.lifecycle", { signal: "turn_end" }));
    store.routeEvent(frame(4, "pi.lifecycle", { signal: "turn_start" }));
    reads[0]({ pages: [page(id(1), ["a", "note"])], met: true });
    await flush();
    expect(store.read(id(1))?.live?.fragments.map((f) => f.kind)).toEqual([
      "assistant.delta",
      "pi.lifecycle",
      "pi.lifecycle",
    ]);
    // A read begun after it shows the reply and the follow-up; the next
    // reply streamed meanwhile stays live.
    store.routeEvent(frame(5, "process.notification", {}));
    store.routeEvent(
      frame(6, "assistant.delta", { text: "Toinen", content_index: 0 }),
    );
    const user: HistoryEntry = {
      entry_key: "followup",
      kind: "user",
      content: { media_type: "text/plain", text: "jatko", complete: true },
    };
    const saved = page(id(1), ["a", "note", "reply"]);
    reads[1]({
      pages: [{ ...saved, entries: [...saved.entries, user] }],
      met: true,
    });
    await flush();
    expect(store.read(id(1))?.entries.map((e) => e.entry_key)).toEqual([
      "a",
      "note",
      "reply",
      "followup",
    ]);
    expect(store.read(id(1))?.live).toMatchObject({
      sequence: 6,
      fragments: [
        { payload: { signal: "turn_end" } },
        { payload: { signal: "turn_start" } },
        { kind: "assistant.delta", payload: { text: "Toinen" } },
      ],
    });
  });
  it.each(["tail", "older", "reconnect", "failure"] as const)(
    "keeps streamed entries and later deltas when a %s read races them",
    async (mode) => {
      const agent = id(1);
      const instance = "11111111-1111-4111-8111-111111111111";
      let resolve!: (value: never) => void;
      let reject!: (error: Error) => void;
      const pending = () =>
        new Promise((yes, no) => {
          resolve = yes;
          reject = no;
        });
      const pager = {
        tail: pending,
        older: pending,
        reconnect: pending,
        cancelAll: vi.fn(),
      } as unknown as ConversationPager;
      const store = new ConversationStore("person", pager);
      store.view(agent, true);
      store.applyPage(agent, page(agent, ["b", "c"], "b"));
      store.setLive(agent, {
        cursor: `ev1:${instance}:0`,
        instance,
        sequence: 0,
        fragments: [],
        truncated: false,
      });
      const read =
        mode === "older"
          ? store.older(agent)
          : mode === "reconnect"
            ? store.reconnect(agent)
            : store.loadTail(agent);
      const send = (sequence: number, kind: string, payload: object) =>
        store.routeEvent({
          resource: { agent_id: agent },
          kind,
          payload,
          sequence,
          cursor: `ev1:${instance}:${sequence}`,
          server_instance_id: instance,
          event_id: `e${sequence}`,
        } as never);
      send(1, "assistant.delta", { text: "first" });
      send(2, "history.entry", {
        entry_key: "c",
        entry_kind: "assistant",
        content: { media_type: "text/plain", text: "new c", complete: true },
      });
      send(3, "history.entry", {
        entry_key: "d",
        entry_kind: "assistant",
        content: { media_type: "text/plain", text: "new d", complete: true },
      });
      send(4, "assistant.delta", { text: "next" });
      expect(store.read(agent)?.live).toMatchObject({
        sequence: 4,
        fragments: [{ payload: { text: "next" } }],
      });
      // The page was captured before either streamed entry arrived.
      const incoming = page(agent, mode === "older" ? ["a", "b"] : ["b", "c"]);
      if (mode === "failure") reject(new Error("offline"));
      else
        resolve(
          (mode === "reconnect"
            ? { pages: [incoming], met: true }
            : incoming) as never,
        );
      await read;
      expect(
        store.read(agent)?.entries.map((e) => [e.entry_key, e.content.text]),
      ).toEqual(
        mode === "older"
          ? [
              ["a", "a"],
              ["b", "b"],
              ["c", "new c"],
              ["d", "new d"],
            ]
          : [
              ["b", "b"],
              ["c", "new c"],
              ["d", "new d"],
            ],
      );
      expect(store.read(agent)?.live).toMatchObject({
        sequence: 4,
        fragments: [{ payload: { text: "next" } }],
      });
      expect(store.read(agent)?.state).toBe(
        mode === "failure" ? "stale" : "ready",
      );
    },
  );
  it.each([
    {
      name: "one overlapping page",
      pages: [["w", "x", "y", "s1"]],
      met: true,
      expected: ["w", "x", "y", "s1"],
    },
    {
      name: "disjoint bounded tail",
      pages: [["y23", "y24", "s1"]],
      met: false,
      next: "y23",
      expected: ["y23", "y24", "s1"],
    },
    {
      name: "multiple overlapping pages",
      pages: [
        ["y2", "y3", "s1"],
        ["x", "y1", "y2"],
      ],
      met: true,
      expected: ["w", "x", "y1", "y2", "y3", "s1"],
    },
  ])(
    "does not use a streamed append as a join witness: $name",
    async ({ pages, met, next, expected }) => {
      const agent = id(1);
      const instance = "11111111-1111-4111-8111-111111111111";
      let finish!: (value: { pages: HistoryPage[]; met: boolean }) => void;
      const pager = {
        reconnect: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
        cancelAll: vi.fn(),
      } as unknown as ConversationPager;
      const store = new ConversationStore("person", pager);
      store.view(agent, true);
      store.applyPage(agent, page(agent, ["w", "x"]));
      store.setLive(agent, {
        cursor: `ev1:${instance}:0`,
        instance,
        sequence: 0,
        fragments: [],
        truncated: false,
      });
      const read = store.reconnect(agent);
      store.routeEvent({
        resource: { agent_id: agent },
        kind: "history.entry",
        payload: {
          entry_key: "s1",
          entry_kind: "assistant",
          content: {
            media_type: "text/plain",
            text: "streamed",
            complete: true,
          },
        },
        sequence: 1,
        cursor: `ev1:${instance}:1`,
        server_instance_id: instance,
        event_id: "entry",
      } as never);
      // The native read also sees entries too large to have been streamed.
      // Its pages include s1, but s1 cannot prove continuity with w,x.
      finish({ pages: pages.map((keys) => page(agent, keys, next)), met });
      await read;
      expect(store.read(agent)).toMatchObject({
        state: "ready",
        live: { sequence: 1 },
      });
      expect(
        store.read(agent)?.entries.map((entry) => entry.entry_key),
      ).toEqual(expected);
      expect(store.read(agent)?.entries.at(-1)?.content.text).toBe("streamed");
      expect(store.read(agent)?.next).toBe(next);
    },
  );
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
    expect(store.read(agent)?.live?.sequence).toBe(4); // gap advances recovery immediately
    finishRecovery({
      pages: [page(agent, ["b", "c"]), page(agent, ["a", "b"])],
      met: true,
    });
    await flush();
    expect(store.read(agent)?.live?.sequence).toBe(4); // gap starts nested reconnect
    store.routeEvent(event(5) as never);
    expect(store.read(agent)?.live?.sequence).toBe(5); // contiguous text stays live during recovery
    finishRecovery({ pages: [page(agent, ["a", "b", "c"])], met: true });
    await flush();
    expect(store.read(agent)?.live?.sequence).toBe(5);
  });
  it("background text deltas notify only their window, not sidebar metadata", () => {
    vi.useFakeTimers();
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
    vi.advanceTimersByTime(16);
    expect(windowListener).toHaveBeenCalledTimes(1);
    expect(metadata).not.toHaveBeenCalled();
  });
  it("many live events in one task render the window once, with the newest value", () => {
    vi.useFakeTimers();
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
    const seen: (number | undefined)[] = [];
    store.subscribe(agent, () => seen.push(store.read(agent)?.live?.sequence));
    for (let sequence = 1; sequence <= 50; sequence++)
      store.routeEvent({
        resource: { agent_id: agent },
        kind: "assistant.delta",
        payload: { text: "x" },
        cursor: `ev1:11111111-1111-4111-8111-111111111111:${sequence}`,
        server_instance_id: "11111111-1111-4111-8111-111111111111",
        sequence,
        event_id: `delta${sequence}`,
      } as never);
    expect(store.read(agent)?.live?.sequence).toBe(50); // the value is current at once
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(16);
    expect(seen).toEqual([50]);
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
  it("keeps question attention while a send waits, until the question is resolved", () => {
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
      event("command.changed", 3, {
        client_command_id: "queued-send",
        acceptance: "pending",
        execution: "not_started",
      }) as never,
    );
    expect(store.readMetadata().attention.get(agent)).toBe("seen");
    store.routeEvent(
      event("question.resolved", 4, { request_id: "q1" }) as never,
    );
    expect(store.readMetadata().attention.has(agent)).toBe(false);
    store.dispose();
    expect(store.readMetadata().attention.size).toBe(0);
  });
});

describe("finished turns the person has not seen", () => {
  const agent = id(7);
  const at = (minute: number) =>
    `2026-11-02T09:${String(minute).padStart(2, "0")}:00.000Z`;
  const observation = (
    reply?: { id: string; minute: number },
    sequence = 100,
  ) =>
    ({
      identity: { web_identity_id: "replies" },
      event_cursor: `ev1:11111111-1111-4111-8111-111111111111:${sequence}`,
      captured_at: at(10),
      agents: [
        {
          agent_id: agent,
          history: "readable",
          last_reply: reply && { id: reply.id, at: at(reply.minute) },
        },
      ],
    }) as never;
  const tab = () => new ConversationStore("replies", setup().store["pager"]);
  const attention = (store: ConversationStore) =>
    store.readMetadata().attention.get(agent);

  it("asks again for every new reply however often the conversation was quiet, also after a reload", () => {
    localStorage.clear();
    let store = tab();
    // What had ended before this browser first looked is not news.
    store.applySnapshot(observation({ id: "r0", minute: 5 }));
    expect(attention(store)).toBeUndefined();
    for (const [n, reply] of ["r1", "r2"].entries()) {
      // The tab missed the turn's event: only the snapshot tells it.
      store.applySnapshot(observation({ id: reply, minute: 11 + n }));
      expect(attention(store)).toBe("new");
      store.setVisible(agent);
      expect(attention(store)).toBe("seen");
      store.setVisible(undefined);
      store.applySnapshot(observation({ id: reply, minute: 11 + n }));
      expect(attention(store)).toBe("seen");
      // A reload in this browser remembers what was seen.
      store.dispose();
      store = tab();
      store.applySnapshot(observation({ id: reply, minute: 11 + n }));
      expect(attention(store)).toBe("seen");
    }
    store.dispose();
  });

  it("keys a live turn by its reply, so the snapshot naming it later does not ask again", () => {
    localStorage.clear();
    const store = tab();
    store.applySnapshot(observation());
    store.routeEvent({
      resource: { agent_id: agent },
      kind: "turn.settled",
      payload: { state: "settled", native_key: "r1" },
      cursor: "ev1:11111111-1111-4111-8111-111111111111:2",
      server_instance_id: "11111111-1111-4111-8111-111111111111",
      sequence: 2,
      event_id: "evt-2",
    } as never);
    expect(attention(store)).toBe("new");
    store.setVisible(agent);
    store.setVisible(undefined);
    store.applySnapshot(observation({ id: "r1", minute: 11 }));
    expect(attention(store)).toBe("seen");
    store.applySnapshot(observation({ id: "r2", minute: 12 }));
    expect(attention(store)).toBe("new");
    store.dispose();
  });

  it("remembers a turn seen ending through a status read, when its event comes too late", () => {
    localStorage.clear();
    let store = tab();
    store.applySnapshot(observation());
    store.setVisible(agent);
    // The stream had not brought turn.settled yet when the person left.
    store.applyStatus(agent, {
      agent_id: agent,
      state: "idle",
      journal_cursor: "ev1:11111111-1111-4111-8111-111111111111:101",
      turn_settled: { state: "settled", observed_at: at(11), native_key: "r1" },
    } as never);
    store.dispose();
    store = tab();
    store.applySnapshot(observation({ id: "r1", minute: 11 }, 102));
    expect(attention(store)).toBe("seen");
    store.dispose();
  });

  it("keeps a reply a status named over an older turn a lagging stream brings later", () => {
    localStorage.clear();
    let store = tab();
    store.applySnapshot(observation());
    store.setVisible(agent);
    store.applyStatus(agent, {
      agent_id: agent,
      state: "idle",
      journal_cursor: "ev1:11111111-1111-4111-8111-111111111111:120",
      turn_settled: { state: "settled", observed_at: at(12), native_key: "r2" },
    } as never);
    store.routeEvent({
      resource: { agent_id: agent },
      kind: "turn.settled",
      payload: { state: "settled", native_key: "r1" },
      cursor: "ev1:11111111-1111-4111-8111-111111111111:110",
      server_instance_id: "11111111-1111-4111-8111-111111111111",
      sequence: 110,
      event_id: "evt-110",
    } as never);
    store.dispose();
    store = tab();
    store.applySnapshot(observation({ id: "r2", minute: 12 }, 121));
    expect(attention(store)).toBe("seen");
    store.dispose();
  });

  const settled = (reply: string, sequence: number) =>
    ({
      resource: { agent_id: agent },
      kind: "turn.settled",
      payload: { state: "settled", native_key: reply },
      cursor: `ev1:11111111-1111-4111-8111-111111111111:${sequence}`,
      server_instance_id: "11111111-1111-4111-8111-111111111111",
      sequence,
      event_id: `evt-${sequence}`,
    }) as never;
  const told = () =>
    window.dispatchEvent(
      new StorageEvent("storage", { key: "oh.replies.seen.replies" }),
    );

  it("does not ask for a reply another tab showed before this tab heard of it, nor forget a newer one", () => {
    localStorage.clear();
    const shown = tab();
    const other = tab();
    shown.applySnapshot(observation());
    other.applySnapshot(observation());
    shown.setVisible(agent);
    shown.routeEvent(settled("r1", 2));
    told();
    // This tab's own event arrives after the other tab's write.
    other.routeEvent(settled("r1", 2));
    expect(attention(other)).toBe("seen");
    // The other tab, keyed by r1, learns of r2 only as seen; opening it
    // there must not mark r1 as the newest seen.
    shown.routeEvent(settled("r2", 3));
    told();
    other.applySnapshot(observation({ id: "r2", minute: 12 }));
    other.setVisible(agent);
    other.dispose();
    const reloaded = tab();
    reloaded.applySnapshot(observation({ id: "r2", minute: 12 }));
    expect(attention(reloaded)).toBe("seen");
    shown.dispose();
    reloaded.dispose();
  });

  it("does not let a snapshot taken before a seen turn name an older reply", () => {
    localStorage.clear();
    const store = tab();
    store.applySnapshot(observation());
    store.setVisible(agent);
    store.routeEvent(settled("r1", 2));
    store.routeEvent(settled("r2", 3));
    store.setVisible(undefined);
    // Captured at sequence 1, before both turns settled.
    store.applySnapshot(observation({ id: "r1", minute: 11 }, 1));
    expect(attention(store)).toBe("seen");
    store.dispose();
  });

  it("stops asking in another tab once the reply is seen in one", () => {
    localStorage.clear();
    const shown = tab();
    const other = tab();
    shown.applySnapshot(observation());
    other.applySnapshot(observation({ id: "r1", minute: 11 }));
    expect(attention(other)).toBe("new");
    shown.setVisible(agent);
    shown.applySnapshot(observation({ id: "r1", minute: 11 }));
    expect(attention(shown)).toBe("seen");
    // The browser tells other tabs of a storage write; jsdom does not.
    window.dispatchEvent(
      new StorageEvent("storage", { key: "oh.replies.seen.replies" }),
    );
    expect(attention(other)).toBe("seen");
    shown.dispose();
    other.dispose();
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

it("keeps transient notices conversation- and identity-scoped, never native history", () => {
  const { store } = setup();
  const notice = {
    notice_id: "22222222-2222-4222-8222-222222222222",
    origin: "agent",
    timestamp: "2026-10-21T10:00:00Z",
    text: "private synthetic blocker",
    persistence: "not_persisted",
  };
  store.routeEvent({
    kind: "notice.created",
    resource: { agent_id: id(1) },
    payload: { notice },
    server_instance_id: "i",
    sequence: 1,
    cursor: "c",
  } as never);
  expect(store.readNotices(id(1))).toEqual([notice]);
  expect(store.readNotices(id(2))).toEqual([]);
  expect(new ConversationStore("another-person").readNotices(id(1))).toEqual(
    [],
  );
  expect(store.read(id(1))).toBeUndefined();
  store.routeEvent({
    kind: "history.entry",
    resource: { agent_id: id(1) },
    payload: { notice: { ...notice, persistence: "persisted" } },
    server_instance_id: "i",
    sequence: 2,
    cursor: "c2",
  } as never);
  expect(store.readNotices(id(1))).toEqual([]);
  store.dispose();
  expect(store.readNotices(id(1))).toEqual([]);
});

it("a native page replaces an uncertain notice and wins over a late uncertain event", () => {
  const { store } = setup();
  const agent = id(1);
  const notice = {
    notice_id: "22222222-2222-4222-8222-222222222222",
    origin: "agent" as const,
    timestamp: "2026-10-21T10:00:00Z",
    text: "synthetic blocker",
    persistence: "unknown" as const,
  };
  const event = {
    kind: "notice.created",
    resource: { agent_id: agent },
    payload: { notice },
    server_instance_id: "i",
    sequence: 1,
    cursor: "c",
  };
  store.routeEvent(event as never);
  store.view(agent, true);
  const native = page(agent, ["n"]);
  native.entries[0].notice = { ...notice, persistence: "persisted" };
  store.applyPage(agent, native);
  expect(store.readNotices(agent)).toEqual([]);
  expect(store.read(agent)?.entries[0].notice?.persistence).toBe("persisted");
  store.routeEvent({ ...event, sequence: 2, cursor: "c2" } as never);
  expect(store.readNotices(agent)).toEqual([]);
  store.dispose();
});

describe("status reads that come back in either order", () => {
  const agent = id(3);
  const life = "11111111-1111-4111-8111-111111111111";
  const next = "22222222-2222-4222-8222-222222222222";
  const read = (state: string, sequence: number, instance = life) =>
    ({
      agent_id: agent,
      state,
      run_active: state === "accepted",
      journal_cursor: `ev1:${instance}:${sequence}`,
    }) as never;
  // A read taken while the turn ran and one taken after it ended, applied
  // in each order: the conversation always ends idle.
  for (const order of [
    ["working", "ended"],
    ["ended", "working"],
  ] as const)
    it(`keeps the newest read when they land ${order.join(" then ")}`, () => {
      const { store } = setup();
      const reads = { working: read("accepted", 5), ended: read("idle", 9) };
      expect(store.applyStatus(agent, reads[order[0]])).toBe(true);
      expect(store.applyStatus(agent, reads[order[1]])).toBe(
        order[1] === "ended",
      );
      expect(store.status(agent)?.state).toBe("idle");
      store.dispose();
    });

  it("lets the view's own read, taken before the turn ended, not bring back Stop", async () => {
    // The tab's background read and the view's refresh both read status;
    // the refresh began while the turn ran and lands after the background
    // read that saw it end.
    let finish!: (value: never) => void;
    const statusReader = vi.fn(
      () =>
        new Promise<never>((resolve) => {
          finish = resolve;
        }),
    );
    const pager = setup().store["pager"];
    const store = new ConversationStore("person", pager, 50, statusReader);
    store.applyStatus(agent, read("accepted", 4));
    store.routeEvent({
      resource: { agent_id: agent },
      kind: "turn.settled",
      payload: {},
      cursor: `ev1:${life}:8`,
      server_instance_id: life,
      sequence: 8,
      event_id: "settled",
    } as never);
    finish(read("idle", 8));
    await flush();
    expect(store.status(agent)?.state).toBe("idle");
    store.applyStatus(agent, read("accepted", 6)); // the refresh's late read
    expect(store.status(agent)?.state).toBe("idle");
    expect(store.statusStale(agent)).toBe(false);
    store.dispose();
  });

  it("takes a restarted daemon's first read and, once the stream moved on, drops a late one from before", () => {
    const { store } = setup();
    store.applyStatus(agent, read("accepted", 40));
    // A new life starts its journal again: its first read is newer.
    expect(store.applyStatus(agent, read("stopped", 0, next))).toBe(true);
    store.routeEvent({
      resource: { scope: "user" },
      kind: "snapshot.invalidated",
      payload: {},
      cursor: `ev1:${life}:41`,
      server_instance_id: life,
      sequence: 41,
      event_id: "old",
    } as never);
    store.routeEvent({
      resource: { scope: "user" },
      kind: "snapshot.invalidated",
      payload: {},
      cursor: `ev1:${next}:1`,
      server_instance_id: next,
      sequence: 1,
      event_id: "new",
    } as never);
    expect(store.applyStatus(agent, read("accepted", 42))).toBe(false);
    expect(store.status(agent)?.state).toBe("stopped");
    store.dispose();
  });
});
