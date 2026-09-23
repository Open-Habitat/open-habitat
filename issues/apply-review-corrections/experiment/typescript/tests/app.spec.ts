import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("@a11y app is usable", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Native Agent Host" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
