import { expect, type Page, test } from "@playwright/test";

const host = "https://127.0.0.1:4174";
test.use({ baseURL: host, ignoreHTTPSErrors: true });
async function login(page: Page, name: "Alice" | "Bob" = "Alice") {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name }).click();
  await page.getByRole("button", { name: "Jatka" }).click();
}
async function scenario(page: Page, value: string) {
  expect(
    (await page.request.get(`/fixture/scenario?value=${value}`)).status(),
  ).toBe(204);
}
test("@pi-onboarding native attempt drives the production browser, never a callback", async ({
  browser,
}, testInfo) => {
  const a = await browser.newContext({
    baseURL: host,
    ignoreHTTPSErrors: true,
  });
  const b = await browser.newContext({
    baseURL: host,
    ignoreHTTPSErrors: true,
  });
  const page = await a.newPage();
  const foreign = await b.newPage();
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  try {
    await scenario(page, "pi-onboarding");
    // The preceding synthetic case may still be reaping its helper.
    await page.waitForTimeout(2200);
    await page.request.get("/fixture/pi-state?value=missing");
    await login(page);
    await expect(
      page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
    ).toBeVisible();
    await expect(page.getByText("git-project")).toHaveCount(0);
    expect((await page.request.get("/api/v1/snapshot")).status()).toBe(428);
    expect(
      (
        await page.request.get(
          "/api/v1/agents/pi:11111111-1111-4111-8111-111111111111/history?limit=1",
        )
      ).status(),
    ).toBe(428);
    await page.getByRole("button", { name: "Aloita kirjautuminen" }).click();
    await expect(page.getByText("ABCD-1234")).toBeVisible();
    expect(page.url()).not.toContain("ABCD-1234");
    await page.screenshot({
      path: testInfo.outputPath("pi-device-code.png"),
      fullPage: true,
    });
    await login(foreign, "Bob");
    await expect(foreign.getByText("ABCD-1234")).toHaveCount(0);
    expect(
      (await foreign.request.get("/api/v1/onboarding/pi/attempt")).status(),
    ).toBe(404);
    await page.request.get("/fixture/pi-state?value=usable");
    await expect(page.getByRole("heading", { name: "Workspacet" })).toBeVisible(
      { timeout: 12000 },
    );
    await expect(page.getByText("ABCD-1234")).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("pi-workspaces.png"),
      fullPage: true,
    });
    expect(errors.join(" ")).not.toContain("ABCD-1234");
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await scenario(page, "ready");
    await a.close();
    await b.close();
  }
});

test("@pi-onboarding cancel, unknown, expiry and stale session fail closed", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: host,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  try {
    await scenario(page, "pi-onboarding");
    await page.waitForTimeout(2200);
    await page.request.get("/fixture/pi-state?value=missing");
    await login(page);
    await page.getByRole("button", { name: "Aloita kirjautuminen" }).click();
    await expect(page.getByText("ABCD-1234")).toBeVisible();
    await page
      .getByRole("button", { name: "Peruuta kirjautumisyritys" })
      .click();
    await expect(page.getByText("ABCD-1234")).toHaveCount(0);
    await page.request.get("/fixture/pi-state?value=unknown");
    await expect(
      page.getByRole("heading", { name: "Kirjautuminen keskeytyi" }),
    ).toBeVisible({ timeout: 9000 });
    await page.getByRole("button", { name: "Tarkista tila" }).click();
    await expect(page.getByText("Workspacet", { exact: true })).toHaveCount(0);
    await page.request.get("/fixture/expire");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
    ).toBeVisible();
    await expect(page.getByText("ABCD-1234")).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("pi-expired-session.png"),
      fullPage: true,
    });
  } finally {
    await page.request.get("/fixture/reset-clock");
    await page.request.get("/fixture/pi-state?value=missing");
    await scenario(page, "ready");
    await context.close();
  }
});
