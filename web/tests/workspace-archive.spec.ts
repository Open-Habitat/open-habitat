import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Archiving a workspace is the host's visibility write. The browser shows the
// result at once and lets the next snapshot confirm it; a refused write puts
// the workspace back. Archived workspaces stay findable at the end of the rail.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});
const listed = (page: Page) =>
  page
    .locator(".ah-workspace")
    .getByRole("link")
    .and(page.getByTestId("workspace-ordinary-dir"));
const archivedGroup = (page: Page) =>
  page.getByRole("region").and(page.getByTestId("archived-workspaces"));
async function openWorkspace(page: Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await listed(page).click();
  await expect(
    page
      .getByRole("button")
      .and(page.getByTestId(/^workspace-(archive|restore)$/)),
  ).toBeEnabled();
}
const isWrite = (url: string, method: string) =>
  new URL(url).pathname === "/api/v1/workspaces" && method === "POST";

test("@workspace-archive archive shows at once, is findable and restores from the rail", async ({
  page,
}) => {
  await openWorkspace(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/workspaces", async (route) => {
    if (route.request().method() === "POST") await held;
    await route.continue().catch(() => {});
  });
  const written = page.waitForResponse((r) =>
    isWrite(r.url(), r.request().method()),
  );
  try {
    await page
      .getByRole("button")
      .and(page.getByTestId(/^workspace-(archive|restore)$/))
      .click();
    // Before the host has answered: gone from the list, in the archived group,
    // and the notice says nothing was deleted.
    await expect(listed(page)).toHaveCount(0);
    await expect(
      archivedGroup(page)
        .getByRole("link")
        .and(page.getByTestId("workspace-ordinary-dir")),
    ).toBeVisible();
    await expect(
      page
        .getByRole("status")
        .filter({ has: page.getByTestId("restore-notice") }),
    ).toBeVisible();
  } finally {
    release();
  }
  expect((await written).ok()).toBe(true);
  await page.unroute("**/api/v1/workspaces");

  // The host keeps it archived; elsewhere the group is collapsed until opened.
  await page.goto("/workspaces");
  await expect(listed(page)).toHaveCount(0);
  const toggle = archivedGroup(page)
    .getByRole("button")
    .and(page.getByTestId("toggle-archived"));
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  const restored = page.waitForResponse((r) =>
    isWrite(r.url(), r.request().method()),
  );
  await archivedGroup(page)
    .getByRole("button")
    .and(page.getByTestId("restore-workspace-ordinary-dir"))
    .click();
  await expect(listed(page)).toBeVisible();
  expect((await restored).ok()).toBe(true);
  await page.reload();
  await expect(listed(page)).toBeVisible();
  await expect(archivedGroup(page)).toHaveCount(0);
});

test("@workspace-archive a refused archive puts the workspace back and says so", async ({
  page,
}) => {
  await openWorkspace(page);
  await page.route("**/api/v1/workspaces", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ schema_version: 1, error: "workspace_busy" }),
        })
      : route.continue(),
  );
  await page
    .getByRole("button")
    .and(page.getByTestId(/^workspace-(archive|restore)$/))
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(listed(page)).toBeVisible();
  await expect(archivedGroup(page)).toHaveCount(0);
  await expect(
    page
      .getByRole("button")
      .and(page.getByTestId(/^workspace-(archive|restore)$/)),
  ).toHaveAttribute("aria-pressed", "false");
});

test("@workspace-archive the host's later answer wins over the overlay", async ({
  page,
}) => {
  await openWorkspace(page);
  // Between this tab's archive and its next read, another tab restores the
  // workspace. The overlay must yield to that read, not keep it hidden.
  await page.route("**/api/v1/workspaces", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const reply = await route.fetch();
    const { csrf } = await (await page.request.get("/auth/session")).json();
    const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
    const ws = snapshot.workspaces.find(
      (w: { name: string }) => w.name === "ordinary-dir",
    );
    const other = await page.request.post("/api/v1/workspaces", {
      headers: {
        "X-Agent-Host-CSRF": csrf,
        Origin: new URL(page.url()).origin,
      },
      data: {
        action: "visibility",
        workspace_id: ws.workspace_id,
        observation_token: ws.observation_token,
        hidden: false,
      },
    });
    expect(other.ok()).toBe(true);
    await route.fulfill({ response: reply });
  });
  await page
    .getByRole("button")
    .and(page.getByTestId(/^workspace-(archive|restore)$/))
    .click();
  await expect(listed(page)).toBeVisible();
  await expect(archivedGroup(page)).toHaveCount(0);
  await expect(
    page
      .getByRole("button")
      .and(page.getByTestId(/^workspace-(archive|restore)$/)),
  ).toBeEnabled();
});
