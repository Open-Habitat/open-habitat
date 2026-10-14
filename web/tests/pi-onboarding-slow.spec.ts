import { confirmGitIdentity } from "./git-identity-helper";
import { expect, test } from "./worker-host";
import { hostOrigin } from "../test-ports.mjs";

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
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
    await confirmGitIdentity(page);
    await page.getByRole("button", { name: /jatka/i }).click();
    await expect(page.getByText("Ladataan palvelimen tilaa")).toHaveCount(0);
    await expect(page.getByText("Käyttöönotto", { exact: true })).toBeVisible();
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
      page.getByRole("button", { name: "Aloita kirjautuminen" }),
    ).toBeVisible({ timeout: 18000 });
    await page.getByRole("button", { name: "Aloita kirjautuminen" }).click();
    await expect(
      page.getByRole("button", { name: "Kopioi koodi" }),
    ).toBeVisible({ timeout: 18000 });
    expect(posts).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("button", { name: "Kopioi koodi" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Keskeytä käyttöönotto ja kirjaudu ulos",
      }),
    ).toBeVisible();
    // The synthetic helper reports unknown after two seconds without provider
    // confirmation. That is a real native transition, not poll starvation.
    await expect(
      page.getByRole("heading", { name: "Kirjautuminen keskeytyi" }),
    ).toBeVisible({ timeout: 12000 });
    await expect(
      page.getByRole("button", { name: "Tarkista tila" }),
    ).toBeVisible();
    expect(posts).toBe(1);
    await page.request.get("/fixture/pi-restart");
    await page.getByRole("button", { name: "Tarkista tila" }).click();
    await expect(page.getByText("Kirjautumisyritys päättyi")).toBeVisible({
      timeout: 16000,
    });
    await expect(
      page.getByRole("button", { name: "Kopioi koodi" }),
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
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
    await confirmGitIdentity(page);
    await page.getByRole("button", { name: /jatka/i }).click();
    await expect(
      page.getByRole("button", { name: "Aloita kirjautuminen" }),
    ).toBeVisible();
    await page.route("**/api/v1/onboarding/pi/attempt", async (route) => {
      if (route.request().method() === "POST") {
        posts++;
        await route.fetch(); // Native operation reached the synthetic daemon.
        await route.abort(); // Browser cannot know the outcome.
      } else await route.continue();
    });
    await page.getByRole("button", { name: "Aloita kirjautuminen" }).click();
    await expect(
      page.getByRole("heading", { name: "Kirjautuminen keskeytyi" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Aloita uusi yritys" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Tarkista tila" }).click();
    await expect(
      page.getByRole("button", { name: "Kopioi koodi" }),
    ).toBeVisible();
    expect(posts).toBe(1);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
