import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Locator } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Capture of the shipped Google flows for the round
// design-system/prototypes/rounds/2026-11-24-google-external-admin. Review
// material, not a test: copied into web/tests only while capturing.
// OH_GOOGLE_CAPTURE_DIR must name a directory outside the repository.

const googleID =
  "915508263417-a8d2kq0zr7m3vh1ts9pe5wybc6lfnjxu.apps.googleusercontent.com";
const dir = process.env.OH_GOOGLE_CAPTURE_DIR ?? "";
const widths = [1440, 390] as const;

/** Grow the viewport so a scrolling dialog shows all of its content. */
async function shot(page: Page, name: string, width: number) {
  const base = width > 600 ? 900 : 844;
  await page.setViewportSize({ width, height: base });
  await page.waitForTimeout(150);
  let extra = await page.evaluate(() => {
    let most = 0;
    const dlg = document.querySelector("[role=dialog]");
    if (!dlg) return 0;
    for (const el of document.querySelectorAll<HTMLElement>("*")) {
      if (!(el.contains(dlg) || dlg.contains(el))) continue;
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY))
        most = Math.max(most, el.scrollHeight - el.clientHeight);
    }
    return most;
  });
  if (extra > 0) {
    await page.setViewportSize({
      width,
      height: Math.min(4000, base + extra + 40),
    });
    await page.waitForTimeout(150);
  }
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}-${width}.png`) });
  await page.setViewportSize({ width: 1440, height: 900 });
  extra = 0;
}
const both = async (page: Page, name: string) => {
  for (const w of widths) await shot(page, name, w);
};

async function signIn(page: Page, path: string) {
  await page.goto("/settings");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expect(page).not.toHaveURL(/fixture\/provider/);
  await page.goto(path);
}
const next = (d: Locator) =>
  d.getByRole("button").and(d.getByTestId("si-next")).click();

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
  locale: "fi-FI",
  reducedMotion: "reduce",
  colorScheme: "light",
});

test("capture: administrator, personal path", async ({ page }) => {
  test.setTimeout(240_000);
  await page.request.get("/fixture/integration-apps?clear=google");
  await signIn(page, "/settings/server-integrations");
  await both(page, "a01-integrations-empty");
  await page.getByRole("button").and(page.getByTestId("si-setup-google")).click();
  const d = page.getByTestId("si-setup-dialog");
  await expect(d.getByTestId("gg-choice")).toBeVisible();
  await both(page, "a02-whose");
  await d.getByTestId("gg-choose-personal").check();
  await both(page, "a03-whose-personal");
  for (const step of ["apis", "brand", "scopes", "publish"]) {
    await next(d);
    await expect(d.getByTestId("si-stepname")).toHaveAttribute(
      "data-step",
      step,
    );
    await both(page, `a04-personal-${step}`);
  }
  await d.getByTestId("gg-publish").getByText("In production").click();
  await both(page, "a05-personal-publish-production");
  await next(d);
  await both(page, "a06-personal-client");
  await d.getByTestId("si-field-client_id").fill(googleID);
  await d.getByTestId("si-field-client_secret").fill("GOCSPX-synthetic");
  await d.getByRole("button").and(d.getByTestId("si-save")).click();
  await expect(d.getByTestId("si-step-workspace")).toBeVisible();
  await both(page, "a07-personal-workspace");
  await next(d);
  await expect(d.getByTestId("gg-try")).toBeVisible();
  await both(page, "a08-personal-try");
  await d.getByRole("button").and(d.getByTestId("gg-done")).click();
  await expect(d).toHaveCount(0);
  await both(page, "a09-integrations-configured");
  await page.getByTestId("si-menu-google").getByRole("button").click();
  await both(page, "a10-row-menu");
  await page.getByTestId("menu-audience").click();
  const w = page.getByTestId("gg-audience-dialog");
  await expect(w.getByTestId("gg-existing")).toBeVisible();
  await both(page, "a11-audience-item");
  await w.getByTestId("gg-choose-org").check();
  await both(page, "a12-audience-item-org");
  await w.getByTestId("gg-choose-personal").check();
  for (let i = 0; i < 4; i++) {
    await next(w);
    const step = await w.getByTestId("si-stepname").getAttribute("data-step");
    await both(page, `a13-audience-item-${i + 1}-${step}`);
  }
});

test("capture: administrator, organisation path (Internal)", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.request.get("/fixture/integration-apps?clear=google");
  await signIn(page, "/settings/server-integrations");
  await page.getByRole("button").and(page.getByTestId("si-setup-google")).click();
  const d = page.getByTestId("si-setup-dialog");
  await d.getByTestId("gg-choose-org").check();
  await both(page, "b01-whose-org");
  for (let i = 0; i < 3; i++) {
    await next(d);
    const step = await d.getByTestId("si-stepname").getAttribute("data-step");
    await both(page, `b02-org-${i + 1}-${step}`);
  }
  await next(d);
  await d.getByTestId("si-field-client_id").fill(googleID);
  await d.getByTestId("si-field-client_secret").fill("GOCSPX-synthetic");
  await d.getByRole("button").and(d.getByTestId("si-save")).click();
  await expect(d.getByTestId("gg-try")).toBeVisible();
  await both(page, "b03-org-try");
  await d.getByRole("button").and(d.getByTestId("gg-done")).click();
  await both(page, "b04-integrations-internal-configured");
});

test("capture: person, connect Google", async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page, "/settings/agent-data");
  await expect(page.getByTestId("integrations-loading")).toHaveCount(0);
  await page.request.get("/fixture/integrations?action=reset");
  await page.reload();
  await both(page, "p01-agent-data");
  const tile = page.getByTestId("integration-tile-google");
  await tile
    .getByRole("button")
    .and(tile.getByTestId("integration-connect-open"))
    .click();
  const d = page.getByRole("dialog");
  await both(page, "p02-level");
  await d
    .getByRole("button")
    .and(d.getByTestId("integration-continue"))
    .click();
  await expect(d.getByTestId("gc-note")).toBeVisible();
  await both(page, "p03-before-google");
  await d.getByTestId("gc-more").click();
  await both(page, "p04-help-panel");
  await d.getByTestId("gc-help-internal").click();
  await both(page, "p05-help-internal");
  await d.getByTestId("gc-help-internal").click();
  await d.getByTestId("gc-help-warning").click();
  await both(page, "p06-help-warning");
  await d.getByTestId("gc-help-warning").click();
  const popup = page.waitForEvent("popup");
  await d
    .getByRole("link")
    .and(d.getByTestId("integration-provider-link"))
    .click();
  await (await popup).close();
  await expect(d.getByTestId("gc-wait")).toBeVisible();
  await both(page, "p07-waiting");
  const field = d
    .getByRole("textbox")
    .and(d.getByTestId("integration-redirect-input"));
  await field.fill(
    "http://127.0.0.1:46399/oauth2/callback?state=lab&error=access_denied",
  );
  await d.getByRole("button").and(d.getByTestId("integration-connect")).click();
  await expect(d.getByTestId("integration-stopped-at-provider")).toBeVisible();
  await both(page, "p08-stopped-at-google");
  await field.fill(
    "http://127.0.0.1:46399/oauth2/callback?state=lab&error=org_internal",
  );
  await d.getByRole("button").and(d.getByTestId("integration-connect")).click();
  await page.waitForTimeout(300);
  await both(page, "p09-error-org-internal-pasted");
  await field.fill(
    "http://127.0.0.1:46399/oauth2/callback?state=lab&code=4/synthetic",
  );
  await d.getByRole("button").and(d.getByTestId("integration-connect")).click();
  await expect(d.getByTestId("integration-folder-choice")).toBeVisible();
  await both(page, "p10-folders");
  await d
    .getByRole("button")
    .and(d.getByTestId("integration-sync-start"))
    .click();
  await expect(d.getByTestId("integration-connected")).toBeVisible();
  await both(page, "p11-connected-granted");
  await d.getByRole("button").and(d.getByTestId("integration-done")).click();
  await both(page, "p12-agent-data-connected");
});
