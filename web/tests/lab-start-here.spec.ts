import AxeBuilder from "@axe-core/playwright";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const width of [1440, 390]) {
  for (const theme of ["light", "dark"]) {
    test(`@lab @a11y authored start page and safe draft ${width} ${theme}`, async ({
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
      const field = page.getByTestId("message-input");
      await expect(page.getByTestId("starting-goal")).toHaveCount(2);
      // Repository-authored content is a contract, not product wording.
      await expect(page.getByTestId("start-page-title")).toHaveText(
        "Synthetic repository title.",
      );
      await expect(
        page.getByTestId("start-page-body").locator("strong"),
      ).toHaveText("Synthetic repository introduction.");
      const sent: string[] = [];
      page.on("request", (r) => {
        if (
          r.method() === "POST" &&
          /\/(send|steer|follow_up)$/.test(new URL(r.url()).pathname)
        )
          sent.push(r.url());
      });
      await field.fill("Oma keskeneräinen ajatus.");
      await page.getByTestId("starting-goal").first().focus();
      await page.keyboard.press("Enter");
      await expect(field).toHaveValue(
        "/skill:pytest-debug A prompt from the start page.\n\nOma keskeneräinen ajatus.",
      );
      await expect(field).toBeFocused();
      await field.fill("Oma keskeneräinen ajatus.");
      await page.getByTestId("starting-goal").nth(1).click();
      await expect(field).toHaveValue(
        "Explain this repository.\n\nOma keskeneräinen ajatus.",
      );
      await expect(field).toBeFocused();
      expect(sent).toEqual([]);
      await expect(page.getByTestId("user-content")).toHaveCount(0);
      const audit = await new AxeBuilder({ page })
        .include('[data-testid="start-here"]')
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
          `../issues/start-page-skill/evidence/page-${width}-${theme}`,
          { labOrigin },
        );
      }
      await page.reload();
      await expect(field).toHaveValue(
        "Explain this repository.\n\nOma keskeneräinen ajatus.",
      );
      await page.goto("/workspaces");
      if (width === 390) await page.getByTestId("navigation-open").click();
      await page
        .getByRole("navigation")
        .getByTestId("workspace-start-muistiinpanot")
        .click();
      await expect(page.getByTestId("start-page-hint")).toBeVisible();
      await expect(page.getByTestId("starting-goal")).toHaveCount(0);
      await expect(page.getByTestId("start-page-title")).toHaveCount(0);
    });
  }
}
