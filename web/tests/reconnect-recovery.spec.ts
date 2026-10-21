import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function open(page: Page) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
  await page
    .getByRole("navigation")
    .locator('a[data-testid^="workspace-"][data-workspace-name="ordinary-dir"]')
    .click();
  await expect(page.getByTestId("conversation-start")).toBeEnabled();
}

/** Restore fixture reads on the real user action, not ahead of clickability. */
async function recoverOnClick(page: Page, testId: string) {
  await page.evaluate((id) => {
    document.addEventListener(
      "click",
      (event) => {
        if ((event.target as Element).closest(`[data-testid="${id}"]`))
          document.documentElement.dataset.fixtureRetryClicked = "true";
      },
      { capture: true, once: true },
    );
  }, testId);
}
async function recoveryRequested(page: Page) {
  try {
    return await page.evaluate(
      () => document.documentElement.dataset.fixtureRetryClicked === "true",
    );
  } catch (error) {
    // Reload can discard the old document while one of its list reads is
    // intercepted. It has not performed the new document's recovery click.
    if (String(error).includes("Execution context was destroyed")) return false;
    throw error;
  }
}

for (const restart of [false, true]) {
  test(`@reconnect explicit retry reconnects the stream and snapshot${restart ? " after Unix daemon HTTP server restart" : " at an unchanged cursor"}`, async ({
    page,
  }) => {
    await open(page);
    // Freeze backoff, not networking: only the person's click can reopen SSE.
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    // Keep the outage until the actual retry click. Removing routes before
    // Playwright clicks lets a late epoch/recovery read reconnect on its own
    // and detach the very button whose action this case is meant to prove.
    await page.route("**/api/v1/events*", async (route) =>
      (await recoveryRequested(page))
        ? route.continue()
        : route.fulfill({ status: 503 }),
    );
    await page.route("**/api/v1/snapshot", async (route) =>
      (await recoveryRequested(page))
        ? route.continue()
        : route.fulfill({ status: 503 }),
    );
    expect(
      (
        await page.request.get(
          `/fixture/daemon-restart${restart ? "" : "?transport_only=1"}`,
        )
      ).status(),
    ).toBe(204);
    await page.getByTestId("snapshot-refresh").click();
    const retry = page.getByTestId("connection-retry");
    await expect(retry).toBeVisible();
    await recoverOnClick(page, "connection-retry");
    const stream = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/events" && response.ok(),
    );
    const snapshot = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/snapshot" &&
        response.ok(),
    );
    await retry.click();
    await snapshot;
    await stream;
    await page.unroute("**/api/v1/events*");
    await page.unroute("**/api/v1/snapshot");
    await expect(
      page.locator(
        '[data-testid^="connection-"][data-state][data-state="stale"]',
      ),
    ).toHaveCount(0);
    await expect(page.getByTestId("conversation-start")).toBeEnabled();
  });
}

test("@reconnect reports progress and failure, then recovers across TLS gateway and daemon restarts", async ({
  page,
}) => {
  await open(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.route("**/api/v1/events*", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.request.get("/fixture/daemon-restart");
  await expect(page.getByTestId("connection-retry")).toBeVisible();
  // Recreate the production gateway auth from its durable session file, and
  // replace the actual TLS server/listener. This is not a mocked HTTP response.
  await page.request.get("/fixture/gateway-restart");
  await expect
    .poll(async () => {
      try {
        return (await page.request.get("/healthz")).status();
      } catch {
        return 0;
      }
    })
    .toBe(200);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.unroute("**/api/v1/events*");
  await page.route("**/api/v1/events*", async (route) => {
    await held;
    await route.fulfill({ status: 503 });
  });
  await page.getByTestId("connection-retry").click();
  await expect(
    page.locator(
      '[data-testid^="connection-"][data-state][data-state="connecting"]',
    ),
  ).toBeVisible();
  await expect(page.getByTestId("connection-retry")).toBeDisabled();
  // Axe's async checks need browser timers; backoff was frozen above only to
  // distinguish a manual retry from the automatic one.
  await page.clock.resume();
  expect(
    (await new AxeBuilder({ page }).include(".ah-connection").analyze())
      .violations,
  ).toEqual([]);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  release();
  await expect(page.getByTestId("connection-retry")).toBeEnabled();
  await page.unroute("**/api/v1/events*");
  const stream = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/events" && response.ok(),
  );
  await page.getByTestId("connection-retry").click();
  await stream;
  await expect(page.locator(".ah-connection")).toHaveCount(0);
  await expect(page.getByTestId("conversation-start")).toBeEnabled();
});

test("@reconnect an invalid frame does not trap recovery at an unchanged native cursor", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() =>
    sessionStorage.setItem("oh:debug-reconnect", "true"),
  );
  const diagnostics: Record<string, unknown>[] = [];
  page.on("console", (message) => {
    if (message.text().startsWith("[reconnect] "))
      diagnostics.push(JSON.parse(message.text().slice("[reconnect] ".length)));
  });
  const before = await (await page.request.get("/api/v1/snapshot")).json();
  let injected = false;
  await page.route("**/api/v1/events*", (route) => {
    // The journal also probes this URL with fetch after a transport error.
    // Corrupt only the real EventSource, never that diagnostic probe.
    if (injected || route.request().resourceType() !== "eventsource")
      return route.continue();
    injected = true;
    return route.fulfill({
      contentType: "text/event-stream",
      headers: { "X-Synthetic-Broken": "1" },
      body: "event: snapshot.invalidated\ndata: {}\n\n",
    });
  });
  const reopened = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/events" &&
      response.ok() &&
      response.headers()["content-type"] === "text/event-stream" &&
      response.request().resourceType() === "eventsource" &&
      injected &&
      !response.headers()["x-synthetic-broken"],
  );
  await page.request.get("/fixture/daemon-restart?transport_only=1");
  await reopened;
  await expect
    .poll(async () =>
      (await page.request.get("/api/v1/snapshot"))
        .json()
        .then((value) => value.event_cursor),
    )
    .toBe(before.event_cursor);
  await expect(page.locator(".ah-connection")).toHaveCount(0);
  expect(injected).toBe(true);
  expect(diagnostics).toContainEqual(
    expect.objectContaining({
      event: "cursor",
      outcome: "equal",
      recovering: true,
    }),
  );
  expect(diagnostics).toContainEqual(
    expect.objectContaining({
      event: "request",
      path: "/api/v1/snapshot",
      status: 200,
    }),
  );
  expect(diagnostics).toContainEqual(
    expect.objectContaining({
      event: "stream",
      outcome: "open",
    }),
  );
  // Neither raw cursor/instance nor identity is part of the console protocol.
  expect(JSON.stringify(diagnostics)).not.toContain(before.event_cursor);
  expect(JSON.stringify(diagnostics)).not.toContain(
    before.identity.web_identity_id,
  );
});

for (const created of [false, true]) {
  test(`@reconnect uncertain creation recheck ${created ? "discovers the created conversation" : "allows retry when no conversation was created"}`, async ({
    page,
  }) => {
    await open(page);
    let writes = 0;
    let createdId = "";
    await page.route("**/api/v1/conversations", async (route) => {
      if (route.request().method() !== "POST")
        return (await recoveryRequested(page))
          ? route.continue()
          : route.fulfill({ status: 503 });
      writes++;
      if (created) {
        // Observe the host commit, but lose its reply to the browser.
        createdId = (await (await route.fetch()).json()).agent_id;
      }
      await route.fulfill({ status: 503, body: "{}" });
    });
    const start = page.getByTestId("conversation-start");
    // Creation remains singular; the current header exposes workspace actions
    // directly rather than under the old ellipsis menu.
    const header = page.locator(".ah-workspace-page-head");
    await expect(header.getByTestId("conversation-start")).toHaveCount(1);
    await expect(header.getByTestId("copy-path")).toBeVisible();
    await start.click();
    await expect(
      page
        .getByTestId("conversation-stream")
        .locator('[data-testid="creation-problem"][data-state="uncertain"]'),
    ).toBeVisible();
    const sidebarStart = page
      .getByRole("navigation")
      .locator(
        '[data-testid^="workspace-start-"][data-workspace-name="ordinary-dir"]',
      );
    await expect(sidebarStart).toBeDisabled();
    const initialList = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/conversations" &&
        response.status() === 503,
    );
    await page.reload();
    await initialList;
    await expect(sidebarStart).toBeDisabled(); // Reload alone never repeats a write.
    // A failed recheck must retain the guard, not mistake failure for absence.
    const failedList = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/conversations" &&
        response.status() === 503,
    );
    await page.getByTestId("creation-recheck").click();
    await failedList;
    await expect(sidebarStart).toBeDisabled();
    // A late read from reload/the failed recheck must not confirm creation
    // and remove this button before the distinct successful recheck click.
    await recoverOnClick(page, "creation-recheck");
    const list = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/conversations" &&
        response.ok(),
    );
    await page.getByTestId("creation-recheck").click();
    await list;
    await expect(start).toBeEnabled();
    await expect(page.getByTestId("creation-recheck")).toHaveCount(0);
    expect(writes).toBe(1);
    await page.unroute("**/api/v1/conversations");
    if (created) {
      expect(createdId).toMatch(/^pi:/);
      await expect(
        page.locator(
          `main [data-testid^="home-conversation-"][data-agent-id="${createdId}"]`,
        ),
      ).toBeVisible();
    } else {
      await start.click();
      await expect(page).toHaveURL(/conversation=pi/);
    }
  });
}

for (const landing of ["home", "workspace"]) {
  test(`@reconnect ${landing} first read releases legacy guards in home rows and sidebar without clearing sends`, async ({
    page,
  }) => {
    await open(page);
    const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
    const identity = snapshot.identity.web_identity_id;
    const workspaces = snapshot.workspaces
      .filter(
        (workspace: { mutation_state?: string }) =>
          workspace.mutation_state === "allowed",
      )
      .slice(0, 2);
    expect(workspaces).toHaveLength(2);
    const keys: string[] = workspaces.map(
      (workspace: { workspace_id: string }) =>
        `nah:${identity}:uncertain:${workspace.workspace_id}`,
    );
    const sendKey = `nah:${identity}:uncertain:pi:11111111-1111-4111-8111-111111111111`;
    await page.evaluate(
      ({ keys, sendKey }) => {
        for (const key of keys) sessionStorage.setItem(key, "create");
        sessionStorage.setItem(sendKey, "synthetic-send-command");
      },
      { keys, sendKey },
    );
    let writes = 0;
    let failList = true;
    await page.route("**/api/v1/conversations", (route) => {
      if (route.request().method() === "POST") writes++;
      if (route.request().method() === "GET" && failList)
        return route.fulfill({ status: 503 });
      return route.continue();
    });
    const path =
      landing === "home"
        ? "/workspaces"
        : `/workspaces/${workspaces[0].workspace_id}`;
    await page.goto(path);
    const pluses = () => page.getByTestId(/^workspace-start-/);
    for (const workspace of workspaces) {
      const buttons = pluses();
      const named = buttons.and(
        page.locator(
          `[data-testid^="workspace-start-"][data-workspace-name="${workspace.display_name ?? workspace.name}"]`,
        ),
      );
      await expect(named.first()).toBeDisabled();
    }
    expect(
      await page.evaluate(
        (keys) => keys.map((key) => sessionStorage.getItem(key)),
        keys,
      ),
    ).toEqual(["create", "create"]);
    failList = false;
    // No toolbar refresh or workspace visit: the first successful page read
    // must reconcile both persisted markers, including a sidebar-only row.
    await page.reload();
    await expect
      .poll(() =>
        page.evaluate(
          (keys) => keys.map((key) => sessionStorage.getItem(key)),
          keys,
        ),
      )
      .toEqual([null, null]);
    for (const workspace of workspaces) {
      const buttons = page.locator(
        `[data-testid^="workspace-start-"][data-workspace-name="${workspace.display_name ?? workspace.name}"]`,
      );
      // The markers clear when the snapshot is read; a shown loading landing
      // can still be holding its minimum time, so wait for the rows.
      const count = landing === "home" ? 2 : 1;
      await expect(buttons).toHaveCount(count);
      for (let i = 0; i < count; i++)
        await expect(buttons.nth(i)).toBeEnabled();
    }
    await page.goto(`/workspaces/${workspaces[0].workspace_id}`);
    await expect(page.getByTestId("conversation-start")).toBeEnabled();
    expect(
      await page.evaluate((key) => sessionStorage.getItem(key), sendKey),
    ).toBe("synthetic-send-command");
    expect(writes).toBe(0);
  });
}

test("@reconnect a failed recovery snapshot ends progress immediately, not at the watchdog", async ({
  page,
}) => {
  await open(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.route("**/api/v1/events*", (route) =>
    route.fulfill({ status: 409 }),
  );
  await page.request.get("/fixture/daemon-restart?transport_only=1");
  await expect(
    page.locator(
      '[data-testid^="connection-"][data-state][data-state="stale"]',
    ),
  ).toBeVisible();
  await page.getByTestId("connection-retry").click();
  // Frozen browser time: the eight-second backstop cannot satisfy this assertion.
  await expect(
    page.locator('[data-testid^="connection-"][data-state]'),
  ).toBeVisible();
  await expect(page.getByTestId("connection-retry")).toBeEnabled();
  await expect(
    page.locator(
      '[data-testid^="connection-"][data-state][data-state="stale"]',
    ),
  ).toBeVisible();
});

test("@reconnect an idle stream opens before the watchdog behind an edge that holds the response head", async ({
  page,
}) => {
  // The live Cloudflare route delivers the head only with the first body
  // bytes. An idle daemon's first bytes used to be its 20 s heartbeat, so the
  // 8 s watchdog closed every stream and the tab looped on "Yhteys katkesi".
  await page.addInitScript(() =>
    sessionStorage.setItem("oh:debug-reconnect", "true"),
  );
  await page.request.get("/fixture/edge-hold-head");
  const opened: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (text.startsWith("[reconnect]") && text.includes('"event":"stream"'))
      opened.push(JSON.parse(text.slice("[reconnect] ".length)).outcome);
  });
  await page.clock.install();
  await open(page);
  await expect.poll(() => opened.includes("open")).toBe(true);
  await page.clock.fastForward(9000);
  await expect(page.locator(".ah-connection")).toHaveCount(0);
  expect(opened).not.toContain("timeout");
});
