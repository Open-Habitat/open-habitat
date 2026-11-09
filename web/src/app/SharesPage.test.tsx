import { fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { SharesPage } from "./SharesPage";
import { resetViewLinks } from "./viewLinks";

const id = `v${"a".repeat(26)}`;
const address = {
  address_id: `a${"b".repeat(26)}`,
  view_id: id,
  title: "Synthetic export",
  url: `https://${window.location.host}/n/${"A".repeat(43)}`,
  content_url: `https://oh-view-${"a".repeat(52)}.example.invalid/${"A".repeat(43)}/`,
  state: "public",
  created_at: "2026-01-01T00:00:00Z",
  public_until: "2999-01-01T00:00:00Z",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
afterEach(() => {
  vi.unstubAllGlobals();
  resetViewLinks();
});
it("retains the non-destructive private action while site sharing is paused", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  const writes: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/v1/view-addresses")
        return json({ schema_version: 1, max_days: 0, addresses: [address] });
      if (url.startsWith("/api/v1/views"))
        return json({
          schema_version: 1,
          views: [
            {
              view_id: id,
              title: address.title,
              entry: "index.html",
              files: 1,
              bytes: 12,
              created_at: address.created_at,
            },
          ],
        });
      if (url === "/auth/view") return new Response(null, { status: 503 });
      if (init?.method) {
        writes.push(url);
        return json({ error: { code: "view_publications_limited" } }, 409);
      }
      throw new Error(`unexpected ${url}`);
    }),
  );
  const page = render(
    <MemoryRouter initialEntries={["/shares"]}>
      <SharesPage snapshot={{ agents: [], workspaces: [] }} csrf="csrf" />
    </MemoryRouter>,
  );
  await page.findByTestId("view-address-private");
  expect(page.queryByTestId("shares-copy")).toBeNull();
  fireEvent.click(page.getByTestId("view-address-private"));
  await waitFor(() =>
    expect(writes).toEqual(["/api/v1/view-addresses/private"]),
  );
  await page.findByRole("alert");
  // A failed write leaves the address in place; it never substitutes delete.
  expect(page.getAllByTestId("shares-row")).toHaveLength(1);
});
