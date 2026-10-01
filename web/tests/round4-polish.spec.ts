import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "@playwright/test";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("@workspace-slice home labels history honestly and route focus keeps keyboard ring", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page.goto("/workspaces");
  const heading = page.getByRole("heading", {
    name: "Jatka siitä, mihin jäit",
  });
  await expect(heading).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Jatka siitä, mihin jäit" }),
  ).toBeVisible();
  const links = page.locator(".ah-continue-list a");
  await expect(links.first()).toBeVisible();
  for (const link of await links.all()) {
    if ((await link.getAttribute("href"))?.startsWith("/agents/"))
      await expect(link).toContainText("Vain luettavissa");
  }
  // Mouse navigation moves screen-reader focus, but does not draw the UA's black frame.
  await expect
    .poll(() => heading.evaluate((el) => getComputedStyle(el).outlineStyle))
    .toBe("none");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();
  expect(
    await focused.evaluate((el) => getComputedStyle(el).outlineStyle),
  ).toBe("solid");
  expect(
    await focused.evaluate((el) => getComputedStyle(el).outlineWidth),
  ).toBe("2px");
  const readOnly = links.filter({ hasText: "Vain luettavissa" }).first();
  if (await readOnly.count()) {
    await readOnly.click();
    await expect(page).toHaveURL(/\/agents\//);
    await expect(
      page.getByRole("heading", { name: "Jatka siitä, mihin jäit" }),
    ).toHaveCount(0);
  }
});

test("@first-use pending code keeps attempt cancellation separate from sign-out", async ({
  page,
}) => {
  try {
    await page.request.get("/fixture/scenario?value=pi-onboarding");
    await page.request.get("/fixture/pi-state?value=missing");
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Valitse GitHub-repot haettaviksi" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /jatka/i }).click();
    await page.getByRole("button", { name: "Aloita kirjautuminen" }).click();
    await expect(
      page.getByRole("button", { name: "Peruuta kirjautumisyritys" }),
    ).toHaveClass(/ah-button-secondary/);
    await expect(
      page.getByRole("button", {
        name: "Keskeytä käyttöönotto ja kirjaudu ulos",
      }),
    ).toHaveClass(/ah-button-danger-subtle/);
    await page
      .getByRole("button", { name: "Peruuta kirjautumisyritys" })
      .click();
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
