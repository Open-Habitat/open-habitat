import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "@playwright/test";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function picker(page: import("@playwright/test").Page) {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(
    page.getByRole("heading", { name: "Valitse GitHub-repot haettaviksi" }),
  ).toBeVisible();
}

test("@first-use abort is a danger action on both onboarding steps; first chooser click advances after focus", async ({
  page,
}) => {
  try {
    await picker(page);
    const abort = page.getByRole("button", {
      name: "Keskeytä käyttöönotto ja kirjaudu ulos",
    });
    await expect(abort).toHaveClass(/ah-button-danger-subtle/);
    // Focusing the window during a click must not replace the chooser before
    // the click reaches its action.
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("heading", { name: "Valitse GitHub-repot haettaviksi" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /jatka/i }).click();
    await expect(
      page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Keskeytä käyttöönotto ja kirjaudu ulos",
      }),
    ).toHaveClass(/ah-button-danger-subtle/);
    const start = page.getByRole("button", { name: "Aloita kirjautuminen" });
    await expect(start).toHaveClass(/ah-button-primary/);
    await expect(start).toBeVisible();
    const card = page.getByRole("region", { name: "ChatGPT-kirjautuminen" });
    const back = card.getByRole("button", {
      name: "Takaisin valitsemaan GitHub-repoja",
    });
    await expect(back).toHaveClass(/ah-button-secondary/);
    const startBox = await start.boundingBox();
    const backBox = await back.boundingBox();
    const abortBox = await page
      .getByRole("button", {
        name: "Keskeytä käyttöönotto ja kirjaudu ulos",
      })
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

test("@first-use a slow status read does not delay the device-code start, and completion is noticed promptly", async ({
  page,
}) => {
  try {
    await picker(page);
    await page.getByRole("button", { name: /jatka/i }).click();
    await expect(
      page.getByRole("button", { name: "Aloita kirjautuminen" }),
    ).toBeVisible();
    let statusReads = 0;
    await page.route("**/api/v1/onboarding/pi/status", async (route) => {
      statusReads++;
      await new Promise((resolve) => setTimeout(resolve, 1600));
      await route.continue().catch(() => {});
    });
    await page.getByRole("button", { name: "Aloita kirjautuminen" }).click();
    await expect(page.getByText("ABCD-1234")).toBeVisible({ timeout: 1500 });
    expect(statusReads).toBe(0);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const started = Date.now();
    await page.request.get("/fixture/pi-state?value=usable");
    await expect(
      page.getByRole("heading", { name: "Jatka siitä, mihin jäit" }),
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
