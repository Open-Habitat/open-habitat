import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewLinkSettings } from "./ViewLinkSettings";
import { resetViewLinks } from "./viewLinks";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
const here = window.location.host;
const address = (id: string, state: string, until?: string) => ({
  address_id: `a${id.repeat(26)}`,
  view_id: `v${id.repeat(26)}`,
  title: `Näkymä ${id}`,
  url: `https://${here}/n/${id.toUpperCase().repeat(43)}`,
  content_url: `https://oh-view-${"a".repeat(52)}.example.invalid/${id.toUpperCase().repeat(43)}/`,
  state,
  created_at: "2026-10-29T12:00:00Z",
  ...(until ? { public_until: until } : {}),
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetViewLinks();
});

describe("the person's view addresses in Settings", () => {
  it("lists every address and deletes one for good, also while the site shares nothing", async () => {
    const rows = [
      address("b", "private"),
      address("c", "expired", "2026-10-30T12:00:00Z"),
      address("d", "public", "2999-11-28T12:00:00Z"),
    ];
    const writes: [string, unknown][] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (!init?.method)
          return json({ schema_version: 1, max_days: 0, addresses: rows });
        writes.push([url, JSON.parse(String(init.body))]);
        return new Response(null, { status: 204 });
      }),
    );
    const page = render(<ViewLinkSettings csrf="csrf" />);
    await waitFor(() =>
      expect(page.getAllByTestId("view-address-row")).toHaveLength(3),
    );
    // A paused publication offers no link to copy.
    expect(page.queryByTestId("view-address-copy")).toBeNull();
    const row = page
      .getAllByTestId("view-address-row")
      .find((r) => r.dataset.addressId === rows[0].address_id);
    if (!row) throw new Error("row missing");
    fireEvent.click(
      row.querySelector('[data-testid="view-address-remove"]') as HTMLElement,
    );
    // Nothing is deleted before the person confirms.
    await page.findByTestId("view-address-remove-dialog");
    expect(writes).toEqual([]);
    fireEvent.click(page.getByTestId("view-address-remove-confirm"));
    await waitFor(() =>
      expect(page.getAllByTestId("view-address-row")).toHaveLength(2),
    );
    expect(writes).toEqual([
      ["/api/v1/view-addresses/delete", { address_id: rows[0].address_id }],
    ]);
  });
});
