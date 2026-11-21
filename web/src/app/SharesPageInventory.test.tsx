import { fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { SharesPage } from "./SharesPage";
import { resetViewLinks } from "./viewLinks";

const id = `v${"a".repeat(26)}`;
const view = {
  view_id: id,
  title: "Synthetic private output",
  entry: "index.html",
  files: 1,
  bytes: 12,
  created_at: "2026-01-01T00:00:00Z",
};
const address = {
  address_id: `a${"b".repeat(26)}`,
  view_id: id,
  title: view.title,
  url: `https://${window.location.host}/n/${"A".repeat(43)}`,
  content_url: `https://oh-view-${"a".repeat(52)}.example.invalid/${"A".repeat(43)}/`,
  state: "public",
  created_at: view.created_at,
  public_until: "2999-01-01T00:00:00Z",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function open() {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  return render(
    <MemoryRouter initialEntries={["/shares"]}>
      <SharesPage snapshot={{ agents: [], workspaces: [] }} csrf="csrf" />
    </MemoryRouter>,
  );
}
afterEach(() => {
  vi.unstubAllGlobals();
  resetViewLinks();
});

it("does not claim private when the first address inventory fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/v1/file-offers")
        return json({ schema_version: 1, offers: [] });
      if (url.startsWith("/api/v1/views"))
        return json({ schema_version: 1, views: [view] });
      return json({}, 503);
    }),
  );
  const page = open();
  await page.findByRole("alert");
  expect(page.queryByTestId("shares-row")).toBeNull();
});

it("keeps a newly shared native output's address when view refresh fails", async () => {
  let shared = false;
  const writes: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/v1/file-offers")
        return json({ schema_version: 1, offers: [] });
      if (url === "/api/v1/view-addresses" && !init?.method)
        return json({
          schema_version: 1,
          max_days: 30,
          addresses: shared ? [address] : [],
        });
      if (url.startsWith("/api/v1/views"))
        return shared
          ? json({}, 503)
          : json({ schema_version: 1, views: [view] });
      if (url === "/auth/view") return json({}, 503);
      if (init?.method === "POST") {
        writes.push(url);
        if (url.endsWith("/publish")) shared = true;
        return json({
          schema_version: 1,
          address: {
            ...address,
            state: shared ? "public" : "private",
            public_until: shared ? address.public_until : undefined,
          },
        });
      }
      throw new Error(`unexpected ${url}`);
    }),
  );
  const page = open();
  await page.findByTestId("view-public");
  expect(writes).toEqual([]);
  fireEvent.click(page.getByTestId("view-public"));
  await page.findByTestId("shares-copy");
  await waitFor(() =>
    expect(writes).toEqual([
      "/api/v1/view-addresses",
      "/api/v1/view-addresses/publish",
    ]),
  );
  expect(page.getAllByTestId("shares-row")).toHaveLength(1);
});
