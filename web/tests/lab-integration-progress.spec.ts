import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// Synthetic presentation observations; native parsing, deadlines and ownership
// are exercised in the integrations Go package, without provider credentials.
test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const width of [1280, 390]) {
  for (const theme of ["light", "dark"]) {
    test(`@a11y background sync survives dialog and Settings navigation ${width} ${theme}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/settings");
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      const progress = {
        phase: "transferring",
        elapsed_seconds: 82,
        bytes: 2 * 1024 ** 3,
        total_bytes: 8 * 1024 ** 3,
        files: 214,
        total_files: 880,
      };
      let state = "syncing";
      let started = false;
      const login = {
        schema_version: 1,
        state: "completing",
        attempt_id: "20261022T120000.000000001",
        provider: "dropbox",
        address: "person@example.test",
        relogin: false,
        progress,
      };
      const cancellations: string[] = [];
      await page.route("**/api/v1/integrations", (route) =>
        route.fulfill({
          json: {
            schema_version: 1,
            providers: [
              {
                id: "dropbox",
                available: true,
                login: "pasted_redirect",
                services: ["dropbox"],
              },
            ],
            skill: "current",
            accounts: started
              ? [
                  {
                    provider: "dropbox",
                    address: "person@example.test",
                    checked_at: "2026-10-22T12:00:00Z",
                    services: [
                      {
                        id: "dropbox",
                        state,
                        directory: "~/cloud/dropbox/person@example.test",
                        ...(state === "ok" ? {} : { progress }),
                      },
                    ],
                  },
                ]
              : [],
          },
        }),
      );
      await page.route("**/api/v1/integrations/login", (route) => {
        if (route.request().method() === "DELETE") {
          cancellations.push("cancel");
          state = "sync_failed";
          return route.fulfill({
            json: { ...login, state: "failed", failure: "cancelled" },
          });
        }
        if (route.request().method() === "POST") started = true;
        return route.fulfill({
          json: started ? login : { schema_version: 1, state: "none" },
        });
      });
      await page.goto("/settings/integraatiot");
      await page.locator("html").evaluate((el, value) => {
        el.dataset.theme = value;
      }, theme);
      await page.getByTestId("integration-connect-open").click();
      await page.getByTestId("integration-continue").click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByTestId("integration-sync-progress"),
      ).toBeVisible();
      expect(
        (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
          .violations,
      ).toEqual([]);
      await snapshot(
        page,
        testInfo.outputPath(`sync-dialog-${width}-${theme}`),
        { labOrigin: new URL(page.url()).origin },
      );
      await dialog.getByTestId("dialog-close").click();
      await expect(dialog).toHaveCount(0);
      const card = page.getByTestId("integration-account-dropbox");
      await expect(card.getByTestId("integration-sync-progress")).toBeVisible();
      expect(cancellations).toEqual([]);
      // Counters must not squeeze the directory to a character-wide column.
      expect(
        await card.locator("code").evaluate((el) => {
          const line = Number.parseFloat(getComputedStyle(el).lineHeight);
          return el.getBoundingClientRect().height / line;
        }),
      ).toBeLessThan(6);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await snapshot(
        page,
        testInfo.outputPath(`sync-background-${width}-${theme}`),
        { labOrigin: new URL(page.url()).origin },
      );
      // Returning to Settings must not reopen the dialog or lose progress.
      await page.goto("/settings");
      await page.goto("/settings/integraatiot");
      await expect(dialog).toHaveCount(0);
      await expect(card.getByTestId("integration-sync-progress")).toBeVisible();
      state = "sync_failed";
      await expect(
        card.getByTestId("integration-service-state"),
      ).toHaveAttribute("data-state", "sync_failed", { timeout: 20000 });
      await expect(card.getByTestId("integration-reauth")).toBeVisible();
      // A later fresh native observation (e.g. after explicit repair) is final.
      state = "ok";
      await card.getByTestId("integration-recheck").click();
      await expect(
        card.getByTestId("integration-service-state"),
      ).toHaveAttribute("data-state", "ok");
      await expect(card.getByTestId("integration-sync-progress")).toHaveCount(
        0,
      );
      expect(cancellations).toEqual([]);
      if (width === 1280 && theme === "light") {
        state = "syncing";
        await page.goto("/settings/integraatiot");
        await card.getByTestId("integration-sync-stop").click();
        await expect(
          card.getByTestId("integration-service-state"),
        ).toHaveAttribute("data-state", "sync_failed");
        expect(cancellations).toEqual(["cancel"]);
      }
    });
  }
}
