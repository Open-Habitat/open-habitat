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
    test("rail marks stay in sight beside hover and keyboard actions and open their row", async ({
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
        .filter({ has: page.locator('[data-testid="rail-mark"] .oh-orbit') })
        .first();
      // Wide rail B: the mark leads the row, so the actions at its end never
      // cover it; its sub-agent orbits the resident.
      const mark = row.getByTestId("rail-mark");
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
        // There the mark itself is reachable: a first tap in Explain mode
        // explains the state mark.
        const session = await (await page.request.get("/auth/session")).json();
        expect(
          (
            await page.request.put("/api/v1/account/preferences", {
              headers: {
                Origin: new URL(page.url()).origin,
                "X-Agent-Host-CSRF": session.csrf,
              },
              data: { experimental: { "explain-mode": true } },
            })
          ).ok(),
        ).toBe(true);
        await page.reload();
        await page.getByTestId("navigation-open").tap();
        await page.getByTestId("account-menu-trigger").tap();
        await page.getByTestId("menu-explain").tap();
        await expect(page.getByTestId("explain-bar")).toBeVisible();
        const card = page.getByTestId("explain-card");
        if (!(await mark.isVisible())) {
          // The first tap explains the menu button, the second opens it.
          await page.getByTestId("navigation-open").tap();
          await expect(card).toBeVisible();
          await page.getByTestId("navigation-open").tap();
        }
        await mark.tap();
        await expect(card).toHaveAttribute("data-card", "S10");
        if (process.env.OH_RAIL_BALL_CAPTURE)
          await card.screenshot({
            path: resolve(
              `../issues/rail-worker-ball-in-branch-icon/evidence/${process.env.OH_RAIL_BALL_CAPTURE}-card-390.png`,
            ),
          });
        return;
      }
      await row.hover();
      await expect(actions).toHaveCSS("opacity", "1");
      await expect(mark).toHaveCSS("opacity", "1");
      await shot("hover");
      await page.mouse.move(1000, 800);
      await link.focus();
      await expect(actions).toHaveCSS("opacity", "1");
      await expect(mark).toHaveCSS("opacity", "1");
      await expect(link).toHaveAccessibleDescription(said ?? "");
      await shot("focus");
      // The mark stands outside the link; a press on it opens the row.
      const href = await link.getAttribute("href");
      await mark.click();
      await expect(page).toHaveURL(
        (url) => `${url.pathname}${url.search}` === href,
      );
    });
  });
}
