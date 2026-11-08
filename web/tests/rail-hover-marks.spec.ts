import { resolve } from "node:path";
import { snapshot } from "../lab/session.mjs";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect } from "./worker-host";

const test = createHostTest(false, { BROWSER_HOST_LAB: "1" });
const capture = process.env.OH_RAIL_MARK_CAPTURE;
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});

for (const touch of [false, true]) {
  test.describe(touch ? "touch" : "pointer", () => {
    test.use({
      hasTouch: touch,
      isMobile: touch,
      viewport: { width: touch ? 390 : 1440, height: 900 },
    });
    test("rail marks yield to hover and keyboard actions without losing their description", async ({
      page,
    }) => {
      await page.route("**/api/v1/snapshot", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        for (const agent of body.agents) agent.spinoffs_idle = 1;
        await route.fulfill({ response, json: body });
      });
      await page.request.get("/fixture/scenario?value=ready");
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page
        .getByRole("link")
        .and(page.locator('a[href*="code=42"]'))
        .click();
      if (touch) await page.getByTestId("navigation-open").click();
      const row = page
        .getByTestId("workspace-navigation")
        .getByTestId(/^agent-item-/)
        .filter({ has: page.locator(".ah-worker-rail") })
        .first();
      const mark = row.locator(".ah-worker-rail");
      const actions = row.locator(".ah-nav-archive");
      const link = row.getByTestId("agent-link");
      await expect(mark).toBeVisible();
      await page.mouse.move(1000, 800);
      const description = await link.getAttribute("aria-describedby");
      expect(description).toBeTruthy();
      const said = await page.locator(`[id="${description}"]`).textContent();
      expect(said?.trim()).toBeTruthy();
      const shot = async (state: string) => {
        if (capture)
          await snapshot(
            page,
            resolve(
              `../issues/rail-worker-mark-under-hover-actions/evidence/${capture}-${touch ? "390" : "1440"}-${state}`,
            ),
            { labOrigin: new URL(page.url()).origin },
          );
      };
      await expect(mark).toHaveCSS("opacity", "1");
      await shot("rest");
      if (touch) {
        // Touch actions occupy their own space, rather than overlaying marks.
        await expect(actions).toHaveCSS("position", "static");
        return;
      }
      await row.hover();
      await expect(actions).toHaveCSS("opacity", "1");
      await expect(mark).toHaveCSS("opacity", "0");
      await shot("hover");
      await page.mouse.move(1000, 800);
      await expect(mark).toHaveCSS("opacity", "1");
      await link.focus();
      await expect(actions).toHaveCSS("opacity", "1");
      await expect(mark).toHaveCSS("opacity", "0");
      await expect(link).toHaveAccessibleDescription(said ?? "");
      await shot("focus");
      await row.getByTestId("rail-rename-conversation").focus();
      await expect(mark).toHaveCSS("opacity", "0");
      await page.getByTestId("snapshot-refresh").focus();
      await expect(mark).toHaveCSS("opacity", "1");
    });
  });
}
