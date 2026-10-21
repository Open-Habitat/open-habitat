import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

test("@lab home sections, workspace menu and directory creation", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".ah-home-section").first()).toBeVisible();
  await expect(
    page.getByRole("button").and(page.getByTestId("workspace-menu")),
  ).toHaveCount(0);
  await page
    .locator("main")
    .getByRole("button")
    .and(page.getByTestId("workspace-create"))
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("segment-directory"))
    .click();
  await page
    .getByRole("textbox")
    .and(page.getByTestId("directory-name"))
    .fill("uusi-tyotila");
  await page
    .getByRole("button")
    .and(page.getByTestId("create-directory"))
    .click();
  await expect(
    page
      .getByRole("link")
      .and(page.getByTestId("workspace-uusi-tyotila"))
      .first(),
  ).toBeVisible();
});
