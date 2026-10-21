import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
async function openTurnWork(page: import("@playwright/test").Page) {
  const turn = page.getByTestId("agent-turn").last();
  const live = turn.getByTestId("turn-work-toggle");
  const settled = turn.getByTestId("history-stage-toggle");
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
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").fill("agent path probe");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const turn = page.getByTestId("agent-turn").last();
  await expect(turn.getByTestId("history-stage-toggle")).toBeVisible({
    timeout: 20000,
  });
  await turn.getByTestId("history-stage-toggle").click();
  const bash = turn
    .getByTestId("tool-row")
    .and(page.locator('[data-tool-name="bash"]'))
    .getByTestId("history-tool-toggle");
  await expect(bash).toBeVisible({ timeout: 20000 });
  if ((await bash.getAttribute("aria-expanded")) === "false")
    await bash.click();
  await expectNativeContent(page, "agent-probe: alice", {});
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
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    await page
      .getByRole("navigation")
      .getByTestId("workspace-aurinkokello")
      .click();
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    const editor = page.getByTestId("message-input");
    await editor.fill("Tutki synteettinen työtila");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await expectNativeContent(
      page,
      'Selvä. Kysyit: "Tutki synteettinen työtila".',
      { timeout: 20000 },
    );
    // A browser-only draft does not reach Pi and must not defer native idle.
    await editor.fill("Luonnos, jota ei lähetetä");
    const card = page.getByTestId("recap-card");
    await expect(card.getByTestId("recap-generated")).toBeVisible({
      timeout: 20000,
    });
    await expect(editor).toHaveValue("Luonnos, jota ei lähetetä");
    const cardWidth = await card.evaluate(
      (node) => node.getBoundingClientRect().width,
    );
    const editorWidth = await page
      .locator(".ah-cbox")
      .evaluate((node) => node.getBoundingClientRect().width);
    expect(Math.abs(cardWidth - editorWidth)).toBeLessThan(1);
    const layout = await page.evaluate(() => {
      const rect = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect();
      return {
        markerRight: rect(".ah-agent-turn")?.right,
        recapRight: rect(".ah-recap")?.right,
        composerRight: rect(".ah-cbox")?.right,
        editorHeight: rect(".ah-cbox textarea")?.height,
      };
    });
    expect(
      Math.abs((layout.markerRight ?? 0) - (layout.recapRight ?? 0)),
    ).toBeLessThan(1);
    expect(
      Math.abs((layout.composerRight ?? 0) - (layout.recapRight ?? 0)),
    ).toBeLessThan(1);
    expect(layout.editorHeight).toBeLessThanOrEqual(46);
    await expectNativeContent(
      card,
      "Synteettinen työtila tutkittiin ja vastaus valmistui.",
      {},
    );
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
    await expectNativeContent(
      page.getByTestId("conversation-timeline"),
      "Synteettinen työtila tutkittiin ja vastaus valmistui.",
      { count: 0, visible: false },
    );
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
    // A browser conversation opens with its composer; present this one as
    // terminal history so the read-only footer can be measured beside it.
    await history.route("**/api/v1/snapshot", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      for (const agent of body.agents)
        if (agent.agent_id === id) {
          agent.control = "read_only";
          agent.capabilities = {
            agent_resume: {
              state: "unsupported",
              reason_code: "read_only_slice",
            },
          };
        }
      await route.fulfill({ response, json: body });
    });
    await history.route("**/api/v1/conversations", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      body.sessions = body.sessions.filter(
        (s: { agent_id: string }) => s.agent_id !== id,
      );
      await route.fulfill({ response, json: body });
    });
    await history.goto(`/agents/${id}`);
    await expect(history.locator(".ah-read-only-footer")).toBeVisible();
    await expect(history.locator(".ah-recap")).toBeVisible();
    let desktopGap: number | undefined;
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await history.setViewportSize({ width, height: 900 });
      const gaps: number[] = [];
      for (const [view, surface] of [
        [page, ".ah-cbox"],
        [history, ".ah-read-only-footer"],
      ] as const) {
        const cardBox = await view.locator(".ah-recap").boundingBox();
        const controlBox = await view.locator(surface).boundingBox();
        if (!cardBox || !controlBox) throw new Error("Missing footer geometry");
        // Native process/spinoff surfaces sit above the controlled editor.
        // They are content, not whitespace; preserve the same outer rhythm
        // as the read-only footer around either inventory state.
        let surfaceHeight = 0;
        for (const surface of await view.locator(".ah-bg-strip").all()) {
          const box = await surface.boundingBox();
          if (
            box &&
            box.y >= cardBox.y + cardBox.height &&
            box.y + box.height <= controlBox.y
          )
            surfaceHeight += box.height;
        }
        const gap = controlBox.y - (cardBox.y + cardBox.height) - surfaceHeight;
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
      other.getByTestId("recap-card").getByTestId("recap-generated"),
    ).toBeVisible();
    await page.reload();
    await expectNativeContent(
      card,
      "Synteettinen työtila tutkittiin ja vastaus valmistui.",
      {},
    );
    await card.getByTestId("recap-refresh").click();
    const again = await (
      await page.request.get(`/api/v1/agents/${id}/recap`)
    ).json();
    expect(again.recap.generated_at).toBe(native.recap.generated_at);
    await editor.fill("hidas toinen viesti");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await expect(card).toHaveCount(0);
    await expect(page.getByTestId("older-history")).toHaveCount(0);
    await expect(other.getByTestId("recap-card")).toHaveCount(0);
    await other.close();
    await page.reload();
    await expect(card).toHaveCount(0);
    await expect(card.getByTestId("recap-generated")).toBeVisible({
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
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    await page
      .getByRole("navigation")
      .getByTestId("workspace-aurinkokello")
      .click();
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await page.getByTestId("message-input").fill("kokeilu");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    const warning = page.getByTestId("model-unavailable");
    await expect(warning).toBeVisible();
    await page.getByTestId("model-unavailable").getByRole("button").click();
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
    await expect(page.getByTestId("recap-card")).toBeVisible();

    await expect(warning).toBeInViewport();
    await expect(selector).toBeInViewport();
    await selector.getByTestId("model-gpt-6-astra").check();
    await selector
      .getByTestId(/^(model-commit|conversation-model-start)$/)
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
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(
    page.getByRole("navigation").getByTestId("workspace-aurinkokello"),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.goto("/agents/pi:a1a1a1a1-0000-4000-8000-000000000001");
  await expect(
    page.locator("main").getByRole("heading", { level: 1 }),
  ).toHaveText(/Lisää komentoriville --json-lippu/);
  await page.locator("main").getByTestId("conversation-workspace").click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await expect(editor).toBeVisible();
  // The field is usable before creation replies; the route then names Pi's ID.
  await expect(page).toHaveURL(/conversation=pi:/);
  const agent = new URL(page.url()).searchParams.get("conversation");
  expect(agent).toMatch(/^pi:/);
  await editor.fill("Tutki synteettinen työtila");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(
    page.getByTestId("conversation-timeline"),
    "Tutki synteettinen työtila",
    { exact: true, timeout: 20000 },
  );
  await expectNativeContent(
    page.getByTestId("agent-turn"),
    "Katson ensin, mitä työtilassa on.",
    { exact: true, timeout: 20000 },
  );
  await expectNativeContent(page, "Selvä. Kysyit:", { timeout: 20000 });
  const settledTurn = page.getByTestId("agent-turn").last();
  await settledTurn.getByTestId("history-stage-toggle").click();
  const bash = settledTurn
    .getByTestId("tool-row")
    .and(page.locator('[data-tool-name="bash"]'))
    .getByTestId("history-tool-toggle");
  if ((await bash.getAttribute("aria-expanded")) === "false")
    await bash.click();
  await expectNativeContent(page, "README.md", {});
  await expect(page.getByTestId("live-events-heading")).toHaveCount(0);
  // The fake Pi has no model runtime. Explicit regeneration reports a fixed
  // reason without erasing the native-history first-prompt fallback.
  const titleReply = page.waitForResponse((response) =>
    response.url().endsWith("/regenerate_title"),
  );
  await page.getByTestId("conversation-retitle").click();
  expect(await (await titleReply).json()).toMatchObject({
    state: "failed",
    reason: "model_unavailable",
  });
  await expect(page.getByTestId("title-error")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Tutki synteettinen työtila",
  );
  await editor.fill("hylkää");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(
    page.getByTestId("message-rejected").and(page.getByRole("alert")),
  ).toBeVisible({ timeout: 20000 });
  await expect(editor).toHaveValue("hylkää");
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="send"]')),
  ).toBeEnabled();
  await editor.fill("hidas toinen viesti");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.locator(".ah-agent-header")).toHaveAttribute(
    "data-activity",
    "working",
    { timeout: 20000 },
  );
  await expectNativeContent(page, 'Selvä. Kysyit: "hidas toinen viesti".', {
    timeout: 30000,
  });
  await page.reload();
  await expectNativeContent(page, 'Selvä. Kysyit: "hidas toinen viesti".', {});
  const navLink = (
    await nativeConversationLink(
      page,
      page.getByTestId("workspace-navigation"),
      /Tutki synteettinen työtila/,
    )
  ).last();
  await expect(navLink).toBeVisible();
  await expect(navLink).toHaveAttribute(
    "href",
    new RegExp(`conversation=${agent}`),
  );
  await page.getByTestId("workspace-aurinkokello").last().click();
  await navLink.click();
  await expect(page.getByTestId("message-input")).toBeVisible();
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
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").fill("A conversation");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(page, 'Selvä. Kysyit: "A conversation".', {
    timeout: 20000,
  });
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
  await page.getByTestId("conversation-retitle").click();
  await expect.poll(() => !!releaseTitle).toBe(true);
  await page.getByTestId("workspace-aurinkokello").last().click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  releaseTitle?.();
  await (
    await nativeConversationLink(
      page,
      page.getByRole("navigation"),
      /A conversation/,
    )
  )
    .last()
    .click();
  await expect(page.getByTestId("conversation-retitle")).toBeEnabled();
  await expect(page.getByTestId("title-error")).toHaveCount(0);
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
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    await page
      .getByRole("navigation")
      .getByTestId("workspace-aurinkokello")
      .click();
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    const editor = page.getByTestId("message-input");
    await editor.fill("hidas typed-journey");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await openTurnWork(page);
    await expectNativeContent(page, "Synteettinen pohdinta", {
      timeout: 20000,
    });
    await expect(page.locator(".ah-live-tool-row")).toHaveCount(1, {
      timeout: 20000,
    });
    await expectNativeContent(page, 'Selvä. Kysyit: "hidas typed-journey".', {
      timeout: 30000,
    });
    await expect(page.locator(".ah-live-tool-row")).toHaveCount(0, {
      timeout: 30000,
    });
    await openTurnWork(page);
    await expectNativeContent(page, "Synteettinen pohdinta", {
      count: 1,
      visible: false,
    });
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
    await expectNativeContent(page, "must not appear", {
      count: 0,
      visible: false,
    });
    await expectNativeContent(page, "Synteettinen pohdinta", {
      count: 1,
      visible: false,
    });
    await expect(page.locator(".ah-live-tool-row")).toHaveCount(0);
    const conversation = page.url();
    await page
      .getByRole("navigation")
      .getByTestId("workspace-aurinkokello")
      .click();
    await page.goto(conversation);
    await openTurnWork(page);
    await expectNativeContent(page, "Synteettinen pohdinta", {
      count: 1,
      visible: false,
    });
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
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
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
  await expectNativeContent(page, "Synteettinen live-teksti", {});
  await expect(
    page.locator(".ah-live-tool-row").locator('[data-state="running"]'),
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
  await expectNativeContent(page, "Myöhempi lohko", {});
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
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page.getByTestId("message-input")).toBeVisible();
  // The local creation draft is visible before the native conversation has a
  // route. Reload the durable conversation, not that temporary workspace page.
  await expect
    .poll(() => new URL(page.url()).searchParams.get("conversation"))
    .toMatch(/^pi:/);
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
  await expect(page.getByTestId("message-input")).toBeVisible();
});

test("@lab combined stream reconciles a forced gap without reposting", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  // Recovery is injected only after the native answer has settled. This case
  // does not need the deliberately slow Pi turn used by in-flight races.
  await editor.fill("stream-tarkistus");
  let sends = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/send")) sends++;
  });
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(page, 'Selvä. Kysyit: "stream-tarkistus".', {
    timeout: 30000,
  });
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
  await expectNativeContent(page, "This frame must not appear", {
    count: 0,
    visible: false,
  });
  await expectNativeContent(page, 'Selvä. Kysyit: "stream-tarkistus".', {});
  expect(sends).toBe(1);
});

test("@lab fresh replies and exhausted older history survive paging and recovery", async ({
  page,
}) => {
  test.setTimeout(90000);
  const older = page.getByTestId("older-history");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByTestId("workspace-navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  for (let i = 1; i <= 8; i++) {
    await editor.fill(`Kierros ${i}`);
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await expectNativeContent(
      page.getByTestId("conversation-timeline"),
      `Kierros ${i}`,
      { exact: true, timeout: 20000 },
    );
    await expectNativeContent(page, `Selvä. Kysyit: "Kierros ${i}".`, {
      timeout: 30000,
    });
    await expect(editor).toBeEnabled({ timeout: 30000 });
    // Every native entry is already in this live window, even after it grows
    // past a tail page. An absent cursor is a known exhausted boundary.
    await expect(older).toHaveCount(0);
    if (i === 1) {
      await page.reload();
      await expect(editor).toBeEnabled();
      await expect(older).toHaveCount(0);
    }
  }
  await expectNativeContent(
    page.getByTestId("conversation-timeline"),
    "Kierros 8",
    { exact: true },
  );
  // A cold reload reads only the tail: older native entries genuinely exist.
  await page.reload();
  await expect(older).toBeVisible();
  for (let i = 0; i < 8 && (await older.count()); i++) {
    const reply = page.waitForResponse(
      (response) =>
        response.url().includes("/history?") &&
        response.url().includes("before="),
    );
    await older.click();
    // A read the page superseded (a recovery reseed cancels pending pages)
    // has no body; the page then shows the outcome on its own.
    const native = await (await reply).json().catch(() => undefined);
    if (!native) {
      await expect(
        older.or(page.getByTestId("user-content").first()).first(),
      ).toBeVisible();
      continue;
    }
    if (native.older_complete) {
      await expect(older).toHaveCount(0);
      break;
    }
    // Wait for the page to be applied, not merely for its HTTP reply.
    const firstUser = native.entries.find(
      (entry: { kind: string }) => entry.kind === "user",
    );
    if (firstUser)
      await expectNativeContent(page, firstUser.content.text, {
        exact: true,
        count: 1,
        visible: false,
      });
    await expect(older).toBeEnabled();
  }
  await expect(older).toHaveCount(0);
  await page
    .getByRole("button")
    .and(page.getByTestId("workspace-details"))
    .click();
  const refreshed = page.waitForResponse((response) =>
    response.url().includes("/history?"),
  );
  await page.getByTestId("conversation-recheck").click();
  await refreshed;
  await expect(older).toHaveCount(0);
  await editor.fill("Kierros 9");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(page, 'Selvä. Kysyit: "Kierros 9".', {
    timeout: 30000,
  });
  await expect(editor).toBeEnabled({ timeout: 30000 });
  await expect(older).toHaveCount(0);
  // A new daemon incarnation forces snapshot reseeding and history reconnect.
  const reconnected = page.waitForResponse((response) =>
    response.url().includes("/history?"),
  );
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  await reconnected;
  // Without its Pi the conversation stays writable; nothing restarts Pi yet.
  await expect(editor).toBeEnabled({ timeout: 20000 });
  await expect(page.getByTestId("continue-conversation")).toHaveCount(0);
  await expectNativeContent(
    page.getByTestId("conversation-timeline"),
    "Kierros 1",
    { exact: true, count: 1, visible: false },
  );
  await expect(older).toHaveCount(0);
});

test("@lab fake-Pi crash leaves the turn readable and the next send starts Pi again", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByTestId("workspace-navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await editor.fill("kaadu nyt");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(
    page.getByTestId("conversation-timeline"),
    "kaadu nyt",
    { exact: true, timeout: 20000 },
  );
  // The crashed turn's outcome stays uncertain and is never resent, but the
  // conversation is not read-only: there is no explicit continuation.
  await expect(editor).toBeEnabled({ timeout: 20000 });
  await expect(page.getByTestId("continue-conversation")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("workspace-title")).toHaveText("kaadu nyt");
  await expect(editor).toBeEnabled();
  await editor.fill("jatketaan");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(page, 'Selvä. Kysyit: "jatketaan".', {
    timeout: 30000,
  });
});

test("@lab slow turn explains work and stop requires an explicit confirmation", async ({
  page,
}) => {
  expect(
    (await page.request.get("/fixture/scenario?value=pi-visual-hold")).status(),
  ).toBe(204);
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByTestId("workspace-navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").fill("kaadu");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  // The visual-hold scenario stops native Pi at tool start until the fixture
  // releases it below. Inspect the intermediate reply while the turn is live.
  const intermediate = page
    .getByTestId("message")
    .and(page.locator('[data-interim="true"]'))
    .last();
  await expect(intermediate).toBeVisible({ timeout: 20000 });
  // Once its message is saved, the text before the tool is an interim reply:
  // its own card, shown once, while the next stage runs.
  await expect(intermediate).toHaveAttribute("data-interim", "true", {
    timeout: 20000,
  });
  await expectNativeContent(page, "Katson ensin, mitä työtilassa on.", {
    exact: true,
    count: 1,
    visible: false,
  });
  // Normal work is explained once, in the live turn's quiet header.
  const progress = page.getByTestId("agent-turn").last().getByRole("status");
  await expect(progress).toBeVisible({
    timeout: 20000,
  });
  await expect(progress).toBeVisible({ timeout: 20000 });
  const stopOffset = await page
    .getByTestId("composer-stop")
    .and(page.locator('[data-stop-target="agent"]'))
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
  const stop = page
    .getByTestId("composer-stop")
    .and(page.locator('[data-stop-target="agent"]'));
  // Rivillä: Stop sits beside Send at its size, 32 px on the desktop.
  await expect(stop).toHaveCSS("width", "32px");
  // Stop must be findable at a glance (pilot.231: a bare glyph went unseen):
  // its own surface meets WCAG 1.4.11 non-text contrast against the page.
  const stopContrast = await stop.evaluate((button) => {
    const rgb = (value: string) =>
      (value.match(/[\d.]+/g) ?? []).map(Number) as number[];
    const behind = (element: Element | null): number[] => {
      for (let e = element; e; e = e.parentElement) {
        const c = rgb(getComputedStyle(e).backgroundColor);
        if (c.length === 3 || c[3] === 1) return c;
      }
      return [255, 255, 255];
    };
    const own = rgb(getComputedStyle(button).backgroundColor);
    if (own.length === 4 && own[3] < 1) return 1;
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const [a, b] = [lum(own), lum(behind(button.parentElement))];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(stopContrast).toBeGreaterThanOrEqual(3);
  await expect(page.getByTestId("composer-mode")).toHaveCSS("height", "28px");
  await stop.click();
  await expect(page.getByTestId("stop-confirmation")).toHaveCount(0);
  expect(
    (await page.request.get("/fixture/scenario?value=ready")).status(),
  ).toBe(204);
  await expect(page.getByTestId("working-uncertain")).toBeVisible({
    timeout: 20000,
  });
});

// Resolve native conversation identity from the host, not translated link copy.
async function nativeConversationLink(
  page: import("@playwright/test").Page,
  scope: import("@playwright/test").Page | import("@playwright/test").Locator,
  title: string | RegExp,
) {
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const agent = snapshot.agents.find((entry: { title: { display: string } }) =>
    typeof title === "string"
      ? entry.title.display.includes(title)
      : title.test(entry.title.display),
  );
  if (!agent) throw new Error("Missing native conversation identity");
  return scope
    .getByTestId(/^(agent-link|home-conversation-.*)$/)
    .and(
      page.locator(
        `a[href*="conversation=${encodeURIComponent(agent.agent_id)}"], a[href*="conversation=${agent.agent_id}"], a[href="/agents/${agent.agent_id}"]`,
      ),
    );
}

// Native content is asserted independently of translated controls. This helper
// only reads rendered content; it never finds an element for an interaction.
async function expectNativeContent(
  scope: import("@playwright/test").Page | import("@playwright/test").Locator,
  expected: string | RegExp,
  options: {
    count?: number;
    visible?: boolean;
    exact?: boolean;
    timeout?: number;
  } = {},
) {
  const { count, visible = true, exact = false, timeout } = options;
  const read = () =>
    scope.locator("*").evaluateAll(
      (nodes, args) => {
        const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
        const matches = (node: Element) => {
          if (["SCRIPT", "STYLE", "HEAD"].includes(node.tagName)) return false;
          const text = normalize(node.textContent ?? "");
          return args.regex
            ? new RegExp(args.regex, args.flags).test(text)
            : args.exact
              ? text === normalize(args.text)
              : text.includes(normalize(args.text));
        };
        return nodes.filter(
          (node) =>
            matches(node) &&
            ![...node.children].some(matches) &&
            (!args.visible ||
              (node.getClientRects().length > 0 &&
                getComputedStyle(node).visibility !== "hidden")),
        ).length;
      },
      {
        text: typeof expected === "string" ? expected : "",
        regex: expected instanceof RegExp ? expected.source : "",
        flags: expected instanceof RegExp ? expected.flags : "",
        exact,
        visible,
      },
    );
  if (count === undefined)
    await expect.poll(read, { timeout }).toBeGreaterThan(0);
  else await expect.poll(read, { timeout }).toBe(count);
}
