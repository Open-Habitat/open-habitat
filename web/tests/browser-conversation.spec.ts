import { expect, test } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";

const host = hostOrigin;
// The host shares both controller capacity and the OAuth peer admission bucket
// across tests. Advance fixture time between cases (never within a session),
// so earlier logins cannot exhaust a later case's real gateway rate limit.
test.beforeEach(async ({ page }) => {
  expect((await page.request.get("/fixture/reset-clock")).status()).toBe(204);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});
test.use({
  baseURL: host,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});
async function expectPhoneComposerWithinViewport(
  page: import("@playwright/test").Page,
) {
  await page.setViewportSize({ width: 390, height: 844 });
  const composer = page.locator(".ah-conversation-frame > .ah-composer");
  await expect(composer).toBeVisible();
  const bounds = await composer.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const actions = element
      .querySelector(".ah-actions")
      ?.getBoundingClientRect();
    return {
      top: box.top,
      bottom: box.bottom,
      actionsBottom: actions?.bottom ?? 9999,
      scrolls: element.scrollHeight > element.clientHeight,
    };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(844);
  expect(bounds.actionsBottom).toBeLessThanOrEqual(844);
  expect(bounds.scrolls).toBe(false);
}
async function refreshConversation(page: import("@playwright/test").Page) {
  const check = page.getByRole("button", { name: "Tarkista keskustelun tila" });
  if (!(await check.isVisible()))
    await page.getByRole("button", { name: "Tiedot" }).click();
  await check.click();
}
async function open(page: import("@playwright/test").Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  await expect(
    page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
  ).toBeEnabled();
}
test("@browser-conversation create, send once, reconnect and old history stays read-only", async ({
  page,
}) => {
  await open(page);
  const create = page.getByRole("button", {
    name: "Aloita uusi Pi-keskustelu",
  });
  await expect(create).toHaveClass(/ah-button-primary/);
  await expect(
    page.getByRole("button", { name: "Tarkista keskustelulista" }),
  ).toHaveCount(0);
  const stream = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/v1/events" && r.status() === 200,
  );
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  expect((await stream).headers()["content-type"]).toBe("text/event-stream");
  await expect(page).toHaveURL(/conversation=pi%3A|conversation=pi:/);
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tarkista keskustelun tila" }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Synteettinen testipyyntö");
  let sends = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/send")) sends++;
  });
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  // Accepted delivery clears the submitted draft but does not claim turn completion.
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveValue("");
  expect(sends).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  await expect(
    page.getByText("Viesti odottaa natiivia hyväksyntää"),
  ).toHaveCount(0);
  await page.locator("main").evaluate((main) => {
    main.scrollTop = main.scrollHeight;
  });
  await page.screenshot({
    path: "test-results/evidence/browser-conversation-reconnect.png",
  });
  // The short synthetic turn may already have settled after reload. An idle
  // conversation must not offer a meaningless interruption request.
  await expect(page.getByRole("button", { name: "Keskeytä" })).toHaveCount(0);
  await page.goto("/agents/pi:11111111-1111-4111-8111-111111111111");
  await expect(
    page
      .locator(".ah-read-only-footer")
      .getByText("Vain luku", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveCount(0);
});
test("@browser-conversation HTTP fallback permits one send while journal is unavailable", async ({
  page,
}) => {
  await open(page);
  await page.route("**/api/v1/events?after=*", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  await editor.fill("Fallback");
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeEnabled();
  let sends = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/send")) sends++;
  });
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(editor).toHaveValue("");
  expect(sends).toBe(1);
});

test("@browser-conversation transient status failure retries with healthy journal", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  let failures = 0;
  await page.route("**/api/v1/conversations/*/status*", async (route) => {
    if (failures++ === 0)
      await route.fulfill({ status: 503, body: "unavailable" });
    else await route.continue();
  });
  await refreshConversation(page);
  await expect.poll(() => failures).toBeGreaterThan(1);
  await expect(editor).toBeEnabled({ timeout: 10000 });
});

// The synthetic Pi has no receipt/question/settlement scenario yet. Intercept
// validated private gateway responses after the real TLS login/create/send path.
for (const outcome of [
  "pending",
  "accepted",
  "rejected",
  "uncertain",
] as const) {
  test(`@browser-conversation validated ${outcome} send receipt never reposts`, async ({
    page,
  }) => {
    await open(page);
    await page
      .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Viesti Pi:lle" }),
    ).toBeVisible();
    let lookups = 0;
    await page.route("**/api/v1/conversations/*/status", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      if (body.command_id) body.send_receipt = outcome;
      await route.fulfill({ response, json: body });
    });
    await page.route(
      "**/api/v1/conversations/*/receipt?command_id=*",
      async (route) => {
        lookups++;
        const command_id = new URL(route.request().url()).searchParams.get(
          "command_id",
        );
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            schema_version: 1,
            command_id,
            state: outcome,
          }),
        });
      },
    );
    let sends = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/send")) sends++;
    });
    await page
      .getByRole("textbox", { name: "Viesti Pi:lle" })
      .fill(`Synteettinen ${outcome}`);
    await page.getByRole("button", { name: "Lähetä", exact: true }).click();
    if (outcome === "accepted") {
      await expect(
        page.getByRole("textbox", { name: "Viesti Pi:lle" }),
      ).toHaveValue("");
      await expect(page.locator(".ah-send-accepted")).toHaveCount(0);
    } else await expect(page.locator(`.ah-send-${outcome}`)).toBeVisible();
    await expectPhoneComposerWithinViewport(page);
    if (outcome === "uncertain") {
      await expect(
        page.getByRole("button", { name: "Kopioi teksti" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Lähetä", exact: true }),
      ).toBeDisabled();
    }
    expect(sends).toBe(1);
    const before = lookups;
    await refreshConversation(page);
    if (outcome === "accepted") {
      await expect(
        page.getByRole("textbox", { name: "Viesti Pi:lle" }),
      ).toHaveValue("");
      await expect(page.locator(".ah-send-accepted")).toHaveCount(0);
    } else await expect(page.locator(`.ah-send-${outcome}`)).toBeVisible();
    expect(lookups).toBe(before); // matching status receipt avoids an extra request
  });
}
test("@browser-conversation lost reply looks up matching command without repost", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  let lookups = 0;
  await page.route("**/api/v1/conversations/*/status", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (body.command_id) delete body.send_receipt; // force command-ID lookup
    await route.fulfill({ response, json: body });
  });
  await page.route(
    "**/api/v1/conversations/*/receipt?command_id=*",
    async (route) => {
      lookups++;
      const command_id = new URL(route.request().url()).searchParams.get(
        "command_id",
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          schema_version: 1,
          command_id,
          state: "accepted",
        }),
      });
    },
  );
  let sends = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/send")) sends++;
  });
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Vain kerran");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveValue("");
  await expect(page.locator(".ah-send-accepted")).toHaveCount(0);
  expect(lookups).toBeGreaterThan(0);
  expect(sends).toBe(1);
});
test("@browser-conversation safe question and settled boundary require validated status and native key", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  await page.route("**/api/v1/conversations/*/status", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.pending_question = {
      request_id: "question-1",
      question_kind: "unknown",
      prompt: "<script>alert(1)</script>",
      choices: ["<b>ei html</b>"],
    };
    body.turn_settled = {
      state: "settled",
      observed_at: "2026-09-30T13:53:00Z",
      native_key: "not-in-history",
    };
    await route.fulfill({ response, json: body });
  });
  await refreshConversation(page);
  await expect(
    page.getByRole("region", { name: "Pi:n kysymys" }),
  ).toContainText("<script>alert(1)</script>");
  await expect(
    page.getByRole("region", { name: "Pi:n kysymys" }).getByRole("button"),
  ).toHaveCount(0);
  await expect(page.locator(".ah-settled")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Pi:n kysymys" }).locator("script"),
  ).toHaveCount(0);
});
test("@browser-conversation in-flight send remains pending through missing receipt", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/api/v1/conversations/*/send", async (route) => {
    started();
    await held;
    await route.continue();
  });
  let sends = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/send")) sends++;
  });
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Odota kuittausta");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await entered;
  await expect(page.locator(".ah-send-pending")).toBeVisible();
  await refreshConversation(page);
  await expect(page.locator(".ah-send-uncertain")).toHaveCount(0);
  release();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveValue("");
  await expect(page.locator(".ah-send-accepted")).toHaveCount(0);
  expect(sends).toBe(1);
});
test("@browser-conversation settled marker needs observed native key", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  const agentId = new URL(page.url()).searchParams.get("conversation");
  expect(agentId).toMatch(/^pi:/);
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Valmis vastaus");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  let key = "";
  await expect
    .poll(async () => {
      const response = await page.request.get(
        `/api/v1/agents/${agentId}/history`,
      );
      if (!response.ok()) return false;
      const body = await response.json();
      key =
        body.entries?.find(
          (entry: { kind: string; entry_key: string }) =>
            entry.kind === "assistant",
        )?.entry_key ?? "";
      return !!key;
    })
    .toBe(true);
  await page.route("**/api/v1/conversations/*/status", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.turn_settled = {
      state: "settled",
      native_key: key,
      observed_at: "2026-09-30T13:53:00Z",
    };
    await route.fulfill({ response, json: body });
  });
  await refreshConversation(page);
  await expect(page.locator(".ah-settled")).toContainText(
    /Vuoro valmis .* odottaa viestiäsi/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".ah-settled")).toBeVisible();
  await expectPhoneComposerWithinViewport(page);
});
test("@browser-conversation resized editor keeps actions reachable", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const composer = page.locator(".ah-conversation-frame > .ah-composer");
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .evaluate((node) => {
      node.style.height = "600px";
    });
  await expect
    .poll(() =>
      composer.evaluate((node) => node.scrollHeight > node.clientHeight),
    )
    .toBe(true);
  expect(
    await composer.evaluate((node) => node.getBoundingClientRect().bottom),
  ).toBeLessThanOrEqual(720);
  await composer.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  expect(
    await composer
      .locator(".ah-actions")
      .evaluate((node) => node.getBoundingClientRect().bottom),
  ).toBeLessThanOrEqual(720);
});

test("@browser-conversation ordinary session loading is not an uncertain create", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "ordinary-dir" }),
  ).toBeVisible();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/auth/session", async (route) => {
    await held;
    await route.continue();
  });
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  await expect(page.getByText("Varmistetaan istuntoa.")).toBeVisible();
  await expect(
    page.getByText(/edellisen luonnin tulos on epävarma/i),
  ).toHaveCount(0);
  release();
  await expect(
    page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
  ).toBeEnabled();
  await expect(page.getByText("Varmistetaan istuntoa.")).toHaveCount(0);
});

test("@browser-conversation missing daemon control opens surviving native history", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(page).toHaveURL(/conversation=pi%3A|conversation=pi:/);
  const id = new URL(page.url()).searchParams.get("conversation");
  if (!id) throw new Error("missing created conversation");
  await page.route(
    `**/api/v1/conversations/${id.slice(3)}/status*`,
    async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: '{"code":"resource_not_found"}',
      });
    },
  );
  await page.reload();
  await expect(page).toHaveURL(`/agents/${id}`);
  await expect(
    page.getByText(/Yhteys katkesi tai istunto muuttui/),
  ).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveCount(0);
});

test("@browser-conversation lost create acknowledgement blocks duplicate creation", async ({
  page,
}) => {
  await open(page);
  let attempts = 0;
  await page.route("**/api/v1/conversations", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    attempts++;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(page.getByText(/Luonnin tulos epävarma/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
  ).toBeDisabled();
  expect(attempts).toBe(1);
});
test("@browser-conversation uncertain send survives reload without duplicate", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Älä lähetä toistamiseen");
  let attempts = 0;
  await page.route("**/api/v1/conversations/*/send", async (route) => {
    attempts++;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByText(/Ei tiedossa, vastaanottiko Pi viestin/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tarkista keskustelun tila" }),
  ).toHaveClass(/ah-button-quiet/);
  await page.reload();
  await expect(
    page.getByText(/Ei tiedossa, vastaanottiko Pi viestin/),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveValue("Älä lähetä toistamiseen");
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeDisabled();
  expect(attempts).toBe(1);
  await page
    .getByText(/Ei tiedossa, vastaanottiko Pi viestin/)
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/evidence/browser-conversation-uncertain.png",
  });
});

test("@browser-conversation revalidation restores editor selection, paged reading place and live tail", async ({
  page,
}) => {
  await page.clock.install();
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  const agent = new URL(page.url()).searchParams.get("conversation");
  expect(agent).toMatch(/^pi:/);
  let tail = 0;
  let count = 25;
  let statusRequests = 0;
  await page.route("**/api/v1/conversations/*/status", async (route) => {
    statusRequests++;
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({
      response,
      json: {
        ...data,
        native_history: "present",
        native_revision: "synthetic-1",
        event_cursor: tail,
        events: tail ? [{ kind: "synthetic-update" }] : [],
      },
    });
  });
  await page.route("**/api/v1/agents/*/history?*", async (route) => {
    const after = new URL(route.request().url()).searchParams.get("after");
    const start = after ? Number(after.replace("item-", "")) + 1 : 0;
    const limit = 25;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        schema_version: 1,
        agent_id: agent,
        native_revision: "synthetic-1",
        entries: Array.from(
          { length: Math.max(0, Math.min(count, start + limit) - start) },
          (_, offset) => ({
            entry_key: `item-${start + offset}`,
            kind: "user",
            content: {
              media_type: "text/plain",
              text: `Viesti ${start + offset} · ${"teksti ".repeat(30)}`,
              complete: true,
            },
          }),
        ),
        complete: count <= start + limit,
        ...(count > start + limit
          ? { next_after: `item-${start + limit - 1}` }
          : {}),
      }),
    });
  });
  count = 50;
  await refreshConversation(page);
  await expect(page.locator(".ah-feed li")).toHaveCount(50);
  const feed = page.locator("section:has(> .ah-timeline)").last();
  const bottomGap = () =>
    feed.evaluate(
      (node) => node.scrollHeight - node.scrollTop - node.clientHeight,
    );
  await feed.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect.poll(bottomGap).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Tiedot" }).click();
  await expect.poll(bottomGap).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Tiedot" }).click();
  await editor.fill("kesken oleva viesti");
  await editor.evaluate((node: HTMLTextAreaElement) => {
    node.focus();
    node.setSelectionRange(4, 9);
  });
  // Focusing the editor can move the scrollable feed; measure the reading
  // position only after focus has settled.
  await feed.evaluate((node) => {
    node.scrollTop = Math.min(350, node.scrollHeight - node.clientHeight);
  });
  const before = await feed.evaluate((node) => node.scrollTop);
  expect(before).toBeGreaterThan(0);
  // Idle viewing must not replace the editor with a full-screen loading page.
  // A healthy journal needs no native status polling. Top-level snapshot
  // revalidation must not unmount the editor either.
  let snapshotReads = 0;
  await page.route("**/api/v1/snapshot", async (route) => {
    snapshotReads++;
    await route.continue();
  });
  await page.clock.fastForward(60_000);
  expect(snapshotReads).toBe(0);
  expect(await feed.evaluate((node) => node.scrollTop)).toBeCloseTo(before, 0);
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue("kesken oleva viesti");
  await expect(page.getByRole("heading", { name: "Ladataan" })).toHaveCount(0);
  // Coming back to the tab still revalidates identity before restoring the view.
  tail = 1;
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
  });
  await expect.poll(() => snapshotReads).toBeGreaterThan(0);
  await expect(page.locator(".ah-feed li")).toHaveCount(50);
  // The live tail is not repeated as raw JSON under a readable native feed.
  await expect(page.getByText("Viimeisimmät live-tapahtumat (1)")).toHaveCount(
    0,
  );
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("kesken oleva viesti");
  expect(
    await editor.evaluate((node: HTMLTextAreaElement) => [
      node.selectionStart,
      node.selectionEnd,
    ]),
  ).toEqual([4, 9]);
  expect(await feed.evaluate((node) => node.scrollTop)).toBeCloseTo(before, 0);
  expect(
    await page
      .getByRole("button", { name: "Lataa seuraava historiasivu" })
      .count(),
  ).toBe(0);
  // An incoming native entry beyond the first page must be signalled without
  // waiting for a manual history-page click or jumping away from the reader.
  count = 51;
  await refreshConversation(page);
  await expect(
    page.getByRole("button", { name: "Uutta sisältöä (1)" }),
  ).toBeVisible();
  expect(await feed.evaluate((node) => node.scrollTop)).toBeCloseTo(before, 0);
  // The status button and a navigation link both take focus away from the
  // editor. Test restoration from a genuinely focused editor instead of
  // depending on whether a clicked link loses focus before React unmounts.
  await editor.evaluate((node: HTMLTextAreaElement) => {
    node.focus({ preventScroll: true });
    node.setSelectionRange(4, 9);
  });
  await expect(editor).toBeFocused();
  await page.goBack();
  await expect(editor).toHaveCount(0);
  await page.goForward();
  await expect(editor).toHaveValue("kesken oleva viesti");
  await expect(editor).toBeFocused();
  expect(
    await editor.evaluate((node: HTMLTextAreaElement) => [
      node.selectionStart,
      node.selectionEnd,
    ]),
  ).toEqual([4, 9]);
  expect(await feed.evaluate((node) => node.scrollTop)).toBeCloseTo(before, 0);
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  await page.getByRole("menuitem", { name: "Asetukset" }).click();
  await expect(page).toHaveURL(/\/settings/);
  const stoppedAt = statusRequests;
  await page.clock.fastForward(30_000);
  expect(statusRequests).toBe(stoppedAt);
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveCount(0);
});

test("@browser-conversation malformed host status fails closed without rendering HTML", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  await page.route("**/api/v1/conversations/*/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schema_version: 1,
        agent_id: "<script>alert(1)</script>",
      }),
    }),
  );
  await refreshConversation(page);
  await expect(
    page.getByText(/Yhteys katkesi tai istunto muuttui/),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveCount(0);
  await expect(page.locator("main script")).toHaveCount(0);
});

test("@browser-conversation foreground clicks and route changes do not revalidate", async ({
  page,
}) => {
  await open(page);
  let checks = 0;
  page.on("request", (r) => {
    if (r.url().includes("/onboarding/pi/status")) checks++;
  });
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  await page.getByRole("menuitem", { name: "Asetukset" }).click();
  await expect(page.getByRole("heading", { name: "Asetukset" })).toBeVisible();
  await page.getByRole("button", { name: "Takaisin" }).click();
  await expect(
    page.getByRole("heading", { name: "Pi-keskustelut" }),
  ).toBeVisible();
  expect(checks).toBe(0);
  await expect(
    page.getByRole("group", { name: "Pi-keskustelun toiminnot" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 750, height: 720 });
  await expect(
    page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
  ).toBeVisible();
  await page
    .getByRole("group", { name: "Pi-keskustelun toiminnot" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/evidence/conversation-actions-compact.png",
  });
});

test("@browser-conversation slow tab return masks old facts without unmounting and recovers", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  await editor.fill("unfinished synthetic draft");
  await editor.focus();
  let piChecks = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/onboarding/pi/status")) piChecks++;
  });
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/api/v1/snapshot", async (route) => {
    started();
    await held;
    await route.continue().catch(() => {});
  });
  try {
    await page.evaluate(() => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
    });
    await requested;
    await expect(page.getByText("Varmistetaan istuntoa…")).toBeVisible();
    await expect(page.locator(".ah-identity-check-title")).toHaveText(
      "Agent Host",
    );
    await expect(page.locator(".ah-identity-check")).toHaveCSS("inset", "0px");
    await expect(editor).toBeHidden();
    expect(await page.locator("textarea").count()).toBe(1); // mounted but inert and hidden
    release();
    await expect(editor).toBeVisible();
    await expect(editor).toHaveValue("unfinished synthetic draft");
    await expect(editor).toBeFocused();
    expect(piChecks).toBe(0);
    await expect(page.getByRole("heading", { name: "Ladataan" })).toHaveCount(
      0,
    );
  } finally {
    release();
  }
});

test("@browser-conversation stalled snapshot retains only session-verified stale facts", async ({
  page,
}) => {
  await page.clock.install();
  await open(page);
  let started!: () => void;
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/api/v1/snapshot", async (route) => {
    started();
    await new Promise<void>(() => {});
    await route.continue().catch(() => {});
  });
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
  });
  await requested;
  await expect(
    page.getByRole("heading", { name: "ordinary-dir" }),
  ).toBeHidden();
  await page.clock.fastForward(10_001);
  await expect(
    page.getByRole("heading", { name: "ordinary-dir" }),
  ).toBeVisible();
  await expect(page.getByText("Yhteys poikki").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toHaveCount(0);
});

test("@browser-conversation reauth on tab return drops old identity", async ({
  page,
}) => {
  await open(page);
  await page.request.get("/fixture/expire");
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
  });
  await expect(
    page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "ordinary-dir" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Bob" }).click();
  await expect(
    page.getByRole("heading", { name: "Kohdetta ei enää löydy" }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/v1/snapshot")).json()).auth
      .provider_account_id,
  ).toBe("43");
  await expect(
    page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
  ).toHaveCount(0);
});

test("@browser-conversation failed pre-write verification does not claim ambiguous create", async ({
  page,
}) => {
  await open(page);
  await page.route("**/auth/session", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByText("Istuntoa ei voitu vahvistaa. Luontia ei lähetetty."),
  ).toBeVisible();
  await expect(page.getByText("Aiemman pyynnön tulos epävarma")).toHaveCount(0);
});

test("@browser-conversation new subject during pending tab check never restores old workspace", async ({
  page,
  context,
}) => {
  await open(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/api/v1/snapshot", async (route) => {
    started();
    await held;
    await route.continue().catch(() => {});
  });
  const other = await context.newPage();
  try {
    await page.evaluate(() => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
    });
    await requested;
    await expect(
      page.getByRole("heading", { name: "ordinary-dir" }),
    ).toBeHidden();
    await other.goto("/workspaces");
    await other.getByRole("button", { name: /Tilivalikko/ }).click();
    await other.getByRole("menuitem", { name: "Kirjaudu ulos" }).click();
    await other.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await other.getByRole("link", { name: "Bob" }).click();
    release();
    await expect(
      page.getByRole("heading", { name: "Tervetuloa Omega Habitatiin" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "ordinary-dir" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
    ).toHaveCount(0);
  } finally {
    release();
    await other.close();
  }
});

test("@browser-conversation transient snapshot failure after tab return keeps verified facts stale", async ({
  page,
}) => {
  await open(page);
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
  });
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "ordinary-dir" }),
  ).toBeVisible();
});

test("@browser-conversation first reveal of background authenticated tab validates changed subject", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    let visible = false;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (visible ? "visible" : "hidden"),
    });
    Object.defineProperty(document, "hasFocus", {
      configurable: true,
      value: () => visible,
    });
    Object.defineProperty(window, "revealFixtureTab", {
      value: () => {
        visible = true;
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("focus"));
      },
    });
  });
  await open(page);
  const other = await context.newPage();
  try {
    await other.goto("/workspaces");
    await other.getByRole("button", { name: /Tilivalikko/ }).click();
    await other.getByRole("menuitem", { name: "Kirjaudu ulos" }).click();
    await other.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await other.getByRole("link", { name: "Bob" }).click();
    await page.evaluate(() =>
      (
        window as unknown as { revealFixtureTab: () => void }
      ).revealFixtureTab(),
    );
    await expect(
      page.getByRole("heading", { name: "Tervetuloa Omega Habitatiin" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "ordinary-dir" }),
    ).toHaveCount(0);
  } finally {
    await other.close();
  }
});

test("@browser-conversation slow snapshot validation keeps the same editor mounted", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  await editor.fill("synthetic work in progress");
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/api/v1/snapshot", async (route) => {
    started();
    await held;
    await route.continue().catch(() => {});
  });
  try {
    await page.evaluate(() => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
    });
    await requested;
    await expect(page.getByText("Varmistetaan istuntoa…")).toBeVisible();
    expect(await page.locator("textarea").count()).toBe(1);
    await expect(editor).toBeHidden();
    release();
    await expect(editor).toBeVisible();
    await expect(editor).toHaveValue("synthetic work in progress");
  } finally {
    release();
  }
});

test("@browser-conversation steer, follow-up and clear return only removed texts", async ({
  page,
}) => {
  test.setTimeout(60000);
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await editor.fill("hidas päätyö");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeVisible();
  await editor.fill("jonoon yksi");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(editor).toHaveValue("");
  await editor.fill("ohjaus kaksi");
  await page.getByRole("button", { name: "Ohjaa" }).click();
  await expect(editor).toHaveValue("");
  const queuePanel = page.getByRole("region", { name: "Työskentelyjono" });
  await expect(queuePanel).toBeVisible();
  await expect(queuePanel.getByRole("listitem")).toHaveCount(2);
  await expect(queuePanel.getByRole("listitem").first()).toContainText(
    "ohjaus kaksi",
  );
  await expect(queuePanel.getByRole("listitem").last()).toContainText(
    "jonoon yksi",
  );
  await page.screenshot({ path: "test-results/queue-before-clear.png" });
  await page.getByRole("button", { name: "Tyhjennä jono" }).click();
  await expect(editor).toHaveValue("ohjaus kaksi\n\njonoon yksi");
  await expect(queuePanel).toHaveCount(0);
  await page.screenshot({ path: "test-results/queue-after-clear.png" });
  await expect(page.getByText("jonoon yksi", { exact: true })).toHaveCount(0);
});

test("@browser-conversation a stale working view cannot strand an unsent queued draft", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await editor.fill("hidas päätyö");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeVisible();
  await editor.fill("ei jonoon");
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const intercepted = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/conversations/*/follow_up", async (route) => {
    started();
    await held;
    await route.continue();
  });
  try {
    await page.getByRole("button", { name: "Lähetä", exact: true }).click();
    await intercepted;
    // The original turn settles while the browser request is held. The daemon
    // rejects this new command before native delivery; it is NOT ambiguous.
    const agentId = new URL(page.url()).searchParams.get("conversation");
    if (!agentId) throw new Error("missing controlled agent");
    await expect
      .poll(
        async () => {
          const response = await page.request.get(
            `/api/v1/conversations/${agentId.slice(3)}/status`,
          );
          return (await response.json()).state;
        },
        { timeout: 25000 },
      )
      .toBe("idle");
    release();
    await expect(
      page.getByText(/Tila muuttui. Viestiä ei lähetetty/),
    ).toBeVisible();
    await expect(editor).toHaveValue("ei jonoon");
    await expect(page.getByText(/Lähetyksen tulos epävarma/)).toHaveCount(0);
  } finally {
    release();
  }
});

test("@browser-conversation separate streaming drafts survive agent switches and vanish on identity change", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(page).toHaveURL(/conversation=pi/);
  const firstURL = page.url();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  await editor.fill("hidas ensimmäinen vuoro");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(editor).toHaveValue("");
  await editor.fill("ensimmäisen oma luonnos");
  await page.getByRole("link", { name: "ordinary-dir" }).last().click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(page).toHaveURL(/conversation=pi/);
  const secondURL = page.url();
  expect(secondURL).not.toBe(firstURL);
  await expect(editor).toHaveValue("");
  await editor.fill("toisen oma luonnos");
  await page.goBack(); // workspace
  await page.goBack(); // first agent, without a document reload
  await expect(page).toHaveURL(firstURL);
  await expect(editor).toHaveValue("ensimmäisen oma luonnos");
  await page.goForward();
  await page.goForward();
  await expect(editor).toHaveValue("toisen oma luonnos");
  await page.reload();
  await expect(editor).toHaveValue("toisen oma luonnos");
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  await page.getByRole("menuitem", { name: "Kirjaudu ulos" }).click();
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Bob" }).click();
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) => key.startsWith("nah:draft:")),
    ),
  ).toEqual([]);
  await expect(page.getByText("toisen oma luonnos")).toHaveCount(0);
});

async function endedConversation(page: import("@playwright/test").Page) {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(page).toHaveURL(/conversation=pi/);
  const id = new URL(page.url()).searchParams.get("conversation");
  if (!id) throw new Error("missing conversation");
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await editor.fill("synthetic end then continue");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect
    .poll(async () => {
      const r = await page.request.get(
        `/api/v1/conversations/${id.slice(3)}/status`,
      );
      const s = await r.json();
      return s.state === "idle" && s.native_history === "present";
    })
    .toBe(true);
  const { csrf } = await (await page.request.get("/auth/session")).json();
  const stopped = await page.request.post(
    `/api/v1/conversations/${id.slice(3)}/stop`,
    {
      headers: { "X-Agent-Host-CSRF": csrf, Origin: host },
    },
  );
  expect(stopped.status()).toBe(200);
  await refreshConversation(page);
  await expect(
    page.getByRole("button", { name: "Jatka keskustelua" }),
  ).toBeVisible();
  await expect(editor).toHaveCount(0);
  return id;
}

test("@browser-conversation ordinary refresh keeps an explicit continuation proof", async ({
  page,
}) => {
  await endedConversation(page);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Jatka keskustelua" }),
  ).toBeVisible();
});

test("@browser-conversation an opening continuation proof retries after HTTP failure", async ({
  page,
}) => {
  let proofRequests = 0;
  await page.route(
    "**/api/v1/conversations/*/status?continuation=true",
    (route) => {
      if (++proofRequests === 1)
        return route.fulfill({ status: 503, body: "unavailable" });
      return route.continue();
    },
  );
  await endedConversation(page);
  expect(proofRequests).toBeGreaterThan(1);
});

for (const [proof, reason] of [
  ["writer_present", /Keskustelulla on yhä aktiivinen kirjoittaja/],
  ["read_only_history", /terminaalin historiaa/],
  ["unproven", /turvalliseksi jatkaa/],
] as const)
  test(`@browser-conversation uncertain native file ${proof} cannot continue`, async ({
    page,
  }) => {
    await open(page);
    await page
      .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
      .click();
    await expect(page).toHaveURL(/conversation=pi/);
    const id = new URL(page.url()).searchParams.get("conversation");
    expect(id).toMatch(/^pi:/);
    await page
      .getByRole("textbox", { name: "Viesti Pi:lle" })
      .fill("synthetic live child");
    await page.getByRole("button", { name: "Lähetä", exact: true }).click();
    await expect
      .poll(async () => {
        const response = await page.request.get(
          `/api/v1/conversations/${id?.slice(3)}/status`,
        );
        const observed = await response.json();
        return observed.native_history;
      })
      .toBe("present");
    let posts = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/continue")) posts++;
    });
    await page.route(
      `**/api/v1/conversations/${id?.slice(3)}/status*`,
      async (route) => {
        const response = await route.fetch();
        const data = await response.json();
        // A present JSONL and uncertain RPC state do not constitute proof
        // that the owner fence can be reacquired.
        await route.fulfill({
          response,
          json: {
            ...data,
            state: "uncertain",
            native_history: "present",
            continuation: proof,
          },
        });
      },
    );
    await refreshConversation(page);
    await expect(page.getByText(reason)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Jatka keskustelua" }),
    ).toHaveCount(0);
    expect(posts).toBe(0);
  });

test("@browser-conversation ended browser conversation continues explicitly without reposting", async ({
  page,
}) => {
  const id = await endedConversation(page);
  let continuations = 0,
    sends = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/continue")) continuations++;
    if (r.url().endsWith("/send")) sends++;
  });
  const posted = page.waitForRequest((r) => r.url().endsWith("/continue"));
  await page.getByRole("button", { name: "Jatka keskustelua" }).click();
  const request = await posted;
  expect(request.postData()).toBeNull();
  expect(request.headers()["x-agent-host-csrf"]).toBeTruthy();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Aiemman vuoron tulos on epävarma/),
  ).toBeVisible();
  expect(continuations).toBe(1);
  expect(sends).toBe(0);
  const status = await (
    await page.request.get(`/api/v1/conversations/${id.slice(3)}/status`)
  ).json();
  expect(status.state).toBe("idle");
  await page.goto("/agents/pi:11111111-1111-4111-8111-111111111111");
  await expect(
    page
      .locator(".ah-read-only-footer")
      .getByText("Vain luku", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Jatka keskustelua" }),
  ).toHaveCount(0);
});

for (const code of [
  "writer_conflict",
  "read_only_history",
  "control_uncertain",
  "capacity_exceeded",
  "network",
  "503",
] as const) {
  test(`@browser-conversation continuation ${code} never reposts`, async ({
    page,
  }) => {
    const id = await endedConversation(page);
    let attempts = 0;
    await page.route(
      `**/api/v1/conversations/${id.slice(3)}/continue`,
      (route) => {
        attempts++;
        if (code === "network") return route.abort("failed");
        return route.fulfill({
          status:
            code === "503" ? 503 : code === "capacity_exceeded" ? 429 : 409,
          contentType: "application/json",
          body: JSON.stringify({
            schema_version: 1,
            error: {
              code,
              message: "not available",
              retryable: false,
              correlation_id: "req_00000000",
            },
          }),
        });
      },
    );
    await page.getByRole("button", { name: "Jatka keskustelua" }).click();
    const phrase =
      code === "writer_conflict"
        ? "aktiivinen kirjoittaja"
        : code === "capacity_exceeded"
          ? "raja on täynnä"
          : code === "read_only_history"
            ? "terminaalin historiaa"
            : code === "control_uncertain"
              ? "turvalliseksi jatkaa"
              : "Jatkamisen tulos on epävarma";
    await expect(page.getByText(new RegExp(phrase))).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Jatka keskustelua" }),
    ).toHaveCount(code === "503" || code === "network" ? 0 : 1);
    await refreshConversation(page);
    expect(attempts).toBe(1);
    if (code === "network" || code === "503") {
      await expect(
        page.getByRole("button", { name: "Yritä jatkaa uudelleen" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Yritä jatkaa uudelleen" })
        .click();
      await expect.poll(() => attempts).toBe(2); // only this explicit second press reposts
    }
  });
}

test("@browser-conversation lost continuation reply reconciles status and history without another POST", async ({
  page,
}) => {
  const id = await endedConversation(page);
  let attempts = 0;
  await page.route(
    `**/api/v1/conversations/${id.slice(3)}/continue`,
    async (route) => {
      attempts++;
      const response = await route.fetch(); // native write succeeded, browser reply lost
      expect(response.status()).toBe(200);
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      });
    },
  );
  await page.route(`**/api/v1/agents/${id}/history*`, (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await page.getByRole("button", { name: "Jatka keskustelua" }).click();
  await expect(
    page.getByText("Jatkamisen tulos epävarma", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveCount(0);
  await page.unroute(`**/api/v1/agents/${id}/history*`);
  await refreshConversation(page);
  await expect(
    page.getByText("Aiemman vuoron tulos on epävarma", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  expect(attempts).toBe(1);
});

test("@browser-conversation status reconciles before a late continuation reply", async ({
  page,
}) => {
  const id = await endedConversation(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let wrote!: () => void;
  const written = new Promise<void>((resolve) => {
    wrote = resolve;
  });
  let attempts = 0;
  await page.route(
    `**/api/v1/conversations/${id.slice(3)}/continue`,
    async (route) => {
      attempts++;
      const response = await route.fetch(); // daemon has started the new child
      expect(response.status()).toBe(200);
      wrote();
      await held;
      await route.fulfill({ response });
    },
  );
  try {
    await page.getByRole("button", { name: "Jatka keskustelua" }).click();
    await written;
    // The journal may already have removed the manual status button. Focus
    // refreshes the mounted view without requiring that presentation control.
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByText("Aiemman vuoron tulos on epävarma", { exact: true }),
    ).toBeVisible();
    release();
    await expect(
      page.getByRole("textbox", { name: "Viesti Pi:lle" }),
    ).toBeEnabled();
    await expect(
      page.getByText("Jatkamisen tulos epävarma", { exact: true }),
    ).toHaveCount(0);
    expect(attempts).toBe(1);
  } finally {
    release();
  }
});

test("@browser-conversation stale recovery during continuation never strands controls or reposts", async ({
  page,
}) => {
  const id = await endedConversation(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let wrote!: () => void;
  const written = new Promise<void>((resolve) => {
    wrote = resolve;
  });
  let posts = 0;
  await page.route(
    `**/api/v1/conversations/${id.slice(3)}/continue`,
    async (route) => {
      posts++;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      wrote();
      await held;
      await route.fulfill({ response });
    },
  );
  try {
    await page.getByRole("button", { name: "Jatka keskustelua" }).click();
    await written;
    await page.route("**/api/v1/snapshot", (route) =>
      route.fulfill({ status: 503, body: "unavailable" }),
    );
    await page.getByRole("button", { name: "Päivitä", exact: true }).click();
    await expect(
      page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
    ).toBeVisible();
    release(); // response settles during stale: the old finally cannot clear busy
    await page.unroute("**/api/v1/snapshot");
    await page.getByRole("button", { name: /Yhdistä|Yritä uudelleen/ }).click();
    await expect(
      page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "Viesti Pi:lle" }),
    ).toBeEnabled();
    expect(posts).toBe(1);
  } finally {
    release();
  }
});

test("@browser-conversation model authentication error offers sign-in without leaking provider text", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  await page.request.get("/fixture/scenario?value=pi-auth-failure");
  await page.getByRole("textbox", { name: "Viesti Pi:lle" }).fill("kokeilu");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByText("Kielimallikirjautuminen ei ole kunnossa"),
  ).toBeVisible();
  expect(await page.locator("main").innerText()).not.toContain(
    "synthetic-secret",
  );
  await page.getByRole("button", { name: "Kirjaudu", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
  ).toBeVisible();
  await page.request.get("/fixture/scenario?value=ready");
  await page.request.get("/fixture/pi-state?value=usable");
  await page.getByRole("button", { name: "Aloita kirjautuminen" }).click();
  await expect(
    page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }),
  ).toHaveCount(0, { timeout: 12000 });
  await expect(page.getByText("ordinary-dir").first()).toBeVisible();
});
