import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
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
    test(`account sound reasons and independent fixes ${width} ${language}`, async ({
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
        { experimental: { "remote-browser": true } },
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
      const settingsReasons = await page
        .getByTestId("sound-status")
        .innerText();
      await page.goto("/workspaces");
      await page.setViewportSize({ width, height: 900 });
      if (width === 390) await page.getByTestId("navigation-open").click();
      await expect(page.getByTestId("browser-rail-row")).toBeVisible();
      if (process.env.OH_VISUAL_CAPTURE === "1")
        await snapshot(
          page,
          `/var/tmp/agent-keep/rail-icons-dictation-sounds/rail-${width}-${language}`,
          { labOrigin: new URL(page.url()).origin },
        );
      await page.getByTestId("account-menu-trigger").click();
      const row = page.getByTestId("sound-menu-row");
      const status = row.getByTestId("sound-status");
      await expect(status.locator("li")).toHaveCount(3);
      // Equality is the requested shared-copy contract, not an English/Finnish wording oracle.
      expect(await status.innerText()).toBe(settingsReasons);
      await expect(row.getByTestId("sound-fix-off")).toBeInViewport();
      await expect(row.getByTestId("sound-night-settings")).toBeInViewport();
      expect(
        (await new AxeBuilder({ page }).include(".ah-account-menu").analyze())
          .violations,
      ).toEqual([]);
      const capture = async (name: string) => {
        if (process.env.OH_VISUAL_CAPTURE === "1")
          await snapshot(
            page,
            `/var/tmp/agent-keep/rail-icons-dictation-sounds/menu-${name}-${width}-${language}`,
            { labOrigin: new URL(page.url()).origin },
          );
      };
      await capture("reasons");
      await page.getByTestId("menu-explain").click();
      await page.getByTestId("account-menu-trigger").click();
      await row.getByTestId("sound-fix-off").hover();
      await expect(page.getByTestId("explain-card")).toHaveAttribute(
        "data-card",
        "AS10",
      );
      await expect(page.getByTestId("explain-card")).toBeInViewport();
      await capture("explain");
      await row.getByTestId("sound-fix-off").click();
      const sound = async () =>
        (await (await page.request.get("/api/v1/account/preferences")).json())
          .sound;
      expect((await sound()).enabled).toBe(false);
      await page.keyboard.press("Escape");
      if (await page.getByTestId("explain-stop").isVisible())
        await page.getByTestId("explain-stop").click();
      if (!(await row.isVisible()))
        await page.getByTestId("account-menu-trigger").click();
      await row.getByTestId("sound-fix-muted").click();
      await expect(status.locator("li")).toHaveCount(2);
      await expect(row).toBeFocused();
      expect((await sound()).enabled).toBe(false);
      await row.getByTestId("sound-night-settings").click();
      await expect(row).toHaveCount(0);
      await expect(
        page.locator('[data-settings-row="attention-sound-night"]'),
      ).toBeFocused();
      await page.goto("/workspaces");
      if (width === 390) await page.getByTestId("navigation-open").click();
      await page.getByTestId("account-menu-trigger").click();
      await row.getByTestId("sound-night-off").click();
      await expect.poll(async () => (await sound()).night).toBe(false);
      await expect(status.locator("li")).toHaveCount(1);
      await row.getByTestId("sound-fix-off").click();
      await expect.poll(async () => (await sound()).enabled).toBe(true);
      await expect(status).toHaveCount(0);
      await expect(row).toBeFocused();
      await page.reload();
      expect(await sound()).toMatchObject({ enabled: true, night: false });
    });
  }
}
