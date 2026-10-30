import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

// Kokeellinen Sanelupalkki (composer-dictation-bar; proto-composer-actions
// round 2, Palkki): Sanele and Send anchored at the row's right end, the
// work controls born left of them, and dictation as a listening bar over the
// row's left part with Valmis in Sanele's slot. Against the browser host's
// synthetic Soniox and fake Pi; the microphone is an oscillator. It proves
// the row's geometry and the cancel in a real browser, not Soniox itself.

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

const evidence = "../issues/composer-dictation-bar/evidence";
const capture = !!process.env.OH_VISUAL_CAPTURE;

/** The composer in light and dark, for Jari's eye. */
async function shot(page: Page, name: string) {
  if (!capture) return;
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.evaluate((theme) => {
      localStorage.setItem("nah:theme", theme);
      window.dispatchEvent(new Event("nah:theme-change"));
    }, colorScheme);
    await page
      .locator(".ah-composer")
      .screenshot({ path: `${evidence}/${name}-${colorScheme}.png` });
  }
  await page.evaluate(() => localStorage.removeItem("nah:theme"));
  await page.emulateMedia({ colorScheme: "light", reducedMotion: null });
}

const ownKey = `snx_proj_${"0".repeat(43)}.${"0".repeat(86)}.00Ab12`;

test.beforeEach(async ({ page }) => {
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
});

const soniox = async (page: Page) =>
  (await (await page.request.get("/fixture/soniox?action=state")).json()) as {
    open: number;
    ended: number;
  };

async function say(page: Page, text: string) {
  await expect.poll(async () => (await soniox(page)).open).toBe(1);
  expect(
    (
      await page.request.post("/fixture/soniox?action=say", {
        data: [{ text, start_ms: 0, end_ms: 400, is_final: true }],
      })
    ).status(),
  ).toBe(204);
}

async function setUp(page: Page) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByTestId("account-menu-trigger")).toBeAttached();
  await page.goto("/settings/speech");
  await page.getByTestId("speech-key-input").fill(ownKey);
  await page.getByTestId("speech-key-save").click();
  await expect(page.getByTestId("speech-key-source")).toHaveAttribute(
    "data-source",
    "own",
  );
  await page.goto("/settings/experimental");
  const on = page
    .getByRole("region")
    .and(page.getByTestId("experimental-composer-dictation-bar"))
    .getByRole("group")
    .and(page.getByTestId("experimental-composer-dictation-bar-choice"))
    .getByRole("button")
    .and(page.getByTestId("segment-on"));
  await on.click();
  await expect(on).toHaveAttribute("aria-pressed", "true");
  await page.goto("/workspaces");
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  await expect(page.locator(".ah-crow-bar")).toBeVisible();
}

const mic = (page: Page) =>
  page.getByRole("button").and(page.getByTestId("dictation-mic"));
const done = (page: Page) =>
  page.getByRole("button").and(page.getByTestId("dictation-stop"));
const bar = (page: Page) => page.getByTestId("dictation-bar");
const send = (page: Page) =>
  page.getByRole("button").and(page.getByTestId("send"));
const stop = (page: Page) =>
  page
    .getByTestId("composer-stop")
    .and(page.locator('[data-stop-target="agent"]'));
const chip = (page: Page) =>
  page.getByRole("button").and(page.getByTestId("composer-mode"));
const field = (page: Page) => page.getByTestId("message-input");

type Box = { x: number; y: number; width: number; height: number };
async function box(l: Locator): Promise<Box> {
  const b = await l.boundingBox();
  if (!b) throw new Error("no box");
  return b;
}
// Same place and size, to the pixel.
function same(a: Box, b: Box) {
  expect(Math.round(a.x)).toBe(Math.round(b.x));
  expect(Math.round(a.width)).toBe(Math.round(b.width));
}
const apart = (left: Box, right: Box) =>
  expect(left.x + left.width).toBeLessThanOrEqual(right.x + 0.5);

/** A slow fake Pi turn, so the row shows Ohjaa and Stop for a while. */
async function work(page: Page) {
  await field(page).fill("hidas vuoro");
  await send(page).and(page.locator('[data-mode="send"]')).click();
  await expect(stop(page)).toBeVisible();
}

test("@dictation-bar the bar covers the aids, Valmis takes Sanele's place, and nothing moves between rest, work and dictation", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await setUp(page);
  const aids = [
    page.getByTestId("attach-file"),
    page.getByTestId("command-palette"),
    page.getByTestId("file-picker"),
  ];
  await field(page).fill("Alku");
  const rest = { mic: await box(mic(page)), send: await box(send(page)) };
  await shot(page, "tyopoyta-levossa");
  // Sanele's tooltip names the shortcut.
  await expect(mic(page)).toHaveAttribute("title", /^Sanele \(Ctrl\+.\) ·/);

  await mic(page).click();
  await expect(bar(page)).toBeVisible();
  same(await box(done(page)), rest.mic);
  same(await box(send(page)), rest.send);
  for (const aid of aids) await expect(aid).toBeHidden();
  await expect(bar(page)).toContainText("Enter");
  await say(page, " sanelu");
  await expect(page.getByTestId("dictation-final")).toHaveText("sanelu");
  await shot(page, "tyopoyta-sanelee");
  expect(
    (
      await new AxeBuilder({ page })
        .include(".ah-composer")
        .exclude(".ah-dictation-wave")
        .analyze()
    ).violations,
  ).toEqual([]);

  // × cancels: the field is as it was and Soniox was not asked to finish.
  await page
    .getByRole("button")
    .and(page.getByTestId("dictation-cancel"))
    .click();
  await expect(bar(page)).toHaveCount(0);
  await expect(field(page)).toHaveValue("Alku");
  await expect(field(page)).toBeFocused();
  await expect(page.getByTestId("dictation-notice")).toHaveCount(0);
  expect((await soniox(page)).ended).toBe(0);
  for (const aid of aids) await expect(aid).toBeVisible();

  // The shortcut starts one with Valmis focused; Enter is Valmis: the text
  // stays and nothing is sent.
  await page.keyboard.press("Control+Backquote");
  await expect(bar(page)).toBeVisible();
  await expect(done(page)).toBeFocused();
  await say(page, " sanelu");
  await expect(page.getByTestId("dictation-final")).toHaveText("sanelu");
  await page.keyboard.press("Enter");
  await expect(bar(page)).toHaveCount(0);
  await expect(field(page)).toHaveValue("Alku sanelu");
  await expect.poll(async () => (await soniox(page)).ended).toBe(1);
  await expect(page.locator("main")).not.toContainText("Kysyit:");

  // While the agent works, Ohjaa and Stop are born left of Sanele, which
  // stays put with Send, and stay put when the dictation starts.
  await work(page);
  await expect(chip(page)).toBeVisible();
  same(await box(mic(page)), rest.mic);
  same(await box(send(page)), rest.send);
  const working = { chip: await box(chip(page)), stop: await box(stop(page)) };
  apart(working.stop, rest.mic);
  await shot(page, "tyopoyta-tyossa");
  await mic(page).click();
  await expect(bar(page)).toBeVisible();
  await shot(page, "tyopoyta-sanelee-tyossa");
  same(await box(done(page)), rest.mic);
  same(await box(chip(page)), working.chip);
  same(await box(stop(page)), working.stop);
  apart(await box(bar(page)), working.chip);
  await page
    .getByRole("button")
    .and(page.getByTestId("dictation-cancel"))
    .click();
  await expect(field(page)).toHaveValue("");
});

for (const width of [390, 360])
  test(`@dictation-bar on a ${width} px phone the row fits, its controls are touch-sized and none overlaps another`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await setUp(page);
    // Opened at desktop width, where the sidebar is open.
    await page.setViewportSize({ width, height: 844 });
    await expect(mic(page)).toBeVisible();
    const controls = () => [
      page.getByTestId("attach-file"),
      page.getByTestId("command-palette"),
      page.getByTestId("file-picker"),
      mic(page),
      send(page),
    ];
    // At rest Sanele is not drawn under Send.
    const rest = { mic: await box(mic(page)), send: await box(send(page)) };
    apart(rest.mic, rest.send);
    await shot(page, `puhelin-${width}-levossa`);
    for (const c of controls())
      expect((await box(c)).height).toBeGreaterThanOrEqual(36);
    const row = await box(page.locator(".ah-crow-bar"));
    expect(rest.send.x + rest.send.width).toBeLessThanOrEqual(
      row.x + row.width,
    );

    await work(page);
    const working = {
      chip: await box(chip(page)),
      stop: await box(stop(page)),
    };
    expect(working.chip.height).toBeGreaterThanOrEqual(36);
    same(await box(mic(page)), rest.mic);
    same(await box(send(page)), rest.send);
    apart(working.chip, working.stop);
    apart(working.stop, rest.mic);
    const aids = await Promise.all(controls().slice(0, 3).map(box));
    apart(aids[2] as Box, working.chip);

    // Dictating while the agent works: Valmis does not cover Ohjaa.
    await mic(page).click();
    await expect(bar(page)).toBeVisible();
    await shot(page, `puhelin-${width}-sanelee-tyossa`);
    const valmis = await box(done(page));
    same(valmis, rest.mic);
    expect(valmis.height).toBeGreaterThanOrEqual(36);
    same(await box(chip(page)), working.chip);
    apart(await box(bar(page)), working.chip);
    apart(working.stop, valmis);
    await page
      .getByRole("button")
      .and(page.getByTestId("dictation-cancel"))
      .click();
    await expect(bar(page)).toHaveCount(0);
  });

test("@dictation-bar with the feature off the row keeps Sanele beside the work controls as before", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByTestId("account-menu-trigger")).toBeAttached();
  await page.goto("/settings/speech");
  await page.getByTestId("speech-key-input").fill(ownKey);
  await page.getByTestId("speech-key-save").click();
  await expect(page.getByTestId("speech-key-source")).toHaveAttribute(
    "data-source",
    "own",
  );
  await page.goto("/workspaces");
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  await expect(mic(page)).toBeVisible();
  await expect(page.locator(".ah-crow-bar")).toHaveCount(0);
  await expect(page.locator(".ah-dictation-slot")).toHaveCount(1);
});
