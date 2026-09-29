import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "@playwright/test";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
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
    await page.getByRole("button", { name: /jatka/i }).click();
    await page.getByRole("button", { name: "Aloita kirjautuminen" }).click();
    await expect(page.getByText("ABCD-1234")).toBeVisible();
    expect((await page.request.get("/fixture/pi-restart")).status()).toBe(204);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
    ).toBeVisible();
    await expect(page.getByText("ABCD-1234")).toHaveCount(0);
    expect((await page.request.get("/api/v1/snapshot")).status()).toBe(428);
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});

test("@pi-onboarding expired lease drops code and offers retry", async ({
  page,
}, testInfo) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.waitForTimeout(2200);
  await page.request.get("/fixture/pi-state?value=missing");
  try {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
    await page.getByRole("button", { name: /jatka/i }).click();
    await page.getByRole("button", { name: "Aloita kirjautuminen" }).click();
    await expect(page.getByText("ABCD-1234")).toBeVisible();
    // A lost lease returns the same 404 as a real five-minute expiry.
    await page.request.get("/fixture/pi-restart");
    await expect(page.getByText("Kirjautumisyritys päättyi")).toBeVisible({
      timeout: 9000,
    });
    await expect(page.getByText("ABCD-1234")).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("pi-expired-code.png"),
      fullPage: true,
    });
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
