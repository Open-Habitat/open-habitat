import { labOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
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
      await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
      await page.getByRole("link", { name: "Alice" }).click();
      await expect(
        page.getByRole("button", { name: /Tilivalikko/ }),
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
            page.getByRole("heading", {
              name: "Valitse GitHub-repot haettaviksi",
            }),
          ).toBeVisible();
          await page.getByRole("checkbox").first().check();
          await page.getByRole("button", { name: /jatka/i }).click();
        }
        await expect(
          page.getByRole("heading", {
            name:
              situation === "outage"
                ? "Työtiloja ei saatu näkyviin"
                : "Kirjaudu OpenAI-tiliisi",
          }),
        ).toBeVisible();
        await expect(page.getByRole("navigation")).toHaveCount(0);
        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: 720 });
          const account = page.getByRole("button", {
            name: "Alice, Tilivalikko",
          });
          await expect(account).toBeVisible();
          await expect(
            page.getByRole("button", { name: "Bob, Tilivalikko" }),
          ).toHaveCount(0);
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
            page.getByRole("menuitem", { name: "Asetukset" }),
          ).toBeVisible();
          await expect(
            page.getByRole("menuitem", { name: "Palvelimen ylläpito" }),
          ).toHaveCount(administrator ? 1 : 0);
          await expect(
            page
              .getByRole("group", { name: "Teema" })
              .getByRole("button", { name: "Vaalea" }),
          ).toBeVisible();
          await expect(
            page.getByRole("menuitem", { name: "Kirjaudu ulos…" }),
          ).toBeVisible();
          await expect(
            page.getByRole("link", { name: "Palvelimen ylläpito" }),
          ).toHaveCount(0);
          await page.keyboard.press("Escape");
        }
        await page.getByRole("button", { name: /Tilivalikko/ }).click();
        if (administrator) {
          await page
            .getByRole("menuitem", { name: "Palvelimen ylläpito" })
            .click();
          await expect(page).toHaveURL(/\/administration$/);
        } else {
          await page.getByRole("menuitem", { name: "Asetukset" }).click();
          await expect(page).toHaveURL(/\/settings$/);
          await expect(
            page.getByRole("heading", { name: "Asetukset" }),
          ).toBeVisible();
          await page.getByRole("button", { name: "Takaisin" }).click();
          await expect(
            page.getByRole("button", { name: /Tilivalikko/ }),
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
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeVisible();
  await page.route("**/api/v1/server", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  try {
    await page.request.get("/fixture/scenario?value=error");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Työtiloja ei saatu näkyviin" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Tilivalikko/ }).click();
    await expect(
      page.getByRole("menuitem", { name: "Palvelimen ylläpito" }),
    ).toHaveCount(0);
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});
