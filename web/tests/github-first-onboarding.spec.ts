import { expect, test } from "@playwright/test";

const host = "https://127.0.0.1:4174";
test.use({ baseURL: host, ignoreHTTPSErrors: true });
async function login(page: import("@playwright/test").Page) {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(
    page.getByRole("heading", { name: "Valitse GitHub-repot haettaviksi" }),
  ).toBeVisible();
}
test("@github-first native synthetic checkout before Pi, page continuation and existing checkout", async ({
  page,
}, testInfo) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await login(page);
  expect((await page.request.get("/api/v1/snapshot")).status()).toBe(428);
  expect(
    (
      await page.request.get(
        "/api/v1/agents/pi:11111111-1111-4111-8111-111111111111/history?limit=1",
      )
    ).status(),
  ).toBe(428);
  await expect(page.getByText("fixture/first")).toBeVisible();
  await page.getByRole("button", { name: "Näytä lisää repoja" }).click();
  await expect(
    page.getByRole("button", { name: "Näytä lisää repoja" }),
  ).toHaveCount(0);
  await page.getByRole("checkbox").first().check();
  await page.screenshot({
    path: testInfo.outputPath("github-happy.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Jatka" }).click();
  await expect(
    page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
  ).toBeVisible();
  const observation = await page.request.get(
    "/api/v1/onboarding/github/checkout?full_name=fixture%2Ffirst",
  );
  expect((await observation.json()).state).toBe("confirmed");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
  ).toBeVisible();
  await page.request.get("/fixture/pi-state?value=usable");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Workspacet" })).toBeVisible();
  await page.request.get("/fixture/pi-state?value=missing");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
  ).toBeVisible();
  await page.request.get("/fixture/scenario?value=ready");
});

test("@github-first empty selection goes directly to Pi", async ({ page }) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await login(page);
  await page.getByRole("button", { name: "Jatka" }).click();
  await expect(
    page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
  ).toBeVisible();
  await page.request.get("/fixture/scenario?value=ready");
  await page.request.get("/fixture/pi-state?value=usable");
});
