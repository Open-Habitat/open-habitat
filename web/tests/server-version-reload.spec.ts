import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
}

test("@version Palvelin shows the running release and that this tab is current", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Palvelin", exact: true }).click();
  const row = page.locator(".s-row").filter({ hasText: "Versio" });
  // The synthetic gateway's version and commit, not a deployed release.
  await expect(row.getByText("0.0.0-lab (0000000)")).toBeVisible();
  await expect(row.getByText("Tämä välilehti on ajan tasalla.")).toBeVisible();
  await page.getByRole("button", { name: "Tili", exact: true }).click();
  await expect(page.locator(".s-version-line")).toContainText(
    "Palvelimen versio: 0.0.0-lab (0000000)",
  );
});

test("@version an open tab asks to reload after an upgrade, and the draft survives", async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir", exact: true })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await editor.fill("Puolivalmis luonnos");
  await expect(page.getByText("Uusi versio on saatavilla")).toHaveCount(0);

  // A release switch: the gateway restarts with another version and serves a
  // bundle whose index.html names different asset URLs.
  await page.request.get("/fixture/upgrade");
  // Returning to the tab is what a person does after leaving it open.
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  const banner = page.locator(".ah-connection").filter({
    hasText: "Uusi versio on saatavilla",
  });
  await expect(banner).toBeVisible();
  await expect(editor).toHaveValue("Puolivalmis luonnos");

  await banner.getByRole("button", { name: "Lataa uudelleen" }).click();
  await expect(
    page.locator("script[type=module][src*='?release=1']"),
  ).toHaveCount(1);
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveValue("Puolivalmis luonnos");
  await page.goto("/settings");
  await page.getByRole("button", { name: "Palvelin", exact: true }).click();
  const row = page.locator(".s-row").filter({ hasText: "Versio" });
  await expect(row.getByText("0.0.0-lab.1 (1111111)")).toBeVisible();
  await expect(row.getByText("Tämä välilehti on ajan tasalla.")).toBeVisible();
  await expect(page.getByText("Uusi versio on saatavilla")).toHaveCount(0);
});
