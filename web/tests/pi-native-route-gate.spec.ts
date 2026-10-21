import { expect, test } from "./worker-host";
import { hostOrigin } from "../test-ports.mjs";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function signIn(page: import("@playwright/test").Page) {
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  // A direct native URL skips the optional repository chooser.
  await expect(
    page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
  ).toBeVisible();
}

test("@pi-onboarding browser checks OpenAI once while direct native reads remain mapped", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  try {
    await page.request.get("/fixture/pi-state?value=unknown");
    await page.goto("/agents/pi:11111111-1111-4111-8111-111111111111");
    await signIn(page);
    await expect(
      page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
    ).toBeVisible();
    await expect(page.getByTestId("pi-attempt-uncertain")).toBeVisible();
    await expect(
      page.getByRole("button").and(page.getByTestId("pi-attempt-start")),
    ).toHaveCount(0);
    await expect(page.getByTestId("workspace-git-project")).toHaveCount(0);
    for (const url of [
      "/api/v1/snapshot",
      "/api/v1/agents/pi:11111111-1111-4111-8111-111111111111/history?limit=1",
      "/api/v1/agents/pi:11111111-1111-4111-8111-111111111111/entries/missing/blocks/0?revision=missing&offset=0&limit_bytes=100",
      "/api/v1/conversations",
    ]) {
      expect((await page.request.get(url)).status()).toBe(
        url ===
          "/api/v1/agents/pi:11111111-1111-4111-8111-111111111111/entries/missing/blocks/0?revision=missing&offset=0&limit_bytes=100"
          ? 404
          : 200,
      );
    }
    await page
      .getByRole("button")
      .and(page.getByTestId("notice-action"))
      .click();
    // Wait for the unknown check to settle before changing the native fixture.
    await expect(
      page.getByRole("button").and(page.getByTestId("notice-action")),
    ).toBeVisible();
    await page.request.get("/fixture/pi-state?value=missing");
    await expect(
      page.getByRole("button").and(page.getByTestId("notice-action")),
    ).toBeVisible();
    await page
      .getByRole("button")
      .and(page.getByTestId("notice-action"))
      .click();
    await expect(
      page.getByRole("button").and(page.getByTestId("pi-attempt-start")),
    ).toBeVisible();
    await page.request.get("/fixture/pi-state?value=usable");
    await page.reload();
    await expect(
      page.getByTestId("workspace-git-project").first(),
    ).toBeVisible();
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
