import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function aligned(page: Page, notice: string) {
  const cardBox = await page
    .getByRole("list", { name: "Käyttöönoton vaiheet" })
    .locator("..")
    .boundingBox();
  const noticeBox = await page
    .getByText(notice)
    .locator("xpath=ancestor::aside")
    .boundingBox();
  if (!cardBox || !noticeBox) throw new Error("card or notice missing");
  expect(Math.abs(cardBox.x - noticeBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(cardBox.width - noticeBox.width)).toBeLessThanOrEqual(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
}

async function login(page: Page) {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(
    page.getByRole("heading", { name: "Valitse GitHub-repot haettaviksi" }),
  ).toBeVisible();
}

test("@a11y login error stays aligned with the login card on desktop and phone", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/workspaces?auth_error=denied");
    await expect(
      page.getByText("Kirjautumisessa tapahtui virhe"),
    ).toBeVisible();
    await aligned(page, "Kirjautumisessa tapahtui virhe");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test("@a11y failed session check offers reload under the repository card", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  try {
    await login(page);
    await page.route("**/auth/session", (route) =>
      route.fulfill({ status: 503, body: "unavailable" }),
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByText("Istuntoa ei voitu vahvistaa. Lataa sivu uudelleen."),
    ).toBeVisible();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await aligned(page, "Haun tila vaatii tarkistusta");
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
    await page.unrouteAll();
    await page.getByRole("button", { name: "Lataa sivu uudelleen" }).click();
    await expect(
      page.getByRole("list", { name: "GitHub-repot" }),
    ).toBeVisible();
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
    await page.request.get("/fixture/pi-state?value=usable");
  }
});

test("catalog notice retries a read, not a clone", async ({ page }) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  try {
    await page.route(
      "**/api/v1/onboarding/github/repos?page=2&limit=50",
      (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"error":"native_source_unavailable"}',
        }),
    );
    await login(page);
    const before = await (
      await page.request.get("/fixture/clone-count")
    ).text();
    await expect(page.getByText("Haun tila vaatii tarkistusta")).toBeVisible();
    await page.unrouteAll();
    await page
      .getByRole("button", { name: "Tarkista repot uudelleen" })
      .click();
    await expect(
      page.getByRole("list", { name: "GitHub-repot" }),
    ).toBeVisible();
    expect(await (await page.request.get("/fixture/clone-count")).text()).toBe(
      before,
    );
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
    await page.request.get("/fixture/pi-state?value=usable");
  }
});
