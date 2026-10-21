import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// The browser shell (Paneeli) against the real gateway relay, the real daemon
// terminal routes and a real tmux and bash, all as the test's own UID in an
// invented home. Distinct-UID isolation is the VM scenario's to prove.
test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function conversation(page: Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
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
  return workspace.workspace_id as string;
}

const screen = (page: Page) => page.locator(".ah-terminal-surface .xterm-rows");

async function openFirstShell(page: Page) {
  await page
    .getByRole("button")
    .and(page.getByTestId("toggle-terminal"))
    .click();
  const panel = page
    .getByRole("region")
    .and(page.getByTestId("terminal-panel"));
  // One gesture, including the first ever open: no empty panel or warning.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(screen(page)).toContainText("alice@open-habitat-lab:");
  // The new terminal has the keyboard: what is typed goes to the shell.
  await expect(page.locator(".ah-terminal-surface textarea")).toBeFocused();
  return panel;
}

async function shells(page: Page, id: string) {
  const list = await (
    await page.request.get(`/api/v1/workspaces/terminals?workspace_id=${id}`)
  ).json();
  return list.shells as { shell: string; busy: boolean; command?: string }[];
}

test("@browser-shell Nordic macOS shortcut opens directly and does not submit the composer", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
  });
  const id = await conversation(page);
  const composer = page
    .getByRole("textbox")
    .and(page.getByTestId("message-input"));
  await composer.fill("Do not send this draft");
  const panel = page
    .getByRole("region")
    .and(page.getByTestId("terminal-panel"));
  // Finnish macOS's accent key is a dead key, not a shortcut. Nor should
  // the US physical Backquote key accidentally retain the old binding.
  for (const code of ["Equal", "Backquote"])
    await composer.dispatchEvent("keydown", {
      key: "Dead",
      code,
      ctrlKey: true,
      shiftKey: true,
    });
  await expect(panel).toBeHidden();
  // Ctrl+Alt+T also works on Nordic macOS without a dead-key character.
  await page.keyboard.press("Control+Alt+KeyT");
  await expect(screen(page)).toContainText("alice@open-habitat-lab:");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(composer).toHaveValue("Do not send this draft");
  await expect(page.locator(".ah-terminal-surface textarea")).toBeFocused();
  // Actual browser key events must work from inside xterm as well.
  await page.keyboard.press("Control+Alt+KeyT");
  await expect(panel.getByRole("tab")).toBeFocused();
  await page.keyboard.press("Control+Shift+Enter");
  await expect(page.locator(".ah-terminal-surface textarea")).toBeFocused();
  await page
    .getByRole("button")
    .and(page.getByTestId("toggle-terminal"))
    .click();
  await page.keyboard.press("Control+Shift+Enter");
  await expect(screen(page)).toContainText("alice@open-habitat-lab:");
  expect(await shells(page, id)).toHaveLength(1);
  expect(
    (await new AxeBuilder({ page }).include(".ah-terminal-dock").analyze())
      .violations,
  ).toEqual([]);
});

test("@browser-shell tabs, Ctrl+Shift+Enter and hiding keep shells running in tmux", async ({
  page,
}) => {
  // Hold the next attachment's server messages until arrow navigation has
  // focused its tab. This forces the formerly intermittent ready/focus race.
  let holdNext = false;
  let releaseAttachment: (() => void) | undefined;
  await page.routeWebSocket(/\/api\/v1\/workspaces\/terminal\?/, (ws) => {
    const gate = holdNext
      ? new Promise<void>((resolve) => {
          releaseAttachment = resolve;
          holdNext = false;
        })
      : Promise.resolve();
    const server = ws.connectToServer();
    server.onMessage((message) => {
      void gate.then(() => ws.send(message));
    });
  });
  const id = await conversation(page);
  const panel = await openFirstShell(page);
  await expect(screen(page)).toContainText("~/src/ordinary-dir");
  // Typing reaches bash in the workspace directory.
  await page.keyboard.type("sleep 300\n");
  const tabs = panel;
  await expect(
    tabs.getByRole("img").and(page.getByTestId("terminal-busy")),
  ).toBeVisible();
  // tmux names a window after what runs in it: the busy tab is "sleep".
  await expect(tabs.getByRole("tab").first()).toContainText("sleep");
  await panel.getByRole("button").and(page.getByTestId("new-terminal")).click();
  await expect(tabs.getByRole("tab")).toHaveCount(2);
  const second = tabs.getByRole("tab").nth(1);
  await expect(second).toHaveAttribute("aria-selected", "true");
  await expect(screen(page)).toContainText("alice@open-habitat-lab:");
  await expect(page.locator(".ah-terminal-surface textarea")).toBeFocused();
  // Ctrl+Shift+Enter moves from the terminal to its tab; arrows switch tabs.
  await page.keyboard.press("Control+Shift+Enter");
  await expect(second).toBeFocused();
  const busy = tabs.getByRole("tab").first();
  holdNext = true;
  await page.keyboard.press("ArrowLeft");
  await expect(busy).toHaveAttribute("aria-selected", "true");
  await expect(busy).toBeFocused();
  await expect.poll(() => !!releaseAttachment).toBe(true);
  await expect(panel.getByTestId("terminal-connecting")).toBeVisible();
  releaseAttachment?.();
  await expect(panel.getByTestId("terminal-connecting")).toBeHidden();
  // Let any readiness-scheduled focus run before checking ownership.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(busy).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(second).toHaveAttribute("aria-selected", "true");
  await expect(second).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(busy).toHaveAttribute("aria-selected", "true");
  await expect(busy).toBeFocused();
  // The accessibility tree groups only tabs; close actions stay exposed as
  // separate buttons, while the visual strip keeps them beside each tab.
  await expect(panel.getByRole("tablist")).toHaveAttribute(
    "aria-owns",
    /^\S+ \S+$/,
  );
  await expect(panel.getByRole("tab")).toHaveCount(2);
  await expect(
    panel.getByRole("button").and(page.getByTestId("close-terminal")),
  ).toHaveCount(2);
  expect(
    (await new AxeBuilder({ page }).include(".ah-terminal-dock").analyze())
      .violations,
  ).toEqual([]);
  // Hiding closes the connection, not the shells.
  await page.getByRole("button").and(page.getByTestId("hide-terminal")).click();
  await expect(panel).toBeHidden();
  await expect
    .poll(async () => (await shells(page, id)).map((s) => s.busy))
    .toEqual([true, false]);
  await expect(
    page.getByRole("button").and(page.getByTestId("toggle-terminal")),
  ).toBeVisible();
  // Ctrl+Shift+Enter from the conversation brings the panel back, reattached.
  await page.keyboard.press("Control+Shift+Enter");
  await expect(panel).toBeVisible();
  await expect(screen(page)).toContainText("sleep 300");
  await expect(page.locator(".ah-terminal-surface textarea")).toBeFocused();
  // Ending a busy shell asks first and names what runs in it.
  await tabs
    .getByRole("button")
    .and(page.getByTestId("close-terminal"))
    .first()
    .click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("sleep");
  await confirm
    .getByRole("button")
    .and(page.getByTestId("confirm-close-terminal"))
    .click();
  await expect(tabs.getByRole("tab")).toHaveCount(1);
  await expect.poll(async () => (await shells(page, id)).length).toBe(1);
  // Delete on a focused idle tab closes it without ending the other shell.
  await panel.getByRole("button").and(page.getByTestId("new-terminal")).click();
  await expect(panel.getByRole("tab")).toHaveCount(2);
  await expect(panel.getByRole("tab").nth(1)).toHaveAttribute(
    "data-tab",
    /^s:/,
  );
  await expect(page.locator(".ah-terminal-surface textarea")).toBeFocused();
  await page.keyboard.press("Control+Shift+Enter");
  await expect(panel.getByRole("tab").nth(1)).toBeFocused();
  await page.keyboard.press("Delete");
  await expect(panel.getByRole("tab")).toHaveCount(1);
  await expect.poll(async () => (await shells(page, id)).length).toBe(1);
  // exit ends the last shell; the panel shows the empty state.
  // The remaining shell is reattached once a command makes the round trip;
  // input typed while it connects is not delivered.
  await tabs.getByRole("tab").click();
  await page.keyboard.press("Enter");
  let probe = 0;
  await expect(async () => {
    probe += 1;
    await page.keyboard.type(`echo probe-${probe}$((0))\n`);
    await expect(screen(page)).toContainText(`probe-${probe}0`, {
      timeout: 2000,
    });
  }).toPass({ timeout: 15_000 });
  await page.keyboard.type("exit\n");
  await expect(panel.getByTestId("terminal-empty")).toBeVisible();
  await expect.poll(async () => (await shells(page, id)).length).toBe(0);
});

test("@browser-shell multi-line paste asks first and a selection goes to the composer", async ({
  page,
}) => {
  // xterm chooses its selection modifier from navigator.platform, not the OS
  // running Chromium. Reproduce Jari's macOS Shift-drag against real tmux.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
  });
  await conversation(page);
  await openFirstShell(page);
  const paste = (text: string) =>
    page.locator(".ah-terminal-surface textarea").evaluate((el, value) => {
      const data = new DataTransfer();
      data.setData("text/plain", value);
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, text);
  const bar = page.getByRole("group").and(page.getByTestId("terminal-paste"));
  await paste("echo first-line\necho second-line\necho third-line\n");
  await expect(bar).toHaveAttribute("data-lines", "3");
  await expect(bar).toContainText("echo second-line");
  await bar.getByRole("button").and(page.getByTestId("cancel")).click();
  await expect(bar).toBeHidden();
  await expect(screen(page)).not.toContainText("first-line");
  // A single line goes straight in, as typed.
  await paste("echo single-$((40+2))");
  await expect(bar).toBeHidden();
  await page.keyboard.press("Enter");
  await expect(screen(page)).toContainText("single-42");
  await paste("echo first-$((1+1))\necho second-$((2+2))");
  await bar.getByRole("button").and(page.getByTestId("confirm-paste")).click();
  await expect(page.locator(".ah-terminal-surface textarea")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(screen(page)).toContainText("second-4");
  // Shift+drag selects in xterm even while tmux owns the mouse.
  const outputRows = screen(page).locator(":scope > div");
  const rowIndex = await outputRows.evaluateAll((rows) =>
    rows.findIndex((row) => row.textContent?.startsWith("single-42")),
  );
  expect(rowIndex).toBeGreaterThanOrEqual(0);
  const row = outputRows.nth(rowIndex);
  const box = await row.boundingBox();
  if (!box) throw new Error("no output row");
  const select = async () => {
    await page.keyboard.down("Shift");
    await page.mouse.move(box.x + 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 90, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    // Regression: the selection and its actions must outlast background reads.
    await page.waitForTimeout(2000);
    await expect(page.locator(".xterm-selection div").first()).toBeVisible();
  };
  await select();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button")
    .and(page.getByTestId("copy-selection"))
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "single-42",
  );
  await select();
  await page
    .getByRole("button")
    .and(page.getByTestId("selection-to-composer"))
    .click();
  await expect(
    page.getByRole("textbox").and(page.getByTestId("message-input")),
  ).toHaveValue(/^```\nsingle-42\n```\n$/);
  await expect(
    page.getByRole("textbox").and(page.getByTestId("message-input")),
  ).toBeFocused();
});

test("@browser-shell phone: the panel covers the conversation and the key row types", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await conversation(page);
  const panel = await openFirstShell(page);
  await expect(
    page.getByRole("textbox").and(page.getByTestId("message-input")),
  ).toBeHidden();
  const keys = panel
    .getByRole("toolbar")
    .and(page.getByTestId("terminal-keys"));
  await expect(keys).toBeVisible();
  await page.keyboard.type("sleep 300\n");
  await expect(
    panel.getByRole("img").and(page.getByTestId("terminal-busy")),
  ).toBeVisible();
  // Sticky Ctrl applies to the next key only: Ctrl, then c, interrupts.
  const ctrl = keys
    .getByRole("button")
    .and(page.getByTestId("terminal-key-ctrl"));
  await ctrl.click();
  await expect(ctrl).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.type("c");
  await expect(ctrl).toHaveAttribute("aria-pressed", "false");
  await expect(
    panel.getByRole("img").and(page.getByTestId("terminal-prompt")),
  ).toBeVisible();
  // The keys never take focus from the terminal.
  await keys
    .getByRole("button")
    .and(page.getByTestId("terminal-key-ArrowUp"))
    .click();
  await expect(page.locator(".ah-terminal-surface textarea")).toBeFocused();
  await keys
    .getByRole("button")
    .and(page.getByTestId("terminal-key-Tab"))
    .click();
  await page.keyboard.press("Enter");
  await expect(
    panel.getByRole("img").and(page.getByTestId("terminal-busy")),
  ).toBeVisible();
  await panel
    .getByRole("button")
    .and(page.getByTestId("terminal-back"))
    .click();
  await expect(
    page.getByRole("textbox").and(page.getByTestId("message-input")),
  ).toBeVisible();
});

test("@browser-shell a lost connection dims the terminal until it returns; session end closes it", async ({
  page,
}) => {
  let cut = false;
  const sockets: { close: () => Promise<void> }[] = [];
  await page.routeWebSocket(/\/api\/v1\/workspaces\/terminal\?/, (ws) => {
    if (cut) {
      void ws.close({ code: 1011 });
      return;
    }
    ws.connectToServer();
    sockets.push({ close: () => ws.close({ code: 1011 }) });
  });
  const id = await conversation(page);
  const panel = await openFirstShell(page);
  await page.keyboard.type("echo before-$((3*3))\n");
  await expect(screen(page)).toContainText("before-9");
  cut = true;
  await Promise.all(sockets.map((s) => s.close()));
  await expect(panel.getByTestId("terminal-offline")).toBeVisible();
  await expect(page.locator(".ah-terminal-surface")).toHaveAttribute(
    "data-offline",
    "true",
  );
  // The shell itself never stopped.
  expect((await shells(page, id)).length).toBe(1);
  cut = false;
  await expect(panel.getByTestId("terminal-offline")).toBeHidden({
    timeout: 15_000,
  });
  await page.locator(".ah-terminal-surface").click();
  await page.keyboard.type("echo after-$((4*4))\n");
  await expect(screen(page)).toContainText("after-16");
  // An ended browser session closes the relay; the app asks for sign-in.
  await page.request.get("/fixture/expire");
  await expect(panel).toBeHidden({ timeout: 20_000 });
  await expect(
    page.getByRole("button").and(page.getByTestId("github-sign-in")),
  ).toBeVisible({ timeout: 20_000 });
});

test("@browser-shell a remembered open dock cannot restore an empty panel", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("oh.terminal.open", "1"),
  );
  await conversation(page);
  await expect(
    page.getByRole("region").and(page.getByTestId("terminal-panel")),
  ).toBeHidden();
  await openFirstShell(page);
});

test("@browser-shell a startup refusal belongs in a notice, not an empty dock", async ({
  page,
}) => {
  await page.routeWebSocket(/\/api\/v1\/workspaces\/terminal\?/, (ws) => {
    ws.onMessage(
      () => void ws.close({ code: 4500, reason: "terminal_unavailable" }),
    );
  });
  await conversation(page);
  await page
    .getByRole("button")
    .and(page.getByTestId("toggle-terminal"))
    .click();
  await expect(page.getByRole("status")).toBeVisible();
  await expect(
    page.getByRole("region").and(page.getByTestId("terminal-panel")),
  ).toBeHidden();
});

test("@browser-shell latest action stays above the dock through resize and is hidden when conversation is covered", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await conversation(page);
  await page
    .getByRole("textbox")
    .and(page.getByTestId("message-input"))
    .fill(
      Array.from(
        { length: 50 },
        (_, i) => `Paragraph ${i}: keep this history scrollable.`,
      ).join("\n\n"),
    );
  await page.getByRole("button").and(page.getByTestId("send")).click();
  await expect(page.locator("main")).toContainText("Selvä. Kysyit:", {
    timeout: 30000,
  });
  const panel = await openFirstShell(page);
  const readEarlier = () =>
    page.locator(".ah-conversation-stream").evaluate((node) => {
      node.dispatchEvent(
        new WheelEvent("wheel", { deltaY: -400, bubbles: true }),
      );
      node.scrollTop = 0;
      node.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
  await readEarlier();
  const latest = page.getByRole("button").and(page.getByTestId("jump-latest"));
  await expect(latest).toBeVisible();
  const aboveDock = async () => {
    await expect(async () => {
      const pill = await latest.boundingBox();
      const dock = await panel.boundingBox();
      if (!pill || !dock) throw new Error("missing layout boxes");
      expect(pill.y + pill.height).toBeLessThanOrEqual(dock.y);
    }).toPass();
  };
  await aboveDock();
  await panel
    .getByRole("separator")
    .and(page.getByTestId("resize-terminal"))
    .focus();
  await page.keyboard.press("ArrowUp");
  await aboveDock();
  await panel
    .getByRole("button")
    .and(page.getByTestId("maximize-terminal"))
    .click();
  await expect(latest).toBeHidden();
  await panel
    .getByRole("button")
    .and(page.getByTestId("maximize-terminal"))
    .click();
  // Covering the history can reset its reading position; establish the
  // earlier-reading state again before checking the phone layout.
  await readEarlier();
  await expect(latest).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(latest).toBeHidden();
});

test("@workspace-trash @a11y resolves product blockers and rechecks without deleting", async ({
  page,
}) => {
  const id = await conversation(page);
  await openFirstShell(page);
  const [shell] = await shells(page, id);
  await page
    .getByRole("button")
    .and(page.getByTestId("toggle-terminal"))
    .click();
  await page.goto(`/workspaces/${id}`);
  // Native ancestry and editor group shutdown are checked at the Go boundary.
  // Keep this browser test focused on the real close-shell request, the stop
  // control, and the mandatory fresh check instead of deleting implicitly.
  let terminalClosed = false;
  let staleShellResolved = false;
  let editorStopped = false;
  let checks = 0;
  await page.route("**/api/v1/workspaces", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action !== "delete_check") return route.continue();
    checks++;
    const blockers = [
      ...(!terminalClosed
        ? [
            {
              kind: "process",
              product: "terminal",
              shell: shell.shell,
              pid: 123,
              comm: "bash",
            },
          ]
        : []),
      ...(terminalClosed && !staleShellResolved
        ? [
            {
              kind: "process",
              product: "terminal",
              shell: "999",
              pid: 125,
              comm: "bash",
            },
          ]
        : []),
      ...(!editorStopped
        ? [{ kind: "process", product: "editor", pid: 124, comm: "MainThread" }]
        : []),
    ];
    await route.fulfill({
      json: {
        schema_version: 1,
        state: "checked",
        workspace_id: id,
        observation_token: "synthetic-check-token",
        outcome: blockers.length ? "blocked" : "trash",
        blockers,
        facts: {
          kind: "directory",
          stale_worktrees: 0,
          size_bytes: 0,
          size_complete: true,
        },
      },
    });
  });
  page.on("response", (response) => {
    if (response.url().endsWith("/terminals/close")) {
      if (response.ok()) terminalClosed = true;
      if (response.status() === 404) staleShellResolved = true;
    }
  });
  await page.route("**/api/v1/editor/stop", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["x-agent-host-csrf"]).toBeTruthy();
    editorStopped = true;
    await route.fulfill({
      json: { schema_version: 1, state: "stopped", survives_restart: false },
    });
  });
  await page
    .getByRole("button")
    .and(page.getByTestId("delete-workspace"))
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("close-blocker-terminal")).toBeVisible();
  await expect(dialog.getByTestId("stop-blocker-editor")).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await dialog
    .getByRole("button")
    .and(page.getByTestId("close-blocker-terminal"))
    .click();
  await expect.poll(() => shells(page, id)).toEqual([]);
  await expect.poll(() => checks).toBe(2);
  // This next blocker names a shell that has already ended elsewhere.
  await dialog
    .getByRole("button")
    .and(page.getByTestId("close-blocker-terminal"))
    .click();
  await expect(
    dialog.getByRole("button").and(page.getByTestId("close-blocker-terminal")),
  ).toHaveCount(0);
  await dialog
    .getByRole("button")
    .and(page.getByTestId("stop-blocker-editor"))
    .click();
  await expect(
    dialog.getByRole("button").and(page.getByTestId("trash-workspace")),
  ).toBeVisible();
  expect(checks).toBe(4);
  expect(editorStopped).toBe(true);
});

test("@browser-shell closing the last tab hides the panel and reopening starts a fresh shell", async ({
  page,
}) => {
  const id = await conversation(page);
  const panel = await openFirstShell(page);
  await page.keyboard.type(
    "export LAST_CLOSE_MARKER=old; echo marked-$((1+1))\n",
  );
  await expect(screen(page)).toContainText("marked-2");
  await panel
    .getByRole("button")
    .and(page.getByTestId("close-terminal"))
    .click();
  await expect(panel).toBeHidden();
  await expect.poll(() => shells(page, id)).toEqual([]);
  expect(
    await page.getByRole("status").and(page.getByTestId("toast")).count(),
  ).toBe(0);
  await openFirstShell(page);
  expect(await shells(page, id)).toHaveLength(1);
  await page.keyboard.type(
    "echo fresh-$(printenv LAST_CLOSE_MARKER)-$((6*7))\n",
  );
  await expect(screen(page)).toContainText("fresh--42");
});
