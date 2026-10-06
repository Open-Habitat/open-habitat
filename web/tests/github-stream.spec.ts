import { expect, test } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
test("@github-first synthetic slow native clone exposes per-repository receiving stage", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  try {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: /jatka/i }).click();
    await expect(page.getByText(/Vastaanotetaan objekteja/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Kirjaudu OpenAI-tiliisi" }),
    ).toBeVisible();
  } finally {
    await page.request.get("/fixture/checkout?name=first&mode=absent");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
