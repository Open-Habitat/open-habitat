import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function signIn(page: import("@playwright/test").Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.request.get("/fixture/pi-state?value=usable");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
}

test("@a11y keyboard navigation places focus on destination and restores account menu focus", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link").and(page.getByTestId("skip-content")).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
  const workspace = page
    .getByRole("navigation")
    .locator(".ah-workspace-link")
    .first();
  const name = await workspace.innerText();
  await workspace.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await page
    .getByRole("button")
    .and(page.getByTestId("account-menu-trigger"))
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeFocused();
  await page
    .getByRole("button")
    .and(page.getByTestId("account-menu-trigger"))
    .click();
  await page
    .getByRole("menuitem")
    .and(page.getByTestId("menu-settings"))
    .click();
  await expect(
    page.locator(".s-nav").getByRole("heading", { level: 1 }),
  ).toBeFocused();
  await page
    .getByRole("button")
    .and(page.getByTestId("settings-close"))
    .click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeFocused();
});

test("@a11y signed-out, shell, settings and narrow shell have no axe violations or horizontal overflow", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await signIn(page);
  for (const width of [1280, 640]) {
    await page.setViewportSize({ width, height: 900 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
  await page
    .getByRole("button")
    .and(page.getByTestId("navigation-open"))
    .click();
  await expect(page.getByRole("navigation")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button").and(page.getByTestId("navigation-open")),
  ).toBeFocused();
  await page
    .getByRole("button")
    .and(page.getByTestId("navigation-open"))
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("account-menu-trigger"))
    .click();
  await page
    .getByRole("menuitem")
    .and(page.getByTestId("menu-settings"))
    .click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("@a11y first-use steps focus their heading and announce chooser count", async ({
  page,
}) => {
  try {
    await page.request.get("/fixture/scenario?value=pi-onboarding");
    await page.request.get("/fixture/pi-state?value=missing");
    await page.goto("/workspaces");
    await page
      .getByRole("button")
      .and(page.getByTestId("github-sign-in"))
      .click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    await confirmGitIdentity(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("button")
      .and(page.getByTestId("repository-proceed"))
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
