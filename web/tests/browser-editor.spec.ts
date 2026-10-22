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
        await page.getByTestId("editor-save").click();
        await expect(page.getByTestId("editor-problem")).toBeVisible();
        await expect(doc).toContainText("reconciled local");
        await expect(page.getByTestId("editor-save")).toBeDisabled();
        await page.getByTestId("editor-compare").click();
        await expect(page.getByTestId("editor-comparison")).toContainText(
          "external",
        );
        await page.getByTestId("editor-reconcile").click();
        await page.getByTestId("editor-save").click();
        await expect(page.getByTestId("editor-dirty")).toBeEmpty();
        expect((await (await page.request.get(url)).json()).content).toBe(
          "reconciled local\n",
        );
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

test("@browser-editor @a11y editor preference follows a person across browsers and compact choice never overwrites desktop", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto("/settings/editori");
  await expect(page.getByTestId("editor-choice-codemirror6")).toBeChecked();
  await page.getByTestId("editor-choice-vscode").click();
  await expect(page.getByTestId("editor-choice-vscode")).toBeChecked();
  const other = await browser.newContext({
    baseURL: hostOrigin,
    ignoreHTTPSErrors: true,
  });
  try {
    const second = await other.newPage();
    await login(second);
    await second.goto("/settings/editori");
    await expect(second.getByTestId("editor-choice-vscode")).toBeChecked();
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
  await page.reload();
  await expect(page.getByTestId("editor-choice-vscode")).toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("editor-choice-codemirror6")).toBeChecked();
  await expect(page.getByTestId("editor-choice-vscode")).toBeDisabled();
  await page.setViewportSize({ width: 1366, height: 844 });
  await expect(page.getByTestId("editor-choice-vscode")).toBeChecked();
  const session = await (await page.request.get("/auth/session")).json();
  await page.request.post("/auth/logout", {
    headers: { Origin: hostOrigin, "X-Agent-Host-CSRF": session.csrf },
  });
  await page.goto("/");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=43"]').click();
  await page.goto("/settings/editori");
  await expect(page.getByTestId("editor-choice-codemirror6")).toBeChecked();
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
      await page.getByTestId("editor-navigation").click();
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
  await page.getByTestId("editor-navigation").click();
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
  await page.getByTestId("editor-navigation").click();
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
    await settings.goto("/settings/editori");
    await settings.getByTestId("editor-choice-vscode").click();
    await expect(settings.getByTestId("editor-choice-vscode")).toBeChecked();
    const read = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/account/editor-preference") &&
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
