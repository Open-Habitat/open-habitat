import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

async function login(
  page: import("@playwright/test").Page,
  name: "Alice" | "Bob",
) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page
    .getByRole("link")
    .and(
      page.locator(
        `a[href*="code=${name === "Alice" ? "42" : name === "Bob" ? "43" : "99"}"]`,
      ),
    )
    .click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
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
  const account = page
    .getByRole("button")
    .and(page.getByTestId("account-menu-trigger"));
  await account.click();
  await expect(
    page.getByRole("menuitem").and(page.getByTestId("menu-administration")),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation").getByTestId("menu-administration"),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(account).toBeFocused();
  administrator = false;
  await page.reload();
  await expect(account).toBeVisible();
  await account.click();
  await expect(
    page.getByRole("menuitem").and(page.getByTestId("menu-administration")),
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
  const account = page
    .getByRole("button")
    .and(page.getByTestId("account-menu-trigger"));
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
  await expect(actions.getByRole("button")).toHaveCount(1);
  await expect(actions.getByRole("button")).toBeVisible();
  await expect(
    page.getByRole("button").and(page.getByTestId("workspace-menu")),
  ).toHaveCount(0);
  await page
    .getByRole("button")
    .and(page.getByTestId("workspace-create"))
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goBack();
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
      page.getByRole("menuitem").and(page.getByTestId("menu-settings")),
    ).toBeVisible();
    await page.locator("main").evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.screenshot({
      path: `test-results-lab/evidence/sidebar-account-desktop-${theme}.png`,
    });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button")
      .and(page.getByTestId("navigation-open"))
      .click();
    await expect(account).toBeVisible();
    await account.click();
    await page.screenshot({
      path: `test-results-lab/evidence/sidebar-account-phone-${theme}.png`,
    });
    await page.keyboard.press("Escape");
    await page
      .getByRole("button")
      .and(page.getByTestId("close-navigation"))
      .click();
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  await actions.getByRole("button").click();
  await expect(page).toHaveURL(/\/workspaces\/ws_.*\?conversation=pi:/);
});
