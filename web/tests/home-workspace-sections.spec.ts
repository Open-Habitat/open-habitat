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
  await expect(
    page.getByRole("button", { name: /Työtilan .* toiminnot/ }),
  ).toHaveCount(0);
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

test("@lab home clone turns into progress, never creates twice and lands in the workspace", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let posts = 0;
  await page.route("**/api/v1/onboarding/github/clones", async (route) => {
    posts++;
    const reply = await route.fetch();
    await delayed;
    await route.fulfill({ response: reply }).catch(() => {});
  });
  await page
    .locator("main")
    .getByRole("button", { name: "Uusi työtila" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Uusi työtila" });
  await dialog
    .getByRole("textbox", { name: "Repositorio" })
    .fill("fixture/last");
  await dialog.getByRole("button", { name: "Luo työtila" }).click();
  try {
    // While the slow clone runs the dialog is its progress: no second create.
    await expect(dialog.getByRole("status")).toContainText(
      "Kloonataan fixture/last",
    );
    await expect(
      dialog.getByRole("button", { name: "Luo työtila" }),
    ).toHaveCount(0);
    await expect(dialog.locator(".ah-new-footer")).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Sulje", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
  } finally {
    release();
  }
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/workspaces\/ws_[A-Za-z0-9_-]+/);
  // The new workspace's first conversation opens (Jari 16.10.2026).
  await expect(
    page.locator("main").getByRole("link", { name: "last", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  expect(posts).toBe(1);
});

test("@lab a failed clone ends the dialog's request with its reason", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page.route("**/api/v1/onboarding/github/clones", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ schema_version: 1, error: "clone_conflict" }),
    }),
  );
  await page
    .locator("main")
    .getByRole("button", { name: "Uusi työtila" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Uusi työtila" });
  await dialog
    .getByRole("textbox", { name: "Repositorio" })
    .fill("fixture/last");
  await dialog.getByRole("button", { name: "Luo työtila" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Kloonausta ei voitu vahvistaa",
  );
  await expect(dialog.getByRole("button", { name: "Luo työtila" })).toHaveCount(
    0,
  );
  await dialog
    .locator(".ah-new-footer")
    .getByRole("button", { name: "Sulje" })
    .click();
  await expect(dialog).toHaveCount(0);
});

// A clone cut by a daemon restart leaves a .git without commits. It is not a
// workspace, blocks a plain new clone, and only the explicit Aloita alusta
// replaces it (Jari 17.10.2026: never restarted by itself).
test("@lab an interrupted clone is offered only an explicit restart", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.request.get("/fixture/checkout?name=first&mode=interrupted");
  try {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
    await expect(
      page.getByRole("heading", { name: "Työtilat", level: 1 }),
    ).toBeVisible();
    await expect(
      page.locator("main").getByRole("link", { name: "first", exact: true }),
    ).toHaveCount(0);
    const before = Number(
      await (await page.request.get("/fixture/clone-count")).text(),
    );
    await page
      .locator("main")
      .getByRole("button", { name: "Uusi työtila" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Uusi työtila" });
    await dialog
      .getByRole("textbox", { name: "Repositorio" })
      .fill("fixture/first");
    await dialog.getByRole("button", { name: "Luo työtila" }).click();
    await expect(
      dialog.getByText(/Edellinen kloonaus jäi kesken/),
    ).toBeVisible();
    expect(
      Number(await (await page.request.get("/fixture/clone-count")).text()),
    ).toBe(before + 1);
    await dialog.getByRole("button", { name: "Aloita alusta" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/workspaces\/ws_[A-Za-z0-9_-]+/);
    await expect(
      page.locator("main").getByRole("link", { name: "first", exact: true }),
    ).toBeVisible();
    expect(
      Number(await (await page.request.get("/fixture/clone-count")).text()),
    ).toBe(before + 2);
  } finally {
    await page.request.get("/fixture/checkout?name=first&mode=absent");
  }
});
