import AxeBuilder from "@axe-core/playwright";
import { settingsSections } from "../src/app/settingsIndex";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// The attention sound (issue attention-sound; experimental attention-sound):
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
async function enable(page: Page, on = true) {
  const put = await page.request.put("/api/v1/account/preferences", {
    headers: await headers(page),
    data: { experimental: { "attention-sound": on } },
  });
  expect(put.status()).toBe(200);
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

test("@attention-sound off, nothing shows; on, the strip replaces the head's icon button and pencil and renames in place", async ({
  page,
}) => {
  await signIn(page);
  await openWorkspace(page, "ordinary-dir");
  await expect(page.getByTestId("workspace-strip")).toHaveCount(0);
  await expect(page.getByTestId("rename-workspace")).toBeVisible();
  await page.getByTestId("account-menu-trigger").click();
  await expect(page.getByTestId("sound-menu-row")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.goto("/settings");
  await expect(page.getByTestId("settings-aanet")).toHaveCount(0);

  await enable(page);
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
  await input.press("Enter");
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
  await enable(page);
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

test("@attention-sound an agent's reply elsewhere plays its workspace's own sound once", async ({
  page,
}) => {
  await signIn(page);
  await enable(page);
  await page.goto("/workspaces");
  const id = await openWorkspace(page, "ordinary-dir");
  const put = await page.request.put("/api/v1/account/preferences", {
    headers: await headers(page),
    data: { workspace_sound: { [id]: "kulho" } },
  });
  expect(put.status()).toBe(200);
  // Night quiets the sound by default; this device may report dark mode.
  await page.request.put("/api/v1/account/preferences", {
    headers: await headers(page),
    data: { sound: { night: false } },
  });
  await page.reload();
  await expect(page.getByTestId("workspace-strip")).toBeVisible();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  const agent = new URL(page.url()).searchParams.get("conversation") ?? "";
  await page.getByTestId("message-input").fill("hidas työ");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const nav = page.getByTestId("workspace-navigation");
  await expect(
    nav.getByTestId("rail-running").getByTestId(`agent-item-${agent}`),
  ).toBeVisible({ timeout: 25000 });
  // Look elsewhere while the agent works: its reply is news then.
  await openWorkspace(page, "git-project");
  await expect(
    nav.getByTestId("rail-yours").getByTestId(`agent-item-${agent}`),
  ).toBeVisible({ timeout: 25000 });
  await expect.poll(() => plays(page), { timeout: 10000 }).toEqual(["kulho"]);
});
