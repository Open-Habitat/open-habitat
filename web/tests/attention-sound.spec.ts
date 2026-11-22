import { mkdir, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { settingsSections } from "../src/app/settingsIndex";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// The attention sound:
// Settings › Äänet, the account menu's mute, the workspace strip, and one
// sound when an agent's reply makes a conversation the person's turn. The
// real daemon stores the personal choices in the synthetic home; mute and
// volume stay in this browser. Headless Chromium has no ears, so the page's
// own record of what it started (window.__ohSoundPlays) is what is read.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  locale: "fi-FI",
  timezoneId: "Europe/Helsinki",
  reducedMotion: "reduce",
});

async function signIn(page: Page) {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByTestId("workspace-navigation")).toBeVisible();
}
async function headers(page: Page) {
  const s = await (await page.request.get("/auth/session")).json();
  return { Origin: new URL(page.url()).origin, "X-Agent-Host-CSRF": s.csrf };
}
async function sound(page: Page) {
  return (await (await page.request.get("/api/v1/account/preferences")).json())
    .sound;
}
const plays = (page: Page) =>
  page.evaluate(() => (window.__ohSoundPlays ?? []).map((p) => p.id));
const openWorkspace = async (page: Page, name: string) => {
  await page
    .getByTestId("workspace-navigation")
    .getByTestId(`workspace-${name}`)
    .click();
  await expect(page.getByTestId("workspace-title")).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop() ?? "";
};

test("@attention-sound the strip is available without opting in and renames in place", async ({
  page,
}) => {
  await signIn(page);
  expect(await sound(page)).toMatchObject({
    enabled: true,
    night: true,
    night_start: 22,
    night_end: 7,
  });
  await page.getByTestId("account-menu-trigger").click();
  await expect(page.getByTestId("sound-menu-row")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/settings");
  await expect(page.getByTestId("settings-aanet")).toBeVisible();
  await page.goto("/workspaces");
  await openWorkspace(page, "ordinary-dir");
  const strip = page.getByTestId("workspace-strip");
  await expect(strip).toBeVisible();
  await expect(page.getByTestId("rename-workspace")).toHaveCount(0);
  // The icon editor lives in the strip only; the head shows the picture.
  await expect(page.getByTestId("workspace-head-icon")).toBeVisible();
  await expect(
    page
      .locator(".ah-workspace-page-head")
      .getByTestId("workspace-icon-picker"),
  ).toHaveCount(0);
  await expect(strip.getByTestId("workspace-icon-picker")).toBeVisible();

  // Nimi edits in place: Esc cancels, Enter saves, and nothing moves.
  const name = strip.getByTestId("strip-name");
  const before = await name.boundingBox();
  await name.click();
  const input = strip.getByTestId("strip-name-input");
  await expect(input).toBeFocused();
  await input.fill("Peruttu nimi");
  await input.press("Escape");
  await expect(page.getByTestId("workspace-title")).not.toHaveText(
    "Peruttu nimi",
  );
  await expect(name).toBeFocused();
  await name.press("Enter");
  await input.fill("Kotisivun nimi");
  const provisionalPath = new URL(page.url()).pathname;
  await input.press("Enter");
  // The name is optimistic. Only the confirmed durable route tells us the
  // strip's identity remount is over; opening its picker sooner loses it.
  await expect
    .poll(() => new URL(page.url()).pathname)
    .not.toBe(provisionalPath);
  await expect(page.getByTestId("workspace-title")).toHaveText(
    "Kotisivun nimi",
  );
  await expect(strip.getByTestId("strip-name-value")).toHaveText(
    "Kotisivun nimi",
  );
  // The first rename gives the workspace its durable id: the page comes back
  // under it, with the strip where it was.
  await expect
    .poll(() => strip.getByTestId("strip-name").boundingBox())
    .toEqual(before);

  // Ääni: the picker chooses on a press; ▶ listens without choosing.
  // The first rename gives the workspace its durable id, so its sound is
  // found by value.
  await strip.getByTestId("strip-sound").click();
  const picker = page.getByTestId("strip-sound-picker");
  await expect(picker).toBeVisible();
  await picker.getByTestId("strip-sound-preview-lasit").click();
  expect((await plays(page)).at(-1)).toBe("lasit");
  expect((await sound(page)).workspaces).toEqual({});
  await picker.getByTestId("strip-sound-pick-pisara").click();
  await expect
    .poll(async () => Object.values((await sound(page)).workspaces))
    .toEqual(["pisara"]);
  expect((await plays(page)).at(-1)).toBe("pisara");
  await expect(picker.getByTestId("strip-sound-pick-pisara")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="strip-sound-dialog"]')
    .analyze();
  expect(axe.violations).toEqual([]);
  await picker.getByTestId("strip-sound-done").click();
  await expect(strip.getByTestId("strip-sound")).toHaveAttribute(
    "data-own",
    "",
  );
  await picker.waitFor({ state: "detached" });
});

test("@attention-sound Settings › Äänet chooses the person's sound and length, and this device's mute shows in the account menu", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/sounds");
  const settings = page.getByTestId("sound-settings");
  await expect(settings).toBeVisible();
  // Every row of the index is on the page, and every page row is indexed.
  const section = settingsSections.find((s) => s.id === "aanet");
  const ids: string[] = section?.rows.map((r) => r.id) ?? [];
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids)
    await expect(
      page.locator(`.s-main [data-settings-row="${id}"]`),
    ).toBeAttached();
  const drawn = await page
    .locator(".s-main [data-settings-row]")
    .evaluateAll((rows) =>
      rows.map((r) => (r as HTMLElement).dataset.settingsRow ?? ""),
    );
  expect(drawn.filter((id) => !ids.includes(id))).toEqual([]);

  await expect(page.getByTestId("sound-tile-kalimba")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByTestId("sound-tile-marimba").click();
  await expect.poll(async () => (await sound(page)).default).toBe("marimba");
  expect((await plays(page)).at(-1)).toBe("marimba");
  await expect(page.getByTestId("sound-tile-marimba")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  // Arrows move the choice and play, as a radio group does.
  await page.getByTestId("sound-tile-marimba").press("ArrowRight");
  await expect.poll(async () => (await sound(page)).default).toBe("vibrafoni");
  await expect(page.getByTestId("sound-tile-vibrafoni")).toBeFocused();
  await page.getByTestId("sound-length").getByTestId("segment-long").click();
  await expect.poll(async () => (await sound(page)).length).toBe("long");
  expect(await page.evaluate(() => window.__ohSoundPlays?.at(-1)?.length)).toBe(
    "long",
  );
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="sound-settings"]')
    .analyze();
  expect(axe.violations).toEqual([]);

  // This device's mute: from the account menu, marked on the picture,
  // remembered by this browser and never written to the person's file.
  await page.goto("/workspaces");
  await page.getByTestId("account-menu-trigger").click();
  const row = page.getByTestId("sound-menu-row");
  await expect(page.getByTestId("sound-menu-state")).toHaveAttribute(
    "data-status",
    /plays|night/,
  );
  await row.getByTestId("segment-quiet").click();
  await expect(page.getByTestId("sound-menu-state")).toHaveAttribute(
    "data-status",
    "muted",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("sound-muted-badge")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("sound-muted-badge")).toBeVisible();
  await page.goto("/settings/sounds");
  await expect(
    page.getByTestId("sound-device-mute").getByTestId("segment-quiet"),
  ).toHaveAttribute("aria-pressed", "true");
  expect(JSON.stringify(await sound(page))).not.toContain("mute");

  // Off everywhere: the menu says so and its row cannot be used.
  await page.getByTestId("sound-enabled").getByTestId("segment-off").click();
  await expect.poll(async () => (await sound(page)).enabled).toBe(false);
  await page.goto("/workspaces");
  await expect(page.getByTestId("account-menu-trigger")).toBeVisible();
  await expect(page.getByTestId("sound-muted-badge")).toHaveCount(0);
  await page.getByTestId("account-menu-trigger").click();
  await expect(page.getByTestId("sound-menu-state")).toHaveAttribute(
    "data-status",
    "off",
  );
});

for (const target of [
  "same-workspace",
  "other-workspace",
  "night-quiet",
] as const) {
  test(`@attention-sound a non-open reply after preview: ${target}`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const NativeAudioContext = window.AudioContext;
      const contexts: AudioContext[] = [];
      Object.assign(window, { soundContexts: contexts });
      window.AudioContext = class extends NativeAudioContext {
        constructor(options?: AudioContextOptions) {
          super(options);
          contexts.push(this);
        }
      };
    });
    await signIn(page);
    await page.goto("/workspaces");
    const id = await openWorkspace(page, "ordinary-dir");
    const put = await page.request.put("/api/v1/account/preferences", {
      headers: await headers(page),
      data: { workspace_sound: { [id]: "kulho" } },
    });
    expect(put.status()).toBe(200);
    await page.emulateMedia({ colorScheme: "dark" });
    // A preview bypasses night suppression; ordinary notifications do not.
    // Clock-based night is independent of the device's theme.
    await page.clock.install({ time: new Date("2026-11-22T23:00:00+02:00") });
    if (target !== "night-quiet") {
      await page.request.put("/api/v1/account/preferences", {
        headers: await headers(page),
        data: { sound: { night: false } },
      });
    }
    await page.goto("/settings/sounds");
    await page.getByTestId("sound-test").click();
    await expect.poll(() => plays(page)).toEqual(["kalimba"]);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as unknown as { soundContexts: AudioContext[] }
          ).soundContexts.map((c) => c.state),
        ),
      )
      .toEqual(["running"]);
    await page.getByTestId("settings-close").click();
    await openWorkspace(page, "ordinary-dir");
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
    const agent = new URL(page.url()).searchParams.get("conversation") ?? "";
    await page.request.get("/fixture/scenario?value=pi-visual-hold");
    await page.getByTestId("message-input").fill("työ");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    const nav = page.getByTestId("workspace-navigation");
    await expect(
      nav.getByTestId("rail-running").getByTestId(`agent-item-${agent}`),
    ).toBeVisible({ timeout: 25000 });
    // View another conversation without reloading the page or its audio.
    await nav
      .getByTestId(
        target === "other-workspace"
          ? "workspace-start-git-project"
          : "workspace-start-ordinary-dir",
      )
      .click();
    await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
    await expect
      .poll(() => new URL(page.url()).searchParams.get("conversation"))
      .not.toBe(agent);
    await expect(page.getByTestId("message-input")).toBeVisible();
    await page.clock.fastForward(5000);
    await page.request.get("/fixture/scenario?value=ready");
    await expect(
      nav.getByTestId("rail-yours").getByTestId(`agent-item-${agent}`),
    ).toBeVisible({ timeout: 25000 });
    // Playback is immediate. Do not jump the clock while completion history
    // is arriving: that artificially expires burst coalescing between the
    // rail's turn observation and its hydrated reply identity.
    await expect
      .poll(() => plays(page), { timeout: 10000 })
      .toEqual(target === "night-quiet" ? ["kalimba"] : ["kalimba", "kulho"]);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as unknown as { soundContexts: AudioContext[] }
          ).soundContexts.map((c) => c.state),
        ),
      )
      .toEqual(["running"]);
  });
}

test("@attention-sound night follows the local clock, edits persist and turning it off is permanent", async ({
  page,
}) => {
  await signIn(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.clock.install({ time: new Date("2026-11-22T21:59:00+02:00") });
  await page.goto("/settings/sounds");
  await expect(page.getByTestId("sound-night-clock")).toBeVisible();
  await expect(page.getByTestId("sound-status")).toHaveCount(0);
  await expect(page.getByTestId("sound-test-night")).toHaveCount(0);
  await expect(page.getByTestId("sound-preview-night")).toHaveCount(0);
  await page.clock.fastForward(60_000);
  await expect(page.getByTestId("sound-reason-night")).toBeVisible();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.getByTestId("sound-status")).toBeVisible();
  await page.getByTestId("sound-tile-lasit").click();
  await expect.poll(() => plays(page)).toContain("lasit");
  await expect.poll(async () => (await sound(page)).default).toBe("lasit");
  expect((await sound(page)).night).toBe(true);
  await page.goto("/workspaces");
  await page.getByTestId("account-menu-trigger").click();
  await expect(page.getByTestId("sound-menu-state")).toHaveAttribute(
    "data-status",
    "night",
  );
  await page.keyboard.press("Escape");
  await page.goto("/settings/sounds");
  await page.getByTestId("sound-night-settings").click();
  await expect(
    page.locator('[data-settings-row="attention-sound-night"]'),
  ).toBeFocused();
  await page.getByTestId("sound-night_start").click();
  await page.getByTestId("choice-0").click();
  await expect.poll(async () => (await sound(page)).night_start).toBe(0);
  await expect(page.getByTestId("sound-status")).toHaveCount(0);
  await page.clock.setSystemTime(new Date("2026-11-23T06:59:00+02:00"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByTestId("sound-status")).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(page.getByTestId("sound-status")).toHaveCount(0);
  await page.getByTestId("sound-night_end").click();
  await page.getByTestId("choice-9").click();
  await expect.poll(async () => (await sound(page)).night_end).toBe(9);
  await expect(page.getByTestId("sound-status")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("sound-status")).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="sound-settings"]')
    .analyze();
  expect(axe.violations).toEqual([]);
  if (process.env.OH_NIGHT_CAPTURE) {
    await mkdir(process.env.OH_NIGHT_CAPTURE, { recursive: true });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByTestId("sound-status").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${process.env.OH_NIGHT_CAPTURE}/${width}.png`,
      });
      await writeFile(
        `${process.env.OH_NIGHT_CAPTURE}/${width}.html`,
        await page.content(),
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId("sound-night-off").click();
  await expect.poll(async () => (await sound(page)).night).toBe(false);
  await expect(page.getByTestId("sound-status")).toHaveCount(0);
  await expect(
    page.locator('[data-settings-row="attention-sound-night"]'),
  ).toBeFocused();
  await page.clock.setSystemTime(new Date("2026-11-24T01:00:00+02:00"));
  await page.reload();
  await expect(
    page.getByTestId("sound-night").getByTestId("segment-off"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("sound-status")).toHaveCount(0);
  await page.goto("/workspaces");
  await page.getByTestId("account-menu-trigger").click();
  await expect(page.getByTestId("sound-menu-state")).toHaveAttribute(
    "data-status",
    "plays",
  );
});

test("@attention-sound all reasons have independent permanent fixes", async ({
  page,
}) => {
  await signIn(page);
  await page.clock.setFixedTime(new Date("2026-11-22T23:00:00+02:00"));
  await page.goto("/settings/sounds");
  await page
    .getByTestId("sound-device-mute")
    .getByTestId("segment-quiet")
    .click();
  await page.getByTestId("sound-enabled").getByTestId("segment-off").click();
  const status = page.getByTestId("sound-status");
  await expect(status.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByTestId("sound-note-off")).toHaveCount(0);
  await expect(page.getByTestId("sound-note-muted")).toHaveCount(0);
  await expect(page.getByTestId("sound-preview-night")).toHaveCount(0);
  await expect(page.getByTestId("sound-test-night")).toHaveCount(0);
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="sound-settings"]')
    .analyze();
  expect(axe.violations).toEqual([]);
  if (process.env.OH_NIGHT_CAPTURE) {
    await mkdir(process.env.OH_NIGHT_CAPTURE, { recursive: true });
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await status.scrollIntoViewIfNeeded();
        const file = `${process.env.OH_NIGHT_CAPTURE}/all-${theme}-${width}`;
        await page.screenshot({ path: `${file}.png` });
        await writeFile(`${file}.html`, await page.content());
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    }
  }
  // Fix a subordinate reason first: it is not disabled by the global off choice.
  await page.getByTestId("sound-fix-muted").click();
  await expect(
    page.locator('[data-settings-row="attention-sound-device"]'),
  ).toBeFocused();
  await expect(page.getByTestId("sound-reason-muted")).toHaveCount(0);
  await expect(status.getByRole("listitem")).toHaveCount(2);
  expect((await sound(page)).enabled).toBe(false);
  await page.getByTestId("sound-night-off").click();
  await expect.poll(async () => (await sound(page)).night).toBe(false);
  await expect(status.getByRole("listitem")).toHaveCount(1);
  await page.getByTestId("sound-fix-off").click();
  await expect.poll(async () => (await sound(page)).enabled).toBe(true);
  await expect(status).toHaveCount(0);
  await expect(
    page.locator('[data-settings-row="attention-sound-on"]'),
  ).toBeFocused();
  await page.reload();
  await expect(
    page.getByTestId("sound-enabled").getByTestId("segment-on"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByTestId("sound-device-mute").getByTestId("segment-plays"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByTestId("sound-night").getByTestId("segment-off"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(status).toHaveCount(0);
});

test("@attention-sound night explanation maps its actions and prevents permanent changes", async ({
  page,
}) => {
  await signIn(page);
  await page.request.put("/api/v1/account/preferences", {
    headers: await headers(page),
    data: { experimental: { "explain-mode": true } },
  });
  await page.clock.setFixedTime(new Date("2026-11-22T23:00:00+02:00"));
  if (process.env.OH_NIGHT_CAPTURE)
    await mkdir(process.env.OH_NIGHT_CAPTURE, { recursive: true });
  for (const language of ["fi", "en-US"]) {
    await page.request.put("/api/v1/account/preferences", {
      headers: await headers(page),
      data: { language },
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/settings/sounds");
    await page
      .getByTestId("sound-device-mute")
      .getByTestId("segment-quiet")
      .click();
    await page.getByTestId("sound-enabled").getByTestId("segment-off").click();
    await expect(page.getByTestId("sound-reason-off")).toBeVisible();
    await page.getByTestId("account-menu-trigger").click();
    await page.getByTestId("menu-explain").click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [control, id] of [
        ["sound-status", "AS07"],
        ["sound-night-off", "AS08"],
        ["sound-night-settings", "AS09"],
        ["sound-fix-off", "AS10"],
        ["sound-fix-muted", "AS11"],
      ]) {
        // For the container, point at its title rather than a child action.
        const target =
          control === "sound-status"
            ? page.getByTestId(control).locator("strong")
            : page.getByTestId(control);
        await target.hover(
          control === "sound-status" ? { position: { x: 10, y: 8 } } : {},
        );
        await expect(page.getByTestId("explain-card")).toHaveAttribute(
          "data-card",
          id,
        );
        if (process.env.OH_NIGHT_CAPTURE) {
          const file = `${process.env.OH_NIGHT_CAPTURE}/explain-${language}-${width}-${id}`;
          await page.screenshot({ path: `${file}.png` });
          await writeFile(`${file}.html`, await page.content());
        }
      }
      await page.getByTestId("sound-night-off").click();
      expect((await sound(page)).night).toBe(true);
      await page.getByTestId("sound-fix-off").click();
      expect((await sound(page)).enabled).toBe(false);
      await page.getByTestId("sound-fix-muted").click();
      await expect(page.getByTestId("sound-reason-muted")).toBeVisible();
      await page.getByTestId("sound-night-settings").click();
      await expect(
        page.locator('[data-settings-row="attention-sound-night"]'),
      ).toBeFocused();
      await page.getByTestId("sound-status").scrollIntoViewIfNeeded();
    }
    await page.keyboard.press("Escape");
  }
});
