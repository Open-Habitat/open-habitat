import { expect, test } from "@playwright/test";
const host = "https://127.0.0.1:4174";
test.use({
  baseURL: host,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});
async function open(page: import("@playwright/test").Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page.getByRole("link", { name: "ordinary-dir" }).click();
  await expect(
    page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
  ).toBeEnabled();
}
test("@browser-conversation create, send once, reconnect and old history stays read-only", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(page).toHaveURL(/conversation=pi%3A|conversation=pi:/);
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Synteettinen testipyyntö");
  let sends = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/send")) sends++;
  });
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByText("Viesti odottaa natiivia hyväksyntää"),
  ).toBeVisible();
  expect(sends).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  await expect(
    page.getByText("Viesti odottaa natiivia hyväksyntää"),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/evidence/browser-conversation-reconnect.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Pyydä pysäytystä" }).click();
  await expect(
    page.getByText(/Työkalujen päättymistä ei ole vahvistettu/),
  ).toBeVisible();
  await page.goto("/agents/pi:11111111-1111-4111-8111-111111111111");
  await expect(page.getByText("Vain luku · Ohjausta ei ole")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveCount(0);
});
test("@browser-conversation lost create acknowledgement blocks duplicate creation", async ({
  page,
}) => {
  await open(page);
  let attempts = 0;
  await page.route("**/api/v1/conversations", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    attempts++;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(page.getByText(/Luonnin tulos epävarma/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Tarkista keskustelulista" }).click();
  expect(attempts).toBe(1);
});
test("@browser-conversation uncertain send survives reload without duplicate", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Älä lähetä toistamiseen");
  let attempts = 0;
  await page.route("**/api/v1/conversations/*/send", async (route) => {
    attempts++;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(page.getByText(/Lähetyksen tulos epävarma/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Aiemman pyynnön tulos epävarma")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveValue("Älä lähetä toistamiseen");
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeDisabled();
  expect(attempts).toBe(1);
  await page.screenshot({
    path: "test-results/evidence/browser-conversation-uncertain.png",
    fullPage: true,
  });
});
