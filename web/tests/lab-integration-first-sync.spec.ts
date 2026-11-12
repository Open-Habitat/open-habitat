import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// Synthetic presentation of a Microsoft account during its first file sync.
// That the daemon asks no tool and reports pending_first_sync while the pass
// runs is covered by the integrations Go package.
test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const [width, theme] of [
  [1280, "light"],
  [390, "dark"],
] as const) {
  test(`@a11y services beside a first sync wait without a warning ${width} ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/settings");
    await page.getByTestId("github-sign-in").click();
    await page.locator('a[href*="code=42"]').click();
    let passRunning = true;
    const tools = ["sharepoint", "mail", "calendar", "contacts"];
    await page.route("**/api/v1/integrations", (route) =>
      route.fulfill({
        json: {
          schema_version: 1,
          providers: [
            {
              id: "microsoft",
              available: true,
              login: "device_code",
              services: ["onedrive", ...tools],
            },
          ],
          skill: "current",
          accounts: [
            {
              provider: "microsoft",
              address: "person@example.test",
              checked_at: "2026-11-12T12:00:00Z",
              services: [
                {
                  id: "onedrive",
                  state: passRunning ? "syncing" : "ok",
                  directory: "~/cloud/onedrive/person@example.test",
                  ...(passRunning
                    ? {
                        progress: {
                          service: "onedrive",
                          phase: "transferring",
                          elapsed_seconds: 960,
                          bytes: 2 * 1024 ** 3,
                          total_bytes: 8 * 1024 ** 3,
                          files: 214,
                          total_files: 880,
                        },
                      }
                    : {}),
                },
                ...tools.map((id) => ({
                  id,
                  state: passRunning ? "pending_first_sync" : "ok",
                })),
              ],
            },
          ],
        },
      }),
    );
    await page.route("**/api/v1/integrations/login*", (route) =>
      route.fulfill({ json: { schema_version: 1, state: "none" } }),
    );
    await page.goto("/settings/agent-data");
    await page.locator("html").evaluate((el, value) => {
      el.dataset.theme = value;
    }, theme);
    const card = page.getByTestId("integration-account-microsoft");
    await expect(card.getByTestId("integration-sync-progress")).toBeVisible();
    const states = card.getByTestId("integration-service-state");
    const pending = card.locator(
      '[data-testid="integration-service-state"][data-state="pending_first_sync"]',
    );
    await expect(pending).toHaveCount(tools.length);
    // Waiting for the first sync is not a fault: no warning or error styling,
    // which "unknown" carried before.
    for (const row of await pending.all()) {
      await expect(row).not.toHaveClass(/\b(warn|bad)\b/);
    }
    // Nor does a service that was not checked show a check time.
    await expect(card.getByTestId("integration-checked-at")).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await snapshot(page, testInfo.outputPath(`first-sync-${width}-${theme}`), {
      labOrigin: new URL(page.url()).origin,
    });
    // After the pass the services carry their checked state.
    passRunning = false;
    await card.getByTestId("integration-recheck").click();
    await expect(pending).toHaveCount(0);
    await expect(states.and(page.locator('[data-state="ok"]'))).toHaveCount(
      tools.length + 1,
    );
    await expect(card.getByTestId("integration-checked-at")).toHaveCount(
      tools.length,
    );
  });
}
