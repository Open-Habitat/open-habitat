import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect, type Page, test } from "./worker-host";

// The person's server browser (experimental) through the real gateway and
// the real daemon routes and viewer relay. The browser host is the synthetic
// host's stand-in (test/browser-host/browser.go): its control socket answers
// from fixture state and its VNC socket is a tiny RFB server that counts the
// input it receives, so a look and control can be told apart. The real host
// with Xvnc and Chrome is proven in the Go tests and by installed-host verification.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
  reducedMotion: "reduce",
});

test.beforeEach(async ({ page }) => {
  expect((await page.request.get("/fixture/reset-clock")).status()).toBe(204);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});

async function signIn(page: Page, on: boolean) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const session = await (await page.request.get("/auth/session")).json();
  if (on) {
    expect(
      (
        await page.request.put("/api/v1/account/preferences", {
          headers: {
            Origin: new URL(page.url()).origin,
            "X-Agent-Host-CSRF": session.csrf,
          },
          data: { experimental: { "remote-browser": true } },
        })
      ).ok(),
    ).toBe(true);
  }
  await page.reload();
  await expect(page.getByTestId("account-menu-trigger")).toBeAttached();
  return session.csrf as string;
}

async function fixture(page: Page, query: string) {
  const res = await page.request.get(`/fixture/browser?${query}`);
  expect(res.status()).toBeLessThan(300);
  return res;
}

async function input(page: Page) {
  return (await (await fixture(page, "input=1")).json()) as {
    pointer_events: number;
    key_events: number;
    /** Key presses in order, as X keysyms. */
    keysyms: number[];
    /** Text the viewer put on the remote clipboard, in order. */
    cuts: string[];
  };
}

// X keysyms (keysymdef.h), an external contract.
const XK_v = 0x76;
const XK_Control_L = 0xffe3;
const XK_Return = 0xff0d;

/** Opens the running browser's live view from the rail, connected. */
async function openView(page: Page) {
  await button(page, "browser-rail-row").click();
  const viewer = page.getByTestId("browser-viewer");
  await expect(viewer).toHaveAttribute("data-phase", "connected", {
    timeout: 20000,
  });
  await expect
    .poll(
      async () => (await viewer.locator("canvas").boundingBox())?.width ?? 0,
    )
    .toBeGreaterThan(0);
  return viewer;
}

const button = (page: Page, id: string) =>
  page.getByRole("button").and(page.getByTestId(id));

test("@server-browser is absent until the experiment is turned on", async ({
  page,
}) => {
  await signIn(page, false);
  await expect(page.getByTestId("workspace-git-project").first()).toBeVisible();
  await expect(page.getByTestId("browser-rail-row")).toHaveCount(0);
});

// A server without TigerVNC and Chrome: the card explains it, a switch that
// is off cannot be turned on, and one already on can still be turned off.
test("@server-browser on a server without the browser the card explains and only lets it off", async ({
  page,
}) => {
  await fixture(page, "installed=off");
  await signIn(page, false);
  await page.goto("/settings/experimental");
  const card = page
    .getByRole("region")
    .and(page.getByTestId("experimental-remote-browser"));
  const segment = (value: "on" | "off") =>
    card
      .getByTestId("experimental-remote-browser-choice")
      .getByTestId(`segment-${value}`);
  await expect(
    card.getByTestId("experimental-remote-browser-unavailable"),
  ).toBeVisible();
  await expect(segment("on")).toBeDisabled();
  // Other experiments are not affected.
  await expect(
    page
      .getByTestId("experimental-rewind-conversation-choice")
      .getByTestId("segment-on"),
  ).toBeEnabled();
  await fixture(page, "installed=on");
  await page.reload();
  await expect(segment("on")).toBeEnabled();
  await expect(
    card.getByTestId("experimental-remote-browser-unavailable"),
  ).toHaveCount(0);
  await segment("on").click();
  await expect(segment("on")).toHaveAttribute("aria-pressed", "true");
  await fixture(page, "installed=off");
  await page.reload();
  await expect(
    card.getByTestId("experimental-remote-browser-unavailable"),
  ).toBeVisible();
  await expect(segment("off")).toBeEnabled();
  await segment("off").click();
  await expect(segment("off")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("browser-rail-row")).toHaveCount(0);
  const a11y = await new AxeBuilder({ page })
    .include('[data-testid="experimental-remote-browser"]')
    .exclude(".ex-pic")
    .analyze();
  expect(a11y.violations).toEqual([]);
});

test("@server-browser opens from the rail; looking sends no input, control does", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const csrf = await signIn(page, true);
  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": csrf,
        },
        data: { experimental: { "explain-mode": true } },
      })
    ).ok(),
  ).toBeTruthy();
  await page.reload();
  await page.getByTestId("account-menu-trigger").click();
  await page.getByTestId("menu-explain").click();
  const row = button(page, "browser-rail-row");
  await expect(row).toHaveAttribute("data-state", "stopped");
  await row.click();
  const sheet = page.getByTestId("browser-sheet");
  await expect(sheet).toHaveAttribute("data-mode", "view");
  const viewer = page.getByTestId("browser-viewer");
  await expect(viewer).toHaveAttribute("data-phase", "connected", {
    timeout: 20000,
  });
  // The first picture sizes noVNC's canvas a moment after it connects.
  await expect
    .poll(
      async () => (await viewer.locator("canvas").boundingBox())?.width ?? 0,
    )
    .toBeGreaterThan(0);
  await expect(row).not.toHaveAttribute("data-state", "stopped");
  await page.screenshot({ path: testInfo.outputPath("sheet-view.png") });
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="browser-sheet"]')
        .analyze()
    ).violations,
  ).toEqual([]);

  // Explain mode lets the look open, but holds control changes: a click
  // on the picture is explained instead of taking control.
  await viewer.locator("canvas").click({ position: { x: 60, y: 60 } });
  await expect(page.getByTestId("explain-card")).toHaveAttribute(
    "data-card",
    "B04",
  );
  await expect(page.locator(".ah-explain-toast")).toBeVisible();
  await expect(sheet).toHaveAttribute("data-mode", "view");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await page.getByTestId("explain-stop").click();
  await row.click();
  await expect(viewer).toHaveAttribute("data-phase", "connected");

  const canvas = viewer.locator("canvas");
  // A look is view-only: moving over the picture reaches nothing.
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + 20, box.y + 20);
  // The RFB server counts what arrives; give the relay time to deliver.
  await page.waitForTimeout(500);
  expect(await input(page)).toMatchObject({ pointer_events: 0, key_events: 0 });
  const frame = page.getByTestId("browser-frame");
  await expect(frame).toHaveAttribute("data-control", "agent");

  // The agent is idle: one click takes control and reaches the page.
  await canvas.click({ position: { x: 40, y: 40 } });
  await expect(sheet).toHaveAttribute("data-mode", "control");
  await expect(frame).toHaveAttribute("data-control", "person");
  await expect
    .poll(async () => (await input(page)).pointer_events)
    .toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("sheet-control.png") });

  // Done gives it back and empties the remote clipboard on the way.
  await button(page, "browser-give-back").click();
  await expect(sheet).toHaveAttribute("data-mode", "view");
  expect((await input(page)).cuts.at(-1)).toBe("");

  // The agent is mid-step: a click only asks, and reaches nothing.
  await fixture(page, "agent=on");
  await expect(
    page.getByTestId("browser-top-bar").getByTestId("browser-take-control"),
  ).toBeVisible();
  const before = await input(page);
  await expect(frame).toHaveAttribute("data-agent", "busy");
  await canvas.click({ position: { x: 80, y: 80 } });
  await expect(page.getByTestId("browser-mid-step")).toBeVisible();
  await expect(sheet).toHaveAttribute("data-mode", "view");
  expect((await input(page)).pointer_events).toBe(before.pointer_events);
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="browser-sheet"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  // Escape answers the question, not the sheet.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("browser-mid-step")).toHaveCount(0);
  await expect(sheet).toBeVisible();
  // "Take when it's done" waits for the operation to end.
  await canvas.click({ position: { x: 80, y: 80 } });
  await button(page, "browser-take-after").click();
  await expect(frame).toHaveAttribute("data-waiting", "true");
  await page.waitForTimeout(300);
  await expect(sheet).toHaveAttribute("data-mode", "view");
  await fixture(page, "agent=off");
  await expect(sheet).toHaveAttribute("data-mode", "control");
  expect((await input(page)).pointer_events).toBe(before.pointer_events);
  await expect(frame).toHaveAttribute("data-agent", "idle");
  await button(page, "browser-give-back").click();
  await expect(sheet).toHaveAttribute("data-mode", "view");

  // Mid-step again, "Take control now" takes it at once.
  await fixture(page, "agent=on");
  await expect(frame).toHaveAttribute("data-agent", "busy");
  await canvas.click({ position: { x: 80, y: 80 } });
  await button(page, "browser-take-now").click();
  await expect(sheet).toHaveAttribute("data-mode", "control");
  await button(page, "browser-give-back").click();
  await expect(sheet).toHaveAttribute("data-mode", "view");
  await button(page, "browser-sheet-close").click();
  await expect(sheet).toHaveCount(0);
});

test("@server-browser the clipboard: paste in by shortcut, field and keystrokes, copy out only when asked", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(90000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn(page, true);
  const viewer = await openView(page);
  const sheet = page.getByTestId("browser-sheet");
  const canvas = viewer.locator("canvas");

  // The agent is idle, so typing on the focused picture takes control and
  // the keys reach the page.
  await canvas.click({ position: { x: 30, y: 30 } });
  await expect(sheet).toHaveAttribute("data-mode", "control");
  await button(page, "browser-give-back").click();
  await expect(sheet).toHaveAttribute("data-mode", "view");
  // Focus stays on the picture after Done.
  await expect(canvas).toBeFocused();
  const typedBefore = (await input(page)).keysyms.length;
  await page.keyboard.type("ab");
  await expect(sheet).toHaveAttribute("data-mode", "control");
  await expect
    .poll(async () => (await input(page)).keysyms.slice(typedBefore))
    .toEqual([0x61, 0x62]);

  // ⌘/Ctrl+V pastes the person's own clipboard: the text goes to the
  // remote clipboard, then the remote gets Ctrl+V. The confirmation never
  // shows the text.
  const secret = "sälasana-42";
  await page.evaluate((t) => navigator.clipboard.writeText(t), secret);
  await canvas.focus();
  const keysBefore = (await input(page)).keysyms.length;
  await page.keyboard.press("Control+V");
  await expect.poll(async () => (await input(page)).cuts).toContain(secret);
  // Ctrl is down before the V (the viewer may press it again itself).
  await expect
    .poll(async () => {
      const keys = (await input(page)).keysyms.slice(keysBefore);
      return [keys[0], keys.filter((k) => k !== XK_Control_L)];
    })
    .toEqual([XK_Control_L, [XK_v]]);
  const toast = page.getByTestId("browser-toast");
  await expect(toast).not.toBeEmpty();
  await expect(toast).not.toContainText(secret);

  // The clipboard popover: the paste field sends with its own Ctrl+V and
  // clears itself.
  await button(page, "browser-clip-toggle").click();
  const pop = page.getByTestId("browser-clipboard");
  await expect(pop).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("clipboard.png") });
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="browser-sheet"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  const password = pop.getByTestId("browser-password");
  await expect(password).toHaveAttribute("type", "password");
  await password.fill("äöå€@Ł");
  const passwordKeys = (await input(page)).keysyms.length;
  const passwordCuts = (await input(page)).cuts.length;
  await button(page, "browser-password-send").click();
  await expect
    .poll(async () => (await input(page)).keysyms.slice(passwordKeys))
    .toEqual([0xe4, 0xf6, 0xe5, 0x20ac, 0x40, 0x1a3]);
  await expect(password).toHaveValue("");
  expect((await input(page)).cuts.length).toBe(passwordCuts);
  await expect(toast).not.toContainText("äöå€@Ł");
  // Refusal preserves the masked value without partially typing it.
  await password.fill("ä😀");
  await button(page, "browser-password-send").click();
  await expect(password).toHaveValue("ä😀");
  expect((await input(page)).keysyms.length).toBe(passwordKeys + 6);
  await expect(password).toHaveAttribute("type", "password");

  const field = pop.getByTestId("browser-paste-text");
  await field.fill("koodi 123456");
  let mark = (await input(page)).keysyms.length;
  await button(page, "browser-paste-send").click();
  await expect
    .poll(async () => (await input(page)).cuts)
    .toContain("koodi 123456");
  await expect
    .poll(async () => (await input(page)).keysyms.slice(mark))
    .toEqual([XK_Control_L, XK_v]);
  await expect(field).toHaveValue("");

  // Typing as keystrokes never uses the remote clipboard; a line break is
  // sent as Enter only after a second press.
  const cutsBefore = (await input(page)).cuts.length;
  await field.fill("äöå€@Ł");
  mark = (await input(page)).keysyms.length;
  await button(page, "browser-type-send").click();
  await expect
    .poll(async () => (await input(page)).keysyms.slice(mark))
    .toEqual([0xe4, 0xf6, 0xe5, 0x20ac, 0x40, 0x1a3]);
  await expect(field).toHaveValue("");
  await field.fill("ä😀");
  mark = (await input(page)).keysyms.length;
  await button(page, "browser-type-send").click();
  await expect(field).toHaveValue("ä😀");
  await expect(toast).not.toBeEmpty();
  expect((await input(page)).keysyms.length).toBe(mark);
  await field.fill("A~\nx");
  mark = (await input(page)).keysyms.length;
  await button(page, "browser-type-send").click();
  await expect(pop.getByRole("alert")).toBeVisible();
  await page.waitForTimeout(300);
  expect((await input(page)).keysyms.length).toBe(mark);
  await button(page, "browser-type-send").click();
  await expect
    .poll(async () => (await input(page)).keysyms.slice(mark))
    .toEqual([0x41, 0x7e, XK_Return, 0x78]);
  expect((await input(page)).cuts.length).toBe(cutsBefore);
  await expect(field).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(pop).toHaveCount(0);
  await expect(sheet).toBeVisible();

  // A remote copy the person did not ask for is not offered.
  await page.evaluate(() => navigator.clipboard.writeText("oma"));
  await fixture(page, `cut=${encodeURIComponent("sivun oma kopio")}`);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("oma");
  await expect(page.getByTestId("browser-remote-clip")).toHaveCount(0);
  // After the person's own Ctrl+C, the remote copy reaches their clipboard.
  await canvas.focus();
  await page.keyboard.press("Control+C");
  await fixture(page, `cut=${encodeURIComponent("FI-4471-2290")}`);
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("FI-4471-2290");

  // Done empties the remote clipboard.
  await button(page, "browser-give-back").click();
  await expect(sheet).toHaveAttribute("data-mode", "view");
  expect((await input(page)).cuts.at(-1)).toBe("");
  await button(page, "browser-clip-toggle").click();
  await expect(password).toHaveValue("");
  await expect(button(page, "browser-password-send")).toBeDisabled();
});

test("@server-browser control goes back after three idle minutes, never while the agent asks", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.clock.install();
  await signIn(page, true);
  await openView(page);
  const sheet = page.getByTestId("browser-sheet");
  await button(page, "browser-take-control").click();
  await expect(sheet).toHaveAttribute("data-mode", "control");

  // Two and a half minutes: the countdown shows, and keeping control
  // starts the three minutes again.
  await page.clock.runFor("02:31");
  await expect(page.getByTestId("browser-idle")).toBeVisible();
  await button(page, "browser-keep").click();
  await expect(page.getByTestId("browser-idle")).toHaveCount(0);
  await page.clock.runFor("02:00");
  await expect(sheet).toHaveAttribute("data-mode", "control");
  await page.clock.runFor("01:05");
  await expect(sheet).toHaveAttribute("data-mode", "view");
  expect((await input(page)).cuts.at(-1)).toBe("");

  // With the agent's request open, control stays with the person.
  await fixture(page, `request=${encodeURIComponent("Kirjaudu")}&window=0`);
  await expect(page.getByTestId("browser-says")).toBeVisible();
  await button(page, "browser-take-control").click();
  await expect(sheet).toHaveAttribute("data-mode", "control");
  await page.clock.runFor("05:00");
  await expect(page.getByTestId("browser-idle")).toHaveCount(0);
  await expect(sheet).toHaveAttribute("data-mode", "control");
});

const passwordTest = createHostTest(false, { BROWSER_HOST_LAB: "1" });
passwordTest.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
});
for (const width of [1440, 390]) {
  for (const language of ["fi", "en-US"]) {
    passwordTest(
      `@server-browser password explanation holds sending ${width} ${language}`,
      async ({ page }) => {
        const csrf = await signIn(page, true);
        for (const data of [
          { language },
          { experimental: { "explain-mode": true } },
        ]) {
          expect(
            (
              await page.request.put("/api/v1/account/preferences", {
                headers: {
                  Origin: new URL(page.url()).origin,
                  "X-Agent-Host-CSRF": csrf,
                },
                data,
              })
            ).ok(),
          ).toBe(true);
        }
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        await openView(page);
        await button(page, "browser-take-control").click();
        await expect(page.getByTestId("browser-sheet")).toHaveAttribute(
          "data-mode",
          "control",
        );
        await button(page, "browser-sheet-close").click();
        await page.getByTestId("account-menu-trigger").click();
        await page.getByTestId("menu-explain").click();
        await openView(page);
        await page.setViewportSize({ width, height: 900 });
        await button(page, "browser-clip-toggle").click();
        const password = page.getByTestId("browser-password");
        await password.fill("synthetic-only");
        const before = (await input(page)).keysyms.length;
        await button(page, "browser-password-send").click();
        const card = page.getByTestId("explain-card");
        await expect(card).toHaveAttribute("data-card", "B10");
        await expect(password).toHaveValue("synthetic-only");
        expect((await input(page)).keysyms.length).toBe(before);
        if (process.env.OH_PASSWORD_CAPTURE) {
          await snapshot(
            page,
            `${process.env.OH_PASSWORD_CAPTURE}/send-${width}-${language}`,
            { labOrigin: new URL(page.url()).origin },
          );
        }
        await password.hover();
        await expect(card).toHaveAttribute("data-card", "B09");
        if (process.env.OH_PASSWORD_CAPTURE) {
          await snapshot(
            page,
            `${process.env.OH_PASSWORD_CAPTURE}/field-${width}-${language}`,
            { labOrigin: new URL(page.url()).origin },
          );
        }
      },
    );
  }
}

test("@server-browser the frame fits a phone", async ({ page }, testInfo) => {
  test.setTimeout(60000);
  await signIn(page, true);
  await openView(page);
  await page.setViewportSize({ width: 320, height: 844 });
  const bar = page.getByTestId("browser-top-bar");
  await fixture(
    page,
    `request=${encodeURIComponent("Please sign in to the example website, then return control when finished.")}&window=0`,
  );
  await expect(bar.getByTestId("browser-says")).toBeVisible();
  await bar.getByTestId("browser-take-control").click();
  await expect(page.getByTestId("browser-sheet")).toHaveAttribute(
    "data-mode",
    "control",
  );
  await button(page, "browser-clip-toggle").click();
  await expect(page.getByTestId("browser-clipboard")).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(320);
  // All actions stay in the one bar without wrapping or overlapping at phone width.
  const controls = [
    "browser-give-back",
    "browser-clip-toggle",
    "browser-stop",
    "browser-sheet-close",
  ];
  const boxes = await Promise.all(
    controls.map((id) => bar.getByTestId(id).boundingBox()),
  );
  const first = boxes[0];
  if (!first) throw new Error("Missing top-bar control");
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (!box) throw new Error("Missing top-bar control");
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(
      Math.abs(box.y + box.height / 2 - (first.y + first.height / 2)),
    ).toBeLessThan(2);
    const previous = boxes[i - 1];
    if (previous)
      expect(box.x).toBeGreaterThanOrEqual(previous.x + previous.width);
  }
  const popBox = await page.getByTestId("browser-clipboard").boundingBox();
  const barBox = await bar.boundingBox();
  if (!popBox || !barBox) throw new Error("Missing bar or clipboard popover");
  expect(popBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height - 1);
  expect(popBox.x + popBox.width).toBeLessThanOrEqual(320);
  // The picture keeps a usable size beneath the bar and popover.
  const canvasBox = await page
    .getByTestId("browser-viewer")
    .locator("canvas")
    .boundingBox();
  expect(canvasBox?.width ?? 0).toBeGreaterThan(200);
  await page.screenshot({ path: testInfo.outputPath("phone.png") });
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="browser-sheet"]')
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("@server-browser a window's request opens the strip beside its picture and takes control in one press", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  await signIn(page, true);
  // Start the browser from the rail and leave the look.
  await button(page, "browser-rail-row").click();
  await expect(page.getByTestId("browser-sheet")).toBeVisible();
  await button(page, "browser-sheet-close").click();

  await page
    .getByRole("navigation")
    .getByTestId("workspace-git-project")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const pill = page.locator(".md-empty-picker");
  await pill.locator(":scope > summary").click();
  await pill.getByTestId("model-gpt-6-nova").check();
  await pill.getByTestId(/^(model-commit|conversation-model-start)$/).click();
  await page.getByTestId("message-input").fill("avaa selain");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(
    page.getByText('Selvä. Kysyit: "avaa selain".').last(),
  ).toBeVisible({ timeout: 20000 });

  const chip = button(page, "browser-chip");
  await expect(chip).toHaveAttribute("data-state", "idle");
  await fixture(page, "agent=on");
  await fixture(page, "pointer=0.5,0.6");
  await expect(chip).toHaveAttribute("data-state", "agent");

  // The agent asks for the second window; the strip opens by itself with
  // that window large and the agent's own words beside it.
  const words = "Palvelu pyytää vahvistuskoodia <b>ei merkintää</b>";
  await fixture(page, `request=${encodeURIComponent(words)}&window=1`);
  await expect(chip).toHaveAttribute("data-state", "ask");
  const strip = page.getByTestId("browser-strip");
  await expect(strip).toBeVisible();
  await expect(strip.getByTestId("browser-request-text")).toHaveText(words);
  const lead = strip.locator(".sb-strip-lead [data-testid=browser-window]");
  await expect(lead).toHaveAttribute(
    "data-window",
    "F9E8D7C6B5A4938271605F4E3D2C1B0A",
  );
  // Pictures come through the daemon as images.
  await expect(
    strip.locator("[data-testid=browser-window] img").first(),
  ).toHaveAttribute("src", /^blob:/, { timeout: 10000 });
  // The agent's pointer is on the window it acts in (window 0).
  await expect(
    strip
      .locator('[data-window="0A1B2C3D4E5F60718293A4B5C6D7E8F9"]')
      .getByTestId("browser-pointer"),
  ).toBeAttached();
  await page.screenshot({ path: testInfo.outputPath("strip-ask.png") });

  await button(page, "browser-take-request").click();
  const sheet = page.getByTestId("browser-sheet");
  await expect(sheet).toHaveAttribute("data-mode", "control");
  await button(page, "browser-sheet-close").click();
  // Closing the look keeps control with the person until they give it back.
  await expect(chip).toHaveAttribute("data-state", "person");
  await expect(strip).toBeVisible();
  await button(page, "browser-give-back").click();
  // Giving control back clears the request the person answered.
  await expect(chip).toHaveAttribute("data-state", "agent");
  await expect(strip.getByTestId("browser-request")).toHaveCount(0);
});
