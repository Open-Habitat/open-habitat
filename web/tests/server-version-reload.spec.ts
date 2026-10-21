import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
}

test("@version open settings follow the running release across upgrades", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings");
  await page.getByTestId("settings-palvelin").click();
  const row = page.getByTestId("server-version");
  // The synthetic gateway's version and commit, not a deployed release.
  await expect(row.getByTestId("version-value")).toHaveText(
    "0.0.0-lab (0000000)",
  );
  await expect(
    row.locator('[data-testid="bundle-state"][data-state="current"]'),
  ).toBeVisible();
  await page.getByTestId("settings-tili").click();
  await expect(
    page.locator(".s-version-line").getByTestId("version-value"),
  ).toHaveText("0.0.0-lab (0000000)");
  // Settings stay mounted through two releases; each check re-reads the version.
  await page.getByTestId("settings-palvelin").click();
  for (const n of [1, 2]) {
    await page.request.get("/fixture/upgrade");
    await page.evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    await expect(row.getByTestId("version-value")).toHaveText(
      `0.0.0-lab.${n} (${String(n).repeat(7)})`,
    );
    await expect(
      row.locator('[data-testid="bundle-state"][data-state="newer"]'),
    ).toBeVisible();
  }
});

test("@version an open tab asks to reload after an upgrade, and the draft survives", async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole("navigation")
    .locator('a[data-testid^="workspace-"][data-workspace-name="ordinary-dir"]')
    .click();
  await page.getByTestId("conversation-start").click();
  const editor = page.getByTestId("message-input");
  await editor.fill("Puolivalmis luonnos");
  await expect(page.locator('[data-testid="version-banner"]')).toHaveCount(0);

  // A release switch: the gateway restarts with another version and serves a
  // bundle whose index.html names different asset URLs.
  await page.request.get("/fixture/upgrade");
  // Returning to the tab is what a person does after leaving it open.
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  const banner = page.getByTestId("version-banner");
  await expect(banner).toBeVisible();
  await expect(editor).toHaveValue("Puolivalmis luonnos");

  await banner.getByTestId("version-reload").click();
  await expect(
    page.locator("script[type=module][src*='?release=1']"),
  ).toHaveCount(1);
  await expect(page.getByTestId("message-input")).toHaveValue(
    "Puolivalmis luonnos",
  );
  await page.goto("/settings");
  await page.getByTestId("settings-palvelin").click();
  const row = page.getByTestId("server-version");
  await expect(row.getByTestId("version-value")).toHaveText(
    "0.0.0-lab.1 (1111111)",
  );
  await expect(
    row.locator('[data-testid="bundle-state"][data-state="current"]'),
  ).toBeVisible();
  await expect(page.locator('[data-testid="version-banner"]')).toHaveCount(0);
});
