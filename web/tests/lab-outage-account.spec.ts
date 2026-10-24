import { labOrigin } from "../test-ports.mjs";
import { confirmGitIdentity, passGoogle } from "./git-identity-helper";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

for (const situation of ["outage", "pi-onboarding"] as const) {
  for (const administrator of [true, false]) {
    test(`@lab ${situation} account menu ${administrator ? "admin" : "non-admin"} on desktop and phone`, async ({
      page,
    }) => {
      await page.route("**/api/v1/server", async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          json: { ...(await response.json()), administrator },
        });
      });
      await page.request.get("/fixture/scenario?value=ready");
      await page.goto("/workspaces");
      await page
        .getByRole("button")
        .and(page.getByTestId("github-sign-in"))
        .click();
      await page.getByRole("link").nth(0).click();
      await expect(
        page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
      ).toBeVisible();
      try {
        if (situation === "outage") {
          await page.request.get("/fixture/scenario?value=error");
        } else {
          await page.request.get("/fixture/scenario?value=pi-onboarding");
          await page.request.get("/fixture/pi-state?value=missing");
        }
        await page.reload();
        if (situation === "pi-onboarding") {
          await confirmGitIdentity(page);
          await expect(
            page
              .getByRole("heading")
              .and(page.getByTestId("repository-chooser-title")),
          ).toBeVisible();
          await page.getByRole("checkbox").first().check();
          await page
            .getByRole("button")
            .and(page.getByTestId("repository-proceed"))
            .click();
          await passGoogle(page);
        }
        await expect(
          page
            .getByRole("heading")
            .and(
              page.getByTestId(
                situation === "outage"
                  ? "workspaces-unavailable-title"
                  : "pi-sign-in-title",
              ),
            ),
        ).toBeVisible();
        // No workspace rail; Pi onboarding's own route map is a navigation
        // landmark too, so the rail is told apart by its test id.
        await expect(
          page
            .getByRole("navigation")
            .and(page.getByTestId("workspace-navigation")),
        ).toHaveCount(0);
        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: 720 });
          const account = page
            .getByRole("button")
            .and(page.getByTestId("account-menu-trigger"));
          await expect(account).toBeVisible();
          await expect(account).not.toContainText("Bob");
          const box = await account.boundingBox();
          if (!box) throw new Error("Account button has no visible rectangle");
          if (width === 390) {
            expect(box.y).toBeLessThan(60);
            expect(box.x).toBeGreaterThan(280);
          } else {
            expect(box.y).toBeGreaterThan(620);
            expect(box.x).toBeLessThan(296);
          }
          await account.click();
          await expect(page.locator(".ah-account-menu")).toContainText("Alice");
          await expect(page.locator(".ah-account-menu")).toContainText(
            "alice@example.invalid",
          );
          await expect(
            page.getByRole("menuitem").and(page.getByTestId("menu-settings")),
          ).toBeVisible();
          await expect(
            page
              .getByRole("menuitem")
              .and(page.getByTestId("menu-administration")),
          ).toHaveCount(administrator ? 1 : 0);
          await expect(
            page
              .getByRole("group")
              .and(page.getByTestId("theme-choice"))
              .getByRole("button")
              .and(page.getByTestId("segment-light")),
          ).toBeVisible();
          await expect(
            page.getByRole("menuitem").and(page.getByTestId("menu-logout")),
          ).toBeVisible();
          await page.keyboard.press("Escape");
        }
        await page
          .getByRole("button")
          .and(page.getByTestId("account-menu-trigger"))
          .click();
        if (administrator) {
          await page
            .getByRole("menuitem")
            .and(page.getByTestId("menu-administration"))
            .click();
          await expect(page).toHaveURL(/\/settings\/server$/);
        } else {
          await page
            .getByRole("menuitem")
            .and(page.getByTestId("menu-settings"))
            .click();
          await expect(page).toHaveURL(/\/settings$/);
          await expect(
            page.getByRole("heading").and(page.getByTestId("settings-title")),
          ).toBeVisible();
          await page
            .getByRole("button")
            .and(page.getByTestId("settings-back"))
            .click();
          await expect(
            page
              .getByRole("button")
              .and(page.getByTestId("account-menu-trigger")),
          ).toBeFocused();
        }
      } finally {
        // Drain intercepted server responses while the page is still alive.
        await page.unrouteAll({ behavior: "wait" });
        await page.request.get("/fixture/pi-state?value=usable");
        await page.request.get("/fixture/scenario?value=ready");
      }
    });
  }
}

test("@lab outage account menu hides administration when server role cannot be read", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
  await page.route("**/api/v1/server", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  try {
    await page.request.get("/fixture/scenario?value=error");
    await page.reload();
    await expect(
      page
        .getByRole("heading")
        .and(page.getByTestId("workspaces-unavailable-title")),
    ).toBeVisible();
    await page
      .getByRole("button")
      .and(page.getByTestId("account-menu-trigger"))
      .click();
    await expect(
      page.getByRole("menuitem").and(page.getByTestId("menu-administration")),
    ).toHaveCount(0);
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});
