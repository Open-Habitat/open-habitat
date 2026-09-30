import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "@playwright/test";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function signIn(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  // A direct native URL skips the optional repository chooser.
  await expect(
    page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
  ).toBeVisible();
}

test("@pi-onboarding direct native routes show OpenAI check failure and recover only on native usable", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  try {
    await page.request.get("/fixture/pi-state?value=unknown");
    await page.goto("/agents/pi:11111111-1111-4111-8111-111111111111");
    await signIn(page);
    await expect(
      page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
    ).toBeVisible();
    await expect(page.getByText("Tilaa ei voitu vahvistaa")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Aloita kirjautuminen" }),
    ).toHaveCount(0);
    await expect(page.getByText("git-project")).toHaveCount(0);
    for (const url of [
      "/api/v1/snapshot",
      "/api/v1/agents/pi:11111111-1111-4111-8111-111111111111/history?limit=1",
      "/api/v1/content/ct_abcdefgh?offset=0&limit_bytes=100",
      "/api/v1/conversations",
    ]) {
      expect((await page.request.get(url)).status()).toBe(428);
    }
    await page.getByRole("button", { name: "Tarkista tila" }).click();
    await expect(page.getByText("Tilaa ei voitu vahvistaa")).toBeVisible();
    await page.request.get("/fixture/pi-state?value=missing");
    await page.getByRole("button", { name: "Tarkista tila" }).click();
    await expect(
      page.getByRole("button", { name: "Aloita kirjautuminen" }),
    ).toBeVisible();
    await page.request.get("/fixture/pi-state?value=usable");
    await page.reload();
    await expect(page.getByText("git-project").first()).toBeVisible();
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
