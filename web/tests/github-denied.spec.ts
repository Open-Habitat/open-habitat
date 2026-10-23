import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity, passGoogle } from "./git-identity-helper";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
test("@github-first a refused start is reported in the AI step and retried only on request", async ({
  page,
}, testInfo) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await confirmGitIdentity(page);
  await page.getByRole("checkbox").first().check();
  const before = Number(
    await (await page.request.get("/fixture/clone-count")).text(),
  );
  await page.route("**/api/v1/onboarding/github/clones", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 403,
          contentType: "application/json",
          body: '{"error":"access_denied"}',
        })
      : route.continue(),
  );
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-proceed"))
    .click();
  await passGoogle(page);
  await expect(
    page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
  ).toBeVisible();
  const row = page
    .getByRole("listitem")
    .and(page.getByTestId("onboarding-clone"));
  await expect(row).toHaveAttribute("data-state", "failed");
  await page.screenshot({
    path: testInfo.outputPath("github-denied.png"),
    fullPage: true,
  });
  // Nothing starts again by itself.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(row).toHaveAttribute("data-state", "failed");
  expect(
    Number(await (await page.request.get("/fixture/clone-count")).text()),
  ).toBe(before);
  await page.unrouteAll();
  await row
    .getByRole("button")
    .and(page.getByTestId("onboarding-clone-retry"))
    .click();
  await expect(row).toHaveAttribute("data-state", "confirmed");
  expect(
    Number(await (await page.request.get("/fixture/clone-count")).text()),
  ).toBe(before + 1);
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  await page.request.get("/fixture/scenario?value=ready");
});
