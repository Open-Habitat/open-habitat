import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

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
  await expect(page.getByTestId("quota-state")).toHaveAttribute(
    "data-full",
    "false",
  );
  await expect(page.getByTestId("quota-state")).toBeVisible();
  // A terminal history that has ended is reached through the start page.
  await page
    .locator("main")
    .getByTestId("home-conversation-pi:11111111-1111-4111-8111-111111111111")
    .click();
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  const conversationURL = page.url();
  let historyUnavailable = true;
  await page.route("**/api/v1/agents/*/history?*", (route) =>
    historyUnavailable ? route.fulfill({ status: 503 }) : route.continue(),
  );
  usage = 100;
  await page.getByRole("button").and(page.getByTestId("quota-recheck")).click();
  await expect(page.getByTestId("quota-state")).toHaveAttribute(
    "data-full",
    "true",
  );
  await expect(page.getByTestId("quota-state")).toBeVisible();
  await expect(page.getByTestId("history-stale")).toHaveCount(0);
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  await page
    .getByRole("button")
    .and(page.getByTestId("quota-storage-open"))
    .click();
  await expect(page).toHaveURL(/settings\/storage/);
  await expect(
    page.getByRole("heading").and(page.getByTestId("settings-section-tila")),
  ).toBeVisible();
  await expect(page.getByTestId("quota-state")).toHaveAttribute(
    "data-full",
    "true",
  );
  await expect(page.getByTestId("quota-pressure")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() !== "GET") writes++;
  });
  await page.goto(conversationURL);
  await expect(page.getByTestId("quota-pressure")).toBeVisible();
  historyUnavailable = false;
  usage = 25;
  await page.getByRole("button").and(page.getByTestId("quota-recheck")).click();
  await expect(page.getByTestId("quota-pressure")).toHaveCount(0);
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  expect(writes).toBe(0);
});
