import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});

async function login(page: Page) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
  await expect(page.getByRole("navigation")).toBeVisible();
}

test("@landing fresh load serves a favicon and keeps the console clean", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await login(page);
  // The unauthenticated login journey intentionally gets 401 replies. Observe
  // a fresh authenticated load, including module initialization and reconnect.
  const messages: string[] = [];
  page.on("console", (message) => messages.push(message.text()));
  page.on("pageerror", (error) => messages.push(error.message));
  await page.reload();
  await expect(page.getByRole("navigation")).toBeVisible();
  const icon = page.locator('link[rel="icon"]');
  const href = await icon.getAttribute("href");
  expect(href).toBeTruthy();
  const response = await page.request.get(href as string);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/svg+xml");
  expect(await response.text()).toContain("<svg");
  expect(messages).toEqual([]);
});

test("@landing never flashes: hidden for 300 ms from navigation, then shown at least 500 ms", async ({
  page,
}) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.request.get("/fixture/scenario?value=ready");
  // A fast load finishes while the page clock is still before the reveal.
  await login(page);
  await expect(page.locator(".ah-landing")).toHaveCount(0);
  // Drive the page's monotonic clock, not the worker's wall clock or the
  // first sampled nonzero-opacity frame (which can arrive late under load).
  // Install before navigation: Playwright carries this clock across reloads.
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/snapshot", async (route) => {
    await held;
    await route.continue();
  });
  await page.reload();
  const landing = page.locator(".ah-landing[data-revealed]");
  await page.clock.runFor(299 - (await page.evaluate(() => performance.now())));
  await expect(landing).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(landing).toBeVisible();
  const snapshot = page.waitForResponse("**/api/v1/snapshot");
  release();
  await snapshot;
  // The destination must not mount even one millisecond before the full
  // 500 ms minimum. Checking DOM state avoids CSS animation/frame rounding.
  await page.clock.runFor(499);
  await expect(landing).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(landing).toHaveCount(0);
});

test("@landing says a slow load in words after 8 s and then lands on the home page", async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.request.get("/fixture/scenario?value=ready");
  await login(page);
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/snapshot", async (route) => {
    await held;
    await route.continue();
  });
  await page.reload();
  const slowLine = page.locator('[data-testid="landing-slow"]');
  await expect(page.getByTestId("landing-heading")).toBeVisible();
  await expect(slowLine).toHaveCount(0);
  await expect(slowLine).toBeVisible({ timeout: 12000 });
  release();
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(slowLine).toHaveCount(0);
});

test("@landing failure keeps the landing's place and Yritä uudelleen reaches the home page", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await login(page);
  await page.request.get("/fixture/scenario?value=error");
  await page.reload();
  const failure = page.getByTestId("workspaces-unavailable-title");
  await expect(failure).toBeVisible();
  await expect(page.getByTestId("landing-heading")).toBeVisible();
  await expect(
    page.locator('[data-testid="landing-failure-detail"]'),
  ).toBeVisible();
  // The failure sits where the loading line was: centred in the viewport.
  const box = await page.locator(".ah-landing-in").boundingBox();
  if (!box) throw new Error("landing has no box");
  expect(Math.abs(box.x + box.width / 2 - 640)).toBeLessThan(2);
  await page.request.get("/fixture/scenario?value=ready");
  await page.getByTestId("retry").click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(failure).toHaveCount(0);
});
