import { expect, test } from "@playwright/test";

test.use({ baseURL: "https://127.0.0.1:4174", ignoreHTTPSErrors: true });
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
    await b.getByRole("button", { name: "Kirjaudu ulos" }).click();
    await b.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await b.getByRole("link", { name: "Bob" }).click();
    await a.bringToFront();
    release();
    await expect(a.getByText("ABCD-1234")).toHaveCount(0);
    await expect(
      a.getByRole("heading", { name: "Yhdistä Pi ChatGPT-tilaukseen" }),
    ).toBeVisible();
    expect(
      (await a.request.get("/api/v1/onboarding/pi/attempt")).status(),
    ).toBe(404);
  } finally {
    await a.request.get("/fixture/pi-state?value=missing");
    await a.request.get("/fixture/scenario?value=ready");
  }
});
