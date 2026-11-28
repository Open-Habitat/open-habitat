import AxeBuilder from "@axe-core/playwright";
import type { Browser } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { spacing } from "./control-spacing";
import { expect, type Page, test } from "./worker-host";

// Settings › Vaaralliset toiminnot (risky-features-settings): a member is
// off until the person allows it through the warning window, off happens at
// once, the choice is the account's on every device, and the agent has no
// way to allow it.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  reducedMotion: "reduce",
});

const ID = "conversation-links";
const href = "/settings/risky-features";

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expect(page.getByTestId("account-menu-trigger")).toBeAttached();
}

/** The same person signed in on another device: its own browser context,
 * session and CSRF binding. */
async function otherDevice(browser: Browser) {
  const context = await browser.newContext({
    baseURL: hostOrigin,
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await signIn(page);
  return { context, page };
}

const member = (page: Page) =>
  page.getByRole("region").and(page.getByTestId(`risky-${ID}`));
const state = (page: Page) => page.getByTestId(`risky-${ID}-state`);
const allow = (page: Page) =>
  member(page)
    .getByRole("button")
    .and(page.getByTestId(`risky-${ID}-allow`));
const disable = (page: Page) =>
  member(page)
    .getByRole("button")
    .and(page.getByTestId(`risky-${ID}-disable`));
const dialog = (page: Page) =>
  page.getByRole("alertdialog").and(page.getByTestId("risky-allow-dialog"));

async function expectOff(page: Page) {
  await expect(state(page)).not.toHaveAttribute("data-on", "");
  await expect(allow(page)).toBeVisible();
  await expect(disable(page)).toHaveCount(0);
  await expect(page.getByTestId(`risky-${ID}-since`)).toHaveCount(0);
}
async function expectOn(page: Page) {
  await expect(state(page)).toHaveAttribute("data-on", "");
  await expect(disable(page)).toBeVisible();
  await expect(allow(page)).toHaveCount(0);
  await expect(page.getByTestId(`risky-${ID}-since`)).toBeVisible();
}
async function axe(page: Page, include: string) {
  const result = await new AxeBuilder({ page }).include(include).analyze();
  expect(result.violations).toEqual([]);
}

test("@settings-risky allowing needs the warning, Esc and Cancel leave it off, off is immediate, and the choice follows the account", async ({
  page,
  browser,
}) => {
  await signIn(page);
  await page.goto(href);
  await expect(page.getByTestId("settings-vaaralliset")).toHaveAttribute(
    "aria-current",
    "page",
  );
  // With the account's security sections: right after Avaimet.
  const nav = await page
    .getByTestId("settings-navigation")
    .locator(".s-nav-i")
    .evaluateAll((items) =>
      items.map((i) => (i as HTMLElement).dataset.testid),
    );
  expect(nav.indexOf("settings-vaaralliset")).toBe(
    nav.indexOf("settings-avaimet") + 1,
  );
  await expectOff(page);
  await axe(page, '[data-testid="risky-features"]');
  await spacing(member(page), "member row, off");

  const writes: unknown[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/v1/account/preferences") && r.method() === "PUT")
      writes.push(r.postDataJSON());
  });
  // Esc, then Peru: the window closes and nothing is written.
  await allow(page).click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByTestId("risky-allow-cancel")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  // Esc closed only the window, not Settings.
  await expect(member(page)).toBeVisible();
  await allow(page).click();
  await page.getByTestId("risky-allow-cancel").click();
  await expect(dialog(page)).toBeHidden();
  await expectOff(page);
  expect(writes).toEqual([]);

  await allow(page).click();
  await axe(page, '[data-testid="risky-allow-dialog"]');
  await spacing(dialog(page), "warning window");
  const write = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/account/preferences") &&
      r.request().method() === "PUT",
  );
  await page.getByTestId("risky-allow-confirm").click();
  expect((await write).ok()).toBe(true);
  expect(writes).toEqual([{ risky: { [ID]: true } }]);
  await expect(dialog(page)).toBeHidden();
  await expectOn(page);
  // Focus stays on the row's one button, which now turns the feature off.
  await expect(disable(page)).toBeFocused();
  await axe(page, '[data-testid="risky-features"]');
  await spacing(member(page), "member row, on");

  await page.reload();
  await expectOn(page);

  // The other device opens the row by its link and turns it off at once.
  const other = await otherDevice(browser);
  try {
    await other.page.goto(`${href}#${ID}`);
    await expect(member(other.page)).toBeFocused();
    await expectOn(other.page);
    await disable(other.page).click();
    await expect(dialog(other.page)).toHaveCount(0);
    await expectOff(other.page);
  } finally {
    await other.context.close();
  }
  await page.reload();
  await expectOff(page);
  expect(writes).toEqual([{ risky: { [ID]: true } }]);
});

test("@settings-risky the agent cannot allow it, and a failed save leaves it off", async ({
  page,
}) => {
  await signIn(page);
  // The agent's only preferences route refuses the id.
  const refused = await page.request.put("/fixture/agent-experimental", {
    data: { id: ID, enabled: true },
  });
  expect(refused.status()).toBe(400);
  await page.goto(href);
  await expectOff(page);

  await page.route("**/api/v1/account/preferences", async (route) => {
    if (route.request().method() === "PUT")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          schema_version: 1,
          error: { code: "preferences_unavailable" },
        }),
      });
    else await route.fallback();
  });
  await allow(page).click();
  await page.getByTestId("risky-allow-confirm").click();
  await expect(
    page.getByRole("alert").and(page.getByTestId(`risky-${ID}-error`)),
  ).toBeVisible();
  await expectOff(page);
  await page.unroute("**/api/v1/account/preferences");
  await page.getByTestId(`risky-${ID}-error-reload`).click();
  await expect(page.getByTestId(`risky-${ID}-error`)).toBeHidden();
  await expectOff(page);
});

test("@settings-risky on a phone the link lands on the row and the warning fits the screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto(`${href}#${ID}`);
  await expect(member(page)).toBeFocused();
  await expect(member(page)).toBeInViewport();
  await expectOff(page);
  await spacing(member(page), "member row, phone");
  await allow(page).click();
  await expect(dialog(page)).toBeVisible();
  for (const id of ["risky-allow-confirm", "risky-allow-cancel"])
    await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 });
  const box = await dialog(page).boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
  await axe(page, '[data-testid="risky-allow-dialog"]');
  await page.getByTestId("risky-allow-confirm").click();
  await expectOn(page);
  await spacing(member(page), "member row, phone, on");
  await axe(page, '[data-testid="risky-features"]');
});
