import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

// Server-info interception can overlap page teardown after the last assertion.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});

async function login(
  page: import("@playwright/test").Page,
  name: "Alice" | "Bob",
) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeVisible();
}

test("@lab admin and non-admin account menus reflect host role", async ({
  page,
}) => {
  // Role fixtures alter only the host's server-info response; no browser inference.
  let administrator = true;
  await page.route("**/api/v1/server", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), administrator },
    });
  });
  await login(page, "Alice");
  const account = page.getByRole("button", { name: /Tilivalikko/ });
  await account.click();
  await expect(
    page.getByRole("menuitem", { name: "Palvelimen ylläpito" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).not.toContainText(
    "Palvelimen ylläpito",
  );
  await page.keyboard.press("Escape");
  await expect(account).toBeFocused();
  administrator = false;
  await page.reload();
  await expect(account).toBeVisible();
  await account.click();
  await expect(
    page.getByRole("menuitem", { name: "Palvelimen ylläpito" }),
  ).toHaveCount(0);
});

test("@lab long rail, workspace actions, drawer and four visual states", async ({
  page,
}) => {
  await page.route("**/api/v1/server", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), administrator: true },
    });
  });
  await login(page, "Alice");
  const account = page.getByRole("button", { name: /Tilivalikko/ });
  const list = page.locator(".ah-rail-content");
  await list.evaluate((element) => {
    const row = element.querySelector(".ah-workspace");
    if (!row) throw new Error("Fixture has no workspace");
    for (let n = 0; n < 45; n++) element.append(row.cloneNode(true));
    element.scrollTop = element.scrollHeight;
  });
  const positions = await page.evaluate(() => {
    const rail = document.querySelector(".ah-rail")?.getBoundingClientRect();
    const button = document
      .querySelector("[data-account-controls] button")
      ?.getBoundingClientRect();
    if (!rail || !button) throw new Error("Account rail missing");
    return {
      railBottom: rail.bottom,
      buttonBottom: button.bottom,
      buttonTop: button.top,
    };
  });
  expect(positions.buttonBottom).toBeLessThanOrEqual(positions.railBottom);
  expect(positions.railBottom - positions.buttonBottom).toBeLessThan(30);
  expect(positions.buttonTop).toBeGreaterThan(0);
  await list.evaluate((element) => {
    element.scrollTop = 0;
  });
  const actions = page
    .locator(".ah-rail-content .ah-rail-workspace-actions")
    .first();
  await actions.getByRole("button").click();
  const menu = page.getByRole("menu", { name: /Työtilan .* toiminnot/ });
  await expect(menu).toBeFocused();
  const first = page.getByRole("menuitem", { name: "Uusi keskustelu" });
  const second = page.getByRole("menuitem", { name: "Avaa työtilasivu" });
  await page.keyboard.press("ArrowDown");
  await expect(first).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(second).toBeFocused();
  await expect(
    page.getByRole("menuitem", { name: "Avaa GitHubissa" }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Poista työtila… · tulossa" }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByText(/Palautettava poisto suunnitellaan ensin/),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(actions.getByRole("button")).toBeFocused();
  await page.getByRole("button", { name: "Uusi työtila" }).first().click();
  await expect(
    page.getByRole("dialog", { name: "Uusi työtila" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((choice) => {
      localStorage.setItem("nah:theme", choice);
      document.documentElement.dataset.theme = choice;
    }, theme);
    await account.click();
    await page.locator("main").evaluate((element) => {
      element.scrollTop += 150;
      element.dispatchEvent(new Event("scroll"));
    });
    await expect(
      page.getByRole("menuitem", { name: "Asetukset" }),
    ).toBeVisible();
    await page.locator("main").evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.screenshot({
      path: `test-results/evidence/sidebar-account-desktop-${theme}.png`,
    });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Avaa navigaatio" }).click();
    await expect(account).toBeVisible();
    await account.click();
    await page.screenshot({
      path: `test-results/evidence/sidebar-account-phone-${theme}.png`,
    });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Sulje navigaatio" }).click();
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  await actions.getByRole("button").click();
  await page.getByRole("menuitem", { name: "Uusi keskustelu" }).click();
  await expect(page).toHaveURL(/\/workspaces\/ws_.*\?conversation=pi:/);
});
