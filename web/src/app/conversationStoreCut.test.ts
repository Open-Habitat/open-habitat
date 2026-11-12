import { describe, expect, it, vi } from "vitest";
import type { ConversationPager } from "./conversationPager";
import { ConversationStore } from "./conversationStore";
import type { HistoryPage } from "./history";

const entry = (key: string) =>
  ({
    entry_key: key,
    kind: "user",
    content: { media_type: "text/plain", text: key, complete: true },
  }) as unknown as HistoryPage["entries"][number];

// A cut record behind a readable tail is met only when scrolling back; the
// window must still say storage cut it, not plain unavailable.
describe("a history a full quota cut", () => {
  it("is named when an older page meets it", async () => {
    const pager = {
      tail: vi.fn(
        async (): Promise<HistoryPage> =>
          ({
            schema_version: 1,
            agent_id: "pi:a",
            native_revision: "r",
            entries: [entry("b"), entry("c")],
            older_complete: false,
            boundary_found: true,
            next_before: "b",
          }) as unknown as HistoryPage,
      ),
      older: vi.fn(async () => {
        throw new Error("history_cut");
      }),
      reconnect: vi.fn(),
      cancelAll: vi.fn(),
    } as unknown as ConversationPager;
    const store = new ConversationStore(
      "person",
      pager,
      50,
      () => new Promise(() => {}),
    );
    store.view("pi:a");
    await vi.waitFor(() => expect(store.read("pi:a")?.state).toBe("ready"));
    await store.older("pi:a");
    expect(store.read("pi:a")?.historyCut).toBe(true);
    expect(store.read("pi:a")?.state).toBe("stale");
    store.dispose();
  });
});
