import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
async function openTurnWork(page: import("@playwright/test").Page) {
  const turn = page.getByRole("region", { name: "Agentin vuoro" }).last();
  const live = turn.getByRole("button", { name: "Näytä työ" });
  const settled = turn.getByRole("button", { name: /PI.*ajatusta/ });
  await expect(live.or(settled)).toBeVisible({ timeout: 20000 });
  if (await live.isVisible()) await live.click();
  else if ((await settled.getAttribute("aria-expanded")) === "false")
    await settled.click();
}

// The real synthetic controller has a bounded live-child budget. Each browser
// journey owns a fresh disposable daemon incarnation, not a previous test's Pi.
test.beforeEach(async ({ page }) => {
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});

test("@lab browser Pi resolves the user's own executable", async ({ page }) => {
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
    .fill("agent path probe");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  const turn = page.getByRole("region", { name: "Agentin vuoro" }).last();
  await expect(turn.getByRole("button", { name: /PI.*ajatusta/ })).toBeVisible({
    timeout: 20000,
  });
  await turn.getByRole("button", { name: /PI.*ajatusta/ }).click();
  const bash = turn.getByRole("button", { name: /bash.*valmis/ });
  await expect(bash).toBeVisible({ timeout: 20000 });
  if ((await bash.getAttribute("aria-expanded")) === "false")
    await bash.click();
  await expect(page.getByText("agent-probe: alice")).toBeVisible();
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
    // Measure the visible surfaces, not the composer's padded wrapper. The
    // same card-to-control rhythm must survive both footer types and widths.
    const history = await page.context().newPage();
    await history.goto(`/agents/${id}`);
    await expect(history.locator(".ah-read-only-footer")).toBeVisible();
    await expect(history.locator(".ah-recap")).toBeVisible();
    let desktopGap: number | undefined;
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await history.setViewportSize({ width, height: 900 });
      const gaps: number[] = [];
      for (const [view, surface] of [
        [page, ".ah-composer-entry"],
        [history, ".ah-read-only-footer"],
      ] as const) {
        const cardBox = await view.locator(".ah-recap").boundingBox();
        const controlBox = await view.locator(surface).boundingBox();
        if (!cardBox || !controlBox) throw new Error("Missing footer geometry");
        const gap = controlBox.y - (cardBox.y + cardBox.height);
        expect(gap).toBeGreaterThan(0);
        gaps.push(gap);
      }
      expect(Math.abs(gaps[0] - gaps[1])).toBeLessThan(1);
      desktopGap ??= gaps[0];
      expect(Math.abs(gaps[0] - desktopGap)).toBeLessThan(1);
    }
    await history.close();
    await page.setViewportSize({ width: 1440, height: 900 });
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

test("@lab unsupported-model action remains usable when a native recap arrives", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1100, height: 600 });
  expect(
    (
      await page.request.get("/fixture/scenario?value=pi-recap-unsupported")
    ).status(),
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
    await page.getByRole("textbox", { name: "Viesti Pi:lle" }).fill("kokeilu");
    await page.getByRole("button", { name: "Lähetä", exact: true }).click();
    const warning = page.getByText("Valittu kielimalli ei ole käytettävissä");
    await expect(warning).toBeVisible();
    await page.getByRole("button", { name: "Valitse toinen malli" }).click();
    const selector = page.locator(
      ".ah-actionable-notices .ah-pi-model-selector",
    );
    await expect(selector).toBeVisible();
    const id = new URL(page.url()).searchParams.get("conversation")?.slice(3);
    expect(id).toBeTruthy();
    const { csrf } = await (await page.request.get("/auth/session")).json();
    const response = await page.request.post(
      `/api/v1/conversations/${id}/recap`,
      {
        headers: {
          "X-Agent-Host-CSRF": csrf,
          Origin: new URL(page.url()).origin,
        },
      },
    );
    expect(response.status()).toBe(200);
    await expect(
      page.getByRole("complementary", { name: "Keskustelun yhteenveto" }),
    ).toBeVisible();

    await expect(warning).toBeInViewport();
    await expect(selector).toBeInViewport();
    await selector.getByRole("radio", { name: /GPT-6 Astra/ }).check();
    await selector
      .getByRole("button", {
        name: "Aloita uusi keskustelu mallilla gpt-6-astra",
      })
      .click();
    await expect
      .poll(
        async () =>
          (await (await page.request.get("/api/v1/pi/models")).json())
            .default_model,
      )
      .toBe("gpt-6-astra");
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
  const settledTurn = page
    .getByRole("region", { name: "Agentin vuoro" })
    .last();
  await settledTurn.getByRole("button", { name: /PI.*ajatusta/ }).click();
  const bash = settledTurn.getByRole("button", { name: /bash.*valmis/ });
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
    await openTurnWork(page);
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
    await openTurnWork(page);
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
    await openTurnWork(page);
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
    await openTurnWork(page);
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
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(page).toHaveURL(/\?conversation=pi:/);
  // Request our own body: Chromium may discard an in-page snapshot response
  // when the creation action navigates to the new conversation.
  const newSnapshot = await (await page.request.get("/api/v1/snapshot")).json();
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
        {
          tool_call_id: "synthetic-tool",
          tool_name: "write",
          state: "running",
        },
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
  await openTurnWork(page);
  await expect(page.getByText("Synteettinen live-teksti")).toBeVisible();
  await expect(
    page.locator(".ah-live-tool-row").getByText("ajossa"),
  ).toBeVisible();
  const tool = page.locator(".ah-live-tool-row .ah-tool-row");
  const toggle = tool.getByRole("button").first();
  if ((await toggle.getAttribute("aria-expanded")) === "false")
    await toggle.click();
  await expect(tool).toHaveAttribute("data-state", "running");
  await expect(tool.locator(".ah-disclosure-panel")).toBeVisible();
  await tool.evaluate((node) => {
    (window as unknown as { openTool: Element }).openTool = node;
    const panel = node.querySelector(".ah-disclosure-panel") as HTMLElement;
    (window as unknown as { openPanel: Element }).openPanel = panel;
    panel.style.height = "20px";
    panel.style.overflow = "auto";
    const spacer = document.createElement("div");
    spacer.style.height = "100px";
    panel.append(spacer);
    panel.scrollTop = 12;
  });
  await page.evaluate(() => {
    const source = (window as unknown as { testStream: EventSource })
      .testStream;
    const after =
      new URL(source.url, location.href).searchParams.get("after") ?? "";
    const parts = /^ev1:([0-9a-f-]{36}):(\d+)$/.exec(after);
    if (!parts) throw new Error("missing cursor");
    const cursor = `ev1:${parts[1]}:${Number(parts[2]) + 3}`;
    source.dispatchEvent(
      new MessageEvent("assistant.delta", {
        lastEventId: cursor,
        data: JSON.stringify({
          schema_version: 1,
          event_id: "evt_abcdefgh3",
          cursor,
          server_instance_id: parts[1],
          sequence: Number(parts[2]) + 3,
          emitted_at: "2026-09-30T20:00:01Z",
          kind: "assistant.delta",
          resource: {
            agent_id: new URL(location.href).searchParams.get("conversation"),
          },
          payload: { text: "Myöhempi lohko", content_index: 1 },
        }),
      }),
    );
  });
  await expect(page.getByText("Myöhempi lohko")).toBeVisible();
  expect(
    await tool.evaluate(
      (node) => node === (window as unknown as { openTool: Element }).openTool,
    ),
  ).toBe(true);
  expect(
    await tool.evaluate((node) => {
      const panel = node.querySelector(".ah-disclosure-panel") as HTMLElement;
      return (
        panel === (window as unknown as { openPanel: Element }).openPanel &&
        panel.scrollTop === 12
      );
    }),
  ).toBe(true);
  await expect(tool.getByRole("button").first()).toHaveAttribute(
    "aria-expanded",
    "true",
  );
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
  // Recovery is injected only after the native answer has settled. This case
  // does not need the deliberately slow Pi turn used by in-flight races.
  await editor.fill("stream-tarkistus");
  let sends = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/send")) sends++;
  });
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByText('Selvä. Kysyit: "stream-tarkistus".', {
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
    page.getByText('Selvä. Kysyit: "stream-tarkistus".', {
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
  // A just-crashed child can leave the native history unsettled for the first
  // explicit proof. Retry the status check, never the message or continuation.
  await expect(async () => {
    await page
      .getByRole("button", { name: "Tarkista keskustelun tila" })
      .click();
    await expect(
      page.getByRole("button", { name: "Jatka keskustelua" }),
    ).toBeVisible({ timeout: 1000 });
  }).toPass({ intervals: [1000, 1500, 2000], timeout: 15000 });
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
  await page.getByRole("textbox", { name: "Viesti Pi:lle" }).fill("kaadu");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  // The visual-hold scenario stops native Pi at tool start until the fixture
  // releases it below. Inspect the intermediate reply while the turn is live.
  const intermediate = page
    .locator(".ah-turn-reply > .ah-message")
    .filter({ hasText: "Katson ensin, mitä työtilassa on." })
    .last();
  await expect(intermediate).toBeVisible({ timeout: 20000 });
  await expect(intermediate.locator("header")).toHaveText("Vastaa");
  const progress = page.getByRole("status", { name: "Pi:n työn eteneminen" });
  await expect(progress).toContainText(
    /Käyttää työkalua|Odottaa Pi:n seuraavaa vaihetta|Valmistelee seuraavaa vaihetta/,
    { timeout: 20000 },
  );
  await expect(progress).toContainText("Käyttää työkalua bash", {
    timeout: 20000,
  });
  const stopOffset = await page
    .getByRole("button", { name: "Keskeytä" })
    .evaluate((button) => {
      const outer = button.getBoundingClientRect();
      const square = button.querySelector("rect")?.getBoundingClientRect();
      if (!square) throw new Error("Missing Stop square");
      return {
        dx: Math.abs(
          (outer.left + outer.right) / 2 - (square.left + square.right) / 2,
        ),
        dy: Math.abs(
          (outer.top + outer.bottom) / 2 - (square.top + square.bottom) / 2,
        ),
      };
    });
  expect(stopOffset.dx).toBeLessThanOrEqual(0.5);
  expect(stopOffset.dy).toBeLessThanOrEqual(0.5);
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
