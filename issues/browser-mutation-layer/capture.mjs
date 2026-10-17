// Paired lab captures for browser-mutation-layer. Run from the repository
// root against a running synthetic lab (scripts/lab.sh start):
//   PLAYWRIGHT_BROWSERS_PATH=$PWD/.cache/ms-playwright node issues/browser-mutation-layer/capture.mjs
// Writes are held or answered by the test route, never by a live host.
import { openLab, snapshot } from "../../web/lab/session.mjs";
import { expect } from "../../web/node_modules/@playwright/test/index.mjs";

const hold = () => {
  const gates = [];
  return {
    wait: () => new Promise((r) => gates.push(r)),
    release: () => {
      for (const g of gates.splice(0)) g();
    },
  };
};
for (const narrow of [false, true])
  for (const dark of [false, true]) {
    const tag = `${narrow ? "phone" : "desktop"}-${dark ? "dark" : "light"}`;
    const { page, browser } = await openLab({
      width: narrow ? 390 : 1440,
      height: narrow ? 844 : 900,
    });
    if (dark) await page.emulateMedia({ colorScheme: "dark" });
    const shot = (name) =>
      snapshot(page, `issues/browser-mutation-layer/lab-${tag}-${name}`);
    const nav = async () => {
      if (narrow)
        await page.getByRole("button", { name: "Avaa navigaatio" }).click();
    };
    const closeNav = async () => {
      if (narrow)
        await page.getByRole("button", { name: "Sulje navigaatio" }).click();
    };
    const workspace = async (name) => {
      await page.goto(new URL("/workspaces", page.url()).href);
      await nav();
      await page
        .locator(".ah-workspace")
        .getByRole("link", { name, exact: true })
        .click();
    };

    // 1. A slow confirmation: the archive shows at once, and after two
    // seconds the page says the server has not confirmed it yet.
    await workspace("muistiinpanot");
    const slow = hold();
    await page.route("**/api/v1/workspaces", async (route) => {
      if (route.request().method() === "POST") await slow.wait();
      await route.continue().catch(() => {});
    });
    await page.getByRole("button", { name: "Arkistoi työtila" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "viipyy" }),
    ).toBeVisible({ timeout: 4000 });
    await shot("archive-slow");
    slow.release();
    await expect(
      page.getByRole("status").filter({ hasText: "viipyy" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Palauta työtila" }).click();
    await page.unroute("**/api/v1/workspaces");

    // 2. Closing an empty conversation: pending, dimmed and marked.
    await workspace("muistiinpanot");
    await page
      .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
      .click();
    await expect(page).toHaveURL(/conversation=pi:/, { timeout: 15000 });
    const closing = hold();
    await page.route("**/api/v1/conversations/*/close", async (route) => {
      await closing.wait();
      await route.continue().catch(() => {});
    });
    const close = page.locator(".ah-agent-header").getByRole("button", {
      name: "Sulje",
    });
    await expect(close).toBeEnabled({ timeout: 15000 });
    await close.click();
    await expect(
      page.locator(".ah-home-card").filter({ hasText: "Suljetaan…" }),
    ).toBeVisible();
    await nav();
    await shot("close-pending");
    await closeNav();
    closing.release();
    await page.unroute("**/api/v1/conversations/*/close");

    // 3. A definite refusal of + (the daemon's capacity of four).
    await workspace("muistiinpanot");
    await page.route("**/api/v1/conversations", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 429,
            contentType: "application/json",
            body: JSON.stringify({
              schema_version: 1,
              error: {
                code: "capacity_exceeded",
                message: "Request could not be completed",
                retryable: false,
                correlation_id: "req_00000000",
              },
            }),
          })
        : route.continue(),
    );
    await page
      .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
      .click();
    await expect(
      page.getByText("Keskustelua ei luotu", { exact: true }),
    ).toBeVisible();
    await shot("create-refused");
    await page.unroute("**/api/v1/conversations");
    await browser.close();
  }
