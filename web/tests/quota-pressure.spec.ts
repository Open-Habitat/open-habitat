import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("quota warning, full storage and recovery keep the conversation mounted without resending @a11y", async ({
  page,
}) => {
  let usage = 91;
  await page.route("**/api/v1/account/storage", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        usage_bytes: usage * 1024 ** 2,
        limit_bytes: 100 * 1024 ** 2,
      },
    }),
  );
  await page.request.get("/fixture/history?mode=short");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await expect(page.getByText(/Tallennustilasi on lähes täynnä/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: /Synteettinen viesti 0/ })
    .click();
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  const conversationURL = page.url();
  let historyUnavailable = true;
  await page.route("**/api/v1/agents/*/history?*", (route) =>
    historyUnavailable ? route.fulfill({ status: 503 }) : route.continue(),
  );
  usage = 100;
  await page.getByRole("button", { name: "Tarkista vapautettu tila" }).click();
  await expect(page.getByText(/Tallennustilasi on täynnä/)).toBeVisible();
  await expect(page.getByText("Historia on vanhentunut")).toHaveCount(0);
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  await page
    .getByRole("button", { name: "Asetukset › Tallennustila ja roskakori" })
    .click();
  await expect(page).toHaveURL(/settings\/tallennustila/);
  await expect(
    page.getByRole("heading", { name: "Tallennustila", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Viestejä ei lähetetä uudelleen automaattisesti.", {
      exact: false,
    }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() !== "GET") writes++;
  });
  await page.goto(conversationURL);
  await expect(page.getByText(/Tallennustilasi on täynnä/)).toBeVisible();
  historyUnavailable = false;
  usage = 25;
  await page.getByRole("button", { name: "Tarkista vapautettu tila" }).click();
  await expect(
    page.getByText(/Tallennustilasi on (lähes )?täynnä/),
  ).toHaveCount(0);
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  expect(writes).toBe(0);
});
