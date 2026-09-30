import { hostOrigin } from "../test-ports.mjs";
import { expect, test, type Page } from "@playwright/test";
const host = hostOrigin;
test.use({
  baseURL: host,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});
async function login(page: Page, name: "Alice" | "Bob" = "Alice") {
  await page.goto("/");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeVisible();
}
async function state(page: Page, native: string) {
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (!body.auth) {
      await route.fulfill({ response });
      return;
    }
    body.auth.native_github.state = native;
    await route.fulfill({ response, json: body });
  });
}
async function settings(page: Page) {
  await page.getByRole("button", { name: /Tilivalikko/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Asetukset" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Asetukset" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Asetukset" })).toBeFocused();
}
test("@account-settings verified native state, route return and honest disconnect limit", async ({
  page,
}) => {
  await state(page, "connected");
  await login(page);
  await expect(page.getByRole("navigation")).toContainText("Oma tili");
  await expect(page.getByRole("navigation")).not.toContainText(
    "GitHub user 42",
  );
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  await expect(page.getByRole("menuitem", { name: "Asetukset" })).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/account-menu.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.locator(".ah-workspace-link").first().click();
  const returnPath = new URL(page.url()).pathname;
  await settings(page);
  await expect(
    page.locator("#main").getByText("Yhdistetty", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Yhteyttä ei voi vielä katkaista täällä"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Katkaise/ })).toHaveCount(0);
  await page.screenshot({
    path: "test-results/evidence/account-connected.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Takaisin" }).click();
  await expect(page).toHaveURL(new RegExp(`${returnPath}$`));
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeFocused();
  await settings(page);
  await page.reload();
  await expect(
    page.locator("#main").getByText("Yhdistetty", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Takaisin" }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeFocused();
});
test("@account-settings partial, unknown and logout/user switch", async ({
  page,
}) => {
  await state(page, "partial");
  await login(page);
  await settings(page);
  await expect(page.getByText("Osittainen yhteys")).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/account-partial.png",
    fullPage: true,
  });
  await page.unroute("**/api/v1/snapshot");
  await state(page, "unknown");
  await page.reload();
  await expect(page.getByText("Tilaa ei tiedetä")).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/account-unknown.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  await page.getByRole("menuitem", { name: "Kirjaudu ulos" }).click();
  await expect(
    page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/workspaces$/);
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Bob" }).click();
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeVisible();
  await expect(page.getByRole("navigation")).not.toContainText(
    "GitHub user 42",
  );
  await page.goto("/settings");
  await expect(page.getByText("Tilaa ei tiedetä")).toBeVisible();
});
test("@account-settings unavailable snapshot does not display previous identity", async ({
  page,
}) => {
  await login(page);
  await settings(page);
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Yhteyttä ei saatu" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Työtilat ja keskustelut" }),
  ).toHaveCount(0);
  await expect(page.getByText("Oma tili")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/evidence/account-unavailable.png",
    fullPage: true,
  });
});
