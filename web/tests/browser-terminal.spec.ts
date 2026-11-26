import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { snapshot as captureSnapshot } from "../lab/session.mjs";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect, type Page } from "./worker-host";

// The browser terminal against the real gateway relay, the real daemon
// terminal routes and a real tmux and bash, as the test's own UID in an
// invented home: selection, scrollback, copying and addresses a program asks
// the browser to open. Synthetic host-backed evidence, not a live host.
const shots = process.env.OH_TERMINAL_SHOTS;
// Captures use the synthetic lab so its guarded offline snapshot is available.
const test = createHostTest(false, shots ? { BROWSER_HOST_LAB: "1" } : {});
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  ...(shots ? { deviceScaleFactor: 2 } : {}),
});

async function signIn(page: Page, experimental: Record<string, boolean>) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  if (Object.keys(experimental).length) {
    const session = await (await page.request.get("/auth/session")).json();
    const put = await page.request.put("/api/v1/account/preferences", {
      headers: {
        Origin: new URL(page.url()).origin,
        "X-Agent-Host-CSRF": session.csrf,
      },
      data: { experimental },
    });
    expect(put.ok()).toBe(true);
  }
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const workspace = snapshot.workspaces.find(
    (w: { name: string }) =>
      w.name === (shots ? "aurinkokello" : "ordinary-dir"),
  );
  await page.goto(`/workspaces/${workspace.workspace_id}`);
  await page
    .getByRole("button")
    .and(page.getByTestId("conversation-start"))
    .click();
  await expect(page).toHaveURL(/conversation=pi:/);
}

const surface = (page: Page) => page.locator(".ah-terminal-surface");
const screen = (page: Page) => page.locator(".ah-terminal-surface .xterm-rows");
const rows = (page: Page) => screen(page).locator(":scope > div");

async function openShell(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) <= 800) {
    await page.getByTestId("conversation-menu").click();
    await page.getByTestId("menu-toggle-terminal").click();
  } else {
    await page.getByTestId("toggle-terminal").click();
  }
  await expect(screen(page)).toContainText("alice@open-habitat-lab:");
  await expect(page.locator(".ah-terminal-surface textarea")).toBeFocused();
}

/** Counts tmux's full redraws: each one re-sends the mouse mode. */
function watchRedraws(page: Page) {
  const seen = { redraws: 0 };
  page.on("websocket", (socket) => {
    if (!socket.url().includes("/api/v1/workspaces/terminal?")) return;
    socket.on("framereceived", ({ payload }) => {
      if (typeof payload !== "string" && payload.includes("\x1b[?1000h"))
        seen.redraws++;
    });
  });
  return seen;
}

async function shiftSelect(page: Page, text: RegExp) {
  const row = rows(page).filter({ hasText: text }).first();
  const box = await row.boundingBox();
  if (!box) throw new Error("no output row");
  await page.keyboard.down("Shift");
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
}

const highlight = (page: Page) =>
  page.locator(".ah-terminal-surface .xterm-selection div").first();

async function topNumber(page: Page) {
  const texts = await rows(page).allTextContents();
  const first = texts.find((t) => /^\d+\s*$/.test(t));
  return first ? Number(first.trim()) : Number.NaN;
}

test("@browser-shell selection is visible in every theme, with and without mouse reporting", async ({
  page,
}) => {
  await signIn(page, {});
  await openShell(page);
  await page.keyboard.type("printf '\\033[31mselection sample\\033[0m\\n'\n");
  await expect(
    rows(page).filter({ hasText: /^selection sample\s*$/ }),
  ).toHaveCount(1);
  for (const mouse of [true, false]) {
    if (!mouse) {
      await page.locator(".ah-terminal-surface textarea").focus();
      await page.keyboard.type("tmux set mouse off; echo mouse-$((1+1))\n");
      await expect(screen(page)).toContainText("mouse-2");
    }
    for (const theme of ["light", "dark", "contrast"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      const row = rows(page)
        .filter({ hasText: /^selection sample\s*$/ })
        .first();
      const box = await row.boundingBox();
      if (!box) throw new Error("no sample row");
      if (mouse) await page.keyboard.down("Shift");
      await page.mouse.move(box.x + 1, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 145, box.y + box.height / 2, { steps: 6 });
      await page.mouse.up();
      if (mouse) await page.keyboard.up("Shift");
      await expect(highlight(page)).toBeVisible();
      for (const focused of [true, false]) {
        if (focused)
          await page.locator(".ah-terminal-surface textarea").focus();
        else await page.getByTestId("hide-terminal").focus();
        await expect(highlight(page)).toBeVisible();
        const colors = await surface(page).evaluate((el) => {
          const style = getComputedStyle(el);
          const rgb = (token: string) => {
            const probe = document.createElement("span");
            probe.style.color = style.getPropertyValue(token).trim();
            el.append(probe);
            const color = getComputedStyle(probe).color;
            probe.remove();
            return color;
          };
          return {
            background: rgb("--ah-terminal-selection"),
            foreground: rgb("--ah-terminal-selection-ink"),
          };
        });
        await expect(highlight(page)).toHaveCSS(
          "background-color",
          colors.background,
        );
        // The sample is ANSI red; selection must override that colour as well.
        await expect(row.locator("span").first()).toHaveCSS(
          "color",
          colors.foreground,
        );
        if (shots)
          await captureSnapshot(
            page,
            join(
              shots,
              `selection-${theme}-${mouse ? "shift" : "normal"}-${focused ? "focused" : "unfocused"}`,
            ),
            { labOrigin: new URL(page.url()).origin },
          );
      }
    }
  }
});

test("@browser-shell selection actions stay outside every selected row at panel edges", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn(page, {});
  await openShell(page);
  for (const shift of [true, false]) {
    await page.locator(".ah-terminal-surface textarea").focus();
    // The previous pass's "80" is still on screen, so each pass waits for
    // its own marker: dragging before tmux has changed its mouse mode lets
    // tmux, not xterm.js, take the drag.
    const mode = shift ? "on" : "off";
    await page.keyboard.type(
      `tmux set mouse ${mode}; seq 1 80; echo ready-${mode}-$((1+1))\n`,
    );
    await expect(
      rows(page).filter({ hasText: new RegExp(`^ready-${mode}-2\\s*$`) }),
    ).toHaveCount(1);
    const count = await rows(page).count();
    for (const [start, end] of [
      [0, 0],
      [0, 2],
      [count - 3, count - 3],
      [count - 5, count - 3],
      [0, count - 3],
      [0, count - 1],
    ]) {
      const first = await rows(page).nth(start).boundingBox();
      const last = await rows(page).nth(end).boundingBox();
      if (!first || !last) throw new Error("missing terminal rows");
      if (shift) await page.keyboard.down("Shift");
      await page.mouse.move(first.x + 1, first.y + first.height / 2);
      await page.mouse.down();
      await page.mouse.move(last.x + 50, last.y + last.height / 2, {
        steps: 6,
      });
      await page.mouse.up();
      if (shift) await page.keyboard.up("Shift");
      await expect(page.getByTestId("copy-selection")).toBeVisible();
      await expect
        .poll(async () => {
          const bounds = await page
            .locator(".xterm-selection div")
            .evaluateAll((elements) =>
              elements
                .map((el) => el.getBoundingClientRect())
                .filter((rect) => rect.height > 0)
                .map((rect) => ({ top: rect.top, bottom: rect.bottom })),
            );
          return (
            bounds.length > 0 &&
            Math.min(...bounds.map((r) => r.top)) <= first.y + 1 &&
            Math.max(...bounds.map((r) => r.bottom)) >= last.y + last.height - 1
          );
        })
        .toBe(true);
      await expect
        .poll(() =>
          page.locator(".ah-terminal-chip").evaluate((chip) => {
            const actions = chip.getBoundingClientRect();
            const parent = chip.parentElement;
            if (!parent) return false;
            const host = parent.getBoundingClientRect();
            const selected = [
              ...parent.querySelectorAll(".xterm-selection div"),
            ]
              .map((el) => el.getBoundingClientRect())
              .filter((rect) => rect.height > 0);
            return (
              selected.length > 0 &&
              actions.left >= host.left &&
              actions.right <= host.right &&
              selected.every(
                (rect) =>
                  actions.bottom <= rect.top || actions.top >= rect.bottom,
              )
            );
          }),
        )
        .toBe(true);
      if (shots)
        await captureSnapshot(
          page,
          join(shots, `placement-${shift ? "shift" : "plain"}-${start}-${end}`),
          { labOrigin: new URL(page.url()).origin },
        );
      // Clear through the real action so its old toolbar cannot intercept the
      // start of the next range on otherwise unselected rows.
      await page.getByTestId("copy-selection").click();
      await expect(page.getByTestId("copy-selection")).toBeHidden();
    }
  }
});

test("@browser-shell a selection survives tmux's redraws; the wheel reads history a line at a time", async ({
  page,
}) => {
  // Screenshot runs change the device scale, which changes wheel deltas.
  test.skip(!!shots, "screenshots only");
  const seen = watchRedraws(page);
  await signIn(page, {});
  await openShell(page);
  await page.keyboard.type("seq 1 300; echo seq-$((1+1))\n");
  await expect(screen(page)).toContainText("seq-2");
  const before = seen.redraws;
  const height = await rows(page).count();
  await shiftSelect(page, /^29[0-9]\s*$/);
  await expect(highlight(page)).toBeVisible();
  const chip = page.getByTestId("copy-selection");
  await expect(chip).toBeVisible();
  // A narrower window: tmux redraws the whole screen and re-sends its mouse
  // mode, as it does on attach, after any resize and when a second device
  // resizes the window. (xterm.js itself clears a selection when the number
  // of rows changes; the width alone must not.)
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");
  await page.setViewportSize({
    width: viewport.width - 160,
    height: viewport.height,
  });
  await expect
    .poll(() => seen.redraws, { timeout: 10_000 })
    .toBeGreaterThan(before);
  expect(await rows(page).count()).toBe(height);
  // The redraw has been parsed; the selection and its actions remain.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        setTimeout(() => requestAnimationFrame(() => resolve()), 100),
      ),
  );
  await expect(highlight(page)).toBeVisible();
  await expect(chip).toBeVisible();

  // The wheel scrolls tmux's history as far as it moved: one line per
  // line-height of pixels, not five lines an event.
  // The earlier "300" may still be on screen: wait for this run's own end.
  await page.keyboard.type("clear; seq 1 300; echo wheel-$((1+2))\n");
  await expect(rows(page).filter({ hasText: /^wheel-3\s*$/ })).toHaveCount(1);
  const box = await page
    .locator(".ah-terminal-surface .xterm-screen")
    .boundingBox();
  if (!box) throw new Error("no screen");
  const lineHeight = box.height / (await rows(page).count());
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -lineHeight * 10);
  await expect(surface(page)).toHaveAttribute("data-history", "");
  await expect.poll(() => topNumber(page)).toBeLessThan(290);
  // No cursor in the history.
  await expect(page.locator(".ah-terminal-surface .xterm-cursor")).toHaveCount(
    0,
  );
  const top = await topNumber(page);
  await page.mouse.wheel(0, -lineHeight);
  await expect.poll(() => topNumber(page)).toBe(top - 1);
  await page.mouse.wheel(0, -lineHeight * 3);
  await expect.poll(() => topNumber(page)).toBe(top - 4);
  await page.mouse.wheel(0, lineHeight * 2);
  await expect.poll(() => topNumber(page)).toBe(top - 2);
  // Reattached while tmux still shows the history (hidden and reopened):
  // the next wheel scroll is reading history too.
  await page.getByTestId("hide-terminal").click();
  await page.getByTestId("toggle-terminal").click();
  await expect(rows(page).first()).not.toHaveText("");
  await expect(surface(page)).not.toHaveAttribute("data-history");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -lineHeight * 2);
  await expect(surface(page)).toHaveAttribute("data-history", "");
  await page.locator(".ah-terminal-surface textarea").focus();
  // Typing leaves the history and reaches the shell, as in any terminal.
  await page.keyboard.type("echo back-$((1+2))\n");
  await expect(screen(page)).toContainText("back-3");
  await expect(surface(page)).not.toHaveAttribute("data-history");
  await expect(
    page.locator(".ah-terminal-surface .xterm-cursor"),
  ).not.toHaveCount(0);
});

test("@browser-shell selections leave the clipboard alone despite a retired saved switch; explicit copy works", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn(page, { "terminal-copy-on-select": true });
  await openShell(page);
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
  await page.keyboard.type("echo copy-$((6*7)); echo tmux-$((7*8))\n");
  await expect(screen(page)).toContainText("tmux-56");
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await shiftSelect(page, /^copy-42\s*$/);
  const chip = page.getByTestId("copy-selection");
  await expect(chip).toBeVisible();
  expect(await clipboard()).toBe("");
  await expect(chip).not.toHaveAttribute("data-copied");
  await expect(page.getByTestId("toast")).toHaveCount(0);
  // Ctrl+Shift+C remains an explicit copy action.
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await page.keyboard.press("Control+Shift+C");
  await expect.poll(clipboard).toBe("copy-42");
  // A plain drag offers tmux's own selection without writing the clipboard.
  await page.evaluate(() => navigator.clipboard.writeText(""));
  const row = rows(page)
    .filter({ hasText: /^tmux-56\s*$/ })
    .first();
  const box = await row.boundingBox();
  if (!box) throw new Error("no output row");
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(chip).toBeVisible();
  expect(await clipboard()).toBe("");
  await chip.click();
  await expect.poll(clipboard).toMatch(/^tmux-5/);
  await expect(page.getByTestId("toast")).toHaveCount(0);
  if (shots) {
    // Resizing for the captures clears the selection; select once more.
    await shiftSelect(page, /^copy-42\s*$/);
    await capture(page, "explicit-copy");
  }
});

test.describe("Mac clipboard shortcuts", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
  });

  test("@browser-shell Cmd+C copies canvas and tmux selections without interrupting", async ({
    page,
  }) => {
    // Chromium's UA override does not change navigator.platform on Linux.
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "platform", { get: () => "MacIntel" }),
    );
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await signIn(page, {});
    await openShell(page);
    const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
    await page.keyboard.type("echo copy-$((6*7)); echo tmux-$((7*8))\n");
    await expect(screen(page)).toContainText("tmux-56");
    await page.evaluate(() => navigator.clipboard.writeText("unchanged"));
    await page.keyboard.type("echo intact");
    await page.keyboard.press("Meta+c");
    await page.keyboard.press("Enter");
    await expect(rows(page).filter({ hasText: /^intact\s*$/ })).toHaveCount(1);
    expect(await clipboard()).toBe("unchanged");
    await shiftSelect(page, /^copy-42\s*$/);
    await page.keyboard.press("Meta+c");
    await expect.poll(clipboard).toBe("copy-42");

    const row = rows(page)
      .filter({ hasText: /^tmux-56\s*$/ })
      .first();
    const box = await row.boundingBox();
    if (!box) throw new Error("no output row");
    await page.mouse.move(box.x + 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId("copy-selection")).toBeVisible();
    expect(await clipboard()).toBe("copy-42");
    await page.keyboard.press("Meta+c");
    await expect.poll(clipboard).toMatch(/^tmux-5/);
  });
});

test("@browser-shell an address a program opens is offered and opens only on a press", async ({
  page,
}) => {
  await page
    .context()
    .route("https://example.test/**", (route) =>
      route.fulfill({ contentType: "text/plain", body: "synthetic" }),
    );
  await signIn(page, {});
  await openShell(page);
  const offer = page
    .getByRole("region")
    .and(page.getByTestId("terminal-url-offer"));
  // Refused before it reaches the browser: only http(s), printable.
  await page.keyboard.type('"$BROWSER" javascript:alert-1; echo refused-$?\n');
  await expect(screen(page)).toContainText("refused-1");
  await expect(offer).toBeHidden();
  await page.keyboard.type(
    '"$BROWSER" "https://example.test/login/device?code=ABCD-1234"\n',
  );
  await expect(offer).toBeVisible();
  await expect(offer).toContainText("example.test");
  await expect(page.getByTestId("terminal-url")).toHaveText(
    "https://example.test/login/device?code=ABCD-1234",
  );
  // The address is printed in the terminal too.
  await expect(screen(page)).toContainText(
    "Open in your browser: https://example.test/login/device",
  );
  if (shots) await capture(page, "open-url");
  const open = offer
    .getByRole("link")
    .and(page.getByTestId("terminal-url-open"));
  await expect(open).toHaveAttribute("target", "_blank");
  await expect(open).toHaveAttribute("rel", "noopener noreferrer");
  const popup = page.waitForEvent("popup");
  await open.click();
  expect((await popup).url()).toBe(
    "https://example.test/login/device?code=ABCD-1234",
  );
  await expect(offer).toBeHidden();
  // Dismissing opens nothing.
  await page.keyboard.type('"$BROWSER" https://example.test/second\n');
  await expect(offer).toBeVisible();
  await offer.getByTestId("terminal-url-dismiss").click();
  await expect(offer).toBeHidden();
  await expect(page.locator(".ah-terminal-surface textarea")).toBeFocused();
});

/** Screenshots for review: 1440 and 390 wide, light and dark, at scale 2,
 * into OH_TERMINAL_SHOTS (outside the repository). */
async function capture(page: Page, name: string) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  const original = page.viewportSize();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width > 800 ? 900 : 844 });
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: join(shots, `${name}-${width}-${scheme}.png`),
      });
    }
  }
  await page.emulateMedia({ colorScheme: null });
  if (original) await page.setViewportSize(original);
}
