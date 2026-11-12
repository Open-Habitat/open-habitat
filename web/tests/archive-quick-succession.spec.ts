import type { Route } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});

const ids = [1, 2, 3].map(
  (n) => `pi:33333333-3333-4333-8333-${String(n).padStart(12, "0")}`,
);

// Jari 12.11.2026: archiving conversations one after another showed "Toinen
// muutos oli juuri kesken" and put a conversation back. The daemon now
// queues archives behind each other; the person sees no error card.
test("three conversations archived in quick succession all archive without an error card", async ({
  page,
}) => {
  expect(
    (await page.request.get("/fixture/history?mode=several")).status(),
  ).toBe(204);
  await page.goto("/");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  const rows = ids.map((id) =>
    page.getByRole("navigation").getByTestId(`agent-item-${id}`),
  );
  for (const row of rows) await expect(row).toBeVisible();

  // Hold each archive at the browser until all three are sent, then let
  // them reach the daemon together: they meet there, as rapid clicks do.
  const held: Route[] = [];
  let releaseAll: () => void = () => {};
  const allHeld = new Promise<void>((resolve) => {
    releaseAll = resolve;
  });
  const statuses: number[] = [];
  page.on("response", (response) => {
    const request = response.request();
    if (
      request.method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/workspaces" &&
      request.postDataJSON()?.action === "conversation_archive"
    )
      statuses.push(response.status());
  });
  await page.route("**/api/v1/workspaces", async (route) => {
    if (route.request().postDataJSON()?.action !== "conversation_archive")
      return route.continue();
    held.push(route);
    if (held.length === ids.length) releaseAll();
    await allHeld;
    await route.continue();
  });

  for (const row of rows) {
    await row.hover();
    const archive = row
      .getByRole("button")
      .and(page.getByTestId("rail-archive-conversation"));
    await expect(archive).toBeEnabled();
    await archive.click();
  }
  for (const row of rows) await expect(row).toBeHidden();
  await expect.poll(() => statuses.length).toBe(ids.length);
  // No refusal reached the browser at all, retried or shown.
  expect(statuses).toEqual([200, 200, 200]);
  await expect(page.getByTestId("archive-error")).toHaveCount(0);

  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  for (const id of ids) {
    const agent = snapshot.agents.find(
      (entry: { agent_id: string }) => entry.agent_id === id,
    );
    expect(agent?.archive, id).toBe("archived");
  }
});
