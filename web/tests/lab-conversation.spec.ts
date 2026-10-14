import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

// The real synthetic controller has a bounded live-child budget. Each browser
// journey owns a fresh disposable daemon incarnation, not a previous test's Pi.
test.beforeEach(async ({ page }) => {
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});

test("@lab recap is separate, persisted and becomes stale after a new turn", async ({
  page,
}) => {
  test.setTimeout(90000);
  expect(
    (await page.request.get("/fixture/scenario?value=pi-recap")).status(),
  ).toBe(204);
  try {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "aurinkokello" })
      .click();
    await page
      .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
      .click();
    const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
    await editor.fill("Tutki synteettinen työtila");
    await page.getByRole("button", { name: "Lähetä", exact: true }).click();
    await expect(
      page.getByText('Selvä. Kysyit: "Tutki synteettinen työtila".', {
        exact: false,
      }),
    ).toBeVisible({ timeout: 20000 });
    // A browser-only draft does not reach Pi and must not defer native idle.
    await editor.fill("Luonnos, jota ei lähetetä");
    const card = page.getByRole("complementary", {
      name: "Keskustelun yhteenveto",
    });
    await expect(card.getByText("luotu automaattisesti")).toBeVisible({
      timeout: 20000,
    });
    await expect(editor).toHaveValue("Luonnos, jota ei lähetetä");
    const cardWidth = await card.evaluate(
      (node) => node.getBoundingClientRect().width,
    );
    const editorWidth = await page
      .locator(".ah-composer-entry")
      .evaluate((node) => node.getBoundingClientRect().width);
    expect(Math.abs(cardWidth - editorWidth)).toBeLessThan(1);
    const layout = await page.evaluate(() => {
      const rect = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect();
      return {
        markerRight: rect(".ah-turn-head")?.right,
        recapRight: rect(".ah-recap")?.right,
        composerRight: rect(".ah-composer-entry")?.right,
        editorHeight: rect(".ah-composer-entry textarea")?.height,
      };
    });
    expect(
      Math.abs((layout.markerRight ?? 0) - (layout.recapRight ?? 0)),
    ).toBeLessThan(1);
    expect(
      Math.abs((layout.composerRight ?? 0) - (layout.recapRight ?? 0)),
    ).toBeLessThan(1);
    expect(layout.editorHeight).toBeLessThanOrEqual(46);
    await expect(
      card.getByText("Synteettinen työtila tutkittiin ja vastaus valmistui."),
    ).toBeVisible();
    expect(
      await card.evaluate((node) => {
        const editor = document.querySelector(".ah-composer");
        return (
          editor &&
          node.getBoundingClientRect().bottom <=
            editor.getBoundingClientRect().top
        );
      }),
    ).toBe(true);
    await expect(
      page
        .getByRole("region", { name: "Keskusteluhistoria" })
        .getByText("Synteettinen työtila tutkittiin ja vastaus valmistui."),
    ).toHaveCount(0);
    const id = new URL(page.url()).searchParams.get("conversation");
    expect(id).toMatch(/^pi:/);
    const native = await (
      await page.request.get(`/api/v1/agents/${id}/recap`)
    ).json();
    expect(native.recap.through).toBe(native.latest_message);
    expect(native.recap.trigger).toBe("automatic");
    const other = await page.context().newPage();
    await other.goto(page.url());
    await expect(
      other
        .getByRole("complementary", { name: "Keskustelun yhteenveto" })
        .getByText("luotu automaattisesti"),
    ).toBeVisible();
    await page.reload();
    await expect(
      card.getByText("Synteettinen työtila tutkittiin ja vastaus valmistui."),
    ).toBeVisible();
    await card.getByRole("button", { name: "Päivitä katsaus" }).click();
    const again = await (
      await page.request.get(`/api/v1/agents/${id}/recap`)
    ).json();
    expect(again.recap.generated_at).toBe(native.recap.generated_at);
    await editor.fill("hidas toinen viesti");
    await page.getByRole("button", { name: "Lähetä", exact: true }).click();
    await expect(card).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Lataa seuraava historiasivu" }),
    ).toHaveCount(0);
    await expect(
      other.getByRole("complementary", { name: "Keskustelun yhteenveto" }),
    ).toHaveCount(0);
    await other.close();
    await page.reload();
    await expect(card).toHaveCount(0);
    await expect(card.getByText("luotu automaattisesti")).toBeVisible({
      timeout: 30000,
    });
    const newer = await (
      await page.request.get(`/api/v1/agents/${id}/recap`)
    ).json();
    expect(newer.recap.through).not.toBe(native.recap.through);
  } finally {
    expect(
      (await page.request.get("/fixture/scenario?value=ready")).status(),
    ).toBe(204);
  }
});

test("@lab real controller creates and persists a fake-Pi turn", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "aurinkokello" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello" })
    .click();
  await page.goto("/agents/pi:a1a1a1a1-0000-4000-8000-000000000001");
  await expect(
    page
      .locator("main")
      .getByRole("heading", { name: /Lisää komentoriville --json-lippu/ }),
  ).toBeVisible();
  await page
    .locator("main")
    .getByRole("link", { name: "aurinkokello" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  const agent = new URL(page.url()).searchParams.get("conversation");
  expect(agent).toMatch(/^pi:/);
  await editor.fill("Tutki synteettinen työtila");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Keskusteluhistoria" })
      .getByText("Tutki synteettinen työtila", { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page
      .getByRole("region", { name: "Agentin vuoro" })
      .getByText("Katson ensin, mitä työtilassa on.", { exact: true })
      .first(),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Selvä. Kysyit:", { exact: false })).toBeVisible({
    timeout: 20000,
  });
  const bash = page.getByRole("button", { name: /bash.*valmis/ });
  if ((await bash.getAttribute("aria-expanded")) === "false")
    await bash.click();
  await expect(
    page.getByText("README.md", { exact: false }).last(),
  ).toBeVisible();
  await expect(page.getByText("Viimeisimmät live-tapahtumat")).toHaveCount(0);
  // The fake Pi has no model runtime. Explicit regeneration reports a fixed
  // reason without erasing the native-history first-prompt fallback.
  const titleReply = page.waitForResponse((response) =>
    response.url().endsWith("/regenerate_title"),
  );
  await page.getByRole("button", { name: "Luo uusi otsikko" }).click();
  expect(await (await titleReply).json()).toMatchObject({
    state: "failed",
    reason: "model_unavailable",
  });
  await expect(page.getByText("Otsikkoa ei voitu luoda")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tutki synteettinen työtila" }),
  ).toBeVisible();
  await editor.fill("hylkää");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByRole("alert").getByText("Hylätty · teksti säilytettiin"),
  ).toBeVisible({ timeout: 20000 });
  await expect(editor).toHaveValue("hylkää");
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeEnabled();
  await editor.fill("hidas toinen viesti");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Pi:n työn eteneminen" }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByText('Selvä. Kysyit: "hidas toinen viesti".', { exact: false }),
  ).toBeVisible({ timeout: 30000 });
  await page.reload();
  await expect(
    page.getByText('Selvä. Kysyit: "hidas toinen viesti".', { exact: false }),
  ).toBeVisible();
  const navLink = page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: /Tutki synteettinen työtila/ })
    .last();
  await expect(navLink).toBeVisible();
  await expect(navLink).toHaveAttribute(
    "href",
    new RegExp(`conversation=${agent}`),
  );
  await page
    .getByRole("link", { name: "aurinkokello", exact: true })
    .last()
    .click();
  await navLink.click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  expect(
    snapshot.agents.some(
      (entry: { agent_id: string }) => entry.agent_id === agent,
    ),
  ).toBe(true);
});

test("@lab title regeneration pending state does not return after navigation", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("A conversation");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByText('Selvä. Kysyit: "A conversation".', { exact: false }),
  ).toBeVisible({ timeout: 20000 });
  // An in-flight A request can finish while B is open. Returning to A must
  // not resurrect the old generation's pending button or failure notice.
  let releaseTitle: (() => void) | undefined;
  await page.route("**/regenerate_title", async (route) => {
    await new Promise<void>((resolve) => {
      releaseTitle = resolve;
    });
    await route
      .fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"schema_version":1,"state":"failed"}',
      })
      .catch(() => {});
  });
  await page.getByRole("button", { name: "Luo uusi otsikko" }).click();
  await expect.poll(() => !!releaseTitle).toBe(true);
  await page
    .getByRole("link", { name: "aurinkokello", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  releaseTitle?.();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /A conversation/ })
    .last()
    .click();
  await expect(
    page.getByRole("button", { name: "Luo uusi otsikko" }),
  ).toBeEnabled();
  await expect(page.getByText("Otsikkoa ei voitu luoda")).toHaveCount(0);
  await page.unroute("**/regenerate_title");
});

test("@lab typed Pi fragments converge to saved blocks across paging, reconnect and warm return", async ({
  page,
}) => {
  test.setTimeout(90000);
  expect(
    (await page.request.get("/fixture/scenario?value=pi-typed")).status(),
  ).toBe(204);
  try {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "aurinkokello" })
      .click();
    await page
      .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
      .click();
    const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
    await editor.fill("hidas typed-journey");
    await page.getByRole("button", { name: "Lähetä", exact: true }).click();
    await expect(page.getByText("Synteettinen pohdinta")).toBeVisible({
      timeout: 20000,
    });
    await expect(page.locator(".ah-live-tool-row")).toHaveCount(1, {
      timeout: 20000,
    });
    await expect(
      page.getByText('Selvä. Kysyit: "hidas typed-journey".', { exact: false }),
    ).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".ah-live-tool-row")).toHaveCount(0, {
      timeout: 30000,
    });
    await expect(page.getByText("Synteettinen pohdinta")).toHaveCount(1);
    let gapInjected = false;
    let recoveryReads = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/v1/snapshot")
        recoveryReads++;
    });
    await page.route("**/api/v1/events?after=*", async (route) => {
      if (gapInjected) return route.continue();
      gapInjected = true;
      const after =
        new URL(route.request().url()).searchParams.get("after") ?? "";
      const match = /^ev1:([0-9a-f-]{36}):(\d+)$/.exec(after);
      if (!match) throw new Error("missing cursor");
      const sequence = Number(match[2]) + 2;
      const cursor = `ev1:${match[1]}:${sequence}`;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `id: ${cursor}\nevent: assistant.thinking.delta\ndata: ${JSON.stringify({ schema_version: 1, event_id: "evt_abcdefgh12345", cursor, server_instance_id: match[1], sequence, emitted_at: "2026-09-30T20:00:00Z", kind: "assistant.thinking.delta", resource: { agent_id: new URL(page.url()).searchParams.get("conversation") }, payload: { text: "must not appear", content_index: 1 } })}\n\n`,
      });
    });
    await page.reload();
    await expect.poll(() => gapInjected).toBe(true);
    await expect.poll(() => recoveryReads).toBeGreaterThan(1);
    await expect(page.getByText("must not appear")).toHaveCount(0);
    await expect(page.getByText("Synteettinen pohdinta")).toHaveCount(1);
    await expect(page.locator(".ah-live-tool-row")).toHaveCount(0);
    const conversation = page.url();
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "aurinkokello" })
      .click();
    await page.goto(conversation);
    await expect(page.getByText("Synteettinen pohdinta")).toHaveCount(1);
    await expect(page.locator(".ah-live-tool-row")).toHaveCount(0);
  } finally {
    expect(
      (await page.request.get("/fixture/scenario?value=ready")).status(),
    ).toBe(204);
  }
});
test("@lab browser renders provisional delta and tool from verified combined SSE frames", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Native = window.EventSource;
    window.EventSource = class extends EventTarget {
      static readonly CONNECTING = Native.CONNECTING;
      static readonly OPEN = Native.OPEN;
      static readonly CLOSED = Native.CLOSED;
      readonly CONNECTING = Native.CONNECTING;
      readonly OPEN = Native.OPEN;
      readonly CLOSED = Native.CLOSED;
      readonly withCredentials = false;
      readonly url: string;
      readyState: number = Native.OPEN;
      onopen: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      constructor(url: string | URL) {
        super();
        this.url = String(url);
      }
      override addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
      ) {
        super.addEventListener(type, listener, options);
        // The hook is ready only after the consumer installs its listeners.
        if (type === "unknown.native" && this.url.startsWith("/api/v1/events?"))
          Object.assign(window, { testStream: this });
      }
      close() {
        this.readyState = Native.CLOSED;
      }
    } as typeof EventSource;
  });
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello" })
    .click();
  const refreshed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/snapshot" &&
      response.status() === 200,
  );
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const newSnapshot = await (await refreshed).json();
  const agentId = new URL(page.url()).searchParams.get("conversation");
  expect(
    newSnapshot.agents.some(
      (agent: { agent_id: string }) => agent.agent_id === agentId,
    ),
  ).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { testStream?: EventSource }).testStream?.url,
      ),
    )
    .toContain(encodeURIComponent(newSnapshot.event_cursor));
  await page.evaluate(async () => {
    const source = (window as unknown as { testStream: EventSource })
      .testStream;
    const after =
      new URL(source.url, location.href).searchParams.get("after") ?? "";
    const parts = /^ev1:([0-9a-f-]{36}):(\d+)$/.exec(after);
    if (!parts) throw new Error("missing cursor");
    const agent = new URL(location.href).searchParams.get("conversation");
    for (const [index, kind, payload] of [
      [
        1,
        "assistant.delta",
        { text: "Synteettinen live-teksti", content_index: 0 },
      ],
      [
        2,
        "tool.started",
        { tool_call_id: "synthetic-tool", tool_name: "bash", state: "running" },
      ],
    ] as const) {
      const sequence = Number(parts[2]) + index;
      const cursor = `ev1:${parts[1]}:${sequence}`;
      source.dispatchEvent(
        new MessageEvent(kind, {
          lastEventId: cursor,
          data: JSON.stringify({
            schema_version: 1,
            event_id: `evt_abcdefgh${index}`,
            cursor,
            server_instance_id: parts[1],
            sequence,
            emitted_at: "2026-09-30T20:00:00Z",
            kind,
            resource: { agent_id: agent },
            payload,
          }),
        }),
      );
    }
  });
  await expect(page.getByText("Synteettinen live-teksti")).toBeVisible();
  await expect(
    page.locator(".ah-live-tool-row").getByText("ajossa"),
  ).toBeVisible();
});

test("@lab expired combined cursor waits for a newer snapshot without another send", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  // Tear down the old EventSource before arming the interception. Otherwise an
  // old-page reconnect can consume one of the two forced 409s before return.
  const conversationURL = page.url();
  await page.goto("about:blank");
  let snapshots = 0;
  let streams = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/snapshot") snapshots++;
  });
  await page.route("**/api/v1/events?after=*", async (route) => {
    streams++;
    if (streams <= 2)
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: '{"code":"cursor_expired"}',
      });
    else await route.continue();
  });
  await page.goto(conversationURL);
  await expect.poll(() => streams).toBe(2); // initial connection and its 409 probe
  await expect.poll(() => snapshots).toBeGreaterThan(1);
  // This synthetic 409 does not advance the daemon cursor. Reopening from the
  // same stale snapshot would replay a known-expired cursor forever.
  expect(streams).toBe(2);
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
});

test("@lab combined stream reconciles a forced gap without reposting", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await editor.fill("hidas stream-tarkistus");
  let sends = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/send")) sends++;
  });
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByText('Selvä. Kysyit: "hidas stream-tarkistus".', {
      exact: false,
    }),
  ).toBeVisible({ timeout: 30000 });
  expect(sends).toBe(1);
  let snapshotReads = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/snapshot") snapshotReads++;
  });
  let injected = false;
  let streamReads = 0;
  await page.route("**/api/v1/events?after=*", async (route) => {
    streamReads++;
    if (injected) return route.continue();
    injected = true;
    const after =
      new URL(route.request().url()).searchParams.get("after") ?? "";
    const match = /^ev1:([0-9a-f-]{36}):(\d+)$/.exec(after);
    if (!match) throw new Error("missing snapshot cursor");
    const sequence = Number(match[2]) + 2; // Deliberately skip one frame.
    const cursor = `ev1:${match[1]}:${sequence}`;
    const frame = {
      schema_version: 1,
      event_id: "evt_abcdefgh12345",
      cursor,
      server_instance_id: match[1],
      sequence,
      emitted_at: "2026-09-30T20:00:00Z",
      kind: "assistant.delta",
      resource: {
        agent_id: new URL(page.url()).searchParams.get("conversation"),
      },
      payload: { text: "This frame must not appear", content_index: 0 },
    };
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: `id: ${cursor}\nevent: assistant.delta\ndata: ${JSON.stringify(frame)}\n\n`,
    });
  });
  await page.reload();
  await expect.poll(() => injected).toBe(true);
  await expect.poll(() => snapshotReads).toBeGreaterThan(1);
  // The injected gap is ahead of the native daemon. Until its snapshot moves
  // past that cursor, the router must not reopen from the stale position.
  expect(streamReads).toBe(1);
  await expect(page.getByText("This frame must not appear")).toHaveCount(0);
  await expect(
    page.getByText('Selvä. Kysyit: "hidas stream-tarkistus".', {
      exact: false,
    }),
  ).toBeVisible();
  expect(sends).toBe(1);
});

test("@lab fresh replies remain visible across native history pages", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: "aurinkokello" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  for (let i = 1; i <= 8; i++) {
    await editor.fill(`Kierros ${i}`);
    await page.getByRole("button", { name: "Lähetä", exact: true }).click();
    await expect(
      page
        .getByRole("region", { name: "Keskusteluhistoria" })
        .getByText(`Kierros ${i}`, { exact: true }),
    ).toBeVisible({
      timeout: 20000,
    });
    await expect(
      page.getByText(`Selvä. Kysyit: "Kierros ${i}".`, { exact: false }),
    ).toBeVisible({ timeout: 30000 });
    await expect(editor).toBeEnabled({ timeout: 30000 });
  }
  await expect(
    page
      .getByRole("region", { name: "Keskusteluhistoria" })
      .getByText("Kierros 8", { exact: true }),
  ).toBeVisible();
});

test("@lab fake-Pi crash leaves the turn readable but blocks another send", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: "aurinkokello" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await editor.fill("kaadu nyt");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Keskusteluhistoria" })
      .getByText("kaadu nyt", { exact: true }),
  ).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator("main").getByText("Lähetys epävarma")).toBeVisible({
    timeout: 20000,
  });
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toHaveCount(0);
  // The live transition to uncertain does not run an expensive continuation
  // proof on a journal event. A deliberate status check can request one.
  await page.getByRole("button", { name: "Tarkista keskustelun tila" }).click();
  await expect(
    page.getByRole("button", { name: "Jatka keskustelua" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "kaadu nyt" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Jatka keskustelua" }),
  ).toBeVisible();
});

test("@lab intermediate assistant message does not claim turn completion", async ({
  page,
}) => {
  expect(
    (await page.request.get("/fixture/scenario?value=pi-visual-hold")).status(),
  ).toBe(204);
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: "aurinkokello" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("hidas tarkistus");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  const intermediate = page
    .locator(".ah-turn-reply > .ah-message")
    .filter({
      hasText: "Katson ensin, mitä työtilassa on.",
    })
    .last();
  await expect(intermediate).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole("status", { name: "Pi:n työn eteneminen" }),
  ).toContainText(
    /Käyttää työkalua|Odottaa Pi:n seuraavaa vaihetta|Valmistelee seuraavaa vaihetta/,
  );
  await expect(intermediate.locator("header")).toHaveText("Vastaa");
  expect(
    (await page.request.get("/fixture/scenario?value=ready")).status(),
  ).toBe(204);
});

test("@lab slow turn explains work and stop requires an explicit confirmation", async ({
  page,
}) => {
  expect(
    (await page.request.get("/fixture/scenario?value=pi-visual-hold")).status(),
  ).toBe(204);
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: "aurinkokello" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("hidas kaadu");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  const progress = page.getByRole("status", { name: "Pi:n työn eteneminen" });
  await expect(progress).toContainText(
    /Käyttää työkalua|Odottaa Pi:n seuraavaa vaihetta|Valmistelee seuraavaa vaihetta/,
    { timeout: 20000 },
  );
  await expect(progress).toContainText("Käyttää työkalua bash", {
    timeout: 20000,
  });
  const stop = page.getByRole("button", { name: "Keskeytä" });
  await expect(stop).toHaveCSS("width", "30px");
  await expect(page.getByRole("button", { name: "Ohjaa" })).toHaveCSS(
    "height",
    "26px",
  );
  await stop.click();
  await expect(
    page.getByRole("group", { name: "Vahvista keskeytys" }),
  ).toHaveCount(0);
  expect(
    (await page.request.get("/fixture/scenario?value=ready")).status(),
  ).toBe(204);
  await expect(
    page.getByText(/työn päättymistä ei voida vahvistaa/),
  ).toBeVisible({ timeout: 20000 });
});

test("@lab idle conversation uses journal alone and journal heartbeat is 20 seconds", async ({
  page,
}) => {
  test.setTimeout(45000);
  expect(
    (await page.request.get("/fixture/scenario?value=pi-deltas")).status(),
  ).toBe(204);
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello" })
    .click();
  const firstStatus = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/conversations/") &&
      new URL(response.url()).pathname.endsWith("/status") &&
      response.ok(),
  );
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  await firstStatus;
  // Wait for the initial status and event-stream handshake to settle before
  // timing a genuinely idle window. The editor can render before either ends.
  await page.waitForTimeout(1000);
  let statusReads = 0;
  let removedStreams = 0;
  let journalReads = 0;
  const observed: string[] = [];
  const started = Date.now();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname.endsWith("/status") &&
      url.pathname.includes("/conversations/")
    ) {
      observed.push(`status +${Date.now() - started}ms ${url.search}`);
      statusReads++;
    }
    if (
      url.pathname.endsWith("/stream") &&
      url.pathname.includes("/conversations/")
    )
      removedStreams++;
    if (url.pathname === "/api/v1/events") {
      observed.push(`journal +${Date.now() - started}ms`);
      journalReads++;
    }
  });
  const heartbeat = await page.evaluate(async () => {
    const snapshot = await (await fetch("/api/v1/snapshot")).json();
    const start = performance.now();
    const response = await fetch(
      `/api/v1/events?after=${encodeURIComponent(snapshot.event_cursor)}`,
    );
    if (!response.body) throw new Error("journal response missing body");
    const reader = response.body.getReader();
    let text = "";
    try {
      while (performance.now() - start < 25000) {
        const result = await reader.read();
        if (result.done) break;
        text += new TextDecoder().decode(result.value);
        if (text.includes(": heartbeat")) break;
      }
    } finally {
      await reader.cancel();
    }
    return { elapsed: performance.now() - start, text };
  });
  expect(heartbeat.text).toContain(": heartbeat");
  expect(heartbeat.elapsed).toBeGreaterThanOrEqual(18000);
  expect(heartbeat.elapsed).toBeLessThan(25000);
  expect(statusReads, observed.join(", ")).toBe(0);
  expect(removedStreams, observed.join(", ")).toBe(0);
  expect(journalReads, observed.join(", ")).toBe(1); // the explicit heartbeat observation only
});
