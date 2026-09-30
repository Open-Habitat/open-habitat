import { expect, test } from "@playwright/test";

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
    page.getByText("Tutki synteettinen työtila", { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Katson ensin, mitä työtilassa on.")).toBeVisible(
    { timeout: 20000 },
  );
  await expect(page.getByText("Selvä. Kysyit:", { exact: false })).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: /bash.*Tulos valmis/ }).click();
  await expect(
    page.getByText("README.md", { exact: false }).last(),
  ).toBeVisible();
  await expect(page.getByText("Viimeisimmät live-tapahtumat")).toHaveCount(0);
  await editor.fill("hylkää");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByText("Viesti hylättiin.", { exact: false }),
  ).toBeVisible({ timeout: 20000 });
  await expect(editor).toHaveValue("hylkää");
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeEnabled();
  await editor.fill("hidas toinen viesti");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(page.getByText("Pi työskentelee…", { exact: true })).toBeVisible(
    { timeout: 20000 },
  );
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
        if (this.url.startsWith("/api/v1/events?"))
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
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean((window as unknown as { testStream?: EventSource }).testStream),
      ),
    )
    .toBe(true);
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
    page.getByText("bash · Käynnissä", { exact: true }),
  ).toBeVisible();
});

test("@lab expired combined cursor resnapshots and reconnects without another send", async ({
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
  await page.reload();
  await expect.poll(() => streams).toBeGreaterThan(2);
  await expect.poll(() => snapshots).toBeGreaterThan(1);
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
  await expect.poll(() => streamReads).toBeGreaterThan(1);
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
    await expect(page.getByText(`Kierros ${i}`, { exact: true })).toBeVisible({
      timeout: 20000,
    });
    await expect(
      page.getByText(`Selvä. Kysyit: "Kierros ${i}".`, { exact: false }),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByRole("button", { name: "Lähetä", exact: true }),
    ).toBeEnabled({ timeout: 30000 });
  }
  await expect(page.getByText("Kierros 8", { exact: true })).toBeVisible();
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
  await expect(page.getByText("kaadu nyt", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText("Tila epävarma")).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toHaveCount(0);
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
  const intermediate = page.locator(".ah-message").filter({
    hasText: "Katson ensin, mitä työtilassa on.",
  });
  await expect(intermediate).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole("region", { name: "Pi:n työn eteneminen" }),
  ).toContainText("Pi työskentelee");
  await expect(intermediate.locator("header")).toHaveText("Pi");
});

test("@lab slow turn explains work and stop requires an explicit confirmation", async ({
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
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("hidas kaadu");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  const progress = page.getByRole("region", { name: "Pi:n työn eteneminen" });
  await expect(progress).toContainText("Pi työskentelee", { timeout: 20000 });
  await expect(progress).toContainText(/min \d+ s/);
  await expect(progress).toContainText("Käyttää työkalua: bash", {
    timeout: 12000,
  });
  await page.getByRole("button", { name: "Keskeytä" }).click();
  await expect(
    page.getByRole("group", { name: "Vahvista keskeytys" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Jatka työskentelyä" }).click();
  await expect(
    page.getByRole("group", { name: "Vahvista keskeytys" }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/työn päättymistä ei voida vahvistaa/),
  ).toBeVisible({ timeout: 20000 });
});
