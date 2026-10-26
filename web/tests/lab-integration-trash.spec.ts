import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { expect, test } from "./lab-host";

// Capture settled theme colors, not an intermediate color transition.
test.use({ reducedMotion: "reduce" });

for (const width of [1280, 390]) {
  for (const theme of ["light", "dark"]) {
    test(`@a11y integration files share the native Trash ${width} ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/settings");
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      await page.goto("/settings/agent-data");
      await page.locator("html").evaluate((el, value) => {
        el.dataset.theme = value;
      }, theme);
      const google = page.getByTestId("integration-tile-google");
      await google.getByTestId("integration-connect-open").click();
      const dialog = page.getByRole("dialog");
      await dialog.getByTestId("integration-continue").click();
      const popup = page.waitForEvent("popup");
      await dialog.getByTestId("integration-provider-link").click();
      await (await popup).close();
      await dialog
        .getByTestId("integration-redirect-input")
        .fill(
          "http://127.0.0.1:46399/oauth2/callback?state=lab&code=4/synthetic",
        );
      await dialog.getByTestId("integration-connect").click();
      await dialog.getByTestId("integration-sync-start").click();
      await expect(dialog.getByTestId("integration-connected")).toBeVisible();
      await dialog.getByTestId("integration-done").click();
      const card = page.getByTestId("integration-account-google");
      await card.getByTestId("integration-remove-open").click();
      const confirm = page.getByRole("alertdialog");
      await confirm.getByTestId("integration-remove-files").click();
      const out = resolve("../issues/trash-view-misses-integration-files");
      const capture = async (state: string) =>
        snapshot(page, `${out}/${state}-${width}-${theme}`, {
          labOrigin: new URL(page.url()).origin,
        });
      await capture("removal");
      expect(
        (
          await new AxeBuilder({ page })
            .include('[role="alertdialog"]')
            .analyze()
        ).violations,
      ).toEqual([]);
      await confirm.getByTestId("integration-remove-confirm").click();
      await expect(
        page.getByTestId("integration-removal-result"),
      ).toBeVisible();
      await page.goto("/settings/storage");
      await page.locator("html").evaluate((el, value) => {
        el.dataset.theme = value;
      }, theme);
      const row = page.getByTestId("trash-row-person.home@example.test");
      await expect(row).toBeVisible();
      await expect(row.getByTestId("restore-trash")).toBeEnabled();
      await expect(row).toContainText(
        "~/cloud/google-drive/person.home@example.test",
      );
      await capture("trash");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .exclude("[data-live-announcer]")
            .analyze()
        ).violations,
      ).toEqual([]);
      await row.getByTestId("restore-trash").click();
      await expect(row).toHaveCount(0);
      await expect(page.getByTestId("trash-empty")).toBeVisible();
      // Storage stays selected; a directory restore must not navigate to a fake workspace.
      await expect(page).toHaveURL(/\/settings\/storage$/);
    });
  }
}
