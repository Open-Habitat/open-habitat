import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true, colorScheme: "dark" });

async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
  await expect(page.getByTestId("account-menu-trigger")).toBeVisible();
}
async function select(
  page: import("@playwright/test").Page,
  theme: "light" | "dark" | "contrast" | "system",
) {
  await page.getByTestId("account-menu-trigger").click();
  const option = page.getByTestId(`segment-${theme}`);
  await option.click();
  await expect(option).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
}

test("production theme follows the system, persists an explicit device choice, and responds live", async ({
  page,
}) => {
  await login(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await select(page, "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByTestId("account-menu-trigger")).toBeVisible();
  await page.emulateMedia({ colorScheme: "light" });
  await select(page, "system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await select(page, "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("Korkea kontrasti is a fourth choice, and Järjestelmä picks it when the device asks for more contrast", async ({
  page,
}) => {
  await login(page);
  await select(page, "contrast");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "contrast");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "contrast");
  // Settings › Ulkoasu shows the same choice; no empty selection.
  await page.goto("/settings/appearance");
  const theme = page.getByRole("button").and(page.getByTestId("theme-choice"));
  await expect(theme).toHaveAttribute("data-value", "contrast");
  await theme.click();
  await expect(page.getByTestId("choice-contrast")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByTestId("choice-system").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ contrast: "more" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "contrast");
  await page.emulateMedia({ contrast: "no-preference", colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  // Before the bundle runs, the bootstrap resolves the same way.
  await page.emulateMedia({ contrast: "more" });
  await page.route("**/assets/*.js", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "contrast");
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
  // Only index.html's static landing is there; the application never ran.
  await expect(
    page.locator('#root > .ah-landing[data-landing="static"]'),
  ).toHaveCount(1);
  await expect(page.locator("#root main")).toHaveCount(0);
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
  await select(page, "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "light" });
  await select(page, "system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
