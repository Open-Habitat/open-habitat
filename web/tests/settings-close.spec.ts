import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Settings closes from its corner X, and with Esc outside a field, back to
// exactly what was open before it: the same conversation, not remounted.
test.beforeEach(async ({ page }) => {
  expect((await page.request.get("/fixture/reset-clock")).status()).toBe(204);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
});

async function signIn(page: Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.request.get("/fixture/pi-state?value=usable");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  // On a phone the account menu waits in the navigation drawer.
  await expect(page.getByTestId("account-menu-trigger")).toBeAttached();
}

/** A new conversation with an unsent draft; its frame carries a mark that
 * a remount would lose. */
async function conversation(page: Page) {
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/\?conversation=/);
  await page.getByTestId("message-input").fill("Luonnos, jota ei lähetetä");
  await page
    .locator(".ah-conversation-frame")
    .evaluate((frame) => frame.setAttribute("data-before-settings", ""));
  return page.url();
}

async function expectSameConversation(page: Page, url: string) {
  await expect(page).toHaveURL(url);
  await expect(page.locator(".ah-account-settings")).toHaveCount(0);
  await expect(
    page.locator(".ah-conversation-frame[data-before-settings]"),
  ).toBeVisible();
  await expect(page.getByTestId("message-input")).toHaveValue(
    "Luonnos, jota ei lähetetä",
  );
}

async function openSettings(page: Page) {
  if (await page.getByTestId("navigation-open").isVisible())
    await page.getByTestId("navigation-open").click();
  await page
    .getByRole("button")
    .and(page.getByTestId("account-menu-trigger"))
    .click();
  await page
    .getByRole("menuitem")
    .and(page.getByTestId("menu-settings"))
    .click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    page.getByRole("heading").and(page.getByTestId("settings-title")),
  ).toBeFocused();
}

async function axe(page: Page) {
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
}

test("@settings-close X returns to the conversation that was open, unmounted nothing", async ({
  page,
}) => {
  await signIn(page);
  const url = await conversation(page);
  await openSettings(page);
  // The conversation stays under Settings, out of sight and out of reach.
  await expect(page.locator(".ah-conversation-frame")).toBeHidden();
  await page
    .getByRole("navigation")
    .and(page.getByTestId("settings-navigation"))
    .getByRole("link")
    .and(page.getByTestId("settings-ulkoasu"))
    .click();
  await expect(page).toHaveURL(/\/settings\/appearance$/);
  await axe(page);
  const close = page
    .getByRole("button", { name: "Sulje asetukset" })
    .and(page.getByTestId("settings-close"));
  await expect(close).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/settings-close-desktop-light.png",
  });
  await page.emulateMedia({ colorScheme: "dark" });
  // Controls fade to the new theme's colours.
  await page.waitForTimeout(600);
  await page.screenshot({
    path: "test-results/evidence/settings-close-desktop-dark.png",
  });
  await page.emulateMedia({ colorScheme: "light" });
  await close.click();
  await expectSameConversation(page, url);
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeFocused();
  // The browser's own back also leaves Settings for the same view.
  await openSettings(page);
  await page.goBack();
  await expectSameConversation(page, url);
});

test("@settings-close Esc closes Settings except in a field", async ({
  page,
}) => {
  await signIn(page);
  const url = await conversation(page);
  await openSettings(page);
  await page
    .getByRole("navigation")
    .and(page.getByTestId("settings-navigation"))
    .getByRole("link")
    .and(page.getByTestId("settings-tili"))
    .click();
  const name = page.getByTestId("git-name-input");
  if (!(await name.isVisible()))
    await page.getByTestId("git-identity-edit").click();
  await name.focus();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(page.getByTestId("settings-section-tili")).toBeVisible();
  await page.getByTestId("settings-section-tili").focus();
  await page.keyboard.press("Escape");
  await expectSameConversation(page, url);
});

test("@settings-close a link straight to Settings closes to the home view", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/ai");
  await expect(page.getByTestId("settings-section-tekoaly")).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("settings-close"))
    .click();
  await expect(page).toHaveURL(/\/(workspaces)?$/);
  await expect(page.locator(".ah-account-settings")).toHaveCount(0);
});

test("@settings-close phone: X in the corner returns to the conversation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.getByTestId("navigation-open").click();
  const url = await conversation(page);
  await openSettings(page);
  const close = page
    .getByRole("button")
    .and(page.getByTestId("settings-close"));
  await expect(close).toBeVisible();
  await axe(page);
  await page.screenshot({
    path: "test-results/evidence/settings-close-phone-light.png",
  });
  await page
    .getByRole("navigation")
    .and(page.getByTestId("settings-navigation"))
    .getByRole("link")
    .and(page.getByTestId("settings-ulkoasu"))
    .click();
  await expect(close).toBeVisible();
  await page.emulateMedia({ colorScheme: "dark" });
  // Controls fade to the new theme's colours.
  await page.waitForTimeout(600);
  await page.screenshot({
    path: "test-results/evidence/settings-close-phone-dark.png",
  });
  await page.emulateMedia({ colorScheme: "light" });
  // Within the viewport's top right corner.
  const box = await close.boundingBox();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeGreaterThan(390 - 48);
  expect(box?.y).toBeLessThan(64);
  await close.click();
  await expectSameConversation(page, url);
});

test("@settings-close the page under Settings keeps its scroll position", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 360 });
  await signIn(page);
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  const main = page.locator("#main");
  await expect
    .poll(() => main.evaluate((m) => m.scrollHeight - m.clientHeight))
    .toBeGreaterThan(40);
  await main.evaluate((m) => {
    m.scrollTop = 40;
  });
  await openSettings(page);
  // Settings starts at its top, over the scrolled page.
  await expect(page.getByTestId("settings-title")).toBeInViewport();
  await page.getByTestId("settings-close").click();
  await expect(page).toHaveURL(/\/workspaces\/ws_/);
  await expect(page.locator(".ah-account-settings")).toHaveCount(0);
  expect(await main.evaluate((m) => m.scrollTop)).toBe(40);
});
