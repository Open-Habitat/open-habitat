import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const width of [1440, 1366, 390]) {
  for (const theme of ["light", "dark"]) {
    test(`@lab @a11y recorded skill reader ${width} ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      if (width === 390) await page.getByTestId("navigation-open").click();
      await page
        .getByRole("navigation")
        .getByTestId("workspace-start-aurinkokello")
        .click();
      await expect(page.getByTestId("start-here")).toBeVisible();
      const field = page.getByTestId("message-input");
      await field.fill("/skill:synthetic-review Tarkista myös mobiilinäkymä.");
      await page
        .getByTestId("send")
        .and(page.locator('[data-mode="send"]'))
        .click();
      const chip = page.getByTestId("skill-chip").first();
      await expect(chip).toBeVisible({ timeout: 20000 });
      await expect(chip).toContainText(
        "Tarkista käyttöliittymän toimivuus ja saavutettavuus.",
      );
      await expect(chip).toContainText("synthetic-review");
      await expect(chip).not.toContainText("$ARGUMENTS");
      expect(
        (
          await new AxeBuilder({ page })
            .include('[data-testid="skill-chip"]')
            .analyze()
        ).violations,
      ).toEqual([]);
      const message = page.getByTestId("message").filter({ has: chip });
      await expect(message).toContainText("Tarkista myös mobiilinäkymä.");
      await expect(message).not.toContainText("<skill");
      await expect(message).not.toContainText(
        "Recorded instruction paragraph.",
      );
      await expect(message.getByTestId("expand-message")).toHaveCount(0);
      await field.fill("Luonnos säilyy.");
      // Wait until the composer is editable after the synthetic native turn.
      await expect(
        page.locator(".ah-agent-header .ah-status-neutral"),
      ).toBeVisible({ timeout: 20000 });
      const scroll = page.locator(".ah-conversation-stream");
      const before = await scroll.evaluate((node) => node.scrollTop);
      const base = testInfo.outputPath(`skill-${width}-${theme}`);
      await snapshot(page, `${base}-closed`, { labOrigin });
      await chip.focus();
      await page.keyboard.press("Enter");
      const panel = page.getByTestId("skill-panel");
      await expect(panel).toBeVisible();
      await expect(panel.getByTestId("guide-title")).toBeFocused();
      await expect(panel).not.toContainText("References are relative to");
      await expect(panel).not.toContainText("<skill");
      await expect(panel).not.toContainText("SKILL.md");
      await expect(panel).not.toContainText("$ARGUMENTS");
      await expect(panel.getByTestId("history-block-load")).toBeVisible();
      await snapshot(page, `${base}-open`, { labOrigin });
      expect(
        (
          await new AxeBuilder({ page })
            .include('[data-testid="skill-panel"]')
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.keyboard.press("Tab");
      expect(
        await panel.evaluate((node) => node.contains(document.activeElement)),
      ).toBe(true);
      while (await panel.getByTestId("history-block-load").count()) {
        await panel.getByTestId("history-block-load").click();
        await expect(
          panel
            .getByTestId("history-block-load")
            .and(page.locator('[aria-busy="true"]')),
        ).toHaveCount(0);
      }
      await expect(panel).toContainText("END OF RECORDED INSTRUCTION");
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(chip).toBeFocused();
      await expect(field).toHaveValue("Luonnos säilyy.");
      expect(await scroll.evaluate((node) => node.scrollTop)).toBe(before);
      await chip.click();
      await page.getByTestId("skill-close").click();
      await expect(chip).toBeFocused();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const name = `synthetic-review-no-description-${"long-name-".repeat(12)}`;
      await field.fill(`/skill:${name}`);
      await page
        .getByTestId("send")
        .and(page.locator('[data-mode="send"]'))
        .click();
      const fallback = page.getByTestId("skill-chip").last();
      await expect(page.getByTestId("skill-chip")).toHaveCount(2, {
        timeout: 20000,
      });
      await fallback.click();
      await expect(page.getByTestId("guide-title")).toHaveText(name);
      expect(
        await page
          .getByTestId("skill-panel")
          .evaluate((node) => node.scrollWidth <= node.clientWidth),
      ).toBe(true);
      await page.getByTestId("guide-back").click();
      await expect(fallback).toBeFocused();
      await page.reload();
      await expect(page.getByTestId("skill-chip")).toHaveCount(2);
      await expect(page.getByTestId("skill-chip").first()).toContainText(
        "Tarkista käyttöliittymän toimivuus ja saavutettavuus.",
      );
      await page.getByTestId("skill-chip").last().click();
      await expect(page.getByTestId("guide-title")).toHaveText(name);
      await page.keyboard.press("Escape");
      if (width === 1440 && theme === "light") {
        const argumentsText = `${"ä".repeat(20000)}ARGUMENT END`;
        await field.fill(`/skill:synthetic-review.v2 ${argumentsText}`);
        await page
          .getByTestId("send")
          .and(page.locator('[data-mode="send"]'))
          .click();
        await expect(page.getByTestId("skill-chip")).toHaveCount(3, {
          timeout: 20000,
        });
        await expect(
          page.locator(".ah-agent-header .ah-status-neutral"),
        ).toBeVisible({ timeout: 20000 });
        // Pi appends its reply after the user entry. Read a settled native
        // revision before exercising a full block, rather than bypassing its fence.
        await page.reload();
        await expect(page.getByTestId("skill-chip")).toHaveCount(3);
        const large = page
          .getByTestId("message")
          .filter({ has: page.getByTestId("skill-chip") })
          .last();
        await expect(large).not.toContainText("ARGUMENT END");
        await large.getByTestId("history-block-load").click();
        await expect(large).toContainText("ARGUMENT END");
        expect(
          await large
            .locator(".ah-user-text")
            .evaluate(
              (node, value) => node.textContent === value,
              argumentsText,
            ),
        ).toBe(true);
        await expect(large).not.toContainText("SKILL.md");
        await expect(large.getByTestId("history-block-load")).toHaveCount(0);
      }
    });
  }
}
