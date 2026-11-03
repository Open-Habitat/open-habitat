import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { openedConversation } from "./conversation-view";
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
 * a remount would lose, from before the conversation was created. */
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
  await openedConversation(page);
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

/** Scrolls Settings from its top to its bottom and returns, for each step
 * where the X lies over any text or control of the section, what it
 * covered. Text is measured by its own glyph boxes, not its block's. */
async function coveredWhileScrolling(page: Page) {
  return page.evaluate(async () => {
    const close = document.querySelector('[data-testid="settings-close"]');
    const main = document.querySelector(".s-main");
    if (!close || !main) return ["no X or section"];
    let scroller: Element | null = close.parentElement;
    while (
      scroller &&
      !(
        /(auto|scroll)/.test(getComputedStyle(scroller).overflowY) &&
        scroller.scrollHeight > scroller.clientHeight
      )
    )
      scroller = scroller.parentElement;
    const target = scroller ?? document.scrollingElement ?? document.body;
    const frame = () => new Promise((done) => requestAnimationFrame(done));
    const hits: string[] = [];
    // What of a box shows: an ancestor that clips its overflow cuts it.
    const shown = (r: DOMRect, from: Element | null) => {
      let { left, top, right, bottom } = r;
      for (let a = from; a && a !== main.parentElement; a = a.parentElement)
        if (getComputedStyle(a).overflow !== "visible") {
          const c = a.getBoundingClientRect();
          left = Math.max(left, c.left);
          top = Math.max(top, c.top);
          right = Math.min(right, c.right);
          bottom = Math.min(bottom, c.bottom);
        }
      return { left, top, right, bottom };
    };
    const overlap = (
      a: { left: number; top: number; right: number; bottom: number },
      b: DOMRect,
    ) =>
      a.left < a.right &&
      a.top < a.bottom &&
      a.left < b.right &&
      b.left < a.right &&
      a.top < b.bottom &&
      b.top < a.bottom;
    const max = target.scrollHeight - target.clientHeight;
    for (let top = 0; ; top = Math.min(max, top + 120)) {
      target.scrollTop = top;
      await frame();
      const x = close.getBoundingClientRect();
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        if (
          [...range.getClientRects()].some((r) =>
            overlap(shown(r, n.parentElement), x),
          )
        )
          hits.push(`${top}: "${n.textContent.trim().slice(0, 40)}"`);
      }
      for (const c of main.querySelectorAll(
        "button, input, select, textarea, a[href], svg, img, [role]",
      ))
        if (
          c.checkVisibility() &&
          overlap(shown(c.getBoundingClientRect(), c.parentElement), x) &&
          !c.contains(close)
        )
          hits.push(`${top}: <${c.tagName.toLowerCase()}>`);
      if (top >= max) break;
    }
    return hits;
  });
}

for (const [device, viewport] of [
  ["desktop", { width: 1280, height: 600 }],
  ["folded desktop", { width: 1040, height: 700 }],
  ["phone", { width: 390, height: 700 }],
] as const)
  test(`@settings-close ${device}: the X never lies over a settings page's content, scrolled anywhere`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await signIn(page);
    // The section list, which a phone shows only before a section opens.
    await page.goto("/settings");
    const close = page
      .getByRole("button")
      .and(page.getByTestId("settings-close"));
    await expect(close).toBeVisible();
    const pages = await page
      .getByTestId("settings-navigation")
      .getByRole("link")
      .evaluateAll((links) =>
        links.map((l) => (l as HTMLAnchorElement).pathname),
      );
    expect(pages.length).toBeGreaterThan(3);
    for (const path of pages) {
      await page.goto(path);
      await expect(page.locator(".s-main > h2")).toBeVisible();
      // Let the section's own reads settle into their final length.
      await page.waitForLoadState("networkidle");
      expect({ path, covered: await coveredWhileScrolling(page) }).toEqual({
        path,
        covered: [],
      });
    }
    // The long page scrolled halfway, for Jari's eye; on the desktop the X
    // stays in reach there.
    await page.goto("/settings/experimental");
    await page
      .getByTestId("experimental-features")
      .getByRole("region")
      .last()
      .scrollIntoViewIfNeeded();
    if (device === "desktop") await expect(close).toBeInViewport();
    if (process.env.OH_VISUAL_CAPTURE)
      for (const colorScheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.screenshot({
          path: `../issues/settings-close-x-overlaps-content/evidence/${device}-vieritetty-${colorScheme}.png`,
        });
      }
  });
