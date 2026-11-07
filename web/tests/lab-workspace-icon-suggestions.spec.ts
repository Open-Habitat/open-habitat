import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { snapshot } from "../lab/session.mjs";
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
    await snapshot(page, resolve(capture, `${name}-${scheme}`), {
      labOrigin: new URL(page.url()).origin,
    });
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
  expect(
    (
      await page.request.post("/api/v1/account/git-identity", {
        headers,
        data: {
          name: "Synthetic lab",
          email: "synthetic@example.invalid",
          mode: "settings",
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.reload();
  const id = await openWorkspace(page, "aurinkokello");
  const row = page.getByTestId("workspace-icon-suggestions");
  await expect(row).toHaveAttribute("data-state", "done");
  // Only what the daemon let through: no web address, no README word, no
  // repeat, not reseptikirja's 🍳, not four letters.
  expect(await icons(page)).toEqual(["🧭", "🦉", "☀️", "🌿"]);
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-testid=workspace-icon-suggestions]")
        .analyze()
    ).violations,
  ).toEqual([]);
  await shot(page, "sirut");

  const field = row.getByTestId("workspace-icon-wish");
  const shortHeight = await field.evaluate((el) => el.clientHeight);
  const wish = Array.from({ length: 6 }, (_, i) => `reference line ${i}`).join(
    "\n",
  );
  await field.fill(wish);
  await expect
    .poll(() => field.evaluate((el) => el.clientHeight))
    .toBeGreaterThan(shortHeight);
  await row.locator('input[type="file"]').setInputFiles({
    name: "reference.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(row.getByTestId("send")).toBeEnabled();
  await shot(page, "composer-attachment");
  const sent = page.waitForRequest(
    (r) =>
      r.url().endsWith("/api/v1/workspaces/icon/suggestions") &&
      r.method() === "POST",
  );
  await row.getByTestId("send").click();
  const payload = (await sent).postDataJSON();
  expect(payload.wish).toContain(wish);
  expect(payload.wish).toContain("/api/v1/attachments/");
  await expect(row).toHaveAttribute("data-state", "done");
  await expect(field).toHaveValue("");
  // Full-length non-ASCII wishes and prior rounds reach the daemon through
  // the gateway; byte limits must not accidentally preserve the old 4 KB cap.
  await field.fill("ä".repeat(4096));
  await row.getByTestId("send").click();
  await expect(row).toHaveAttribute("data-state", "done");
  await expect(field).toHaveValue("");
  // A refused oversized wish stays available for correction, not truncated.
  const longWish = "x".repeat(4097);
  await field.fill(longWish);
  await row.getByTestId("send").click();
  await expect(row).toHaveAttribute("data-state", "failed");
  await expect(field).toHaveValue(longWish);
  await field.fill("sent draft");
  let finishWish!: () => void;
  const waitWish = new Promise<void>((resolve) => {
    finishWish = resolve;
  });
  await page.route("**/api/v1/workspaces/icon/suggestions", async (route) => {
    await waitWish;
    await route.continue();
  });
  await row.getByTestId("send").click();
  await expect(row).toHaveAttribute("data-state", "loading");
  await field.fill("next draft");
  finishWish();
  await expect(row).toHaveAttribute("data-state", "done");
  await expect(field).toHaveValue("next draft");
  await page.unroute("**/api/v1/workspaces/icon/suggestions");
  await field.fill("");

  // A quick wish is a new round; the arrows go back to the first.
  await row.getByTestId("workspace-icon-quick").nth(2).click();
  await expect.poll(() => icons(page)).toEqual(["AK", "A", "AKL"]);
  await expect(row.getByTestId("workspace-icon-rounds")).toBeVisible();
  await row.getByTestId("workspace-icon-round-back").click();
  await expect.poll(() => icons(page)).toEqual(["🧭", "🦉", "☀️", "🌿"]);

  // One click accepts: written and committed, the row goes, and a notice
  // says so. The first icon line has nothing to go back to: no Kumoa.
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
  const notice = page.locator(
    "[data-testid=archive-notice][data-kind=workspace-icon]",
  );
  await expect(notice).toBeVisible();
  await expect(notice.getByTestId("restore-notice")).toHaveCount(0);
  await expect(page.getByTestId("workspace-icon-note")).toHaveCount(0);
  const latest = async () =>
    (
      await (
        await page.request.get(`/api/v1/workspaces/git?workspace_id=${id}`)
      ).json()
    ).commits[0]?.hash as string | undefined;
  await expect.poll(latest).not.toBe(before.commits[0]?.hash);
  await shot(page, "valittu");

  // The notice brings the suggestions back: the rounds already made, the
  // newest on show, without asking the model again.
  let asked = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/v1/workspaces/icon/suggestions")) asked++;
  });
  await notice.getByTestId("notice-link").click();
  await expect(row).toHaveAttribute("data-state", "done");
  expect(await icons(page)).toEqual(["AK", "A", "AKL"]);
  await row.getByTestId("workspace-icon-round-back").click();
  await expect.poll(() => icons(page)).toEqual(["🧭", "🦉", "☀️", "🌿"]);
  await row.getByTestId("workspace-icon-suggestions-dismiss").click();
  // A set icon has no row; the picker brings the kept rounds back, also
  // after a reload, and still without a model call.
  await page.reload();
  await expect(page.getByTestId("workspace-icon-picker")).toBeVisible();
  await expect(row).toHaveCount(0);
  await page.getByTestId("workspace-icon-picker").click();
  await page.getByTestId("workspace-icon-ask-model").click();
  await expect(row).toHaveAttribute("data-state", "done");
  expect(await icons(page)).toEqual(["AK", "A", "AKL"]);
  expect(asked).toBe(0);
  // Toisia is a request: only then is the model asked.
  await row.getByTestId("workspace-icon-quick").nth(3).click();
  await expect.poll(() => asked).toBe(1);
  await expect(row).toHaveAttribute("data-state", "done");
  await row.getByTestId("workspace-icon-suggestions-dismiss").click();

  // Over an icon line, Kumoa writes the earlier icon back and commits it.
  const owl = await latest();
  await page.getByTestId("workspace-icon-picker").click();
  const dialog = page
    .getByRole("dialog")
    .and(page.getByTestId("workspace-icon-dialog"));
  await dialog.getByTestId("workspace-icon-own").fill("🧮");
  await dialog.getByTestId("workspace-icon-own-use").click();
  await expect(head).toHaveText("🧮");
  await expect(notice.getByTestId("restore-notice")).toBeVisible();
  await expect.poll(latest).not.toBe(owl);
  const abacus = await latest();
  await notice.getByTestId("restore-notice").click();
  await expect(head).toHaveText("🦉");
  await expect.poll(latest).not.toBe(abacus);
  await expect(notice.getByTestId("restore-notice")).toHaveCount(0);
  page.removeAllListeners("request");

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
  await expect(row.locator("[aria-busy=true]").first()).toBeVisible();
  await expect(row.getByTestId("send")).toBeDisabled();
  await row
    .getByTestId("workspace-icon-wish")
    .fill("draft during first request");
  await shot(page, "lataa");
  release();
  await expect(row).toHaveAttribute("data-state", "failed");
  await expect(
    row.getByTestId("workspace-icon-suggestions-retry"),
  ).toBeVisible();
  await expect(
    row.getByTestId("workspace-icon-suggestion").first(),
  ).toHaveAttribute("data-local", "true");
  await expect(row.getByTestId("workspace-icon-wish")).toHaveValue(
    "draft during first request",
  );
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

test("@workspace-icons the wish is dictated with the composer's dictation and asked with what was said", async ({
  page,
}) => {
  test.setTimeout(90000);
  // The microphone is a tone and Soniox the host's synthetic one.
  await page.addInitScript(() => {
    const devices = navigator.mediaDevices ?? ({} as MediaDevices);
    Object.defineProperty(navigator, "mediaDevices", { value: devices });
    devices.getUserMedia = async () => {
      const context = new AudioContext();
      const tone = context.createOscillator();
      const out = context.createMediaStreamDestination();
      tone.connect(out);
      tone.start();
      return out.stream;
    };
  });
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.waitForURL(/\/workspaces/);
  await page.goto("/settings/speech");
  await page
    .getByTestId("speech-key-input")
    .fill(`snx_proj_${"0".repeat(43)}.${"0".repeat(86)}.00Ab12`);
  await page.getByTestId("speech-key-save").click();
  await expect(page.getByTestId("speech-key-source")).toHaveAttribute(
    "data-source",
    "own",
  );
  await page.goto("/workspaces");
  await openWorkspace(page, "tilastoharjoitus");
  const row = page.getByTestId("workspace-icon-suggestions");
  await expect(row).toHaveAttribute("data-state", "done");
  await row.getByTestId("workspace-icon-wish").fill("kettu");
  await row.getByRole("button").and(row.getByTestId("dictation-mic")).click();
  await expect(row.getByTestId("dictation-stop")).toHaveAttribute(
    "data-phase",
    "live",
  );
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/fixture/soniox?action=state")).json())
          .open,
    )
    .toBe(1);
  expect(
    (
      await page.request.post("/fixture/soniox?action=say", {
        // A pause long enough to make a paragraph break in the composer.
        data: [
          { text: " sininen", start_ms: 0, end_ms: 400, is_final: true },
          { text: " pieni", start_ms: 6000, end_ms: 6400, is_final: true },
        ],
      })
    ).status(),
  ).toBe(204);
  // What was said shows in the field, after what was written.
  await expect(row.getByTestId("dictation-live")).toHaveText(
    /^kettu sininen\s*pieni$/,
  );
  // Send ends dictation and keeps its paragraph breaks.
  const asked = page.waitForRequest(
    (r) =>
      r.url().endsWith("/api/v1/workspaces/icon/suggestions") &&
      r.method() === "POST",
  );
  await row.getByTestId("send").click();
  expect((await asked).postDataJSON().wish).toMatch(/^kettu sininen\n+pieni$/);
  await expect(row).toHaveAttribute("data-state", "done");
  await expect(row.getByTestId("workspace-icon-wish")).toHaveValue("");
  await expect(row.getByTestId("dictation-mic")).toBeVisible();
});
