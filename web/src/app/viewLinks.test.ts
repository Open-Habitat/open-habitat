import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensureViewAddress,
  publicAddress,
  publishViewAddress,
  refreshViewLinks,
  resetViewLinks,
  useViewLinks,
  type ViewLinkState,
} from "./viewLinks";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
const here = window.location.host;
const address = (id: string, state = "private") => ({
  address_id: `a${id.repeat(26)}`,
  view_id: `v${id.repeat(26)}`,
  title: "Näkymä",
  url: `https://${here}/n/${id.toUpperCase().repeat(43)}`,
  content_url: `https://oh-view-${"a".repeat(52)}.example.invalid/${id.toUpperCase().repeat(43)}/`,
  state,
  created_at: "2026-10-29T12:00:00Z",
  ...(state === "private" ? {} : { public_until: "2999-11-28T12:00:00Z" }),
});

async function seen(): Promise<ViewLinkState> {
  let value: ViewLinkState;
  const { renderHook } = await import("@testing-library/react");
  renderHook(() => {
    value = useViewLinks();
  });
  // biome-ignore lint/style/noNonNullAssertion: assigned by the render above.
  return value!;
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetViewLinks();
});

describe("view address store", () => {
  it("never lets a previous person's reply into the next person's addresses", async () => {
    let finish: (r: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/v1/view-addresses" && init?.method === "POST")
          return new Promise<Response>((resolve) => {
            finish = resolve;
          });
        return json({ schema_version: 1, max_days: 90, addresses: [] });
      }),
    );
    await refreshViewLinks();
    const pending = ensureViewAddress("csrf", address("a").view_id);
    // Another person signs in before the old write answers.
    resetViewLinks();
    await refreshViewLinks();
    finish(json({ schema_version: 1, address: address("a") }));
    await pending;
    expect(await seen()).toEqual({ maxDays: 90, addresses: [] });
  });

  it("publishes the view's one address and shows it as shared", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/v1/view-addresses" && init?.method === "POST")
          return json({ schema_version: 1, address: address("b") });
        if (url === "/api/v1/view-addresses/publish")
          return json({ schema_version: 1, address: address("b", "public") });
        return json({ schema_version: 1, max_days: 90, addresses: [] });
      }),
    );
    await refreshViewLinks();
    const reserved = await ensureViewAddress("csrf", address("b").view_id);
    expect(publicAddress(await seen(), reserved.view_id)).toBeUndefined();
    const published = await publishViewAddress("csrf", reserved.address_id, 7);
    expect(published.url).toBe(reserved.url);
    expect(publicAddress(await seen(), reserved.view_id)?.state).toBe("public");
  });

  it("refuses an entry address on another host or content on this one", async () => {
    for (const bad of [
      { ...address("c"), url: `https://elsewhere.invalid/n/${"C".repeat(43)}` },
      { ...address("c"), content_url: `https://${here}/${"C".repeat(43)}/` },
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          json({ schema_version: 1, max_days: 90, addresses: [bad] }),
        ),
      );
      resetViewLinks();
      await expect(refreshViewLinks()).rejects.toThrow();
      expect(await seen()).toBe("unavailable");
    }
  });

  it("keeps a vanished address out of the list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/v1/view-addresses/publish")
          return json(
            { schema_version: 1, error: { code: "view_address_not_found" } },
            404,
          );
        return json({
          schema_version: 1,
          max_days: 90,
          addresses: [address("d")],
        });
      }),
    );
    await refreshViewLinks();
    await expect(
      publishViewAddress("csrf", address("d").address_id, 7),
    ).rejects.toThrow();
    expect(await seen()).toEqual({ maxDays: 90, addresses: [] });
  });
});
