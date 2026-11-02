import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

// The storage item behind the status bell (proto-notification-bell, Tila):
// one bell on screen, wherever this page puts it.
const bell = (page: Page) =>
  page.locator('[data-testid="status-bell"]:visible');
const storage = (page: Page) =>
  page.locator('[data-testid="status-item"][data-key="storage"]');
async function recheck(page: Page) {
  if ((await bell(page).getAttribute("aria-expanded")) !== "true")
    await bell(page).click();
  await storage(page).getByTestId("quota-recheck").click();
}

test("quota warning, full storage and recovery keep the conversation mounted without resending @a11y", async ({
  page,
}) => {
  let usage = 91;
  await page.route("**/api/v1/account/storage", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        usage_bytes: usage * 1024 ** 2,
        limit_bytes: 100 * 1024 ** 2,
      },
    }),
  );
  await page.request.get("/fixture/history?mode=short");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  // Near full is a quiet bell; its panel says which.
  await expect(bell(page)).toHaveAttribute("data-tone", "neutral");
  await bell(page).click();
  await expect(storage(page)).toHaveAttribute("data-full", "false");
  // From 95 % the bell itself says it, before writes start failing.
  usage = 96;
  await storage(page).getByTestId("quota-recheck").click();
  await expect(storage(page)).toHaveAttribute("data-critical", "true");
  await expect(storage(page)).toContainText("melkein täynnä (96 %)");
  await expect(bell(page)).toHaveAttribute("data-tone", "danger");
  usage = 91;
  await storage(page).getByTestId("quota-recheck").click();
  await expect(storage(page)).toHaveAttribute("data-critical", "false");
  await expect(bell(page)).toHaveAttribute("data-tone", "neutral");
  await page.keyboard.press("Escape");
  await expect(storage(page)).toHaveCount(0);
  // A terminal history that has ended is reached through the start page.
  await page
    .locator("main")
    .getByTestId("home-conversation-pi:11111111-1111-4111-8111-111111111111")
    .click();
  await expect(page.locator(".ah-feed li")).toHaveCount(101);
  const conversationURL = page.url();
  let historyUnavailable = true;
  await page.route("**/api/v1/agents/*/history?*", (route) =>
    historyUnavailable ? route.fulfill({ status: 503 }) : route.continue(),
  );
  usage = 100;
  await recheck(page);
  await expect(storage(page)).toHaveAttribute("data-full", "true");
  // Full is said on the bell itself, without opening anything.
  await expect(bell(page)).toHaveAttribute("data-tone", "danger");
  await expect(page.getByTestId("history-stale")).toHaveCount(0);
  await expect(page.locator(".ah-feed li")).toHaveCount(101);
  await storage(page).getByTestId("quota-storage-open").click();
  await expect(page).toHaveURL(/settings\/storage/);
  await expect(
    page.getByRole("heading").and(page.getByTestId("settings-section-tila")),
  ).toBeVisible();
  await expect(bell(page)).toHaveAttribute("data-tone", "danger");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() !== "GET") writes++;
  });
  await page.goto(conversationURL);
  await expect(bell(page)).toHaveAttribute("data-tone", "danger");
  historyUnavailable = false;
  usage = 25;
  // Freed space empties the open panel; closing it leaves no bell.
  await recheck(page);
  await expect(storage(page)).toHaveCount(0);
  await expect(page.getByTestId("status-empty")).toBeVisible();
  // The recheck button left with its item; Escape closes the panel once
  // React Aria has moved focus back inside it, which can lag under load.
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(document.activeElement?.closest(".ah-bell-popover")),
      ),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(bell(page)).toHaveCount(0);
  await expect(page.locator(".ah-feed li")).toHaveCount(101);
  expect(writes).toBe(0);
});
