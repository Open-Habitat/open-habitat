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
  expect(lookups).toBe(0); // matching status ack is authoritative
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
  ).toHaveCount(1); // Unknown kind can only be cancelled.
  await expect(
    page.getByRole("button", { name: "Peruuta kysymys" }),
  ).toBeVisible();
  await expect(page.locator(".ah-settled")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Pi:n kysymys" }).locator("script"),
  ).toHaveCount(0);
});
test("@browser-conversation answers once, survives reload, and reports stale without retry", async ({
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
      request_id: "q-once",
      question_kind: "input",
      prompt: "Kirjoita jatko",
      choices: [],
    };
    await route.fulfill({ response, json: body });
  });
  let writes = 0;
  await page.route("**/api/v1/conversations/*/question", async (route) => {
    writes++;
    expect(route.request().postDataJSON()).toEqual({
      request_id: "q-once",
      action: "answer",
      value: "Jatka",
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schema_version: 1,
        request_id: "q-once",
        state: "uncertain",
      }),
    });
  });
  await refreshConversation(page);
  const question = page.getByRole("region", { name: "Pi:n kysymys" });
  await question.getByRole("textbox", { name: "Vastaus" }).fill("Jatka");
  await question.getByRole("button", { name: "Vastaa" }).click();
  await expect(question).toContainText("Ei tiedossa");
  await expect(question.getByRole("button")).toHaveCount(0);
  await page.reload();
  await expect(question).toContainText("Ei tiedossa");
  expect(writes).toBe(1);
});

test("@browser-conversation unknown question cancels once and a refused answer stays stale", async ({
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
      request_id: "q-unknown",
      question_kind: "unknown",
      prompt: "Tuntematon",
      choices: [],
    };
    await route.fulfill({ response, json: body });
  });
  let writes = 0;
  await page.route("**/api/v1/conversations/*/question", async (route) => {
    writes++;
    expect(route.request().postDataJSON()).toEqual({
      request_id: "q-unknown",
      action: "cancel",
    });
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ code: "control_uncertain" }),
    });
  });
  await refreshConversation(page);
  const question = page.getByRole("region", { name: "Pi:n kysymys" });
  await expect(question.getByRole("button")).toHaveCount(1);
  await question.getByRole("button", { name: "Peruuta kysymys" }).click();
  await expect(question).toContainText("Pyyntö voi olla vanhentunut");
  await expect(question.getByRole("button")).toHaveCount(0);
  expect(writes).toBe(1);
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
    page.getByText(/Yhteys katkesi. Näytetään viimeisin tunnettu tila./),
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
    page.getByText(/Yhteys katkesi. Näytetään viimeisin tunnettu tila./),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
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

test("@browser-conversation warm controlled return reads neither status nor history", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  const firstURL = page.url();
  await page.getByRole("link", { name: "ordinary-dir" }).last().click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname.startsWith("/api/v1/") &&
      url.pathname !== "/api/v1/events"
    )
      requests.push(url.pathname);
  });
  const start = await page.evaluate(() => performance.now());
  await page.goBack(); // workspace
  await page.goBack(); // first controlled window
  await expect(page).toHaveURL(firstURL);
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  const paint = await page.evaluate(
    () =>
      new Promise<number>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve(performance.now())),
        ),
      ),
  );
  expect(requests).toEqual([]);
  console.log(
    `warm controlled return: ${Math.round(paint - start)} ms (includes workspace navigation), ${requests.length} non-stream API requests`,
  );
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
      Object.keys(sessionStorage).filter((key) => key.includes(":draft:")),
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
  await expect(page.getByText(/Jatkaminen kuitattiin/)).toBeVisible();
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
        return route.fulfill({
          status: code === "capacity_exceeded" ? 429 : 409,
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
    ).toHaveCount(1);
    await refreshConversation(page);
    expect(attempts).toBe(1);
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
  await expect(page.getByText(/Jatkaminen kuitattiin/)).toBeVisible();
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

test("@browser-conversation cold open waits for status and reads only present history", async ({
  page,
}) => {
  await open(page);
  let releaseStatus!: () => void;
  const statusHold = new Promise<void>((resolve) => {
    releaseStatus = resolve;
  });
  let historyReads = 0;
  let nativeHistory: string | undefined;
  await page.route("**/api/v1/conversations/*/status*", async (route) => {
    await statusHold;
    const response = await route.fetch();
    if (response.ok()) nativeHistory = (await response.json()).native_history;
    await route.fulfill({ response });
  });
  page.on("request", (request) => {
    if (/\/api\/v1\/agents\/pi:.*\/history/.test(request.url())) historyReads++;
  });
  try {
    await page
      .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Ladataan keskustelua" }),
    ).toBeVisible();
    releaseStatus();
    await expect(
      page.getByRole("textbox", { name: "Viesti Pi:lle" }),
    ).toBeVisible();
    expect(["missing", "present"]).toContain(nativeHistory);
    expect(historyReads).toBe(nativeHistory === "missing" ? 0 : 1);
  } finally {
    releaseStatus();
  }
});

test("@browser-conversation idle tab and return do not reread session or status", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  await page.waitForTimeout(1000); // let the opening invalidation settle
  await page.clock.install();
  const counts = { session: 0, status: 0, snapshot: 0, events: 0 };
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path === "/auth/session") counts.session++;
    else if (path.endsWith("/status") && path.includes("/conversations/"))
      counts.status++;
    else if (path === "/api/v1/snapshot") counts.snapshot++;
    else if (path === "/api/v1/events") counts.events++;
  });
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  await page.clock.fastForward(60_000);
  expect(counts).toEqual({ session: 0, status: 0, snapshot: 0, events: 0 });
  expect(await page.locator(".ah-identity-check").count()).toBe(0);
});

test("@browser-conversation snapshot transport failure leaves editor mounted and retry works", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  await editor.fill("säilyvä luonnos");
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 503, body: "offline" }),
  );
  await page.getByRole("button", { name: "Päivitä" }).click();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toBeVisible();
  await expect(editor).toHaveValue("säilyvä luonnos");
  await page.unroute("**/api/v1/snapshot");
  await page.getByRole("button", { name: "Yhdistä" }).click();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toHaveCount(0);
  await expect(editor).toHaveValue("säilyvä luonnos");
});

test("@browser-conversation 401 from actual status request opens login", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  await page.route("**/api/v1/conversations/*/status*", (route) =>
    route.fulfill({ status: 401, body: "unauthorized" }),
  );
  await refreshConversation(page);
  await expect(
    page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
  ).toBeVisible();
});

test("@browser-conversation changed snapshot identity discards late previous status", async ({
  page,
  context,
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
  await page.route("**/api/v1/conversations/*/status*", async (route) => {
    started();
    await held;
    await route.continue().catch(() => {});
  });
  const other = await context.newPage();
  try {
    await refreshConversation(page);
    await entered;
    await other.goto("/workspaces");
    await other.getByRole("button", { name: /Tilivalikko/ }).click();
    await other.getByRole("menuitem", { name: "Kirjaudu ulos" }).click();
    await other.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await other.getByRole("link", { name: "Bob" }).click();
    let sessionReads = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/auth/session") sessionReads++;
    });
    await page.getByRole("button", { name: "Päivitä" }).click();
    await expect(
      page.getByRole("heading", { name: "Kohdetta ei enää löydy" }),
    ).toBeVisible();
    await expect.poll(() => sessionReads).toBeGreaterThan(0);
    release();
    await expect(
      page.getByRole("textbox", { name: "Viesti Pi:lle" }),
    ).toHaveCount(0);
  } finally {
    release();
    await other.close();
  }
});

test("@browser-conversation a lost accepted send resolves on reload without another write", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  let sends = 0;
  // Keep the receipt unavailable until reload; the daemon still accepts the write.
  await page.route("**/api/v1/conversations/*/status", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.route("**/api/v1/conversations/*/send", async (route) => {
    sends++;
    const response = await route.fetch(); // daemon accepted, only browser reply lost
    expect(response.status()).toBe(200);
    await route.abort("failed");
  });
  await editor.fill("only once");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(page.locator(".ah-send-uncertain")).toBeVisible();
  await page.unroute("**/api/v1/conversations/*/status");
  await page.reload();
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue("");
  await editor.fill("next deliberate message");
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeEnabled();
  expect(sends).toBe(1);
});

test("@browser-conversation queue-clear 401 reaches login", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  await editor.fill("hidas päätyö");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeVisible();
  await editor.fill("jonoon");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Tyhjennä jono" }),
  ).toBeVisible();
  await page.route("**/api/v1/conversations/*/clear_queue", (route) =>
    route.fulfill({ status: 401 }),
  );
  await page.getByRole("button", { name: "Tyhjennä jono" }).click();
  await expect(
    page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
  ).toBeVisible();
});

test("@browser-conversation catalog cursor 409 opens a new stream after snapshot", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  // Return to the catalog so it, not the conversation component, owns events.
  await page.getByRole("link", { name: "Etusivu" }).click();
  let streams = 0;
  await page.route("**/api/v1/events?after=*", (route) => {
    streams++;
    if (streams <= 2)
      return route.fulfill({ status: 409, body: "cursor_expired" });
    return route.continue();
  });
  await page.reload();
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect.poll(() => streams, { timeout: 10000 }).toBeGreaterThan(2);
});
