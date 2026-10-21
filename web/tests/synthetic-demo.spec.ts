import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { demoOrigin, ports } from "../test-ports.mjs";

const base = demoOrigin;
test.use({ baseURL: base, viewport: { width: 1280, height: 720 } });
for (const scenario of [
  "ready",
  "empty",
  "partial",
  "missing",
  "unavailable",
  "login",
] as const) {
  test(`synthetic ${scenario} scenario and a11y`, async ({ page }) => {
    await page.goto(`/workspaces?scenario=${scenario}`);
    // The failure is the landing's own line under its Open Habitat wordmark.
    await expect(
      page.locator(scenario === "unavailable" ? "main h2" : "main h1"),
    ).toBeVisible();
    await expect(page.locator(".ah-demo-banner")).toBeVisible();
    if (scenario === "ready") {
      await expect(
        page.locator(
          'a[data-testid^="workspace-"][data-workspace-name="git-project"]',
        ),
      ).toBeVisible();
      await page
        .locator(
          'a[data-testid^="workspace-"][data-workspace-name="git-project"]',
        )
        .click();
      await expect(page.locator("main h1")).toHaveText("git-project");
      await page.getByTestId("workspace-filter").fill("nonsense");
      await expect(page.locator('[data-testid="filter-empty"]')).toBeVisible();
      await page.getByTestId("clear-filter").click();
      await page.getByTestId("skip-content").focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("main")).toBeFocused();
    }
    if (scenario === "partial") {
      await expect(
        page.locator(
          'a[data-testid^="workspace-"][data-workspace-name="uncertain"]',
        ),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="workspaces-partial"]'),
      ).toBeVisible();
    }
    if (scenario === "empty")
      await expect(
        page.locator('[data-testid="workspaces-empty"]').first(),
      ).toBeVisible();
    if (scenario === "missing")
      await expect(
        page.locator('[data-testid="catalog-missing"]'),
      ).toBeVisible();
    if (scenario === "login") {
      await expect(page.getByTestId("github-sign-in")).toBeDisabled();
      await expect(page.getByTestId("control-reason")).toBeVisible();
    }
    const violations = (
      await new AxeBuilder({ page }).analyze()
    ).violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(violations).toEqual([]);
    await page.screenshot({
      path: `test-results/evidence/demo-${scenario}.png`,
      fullPage: true,
    });
  });
}
test("synthetic login error is visually distinct and never echoes query detail", async ({
  page,
}) => {
  await page.goto(
    "/workspaces?scenario=login&auth_error=%3Cscript%3Eunsafe%3C%2Fscript%3E",
  );
  await expect(page.getByTestId("login-heading")).toBeVisible();
  await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
  await expect(page.locator(".ah-notice.ah-tone-danger")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/unsafe|script/);
  await page.screenshot({
    path: "test-results/evidence/demo-login-error.png",
    fullPage: true,
  });
});
test("no authentication, fixture routes, production build fixture, or external host", async ({
  page,
  request,
}) => {
  await page.goto("/workspaces?scenario=ready");
  expect((await request.get(`${base}/auth/github/start`)).status()).toBe(404);
  expect((await request.get(`${base}/fixture/provider`)).status()).toBe(404);
  expect(
    (await request.get(`${base}/__open-in-editor?file=/etc/hostname`)).status(),
  ).toBe(404);
  expect(
    (
      await request.get(`${base}/api/v1/snapshot`, {
        headers: { "Sec-Fetch-Site": "cross-site" },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.get(`${base}/workspaces`, {
        headers: { Host: "example.org" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.get(`${base}/workspaces`, {
        headers: { Host: `localhost:${ports.demo}` },
      })
    ).status(),
  ).toBe(403);
  await expect(page.getByTestId("account-menu-trigger")).toBeVisible();
});
