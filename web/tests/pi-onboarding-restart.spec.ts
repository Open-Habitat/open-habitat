import { expect, test } from "@playwright/test";

test.use({ baseURL: "https://127.0.0.1:4174", ignoreHTTPSErrors: true });
test("@pi-onboarding daemon restart invalidates old code, status stays authoritative", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.waitForTimeout(2200); // Previous synthetic helper must be reaped.
  await page.request.get("/fixture/pi-state?value=missing");
  try {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
    await page.getByRole("button", { name: "Aloita kirjautuminen" }).click();
    await expect(page.getByText("ABCD-1234")).toBeVisible();
    expect((await page.request.get("/fixture/pi-restart")).status()).toBe(204);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Yhdistä Pi ChatGPT-tilaukseen" }),
    ).toBeVisible();
    await expect(page.getByText("ABCD-1234")).toHaveCount(0);
    expect((await page.request.get("/api/v1/snapshot")).status()).toBe(428);
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
