import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
const evidence = "test-results/evidence";
test("foundation happy route is explicit and read-only", async ({ page }) => {
  await page.goto("/workspaces?fixture=ready");
  await expect(
    page.getByRole("heading", { name: "Native Agent Host" }),
  ).toBeVisible();
  await expect(page.getByText("Reitti:").locator("code")).toHaveText(
    "/workspaces",
  );
  await expect(
    page.getByText("Kirjoitustoiminnot eivät ole vielä käytössä."),
  ).toBeVisible();
  await page.screenshot({
    path: `${evidence}/foundation-ready.png`,
    fullPage: true,
  });
});
test("authentication boundary offers only configured provider", async ({
  page,
}) => {
  await page.goto("/?fixture=auth");
  await expect(page.getByRole("alert")).toContainText("Istunto puuttuu");
  await expect(
    page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
  ).toBeVisible();
  await expect(page.getByText("Linux-käyttäjää")).toBeVisible();
  await page.screenshot({
    path: `${evidence}/foundation-auth.png`,
    fullPage: true,
  });
});
test("daemon error remains honest", async ({ page }) => {
  await page.goto("/workspaces?fixture=daemon");
  await expect(
    page.getByRole("heading", { name: "Yhteyttä ei saatu" }),
  ).toBeVisible();
  await expect(
    page.getByText("Viime komentoa ei lähetetä automaattisesti uudelleen."),
  ).toBeVisible();
  await page.screenshot({
    path: `${evidence}/foundation-daemon-error.png`,
    fullPage: true,
  });
});
test("@a11y critical foundation states have no axe violations", async ({
  page,
}) => {
  for (const fixture of ["ready", "auth", "daemon"]) {
    await page.goto(`/?fixture=${fixture}`);
    await expect(page.locator("main")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, fixture).toEqual([]);
  }
});
