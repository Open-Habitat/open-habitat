import AxeBuilder from "@axe-core/playwright";
import { workerHostPort } from "../test-ports.mjs";
import { createHostTest, expect, type Page } from "./worker-host";

// The workspace editor (Rinnakkain) against the real gateway and daemon
// handlers, with the app and the editor on two same-site host names and a
// stand-in code-server (test/browser-host/editor.go) behind the daemon relay.
// Real code-server and the other engines are exercised separately; see the
// issue's result.
const test = createHostTest(false, { BROWSER_HOST_EDITOR: "1" });
const app = `https://app.oh.localhost:${workerHostPort(Number(process.env.TEST_PARALLEL_INDEX ?? 0))}`;
test.use({
  baseURL: app,
  // Keep production editor origins portless; Chromium maps their TLS traffic
  // to this worker's isolated listener without changing the browser's Host.
  launchOptions: {
    args: [
      `--host-resolver-rules=MAP *.oh.localhost:443 127.0.0.1:${workerHostPort(Number(process.env.TEST_PARALLEL_INDEX ?? 0))}`,
    ],
  },
  ignoreHTTPSErrors: true,
  viewport: { width: 1366, height: 768 },
});

const editorFrame = (page: Page) =>
  page
    .frameLocator('iframe[data-testid="workspace-editor"]')
    .frameLocator("#editor");

async function conversationWithFileLink(
  page: Page,
  prompt = "Missä tiedosto on?",
  phone = false,
) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  // These cases retain coverage of the separate-origin VS Code adapter.
  const session = await (await page.request.get("/auth/session")).json();
  const preference = await page.request.put(
    "/api/v1/account/editor-preference",
    {
      headers: {
        Origin: new URL(page.url()).origin,
        "X-Agent-Host-CSRF": session.csrf,
      },
      data: { engine: "vscode" },
    },
  );
  expect(preference.status()).toBe(200);
  await page.reload();
  await page
    .getByRole(phone ? "region" : "navigation")
    .filter(phone ? { has: page.getByTestId("workspace-git-project") } : {})
    .getByRole("link")
    .and(page.getByTestId("workspace-git-project"))
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("conversation-start"))
    .click();
  await page
    .getByRole("textbox")
    .and(page.getByTestId("message-input"))
    .fill(prompt);
  await page.getByRole("button").and(page.getByTestId("send")).click();
  await expect(
    page.getByRole("link").and(page.locator('a[href="#cmd%2Fmain.go%3A3-4"]')),
  ).toBeVisible({
    timeout: 20_000,
  });
}

const columnWidth = (page: Page) =>
  page
    .locator("#ah-editor-conversation")
    .evaluate((el) => Math.round(el.getBoundingClientRect().width));

test("@workspace-editor @a11y opens beside the conversation with a remembered divider and a strip", async ({
  page,
}) => {
  await conversationWithFileLink(page);
  const header = page.locator(".ah-agent-header");
  await header
    .getByRole("button")
    .and(page.getByTestId("toggle-editor"))
    .click();
  // The editor runs behind the gateway and daemon relays, WebSocket included.
  await expect(
    editorFrame(page).getByRole("heading", { level: 1 }),
  ).toBeVisible();
  await expect(editorFrame(page).locator("#socket")).toContainText(
    "yhteys: pong",
  );
  await expect(editorFrame(page).locator("body")).toContainText("git-project");
  // The app sidebar steps aside; the column defaults to 440 px on a laptop.
  await expect(page.getByRole("navigation")).toBeHidden();
  expect(await columnWidth(page)).toBe(440);
  // The app's own controls around the editor; VS Code's frame is its own.
  expect(
    (await new AxeBuilder({ page }).exclude("iframe").analyze()).violations,
  ).toEqual([]);
  const divider = page
    .getByRole("separator")
    .and(page.getByTestId("resize-editor"));
  await divider.focus();
  await page.keyboard.press("ArrowLeft");
  expect(await columnWidth(page)).toBe(472);
  // A drag over the frame still reaches the divider.
  const box = await divider.boundingBox();
  if (!box) throw new Error("divider not laid out");
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(x - 80, box.y + 200, { steps: 4 });
  await page.mouse.move(x - 100, box.y + 220, { steps: 4 });
  await page.mouse.up();
  expect(await columnWidth(page)).toBe(572);
  // Enter hides the conversation into a strip; the strip brings it back.
  await divider.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#ah-editor-conversation")).toBeHidden();
  const strip = page
    .getByRole("button")
    .and(page.getByTestId("show-conversation"));
  await expect(strip).toBeVisible();
  await strip.click();
  await expect(
    page.getByRole("textbox").and(page.getByTestId("message-input")),
  ).toBeFocused();
  // The width is this browser's preference and survives a reload.
  await page.reload();
  await page
    .locator(".ah-agent-header")
    .getByRole("button")
    .and(page.getByTestId("toggle-editor"))
    .click();
  expect(await columnWidth(page)).toBe(572);
  await page.getByRole("button").and(page.getByTestId("toggle-editor")).click();
  await expect(page.getByRole("navigation")).toBeVisible();
});

test("@workspace-editor file links open path:line and Ctrl+Alt+K moves between editor and conversation", async ({
  page,
}) => {
  // Synthetic Pi echoes the prompt in its reply, exercising native history.
  await conversationWithFileLink(
    page,
    "Missä tiedosto on? cmd/main.go:3 ja [Entry point](cmd/main.go#L4).",
  );
  const link = page
    .getByRole("link")
    .and(page.locator('a[href="#cmd%2Fmain.go%3A3-4"]'));
  await link.click();
  await expect(editorFrame(page).locator("main")).toContainText("main.go:3-4");
  await expect(link).toHaveClass(/ah-file-link-opened/);
  const reply = page.locator(".ah-markdown").filter({ has: link });
  await reply
    .getByRole("link")
    .and(page.locator('a[href$="cmd%2Fmain.go%3A3"]'))
    .click();
  await expect(editorFrame(page).locator("#opened")).toHaveText("main.go:3");
  await reply
    .getByRole("link")
    .and(page.locator('a[href$="cmd%2Fmain.go%23L4"]'))
    .click();
  await expect(editorFrame(page).locator("#opened")).toHaveText("main.go:4");
  await link.click();
  // A name that is not a file in the workspace says so, and opens nothing.
  await page
    .getByRole("link")
    .and(page.locator('a[href="#cmd%2Fold.go"]'))
    .click();
  await expect(page.getByTestId("editor-problem")).toBeVisible();
  await expect(editorFrame(page).locator("main")).toContainText("main.go:3-4");

  const composer = page
    .getByRole("textbox")
    .and(page.getByTestId("message-input"));
  // Inside the editor the frame keeps its keys; the app still hears this one.
  const text = editorFrame(page).getByRole("textbox");
  await text.fill("one two three");
  await text.evaluate((node: HTMLTextAreaElement) => {
    node.focus();
    node.setSelectionRange(4, 7);
    node.scrollTop = 10;
  });
  await page.keyboard.press("Control+Alt+KeyK");
  await expect(composer).toBeFocused();
  await page.keyboard.press("Control+Alt+KeyK");
  await expect(
    page.locator('iframe[data-testid="workspace-editor"]'),
  ).toBeFocused();
  await expect(text).toBeFocused();
  await expect(text).toHaveJSProperty("selectionStart", 4);
  await expect(text).toHaveJSProperty("selectionEnd", 7);
  await page.keyboard.type("TWO");
  await expect(text).toHaveValue("one TWO three");
  // A hidden conversation comes back first.
  await page
    .getByRole("button")
    .and(page.getByTestId("hide-conversation"))
    .click();
  await editorFrame(page).getByRole("textbox").click();
  await page.keyboard.press("Control+Alt+KeyK");
  await expect(composer).toBeFocused();
});

test("@workspace-editor a reply that ends while the conversation is hidden marks the strip", async ({
  page,
}) => {
  await conversationWithFileLink(page);
  await page
    .locator(".ah-agent-header")
    .getByRole("button")
    .and(page.getByTestId("toggle-editor"))
    .click();
  await expect(editorFrame(page).locator("#socket")).toContainText(
    "yhteys: pong",
  );
  await page
    .getByRole("textbox")
    .and(page.getByTestId("message-input"))
    .fill("Toinen tiedosto");
  await page.getByRole("button").and(page.getByTestId("send")).click();
  await page
    .getByRole("button")
    .and(page.getByTestId("hide-conversation"))
    .click();
  await expect(
    page.getByRole("button").and(page.getByTestId("show-conversation")),
  ).toBeVisible({ timeout: 20_000 });
});

for (const width of [1366, 390]) {
  for (const theme of ["light", "dark"]) {
    test(`@workspace-editor @a11y local header, both return paths and draft retention at ${width} ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await conversationWithFileLink(page, "Missä tiedosto on?", width === 390);
      await page.locator("html").evaluate((el, value) => {
        el.dataset.theme = value;
      }, theme);
      const composer = page
        .getByRole("textbox")
        .and(page.getByTestId("message-input"));
      const draft = "Säilytä tämä luonnos.";
      await composer.fill(draft);
      const toggle = page
        .getByRole("button")
        .and(page.getByTestId("toggle-editor"));
      await toggle.focus();
      await page.keyboard.press("Enter");
      if (width === 390)
        await expect(page.getByTestId("browser-editor")).toBeVisible();
      else
        await expect(
          editorFrame(page).getByRole("heading", { level: 1 }),
        ).toBeVisible();
      const local = page.getByTestId("editor-header");
      await expect(local).toBeVisible();
      await expect(
        page.locator(".ah-agent-header").getByTestId("hide-conversation"),
      ).toHaveCount(0);
      const editor = await page.locator(".ah-editor-pane").boundingBox();
      const conversation = await page
        .locator("#ah-editor-conversation")
        .boundingBox();
      if (!editor || !conversation) throw new Error("Panes missing");
      if (width === 390)
        expect(editor.y + editor.height).toBeLessThanOrEqual(
          conversation.y + 1,
        );
      else
        expect(editor.x + editor.width).toBeLessThanOrEqual(conversation.x + 1);
      const size = local
        .getByRole("button")
        .and(page.getByTestId("hide-conversation"));
      await size.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("#ah-editor-conversation")).toBeHidden();
      await expect(size).toBeVisible();
      await expect(local.getByTestId("close-editor")).toBeVisible();
      await expect(size).toHaveAttribute("aria-pressed", "true");
      expect(
        (await new AxeBuilder({ page }).exclude("iframe").analyze()).violations,
      ).toEqual([]);
      await page.keyboard.press("Enter");
      await expect(composer).toBeFocused();
      await expect(composer).toHaveValue(draft);
      await size.click();
      await page
        .getByRole("button")
        .and(page.getByTestId("show-conversation"))
        .click();
      await expect(composer).toBeFocused();
      await expect(composer).toHaveValue(draft);
      // Close directly from full-window, then reopen the same editor frame.
      await size.click();
      const frame =
        width === 390
          ? null
          : await page.getByTestId("workspace-editor").elementHandle();
      await local.getByTestId("close-editor").click();
      await expect(composer).toBeFocused();
      await expect(composer).toHaveValue(draft);
      await toggle.click();
      await expect(page.locator("#ah-editor-conversation")).toBeVisible();
      if (width !== 390)
        expect(
          await frame?.evaluate(
            (el) =>
              el === document.querySelector('[data-testid="workspace-editor"]'),
          ),
        ).toBe(true);
      await expect(composer).toHaveValue(draft);
      await composer.scrollIntoViewIfNeeded();
      await expect(page.getByTestId("send")).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).exclude("iframe").analyze()).violations,
      ).toEqual([]);
    });
  }
}

test("@workspace-editor leftover editor document cannot inherit the next person's session", async ({
  page,
  context,
}) => {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect
    .poll(async () => (await page.request.get("/auth/session")).status())
    .toBe(200);
  const mint = async () => {
    const { csrf } = await (await page.request.get("/auth/session")).json();
    const res = await page.request.post("/auth/editor", {
      headers: { Origin: app, "X-Agent-Host-CSRF": csrf },
    });
    expect(res.status()).toBe(200);
    return res.json() as Promise<{ token: string; origin: string }>;
  };
  const alice = await mint();
  const leftover = await context.newPage();
  await leftover.goto(`${alice.origin}/_open-habitat/frame`);
  const redeem = async (tab: Page, token: string) =>
    tab.evaluate(
      async (token) =>
        (
          await fetch("/_open-habitat/handoff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          })
        ).status,
      token,
    );
  expect(await redeem(leftover, alice.token)).toBe(204);
  // A daemon response has no bridge connect-src policy: test the origin
  // boundary itself, not a restriction that only our bridge page carries.
  await leftover.goto(`${alice.origin}/fake-opened`);
  const { csrf } = await (await page.request.get("/auth/session")).json();
  expect(
    (
      await page.request.post("/auth/logout", {
        headers: { Origin: app, "X-Agent-Host-CSRF": csrf },
      })
    ).status(),
  ).toBe(204);
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=43"]')).click();
  const bob = await mint();
  expect(bob.origin).not.toBe(alice.origin);
  const editor = await context.newPage();
  await editor.goto(`${bob.origin}/_open-habitat/frame`);
  expect(await redeem(editor, bob.token)).toBe(204);
  expect(
    await editor.evaluate(
      async () => (await fetch("/_open-habitat/session")).status,
    ),
  ).toBe(204);
  expect(
    await leftover.evaluate(
      async () => (await fetch("/_open-habitat/session")).status,
    ),
  ).toBe(401);
  // Same-site cookies may accompany this cross-origin request, but A's
  // document cannot read B's authenticated response (browser SOP/CORS).
  expect(
    await leftover.evaluate(async (origin) => {
      try {
        await fetch(`${origin}/_open-habitat/session`, {
          credentials: "include",
        });
        return "readable";
      } catch {
        return "blocked";
      }
    }, bob.origin),
  ).toBe("blocked");
});

test("@workspace-editor refusing compact transition prompts once per breakpoint crossing", async ({
  page,
}) => {
  await conversationWithFileLink(page);
  await page.getByTestId("toggle-editor").click();
  await expect(
    editorFrame(page).getByRole("heading", { level: 1 }),
  ).toBeVisible();
  let dialogs = 0;
  page.on("dialog", async (dialog) => {
    dialogs++;
    await dialog.dismiss();
  });
  await page.setViewportSize({ width: 799, height: 844 });
  await expect.poll(() => dialogs).toBe(1);
  await page.setViewportSize({ width: 780, height: 844 });
  await page.setViewportSize({ width: 770, height: 844 });
  await expect(page.getByTestId("workspace-editor")).toBeVisible();
  expect(dialogs).toBe(1);
  await page.setViewportSize({ width: 1000, height: 844 });
  // Resize events can coalesce if both sizes happen before a rendering step.
  // A wide frame is the actual breakpoint crossing, not merely a CDP setting.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
  await page.setViewportSize({ width: 790, height: 844 });
  await expect.poll(() => dialogs).toBe(2);
});
