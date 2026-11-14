import { resolve } from "node:path";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
});

test("@lab slash built-ins and unmatched commands keep the composer usable", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-start-aurinkokello")
    .click();
  const field = page.getByTestId("message-input");
  for (const text of ["lue loki ensimmäinen", "lue loki toinen", "kolmas"]) {
    await field.fill(text);
    await page.getByTestId("send").click();
    await expect(
      page.getByText(`Selvä. Kysyit: "${text}".`).last(),
    ).toBeVisible({ timeout: 20000 });
  }
  // A command typed during a cold opening must not enter the held prompt queue.
  let releaseStatus = () => {};
  const statusGate = new Promise<void>((resolve) => {
    releaseStatus = resolve;
  });
  await page.route("**/api/v1/conversations/*/status*", async (route) => {
    await statusGate;
    await route.continue();
  });
  try {
    await page.reload();
    await field.fill("/compact");
    await field.press("Enter");
    await expect(
      page.getByText("Tiivistäminen ei ole nyt käytettävissä."),
    ).toBeVisible();
    await expect(field).toHaveValue("/compact");
  } finally {
    releaseStatus();
  }
  await expect(page.getByTestId("send")).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await field.fill("");
  await field.fill("/compact");
  await expect(page.getByTestId("composer-field-list")).toBeVisible();
  await expect(page.getByTestId("composer-command-compact")).toBeVisible();
  await expect(
    page.getByTestId("composer-command-compact"),
  ).not.toHaveAttribute("aria-disabled", "true");
  const compacted = page.waitForResponse(
    (response) =>
      response.url().endsWith("/compact") &&
      response.request().method() === "POST",
  );
  await field.press("Enter");
  expect((await compacted).ok()).toBe(true);
  await expect(field).toHaveValue("");
  await expect(page.getByTestId("compaction-marker")).toContainText(
    "Keskustelu tiivistettiin",
    { timeout: 20000 },
  );
  await field.fill("/zzz");
  await expect(
    page.getByTestId("composer-field-list").getByRole("option"),
  ).toHaveCount(0);
  await field.press("ArrowDown");
  await field.press("End");
  await field.press("x");
  await expect(field).toHaveValue("/zzzx");
  await field.press("Backspace");
  await field.press("Enter");
  await expect(page.getByText('Selvä. Kysyit: "/zzz".').last()).toBeVisible({
    timeout: 20000,
  });
  expect(errors).toEqual([]);
});

for (const width of [1440, 390]) {
  for (const language of ["fi", "en-US"]) {
    test(`@lab built-in explanation ${width} ${language}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.request.get("/fixture/conversations-reset");
      await page.request.get("/fixture/scenario?value=ready");
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page
        .getByRole("link")
        .and(page.locator('a[href*="code=42"]'))
        .click();
      const session = await (await page.request.get("/auth/session")).json();
      for (const data of [
        { experimental: { "explain-mode": true } },
        { language },
      ]) {
        expect(
          (
            await page.request.put("/api/v1/account/preferences", {
              headers: {
                Origin: new URL(page.url()).origin,
                "X-Agent-Host-CSRF": session.csrf,
              },
              data,
            })
          ).ok(),
        ).toBe(true);
      }
      await page.reload();
      if (width === 390) await page.getByTestId("navigation-open").click();
      await page
        .getByRole("navigation")
        .getByTestId("workspace-start-aurinkokello")
        .click();
      const field = page.getByTestId("message-input");
      await field.fill("Hello");
      await page.getByTestId("send").click();
      await expect(
        page.getByText('Selvä. Kysyit: "Hello".').last(),
      ).toBeVisible({ timeout: 20000 });
      if (width === 390) await page.getByTestId("navigation-open").click();
      await page.getByTestId("account-menu-trigger").click();
      await page.getByTestId("menu-explain").click();
      if (width === 390)
        await page.locator('[data-testid="close-navigation"]:visible').click();
      await page.getByTestId("command-palette").click();
      await page.getByTestId("command-search").fill("compact");
      const compact = page.getByTestId("composer-command-compact");
      await compact.hover();
      const card = page.getByTestId("explain-card");
      await expect(card).toHaveAttribute("data-card", "L13");
      let writes = 0;
      page.on("request", (request) => {
        if (request.url().endsWith("/compact") && request.method() === "POST")
          writes++;
      });
      await compact.click();
      await expect(field).toHaveValue("");
      await expect(page.locator(".ah-explain-toast")).toHaveCount(0);
      if (process.env.OH_VISUAL_CAPTURE === "1")
        await snapshot(
          page,
          resolve(
            `../issues/composer-slash-builtin-commands/compact-${width}-${language}`,
          ),
          { labOrigin: new URL(page.url()).origin },
        );
      await page.getByTestId("command-search").fill("new");
      const fresh = page.getByTestId("composer-command-new");
      await fresh.hover();
      await expect(card).toHaveAttribute("data-card", "L14");
      if (process.env.OH_VISUAL_CAPTURE === "1")
        await snapshot(
          page,
          resolve(
            `../issues/composer-slash-builtin-commands/new-${width}-${language}`,
          ),
          { labOrigin: new URL(page.url()).origin },
        );
      expect(writes).toBe(0);
      await fresh.click();
      await expect(page).toHaveURL(/\/workspaces\/[^/?]+$/);
    });
  }
}
