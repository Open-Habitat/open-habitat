import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createViewLink,
  refreshViewLinks,
  resetViewLinks,
  useViewLinks,
} from "./viewLinks";

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}
const link = (id: string) => ({
  link_id: `l${id.repeat(26)}`,
  view_id: `v${id.repeat(26)}`,
  title: "Näkymä",
  url: `https://oh-view-${"a".repeat(52)}.example.invalid/${id.toUpperCase().repeat(43)}/`,
  created_at: "2026-10-29T12:00:00Z",
  expires_at: "2026-11-28T12:00:00Z",
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetViewLinks();
});

describe("view link store", () => {
  it("never lets a previous person's reply into the next person's links", async () => {
    let finish: (r: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/v1/view-links" && init?.method === "POST")
          return new Promise<Response>((resolve) => {
            finish = resolve;
          });
        return json({ schema_version: 1, max_days: 90, links: [] });
      }),
    );
    await refreshViewLinks();
    const pending = createViewLink("csrf", link("a").view_id, 7);
    // Another person signs in before the old write answers.
    resetViewLinks();
    await refreshViewLinks();
    finish(json({ schema_version: 1, link: link("a") }));
    await pending;
    let seen: unknown;
    const { renderHook } = await import("@testing-library/react");
    renderHook(() => {
      seen = useViewLinks();
    });
    expect(seen).toEqual({ maxDays: 90, links: [] });
  });
});
