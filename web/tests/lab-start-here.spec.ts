import AxeBuilder from "@axe-core/playwright";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

for (const width of [1440, 390]) {
  for (const theme of ["light", "dark"]) {
    test(`@lab @a11y start here: native goals, safe draft and acknowledgement ${width} ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.request.get("/fixture/conversations-reset");
      await page.request.get("/fixture/scenario?value=ready");
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page
        .getByRole("link")
        .and(page.locator('a[href*="code=42"]'))
        .click();
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);
      if (width === 390) await page.getByTestId("navigation-open").click();
      await page
        .getByRole("navigation")
        .getByTestId("workspace-start-aurinkokello")
        .click();
      await expect(page.getByTestId("command-palette")).toBeVisible();
      const field = page.getByTestId("message-input");
      const entry = page.getByTestId("skill-catalogue-open");
      await expect(page.getByTestId("starting-goal")).toHaveCount(1);
      await field.fill("Oma keskeneräinen ajatus.");
      if (
        (width === 390 && theme === "dark") ||
        (width === 1440 && theme === "light")
      ) {
        const { snapshot } = await import("../lab/session.mjs");
        await snapshot(
          page,
          `../issues/implement-start-here/evidence/entry-${width}-${theme}`,
          { labOrigin },
        );
      }
      await entry.focus();
      await page.keyboard.press("Enter");
      const catalogue = page.getByTestId("skill-catalogue");
      await expect(catalogue).toBeVisible();
      await expect(page.getByTestId("skill-cutoff")).toHaveAttribute(
        "data-first-view",
        "true",
      );
      await expect(page.getByTestId("skill-new")).toHaveCount(0);
      await page.getByTestId("skill-shelf").selectOption("repo");
      const cards = page.getByTestId("skill-card");
      await expect(cards).toHaveCount(1);
      await expect(cards.first()).toHaveAttribute(
        "data-command",
        "skill:pytest-debug",
      );
      await page.getByTestId("skill-search").fill("no-matching-task-fixture");
      await expect(cards).toHaveCount(0);
      await page.getByTestId("skill-search").fill("");
      await cards.first().locator("summary").first().focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("skill-try")).toBeVisible();
      const audit = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .analyze();
      expect(audit.violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (
        (width === 390 && theme === "dark") ||
        (width === 1440 && theme === "light")
      ) {
        const { snapshot } = await import("../lab/session.mjs");
        await snapshot(
          page,
          `../issues/implement-start-here/evidence/detail-${width}-${theme}`,
          { labOrigin },
        );
      }
      await page.getByTestId("skill-acknowledge").click();
      await expect(page.getByTestId("skill-cutoff")).toHaveAttribute(
        "data-first-view",
        "false",
      );
      await page.getByTestId("skill-try").click();
      await expect(catalogue).toBeHidden();
      // Native command/example and the person's draft are content contracts,
      // not UI copy. No send may happen as a side effect of trying a skill.
      await expect(field).toHaveValue(
        "Oma keskeneräinen ajatus.\n\n/skill:pytest-debug Mittaa ensin epäonnistuva tapaus.",
      );
      await expect(field).toBeFocused();
      await expect(page.getByTestId("user-message")).toHaveCount(0);
      await entry.click();
      await page.keyboard.press("Escape");
      await expect(entry).toBeFocused();
      await page.reload();
      await expect(page.getByTestId("command-palette")).toBeVisible();
      await expect(field).toHaveValue(
        "Oma keskeneräinen ajatus.\n\n/skill:pytest-debug Mittaa ensin epäonnistuva tapaus.",
      );
      await entry.click();
      await expect(page.getByTestId("skill-cutoff")).toHaveAttribute(
        "data-first-view",
        "false",
      );
    });
  }
}
