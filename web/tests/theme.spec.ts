import { expect, test } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true, colorScheme: "dark" });

async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(page.getByRole("button", { name: "Tilivalikko" })).toBeVisible();
}
async function select(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: "Tilivalikko" }).click();
  await page.getByRole("menuitem", { name: `Teema: ${name}` }).click();
}

test("production theme follows the system, persists an explicit device choice, and responds live", async ({
  page,
}) => {
  await login(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await select(page, "Vaalea");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "Tilivalikko" })).toBeVisible();
  await page.emulateMedia({ colorScheme: "light" });
  await select(page, "Järjestelmä");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await select(page, "Tumma");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("theme is applied before the application bundle executes", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("nah:theme", "light"));
  await page.route("**/assets/*.js", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
  );
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("#root")).toBeEmpty();
});

test("theme remains usable if localStorage is denied", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("denied");
      },
    });
  });
  await login(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await select(page, "Vaalea");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "light" });
  await select(page, "Järjestelmä");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
