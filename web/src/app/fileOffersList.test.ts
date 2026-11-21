import { afterEach, expect, it, vi } from "vitest";
import fixture from "../../../contracts/v1/examples/file-offers.json";
import { listFileOffers } from "./fileOffers";

afterEach(() => vi.unstubAllGlobals());
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });

it("reads every native output page without creating addresses", async () => {
  const first = fixture.offers[0];
  const second = { ...first, offer_id: `f${"z".repeat(26)}` };
  const cursor = `${first.created_at}_${first.offer_id}`;
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    expect(init?.method).toBeUndefined();
    if (url === "/api/v1/file-offers")
      return json({ schema_version: 1, offers: [first], next_cursor: cursor });
    expect(url).toBe(`/api/v1/file-offers?${new URLSearchParams({ cursor })}`);
    return json({ schema_version: 1, offers: [second] });
  });
  vi.stubGlobal("fetch", fetch);
  expect(await listFileOffers()).toEqual([first, second]);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("refuses a repeated page cursor instead of looping or claiming a complete inventory", async () => {
  const first = fixture.offers[0];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      json({
        schema_version: 1,
        offers: [first],
        next_cursor: `${first.created_at}_${first.offer_id}`,
      }),
    ),
  );
  await expect(listFileOffers()).rejects.toThrow("repeated offer cursor");
});
