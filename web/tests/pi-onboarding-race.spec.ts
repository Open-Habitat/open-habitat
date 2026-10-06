import { expect, test } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
test("@pi-onboarding delayed old-session response cannot restore code after focus", async ({
  context,
}) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await a.request.get("/fixture/scenario?value=pi-onboarding");
  await a.waitForTimeout(2200); // Prior synthetic helper is reaped.
  await a.request.get("/fixture/pi-state?value=missing");
  try {
    await a.goto("/workspaces");
    await a.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await a.getByRole("link", { name: "Alice" }).click();
    await a.getByRole("button", { name: /jatka/i }).click();
    await a.getByRole("button", { name: "Aloita kirjautuminen" }).click();
    await expect(a.getByText("ABCD-1234")).toBeVisible();
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
    await b
      .getByRole("button", { name: "Keskeytä käyttöönotto ja kirjaudu ulos" })
      .click();
    await b.getByRole("button", { name: "Kirjaudu ulos", exact: true }).click();
    await b.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await b.getByRole("link", { name: "Bob" }).click();
    await b.getByRole("button", { name: /jatka/i }).click();
    await a.bringToFront();
    release();
    await expect(a.getByText("ABCD-1234")).toHaveCount(0);
    // Bob can already have a usable Pi login. The old Alice code must not
    // reappear regardless of Bob's own first-use state.
    // A poll during logout→login may receive 401, or the changed session
    // may reopen Bob's chooser. Neither path may restore Alice's code.
    await expect
      .poll(
        async () =>
          (await a
            .getByText("Bobin synteettinen viesti 0")
            .first()
            .isVisible()) ||
          (await a
            .getByRole("button", { name: "Kirjaudu GitHubilla" })
            .isVisible()) ||
          (await a
            .getByRole("heading", { name: "Valitse GitHub-repot haettaviksi" })
            .isVisible()),
      )
      .toBe(true);
    if (
      await a
        .getByRole("heading", { name: "Valitse GitHub-repot haettaviksi" })
        .isVisible()
    )
      await expect(a.getByText("fixture/bob-only")).toBeVisible();
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
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
    await expect(page.getByRole("button", { name: /jatka/i })).toBeVisible();
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
    await page.getByRole("button", { name: /jatka/i }).click();
    await capturedPromise;
    await expect(
      page.getByRole("button", { name: "Aloita kirjautuminen" }),
    ).toHaveCount(0);
    release();
    await expect(
      page.getByRole("button", { name: "Aloita kirjautuminen" }),
    ).toBeVisible();
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});
