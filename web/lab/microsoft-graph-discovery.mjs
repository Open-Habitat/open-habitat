// Synthetic generic-failure presentation only; Graph HTTP behavior is covered in Go.
import { snapshot } from "./session.mjs";
import AxeBuilder from "@axe-core/playwright";
import { labOrigin } from "../test-ports.mjs";

export async function captureGraphFailure(page, expect) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${labOrigin}/settings`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").first().click();
  await page.goto(`${labOrigin}/settings/integrations`);
  await page
    .getByTestId("integration-tile-microsoft")
    .getByTestId("integration-connect-open")
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("integration-continue").click();
  await expect(dialog.getByTestId("integration-device-code")).toBeVisible();
  const current = await (
    await page.request.get(`${labOrigin}/api/v1/integrations/login`)
  ).json();
  // The browser receives only the fixed failure code, not Graph diagnostics.
  await page.route("**/api/v1/integrations/login", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      json: {
        schema_version: 1,
        state: "failed",
        attempt_id: current.attempt_id,
        provider: "microsoft",
        failure: "tool_failed",
      },
    });
  });
  await expect(dialog.getByRole("alert")).toBeVisible();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      expect(
        (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
          .violations,
      ).toEqual([]);
      await snapshot(
        page,
        `../issues/microsoft-graph-discovery-fails/evidence/failure-${width}-${theme}`,
        { labOrigin },
      );
    }
  }
}
