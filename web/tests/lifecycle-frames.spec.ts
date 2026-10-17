import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("@browser-conversation repeated completed turns do not become Pi messages", async ({
  page,
}) => {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  for (let i = 1; i <= 4; i++) {
    await page
      .getByRole("textbox", { name: "Viesti Pi:lle" })
      .fill(`Vuoro ${i}`);
    await page.getByRole("button", { name: "Lähetä", exact: true }).click();
    await expect(
      page.getByText(`Selvä. Kysyit: "Vuoro ${i}".`, { exact: false }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Keskeytä" })).toHaveCount(0);
    await expect(page.getByText("Muu Pi:n viesti")).toHaveCount(0);
  }
  await page.reload();
  await expect(page.getByText("Muu Pi:n viesti")).toHaveCount(0);
});
