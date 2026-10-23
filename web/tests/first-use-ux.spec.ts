import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity, passGoogle } from "./git-identity-helper";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function picker(page: import("@playwright/test").Page) {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await confirmGitIdentity(page);
  await expect(
    page.getByRole("heading").and(page.getByTestId("repository-chooser-title")),
  ).toBeVisible();
}

test("@first-use abort is a danger action on both onboarding steps; first chooser click advances after focus", async ({
  page,
}) => {
  try {
    await picker(page);
    const abort = page
      .getByRole("button")
      .and(page.getByTestId("onboarding-abort"));
    await expect(abort).toHaveClass(/ah-button-quiet/);
    // Focusing the window during a click must not replace the chooser before
    // the click reaches its action.
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page
        .getByRole("heading")
        .and(page.getByTestId("repository-chooser-title")),
    ).toBeVisible();
    await page
      .getByRole("button")
      .and(page.getByTestId("repository-proceed"))
      .click();
    await passGoogle(page);
    await expect(
      page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
    ).toBeVisible();
    await expect(
      page.getByRole("button").and(page.getByTestId("onboarding-abort")),
    ).toHaveClass(/ah-button-quiet/);
    const start = page
      .getByRole("button")
      .and(page.getByTestId("pi-attempt-start"));
    await expect(start).toHaveClass(/ah-button-primary/);
    await expect(start).toBeVisible();
    const card = page
      .getByRole("region")
      .and(page.getByTestId("pi-sign-in-card"));
    const back = card
      .getByRole("button")
      .and(card.getByTestId("pi-back-to-repositories"));
    await expect(back).toHaveClass(/ah-button-quiet/);
    const startBox = await start.boundingBox();
    const backBox = await back.boundingBox();
    const abortBox = await page
      .getByRole("button")
      .and(page.getByTestId("onboarding-abort"))
      .boundingBox();
    expect(
      startBox &&
        backBox &&
        abortBox &&
        backBox.y >= startBox.y &&
        abortBox.y > backBox.y + backBox.height,
    ).toBe(true);
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});

test("@first-use code preparation never flashes a failure, while a rejected start stays visible", async ({
  page,
}) => {
  try {
    await picker(page);
    await page
      .getByRole("button")
      .and(page.getByTestId("repository-proceed"))
      .click();
    await passGoogle(page);
    const start = page
      .getByRole("button")
      .and(page.getByTestId("pi-attempt-start"));
    await expect(start).toBeVisible();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const phases: boolean[] = [];
    await page.evaluate(() => {
      (window as Window & { observedPhases?: boolean[] }).observedPhases = [];
      new MutationObserver(() => {
        const uncertain = Boolean(
          document.querySelector('[data-testid="pi-attempt-uncertain"]'),
        );
        (
          window as Window & { observedPhases?: boolean[] }
        ).observedPhases?.push(uncertain);
      }).observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    });
    await page.route("**/api/v1/onboarding/pi/attempt", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const response = await route.fetch();
      await held;
      await route.fulfill({ response });
    });
    await start.click();
    await expect(page.getByTestId("pi-sign-in-card")).toHaveAttribute(
      "data-phase",
      "waiting",
    );
    await expect(page.getByTestId("pi-sign-in-card")).toBeVisible();
    await expect(page.getByTestId("pi-attempt-uncertain")).toHaveCount(0);
    release();
    await expect(page.getByTestId("pi-device-code")).toHaveText("ABCD-1234", {
      timeout: 8000,
    });
    await expect(page.getByTestId("pi-device-code")).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByTestId("pi-device-code")).toHaveText("ABCD-1234");
    await expect(page.getByTestId("pi-device-code")).toBeVisible();
    phases.push(
      ...(await page.evaluate(
        () =>
          (window as Window & { observedPhases?: boolean[] }).observedPhases ??
          [],
      )),
    );
    expect(phases.some(Boolean)).toBe(false);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    // Recreate a fresh synthetic daemon attempt for an independently failed start.
    await page.request.get("/fixture/scenario?value=pi-onboarding");
    await page.reload();
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
      if (route.request().method() === "POST")
        await route.fulfill({ status: 500, body: "" });
      else await route.continue();
    });
    await page
      .getByRole("button")
      .and(page.getByTestId("pi-attempt-start"))
      .click();
    await expect(page.getByTestId("pi-attempt-uncertain")).toBeVisible();
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});

test("@first-use a slow status read does not delay the device-code start, and completion is noticed promptly", async ({
  page,
}) => {
  try {
    await picker(page);
    await page
      .getByRole("button")
      .and(page.getByTestId("repository-proceed"))
      .click();
    await passGoogle(page);
    await expect(
      page.getByRole("button").and(page.getByTestId("pi-attempt-start")),
    ).toBeVisible();
    let statusReads = 0;
    await page.route("**/api/v1/onboarding/pi/status", async (route) => {
      statusReads++;
      await new Promise((resolve) => setTimeout(resolve, 1600));
      await route.continue().catch(() => {});
    });
    await page
      .getByRole("button")
      .and(page.getByTestId("pi-attempt-start"))
      .click();
    // The fake helper first reports pending; the next 2 s attempt poll reveals the code.
    await expect(page.getByTestId("pi-device-code")).toBeVisible({
      timeout: 4000,
    });
    expect(statusReads).toBe(0);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const started = Date.now();
    await page.request.get("/fixture/pi-state?value=usable");
    await expect(
      page.getByRole("heading").and(page.getByTestId("workspaces-title")),
    ).toBeVisible({
      timeout: 4500,
    });
    expect(Date.now() - started).toBeLessThan(4500);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
