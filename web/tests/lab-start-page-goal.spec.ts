import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// Choosing a goal puts the goal's own skill call in the draft as a chip, the guide
// stays beside the conversation, and after a reload Pi's recorded skill call
// brings the guide back (proto-start-page-goal, direction A).
test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const [width, theme] of [
  [1440, "light"],
  [390, "dark"],
] as const) {
  test(`@lab @a11y goal chip and guide panel ${width} ${theme}`, async ({
    page,
  }, testInfo) => {
    const phone = width === 390;
    await page.setViewportSize({ width, height: 900 });
    await page.request.get("/fixture/conversations-reset");
    await page.request.get("/fixture/scenario?value=ready");
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page.locator('a[href*="code=42"]').click();
    const setTheme = () =>
      page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);
    await setTheme();
    if (phone) await page.getByTestId("navigation-open").click();
    await page
      .getByRole("navigation")
      .getByTestId("workspace-start-aurinkokello")
      .click();
    await expect(page).toHaveURL(/\?conversation=pi:/);
    const field = page.getByTestId("message-input");
    const panel = page.getByTestId("guide-panel");
    const toggle = page.getByTestId("guide-toggle");
    // The first authored goal has its own skill (lab-start-page.md).
    // Choosing it is its Aloita: no guide stops in between.
    await page.getByTestId("starting-goal").first().click();

    const chip = page.getByTestId("goal-chip");
    await expect(chip).toBeVisible();
    // Only the placeholder is in the field, selected for typing.
    await expect(field).toHaveValue("[kuvaile havainto]");
    await expect(field).toBeFocused();
    expect(
      await field.evaluate((node: HTMLTextAreaElement) =>
        node.value.slice(node.selectionStart, node.selectionEnd),
      ),
    ).toBe("[kuvaile havainto]");
    if (phone) {
      // A phone opens nothing by itself; the top bar reaches the guide.
      await expect(panel).toHaveCount(0);
      await toggle.click();
      await expect(panel).toBeVisible();
      await expect(panel.getByRole("heading", { level: 2 })).toBeFocused();
      await snapshot(page, testInfo.outputPath(`guide-${width}-${theme}`), {
        labOrigin,
      });
      await page.getByTestId("guide-panel-close").click();
      await expect(panel).toHaveCount(0);
      await expect(toggle).toBeFocused();
      await field.click();
      await field.press("ControlOrMeta+a");
    } else {
      await expect(panel).toBeVisible();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      const box = await panel.boundingBox();
      const frame = await page.locator(".ah-conversation-frame").boundingBox();
      if (!box || !frame) throw new Error("panel or conversation missing");
      expect(box.x).toBeGreaterThanOrEqual(frame.x + frame.width - 1);
    }
    await expect(
      panel.getByTestId("guide-panel-steps").locator("li"),
    ).toHaveCount(phone ? 0 : 3);
    const audit = new AxeBuilder({ page }).include(".ah-composer");
    if (!phone) audit.include('[data-testid="guide-panel"]');
    expect((await audit.analyze()).violations).toEqual([]);
    await snapshot(page, testInfo.outputPath(`started-${width}-${theme}`), {
      labOrigin,
    });

    const outgoing = page.waitForRequest(
      (r) =>
        r.method() === "POST" && new URL(r.url()).pathname.endsWith("/send"),
    );
    await field.pressSequentially("Nappi ei reagoi");
    await page.getByTestId("send").click();
    // The draft was Pi's own skill invocation all along.
    expect((await outgoing).postDataJSON().message).toBe(
      "/skill:korjaa-ongelma Nappi ei reagoi",
    );
    await expect(field).toHaveValue("");
    await expect(chip).toHaveCount(0);
    const recorded = page.getByTestId("skill-chip").first();
    await expect(recorded).toBeVisible({ timeout: 20000 });
    // Native content: the skill's name and its description, the goal's title.
    await expect(recorded).toContainText("korjaa-ongelma");
    await expect(recorded).toContainText("Korjaa havaittu ongelma");
    await expect(
      page.getByTestId("message").filter({ has: recorded }),
    ).toContainText("Nappi ei reagoi");
    // The guide stays beside the conversation until it is closed.
    if (!phone) await expect(panel).toBeVisible();
    await snapshot(page, testInfo.outputPath(`sent-${width}-${theme}`), {
      labOrigin,
    });

    // A reload forgets the tab; Pi's recorded skill call names the goal.
    await page.reload();
    await setTheme();
    await expect(recorded).toBeVisible({ timeout: 20000 });
    await expect(toggle).toBeVisible();
    await expect(panel).toHaveCount(0);
    await toggle.click();
    await expect(panel).toBeVisible();
    await expect(
      panel.getByTestId("guide-panel-steps").locator("li"),
    ).toHaveCount(3);
    await snapshot(page, testInfo.outputPath(`reloaded-${width}-${theme}`), {
      labOrigin,
    });
    await panel.press("Escape");
    await expect(panel).toHaveCount(0);

    if (!phone) {
      // A long conversation's tail no longer holds the first message: the
      // guide comes from the start of the native history instead.
      await page.route(/\/history\?messages=100$/, async (route) => {
        const response = await route.fetch();
        const tail = await response.json();
        const entries = tail.entries.filter(
          (entry: { skill?: unknown }) => !entry.skill,
        );
        await route.fulfill({
          response,
          json: {
            ...tail,
            entries,
            older_complete: false,
            next_before: entries[0].entry_key,
          },
        });
      });
      const head = page.waitForRequest((r) =>
        new URL(r.url()).search.startsWith("?after=&"),
      );
      await page.reload();
      await setTheme();
      await head;
      await expect(recorded).toHaveCount(0);
      await expect(toggle).toBeVisible();
      await page.unroute(/\/history\?messages=100$/);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
