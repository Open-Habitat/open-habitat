import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Locator } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Personal Google accounts (Jari 21.11.2026): the administrator's guide asks
// whose accounts may connect before Google's words, and the person's
// connect dialog carries one note with help behind it, keeps the sign-in
// open when the person stopped at Google, and lists what a grant reached.
// Synthetic host: the integrations file has Google set by root, and the
// stand-in Google entry signs in with state=lab. Both languages and both
// widths, because the radio cards and the screenshot bands change layout.
// OH_GOOGLE_CAPTURE_DIR names a directory outside the repository for review
// screenshots; they are review material, not assertions.

const googleID =
  "915508263417-a8d2kq0zr7m3vh1ts9pe5wybc6lfnjxu.apps.googleusercontent.com";
const capture = process.env.OH_GOOGLE_CAPTURE_DIR;

async function shot(page: Page, name: string) {
  if (!capture) return;
  await mkdir(capture, { recursive: true });
  await page.screenshot({ path: join(capture, `${name}.png`) });
}
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const axe = async (page: Page, include: string) =>
  (await new AxeBuilder({ page }).include(include).analyze()).violations;
/** The dialog scrolls; nothing in it may stick out sideways. */
const sideways = (dialog: Locator) =>
  dialog.evaluate((el) => el.scrollWidth - el.clientWidth);

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

for (const locale of ["fi-FI", "en-US"]) {
  test.describe(locale, () => {
    test.use({
      baseURL: hostOrigin,
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 900 },
      locale,
      reducedMotion: "reduce",
    });
    const lang = locale.slice(0, 2);

    test(`@google-personal @a11y the administrator chooses whose accounts connect before Google's words (${locale})`, async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      await page.request.get("/fixture/integration-apps?clear=google");
      await signIn(page, "/settings/server-integrations");
      await expect(page.locator("html")).toHaveAttribute(
        "lang",
        new RegExp(`^${lang}`),
      );
      await page
        .getByRole("button")
        .and(page.getByTestId("si-setup-google"))
        .click();
      const dialog = page.getByTestId("si-setup-dialog");
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
        await expect(dialog.getByTestId("gg-choice")).toBeVisible();
        expect(await overflow(page)).toBeLessThanOrEqual(0);
        expect(await sideways(dialog)).toBeLessThanOrEqual(0);
        await shot(page, `admin-${lang}-${width}-whose`);
      }
      // The cards sit side by side on a desktop and stack on a phone.
      const cards = dialog.locator(".gg-option");
      const beside = async () => {
        const [a, b] = await Promise.all([
          cards.nth(0).boundingBox(),
          cards.nth(1).boundingBox(),
        ]);
        return !!a && !!b && b.x >= a.x + a.width - 1 && b.y < a.y + a.height;
      };
      expect(await beside()).toBe(false);
      await page.setViewportSize({ width: 1440, height: 900 });
      expect(await beside()).toBe(true);
      await expect(dialog.getByTestId("si-next")).toBeDisabled();
      expect(await axe(page, "[data-testid=si-setup-dialog]")).toEqual([]);

      // The keyboard chooses: the radios are one group.
      await dialog.getByTestId("gg-choose-org").focus();
      await page.keyboard.press("ArrowDown");
      await expect(dialog.getByTestId("gg-choose-personal")).toBeChecked();
      for (const step of ["apis", "brand", "scopes", "publish"]) {
        await dialog
          .getByRole("button")
          .and(dialog.getByTestId("si-next"))
          .click();
        await expect(dialog.getByTestId("si-stepname")).toHaveAttribute(
          "data-step",
          step,
        );
        for (const width of [390, 1440]) {
          await page.setViewportSize({
            width,
            height: width > 600 ? 900 : 844,
          });
          expect(await overflow(page)).toBeLessThanOrEqual(0);
          expect(await sideways(dialog)).toBeLessThanOrEqual(0);
          if (step === "brand" || step === "publish")
            await shot(page, `admin-${lang}-${width}-${step}`);
        }
        if (step === "brand" || step === "publish") {
          // Google's screen as a lit band, said to be an illustration.
          const band = dialog.getByTestId("google-shot").first();
          await expect(band.locator("img")).toBeVisible();
          await expect(
            dialog.getByTestId("google-shot-placeholder").first(),
          ).toBeVisible();
          expect(
            await band
              .locator("img")
              .evaluate((img: HTMLImageElement) => img.naturalWidth),
          ).toBeGreaterThan(0);
          expect(await axe(page, "[data-testid=si-setup-dialog]")).toEqual([]);
        }
      }
      await dialog
        .getByRole("button")
        .and(dialog.getByTestId("si-next"))
        .click();
      await dialog.getByTestId("si-field-client_id").fill(googleID);
      await dialog
        .getByTestId("si-field-client_secret")
        .fill("GOCSPX-synthetic");
      await dialog
        .getByRole("button")
        .and(dialog.getByTestId("si-save"))
        .click();
      // Saved is not tested: the guide goes on.
      await expect(dialog.getByTestId("si-step-workspace")).toBeVisible();
      await expect(dialog.getByTestId("gg-handoff-msg")).toContainText(
        googleID,
      );
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      await shot(page, `admin-${lang}-390-workspace`);
      await page.setViewportSize({ width: 1440, height: 900 });
      await dialog
        .getByRole("button")
        .and(dialog.getByTestId("si-next"))
        .click();
      await expect(dialog.getByTestId("gg-try")).toBeVisible();
      await dialog
        .getByRole("button")
        .and(dialog.getByTestId("gg-done"))
        .click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByTestId("si-row-google")).toHaveAttribute(
        "data-status",
        "ready",
      );

      // The existing client's audience, from the row: no secret, no save.
      const writes: string[] = [];
      page.on("request", (r) => {
        if (r.method() !== "GET" && r.url().includes("/server/integrations"))
          writes.push(r.method());
      });
      await page.getByTestId("si-menu-google").getByRole("button").click();
      await page.getByTestId("menu-audience").click();
      const whose = page.getByTestId("gg-audience-dialog");
      await expect(whose.getByTestId("gg-existing")).toBeVisible();
      await expect(whose.locator("input[type=password]")).toHaveCount(0);
      await whose.getByTestId("gg-choose-personal").check();
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
        expect(await overflow(page)).toBeLessThanOrEqual(0);
        await shot(page, `admin-${lang}-${width}-existing`);
      }
      expect(await axe(page, "[data-testid=gg-audience-dialog]")).toEqual([]);
      for (let i = 0; i < 4; i++)
        await whose
          .getByRole("button")
          .and(whose.getByTestId("si-next"))
          .click();
      await expect(whose.getByTestId("gg-migration")).toBeVisible();
      await whose.getByRole("button").and(whose.getByTestId("gg-done")).click();
      await expect(whose).toHaveCount(0);
      expect(writes).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test(`@google-personal @a11y the person sees one note, help behind it, and a stop at Google keeps the sign-in open (${locale})`, async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      await signIn(page, "/settings/agent-data");
      await expect(page.getByTestId("integrations-loading")).toHaveCount(0);
      await page.request.get("/fixture/integrations?action=reset");
      const tile = page.getByTestId("integration-tile-google");
      await tile
        .getByRole("button")
        .and(tile.getByTestId("integration-connect-open"))
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByRole("button")
        .and(dialog.getByTestId("integration-continue"))
        .click();
      await expect(dialog.getByTestId("gc-note")).toBeVisible();
      await expect(dialog.getByTestId("gc-panel")).toHaveCount(0);
      await shot(page, `person-${lang}-1440-before`);
      await dialog.getByTestId("gc-more").click();
      await dialog.getByTestId("gc-help-warning").click();
      // Advanced, then Go to … (unsafe): two lit bands.
      await expect(dialog.getByTestId("google-shot")).toHaveCount(2);
      await dialog.getByTestId("gc-help-org").click();
      await expect(
        dialog.getByTestId("gc-client-id").locator("code"),
      ).toHaveText("fixture");
      expect(await axe(page, '[role="dialog"]')).toEqual([]);
      await dialog.getByTestId("gc-help-warning").click();
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
        expect(await overflow(page)).toBeLessThanOrEqual(0);
        expect(await sideways(dialog)).toBeLessThanOrEqual(0);
        await shot(page, `person-${lang}-${width}-help`);
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      const popup = page.waitForEvent("popup");
      await dialog
        .getByRole("link")
        .and(dialog.getByTestId("integration-provider-link"))
        .click();
      await (await popup).close();
      await expect(dialog.getByTestId("gc-wait")).toBeVisible();

      // The person stopped on Google's consent screen in this sign-in.
      const pastes: string[] = [];
      page.on("request", (r) => {
        if (r.method() === "PUT" && r.url().includes("/integrations/login"))
          pastes.push(r.url());
      });
      const field = dialog
        .getByRole("textbox")
        .and(dialog.getByTestId("integration-redirect-input"));
      await field.fill(
        "http://127.0.0.1:46399/oauth2/callback?state=lab&error=access_denied",
      );
      await dialog
        .getByRole("button")
        .and(dialog.getByTestId("integration-connect"))
        .click();
      await expect(
        dialog.getByTestId("integration-stopped-at-provider"),
      ).toBeVisible();
      expect(pastes).toEqual([]);
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
        expect(await overflow(page)).toBeLessThanOrEqual(0);
        await shot(page, `person-${lang}-${width}-stopped`);
      }
      expect(await axe(page, '[role="dialog"]')).toEqual([]);
      // The sign-in is still open: the real return address connects.
      await field.fill(
        "http://127.0.0.1:46399/oauth2/callback?state=lab&code=4/synthetic",
      );
      await dialog
        .getByRole("button")
        .and(dialog.getByTestId("integration-connect"))
        .click();
      await expect(
        dialog.getByTestId("integration-folder-choice"),
      ).toBeVisible();
      expect(pastes).toHaveLength(1);
      expect(pageErrors).toEqual([]);
    });
  });
}
