import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect } from "./worker-host";

const test = createHostTest(false, { BROWSER_HOST_LAB: "1" });

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
});

for (const width of [1440, 390]) {
  for (const language of ["fi", "en-US"]) {
    test(`account menu shows the main sound reason and leads to Settings ${width} ${language}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.clock.install({ time: new Date("2026-11-23T23:30:00") });
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      const session = await (await page.request.get("/auth/session")).json();
      const headers = {
        Origin: new URL(page.url()).origin,
        "X-Agent-Host-CSRF": session.csrf,
      };
      for (const data of [
        { language },
        { sound: { enabled: false } },
        { sound: { night: true } },
        { sound: { night_start: 22 } },
        { sound: { night_end: 7 } },
        { experimental: { "explain-mode": true } },
      ]) {
        const response = await page.request.put("/api/v1/account/preferences", {
          headers,
          data,
        });
        expect(response.ok(), await response.text()).toBe(true);
      }
      await page.goto("/settings/sounds");
      await page
        .getByTestId("sound-device-mute")
        .getByTestId("segment-quiet")
        .click();
      await expect(
        page.getByTestId("sound-status").getByRole("listitem"),
      ).toHaveCount(3);
      const offReason = await page
        .getByTestId("sound-reason-off")
        .locator(".ss-reason-text")
        .innerText();
      await page.goto("/workspaces");
      await page.setViewportSize({ width, height: 900 });
      if (width === 390) await page.getByTestId("navigation-open").click();
      await page.getByTestId("account-menu-trigger").click();
      const row = page.getByTestId("sound-menu-row");
      // Off, muted and night at once: one line with the deciding reason, in
      // Settings' own words, and no list of reasons or fixes.
      await expect(row.getByTestId("sound-summary-reason")).toHaveText(
        offReason,
      );
      await expect(row.getByTestId("sound-status")).toHaveCount(0);
      await expect(row.locator("li")).toHaveCount(0);
      await expect(row.getByTestId("sound-fix-off")).toHaveCount(0);
      const box = await row.boundingBox();
      // The row, its control, one status line and the link; the expanded
      // list was well over 150 px.
      expect(box?.height ?? 0).toBeLessThan(110);
      await expect(row.getByTestId("sound-menu-details")).toBeInViewport();
      expect(
        (await new AxeBuilder({ page }).include(".ah-account-menu").analyze())
          .violations,
      ).toEqual([]);
      await page.getByTestId("menu-explain").click();
      await page.getByTestId("account-menu-trigger").click();
      await row.getByTestId("sound-menu-details").hover();
      await expect(page.getByTestId("explain-card")).toHaveAttribute(
        "data-card",
        "AS12",
      );
      await expect(page.getByTestId("explain-card")).toBeInViewport();
      await page.keyboard.press("Escape");
      if (await page.getByTestId("explain-stop").isVisible())
        await page.getByTestId("explain-stop").click();
      if (!(await row.isVisible()))
        await page.getByTestId("account-menu-trigger").click();
      // Unmuting from the row's own control leaves off as the main reason.
      await row.getByTestId("segment-plays").click();
      await expect(row.getByTestId("sound-summary-reason")).toHaveText(
        offReason,
      );
      await row.getByTestId("sound-menu-details").click();
      await expect(row).toHaveCount(0);
      await expect(page).toHaveURL(/\/settings\/sounds$/);
      await expect(
        page.getByTestId("sound-status").getByRole("listitem"),
      ).toHaveCount(2);
    });
  }
}
