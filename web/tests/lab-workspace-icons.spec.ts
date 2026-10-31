import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./lab-host";

// Workspace icons (workspace-icons, experimental; proto-workspace-icons'
// Lähdeketju) through the real gateway, daemon and lab files: reseptikirja
// names an emoji in its committed .open-habitat.yaml, kotisivu has a
// favicon.svg the daemon serves through the authenticated icon route, and
// the rest derive a glyph from the name.

// Review material for Jari, never a passing visual comparison.
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
// The conversations this test started; see the wire seam below.
const started = new Set<string>();
async function start(page: Page, name: string) {
  await rail(page)
    .getByRole("link")
    .and(page.getByTestId(`workspace-${name}`))
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("conversation-start"))
    .click();
  await expect(page).toHaveURL(/conversation=pi/);
  started.add(new URL(page.url()).searchParams.get("conversation") ?? "");
}
const listIcon = (page: Page, name: string) =>
  rail(page).getByTestId(`workspace-${name}`).getByTestId("workspace-icon");

test("@workspace-icons the rail shows each workspace's icon from its repository only while the feature is on", async ({
  page,
}) => {
  test.setTimeout(120000);
  // Wire seam: a finished conversation is not in Käynnissä
  // (rail-running-after-done), so each one this test starts has a worker
  // waiting at its own prompt, which keeps its row in sight without a host
  // write.
  await page.route("**/api/v1/snapshot", async (route) => {
    try {
      const response = await route.fetch();
      const body = await response.json();
      for (const a of body.agents)
        if (started.has(a.agent_id)) a.spinoffs_idle = 1;
      await route.fulfill({ response, json: body });
    } catch {
      await route.abort().catch(() => {});
    }
  });
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await start(page, "aurinkokello");
  await start(page, "reseptikirja");
  const group = rail(page).getByTestId("rail-group-aurinkokello");
  await expect(group.locator("h3")).toHaveText("aurinkokello1");
  await expect(rail(page).getByTestId("workspace-icon")).toHaveCount(0);

  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: await session(page),
        data: { experimental: { "workspace-icons": true } },
      })
    ).ok(),
  ).toBeTruthy();
  await page.reload();

  // Käynnissä without its repeated heading; each row leads with its icon.
  await expect(group.locator("h3")).toHaveCount(0);
  await expect(group).toHaveAttribute("aria-label", "aurinkokello");
  await expect(group.getByTestId("workspace-icon-button")).toHaveCount(1);
  await expect(
    rail(page)
      .getByTestId("rail-group-reseptikirja")
      .getByTestId("workspace-icon-button"),
  ).toHaveText("🍳");
  // The chain: the config's emoji, the logo, the derived glyph.
  await expect(listIcon(page, "reseptikirja")).toHaveAttribute(
    "data-kind",
    "emoji",
  );
  await expect(listIcon(page, "reseptikirja")).toHaveText("🍳");
  const logo = listIcon(page, "kotisivu");
  await expect(logo).toHaveAttribute("data-kind", "image");
  await expect
    .poll(() =>
      logo.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(listIcon(page, "aurinkokello")).toHaveAttribute(
    "data-kind",
    "glyph",
  );
  await expect(listIcon(page, "aurinkokello")).toHaveText("AU");
  await shot(page, "tyopoyta");

  // The image is served as an inert image, never as a document.
  const src = await logo.locator("img").getAttribute("src");
  expect(src).toMatch(/^\/api\/v1\/workspaces\/icon\?workspace_id=ws_/);
  const served = await page.request.get(src ?? "");
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("image/svg+xml");
  expect(served.headers()["x-content-type-options"]).toBe("nosniff");
  expect(served.headers()["content-security-policy"]).toContain(
    "sandbox; default-src 'none'",
  );

  // The icon's card names the workspace and where the icon came from.
  await group.getByTestId("workspace-icon-button").first().click();
  const card = page.getByRole("dialog").and(page.getByTestId("workspace-card"));
  await expect(card.getByRole("heading")).toHaveText("aurinkokello");
  await expect(card.getByTestId("workspace-card-source")).toHaveText(
    "Kirjaintunnus · johdettu nimestä",
  );
  expect(
    (await new AxeBuilder({ page }).include(".ah-rail").analyze()).violations,
  ).toEqual([]);
  await shot(page, "tyopoyta-kortti");
  await card.getByTestId("workspace-card-open").click();
  await expect(page).toHaveURL(/\/workspaces\/ws_/);
  await expect(card).toHaveCount(0);

  // The narrow strip shows the icons in place of the initials.
  await rail(page).getByTestId("close-navigation").click();
  await expect(
    rail(page)
      .getByTestId("rail-running")
      .getByTestId("workspace-icon")
      .first(),
  ).toHaveAttribute("data-size", "m");
  await expect(rail(page).locator(".ah-now-dot-letters")).toHaveCount(0);
  await shot(page, "kaistale");
  await rail(page).getByTestId("navigation-open").click();

  // On a phone the card is a sheet along the bottom edge.
  await page.setViewportSize({ width: 390, height: 844 });
  // The new conversations have no message yet: open the drawer in place,
  // since a reload would drop them from Käynnissä.
  await page
    .getByRole("main")
    .getByRole("button")
    .and(page.getByTestId("navigation-open"))
    .click();
  await rail(page)
    .getByTestId("rail-group-aurinkokello")
    .getByTestId("workspace-icon-button")
    .first()
    .click();
  await expect(card).toBeVisible();
  const box = await page.locator(".ah-wsi-popover").boundingBox();
  expect(box && Math.round(box.y + box.height)).toBe(844);
  expect(box && Math.round(box.width)).toBe(390);
  await shot(page, "puhelin-kortti");
});
