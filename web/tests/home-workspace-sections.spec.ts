import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

test("@lab home sections, workspace menu and directory creation", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(
    page.getByRole("heading", { name: "Työtilat", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".ah-home-section").first()).toBeVisible();
  const menu = page
    .getByRole("button", { name: /Työtilan .* toiminnot/ })
    .first();
  await menu.click();
  await expect(
    page.getByRole("menuitem", { name: "Poista työtila… · tulossa" }),
  ).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
  await page
    .locator("main")
    .getByRole("button", { name: "Uusi työtila" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Uusi työtila" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Uusi hakemisto" }).click();
  await page.getByRole("textbox", { name: "Nimi" }).fill("uusi-tyotila");
  await page.getByRole("button", { name: "Luo työtila" }).click();
  await expect(
    page.getByRole("link", { name: "uusi-tyotila" }).first(),
  ).toBeVisible();
});

test("@lab home clone uses existing GitHub path", async ({ page }) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .locator("main")
    .getByRole("button", { name: "Uusi työtila" })
    .click();
  await page.getByRole("textbox", { name: "Repositorio" }).fill("fixture/last");
  await page.getByRole("button", { name: "Luo työtila" }).click();
  await expect(
    page.getByRole("link", { name: "last", exact: true }).first(),
  ).toBeVisible();
});
