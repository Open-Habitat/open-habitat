import { resolve } from "node:path";
import { snapshot } from "../lab/session.mjs";
import { expect, test } from "./lab-host";

test.use({
  ignoreHTTPSErrors: true,
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`phone headers occlude scrolled content (${colorScheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    const state = await (await page.request.get("/api/v1/snapshot")).json();
    await page.goto(`/workspaces/${state.workspaces[0].workspace_id}`);
    await expect(page.locator(".ah-workspace-page")).toBeVisible();
    // Extend real workspace content so the regression does not depend on the
    // fixture's current conversation count. No layout or header CSS is mocked.
    await page.locator(".ah-workspace-page").evaluate((el) => {
      const content = document.createElement("p");
      content.textContent = "scrolling workspace content ".repeat(2000);
      el.append(content);
    });
    const main = page.locator("main");
    await main.evaluate((el) => {
      el.scrollTop = 300;
    });
    await expect
      .poll(() => main.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    const toolbar = page.locator(".ah-mobile-toolbar");
    await expect
      .poll(() =>
        toolbar.evaluate((bar) => {
          const bottom = bar.getBoundingClientRect().bottom;
          // Check the full strip, including both page gutters. The pseudo-element
          // belongs to the toolbar in hit testing, unlike scrolled page content.
          return [1, 195, 389].every((x) =>
            [1, 10, bottom - 1].every((y) =>
              bar.contains(document.elementFromPoint(x, y)),
            ),
          );
        }),
      )
      .toBe(true);

    if (process.env.OH_VISUAL_CAPTURE === "1") {
      await snapshot(
        page,
        resolve(
          `../issues/phone-header-content-peeks/workspace-${colorScheme}`,
        ),
        { labOrigin: new URL(page.url()).origin },
      );
    }
    await main.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page
      .getByTestId(/^(new-conversation|conversation-start)$/)
      .first()
      .click();
    const stream = page.getByTestId("conversation-stream");
    await expect(stream).toBeVisible();
    await stream.evaluate((el) => {
      const content = document.createElement("p");
      content.textContent = "scrolling conversation content ".repeat(2000);
      el.append(content);
      el.scrollTop = 300;
    });
    await expect
      .poll(() => stream.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        page
          .locator(".ah-conversation-frame > .ah-agent-header")
          .evaluate((header) => {
            const bottom = header.getBoundingClientRect().bottom;
            return [1, 195, 389].every((x) =>
              [1, bottom - 1].every((y) => {
                const hit = document.elementFromPoint(x, y);
                return (
                  header.contains(hit) || !!hit?.closest(".ah-mobile-toolbar")
                );
              }),
            );
          }),
      )
      .toBe(true);
  });
}
