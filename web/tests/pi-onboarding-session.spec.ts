import { confirmGitIdentity } from "./git-identity-helper";
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
    await page
      .getByRole("button")
      .and(page.getByTestId("github-sign-in"))
      .click();
    await page.getByRole("link").nth(0).click();
    await confirmGitIdentity(page);
    await page
      .getByRole("button")
      .and(page.getByTestId("repository-proceed"))
      .click();
    await page
      .getByRole("button")
      .and(page.getByTestId("pi-attempt-start"))
      .click();
    await expect(page.getByTestId("pi-device-code")).toHaveText("ABCD-1234");
    await expect(page.getByTestId("pi-device-code")).toBeVisible();
    await page
      .getByRole("button")
      .and(page.getByTestId("onboarding-abort"))
      .click();
    await page
      .getByRole("button")
      .and(page.getByTestId("logout-confirm"))
      .click();
    await expect(page.getByTestId("pi-device-code")).toHaveCount(0);
    await page
      .getByRole("button")
      .and(page.getByTestId("github-sign-in"))
      .click();
    await page.getByRole("link").nth(1).click();
    await confirmGitIdentity(page);
    await page
      .getByRole("button")
      .and(page.getByTestId("repository-proceed"))
      .click();
    await expect(
      page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
    ).toBeVisible();
    await expect(page.getByTestId("pi-device-code")).toHaveCount(0);
    expect(
      (await page.request.get("/api/v1/onboarding/pi/attempt")).status(),
    ).toBe(404);
    expect((await page.request.get("/api/v1/snapshot")).status()).toBe(200);
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
