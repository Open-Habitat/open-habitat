import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
test("@pi-onboarding delayed old-session response cannot restore code after focus", async ({
  context,
}) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await a.request.get("/fixture/scenario?value=pi-onboarding");
  await a.request.get("/fixture/pi-state?value=missing");
  try {
    await a.goto("/workspaces");
    await a.getByRole("button").and(a.getByTestId("github-sign-in")).click();
    await a.getByRole("link").nth(0).click();
    await confirmGitIdentity(a);
    await a
      .getByRole("button")
      .and(a.getByTestId("repository-proceed"))
      .click();
    await a.getByRole("button").and(a.getByTestId("pi-attempt-start")).click();
    await expect(a.getByTestId("pi-device-code")).toHaveText("ABCD-1234");
    await expect(a.getByTestId("pi-device-code")).toBeVisible();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let captured!: () => void;
    const capturedPromise = new Promise<void>((resolve) => {
      captured = resolve;
    });
    let intercepted = false;
    await a.route("**/api/v1/onboarding/pi/attempt", async (route) => {
      if (intercepted || route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      intercepted = true;
      const old = await route.fetch(); // Response was authorized under Alice's cookie.
      captured();
      await blocked;
      await route.fulfill({ response: old });
    });
    await a.evaluate(() => window.dispatchEvent(new Event("focus")));
    await capturedPromise;
    await b.goto("/workspaces");
    await b.getByRole("button").and(b.getByTestId("onboarding-abort")).click();
    await b.getByRole("button").and(b.getByTestId("logout-confirm")).click();
    await b.getByRole("button").and(b.getByTestId("github-sign-in")).click();
    await b.getByRole("link").nth(1).click();
    await expect(
      b.getByRole("button").and(b.getByTestId("account-menu-trigger")),
    ).toContainText("Bob");
    // Bob may already be at Pi onboarding; only advance the Git steps when
    // the new session actually presents them.
    if (
      await b
        .getByRole("heading")
        .and(b.getByTestId("git-identity-title"))
        .isVisible()
    )
      await confirmGitIdentity(b);
    const proceed = b
      .getByRole("button")
      .and(b.getByTestId("repository-proceed"));
    // The step can advance on its own between the check and the click; then
    // the button is gone rather than waiting.
    if (await proceed.isVisible())
      await proceed
        .click({ timeout: 5000 })
        .catch(() => expect(proceed).toBeHidden());
    await a.bringToFront();
    release();
    await expect(a.getByTestId("pi-device-code")).toHaveCount(0);
    // Bob can already have a usable Pi login. The old Alice code must not
    // reappear regardless of Bob's own first-use state.
    // A poll during logout→login may receive 401, or the changed session
    // may reopen Bob's chooser. Neither path may restore Alice's code.
    await expect
      .poll(
        async () =>
          (await a.locator("body").textContent())?.includes(
            "Bobin synteettinen viesti 0",
          ) ||
          (await a
            .getByRole("button")
            .and(a.getByTestId("github-sign-in"))
            .isVisible()) ||
          (await a
            .getByRole("heading")
            .and(a.getByTestId("repository-chooser-title"))
            .isVisible()) ||
          (await a
            .getByRole("heading")
            .and(a.getByTestId("git-identity-title"))
            .isVisible()),
      )
      .toBe(true);
    // Whichever of Bob's possible views appears, the old account is gone.
    await expect(a.locator("body")).not.toContainText("Alice");
    if (
      (await a.locator("body").textContent())?.includes(
        "Bobin synteettinen viesti 0",
      )
    ) {
      await expect(
        a.getByRole("button").and(a.getByTestId("account-menu-trigger")),
      ).toBeVisible();
      await expect(a.locator("body")).not.toContainText("Alice");
    }
    // The chooser may still switch to Bob's Git-identity step after its
    // catalog loads. Do not mistake that normal transition for an Alice repo.
    await expect(a.getByTestId("repository-name-fixture/first")).toHaveCount(0);
    if (
      await a
        .getByRole("button")
        .and(a.getByTestId("account-menu-trigger"))
        .isVisible()
    ) {
      await expect(
        a.getByRole("button").and(a.getByTestId("account-menu-trigger")),
      ).toBeVisible();
    }
    expect(
      (await a.request.get("/api/v1/onboarding/pi/attempt")).status(),
    ).toBe(404);
  } finally {
    await a.request.get("/fixture/pi-state?value=missing");
    await a.request.get("/fixture/scenario?value=ready");
  }
});

test("@pi-onboarding does not offer an action before its session is bound", async ({
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
    await expect(
      page.getByRole("button").and(page.getByTestId("repository-proceed")),
    ).toBeVisible();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let captured!: () => void;
    const capturedPromise = new Promise<void>((resolve) => {
      captured = resolve;
    });
    let once = false;
    await page.route("**/auth/session", async (route) => {
      if (once) {
        await route.continue();
        return;
      }
      once = true;
      const response = await route.fetch();
      captured();
      await blocked;
      await route.fulfill({ response });
    });
    await page
      .getByRole("button")
      .and(page.getByTestId("repository-proceed"))
      .click();
    await capturedPromise;
    await expect(
      page.getByRole("button").and(page.getByTestId("pi-attempt-start")),
    ).toHaveCount(0);
    release();
    await expect(
      page.getByRole("button").and(page.getByTestId("pi-attempt-start")),
    ).toBeVisible();
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});
