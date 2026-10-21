import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { test, expect, type Page } from "./worker-host";

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
        .some((entry) => entry.name.includes("CodeMirrorEditor")),
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
  expect(resources.some((name) => /monaco|editor\.worker/i.test(name))).toBe(
    false,
  );
}
for (const width of [1366, 390])
  for (const theme of ["light", "dark"]) {
    test(`@browser-editor @a11y default text editor, explicit save and dirty transitions ${width} ${theme}`, async ({
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
      await doc.fill("synthetic edit\nsecond line\n");
      await expect(page.getByTestId("editor-save")).toBeEnabled();
      page.once("dialog", (d) => d.dismiss());
      await page.getByTestId("close-editor").click();
      await expect(doc).toBeVisible();
      await page.getByTestId("editor-save").click();
      await expect(page.getByTestId("editor-save")).toBeDisabled();
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
      await doc.fill("reconciled local\n");
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
      await expect(page.getByTestId("editor-save")).toBeDisabled();
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
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.getByTestId("show-conversation").click();
      await expect(page.getByTestId("message-input")).toBeFocused();
      await page.getByTestId("close-editor").click();
      await expect(page.getByTestId("browser-editor")).toHaveCount(0);
      expect(grants).toEqual([]);
    });
  }

test("@browser-editor @a11y editor preference is identity-local and compact choice never overwrites desktop", async ({
  page,
}) => {
  await login(page);
  await page.goto("/settings/editori");
  await expect(page.getByTestId("editor-choice-codemirror6")).toBeChecked();
  await expect(page.getByTestId("editor-choice-monaco")).toBeDisabled();
  await page.getByTestId("editor-choice-vscode").check();
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

test("@browser-editor identity replacement drops dirty buffers and ignores delayed old-user reads", async ({
  page,
  context,
  browser,
}) => {
  await openFile(page, false);
  await page.getByTestId("editor-document").fill("old identity private buffer");
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
  const refusal = page
    .waitForEvent("dialog")
    .then((dialog) => dialog.dismiss());
  await page.getByTestId("editor-navigation").click();
  await page.getByTestId("snapshot-refresh").click();
  await refusal;
  await expect(page.getByTestId("editor-workspace-changed")).toBeVisible();
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
