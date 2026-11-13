import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// The browser terminal against the real gateway relay, the real daemon
// terminal routes and a real tmux and bash, as the test's own UID in an
// invented home: selection, scrollback, copying and addresses a program asks
// the browser to open. Synthetic host-backed evidence, not a live host.
const shots = process.env.OH_TERMINAL_SHOTS;
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
    (w: { name: string }) => w.name === "ordinary-dir",
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
  await page.keyboard.type("clear; seq 1 300\n");
  await expect(rows(page).filter({ hasText: /^300\s*$/ })).toHaveCount(1);
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

test("@browser-shell copy on select, the copy shortcut and tmux's own selection", async ({
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
  await expect.poll(clipboard).toBe("copy-42");
  const chip = page.getByTestId("copy-selection");
  await expect(chip).toHaveAttribute("data-copied", "true");
  await expect(chip).toContainText("Kopioitu");
  // Ctrl+Shift+C copies the selection whatever the setting.
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await page.keyboard.press("Control+Shift+C");
  await expect.poll(clipboard).toBe("copy-42");
  // A plain drag is tmux's own selection; its copy reaches the clipboard.
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
  await expect.poll(clipboard).toMatch(/^tmux-5/);
  await expect(chip).toHaveAttribute("data-copied", "true");
  if (shots) {
    // Resizing for the captures clears the selection; select once more.
    await shiftSelect(page, /^copy-42\s*$/);
    await capture(page, "copy-on-select");
  }
});

test("@browser-shell an address a program opens is offered and opens only on a press", async ({
  page,
}) => {
  await page
    .context()
    .route("https://example.test/**", (route) =>
      route.fulfill({ contentType: "text/plain", body: "synthetic" }),
    );
  await signIn(page, { "terminal-open-urls": true });
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
