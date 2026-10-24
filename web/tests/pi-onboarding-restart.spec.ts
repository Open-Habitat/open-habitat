import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
test("@pi-onboarding daemon restart invalidates old code, status stays authoritative", async ({
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
    expect((await page.request.get("/fixture/pi-restart")).status()).toBe(204);
    await page.reload();
    await confirmGitIdentity(page);
    await expect(
      page
        .getByRole("heading")
        .and(page.getByTestId("repository-chooser-title")),
    ).toBeVisible();
    await page
      .getByRole("button")
      .and(page.getByTestId("repository-proceed"))
      .click();
    await expect(
      page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
    ).toBeVisible();
    await expect(page.getByTestId("pi-device-code")).toHaveCount(0);
    expect((await page.request.get("/api/v1/snapshot")).status()).toBe(200);
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});

test("@pi-onboarding expired lease drops code and offers retry", async ({
  page,
}, testInfo) => {
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
    // A lost lease returns the same 404 as a real five-minute expiry.
    await page.request.get("/fixture/pi-restart");
    await expect(page.getByTestId("pi-sign-in-card")).toHaveAttribute(
      "data-phase",
      "expired",
      {
        timeout: 9000,
      },
    );
    await expect(page.getByTestId("pi-sign-in-card")).toBeVisible({
      timeout: 9000,
    });
    await expect(page.getByTestId("pi-device-code")).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("pi-expired-code.png"),
      fullPage: true,
    });
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
