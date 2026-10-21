import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./worker-host";
import { hostOrigin } from "../test-ports.mjs";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("@resilience failed reads recover in place without claiming an empty catalog", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("login-submit").click();
  await page.locator('a[href*="code=42"]').click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"schema_version":1}',
    }),
  );
  await page.getByTestId("snapshot-refresh").click();
  await expect(
    page.locator('[data-testid="connection-banner"][data-state="stale"]'),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .locator(
        '[data-testid="workspace-link"][data-workspace-name="ordinary-dir"]',
      ),
  ).toBeVisible();
  await page.unroute("**/api/v1/snapshot");
  await page.getByTestId("connection-retry").click();
  await expect(
    page
      .getByRole("navigation")
      .locator(
        '[data-testid="workspace-link"][data-workspace-name="ordinary-dir"]',
      ),
  ).toBeVisible();
  await page.request.get("/fixture/scenario?value=malformed");
  await page.getByTestId("snapshot-refresh").click();
  await expect(
    page
      .getByRole("navigation")
      .locator(
        '[data-testid="workspace-link"][data-workspace-name="ordinary-dir"]',
      ),
  ).toBeVisible();
  await expect(
    page.locator('[data-testid="connection-banner"][data-state="stale"]'),
  ).toBeVisible();
});

test("@resilience native discovery error retains previously verified content", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("login-submit").click();
  await page.locator('a[href*="code=42"]').click();
  await expect(
    page
      .getByRole("navigation")
      .locator(
        '[data-testid="workspace-link"][data-workspace-name="ordinary-dir"]',
      ),
  ).toBeVisible();
  await page.request.get("/fixture/scenario?value=error");
  await page.getByTestId("snapshot-refresh").click();
  await expect(
    page.locator('[data-testid="connection-banner"][data-state="stale"]'),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .locator(
        '[data-testid="workspace-link"][data-workspace-name="ordinary-dir"]',
      ),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/evidence/stale-discovery.png" });
  await page.request.get("/fixture/scenario?value=ready");
  await page.getByTestId("connection-retry").click();
  await expect(
    page.locator('[data-testid="connection-banner"][data-state="stale"]'),
  ).toHaveCount(0);
});

test("@resilience verified session retains workspaces during a host outage, disables writes and retries", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("login-submit").click();
  await page.locator('a[href*="code=42"]').click();
  await expect(
    page
      .getByRole("navigation")
      .locator(
        '[data-testid="workspace-link"][data-workspace-name="ordinary-dir"]',
      ),
  ).toBeVisible();
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 500, body: "unavailable" }),
  );
  await page.getByTestId("snapshot-refresh").click();
  await expect(
    page.locator('[data-testid="connection-banner"][data-state="stale"]'),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .locator(
        '[data-testid="workspace-link"][data-workspace-name="ordinary-dir"]',
      ),
  ).toBeVisible();
  await page.unroute("**/api/v1/snapshot");
  await page.getByTestId("connection-retry").click();
  await expect(
    page.locator('[data-testid="connection-banner"][data-state="stale"]'),
  ).toHaveCount(0);
  // A stopped host drops the transport rather than returning a 5xx.
  await page.route("**/api/v1/snapshot", (route) => route.abort());
  await page.getByTestId("snapshot-refresh").click();
  await expect(
    page.locator('[data-testid="connection-banner"][data-state="stale"]'),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .locator(
        '[data-testid="workspace-link"][data-workspace-name="ordinary-dir"]',
      ),
  ).toBeVisible();
  await page.unroute("**/api/v1/snapshot");
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 503, body: "daemon stopped" }),
  );
  await page.getByTestId("connection-retry").click();
  await expect(
    page.locator('[data-testid="connection-banner"][data-state="stale"]'),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .locator(
        '[data-testid="workspace-link"][data-workspace-name="ordinary-dir"]',
      ),
  ).toBeVisible();
  await page.unroute("**/api/v1/snapshot");
  await page.request.get("/fixture/scenario?value=delay");
  await page.getByTestId("connection-retry").click();
  await expect(
    page.locator('[data-testid="connection-banner"][data-state="stale"]'),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation")
      .locator(
        '[data-testid="workspace-link"][data-workspace-name="ordinary-dir"]',
      ),
  ).toBeVisible();
});

test("@resilience expired session ends the live stream and reaches login even during a snapshot outage", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  const stream = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/events" &&
      response.request().resourceType() === "eventsource" &&
      response.ok(),
  );
  await page.goto("/workspaces");
  await page.getByTestId("login-submit").click();
  await page.locator('a[href*="code=42"]').click();
  await expect(
    page
      .getByRole("navigation")
      .locator(
        '[data-testid="workspace-link"][data-workspace-name="ordinary-dir"]',
      ),
  ).toBeVisible();
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 500, body: "unavailable" }),
  );
  await page.getByTestId("snapshot-refresh").click();
  await expect(
    page.locator('[data-testid="connection-banner"][data-state="stale"]'),
  ).toBeVisible();
  await stream;
  // Revocation now closes existing relays. Its 401 probe must clear the old
  // identity without waiting for tab focus or an explicit retry, even though
  // snapshot refreshes still fail.
  await page.request.get("/fixture/expire");
  await expect(page.getByTestId("login-submit")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("ordinary-dir");
});

test("@resilience populated native history remains readable during outage", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("login-submit").click();
  await page.locator('a[href*="code=42"]').click();
  await page
    .getByRole("navigation")
    .locator(
      '[data-testid="agent-link"][data-agent-title="Synteettinen viesti 0"]',
    )
    .click();
  await expect(page.locator("main")).toContainText("Synteettinen viesti 0");
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 500, body: "unavailable" }),
  );
  await page.getByTestId("snapshot-refresh").click();
  await expect(
    page.locator('[data-testid="connection-banner"][data-state="stale"]'),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("Synteettinen viesti 0");
  await page.unroute("**/api/v1/snapshot");
  await page.getByTestId("connection-retry").click();
  await expect(
    page.locator('[data-testid="connection-banner"][data-state="stale"]'),
  ).toHaveCount(0);
});

test("@resilience active conversation stays readable and blocks writes during snapshot outage", async ({
  page,
}) => {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("login-submit").click();
  await page.locator('a[href*="code=42"]').click();
  await page
    .getByRole("navigation")
    .locator(
      '[data-testid="workspace-link"][data-workspace-name="ordinary-dir"]',
    )
    .click();
  await expect(page.getByTestId("workspace-create-conversation")).toBeEnabled();
  await page.getByTestId("workspace-create-conversation").click();
  const editor = page.getByTestId("composer-input");
  await expect(editor).toBeVisible();
  await editor.fill("Luonnos säilyy katkossa");
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 500, body: "host stopped" }),
  );
  await page.getByTestId("snapshot-refresh").click();
  await expect(
    page.locator('[data-testid="connection-banner"][data-state="stale"]'),
  ).toBeVisible();
  await expect(editor).toHaveValue("Luonnos säilyy katkossa");
  await expect(page.getByTestId("conversation-recheck")).toHaveCount(0);
  await expect(page.getByTestId("connection-retry")).toHaveCount(1);
  await expect(page.getByTestId("composer-send")).toBeDisabled();
  expect(
    await page
      .locator(".ah-composer .ah-control-reason")
      .evaluateAll((nodes) =>
        nodes.every(
          (node) =>
            getComputedStyle(node).display === "none" ||
            (node.getBoundingClientRect().width <= 1 &&
              getComputedStyle(node).overflow === "hidden"),
        ),
      ),
  ).toBe(true);
  // Rivillä: Send sits at the right end of the field's own bottom row.
  const row = await page.locator(".ah-cbox").evaluate((node) => {
    const box = node.getBoundingClientRect();
    const field = node.querySelector("textarea")?.getBoundingClientRect();
    const button = node
      .querySelector('button[data-testid="composer-send"]')
      ?.getBoundingClientRect();
    if (!field || !button) throw new Error("composer geometry missing");
    return {
      below: button.top >= field.bottom - 1,
      inside: button.bottom <= box.bottom && button.right <= box.right,
      rightGap: box.right - button.right,
    };
  });
  expect(row.below && row.inside).toBe(true);
  expect(row.rightGap).toBeLessThan(16);
  await expect(page.getByTestId("conversation-stop")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const composer = page.locator(".ah-conversation-frame > .ah-composer");
  await expect(composer).toBeVisible();
  expect(
    await composer.evaluate((node) => node.getBoundingClientRect().bottom),
  ).toBeLessThanOrEqual(844);
  expect(
    await composer.evaluate((node) => node.scrollHeight > node.clientHeight),
  ).toBe(false);
  await page.screenshot({
    path: "test-results/evidence/stale-conversation.png",
  });
  await page.unroute("**/api/v1/snapshot");
  await page.getByTestId("connection-retry").click();
  await expect(
    page.locator('[data-testid="connection-banner"][data-state="stale"]'),
  ).toHaveCount(0);
});

test("@resilience working composer has one outage warning and the send stays in the field row", async ({
  page,
}) => {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("login-submit").click();
  await page.locator('a[href*="code=42"]').click();
  await page
    .getByRole("navigation")
    .locator(
      '[data-testid="workspace-link"][data-workspace-name="ordinary-dir"]',
    )
    .click();
  await page.request.get("/fixture/scenario?value=pi-visual-hold");
  await page.getByTestId("workspace-create-conversation").click();
  const editor = page.getByTestId("composer-input");
  await editor.fill("Näytä pitkä tuloste");
  await page.getByTestId("composer-send").click();
  await expect(page.getByTestId("composer-send")).toHaveAttribute(
    "data-mode",
    "steer",
  );
  await editor.fill("Luonnos säilyy katkossa");
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 500, body: "host stopped" }),
  );
  await page.getByTestId("snapshot-refresh").click();
  await expect(
    page.locator('[data-testid="connection-banner"][data-state="stale"]'),
  ).toHaveCount(1);
  expect(
    await page
      .locator(".ah-composer .ah-control-reason")
      .evaluateAll((nodes) =>
        nodes.every(
          (node) =>
            getComputedStyle(node).display === "none" ||
            (node.getBoundingClientRect().width <= 1 &&
              getComputedStyle(node).overflow === "hidden"),
        ),
      ),
  ).toBe(true);
  await expect(page.getByTestId("composer-send")).toBeDisabled();
  const inRow = await page.locator(".ah-cbox").evaluate((node) => {
    const editor = node.querySelector("textarea")?.getBoundingClientRect();
    const send = node
      .querySelector('button[data-testid="composer-send"]')
      ?.getBoundingClientRect();
    if (!editor || !send) throw new Error("composer geometry missing");
    return send.top >= editor.bottom - 1;
  });
  expect(inRow).toBe(true);
  const accessibility = await new AxeBuilder({ page })
    .include(".ah-composer")
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.unroute("**/api/v1/snapshot");
});

test("@resilience restored network retries a failed read without resending work", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("login-submit").click();
  await page.locator('a[href*="code=42"]').click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.route("**/api/v1/snapshot", (route) => route.abort());
  await page.getByTestId("snapshot-refresh").click();
  await expect(
    page.locator('[data-testid="connection-banner"][data-state="stale"]'),
  ).toBeVisible();
  await page.unroute("**/api/v1/snapshot");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page
      .getByRole("navigation")
      .locator(
        '[data-testid="workspace-link"][data-workspace-name="ordinary-dir"]',
      ),
  ).toBeVisible();
});

test("@resilience an incomplete catalog does not claim a deep-linked conversation was deleted", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("login-submit").click();
  await page.locator('a[href*="code=42"]').click();
  const agentLink = page
    .getByRole("navigation")
    .locator(
      '[data-testid="agent-link"][data-agent-title="Synteettinen viesti 0"]',
    );
  await expect(agentLink).toBeVisible();
  const href = await agentLink.getAttribute("href");
  if (!href || !/^\/agents\/pi:/.test(href))
    throw new Error("missing synthetic history link");
  await page.request.get("/fixture/scenario?value=partial");
  await page.goto(href);
  await expect(page.getByTestId("conversation-observation")).toHaveAttribute(
    "data-state",
    "uncertain",
  );
  await expect(page.locator("main .ah-notice")).toBeVisible();
  await expect(
    page.getByRole("main").getByTestId("notice-action"),
  ).toBeVisible();
  await page.request.get("/fixture/scenario?value=ready");
  await page.getByRole("main").getByTestId("notice-action").click();
  await expect(page.locator("main")).toContainText("Synteettinen viesti 0");
});

test("@resilience missing and partial observations can be refreshed without a reload", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("login-submit").click();
  await page.locator('a[href*="code=42"]').click();
  for (const value of ["missing", "partial", "empty"]) {
    await page.request.get(`/fixture/scenario?value=${value}`);
    await page.getByTestId("snapshot-refresh").click();
    await expect(
      page.getByRole("main").getByTestId("notice-action"),
    ).toBeVisible();
    await page.request.get("/fixture/scenario?value=ready");
    const recovered = page
      .getByRole("navigation")
      .locator(
        '[data-testid="workspace-link"][data-workspace-name="ordinary-dir"]',
      );
    const retry = page.getByRole("main").getByTestId("notice-action");
    if (await retry.isVisible()) {
      // A queued journal refresh can restore the catalog during the click;
      // disappearance is fine, but the final state must be recovered.
      await retry.click({ timeout: 2500 }).catch(() => {});
    }
    await expect(retry).toHaveCount(0);
    await expect(recovered).toBeVisible();
  }
});
