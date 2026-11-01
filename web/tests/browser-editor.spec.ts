import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1366, height: 844 },
});
async function login(page: Page) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(
    page.getByTestId("workspace-git-project").filter({ visible: true }).first(),
  ).toBeVisible();
}
async function openFile(page: Page, phone: boolean) {
  await login(page);
  expect(
    await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((entry) => /CodeMirrorEditor/.test(entry.name)),
    ),
  ).toBe(false);
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
  // Creation exposes an optimistic composer too. Wait for the native route
  // before typing so its replacement cannot race this editor-only setup.
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  await expect(page.getByTestId("message-input")).toBeEnabled();
  await page.getByTestId("message-input").fill("Näytä tiedosto");
  await page.getByTestId("send").click();
  const link = page
    .getByRole("link")
    .and(page.locator('a[href="#cmd%2Fmain.go%3A3-4"]'));
  await expect(link).toBeVisible({ timeout: 20000 });
  await link.click();
  await expect(page.getByTestId("editor-document")).toBeVisible();
  await expect(page.getByTestId("editor-document")).toContainText(
    'println("hei")',
  );
  const resources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => entry.name),
  );
  expect(resources.some((name) => name.includes("CodeMirrorEditor"))).toBe(
    true,
  );
}
async function edit(page: Page, content: string) {
  const input = page.getByTestId("editor-document");
  await input.fill(content);
}
for (const engine of ["codemirror6"])
  for (const width of [1366, 390])
    for (const theme of ["light", "dark"]) {
      test(`@browser-editor @a11y default text editor ${engine}, explicit save and dirty transitions ${width} ${theme}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        const grants: string[] = [];
        page.on("request", (r) => {
          if (
            r.url().includes("/auth/editor") ||
            r.url().includes("/api/v1/editor")
          )
            grants.push(r.url());
        });
        await openFile(page, width === 390);
        await page.locator("html").evaluate((el, value) => {
          el.dataset.theme = value;
        }, theme);
        await expect(page.locator("iframe")).toHaveCount(0);
        expect(grants).toEqual([]);
        const doc = page.getByTestId("editor-document");
        await edit(page, "synthetic edit\nsecond line\n");
        await expect(page.getByTestId("editor-save")).toBeEnabled();
        const picker = page.getByTestId("editor-file-picker");
        if (!(await picker.isVisible()))
          await page.getByTestId("editor-picker").click();
        const file = page
          .getByTestId("editor-file-entry")
          .and(page.locator('[data-path="cmd/main.go"]'));
        await expect(file).toHaveAttribute("aria-current", "page");
        await expect(file.getByTestId("editor-file-state")).toBeVisible();
        const folder = page
          .getByTestId("editor-file-entry")
          .and(page.locator('[data-path="cmd"]'));
        await folder.focus();
        await folder.press("ArrowRight");
        await expect(file).toBeFocused();
        // Focus navigation is not opening/replacing the dirty document.
        await expect(doc).toContainText("synthetic edit");
        await file.press("ArrowLeft");
        await expect(folder).toBeFocused();
        await folder.press("ArrowLeft");
        await expect(file).toHaveCount(0);
        const filter = page.getByTestId("editor-file-filter");
        const reads: string[] = [];
        const noteRead = (request: import("@playwright/test").Request) => {
          if (request.url().includes("/editor/list")) reads.push(request.url());
        };
        page.on("request", noteRead);
        await filter.fill("cmd/main.go");
        await expect(file).toBeVisible();
        await filter.fill("nonexistent-loaded-name");
        await expect(page.getByTestId("editor-file-entry")).toHaveCount(0);
        await filter.clear();
        await expect(file).toHaveCount(0);
        expect(reads).toEqual([]);
        page.off("request", noteRead);
        await folder.click();
        await expect(file).toBeVisible();
        expect(
          (
            await new AxeBuilder({ page })
              .include('[data-testid="browser-editor"]')
              .analyze()
          ).violations,
        ).toEqual([]);
        await picker.getByRole("button").first().click();
        await expect(page.getByTestId("editor-picker")).toBeFocused();
        await expect(picker).toBeHidden();
        await page.getByTestId("editor-picker").click();
        await expect(file).toBeVisible();
        if (width === 390) await picker.getByRole("button").first().click();
        page.once("dialog", (d) => d.dismiss());
        await page.getByTestId("close-editor").click();
        await expect(doc).toBeVisible();
        await page.getByTestId("editor-save").click();
        await expect(page.getByTestId("editor-dirty")).toBeEmpty();
        // A native change through the same confined API makes the local token stale.
        const session = await (await page.request.get("/auth/session")).json();
        const snapshot = await (
          await page.request.get("/api/v1/snapshot")
        ).json();
        const workspace = snapshot.workspaces.find(
          (w: { name: string }) => w.name === "git-project",
        ).workspace_id;
        const url = `/api/v1/workspaces/editor/file?${new URLSearchParams({ workspace_id: workspace, path: "cmd/main.go" })}`;
        const remote = await (await page.request.get(url)).json();
        expect(remote.content).toBe("synthetic edit\nsecond line\n");
        const saved = await page.request.put("/api/v1/workspaces/editor/file", {
          headers: { Origin: hostOrigin, "X-Agent-Host-CSRF": session.csrf },
          data: {
            workspace_id: workspace,
            path: "cmd/main.go",
            base_version: remote.version,
            content: "external\n",
            bom: remote.bom,
            newline: remote.newline,
          },
        });
        expect(saved.status()).toBe(200);
        await edit(page, "reconciled local\n");
        let writes = 0;
        page.on("request", (request) => {
          if (
            request.method() === "PUT" &&
            request.url().includes("/editor/file")
          )
            writes++;
        });
        // Save reads the file first: a change that is not the agent's is
        // brought in neutrally, and lines both changed wait for a choice.
        await page.getByTestId("editor-save").click();
        await expect(page.getByTestId("conflict")).toHaveCount(1);
        await expect(page.getByTestId("editor-changes")).toHaveAttribute(
          "data-source",
          "disk",
        );
        await expect(page.getByTestId("editor-save")).toBeDisabled();
        await expect(page.getByTestId("editor-save-reason")).toBeVisible();
        await doc.press("ControlOrMeta+s");
        expect(writes).toBe(0);
        expect((await (await page.request.get(url)).json()).content).toBe(
          "external\n",
        );
        await page.getByTestId("pick-mine").click();
        await expect(page.getByTestId("conflict")).toHaveCount(0);
        await expect(doc).toContainText("reconciled local");
        await page.getByTestId("editor-save").click();
        await expect(page.getByTestId("editor-dirty")).toBeEmpty();
        expect(writes).toBe(1);
        expect((await (await page.request.get(url)).json()).content).toBe(
          "reconciled local\n",
        );
        await expect(page.getByTestId("replace-note")).toHaveCount(0);
        await page.getByTestId("hide-conversation").click();
        await expect(page.locator("#ah-editor-conversation")).toBeHidden();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        await page.getByTestId("show-conversation").click();
        await expect(page.getByTestId("message-input")).toBeFocused();
        await page.getByTestId("close-editor").click();
        await expect(page.getByTestId("browser-editor")).toHaveCount(0);
        expect(grants).toEqual([]);
      });
    }

test("@browser-editor @a11y editor preference follows a person across browsers and compact settings edit desktop without loading an engine", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto("/settings/editor");
  await expect(page.getByTestId("segment-codemirror6")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("segment-vscode")).toBeEnabled();
  await page.getByTestId("segment-vscode").focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("segment-vscode")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const other = await browser.newContext({
    baseURL: hostOrigin,
    ignoreHTTPSErrors: true,
  });
  try {
    const second = await other.newPage();
    await login(second);
    await second.goto("/settings/editor");
    await expect(second.getByTestId("segment-vscode")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      await second.evaluate(() =>
        Object.keys(localStorage).filter((key) =>
          key.startsWith("nah:editor:"),
        ),
      ),
    ).toEqual([]);
  } finally {
    await other.close();
  }
  expect(
    await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((entry) => /CodeMirrorEditor|VSCodeEditor/.test(entry.name)),
    ),
  ).toBe(false);
  await page.reload();
  await expect(page.getByTestId("segment-vscode")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("segment-vscode")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("segment-vscode")).toBeEnabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByTestId("segment-codemirror6").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("segment-codemirror6")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByTestId("segment-vscode").click();
  await expect(page.getByTestId("segment-vscode")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.setViewportSize({ width: 1366, height: 844 });
  await expect(page.getByTestId("segment-vscode")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const session = await (await page.request.get("/auth/session")).json();
  await page.request.post("/auth/logout", {
    headers: { Origin: hostOrigin, "X-Agent-Host-CSRF": session.csrf },
  });
  await page.goto("/");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=43"]').click();
  await page.goto("/settings/editor");
  await expect(page.getByTestId("segment-codemirror6")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

for (const engine of ["codemirror6"])
  test(`@browser-editor ${engine} identity replacement drops dirty buffers and ignores delayed old-user reads`, async ({
    page,
    context,
    browser,
  }) => {
    await openFile(page, false);
    await edit(page, "old identity private buffer");
    const oldURL = page.url();
    const rejected = page
      .waitForEvent("dialog")
      .then((dialog) => dialog.dismiss());
    await page.evaluate(() => history.back());
    await rejected;
    await expect(page).toHaveURL(oldURL);
    await expect(page.getByTestId("editor-document")).toContainText(
      "old identity private buffer",
    );
    const other = await browser.newContext({
      baseURL: hostOrigin,
      ignoreHTTPSErrors: true,
    });
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let observed!: () => void;
    const seen = new Promise<void>((resolve) => {
      observed = resolve;
    });
    try {
      const bob = await other.newPage();
      await bob.goto("/workspaces");
      await bob.getByTestId("github-sign-in").click();
      await bob.locator('a[href*="code=43"]').click();
      await expect(bob.getByTestId("account-menu-trigger")).toBeVisible();
      await page.route("**/api/v1/workspaces/editor/file?**", async (route) => {
        const response = await route.fetch();
        observed();
        await held;
        await route.fulfill({ response }).catch(() => {});
      });
      page.once("dialog", (dialog) => dialog.accept());
      await page.locator('a[href="#cmd%2Fmain.go%3A3-4"]').click();
      await seen;
      await context.addCookies(await other.cookies());
      await page
        .getByTestId("workspace-navigation")
        .getByTestId("navigation-open")
        .click();
      await page.getByTestId("snapshot-refresh").click();
      await expect(page.getByTestId("editor-document")).toHaveCount(0);
      release();
      await expect(page.getByTestId("editor-document")).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText(
        "old identity private buffer",
      );
    } finally {
      release();
      await other.close();
    }
  });

test("@browser-editor the account menu stays reachable beside an open editor", async ({
  page,
}) => {
  await openFile(page, false);
  // The rail narrows to its strip instead of stepping aside: the account
  // menu was unreachable while the editor was open.
  const account = page
    .getByRole("button")
    .and(page.getByTestId("account-menu-trigger"));
  await expect(account).toBeInViewport();
  await account.click();
  await page
    .getByRole("menuitem")
    .and(page.getByTestId("menu-settings"))
    .click();
  await expect(page).toHaveURL(/\/settings/);
  await page
    .getByRole("button")
    .and(page.getByTestId("settings-close"))
    .click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  await expect(account).toBeFocused();
});

test("@browser-editor a transient failed refresh preserves the live dirty document", async ({
  page,
}) => {
  await openFile(page, false);
  const doc = page.getByTestId("editor-document");
  await doc.fill("buffer survives connection loss");
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"schema_version":1,"error":{"code":"daemon_unavailable"}}',
    }),
  );
  const failed = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/snapshot") && response.status() === 503,
  );
  await page
    .getByTestId("workspace-navigation")
    .getByTestId("navigation-open")
    .click();
  await page.getByTestId("snapshot-refresh").click();
  await failed;
  await expect(doc).toContainText("buffer survives connection loss");
  await expect(page.getByTestId("editor-save")).toBeEnabled();
  await page.unroute("**/api/v1/snapshot");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(doc).toContainText("buffer survives connection loss");
});

test("@browser-editor a vanished workspace observation cannot discard a dirty document", async ({
  page,
}) => {
  await openFile(page, false);
  const doc = page.getByTestId("editor-document");
  await doc.fill("retain this unsaved resource");
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const value = await response.json();
    const workspace = value.workspaces.find(
      (w: { name: string }) => w.name === "git-project",
    );
    workspace.presence = "absent";
    await route.fulfill({ response, json: value });
  });
  let dialogs = 0;
  page.on("dialog", (dialog) => {
    dialogs++;
    void dialog.dismiss();
  });
  await page
    .getByTestId("workspace-navigation")
    .getByTestId("navigation-open")
    .click();
  await page.getByTestId("snapshot-refresh").click();
  await expect(page.getByTestId("editor-workspace-changed")).toBeVisible();
  expect(dialogs).toBe(0);
  await expect(doc).toContainText("retain this unsaved resource");
  await expect(page.getByTestId("editor-save")).toBeEnabled();
});

test("@browser-editor observed worktree history opens files under its place, not the parent checkout", async ({
  page,
}) => {
  await openFile(page, false);
  const agentId = new URL(page.url()).searchParams.get("conversation");
  const workspaceId = new URL(page.url()).pathname.split("/").at(-1);
  const base = await (
    await page.request.get(
      `/api/v1/workspaces/editor/file?workspace_id=${workspaceId}&path=cmd%2Fmain.go`,
    )
  ).json();
  const placeId = "ws_observed_place_12345678";
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const value = await response.json();
    const agent = value.agents.find(
      (a: { agent_id: string }) => a.agent_id === agentId,
    );
    agent.worktree_id = placeId;
    agent.archive = "archived";
    await route.fulfill({ response, json: value });
  });
  let openedWorkspace = "";
  await page.route("**/api/v1/workspaces/editor/file?**", async (route) => {
    openedWorkspace =
      new URL(route.request().url()).searchParams.get("workspace_id") ?? "";
    // UI binding proof only. Actual place admission is covered in Go/UID tests.
    await route.fulfill({ json: { ...base, workspace_id: openedWorkspace } });
  });
  await page.goto(`/agents/${agentId}`);
  const link = page
    .getByRole("link")
    .and(page.locator('a[href="#cmd%2Fmain.go%3A3-4"]'));
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByTestId("editor-document")).toContainText(
    'println("hei")',
  );
  expect(openedWorkspace).toBe(placeId);
});

test("@browser-editor a refreshed host preference never interrupts dirty typing", async ({
  page,
  context,
}) => {
  await openFile(page, false);
  await edit(page, "retained across preference refresh");
  let dialogs = 0;
  page.on("dialog", async (dialog) => {
    dialogs++;
    await dialog.dismiss();
  });
  const settings = await context.newPage();
  try {
    await settings.goto("/settings/editor");
    await settings.getByTestId("segment-vscode").click();
    await expect(settings.getByTestId("segment-vscode")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const read = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/account/preferences") &&
        response.request().method() === "GET",
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await read;
    await expect(page.getByTestId("codemirror-editor")).toBeVisible();
    await expect(page.getByTestId("editor-document")).toContainText(
      "retained across preference refresh",
    );
    await expect(page.getByTestId("editor-save")).toBeEnabled();
    expect(dialogs).toBe(0);
  } finally {
    await settings.close();
  }
});

test("@browser-editor @a11y lazy compact chains retry failed listings without scanning or replacing a dirty buffer", async ({
  page,
}) => {
  const reads: string[] = [];
  let fail = true;
  await page.route("**/api/v1/workspaces/editor/list?**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.searchParams.get("path") ?? "";
    reads.push(path);
    if (path === "chain/deep" && fail) {
      fail = false;
      await route.fulfill({ status: 503, body: "" });
      return;
    }
    if (path.startsWith("chain")) {
      await route.fulfill({
        json: {
          schema_version: 1,
          workspace_id: url.searchParams.get("workspace_id"),
          path,
          truncated: false,
          entries:
            path === "chain"
              ? [{ name: "deep", kind: "directory" }]
              : [{ name: "loaded.ts", kind: "file" }],
        },
      });
      return;
    }
    const response = await route.fetch();
    const json = await response.json();
    if (!path) json.entries.push({ name: "chain", kind: "directory" });
    await route.fulfill({ response, json });
  });
  await openFile(page, false);
  await edit(page, "keep this dirty buffer");
  const row = (path: string) =>
    page
      .getByTestId("editor-file-entry")
      .and(page.locator(`[data-path="${path}"]`));
  expect(reads).not.toContain("chain");
  await row("chain").click();
  await expect(row("chain/deep")).toBeVisible();
  expect(reads).not.toContain("chain/deep");
  await row("chain/deep").click();
  await expect(page.getByTestId("editor-directory-retry")).toBeVisible();
  await page.getByTestId("editor-directory-retry").click();
  await expect(row("chain/deep/loaded.ts")).toBeVisible();
  await row("chain/deep/loaded.ts").focus();
  await row("chain/deep/loaded.ts").press("ArrowLeft");
  await expect(row("chain/deep")).toBeFocused();
  await expect(page.getByTestId("editor-document")).toContainText(
    "keep this dirty buffer",
  );
  expect(reads.filter((path) => path === "chain/deep")).toHaveLength(2);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

for (const width of [1366, 390])
  for (const theme of ["light", "dark"]) {
    test(`@browser-editor @a11y long file scroll reaches the last line ${width} ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await openFile(page, width === 390);
      await page.locator("html").evaluate((el, value) => {
        el.dataset.theme = value;
      }, theme);
      const doc = page.getByTestId("editor-document");
      await doc.fill(
        Array.from(
          { length: 250 },
          (_, i) => `// synthetic line ${i + 1}`,
        ).join("\n"),
      );
      const last = doc
        .locator(".cm-line")
        .filter({ hasText: /^\/\/ synthetic line 250$/ });
      for (const maximized of [false, true]) {
        if (maximized) await page.getByTestId("hide-conversation").click();
        await doc.press("Control+Home");
        await doc.press("Control+End");
        await expect(last).toBeInViewport();
        await doc.press("Control+Home");
        for (let i = 0; i < 80; i++) await doc.press("PageDown");
        await expect(last).toBeInViewport();
        await doc.press("Control+Home");
        // Wheel events cover mouse wheels and trackpad scrolling, without
        // directly changing scrollTop or asking Playwright to reveal the line.
        const scroller = page
          .getByTestId("codemirror-editor")
          .locator(".cm-scroller");
        await scroller.hover();
        await page.mouse.wheel(0, 20000);
        await expect(last).toBeInViewport();
        if (width === 390) {
          await doc.press("Control+Home");
          const box = await scroller.boundingBox();
          if (!box) throw new Error("Missing editor scroll viewport");
          const cdp = await page.context().newCDPSession(page);
          await cdp.send("Emulation.setTouchEmulationEnabled", {
            enabled: true,
          });
          const x = box.x + box.width / 2;
          const bottom = box.y + box.height - 10;
          const distance = box.height - 20;
          // Native Chromium touch gestures, not synthetic DOM events or scrollTop.
          for (let i = 0; i < Math.ceil(6000 / distance); i++) {
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchStart",
              touchPoints: [{ x, y: bottom }],
            });
            for (const fraction of [0.25, 0.5, 0.75, 1])
              await cdp.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [{ x, y: bottom - distance * fraction }],
              });
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchEnd",
              touchPoints: [],
            });
          }
          await expect(last).toBeInViewport();
          await cdp.detach();
        }
        expect(
          (
            await new AxeBuilder({ page })
              .include('[data-testid="browser-editor"]')
              .analyze()
          ).violations,
        ).toEqual([]);
      }
    });
  }

for (const width of [1366, 390])
  test(`@browser-editor directory links reveal files without navigation or buffer loss ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await openFile(page, width === 390);
    await page.getByTestId("close-editor").click();
    const conversationURL = page.url();
    const historyLength = await page.evaluate(() => history.length);
    const navigations: string[] = [];
    page.on("request", (request) => {
      if (request.isNavigationRequest()) navigations.push(request.url());
    });
    await page.getByTestId("message-input").fill("kansiolinkki");
    await page.getByTestId("send").click();
    const link = page
      .locator(".ah-markdown a")
      .filter({ hasText: /^Directory$/ });
    await expect(link).toBeVisible({ timeout: 20000 });
    await link.click();
    const file = page
      .getByTestId("editor-file-entry")
      .and(page.locator('[data-path="cmd/main.go"]'));
    await expect(file).toBeVisible();
    await file.click();
    await edit(page, "directory opening keeps my buffer");
    const picker = page.getByTestId("editor-file-picker");
    if (!(await picker.isVisible()))
      await page.getByTestId("editor-picker").click();
    const folder = page
      .getByTestId("editor-file-entry")
      .and(page.locator('[data-path="cmd"]'));
    await folder.click();
    await page.getByTestId("editor-file-filter").fill("not-a-loaded-file");
    // A directory is a tree operation, not permission to discard a document.
    let dialogs = 0;
    page.on("dialog", async (dialog) => {
      dialogs++;
      await dialog.dismiss();
    });
    await page.locator('a[href="#cmd%2F"]').click();
    await expect(page.getByTestId("editor-file-picker")).toBeVisible();
    await expect(file).toBeVisible();
    await expect(page.getByTestId("editor-document")).toContainText(
      "directory opening keeps my buffer",
    );
    await expect(folder).toBeFocused();
    expect(dialogs).toBe(0);
    expect(navigations).toEqual([]);
    expect(page.context().pages()).toHaveLength(1);
    expect(await page.evaluate(() => history.length)).toBe(historyLength);
    await expect(page).toHaveURL(conversationURL);
    await page.getByTestId("editor-save").click();
    await expect(page.getByTestId("editor-dirty")).toBeEmpty();
    await page.goBack();
    await expect(page).not.toHaveURL(conversationURL);
    await page.goForward();
    await expect(page).toHaveURL(conversationURL);
    await expect(page.getByTestId("message-input")).toBeVisible();
  });

// Committed issue evidence is refreshed only on request.
async function capture(page: Page, name: string) {
  if (process.env.OH_VISUAL_CAPTURE !== "1") return;
  await page.screenshot({
    path: fileURLToPath(
      new URL(
        `../../issues/editor-full-preview-icons/evidence/${name}.png`,
        import.meta.url,
      ),
    ),
  });
}
async function openEntry(page: Page, path: string) {
  if (!(await page.getByTestId("editor-file-picker").isVisible()))
    await page.getByTestId("editor-picker").click();
  const entry = page
    .getByTestId("editor-file-entry")
    .and(page.locator(`[data-path="${path}"]`));
  await entry.click();
  await expect(entry).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("codemirror-editor")).toBeVisible();
  if (await page.getByTestId("editor-file-picker").isVisible())
    await page.getByTestId("editor-picker").click();
}
/** The 1-based number of the first text line fully in view. */
const firstLine = (page: Page) =>
  page.getByTestId("codemirror-editor").evaluate((editor) => {
    const scroller = editor.querySelector(".cm-scroller");
    const edge = scroller?.getBoundingClientRect().top ?? 0;
    const gutter = Array.from(
      editor.querySelectorAll<HTMLElement>(".cm-lineNumbers .cm-gutterElement"),
    ).find((g) => g.textContent && g.getBoundingClientRect().top >= edge - 1);
    return Number(gutter?.textContent);
  });
for (const width of [1366, 390])
  test.describe(() => {
    test.use({ deviceScaleFactor: 2 });
    test(`@browser-editor @a11y markdown preview and heading folds ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await openFile(page, width === 390);
      // Code has no preview: no view pair, and the keys stay the browser's.
      await expect(page.getByTestId("editor-view")).toHaveCount(0);
      const doc = page.getByTestId("editor-document");
      const preview = page.getByTestId("editor-preview");
      await doc.press("Control+Alt+KeyP");
      await expect(preview).toHaveCount(0);
      await expect(doc).toBeFocused();
      await openEntry(page, "cmd/notes.md");
      const line = (text: string) =>
        doc.locator(".cm-line").filter({ hasText: new RegExp(`^${text}$`) });
      // A folded heading ends in its placeholder.
      const heading = line("## Kaavio(…)?");
      const inside = line("graph LR");
      await expect(inside).toBeVisible();
      const textButton = page.getByTestId("editor-text-toggle");
      const previewButton = page.getByTestId("editor-preview-toggle");
      await expect(textButton).toHaveAttribute("aria-pressed", "true");
      await expect(previewButton).toHaveAttribute("aria-pressed", "false");
      // Document and layout actions share one row, including at phone width.
      // This catches the former independent header as well as flex wrapping.
      const actionBoxes = await Promise.all(
        [
          "editor-picker",
          "editor-preview-toggle",
          "editor-save",
          "hide-conversation",
          "close-editor",
        ].map((id) => page.getByTestId(id).boundingBox()),
      );
      const centers = actionBoxes.map((box) => {
        if (!box) throw new Error("Editor action is not visible");
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        return box.y + box.height / 2;
      });
      expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(2);

      // Gutter folds a heading's section up to the next heading of its level.
      const gutter = async () => {
        const row = await heading.boundingBox();
        const lane = await page
          .getByTestId("codemirror-editor")
          .locator(".cm-foldGutter")
          .boundingBox();
        if (!row || !lane) throw new Error("Missing fold gutter geometry");
        await page.mouse.click(lane.x + lane.width / 2, row.y + row.height / 2);
      };
      await gutter();
      await expect(inside).toHaveCount(0);
      await expect(line("## Loppu")).toBeVisible();
      await heading.click();
      await doc.press("Control+Shift+BracketRight");
      await expect(inside).toBeVisible();
      await heading.click();
      await doc.press("Control+Shift+BracketLeft");
      await expect(inside).toHaveCount(0);
      await gutter();
      await expect(inside).toBeVisible();

      // Ctrl+Shift+V and Ctrl+Alt+P put the rendered document in place of the
      // text and back; Esc returns too. Focus stays on the page.
      const source = page.locator(".ah-browser-source");
      await heading.click();
      await doc.press("Control+Shift+V");
      await expect(preview).toBeFocused();
      await expect(source).toBeHidden();
      await expect(previewButton).toHaveAttribute("aria-pressed", "true");
      await expect(preview.getByRole("heading", { level: 1 })).toHaveCount(1);
      // The conversation's renderer, Mermaid included.
      await expect(preview.getByTestId("mermaid-diagram")).toBeVisible({
        timeout: 20000,
      });
      await preview.press("Escape");
      await expect(preview).toHaveCount(0);
      await expect(doc).toBeFocused();
      await doc.press("Control+Alt+KeyP");
      await expect(preview).toBeFocused();
      await preview.press("Control+Alt+KeyP");
      await expect(preview).toHaveCount(0);
      await expect(doc).toBeFocused();

      // The pair switches too, and the preview follows unsaved typing.
      await doc.press("Control+End");
      await doc.pressSequentially("\n# Uusi");
      await previewButton.click();
      await expect(source).toBeHidden();
      await expect(preview.getByRole("heading", { level: 1 })).toHaveCount(2);
      await expect(preview.getByTestId("mermaid-diagram")).toBeVisible({
        timeout: 20000,
      });
      expect(
        (
          await new AxeBuilder({ page })
            .include('[data-testid="browser-editor"]')
            .analyze()
        ).violations,
      ).toEqual([]);
      await capture(page, `md-esikatselu-${width}`);
      // The buffer is still unsaved, and Ctrl+S saves it from the preview.
      await expect(page.getByTestId("editor-dirty")).not.toBeEmpty();
      await preview.press("Control+S");
      await expect(page.getByTestId("editor-dirty")).toBeEmpty();
      await textButton.click();
      await expect(preview).toHaveCount(0);
      await expect(line("# Uusi")).toBeVisible();
    });

    test(`@browser-editor @a11y table, picture and page previews ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      const requests: string[] = [];
      page.on("request", (r) => requests.push(r.url()));
      await openFile(page, width === 390);
      const doc = page.getByTestId("editor-document");
      const preview = page.getByTestId("editor-preview");

      // A CSV opens as a table on the line the text showed, numbered by
      // text line, and returns to the line the table showed.
      await openEntry(page, "cmd/taulu.csv");
      // Focus first: a click scrolls the text to its cursor.
      await doc.click();
      await page
        .getByTestId("codemirror-editor")
        .locator(".cm-scroller")
        .evaluate((el) => {
          el.scrollTop = el.scrollHeight / 2;
        });
      // A jump lands on estimated line heights that the editor corrects in a
      // later frame, so its line counts once two reads agree.
      let before = 0;
      await expect
        .poll(async () => {
          const last = before;
          before = await firstLine(page);
          return before > 20 && before === last;
        })
        .toBe(true);
      await doc.press("Control+Alt+KeyP");
      const table = preview.getByTestId("editor-preview-table");
      await expect(table).toBeVisible();
      await expect(preview).toBeFocused();
      // A quoted line break makes the first data row two lines.
      await expect(table.locator('tr[data-line="3"] th').first()).toHaveText(
        "4",
      );
      const topRow = () =>
        preview.evaluate((el) => {
          const edge =
            el.querySelector("thead th")?.getBoundingClientRect().bottom ?? 0;
          const row = Array.from(
            el.querySelectorAll<HTMLElement>("tbody tr"),
          ).find((r) => r.getBoundingClientRect().bottom > edge + 2);
          return Number(row?.dataset.line) + 1;
        });
      await expect
        .poll(async () => Math.abs((await topRow()) - before))
        .toBeLessThanOrEqual(1);
      await capture(page, `csv-taulukko-${width}`);
      await preview.evaluate((el) => {
        el.scrollTop += 300;
      });
      const read = await topRow();
      expect(read).toBeGreaterThan(before);
      await preview.press("Escape");
      await expect(doc).toBeFocused();
      await page.waitForTimeout(500);
      await expect
        .poll(async () => Math.abs((await firstLine(page)) - read))
        .toBeLessThanOrEqual(1);

      // An SVG is drawn as an image: its script does not run and nothing it
      // names is fetched.
      await openEntry(page, "cmd/tunnus.svg");
      await expect(page.getByTestId("editor-preview-toggle")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await doc.press("Control+Shift+V");
      const image = preview.getByTestId("editor-preview-image");
      await expect(image).toBeVisible();
      await expect
        .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
      expect(await page.title()).not.toBe("svg-ran");
      // Not a blob: a blob shares the app's origin, and opening the image in
      // a tab of its own would run the picture's script there.
      expect(await image.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);

      // HTML shows in a sandboxed frame without scripts or network.
      await openEntry(page, "cmd/sivu.html");
      await page.getByTestId("editor-preview-toggle").click();
      const frame = preview.getByTestId("editor-preview-page");
      await expect(frame).toBeVisible();
      await expect(frame).toHaveAttribute("sandbox", "");
      const site = page.frameLocator('[data-testid="editor-preview-page"]');
      await expect(site.locator("h1")).toHaveText("Kutsu");
      await expect(site.locator("script, link, [data-ran]")).toHaveCount(0);
      expect(
        await frame.evaluate(
          (element: HTMLIFrameElement) => element.contentDocument === null,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .include('[data-testid="browser-editor"]')
            // The sandboxed page runs no script, axe's included.
            .exclude('[data-testid="editor-preview-page"]')
            .analyze()
        ).violations,
      ).toEqual([]);
      await capture(page, `html-sivu-${width}`);
      // The pencil returns to the text where Esc is not at hand.
      await page.getByTestId("editor-text-toggle").click();
      await expect(preview).toHaveCount(0);
      expect(
        requests.filter((url) =>
          /example\.test|kuva\.png|tyyli\.css|tracker/.test(url),
        ),
      ).toEqual([]);
    });
  });
