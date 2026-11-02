import { expect, it, vi } from "vitest";
import type { ConversationPager } from "../app/conversationPager";
import { ConversationStore } from "../app/conversationStore";
import type { HistoryPage } from "../app/history";
import { controlledTransport } from "./controlledTransport";

it.each([
  ["reply", "dispose"],
  ["dispose", "reply"],
])(
  "disposed identity stays empty in order %s then %s",
  async (first, second) => {
    const transport = controlledTransport();
    const agent = "pi:00000001-1111-4111-8111-111111111111";
    const page: HistoryPage = {
      schema_version: 1,
      agent_id: agent,
      native_revision: "old",
      boundary_found: true,
      older_complete: true,
      entries: [
        {
          entry_key: "old",
          kind: "assistant",
          content: { media_type: "text/plain", text: "old", complete: true },
        },
      ],
    };
    const pager = {
      tail: () => transport.reply("reply", page),
      older: vi.fn(),
      reconnect: vi.fn(),
      cancelAll: vi.fn(),
    } as unknown as ConversationPager;
    const store = new ConversationStore("synthetic-person", pager);
    try {
      store.view(agent);
      transport.event("dispose", () => store.dispose());
      await transport.deliver(first);
      await transport.deliver(second);
      transport.assertDrained();
      expect(store.read(agent)).toBeUndefined();
    } finally {
      store.dispose();
    }
  },
);
