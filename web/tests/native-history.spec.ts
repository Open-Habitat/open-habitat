import { expect, test } from "@playwright/test";
const host = "https://127.0.0.1:4174";
const agent = "pi:11111111-1111-4111-8111-111111111111";
test.use({
  baseURL: host,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});
async function fixture(page: import("@playwright/test").Page, mode: string) {
  expect(
    (await page.request.get(`/fixture/history?mode=${mode}`)).status(),
  ).toBe(204);
}
async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(
    page.getByRole("navigation", { name: "Workspacet ja agentit" }),
  ).toContainText("GitHub user 42");
}
test("@native-history native page, continuation, unknown, reopen and no writes", async ({
  page,
}) => {
  await fixture(page, "ready");
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") writes.push(r.url());
  });
  await login(page);
  await page.getByRole("button", { name: "Avaa ordinary-dir" }).click();
  await page.getByRole("link", { name: /Uusi keskustelu/ }).click();
  await expect(page).toHaveURL(`/agents/${agent}`);
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  await expect(
    page
      .locator(".ah-feed")
      .getByText("Synteettinen viesti 0", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Vain luku · Ohjausta ei ole")).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/history-happy.png",
    fullPage: true,
  });
  for (let i = 1; i < 11; i++)
    await page.getByRole("button", { name: "Lataa seuraava sivu" }).click();
  await expect(page.locator(".ah-feed li")).toHaveCount(251);
  await expect(page.getByText("Tuntematon tapahtuma")).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/history-long-unknown.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: "Lataa lisää sisältöä" }).click();
  await expect(page.locator(".ah-feed li").nth(248)).toContainText(
    "<script>alert('bad')</script>",
  );
  expect(await page.locator(".ah-feed script").count()).toBe(0);
  expect(writes).toHaveLength(0);
  await page.reload();
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  await expect(
    page
      .locator(".ah-feed")
      .getByText("Synteettinen viesti 0", { exact: true }),
  ).toBeVisible();
});
test("@native-history empty native session is read-only", async ({ page }) => {
  await fixture(page, "empty");
  await login(page);
  await page.goto(`/agents/${agent}`);
  await expect(
    page.getByText("Natiivissa historiassa ei ole vielä viestejä."),
  ).toBeVisible();
  await expect(page.locator(".ah-feed li")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/evidence/history-empty.png",
    fullPage: true,
  });
  await fixture(page, "ready");
});
test("@native-history mapped identity isolates native content", async ({
  page,
}) => {
  await fixture(page, "ready");
  await page.goto("/");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Bob" }).click();
  await page.goto(`/agents/${agent}`);
  await expect(page.locator(".ah-feed li").first()).toContainText(
    "Bobin synteettinen viesti 0",
  );
  const spoofed = await page.request.get(
    `/api/v1/agents/${agent}/history?limit=1`,
    {
      headers: {
        "X-Agent-Host-Identity": "wid_forged",
        "X-Agent-Host-Display-Name": "GitHub user 42",
      },
    },
  );
  expect(spoofed.status()).toBe(200);
  expect((await spoofed.json()).entries[0].content.text).toBe(
    "Bobin synteettinen viesti 0",
  );
  await expect(page.locator(".ah-feed")).not.toContainText(
    "Synteettinen viesti 0",
  );
});
test("@native-history missing, corrupt and read-only states", async ({
  page,
}) => {
  await fixture(page, "ready");
  await login(page);
  await page.goto(`/agents/${agent}`);
  await expect(
    page
      .locator(".ah-feed")
      .getByText("Synteettinen viesti 0", { exact: true }),
  ).toBeVisible();
  await fixture(page, "corrupt");
  await page.getByRole("button", { name: "Päivitä" }).click();
  await expect(page.getByText("Historiaa ei saada")).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/history-corrupt.png",
    fullPage: true,
  });
  await fixture(page, "missing");
  await page.getByRole("button", { name: "Päivitä" }).click();
  await expect(page.getByText("Keskustelua ei löydy")).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/history-missing.png",
    fullPage: true,
  });
  await fixture(page, "ready");
});
