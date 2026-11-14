import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("@rail-now @a11y workspaces stay alphabetical, the filter finds archived ones, and the narrow rail keeps live work", async ({
  page,
}) => {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  // Wire seam: one workspace archived and one renamed so that catalog order
  // is not alphabetical, without a host write.
  await page.route("**/api/v1/snapshot", async (route) => {
    // A page load can dispose a read that is still in flight.
    try {
      const response = await route.fetch();
      const body = await response.json();
      for (const w of body.workspaces)
        if (w.name === "without-metadata") w.visibility = "hidden";
        else if (w.name === "git-project") w.display_name = "zeta-project";
      await route.fulfill({ response, json: body });
    } catch {
      await route.abort().catch(() => {});
    }
  });
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const nav = page
    .getByRole("navigation")
    .and(page.getByTestId("workspace-navigation"));
  const rows = nav.locator(".ah-workspace-list a[data-workspace-name]");
  await expect(rows.first()).toBeVisible();
  const names = await rows.evaluateAll((links) =>
    links.map((a) => a.getAttribute("data-workspace-name") ?? ""),
  );
  expect(names).toEqual(["ordinary-dir", "zeta-project"]);

  // The filter narrows the list and opens the archived group on a match.
  const toggle = nav.getByTestId("toggle-archived");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await nav.getByTestId("workspace-filter").fill("metadata");
  await expect(rows).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(
    nav
      .getByTestId("archived-workspaces")
      .getByTestId("workspace-without-metadata"),
  ).toBeVisible();
  await expect(nav.getByTestId("filter-empty")).toHaveCount(0);
  await nav.getByTestId("clear-filter").click();

  // A conversation at work is live work: it shows in Käynnissä, not under
  // its workspace, and stays reachable from the narrow rail. The slow turn
  // lasts long enough for these checks.
  await nav.getByTestId("workspace-ordinary-dir").click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  await page.getByTestId("message-input").fill("hidas työ");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const url = new URL(page.url());
  const href = url.pathname + url.search;
  await expect(
    nav.getByTestId("rail-running").locator(`a[href="${href}"]`),
  ).toBeVisible();
  await expect(
    nav.locator(".ah-workspace-list").getByTestId("agent-link"),
  ).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="workspace-navigation"]')
        .analyze()
    ).violations,
  ).toEqual([]);

  await nav.getByTestId("close-navigation").click();
  const dot = nav.getByTestId("rail-running").locator(`a[href="${href}"]`);
  await expect(dot).toBeVisible();
  await expect(nav.getByTestId("workspace-filter")).toHaveCount(0);
  await expect(nav.getByTestId("workspace-ordinary-dir")).toHaveCount(0);
  await nav.getByTestId("rail-all-workspaces").click();
  await expect(nav.getByTestId("workspace-ordinary-dir")).toBeVisible();
});

test("@rail-now a new conversation waits in Sinun vuorosi until its first message", async ({
  page,
}) => {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const nav = page
    .getByRole("navigation")
    .and(page.getByTestId("workspace-navigation"));
  await nav.getByTestId("workspace-start-ordinary-dir").click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  const id = new URL(page.url()).searchParams.get("conversation") ?? "";
  // Opened with + and still empty, it waits for the person (Jari 7.11.2026).
  await expect(
    nav.getByTestId("rail-yours").getByTestId(`agent-item-${id}`),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    nav.getByTestId("rail-quiet").getByTestId(`agent-item-${id}`),
  ).toHaveCount(0);
  const row = nav.getByTestId(`agent-item-${id}`);
  await expect(row.getByTestId("rail-close-conversation")).toBeEnabled();
  await expect(row.getByTestId("rail-archive-conversation")).toHaveCount(0);
  // Written, answered and read, its reply waits read until Ei nyt, which
  // makes it quiet (raise-to-your-turn).
  await page.getByTestId("message-input").fill("ensimmäinen");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const read = nav.getByTestId("rail-yours").getByTestId(`agent-item-${id}`);
  await expect(read.getByTestId("rail-mark")).toHaveAttribute(
    "data-state",
    "read",
    {
      timeout: 30000,
    },
  );
  await read.hover();
  await read.getByTestId("rail-not-now-conversation").click();
  await expect(
    nav.getByTestId("rail-quiet").getByTestId(`agent-item-${id}`),
  ).toBeVisible();
  await expect(read).toHaveCount(0);
  await expect(row.getByTestId("rail-archive-conversation")).toBeEnabled();
  await expect(row.getByTestId("rail-close-conversation")).toHaveCount(0);
});

test("@rail-now an unsent conversation is reachable before creation replies and closes from its rail row", async ({
  page,
}) => {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/conversations", async (route) => {
    if (route.request().method() === "POST") await held;
    await route.continue();
  });
  const nav = page.getByTestId("workspace-navigation");
  try {
    await nav.getByTestId("workspace-start-ordinary-dir").click();
    await page.getByTestId("message-input").fill("my unsent draft");
    const pending = nav.locator('[data-testid^="agent-item-new:"]');
    await expect(pending).toHaveCount(1);
    await nav.getByTestId("workspace-ordinary-dir").click();
    await pending.getByTestId("agent-link").click();
    await expect(page.getByTestId("message-input")).toHaveValue(
      "my unsent draft",
    );
    // Creation may finish while elsewhere: the native row must adopt the
    // draft, not require the original creation view to remain mounted.
    await nav.getByTestId("workspace-ordinary-dir").click();
    const created = page
      .waitForResponse(
        (reply) =>
          reply.url().endsWith("/api/v1/conversations") &&
          reply.request().method() === "POST",
      )
      .then((reply) => reply.json());
    release();
    const session = await created;
    const row = nav.getByTestId(`agent-item-${session.agent_id}`);
    await expect(row).toHaveCount(1);
    await expect(pending).toHaveCount(0);
    await row.getByTestId("agent-link").click();
    await expect(page.getByTestId("message-input")).toHaveValue(
      "my unsent draft",
    );
    await page.reload();
    await expect(page.getByTestId("message-input")).toHaveValue(
      "my unsent draft",
    );
    await expect(row.getByTestId("rail-close-conversation")).toBeEnabled();
    await expect(page.getByTestId("dialog-close")).toBeEnabled();
    await row.hover();
    await row.getByTestId("rail-close-conversation").click();
    await expect(row).toHaveCount(0);
    await expect(page).not.toHaveURL(/conversation=/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally {
    release();
  }
});

test("@rail-now closing a refused creation removes its row and draft", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/conversations", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await held;
    return route.fulfill({
      status: 429,
      json: {
        schema_version: 1,
        error: {
          code: "session_records_exhausted",
          message: "Request could not be completed",
          retryable: false,
          correlation_id: "req_00000000",
        },
      },
    });
  });
  const nav = page.getByTestId("workspace-navigation");
  try {
    await nav.getByTestId("workspace-start-ordinary-dir").click();
    await page.getByTestId("message-input").fill("discarded draft");
    await nav.getByTestId("workspace-ordinary-dir").click();
    release();
    const row = nav.locator('[data-testid^="agent-item-new:"]');
    await expect(row.getByTestId("rail-close-conversation")).toBeEnabled();
    await expect(page.getByTestId("rail-creation-problem")).toBeVisible();
    await row.getByTestId("agent-link").click();
    await expect(page.getByTestId("message-input")).toHaveValue(
      "discarded draft",
    );
    await expect(page.getByTestId("dialog-close")).toBeEnabled();
    await row.hover();
    await row.getByTestId("rail-close-conversation").click();
    await expect(row).toHaveCount(0);
    await expect(page.getByTestId("rail-creation-problem")).toHaveCount(0);
    await expect(page).not.toHaveURL(/conversation=/);
    await nav.getByTestId("workspace-start-ordinary-dir").click();
    await expect(page.getByTestId("message-input")).toHaveValue("");
  } finally {
    release();
  }
});
