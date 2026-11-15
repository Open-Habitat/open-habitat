import { renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { HistoryEntry } from "./history";
import { type SearchJump, useJumpToHit } from "./searchJump";

const jump: SearchJump = {
  agentId: "pi:a",
  entryKey: "old",
  query: "kartta",
  terms: ["kart"],
  role: "user",
  at: "2026-11-15T10:00:00Z",
  serial: 1,
};
const entries: HistoryEntry[] = [
  {
    entry_key: "new",
    kind: "user",
    content: { media_type: "text/plain", text: "x", complete: true },
  },
];

it("gives up when reading older pages changes nothing, instead of searching forever", async () => {
  // The store's older() resolves even when its read failed.
  const older = vi.fn(async () => {});
  const feed = { current: document.createElement("div") };
  const { result } = renderHook(() =>
    useJumpToHit({
      jump,
      entries,
      next: "cursor",
      older,
      feed,
      hold: () => {},
    }),
  );
  expect(result.current).toBe("searching");
  await waitFor(() => expect(result.current).toBe("missing"), {
    timeout: 3000,
  });
  expect(older.mock.calls.length).toBeLessThanOrEqual(4);
});

it("says missing when the whole history is read without the hit", () => {
  const feed = { current: document.createElement("div") };
  const { result } = renderHook(() =>
    useJumpToHit({
      jump,
      entries,
      next: undefined,
      older: async () => {},
      feed,
      hold: () => {},
    }),
  );
  expect(result.current).toBe("missing");
});
