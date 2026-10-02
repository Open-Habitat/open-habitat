import { describe, expect, it, vi } from "vitest";
import type { ConversationPager } from "./conversationPager";
import { ConversationStore } from "./conversationStore";
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
      reconnect: vi
        .fn()
        .mockResolvedValue({
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
});
