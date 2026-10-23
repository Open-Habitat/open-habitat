import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity, passGoogle } from "./git-identity-helper";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("@pi-onboarding slow native reads finish across multiple poll intervals without duplicate writes", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  let posts = 0;
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
    await passGoogle(page);
    await expect(page.getByTestId("connection-loading")).toHaveCount(0);
    await expect(page.getByTestId("onboarding-steps")).toBeVisible();
    // Each reply is from the real synthetic gateway/daemon. Only delivery to
    // this browser is slow; no code or provider credential enters test output.
    await page.route("**/api/v1/onboarding/pi/status", async (route) => {
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 1900));
      await route.fulfill({ response }).catch(() => {});
    });
    await page.route("**/api/v1/onboarding/pi/attempt", async (route) => {
      if (route.request().method() === "POST") posts++;
      const response = await route.fetch();
      if (route.request().method() === "GET")
        await new Promise((resolve) => setTimeout(resolve, 1900));
      await route.fulfill({ response }).catch(() => {});
    });
    await expect(
      page.getByRole("button").and(page.getByTestId("pi-attempt-start")),
    ).toBeVisible({ timeout: 18000 });
    await page
      .getByRole("button")
      .and(page.getByTestId("pi-attempt-start"))
      .click();
    await expect(
      page.getByRole("button").and(page.getByTestId("pi-code-copy")),
    ).toBeVisible({ timeout: 18000 });
    expect(posts).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("button").and(page.getByTestId("pi-code-copy")),
    ).toBeVisible();
    await expect(
      page.getByRole("button").and(page.getByTestId("onboarding-abort")),
    ).toBeVisible();
    // The synthetic helper reports unknown after two seconds without provider
    // confirmation. That is a real native transition, not poll starvation.
    await expect(
      page.getByRole("heading").and(page.getByTestId("pi-attempt-interrupted")),
    ).toBeVisible({ timeout: 12000 });
    await expect(
      page.getByRole("button").and(page.getByTestId("notice-action")),
    ).toBeVisible();
    expect(posts).toBe(1);
    await page.request.get("/fixture/pi-restart");
    await page
      .getByRole("button")
      .and(page.getByTestId("notice-action"))
      .click();
    await expect(page.getByTestId("pi-sign-in-card")).toHaveAttribute(
      "data-phase",
      "expired",
      {
        timeout: 16000,
      },
    );
    await expect(page.getByTestId("pi-sign-in-card")).toBeVisible({
      timeout: 16000,
    });
    await expect(
      page.getByRole("button").and(page.getByTestId("pi-code-copy")),
    ).toHaveCount(0);
    expect(posts).toBe(1);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});

test("@pi-onboarding lost write reply is uncertain and read-only recheck recovers", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  let posts = 0;
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
    await passGoogle(page);
    await expect(
      page.getByRole("button").and(page.getByTestId("pi-attempt-start")),
    ).toBeVisible();
    await page.route("**/api/v1/onboarding/pi/attempt", async (route) => {
      if (route.request().method() === "POST") {
        posts++;
        await route.fetch(); // Native operation reached the synthetic daemon.
        await route.abort(); // Browser cannot know the outcome.
      } else await route.continue();
    });
    await page
      .getByRole("button")
      .and(page.getByTestId("pi-attempt-start"))
      .click();
    await expect(
      page.getByRole("heading").and(page.getByTestId("pi-attempt-interrupted")),
    ).toBeVisible();
    await expect(
      page.getByRole("button").and(page.getByTestId("pi-attempt-start")),
    ).toHaveCount(0);
    await page
      .getByRole("button")
      .and(page.getByTestId("notice-action"))
      .click();
    await expect(
      page.getByRole("button").and(page.getByTestId("pi-code-copy")),
    ).toBeVisible();
    expect(posts).toBe(1);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
