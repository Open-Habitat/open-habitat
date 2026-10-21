import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// ADR 0023 in the browser: optimistic workspace commands show at once at the
// live route's latency, confirm from the reply without a snapshot read, say
// when confirmation is slow, revert a refusal with its reason, and keep an
// uncertain command until a later read decides it.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});
const listed = (page: Page, name = "ordinary-dir") =>
  page.locator(
    `.ah-workspace a[data-testid^="workspace-"][data-workspace-name="${name}"]`,
  );
const archivedGroup = (page: Page) => page.getByTestId("archived-workspaces");
const isWrite = (url: string, method: string) =>
  new URL(url).pathname === "/api/v1/workspaces" && method === "POST";

async function openWorkspace(page: Page, latency = 0) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
  await listed(page).click();
  await expect(page.getByTestId("workspace-archive")).toBeEnabled();
  if (latency) {
    // The live route costs ~0.2 s per round trip through the tunnel.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
  }
}
/** Holds every workspace write until released; counts them. */
async function holdWrites(page: Page) {
  const gates: (() => void)[] = [];
  const state = {
    writes: 0,
    release: () => {
      for (const gate of gates.splice(0)) gate();
    },
  };
  await page.route("**/api/v1/workspaces", async (route) => {
    if (route.request().method() === "POST") {
      state.writes++;
      await new Promise<void>((resolve) => gates.push(resolve));
    }
    await route.continue().catch(() => {});
  });
  return state;
}

test("@mutation-layer archive, undo and rename show before the host answers, at 200 ms", async ({
  page,
}) => {
  await openWorkspace(page, 200);
  const held = await holdWrites(page);
  const snapshots: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/v1/snapshot")
      snapshots.push(r.url());
  });
  await page.getByTestId("workspace-archive").click();
  await expect(listed(page)).toHaveCount(0);
  await expect(
    archivedGroup(page).locator(
      'a[data-testid^="workspace-"][data-workspace-name="ordinary-dir"]',
    ),
  ).toBeVisible();
  // Undo while the archive is still unconfirmed: shown at once, queued
  // behind it rather than sent alongside or refused.
  await page
    .getByTestId("archive-notice")
    .getByTestId("restore-notice")
    .click();
  await expect(listed(page)).toBeVisible();
  expect(held.writes).toBe(1);
  held.release();
  await expect.poll(() => held.writes).toBe(2);
  held.release();
  await page.unroute("**/api/v1/workspaces");
  // The replies confirmed both commands; no snapshot was the confirmation.
  await expect(listed(page)).toBeVisible();
  expect(snapshots).toEqual([]);

  // Rename: the dialog closes and the new name shows before the reply.
  const renameHeld = await holdWrites(page);
  await page.getByTestId("rename-workspace").click();
  await page.getByTestId("workspace-name").fill("Tavallinen");
  await page.getByTestId("save-workspace-name").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("main h1")).toHaveText("Tavallinen");
  await expect(listed(page, "Tavallinen")).toBeVisible();
  const renamed = page.waitForResponse(
    (r) =>
      isWrite(r.url(), r.request().method()) &&
      !!r.request().postData()?.includes('"settings"'),
  );
  renameHeld.release();
  const reply = await (await renamed).json();
  expect(reply.workspace.display_name).toBe("Tavallinen");
  // The first rename gives the workspace a durable ID; the page follows it.
  await expect(page).toHaveURL(
    new RegExp(`/workspaces/${reply.workspace_id}$`),
  );
  await expect(page.locator("main h1")).toHaveText("Tavallinen");
  expect(snapshots).toEqual([]);
  await page.unroute("**/api/v1/workspaces");
  await page.reload();
  await expect(listed(page, "Tavallinen")).toBeVisible();
});

test("@mutation-layer a refused rename reverts in place with its reason", async ({
  page,
}) => {
  await openWorkspace(page);
  await page.route("**/api/v1/workspaces", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            schema_version: 1,
            error: { code: "workspace_changed" },
          }),
        })
      : route.continue(),
  );
  await page.getByTestId("rename-workspace").click();
  await page.getByTestId("workspace-name").fill("Ei tule");
  await page.getByTestId("save-workspace-name").click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator("main h1")).toHaveText("ordinary-dir");
  await expect(listed(page)).toBeVisible();
});

test("@mutation-layer a slow confirmation says so and then settles", async ({
  page,
}) => {
  await openWorkspace(page);
  const held = await holdWrites(page);
  await page.getByTestId("workspace-archive").click();
  await expect(listed(page)).toHaveCount(0);
  const note = page.locator(
    '[data-testid="mutation-pending"][data-phase="slow"]',
  );
  await expect(note).toHaveCount(0);
  await expect(note).toBeVisible({ timeout: 4000 });
  held.release();
  await expect(note).toHaveCount(0);
  await expect(listed(page)).toHaveCount(0);
  await page.unroute("**/api/v1/workspaces");
  await page.reload();
  await expect(listed(page)).toHaveCount(0);
});

test("@mutation-layer a lost reply stays pending until the next read decides", async ({
  page,
}) => {
  await openWorkspace(page);
  // The host archives the workspace, but its reply never reaches the browser.
  let replyLost!: () => void;
  const lostReply = new Promise<void>((resolve) => {
    replyLost = resolve;
  });
  await page.route("**/api/v1/workspaces", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const reply = await route.fetch();
    expect(reply.ok()).toBe(true);
    await route.abort("failed");
    replyLost();
  });
  await page.getByTestId("workspace-archive").click();
  await expect(listed(page)).toHaveCount(0);
  // Optimistic archive visibility is not proof that fetch/abort has settled.
  // Keep this page and route alive until the deliberate lost reply is complete.
  await lostReply;
  // Uncertain is not refused: no rollback, no "done"; the next read is the
  // receipt and shows the archive happened.
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    archivedGroup(page).locator(
      'a[data-testid^="workspace-"][data-workspace-name="ordinary-dir"]',
    ),
  ).toBeVisible();
  await expect(
    page.locator('[data-testid="mutation-pending"][data-phase="uncertain"]'),
  ).toHaveCount(0);
  await page.unroute("**/api/v1/workspaces");

  // Now a reply lost before the host wrote anything: the receipt reverts it.
  await page.goto("/workspaces");
  await archivedGroup(page).getByTestId("toggle-archived").click();
  await page.route("**/api/v1/workspaces", (route) =>
    route.request().method() === "POST"
      ? route.abort("failed")
      : route.continue(),
  );
  await archivedGroup(page)
    .getByTestId("restore-workspace-ordinary-dir")
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(listed(page)).toHaveCount(0);
});

test("@mutation-layer a capacity refusal of + is a refusal, not an uncertain creation", async ({
  page,
}) => {
  await openWorkspace(page);
  await page.route("**/api/v1/conversations", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({
            schema_version: 1,
            error: {
              code: "capacity_exceeded",
              message: "Request could not be completed",
              retryable: false,
              correlation_id: "req_00000000",
            },
          }),
        })
      : route.continue(),
  );
  await page.getByTestId("conversation-start").click();
  const conversation = page.getByTestId("conversation-stream");
  await expect(
    conversation.locator(
      '[data-testid="creation-problem"][data-state="refused"]',
    ),
  ).toBeVisible();
  await expect(conversation.getByTestId("creation-problem")).toHaveAttribute(
    "data-state",
    "refused",
  );
  await expect(
    conversation.locator(
      '[data-testid="creation-problem"][data-state="uncertain"]',
    ),
  ).toHaveCount(0);
  await expect(page.getByTestId("creation-recheck")).toHaveCount(0);
  // + stays usable: nothing marks the creation uncertain.
  await expect(
    page
      .getByRole("navigation")
      .locator(
        '[data-testid^="workspace-start-"][data-workspace-name="ordinary-dir"]',
      ),
  ).toBeEnabled();
  await page.unroute("**/api/v1/conversations");
  await conversation.getByTestId("retry").click();
  await expect(page).toHaveURL(/conversation=pi:/);
});
