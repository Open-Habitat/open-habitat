import { expect, test } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
test("@github-first denied write stays uncertain until explicit read-only recheck", async ({
  page,
}, testInfo) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page.getByRole("checkbox").first().check();
  const before = Number(
    await (await page.request.get("/fixture/clone-count")).text(),
  );
  await page.route("**/api/v1/onboarding/github/clone/stream", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: '{"error":"access_denied"}',
    }),
  );
  await page.getByRole("button", { name: /jatka/i }).click();
  await expect(page.getByText("Haun tulos on epäselvä")).toBeVisible();
  await expect(page.getByRole("button", { name: /jatka/i })).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("github-denied.png"),
    fullPage: true,
  });
  await expect(page.getByText("Haun tila vaatii tarkistusta")).toBeVisible();
  await page
    .getByRole("button", { name: "Tarkista haun tila uudelleen" })
    .click();
  await expect(page.getByRole("button", { name: /jatka/i })).toBeVisible();
  expect(
    Number(await (await page.request.get("/fixture/clone-count")).text()),
  ).toBe(before);
  await page.request.get("/fixture/scenario?value=ready");
});
