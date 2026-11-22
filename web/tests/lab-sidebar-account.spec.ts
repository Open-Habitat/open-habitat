import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
});

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
    page
      .getByTestId("account-menu-trigger")
      .or(page.getByTestId("navigation-open"))
      .filter({ visible: true }),
  ).toBeVisible();
}

for (const width of [1440, 390]) {
  for (const locale of ["fi-FI", "en-US"]) {
    test.describe(`feedback card ${width} ${locale}`, () => {
      test.use({
        viewport: { width, height: 900 },
        locale,
        hasTouch: width === 390,
        isMobile: width === 390,
      });
      test("@lab feedback entry explains and opens the shared panel", async ({
        page,
      }) => {
        await login(page, "Alice");
        if (width === 390) await page.getByTestId("navigation-open").tap();
        await page.getByTestId("account-menu-trigger").click();
        await page.getByTestId("menu-explain").click();
        const trigger = page.getByTestId("account-menu-trigger");
        if (width === 390) {
          await trigger.tap();
          await trigger.tap();
          await page.getByTestId("menu-feedback").tap();
        } else {
          await trigger.click();
          await page.getByTestId("menu-feedback").hover();
        }
        await expect(page.getByTestId("explain-card")).toHaveAttribute(
          "data-card",
          "S42",
        );
        if (process.env.OH_ACCOUNT_MENU_CAPTURE)
          await snapshot(
            page,
            `${process.env.OH_ACCOUNT_MENU_CAPTURE}/card-${locale}-${width}`,
          );
        if (width === 390) await page.getByTestId("menu-feedback").tap();
        else await page.getByTestId("menu-feedback").click();
        await expect(page.getByTestId("general-text")).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(trigger).toBeFocused();
        await expect(page.getByTestId("general-feedback")).toHaveCount(0);
      });
    });
  }
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
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("menu-settings")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("menu-administration")).toBeFocused();
  expect(
    (await new AxeBuilder({ page }).include(".ah-account-menu").analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press("End");
  await expect(page.getByTestId("menu-feedback")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("general-text")).toBeFocused();
  await expect(page.locator(".ah-account-menu")).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="general-feedback"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  if (process.env.OH_ACCOUNT_MENU_CAPTURE)
    await snapshot(
      page,
      `${process.env.OH_ACCOUNT_MENU_CAPTURE}/feedback-desktop`,
    );
  const panel = await page.getByTestId("general-feedback").boundingBox();
  if (!panel) throw new Error("Feedback panel missing");
  expect(panel.y).toBeGreaterThanOrEqual(0);
  expect(panel.y + panel.height).toBeLessThanOrEqual(
    await page.evaluate(() => innerHeight),
  );
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
  const list = page.getByTestId("rail-workspace-scroll");
  await list.evaluate((element) => {
    const rows = element.querySelector(".ah-workspace-list");
    const row = rows?.querySelector(".ah-workspace");
    if (!rows || !row) throw new Error("Fixture has no workspace");
    // Grow the actual list, not the rail's fixed region siblings: the
    // adaptive allocator measures those siblings as non-scrolling overhead.
    for (let n = 0; n < 45; n++) rows.append(row.cloneNode(true));
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
    if (process.env.OH_ACCOUNT_MENU_CAPTURE)
      await snapshot(
        page,
        `${process.env.OH_ACCOUNT_MENU_CAPTURE}/desktop-${theme}`,
      );
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button")
      .and(page.getByTestId("navigation-open"))
      .click();
    await expect(account).toBeVisible();
    await account.click();
    if (process.env.OH_ACCOUNT_MENU_CAPTURE)
      await snapshot(
        page,
        `${process.env.OH_ACCOUNT_MENU_CAPTURE}/phone-${theme}`,
      );
    await page.getByTestId("menu-feedback").click();
    await expect(page.getByTestId("general-text")).toBeFocused();
    if (process.env.OH_ACCOUNT_MENU_CAPTURE)
      await snapshot(
        page,
        `${process.env.OH_ACCOUNT_MENU_CAPTURE}/feedback-phone-${theme}`,
      );
    await page.getByTestId("general-text").fill("Synthetic feedback draft");
    await page.keyboard.press("Escape");
    await expect(account).toBeFocused();
    await page
      .getByRole("button")
      .and(page.getByTestId("close-navigation"))
      .click();
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  await actions.getByRole("button").click();
  await expect(page).toHaveURL(/\/workspaces\/ws_.*\?conversation=pi:/);
});
