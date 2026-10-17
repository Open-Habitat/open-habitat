import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function open(page: Page) {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
  ).toBeEnabled();
}

for (const restart of [false, true]) {
  test(`@reconnect explicit retry reconnects the stream and snapshot${restart ? " after Unix daemon HTTP server restart" : " at an unchanged cursor"}`, async ({
    page,
  }) => {
    await open(page);
    // Freeze backoff, not networking: only the person's click can reopen SSE.
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.route("**/api/v1/events*", (route) =>
      route.fulfill({ status: 503 }),
    );
    await page.route("**/api/v1/snapshot", (route) =>
      route.fulfill({ status: 503 }),
    );
    expect(
      (
        await page.request.get(
          `/fixture/daemon-restart${restart ? "" : "?transport_only=1"}`,
        )
      ).status(),
    ).toBe(204);
    await page.getByRole("button", { name: "Päivitä", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Yhdistä", exact: true }),
    ).toBeVisible();
    await page.unroute("**/api/v1/events*");
    await page.unroute("**/api/v1/snapshot");
    const stream = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/events" && response.ok(),
    );
    const snapshot = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/snapshot" &&
        response.ok(),
    );
    await page.getByRole("button", { name: "Yhdistä", exact: true }).click();
    await snapshot;
    await stream;
    await expect(
      page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja", {
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
    ).toBeEnabled();
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
  await expect(
    page.getByRole("button", { name: "Yhdistä", exact: true }),
  ).toBeVisible();
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
  await page.getByRole("button", { name: "Yhdistä", exact: true }).click();
  await expect(page.getByText("Yhdistetään…", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Yhdistä…", exact: true }),
  ).toBeDisabled();
  // Axe's async checks need browser timers; backoff was frozen above only to
  // distinguish a manual retry from the automatic one.
  await page.clock.resume();
  expect(
    (await new AxeBuilder({ page }).include(".ah-connection").analyze())
      .violations,
  ).toEqual([]);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  release();
  await expect(
    page.getByText(
      "Palvelimen tapahtumayhteys ei ole käytettävissä. Yritä uudelleen.",
    ),
  ).toBeVisible();
  await page.unroute("**/api/v1/events*");
  const stream = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/events" && response.ok(),
  );
  await page.getByRole("button", { name: "Yhdistä", exact: true }).click();
  await stream;
  await expect(page.locator(".ah-connection")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
  ).toBeEnabled();
});

test("@reconnect an invalid frame does not trap recovery at an unchanged native cursor", async ({
  page,
}) => {
  await open(page);
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
    await page.route("**/api/v1/conversations", async (route) => {
      if (route.request().method() !== "POST")
        return route.fulfill({ status: 503 });
      writes++;
      if (created) await route.fetch(); // The host commits, but its reply is lost.
      await route.fulfill({ status: 503, body: "{}" });
    });
    const start = page.getByRole("button", {
      name: "Aloita uusi Pi-keskustelu",
    });
    // Creation remains singular; the current header exposes workspace actions
    // directly rather than under the old ellipsis menu.
    const header = page.locator(".ah-workspace-page-head");
    await expect(
      header.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
    ).toHaveCount(1);
    await expect(
      header.getByRole("button", { name: "Kopioi polku" }),
    ).toBeVisible();
    await start.click();
    await expect(
      page
        .getByRole("region", { name: "Keskustelu", exact: true })
        .getByText(/Luonnin tulos epävarma/),
    ).toBeVisible();
    const sidebarStart = page.getByRole("navigation").getByRole("button", {
      name: "Uusi keskustelu työtilassa ordinary-dir",
      exact: true,
    });
    await expect(sidebarStart).toBeDisabled();
    await page.reload();
    await expect(sidebarStart).toBeDisabled(); // Reload alone never repeats a write.
    // A failed recheck must retain the guard, not mistake failure for absence.
    const failedList = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/conversations" &&
        response.status() === 503,
    );
    await page.getByRole("button", { name: "Tarkista luonnin tulos" }).click();
    await failedList;
    await expect(sidebarStart).toBeDisabled();
    await page.unroute("**/api/v1/conversations");
    const list = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/conversations" &&
        response.ok(),
    );
    await page.getByRole("button", { name: "Tarkista luonnin tulos" }).click();
    await list;
    await expect(start).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Tarkista luonnin tulos" }),
    ).toHaveCount(0);
    expect(writes).toBe(1);
    if (created) {
      await expect(
        page.locator("main").getByRole("link", { name: /Uusi keskustelu/ }),
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
    const pluses = () =>
      page.getByRole("button", { name: /Uusi keskustelu työtilassa/ });
    for (const workspace of workspaces) {
      const buttons = pluses().filter({ hasText: "+" });
      const named = buttons.and(
        page.getByRole("button", {
          name: `Uusi keskustelu työtilassa ${workspace.display_name ?? workspace.name}`,
          exact: true,
        }),
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
      const buttons = page.getByRole("button", {
        name: `Uusi keskustelu työtilassa ${workspace.display_name ?? workspace.name}`,
        exact: true,
      });
      // The markers clear when the snapshot is read; a shown loading landing
      // can still be holding its minimum time, so wait for the rows.
      const count = landing === "home" ? 2 : 1;
      await expect(buttons).toHaveCount(count);
      for (let i = 0; i < count; i++)
        await expect(buttons.nth(i)).toBeEnabled();
    }
    await page.goto(`/workspaces/${workspaces[0].workspace_id}`);
    await expect(
      page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
    ).toBeEnabled();
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
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yhdistä", exact: true }).click();
  // Frozen browser time: the eight-second backstop cannot satisfy this assertion.
  await expect(
    page.getByText("Palvelimen tilaa ei saatu tarkistettua. Yritä uudelleen.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Yhdistä", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText(
      /Kirjoittavat toiminnot odottavat yhteyttä; luonnos ja lukukohta säilyvät/,
    ),
  ).toBeVisible();
});

test("@reconnect an idle stream opens before the watchdog behind an edge that holds the response head", async ({
  page,
}) => {
  // The live Cloudflare route delivers the head only with the first body
  // bytes. An idle daemon's first bytes used to be its 20 s heartbeat, so the
  // 8 s watchdog closed every stream and the tab looped on "Yhteys katkesi".
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
