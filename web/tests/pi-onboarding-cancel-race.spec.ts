import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
test("@pi-onboarding cancel supersedes an in-flight poll", async ({ page }) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  try {
    await page.clock.install();
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
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let captured!: () => void;
    const capturedPromise = new Promise<void>((resolve) => {
      captured = resolve;
    });
    let once = false;
    await page.route("**/api/v1/onboarding/pi/attempt", async (route) => {
      if (once || route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      once = true;
      const response = await route.fetch();
      captured();
      await blocked;
      try {
        await route.fulfill({ response });
      } catch {
        /* aborted by cancellation */
      }
    });
    await page.clock.fastForward(3000);
    await capturedPromise;
    const cancelled = page.waitForRequest(
      (r) =>
        r.method() === "DELETE" &&
        r.url().endsWith("/api/v1/onboarding/pi/attempt"),
    );
    await page
      .getByRole("button")
      .and(page.getByTestId("pi-attempt-cancel"))
      .click();
    await cancelled;
    release();
    await expect(page.getByTestId("pi-device-code")).toHaveCount(0);
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
