import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// Production dialog and contract validation with synthetic responses. Native
// discovery, inventory ordering and admission are covered by the Go regressions.
test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const width of [1280, 390]) {
  for (const theme of ["light", "dark"]) {
    test(`@a11y unknown sizes, partial discovery and background admission ${width} ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/settings");
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      let active = false;
      let phase = "choose_folders";
      const choices: unknown[] = [];
      const view = () => ({
        schema_version: 1,
        state: phase,
        attempt_id: "20261022T120000.000000001",
        provider: "microsoft",
        address: "person@example.test",
        relogin: false,
        unavailable_sites: ["Unavailable team"],
        ...(phase === "choose_folders"
          ? {
              directory: "~/cloud/onedrive/person@example.test",

              quota_bytes: 50 * 1024 ** 3,
              folders: [
                { id: "onedrive", name: "OneDrive", suggested: true },
                { id: "sp_1", name: "SharePoint · Team", suggested: false },
              ],
            }
          : phase === "completing"
            ? {
                progress: {
                  phase: "inventory",
                  elapsed_seconds: 12,
                  bytes: 0,
                  total_bytes: 0,
                  files: 0,
                  total_files: 0,
                },
              }
            : { failure: "quota_insufficient" }),
      });
      await page.route("**/api/v1/integrations", (route) =>
        route.fulfill({
          json: {
            schema_version: 1,
            providers: [
              {
                id: "microsoft",
                available: true,
                login: "device_code",
                services: [
                  "onedrive",
                  "sharepoint",
                  "mail",
                  "calendar",
                  "contacts",
                ],
              },
            ],
            skill: "current",
            accounts:
              phase === "failed"
                ? [
                    {
                      provider: "microsoft",
                      address: "person@example.test",
                      checked_at: "2026-10-22T12:00:00Z",
                      services: [
                        {
                          id: "sharepoint",
                          state: "sync_failed",
                          failure: "quota_insufficient",
                          directory:
                            "~/cloud/sharepoint/team/person@example.test",
                          progress: {
                            service: "sharepoint",
                            phase: "inventory",
                            elapsed_seconds: 12,
                            bytes: 0,
                            total_bytes: 0,
                            files: 0,
                            total_files: 0,
                          },
                        },
                      ],
                    },
                  ]
                : [],
          },
        }),
      );
      await page.route("**/api/v1/integrations/login", (route) => {
        if (route.request().method() === "POST") active = true;
        if (route.request().method() === "PUT") {
          choices.push(route.request().postDataJSON().folders);
          phase = "completing";
        }
        return route.fulfill({
          json: active ? view() : { schema_version: 1, state: "none" },
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
        dialog.getByTestId("integration-folder-choice"),
      ).toBeVisible();
      await expect(
        dialog.getByTestId("integration-unavailable-sites"),
      ).toContainText("Unavailable team"); // native display name, not UI wording
      const start = dialog.getByTestId("integration-sync-start");
      const own = dialog
        .getByTestId("integration-folder-onedrive")
        .getByRole("checkbox");
      const team = dialog
        .getByTestId("integration-folder-sp_1")
        .getByRole("checkbox");
      await dialog.getByTestId("integration-folder-onedrive").click();
      await expect(own).not.toBeChecked();
      await expect(start).toBeDisabled();
      await expect(dialog.getByTestId("integration-capacity")).toHaveAttribute(
        "data-known",
        "false",
      );
      await dialog.getByTestId("integration-folder-sp_1").click();
      await expect(team).toBeChecked();
      await expect(start).toBeEnabled();
      for (const stage of ["choice", "inventory", "quota"]) {
        if (stage === "inventory") {
          await start.click();
          await expect(
            dialog.getByTestId("integration-sync-progress"),
          ).toBeVisible();
          expect(choices).toEqual([["sp_1"]]);
        } else if (stage === "quota") {
          phase = "failed";
          await expect(
            dialog.getByTestId("integration-quota-refusal"),
          ).toBeVisible({ timeout: 10000 });
          await expect(
            dialog.getByTestId("integration-sync-progress"),
          ).toHaveCount(0);
        }
        expect(
          (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
            .violations,
        ).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await snapshot(
          page,
          testInfo.outputPath(`${stage}-${width}-${theme}`),
          { labOrigin: new URL(page.url()).origin },
        );
      }
      await dialog.getByTestId("dialog-close").first().click();
      await page.reload();
      const card = page.getByTestId("integration-account-microsoft");
      await expect(
        card.getByTestId("integration-service-state"),
      ).toHaveAttribute("data-failure", "quota_insufficient");
      await expect(card.getByTestId("integration-sync-progress")).toHaveCount(
        0,
      );
      // The account column can be narrow even on a desktop viewport. Status
      // and actions must wrap instead of squeezing its native path/name.
      expect(
        await card.locator("code").evaluate((el) => {
          const line = Number.parseFloat(getComputedStyle(el).lineHeight);
          return el.getBoundingClientRect().height / line;
        }),
      ).toBeLessThan(4);

      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.locator("html").evaluate((el, value) => {
        el.dataset.theme = value;
      }, theme);
      await snapshot(
        page,
        testInfo.outputPath(`background-quota-${width}-${theme}`),
        { labOrigin: new URL(page.url()).origin },
      );
    });
  }
}
