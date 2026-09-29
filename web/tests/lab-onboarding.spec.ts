import { expect, test } from "@playwright/test";

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
    await page.getByRole("button", { name: "Jatka" }).click();
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
    await expect(
      page.getByRole("heading", { name: "Workspacet" }),
    ).toBeVisible();
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});
