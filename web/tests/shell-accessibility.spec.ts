import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function signIn(page: import("@playwright/test").Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.request.get("/fixture/pi-state?value=usable");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(
    page.getByRole("heading", { name: "Työtilat", exact: true }),
  ).toBeFocused();
}

test("@a11y keyboard navigation places focus on destination and restores account menu focus", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Siirry sisältöön" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
  const workspace = page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .locator(".ah-workspace-link")
    .first();
  const name = await workspace.innerText();
  await workspace.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name, exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Tilivalikko" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Tilivalikko" })).toBeFocused();
  await page.getByRole("button", { name: "Tilivalikko" }).click();
  await page.getByRole("menuitem", { name: "Asetukset" }).click();
  await expect(page.getByRole("heading", { name: "Asetukset" })).toBeFocused();
  await page.getByRole("button", { name: "Takaisin" }).click();
  await expect(page.getByRole("button", { name: "Tilivalikko" })).toBeFocused();
});

test("@a11y signed-out, shell, settings and narrow shell have no axe violations or horizontal overflow", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await expect(page.getByRole("heading", { name: /Tervetuloa/ })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await signIn(page);
  for (const width of [1280, 640]) {
    await page.setViewportSize({ width, height: 900 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
  await page.getByRole("button", { name: "Tilivalikko" }).click();
  await page.getByRole("menuitem", { name: "Asetukset" }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("@a11y first-use steps focus their heading and announce chooser count", async ({
  page,
}) => {
  try {
    await page.request.get("/fixture/scenario?value=pi-onboarding");
    await page.request.get("/fixture/pi-state?value=missing");
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
    await expect(
      page.getByRole("heading", { name: "Valitse GitHub-repot haettaviksi" }),
    ).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Jatka ilman repoja" }).click();
    await expect(
      page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
    ).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
