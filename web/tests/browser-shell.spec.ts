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
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const workspace = snapshot.workspaces.find(
    (w: { name: string }) => w.name === "ordinary-dir",
  );
  await page.goto(`/workspaces/${workspace.workspace_id}`);
  await page
    .getByRole("button", { name: "Aloita uusi Pi-keskustelu", exact: true })
    .click();
  await expect(page).toHaveURL(/conversation=pi:/);
  return workspace.workspace_id as string;
}

const screen = (page: Page) => page.locator(".ah-terminal-surface .xterm-rows");

async function openFirstShell(page: Page) {
  await page.getByRole("button", { name: /^Pääte/ }).click();
  const panel = page.getByRole("region", { name: "Päätepaneeli" });
  // One gesture, including the first ever open: no empty panel or warning.
  await expect(
    page.getByRole("dialog", { name: "Avataanko pääte?" }),
  ).toHaveCount(0);
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
  const composer = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await composer.fill("Do not send this draft");
  const panel = page.getByRole("region", { name: "Päätepaneeli" });
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
  // Finnish/Nordic Return is the same non-printing physical key as US Enter.
  await composer.dispatchEvent("keydown", {
    key: "Enter",
    code: "Enter",
    ctrlKey: true,
    shiftKey: true,
  });
  await expect(screen(page)).toContainText("alice@open-habitat-lab:");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(composer).toHaveValue("Do not send this draft");
  await expect(page.locator(".ah-terminal-surface textarea")).toBeFocused();
  // Actual browser key events must work from inside xterm as well.
  await page.keyboard.press("Control+Shift+Enter");
  await expect(panel.getByRole("tab")).toBeFocused();
  await page.keyboard.press("Control+Shift+Enter");
  await expect(page.locator(".ah-terminal-surface textarea")).toBeFocused();
  await page.getByRole("button", { name: "Pääte (1)", exact: true }).click();
  await page.keyboard.press("Control+Shift+Enter");
  await expect(screen(page)).toContainText("alice@open-habitat-lab:");
  expect(await shells(page, id)).toHaveLength(1);
  expect(
    (
      await new AxeBuilder({ page })
        .include(".ah-terminal-dock")
        // Existing tablist/close-button semantics tracked separately as
        // wildly-difficult-fairies. Focus traversal is asserted above.
        .exclude(".ah-terminal-tabs")
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("@browser-shell tabs, Ctrl+Shift+Enter and hiding keep shells running in tmux", async ({
  page,
}) => {
  const id = await conversation(page);
  const panel = await openFirstShell(page);
  await expect(screen(page)).toContainText("~/src/ordinary-dir");
  // Typing reaches bash in the workspace directory.
  await page.keyboard.type("sleep 300\n");
  const tabs = panel.getByRole("tablist");
  await expect(tabs.getByRole("img", { name: "Ajossa: sleep" })).toBeVisible();
  // tmux names a window after what runs in it: the busy tab is "sleep".
  await expect(tabs.getByRole("tab", { name: /sleep/ })).toBeVisible();
  await panel.getByRole("button", { name: /^Uusi pääte työtilaan/ }).click();
  await expect(tabs.getByRole("tab")).toHaveCount(2);
  const second = tabs.getByRole("tab").nth(1);
  await expect(second).toHaveAttribute("aria-selected", "true");
  await expect(screen(page)).toContainText("alice@open-habitat-lab:");
  // Ctrl+Shift+Enter moves from the terminal to its tab; arrows switch tabs.
  await page.keyboard.press("Control+Shift+Enter");
  await expect(second).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(tabs.getByRole("tab", { name: /Ajossa/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  // Hiding closes the connection, not the shells.
  await page
    .getByRole("button", { name: "Piilota paneeli (päätteet jatkavat)" })
    .click();
  await expect(panel).toBeHidden();
  await expect
    .poll(async () => (await shells(page, id)).map((s) => s.busy))
    .toEqual([true, false]);
  await expect(page.getByRole("button", { name: "Pääte (2)" })).toBeVisible();
  // Ctrl+Shift+Enter from the conversation brings the panel back, reattached.
  await page.keyboard.press("Control+Shift+Enter");
  await expect(panel).toBeVisible();
  await expect(screen(page)).toContainText("sleep 300");
  // Ending a busy shell asks first and names what runs in it.
  await tabs.getByRole("button", { name: "Lopeta sleep", exact: true }).click();
  const confirm = page.getByRole("alertdialog", {
    name: "Lopetetaanko sleep?",
  });
  await expect(confirm).toContainText("sleep");
  await confirm.getByRole("button", { name: "Lopeta pääte" }).click();
  await expect(tabs.getByRole("tab")).toHaveCount(1);
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
  await expect(panel.getByText(/ei ole päätettä/)).toBeVisible();
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
  const bar = page.getByRole("group", { name: "Monirivinen liitos" });
  await paste("echo first-line\necho second-line\necho third-line\n");
  await expect(bar).toContainText("Liitetäänkö 3 riviä?");
  await expect(bar).toContainText("echo second-line");
  await bar.getByRole("button", { name: "Peruuta" }).click();
  await expect(bar).toBeHidden();
  await expect(screen(page)).not.toContainText("first-line");
  // A single line goes straight in, as typed.
  await paste("echo single-$((40+2))");
  await expect(bar).toBeHidden();
  await page.keyboard.press("Enter");
  await expect(screen(page)).toContainText("single-42");
  await paste("echo first-$((1+1))\necho second-$((2+2))");
  await bar.getByRole("button", { name: "Liitä", exact: true }).click();
  await expect(page.locator(".ah-terminal-surface textarea")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(screen(page)).toContainText("second-4");
  // Shift+drag selects in xterm even while tmux owns the mouse.
  const row = screen(page)
    .locator("div", { hasText: /^single-42/ })
    .first();
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
  await page.getByRole("button", { name: "Kopioi", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "single-42",
  );
  await select();
  await page.getByRole("button", { name: "Vie keskusteluun" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveValue(/^```\nsingle-42\n```\n$/);
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeFocused();
});

test("@browser-shell phone: the panel covers the conversation and the key row types", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await conversation(page);
  const panel = await openFirstShell(page);
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeHidden();
  const keys = panel.getByRole("toolbar", { name: "Päätteen näppäimet" });
  await expect(keys).toBeVisible();
  await page.keyboard.type("sleep 300\n");
  await expect(panel.getByRole("img", { name: "Ajossa: sleep" })).toBeVisible();
  // Sticky Ctrl applies to the next key only: Ctrl, then c, interrupts.
  const ctrl = keys.getByRole("button", { name: "Ctrl" });
  await ctrl.click();
  await expect(ctrl).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.type("c");
  await expect(ctrl).toHaveAttribute("aria-pressed", "false");
  await expect(panel.getByRole("img", { name: "Kehotteessa" })).toBeVisible();
  // The keys never take focus from the terminal.
  await keys.getByRole("button", { name: "Ylös" }).click();
  await expect(page.locator(".ah-terminal-surface textarea")).toBeFocused();
  await keys.getByRole("button", { name: "Tab" }).click();
  await page.keyboard.press("Enter");
  await expect(panel.getByRole("img", { name: "Ajossa: sleep" })).toBeVisible();
  await panel.getByRole("button", { name: "Takaisin keskusteluun" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
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
  await expect(panel.getByText("Vain luku, kunnes yhteys palaa")).toBeVisible();
  await expect(page.locator(".ah-terminal-surface")).toHaveAttribute(
    "data-offline",
    "true",
  );
  // The shell itself never stopped.
  expect((await shells(page, id)).length).toBe(1);
  cut = false;
  await expect(panel.getByText("Vain luku, kunnes yhteys palaa")).toBeHidden({
    timeout: 15_000,
  });
  await page.locator(".ah-terminal-surface").click();
  await page.keyboard.type("echo after-$((4*4))\n");
  await expect(screen(page)).toContainText("after-16");
  // An ended browser session closes the relay; the app asks for sign-in.
  await page.request.get("/fixture/expire");
  await expect(panel).toBeHidden({ timeout: 20_000 });
  await expect(
    page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
  ).toBeVisible({ timeout: 20_000 });
});
