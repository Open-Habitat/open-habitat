import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationPager } from "./conversationPager";

const id = "pi:11111111-1111-4111-8111-111111111111";
function page(
  keys: string[],
  older_complete: boolean,
  next_before?: string,
  boundary_found = true,
) {
  return new Response(
    JSON.stringify({
      schema_version: 1,
      agent_id: id,
      native_revision: "hash",
      older_complete,
      boundary_found,
      entries: keys.map((entry_key) => ({
        entry_key,
        kind: "user",
        content: { media_type: "text/plain", text: entry_key, complete: true },
      })),
      ...(next_before ? { next_before } : {}),
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}
afterEach(() => vi.unstubAllGlobals());
describe("conversation pager", () => {
  it("reads backwards only until the first held key", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(page(["c", "d"], false, "c"))
      .mockResolvedValueOnce(page(["a", "b", "c"], true));
    vi.stubGlobal("fetch", fetch);
    const result = await new ConversationPager().reconnect(
      id,
      new Set(["a"]),
      3,
    );
    expect(result.met).toBe(true);
    expect(result.pages.map((p) => p.entries.map((e) => e.entry_key))).toEqual([
      ["c", "d"],
      ["a", "b", "c"],
    ]);
    expect(fetch.mock.calls[1][0]).toContain("before=c");
    // Pages count messages, not tool entries (Jari 2.11.2026).
    for (const [url] of fetch.mock.calls)
      expect(new URL(url, "https://host").searchParams.get("messages")).toBe(
        "100",
      );
  });
  it("bounds recovery and reloads tail when the boundary disappears", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(page(["c"], false, "c"))
      .mockResolvedValueOnce(page([], false, undefined, false))
      .mockResolvedValueOnce(page(["new"], true));
    vi.stubGlobal("fetch", fetch);
    const result = await new ConversationPager().reconnect(
      id,
      new Set(["a"]),
      3,
    );
    expect(result).toMatchObject({
      met: false,
      pages: [{ entries: [{ entry_key: "new" }] }],
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("cancels outstanding requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      ),
    );
    const pager = new ConversationPager();
    const request = pager.tail(id);
    pager.cancelAll();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
  it("spares the reads of conversations it is told to keep", async () => {
    const other = "pi:22222222-2222-4222-8222-222222222222";
    const signals = new Map<string, AbortSignal>();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init: RequestInit) => {
        signals.set(
          url.includes(other) ? other : id,
          init.signal as AbortSignal,
        );
        return new Promise(() => {});
      }),
    );
    const pager = new ConversationPager();
    void pager.tail(id).catch(() => {});
    void pager.tail(other).catch(() => {});
    pager.cancelAll(new Set([id]));
    expect(signals.get(id)?.aborted).toBe(false);
    expect(signals.get(other)?.aborted).toBe(true);
    // A kept read is still cancelled by the next cancellation that does not keep it.
    pager.cancelAll();
    expect(signals.get(id)?.aborted).toBe(true);
  });
});
