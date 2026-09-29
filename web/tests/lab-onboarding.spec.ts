import { expect, test } from "@playwright/test";

test("@lab shell opens conversations from home and keeps narrow navigation reachable", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(
    page.getByRole("heading", { name: "Työtilat", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ah-connection")).toHaveCount(0);
  await expect(
    page.locator(".ah-workspace-card a[href^='/agents/']").first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Avaa navigaatio" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Työtilat ja keskustelut" })
      .getByRole("link", { name: "Kaikki työtilat" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Avaa navigaatio" }).click();
  await expect(
    page.getByRole("link", { name: "Kaikki työtilat" }),
  ).toBeVisible();
  await page.locator(".ah-rail .ah-workspace-link").first().click();
  await expect(
    page.getByRole("button", { name: "Avaa navigaatio" }),
  ).toBeVisible();
  await page.locator(".ah-back-link").click();
  await page.locator(".ah-workspace-card a[href^='/agents/']").first().click();
  await expect(page).toHaveURL(/\/agents\/pi:/);
});

test("@lab GitHub chooser, synthetic clone and Pi onboarding", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  try {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
    await expect(
      page.getByRole("heading", { name: "Valitse GitHub-repot haettaviksi" }),
    ).toBeVisible();
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: /jatka/i }).click();
    await expect(
      page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
    ).toBeVisible();
    expect(
      (
        await (
          await page.request.get(
            "/api/v1/onboarding/github/checkout?full_name=fixture%2Ffirst",
          )
        ).json()
      ).state,
    ).toBe("confirmed");
    await page.request.get("/fixture/pi-state?value=usable");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Työtilat" })).toBeVisible();
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});
