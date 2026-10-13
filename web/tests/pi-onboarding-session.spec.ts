import { expect, test } from "./worker-host";
import { hostOrigin } from "../test-ports.mjs";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
test("@pi-onboarding switching sessions drops device instructions and native facts", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  try {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
    await page.getByRole("button", { name: /jatka/i }).click();
    await page.getByRole("button", { name: "Aloita kirjautuminen" }).click();
    await expect(page.getByText("ABCD-1234")).toBeVisible();
    await page
      .getByRole("button", { name: "Keskeytä käyttöönotto ja kirjaudu ulos" })
      .click();
    await page
      .getByRole("button", { name: "Kirjaudu ulos", exact: true })
      .click();
    await expect(page.getByText("ABCD-1234")).toHaveCount(0);
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Bob" }).click();
    await page.getByRole("button", { name: /jatka/i }).click();
    await expect(
      page.getByRole("heading", { name: "Kirjaudu OpenAI-tiliisi" }),
    ).toBeVisible();
    await expect(page.getByText("ABCD-1234")).toHaveCount(0);
    expect(
      (await page.request.get("/api/v1/onboarding/pi/attempt")).status(),
    ).toBe(404);
    expect((await page.request.get("/api/v1/snapshot")).status()).toBe(200);
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
