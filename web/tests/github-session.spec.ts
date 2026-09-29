import { expect, test } from "@playwright/test";

test.use({ baseURL: "https://127.0.0.1:4174", ignoreHTTPSErrors: true });
test("@github-first logout and new cookie erase previous chooser during in-flight page", async ({
  context,
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  let release = () => {};
  try {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
    await expect(page.getByText("fixture/first")).toBeVisible();
    await page.getByRole("checkbox").first().check();
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let captured!: () => void;
    const started = new Promise<void>((resolve) => {
      captured = resolve;
    });
    await page.route(
      "**/api/v1/onboarding/github/repos?page=2&limit=2",
      async (route) => {
        const response = await route.fetch();
        captured();
        await blocked;
        await route.fulfill({ response }).catch(() => {});
      },
    );
    const next = page
      .getByRole("button", { name: "Näytä lisää repoja" })
      .click();
    await started;
    const other = await context.newPage();
    await other.goto("/workspaces");
    await other
      .getByRole("button", { name: "Keskeytä käyttöönotto ja kirjaudu ulos" })
      .click();
    await expect(
      other.getByRole("button", { name: "Kirjaudu GitHubilla" }),
    ).toBeVisible();
    await other.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await other.getByRole("link", { name: "Bob" }).click();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    release();
    await next.catch(() => {});
    await expect(page.getByText("fixture/first")).toHaveCount(0, {
      timeout: 9000,
    });
    // An old-session response can require a fresh load instead of silently
    // rebinding old selections to Bob. The new cookie's catalog starts empty.
    await page.reload();
    await expect(page.getByText("fixture/bob-only")).toBeVisible();
    await expect(page.getByText("Valittu 0 repoa.")).toBeVisible();
  } finally {
    release();
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
