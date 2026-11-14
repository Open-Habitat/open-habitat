import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// Synthetic presentation only. The held-Graph Go regression proves that the
// real daemon retires the grant; this checks the browser's polling/rendering.
test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const width of [1280, 390]) {
  for (const theme of ["light", "dark"]) {
    test(`@a11y Microsoft single code, retirement and no folder step ${width} ${theme}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/settings");
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      let phase = "files";
      let started = false;
      const login = () => ({
        schema_version: 1,
        attempt_id: "20261023T120000.000000001",
        provider: "microsoft",
        relogin: false,
        state:
          phase === "files_discovery"
            ? "completing"
            : phase === "completed"
              ? "completed"
              : "device_code",
        ...(phase === "completed"
          ? { address: "person@example.test" }
          : { login_phase: phase }),
        ...(phase === "files"
          ? {
              user_code: "FIRST1234",
              verification_uri: "https://login.microsoft.com/device",
              expires_at: new Date(Date.now() + 900_000).toISOString(),
            }
          : {}),
      });
      await page.route("**/api/v1/integrations", (route) =>
        route.fulfill({
          json: {
            schema_version: 1,
            skill: "current",
            accounts: [],
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
          },
        }),
      );
      await page.route("**/api/v1/integrations/login*", (route) => {
        if (route.request().method() === "POST") started = true;
        return route.fulfill({
          json: started ? login() : { schema_version: 1, state: "none" },
        });
      });
      await page.goto("/settings/agent-data");
      await page.locator("html").evaluate((el, value) => {
        el.dataset.theme = value;
      }, theme);
      await page.getByTestId("integration-connect-open").click();
      await page.getByTestId("integration-continue").click();
      const dialog = page.getByTestId("integration-dialog");
      await expect(dialog.getByTestId("integration-device-code")).toHaveText(
        "FIRST1234",
      );
      for (const next of ["files", "files_discovery", "completed"]) {
        phase = next;
        if (next === "files") {
          await expect(
            dialog.getByTestId("integration-device-code"),
          ).toHaveText("FIRST1234");
          await expect(dialog.getByTestId("integration-steps")).toHaveCount(0);
        } else if (next === "files_discovery") {
          await expect(
            dialog.getByTestId("integration-login-wait"),
          ).toBeVisible();
          await expect(
            dialog.getByTestId("integration-device-code"),
          ).toHaveCount(0);
          await expect(
            dialog.getByTestId("integration-provider-link"),
          ).toHaveCount(0);
        } else {
          // Connected with no folder step: files are searched, not synced.
          await expect(
            dialog.getByTestId("integration-connected"),
          ).toBeVisible();
          await expect(dialog.getByTestId("integration-steps")).toHaveCount(0);
          await expect(
            dialog.getByTestId("integration-folder-onedrive"),
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
          process.env.OH_MICROSOFT_CAPTURE
            ? `${process.env.OH_MICROSOFT_CAPTURE}/${next}-${width}-${theme}`
            : testInfo.outputPath(`${next}-${width}-${theme}`),
          { labOrigin: new URL(page.url()).origin },
        );
      }
    });
  }
}
