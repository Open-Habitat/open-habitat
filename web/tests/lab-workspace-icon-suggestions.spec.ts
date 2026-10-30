import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./lab-host";

// Model-suggested workspace icons (workspace-icons, experimental; Sirut)
// through the real gateway and daemon. The lab's synthetic model answers the
// daemon's helper like a careless or steered model: a web address, a README
// word, a repeat, another workspace's icon and too many letters among the
// valid ones; the page must show only what the daemon let through. Loading,
// no-model and timeout states are the browser's to show, so those replies
// are held or replaced in the browser.

const capture = process.env.OH_WORKSPACE_ICONS_CAPTURE;
async function shot(page: Page, name: string) {
  if (!capture) return;
  mkdirSync(capture, { recursive: true });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(capture, `${name}-${scheme}.png`) });
  }
  await page.emulateMedia({ colorScheme: "light" });
}
async function session(page: Page) {
  const s = await (await page.request.get("/auth/session")).json();
  return {
    Origin: new URL(page.url()).origin,
    "X-Agent-Host-CSRF": s.csrf as string,
  };
}
const rail = (page: Page) => page.getByRole("navigation");
async function openWorkspace(page: Page, name: string) {
  await rail(page)
    .getByRole("link")
    .and(page.getByTestId(`workspace-${name}`))
    .click();
  await expect(page).toHaveURL(/\/workspaces\/ws_/);
  return new URL(page.url()).pathname.split("/").pop() ?? "";
}
const icons = (page: Page) =>
  page
    .getByTestId("workspace-icon-suggestion")
    .getByTestId("workspace-icon")
    .allTextContents();

test("@workspace-icons the model's suggestions under the heading, validated by the daemon and accepted with one click", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.waitForURL(/\/workspaces/);
  const headers = await session(page);
  for (const [url, data] of [
    [
      "/api/v1/account/preferences",
      { experimental: { "workspace-icons": true } },
    ],
    [
      "/api/v1/account/git-identity",
      {
        name: "Synthetic lab",
        email: "synthetic@example.invalid",
        mode: "settings",
      },
    ],
  ] as const) {
    const r =
      url === "/api/v1/account/preferences"
        ? await page.request.put(url, { headers, data })
        : await page.request.post(url, { headers, data });
    expect(r.ok()).toBeTruthy();
  }
  await page.reload();
  const id = await openWorkspace(page, "aurinkokello");
  const row = page.getByTestId("workspace-icon-suggestions");
  await expect(row).toHaveAttribute("data-state", "done");
  // Only what the daemon let through: no web address, no README word, no
  // repeat, not reseptikirja's 🍳, not four letters.
  expect(await icons(page)).toEqual(["🧭", "🦉", "☀️", "🌿"]);
  await expect(row.locator("code")).toHaveText("synthetic/icon-fixture");
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-testid=workspace-icon-suggestions]")
        .analyze()
    ).violations,
  ).toEqual([]);
  await shot(page, "sirut");

  // A quick wish is a new round; the arrows go back to the first.
  await row.getByTestId("workspace-icon-quick").nth(2).click();
  await expect.poll(() => icons(page)).toEqual(["AK", "A", "AKL"]);
  await expect(row.getByTestId("workspace-icon-rounds")).toBeVisible();
  await row.getByTestId("workspace-icon-round-back").click();
  await expect.poll(() => icons(page)).toEqual(["🧭", "🦉", "☀️", "🌿"]);

  // One click accepts: written and committed, the row goes, nothing said.
  const before = await (
    await page.request.get(`/api/v1/workspaces/git?workspace_id=${id}`)
  ).json();
  await row
    .getByTestId("workspace-icon-suggestion")
    .filter({ hasText: "🦉" })
    .click();
  await expect(row).toHaveCount(0);
  const head = page
    .getByTestId("workspace-icon-picker")
    .getByTestId("workspace-icon");
  await expect(head).toHaveText("🦉");
  await expect(
    rail(page)
      .getByTestId("workspace-aurinkokello")
      .getByTestId("workspace-icon"),
  ).toHaveText("🦉");
  await expect(page.getByTestId("workspace-icon-note")).toHaveCount(0);
  await expect
    .poll(async () => {
      const g = await (
        await page.request.get(`/api/v1/workspaces/git?workspace_id=${id}`)
      ).json();
      return g.commits[0]?.hash;
    })
    .not.toBe(before.commits[0]?.hash);
  // A set icon has no row; the picker asks the model again on request.
  await page.reload();
  await expect(page.getByTestId("workspace-icon-picker")).toBeVisible();
  await expect(row).toHaveCount(0);
  await page.getByTestId("workspace-icon-picker").click();
  await page.getByTestId("workspace-icon-ask-model").click();
  await expect(row).toHaveAttribute("data-state", "done");

  // While the model thinks: placeholders and the reading line; then a
  // timeout keeps the page honest and offers the choices without a model.
  let release!: () => void;
  const held = new Promise<void>((r) => {
    release = r;
  });
  await page.route("**/api/v1/workspaces/icon/suggestions", async (route) => {
    await held;
    await route.fulfill({
      json: {
        schema_version: 1,
        state: "failed",
        reason: "model_timeout",
        seen: { readme: true, start_page: false },
      },
    });
  });
  await openWorkspace(page, "tilastoharjoitus");
  await expect(row).toHaveAttribute("data-state", "loading");
  await expect(row.locator("[aria-busy=true]")).toBeVisible();
  await expect(row.getByTestId("workspace-icon-wish-send")).toBeDisabled();
  await shot(page, "lataa");
  release();
  await expect(row).toHaveAttribute("data-state", "failed");
  await expect(
    row.getByTestId("workspace-icon-suggestions-retry"),
  ).toBeVisible();
  await expect(
    row.getByTestId("workspace-icon-suggestion").first(),
  ).toHaveAttribute("data-local", "true");
  await shot(page, "aikakatkaisu");

  // No model with credentials: the way is the settings, not another wish.
  await page.unroute("**/api/v1/workspaces/icon/suggestions");
  await page.route("**/api/v1/workspaces/icon/suggestions", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        state: "failed",
        reason: "model_unavailable",
        seen: { readme: false, start_page: false },
      },
    }),
  );
  await openWorkspace(page, "muistiinpanot");
  await expect(row).toHaveAttribute("data-state", "failed");
  await expect(row.getByTestId("workspace-icon-wish")).toHaveCount(0);
  await expect(
    row.getByTestId("workspace-icon-suggestions-settings"),
  ).toBeVisible();
  await expect(row.getByTestId("workspace-icon-suggestion")).not.toHaveCount(0);
  // Ei nyt hides it for this visit only.
  await row.getByTestId("workspace-icon-suggestions-dismiss").click();
  await expect(row).toHaveCount(0);
  await page.reload();
  await expect(row).toHaveAttribute("data-state", "failed");
  // Automaattinen writes icon: auto, which hides the row for good.
  await page.getByTestId("workspace-icon-picker").click();
  await page.getByTestId("workspace-icon-auto").click();
  await expect(row).toHaveCount(0);
  await expect
    .poll(async () => {
      const s = await (await page.request.get("/api/v1/snapshot")).json();
      return s.workspaces.find(
        (w: { name: string }) => w.name === "muistiinpanot",
      )?.icon_auto;
    })
    .toBe(true);
  await page.reload();
  await expect(page.getByTestId("workspace-icon-picker")).toBeVisible();
  await expect(row).toHaveCount(0);

  // On a phone the row fits the page's width.
  await page.unroute("**/api/v1/workspaces/icon/suggestions");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/workspaces/${id}`);
  await page.getByTestId("workspace-icon-picker").click();
  await page.getByTestId("workspace-icon-ask-model").click();
  await expect(row).toHaveAttribute("data-state", "done");
  const width = await row.evaluate((el) => [el.scrollWidth, el.clientWidth]);
  expect(width[0]).toBeLessThanOrEqual(width[1]);
  const box = await row.boundingBox();
  expect(box && box.x + box.width).toBeLessThanOrEqual(390);
  await shot(page, "puhelin-sirut");
});
