import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
  hasTouch: true,
  isMobile: true,
});

for (const width of [320, 390]) {
  test(`@lab phone account sheet returns through feedback and drawer at ${width}px`, async ({
    page,
  }) => {
    const height = width === 320 ? 568 : 740;
    await page.setViewportSize({ width, height });
    await page.request.get("/fixture/scenario?value=ready");
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page.locator('a[href*="code=42"]').click();
    const originalURL = page.url();
    await page.getByTestId("navigation-open").tap();
    const trigger = page.getByTestId("account-menu-trigger");
    const closeDrawer = page
      .getByRole("button")
      .and(page.getByTestId("close-navigation"));
    await trigger.tap();
    const sheet = page.getByTestId("account-menu-sheet");
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    if (!box) throw new Error("Missing sheet");
    expect(box.x).toBe(0);
    expect(box.width).toBe(width);
    expect(box.y).toBeGreaterThan(0);
    expect(box.y + box.height).toBeCloseTo(height, 0);
    // A menu taller than a small phone scrolls inside the sheet, so its last
    // action is still within reach.
    const logout = sheet.getByTestId("menu-logout");
    await logout.scrollIntoViewIfNeeded();
    await expect(logout).toBeInViewport();
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-testid="account-menu-sheet"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    if (process.env.OH_ACCOUNT_MENU_CAPTURE)
      await snapshot(
        page,
        `${process.env.OH_ACCOUNT_MENU_CAPTURE}/sheet-${width}`,
      );
    // Quick preferences must remain in the sheet rather than dismissing it.
    await sheet.getByTestId("theme-choice").getByRole("button").nth(1).tap();
    await expect(sheet).toBeVisible();
    await page.getByTestId("menu-feedback").tap();
    await expect(page.getByTestId("general-text")).toBeFocused();
    expect(
      (await new AxeBuilder({ page }).include(".ah-feedback-sheet").analyze())
        .violations,
    ).toEqual([]);
    if (process.env.OH_ACCOUNT_MENU_CAPTURE)
      await snapshot(
        page,
        `${process.env.OH_ACCOUNT_MENU_CAPTURE}/feedback-${width}`,
      );
    await page.getByTestId("general-text").fill("Synthetic feedback draft");
    await page.mouse.click(width - 4, 4);
    await expect(page.getByTestId("general-nudge")).toBeVisible();
    await expect(page.getByTestId("general-text")).toHaveValue(
      "Synthetic feedback draft",
    );
    await page.getByTestId("general-close").tap();
    await expect(page.getByTestId("general-feedback")).toHaveCount(0);
    await expect(page.getByTestId("menu-feedback")).toBeFocused();
    await expect(sheet).toBeVisible();
    await page.getByTestId("menu-feedback").tap();
    await expect(page.getByTestId("general-text")).toHaveValue(
      "Synthetic feedback draft",
    );
    await page.goBack();
    await expect(page.getByTestId("general-feedback")).toHaveCount(0);
    await expect(page.getByTestId("menu-feedback")).toBeFocused();
    await page.goBack();
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page).toHaveURL(originalURL);
    await trigger.tap();
    // A scrim tap removes only the top layer, leaving the drawer usable.
    await page.mouse.click(width - 4, 4);
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(closeDrawer).toBeVisible();
    await trigger.tap();
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(closeDrawer).toBeVisible();
    await trigger.tap();
    const head = await page.locator(".ah-account-sheet-head").boundingBox();
    if (!head) throw new Error("Missing sheet head");
    await page.mouse.move(width / 2, head.y + 10);
    await page.mouse.down();
    await page.mouse.move(width / 2, head.y + 110, { steps: 5 });
    await page.mouse.up();
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.tap();
    await page.getByTestId("menu-settings").tap();
    await expect(page).toHaveURL(/\/settings(?:\/|$)/);
    await page.goBack();
    await expect(page).toHaveURL(originalURL);
    await expect(sheet).toHaveCount(0);
    await page.getByTestId("navigation-open").tap();
    await closeDrawer.tap();
    await expect(page.getByTestId("navigation-open")).toBeFocused();
  });
}
