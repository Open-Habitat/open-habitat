import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

async function settings(page: Page) {
  await page.goto("/settings");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await page.goto("/settings");
}

test("server name saves in place, refreshes the mounted rail without navigation; a refused save keeps the typed text", async ({
  page,
}) => {
  await settings(page);
  await page
    .getByRole("link")
    .and(page.getByTestId("settings-palvelin"))
    .click();
  const nav = page
    .getByRole("navigation")
    .and(page.getByTestId("workspace-navigation"));
  const original = (await (await page.request.get("/api/v1/server")).json())
    .name;
  await expect(nav.getByTestId("server-home")).toHaveText(original);
  await expect(nav.getByTestId("server-home")).toBeVisible();
  const field = page.getByTestId("server-name-input");
  await expect(
    page.getByTestId("inline-setting").getByRole("button"),
  ).toHaveCount(0);
  await field.fill("Synteettinen uusi nimi");
  await page.route("**/api/v1/server/administration", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({ status: 503 })
      : route.continue(),
  );
  // Leaving the field saves; a refused save keeps the typed text and says so.
  await field.blur();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(field).toHaveValue("Synteettinen uusi nimi");
  await expect(nav.getByTestId("server-home")).toHaveText(original);
  await expect(nav.getByTestId("server-home")).toBeVisible();
  await page.unroute("**/api/v1/server/administration");
  let navigations = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest()) navigations++;
  });
  await field.focus();
  await field.press("Enter");
  await expect(page.getByTestId("inline-setting-status")).toHaveAttribute(
    "data-state",
    "saved",
  );
  await expect(page.getByTestId("inline-setting-status")).toBeVisible();
  await expect(nav.getByTestId("server-home")).toHaveText(
    "Synteettinen uusi nimi",
  );
  await expect(nav.getByTestId("server-home")).toBeVisible();
  expect(navigations).toBe(0);
  expect((await (await page.request.get("/api/v1/server")).json()).name).toBe(
    "Synteettinen uusi nimi",
  );
});

test("user storage stays on one line and fits desktop and phone, including limit editing", async ({
  page,
}) => {
  await page.route("**/api/v1/server/storage", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    for (const user of json.users) user.usage_bytes = 164280402;
    await route.fulfill({ response, json });
  });
  await page.route("**/api/v1/server/administration", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.users[0].username = "synthetic-admin";
    await route.fulfill({ response, json });
  });
  await settings(page);
  await page.getByRole("link").and(page.getByTestId("settings-levy")).click();
  const row = page
    .getByRole("row")
    .and(page.getByTestId("administration-user-synthetic-admin"));
  const storage = row.getByRole("cell").nth(1);
  await expect(storage).toBeVisible();
  await expect(storage).not.toBeEmpty();
  for (const width of [1280, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    // Measure rendered text fragments, not a particular CSS rule or element.
    const layout = await storage.evaluate((cell) => {
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      const tops: number[] = [];
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        for (const rect of range.getClientRects())
          tops.push(Math.round(rect.top));
      }
      const rect = cell.getBoundingClientRect();
      const card = cell.closest(".s-card")?.getBoundingClientRect();
      if (!card) throw new Error("Missing storage card");
      return {
        lines: new Set(tops).size,
        left: rect.left,
        right: rect.right,
        cardRight: card.right,
      };
    });
    expect(layout.lines, `storage text at ${width}px`).toBe(1);
    expect(layout.left).toBeGreaterThanOrEqual(0);
    expect(layout.right).toBeLessThanOrEqual(width);
    expect(layout.right).toBeLessThanOrEqual(layout.cardRight + 1);
    for (const button of await row.getByRole("button").all()) {
      const rect = await button.boundingBox();
      expect(rect).not.toBeNull();
      expect((rect?.x ?? 0) + (rect?.width ?? 0)).toBeLessThanOrEqual(
        layout.cardRight + 1,
      );
    }
    await row
      .getByRole("button")
      .and(row.getByTestId("storage-limit-edit"))
      .click();
    await expect(row.getByTestId("storage-limit-input")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await row.getByRole("button").and(row.getByTestId("cancel")).click();
  }
});
