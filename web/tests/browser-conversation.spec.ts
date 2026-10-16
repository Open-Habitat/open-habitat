import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { archiveFromConfirmedView } from "./archive-proof";
import { expect, test } from "./worker-host";

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
      .querySelector(".ah-composer-entry")
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
  const details = page.getByRole("button", { name: "Tiedot", exact: true });
  if ((await details.getAttribute("aria-expanded")) === "false")
    await details.click();
  await expect(check).toBeVisible();
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
test("@browser-conversation new controller stays calm and shares settled state with navigation", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const header = page.locator(".ah-agent-header");
  const row = page
    .locator(".ah-agent-item")
    .filter({ hasText: "Uusi keskustelu" });
  await expect(header.getByText("Odottaa")).toBeVisible();
  await expect(row.locator(".ah-nav-mark")).toBeVisible();
  await expect(page.getByText("Historia ei luettavissa")).toHaveCount(0);
  await expect(page.getByText("Tilannekatsaus")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Testaa uusi keskustelu");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  const id = new URL(page.url()).searchParams.get("conversation");
  if (!id) throw new Error("missing conversation id");
  await expect
    .poll(async () => {
      const response = await page.request.get(
        `/api/v1/conversations/${id.slice(3)}/status`,
      );
      const status = await response.json();
      return status.state === "idle" && status.native_history === "present";
    })
    .toBe(true);
  await expect(
    page.locator(".ah-agent-header").getByText("Odottaa"),
  ).toBeVisible();
  await expect(row.locator(".ah-nav-mark")).toBeVisible();
  await expect(page.getByText("Tilannekatsaus")).toHaveCount(0);
  await expect(page.getByText("Historia ei luettavissa")).toHaveCount(0);
});

test("@browser-conversation agent work default is a device preference that survives reload", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  const choice = page.getByRole("group", { name: "Agentin työ" });
  await choice.getByRole("button", { name: "Näkyvissä" }).click();
  await expect(
    choice.getByRole("button", { name: "Näkyvissä" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  await expect(
    page
      .getByRole("group", { name: "Agentin työ" })
      .getByRole("button", { name: "Näkyvissä" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("@browser-conversation saved assistant turn exposes bash command and folds work without hiding reply", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Tarkista tiedostot");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  const turn = page.getByRole("region", { name: "Agentin vuoro" }).first();
  await expect(turn.getByText("Selvä. Kysyit:", { exact: false })).toBeVisible({
    timeout: 30000,
  });
  await page.reload();
  await turn.getByRole("button", { name: /PI.*ajatusta/ }).click();
  const bash = turn.getByRole("button", { name: /bash.*valmis/ });
  await expect(bash).toHaveAttribute("aria-expanded", "false");
  await expect(bash.locator(".ah-tool-target")).toHaveText("ls");
  await bash.click();
  await expect(turn.getByText("$ ls")).toBeVisible();
  await expect(
    turn.getByRole("button", { name: "Kopioi tuloste" }),
  ).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include(".ah-bash-card").analyze())
      .violations,
  ).toEqual([]);
  await expect(turn.getByText("Argumentit")).toHaveCount(0);
  await expect(turn.getByText(/call_[a-z0-9]/)).toHaveCount(0);
  await turn.getByRole("button", { name: /PI.*ajatusta/ }).click();
  await expect(turn.getByText("$ ls")).toHaveCount(0);
  await expect(
    turn.getByText("Selvä. Kysyit:", { exact: false }),
  ).toBeVisible();
});

test("@browser-conversation latest action follows expanded output", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("pitkä tuloste");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(page.getByText("Selvä. Kysyit:", { exact: false })).toBeVisible({
    timeout: 30000,
  });
  await page.reload();
  await page.getByRole("button", { name: /PI.*ajatusta/ }).click();
  const bash = page.getByRole("button", { name: /bash.*valmis/ });
  await expect(bash).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "Viimeisimpään" })).toHaveCount(
    0,
  );
  await bash.click();
  await page
    .getByRole("button", { name: "Kaikki rivit" })
    .evaluate((button: HTMLButtonElement) => button.click());
  await page.locator(".ah-conversation-stream").evaluate((node) => {
    node.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -400, bubbles: true }),
    );
    node.scrollTop = 0;
    node.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  const latest = page.getByRole("button", { name: "Viimeisimpään" });
  await expect(latest).toBeVisible();
  await latest.click();
  await bash.click();
  await expect(latest).toHaveCount(0);
});

test("@browser-conversation workspace menu starts one native conversation", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: "Työtilan ordinary-dir toiminnot" })
    .click();
  await page.getByRole("menuitem", { name: "Uusi keskustelu" }).click();
  await expect(page).toHaveURL(/conversation=pi/);
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Luo uusi otsikko" }),
  ).toBeDisabled();
});

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
  // The identity-wide stream was opened before creating a conversation.
  // Creating it must not open a second stream (measured in the warm-switch test).
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
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
// Ordinary acceptance is covered by the native send/reload and lost-ack journeys.
for (const outcome of ["pending", "rejected", "uncertain"] as const) {
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
    await expect(page.locator(`.ah-send-${outcome}`)).toBeVisible();
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
    await expect(page.locator(`.ah-send-${outcome}`)).toBeVisible();
    expect(lookups).toBe(before); // matching status receipt avoids an extra request
    // The page still polls status. Let intercepted fetches finish before
    // Playwright disposes their responses during page teardown.
    await page.unrouteAll({ behavior: "wait" });
  });
}
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
  const missingReceipt = page.waitForResponse(
    (response) =>
      response.url().includes("/receipt?command_id=") &&
      response.status() === 404,
  );
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Odota kuittausta");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await entered;
  await expect(page.locator(".ah-send-pending")).toBeVisible();
  await refreshConversation(page);
  await missingReceipt;
  await expect(page.locator(".ah-send-uncertain")).toHaveCount(0);
  release();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveValue("");
  await expect(page.locator(".ah-send-accepted")).toHaveCount(0);
  expect(sends).toBe(1);
});
test("@browser-conversation settled turn uses its native strip without a duplicate receipt", async ({
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
  await expect(page.locator(".ah-settled")).toHaveCount(0);
  await expect(page.locator(".ah-turn-head").first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".ah-turn-head").first()).toBeVisible();
  await expectPhoneComposerWithinViewport(page);
});
test("@browser-conversation only reader scroll suspends following and returning to end resumes it", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const stream = page.locator(".ah-conversation-stream");
  await page.addStyleTag({
    content: ".ah-feed { min-height: 4000px !important; }",
  });
  await stream.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect
    .poll(() =>
      stream.evaluate((n) => n.scrollHeight - n.scrollTop - n.clientHeight),
    )
    .toBeLessThan(2);
  await stream.evaluate((node) =>
    node.dispatchEvent(new WheelEvent("wheel", { deltaY: 200, bubbles: true })),
  );
  const grow = () =>
    stream.evaluate((node) => {
      const li = document.createElement("li");
      li.style.height = "300px";
      node.querySelector(".ah-timeline")?.append(li);
    });
  await grow();
  await expect
    .poll(() =>
      stream.evaluate((n) => n.scrollHeight - n.scrollTop - n.clientHeight),
    )
    .toBeLessThan(2);
  await stream.evaluate((node) => {
    node.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -400, bubbles: true }),
    );
    node.scrollTop = 0;
  });
  await expect(
    page.getByRole("button", { name: "Viimeisimpään" }),
  ).toBeVisible();
  await stream.evaluate((node) => {
    node.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 4000, bubbles: true }),
    );
    node.scrollTop = node.scrollHeight;
  });
  await expect(page.getByRole("button", { name: "Viimeisimpään" })).toHaveCount(
    0,
  );
  await grow();
  await expect
    .poll(() =>
      stream.evaluate((n) => n.scrollHeight - n.scrollTop - n.clientHeight),
    )
    .toBeLessThan(2);
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

test("@browser-conversation settings checks Pi once; returning and foreground clicks do not revalidate", async ({
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
  await page.getByRole("button", { name: "Yhteydet", exact: true }).click();
  await expect(page.getByText("Pi-tunnukset käytettävissä")).toBeVisible();
  expect(checks).toBe(1);
  await page.getByRole("button", { name: "Takaisin" }).click();
  await expect(
    page.getByRole("heading", { name: "Pi-keskustelut" }),
  ).toBeVisible();
  expect(checks).toBe(1);
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
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
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
  const allStreams: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/events")
      allStreams.push(request.url());
  });
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
  const streams: string[] = [];
  const pending = new Set<import("@playwright/test").Request>();
  let lastRequest = Date.now();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/events") streams.push(request.url());
    if (
      url.pathname.startsWith("/api/v1/") &&
      url.pathname !== "/api/v1/events"
    ) {
      pending.add(request);
      requests.push(url.pathname);
      lastRequest = Date.now();
    }
  });
  const settled = (request: import("@playwright/test").Request) => {
    if (pending.delete(request)) lastRequest = Date.now();
  };
  page.on("requestfinished", settled);
  page.on("requestfailed", settled);
  // Creation can publish catalog/status notifications. Let those reads finish
  // before measuring route-caused requests; the SSE itself stays connected.
  await expect
    .poll(() => pending.size === 0 && Date.now() - lastRequest >= 300)
    .toBe(true);
  requests.length = 0;
  expect(streams).toEqual([]); // The initial connection predates the measurement.
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
  // Native default/refusal discovery is new and intentionally fresh when the
  // empty composer mounts (and when crossing the pre-start workspace view).
  // Status, timeline and recap must still stay warm; discovery cannot loop.
  expect(requests.filter((path) => path !== "/api/v1/pi/models")).toEqual([]);
  expect(requests.length).toBeLessThanOrEqual(2);
  expect(streams).toEqual([]);
  expect(allStreams).toHaveLength(1);
  console.log(
    `warm controlled return: ${Math.round(paint - start)} ms (includes workspace navigation), ${requests.length} model discovery reads, ${allStreams.length} total SSE, ${streams.length} reopened SSE`,
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
  await page.getByRole("menuitem", { name: "Kirjaudu ulos…" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kirjaudu ulos" })
    .click();
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Bob" }).click();
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) => key.includes(":draft:")),
    ),
  ).toEqual([]);
  await expect(page.getByText("toisen oma luonnos")).toHaveCount(0);
});

test("@browser-conversation logout fences a pending status read and turn even when server logout fails", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  await editor.fill("turn in progress");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await editor.fill("secret draft");
  const person = await page.evaluate(
    () =>
      Object.keys(sessionStorage)
        .find((key) => key.includes(":draft:"))
        ?.split(":")[1],
  );
  expect(person).toBeTruthy();
  await page.evaluate((identity) => {
    sessionStorage.setItem(`nah:${identity}:last-send:held`, "pending");
  }, person);
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
  await page.route("**/auth/logout", (route) => route.fulfill({ status: 503 }));
  try {
    await refreshConversation(page);
    await entered;
    await page.getByRole("button", { name: /Tilivalikko/ }).click();
    await page.getByRole("menuitem", { name: "Kirjaudu ulos…" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Kirjaudu ulos" })
      .click();
    await expect(
      page.getByText("Istunto voi olla edelleen voimassa."),
    ).toBeVisible();
    expect(
      await page.evaluate(
        (identity) =>
          Object.keys(sessionStorage).filter((key) =>
            key.startsWith(`nah:${identity}:`),
          ),
        person,
      ),
    ).toEqual([]);
    release();
    await expect(page.getByText("secret draft")).toHaveCount(0);
    await page.unroute("**/auth/logout");
    await page
      .getByRole("button", { name: "Yritä uloskirjautumista uudelleen" })
      .click();
    await expect(
      page.getByText("Istunto voi olla edelleen voimassa."),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice" }).click();
    await expect(
      page.getByRole("button", { name: /Tilivalikko/ }),
    ).toBeVisible();
  } finally {
    release();
  }
});

test("@browser-conversation a late create reply cannot restore a cleared command marker", async ({
  page,
}) => {
  await open(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/api/v1/conversations", async (route) => {
    started();
    await held;
    await route.continue().catch(() => {});
  });
  try {
    await page
      .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
      .click();
    await entered;
    const person = await page.evaluate(
      () =>
        Object.keys(sessionStorage)
          .find((key) => key.includes(":uncertain:"))
          ?.split(":")[1],
    );
    expect(person).toBeTruthy();
    await page.getByRole("button", { name: /Tilivalikko/ }).click();
    await page.getByRole("menuitem", { name: "Kirjaudu ulos…" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Kirjaudu ulos" })
      .click();
    await expect(
      page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
    ).toBeVisible();
    release();
    expect(
      await page.evaluate(
        (identity) =>
          Object.keys(sessionStorage).filter((key) =>
            key.startsWith(`nah:${identity}:`),
          ),
        person,
      ),
    ).toEqual([]);
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Bob" }).click();
    await expect(
      page.getByRole("button", { name: /Tilivalikko/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        (identity) =>
          Object.keys(sessionStorage).filter((key) =>
            key.startsWith(`nah:${identity}:`),
          ),
        person,
      ),
    ).toEqual([]);
  } finally {
    release();
  }
});

test("@browser-conversation expiry clears drafts and pending markers before same-person sign-in", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  await editor.fill("not for the next session");
  const person = await page.evaluate(
    () =>
      Object.keys(sessionStorage)
        .find((key) => key.includes(":draft:"))
        ?.split(":")[1],
  );
  expect(person).toBeTruthy();
  await page.evaluate((identity) => {
    sessionStorage.setItem(`nah:${identity}:uncertain:held`, "pending");
  }, person);
  expect((await page.request.get("/fixture/expire")).status()).toBe(204);
  // Expiry may reach the UI through the journal before the details control
  // can be clicked. Reload forces a session read in either state.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (identity) =>
        Object.keys(sessionStorage).filter((key) =>
          key.startsWith(`nah:${identity}:`),
        ),
      person,
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeVisible();
  await expect(page.getByText("not for the next session")).toHaveCount(0);
});

test("@browser-conversation expiry across reload clears unknown prior person's drafts", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  await editor.fill("private across reload");
  const person = await page.evaluate(
    () =>
      Object.keys(sessionStorage)
        .find((key) => key.includes(":draft:"))
        ?.split(":")[1],
  );
  expect(person).toBeTruthy();
  await page.evaluate((identity) => {
    sessionStorage.setItem(`nah:${identity}:last-send:held`, "pending");
    sessionStorage.setItem("nah:github-step", "global");
    sessionStorage.setItem("__oh_test_reload_seed", "1");
  }, person);
  // Re-seed once before the new App loads: the previous document may already
  // have seen a 401 from its stream, which would otherwise make this pass by luck.
  await page.addInitScript((identity) => {
    if (sessionStorage.getItem("__oh_test_reload_seed") !== "1") return;
    sessionStorage.removeItem("__oh_test_reload_seed");
    sessionStorage.setItem(
      `nah:${identity}:draft:held`,
      "private across reload",
    );
    sessionStorage.setItem(`nah:${identity}:last-send:held`, "pending");
  }, person);
  expect((await page.request.get("/fixture/expire")).status()).toBe(204);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (identity) =>
        Object.keys(sessionStorage).filter((key) =>
          key.startsWith(`nah:${identity}:`),
        ),
      person,
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(() => sessionStorage.getItem("nah:github-step")),
  ).toBe("global");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Bob" }).click();
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeVisible();
  await expect(page.getByText("private across reload")).toHaveCount(0);
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
  // The host can settle before the event stream delivers the send receipt to
  // the browser. Stopping Pi before that delivery would correctly leave the
  // browser uncertain, not ready for this helper's continuation assertion.
  await expect(
    page.getByText('Selvä. Kysyit: "synthetic end then continue".'),
  ).toBeVisible();
  await expect(editor).toBeEnabled();
  const { csrf } = await (await page.request.get("/auth/session")).json();
  const stopped = await page.request.post(
    `/api/v1/conversations/${id.slice(3)}/stop`,
    {
      headers: { "X-Agent-Host-CSRF": csrf, Origin: host },
    },
  );
  expect(stopped.status()).toBe(200);
  await refreshConversation(page);
  // A stop can initially be observed as uncertain. The explicit read-only
  // check proves the terminal history before this helper promises continuation.
  await page.getByRole("button", { name: "Tarkista keskustelun tila" }).click();
  await expect(
    page.getByRole("button", { name: "Jatka keskustelua" }),
  ).toBeVisible();
  await expect(editor).toHaveCount(0);
  return id;
}

test("@browser-conversation idle controlled Pi can archive without stopping its child", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await editor.fill("idle archive proof");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  const id = new URL(page.url()).searchParams.get("conversation");
  await expect
    .poll(async () => {
      const reply = await page.request.get(
        `/api/v1/conversations/${id?.slice(3)}/status`,
      );
      const state = await reply.json();
      return state.state === "idle" && state.native_history === "present";
    })
    .toBe(true);
  await refreshConversation(page);
  const archive = page
    .locator(".ah-agent-header")
    .getByRole("button", { name: "Arkistoi" });
  await expect(archive).toBeEnabled();
  await archive.click();
  await expect(page).toHaveURL(/\/workspaces\/[^?]+$/);
});

test("@browser-conversation phone archives directly into its workspace", async ({
  page,
}) => {
  const id = await endedConversation(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Arkistoi", exact: true }).click();
  await expect(
    page.getByRole("alertdialog", { name: "Vahvista arkistointi" }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/workspaces\/[^?]+$/);
  await expect(
    page.getByRole("region", { name: "Työtilan arkisto" }),
  ).toContainText("synthetic end then continue");
  await page.goto(`/agents/${id}`);
  await expect(
    page.getByRole("button", { name: "Palauta näkyviin" }),
  ).toBeEnabled();
});

test("@browser-conversation restart replaces an in-place running turn with native history", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await editor.fill("native reply before restart");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Keskusteluhistoria" })
      .getByText("native reply before restart", { exact: true }),
  ).toBeVisible();
  // Reload the controlled view with its native history, but prevent the old
  // stream from issuing a status event when the fixture replaces the daemon.
  await page.route("**/api/v1/events*", (route) => route.abort("failed"));
  await page.reload();
  await expect(editor).toBeVisible();
  let releaseStatus!: () => void;
  const heldStatus = new Promise<void>((resolve) => {
    releaseStatus = resolve;
  });
  await page.route("**/api/v1/conversations/*/status*", async (route) => {
    await heldStatus;
    await route.fulfill({ status: 404 });
  });
  try {
    expect(
      (await page.request.get("/fixture/conversations-reset")).status(),
    ).toBe(204);
    const snapshotRead = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/snapshot" &&
        response.ok(),
    );
    await page.getByRole("button", { name: "Päivitä", exact: true }).click();
    await snapshotRead;
    await expect(
      page.getByText("Keskustelun tila vanhentui", { exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/conversation=pi:/);
    releaseStatus();
    await expect(page).toHaveURL(/\/agents\/pi:/);
    await expect(page.locator(".ah-agent-header")).toContainText(
      "Ei käynnissä",
    );
  } finally {
    releaseStatus();
  }
  await expect(editor).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Jatka keskustelua" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Keskusteluhistoria" })
      .getByText("native reply before restart", { exact: true }),
  ).toBeVisible();
});

test("@browser-conversation restart offers native continuation and archive without a handle", async ({
  page,
}) => {
  test.setTimeout(60000);
  const id = await endedConversation(page);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
  await page.goto(`/agents/${id}`);
  const bar = page.locator(".ah-agent-header");
  // The reopened native history requires its own positive writer census. An
  // unknown census is fail-closed and the view rechecks it every five seconds;
  // wait for the real view to settle rather than treating unknown as idle.
  await expect(bar).toContainText("Ei käynnissä", { timeout: 20000 });
  await expect(bar.getByRole("button", { name: "Arkistoi" })).toBeEnabled();
  await bar.getByRole("button", { name: "Arkistoi" }).click();
  await page.goto(`/agents/${id}`);
  const restore = bar.getByRole("button", { name: "Palauta näkyviin" });
  await expect(restore).toBeEnabled();
  expect(
    (await new AxeBuilder({ page }).include(".ah-agent-header").analyze())
      .violations,
  ).toEqual([]);
  await restore.click();
  await expect(restore).toHaveCount(0);
  await expect(bar.getByRole("button", { name: "Arkistoi" })).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Jatka keskustelua" }),
  ).toBeVisible();
  // The write makes a fresh census of its own. A previously eligible view
  // can race a transient unknown census; retry only that explicit fail-closed
  // refusal after the view has observed a new positive result.
  for (let attempt = 0; attempt < 3; attempt++) {
    const reply = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname ===
          `/api/v1/conversations/${id.slice(3)}/continue`,
    );
    await page.getByRole("button", { name: "Jatka keskustelua" }).click();
    const response = await reply;
    if (response.status() === 200) break;
    expect(response.status()).toBe(409);
    expect((await response.json()).error.code).toBe("control_uncertain");
    expect(attempt).toBeLessThan(2);
    await expect(
      page.getByText("Jatkaminen ei onnistunut.", { exact: false }),
    ).toBeVisible();
    await expect(bar).toContainText("Ei käynnissä", { timeout: 20000 });
    await expect(
      page.getByRole("button", { name: "Jatka keskustelua" }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
});

test("@browser-conversation missing archive history never appears as a confirmed empty archive", async ({
  page,
}) => {
  await open(page);
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.sources.find(
      (fact: { source: string }) => fact.source === "pi_history",
    ).state = "unknown";
    body.agents = [];
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Työtilan arkisto" }),
  ).toContainText("Arkisto voi olla puutteellinen");
  await page.getByRole("link", { name: "Etusivu" }).click();
  await expect(
    page.getByText("Arkistoa ei voitu kokonaan tarkistaa"),
  ).toBeVisible();
});

test("@browser-conversation archive restores visibility before native continuation", async ({
  page,
}) => {
  const id = await endedConversation(page);
  await archiveFromConfirmedView(page, () =>
    page.getByRole("button", { name: "Arkistoi", exact: true }),
  );
  await page.getByRole("link", { name: "Etusivu" }).click();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "synthetic end then continue" }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  const workspaceURL = page.url();
  const archive = page.getByRole("region", { name: "Työtilan arkisto" });
  await expect(archive).toContainText("synthetic end then continue");
  await archive.getByRole("button", { name: "Palauta näkyviin" }).click();
  await expect(
    archive.getByRole("button", { name: "Palauta näkyviin" }),
  ).toHaveCount(0);
  await page.goto(`${workspaceURL}?conversation=${id}`);
  await refreshConversation(page);
  await page.getByRole("button", { name: "Jatka keskustelua" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("conversation")).toBe(id);
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
    // Refresh can leave a background status request in flight at test exit.
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

test("@browser-conversation ended browser conversation continues explicitly without reposting", async ({
  page,
}) => {
  const id = await endedConversation(page);
  // A normal focus refresh must not revoke a proven continuation before use.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Jatka keskustelua" }),
  ).toBeVisible();
  let continuations = 0,
    accepted = 0,
    refused = 0,
    sends = 0;
  let refusal: string | undefined;
  page.on("request", (r) => {
    if (r.url().endsWith("/continue")) {
      continuations++;
      expect(r.postData()).toBeNull();
      expect(r.headers()["x-agent-host-csrf"]).toBeTruthy();
    }
    if (r.url().endsWith("/send")) sends++;
  });
  // Read the definitive refusal before the browser can navigate away from a
  // response body. A failed read or any other denial must not cause a retry.
  await page.route(
    `**/api/v1/conversations/${id.slice(3)}/continue`,
    async (route) => {
      const upstream = await route.fetch();
      if (upstream.status() === 200) accepted++;
      if (upstream.status() === 409) {
        refused++;
        refusal = (await upstream.json()).error?.code;
      }
      await route.fulfill({ response: upstream });
    },
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    const delivered = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname ===
          `/api/v1/conversations/${id.slice(3)}/continue`,
    );
    await page.getByRole("button", { name: "Jatka keskustelua" }).click();
    const response = await delivered;
    if (response.status() === 200) break;
    expect(response.status()).toBe(409);
    expect(refusal).toBe("control_uncertain");
    expect(attempt).toBeLessThan(2);
    await expect(
      page.getByText("Jatkaminen estetty", { exact: true }),
    ).toBeVisible();
    await refreshConversation(page);
    await expect(page.locator(".ah-agent-header")).toContainText(
      "Ei käynnissä",
      { timeout: 20000 },
    );
    await expect(
      page.getByRole("button", { name: "Jatka keskustelua" }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  await expect(page.getByText(/Jatkaminen kuitattiin/)).toBeVisible();
  expect(accepted).toBe(1);
  expect(refused).toBe(continuations - 1);
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

test("@browser-conversation refused continuation never reposts after reload", async ({
  page,
}) => {
  const id = await endedConversation(page);
  let attempts = 0;
  await page.route(
    `**/api/v1/conversations/${id.slice(3)}/continue`,
    (route) => {
      attempts++;
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          schema_version: 1,
          error: {
            code: "writer_conflict",
            message: "not available",
            retryable: false,
            correlation_id: "req_00000000",
          },
        }),
      });
    },
  );
  await page.getByRole("button", { name: "Jatka keskustelua" }).click();
  await expect(page.getByText(/aktiivinen kirjoittaja/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Jatka keskustelua" }),
  ).toHaveCount(1);
  await refreshConversation(page);
  expect(attempts).toBe(1);
});

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
  let observed!: (response: import("@playwright/test").APIResponse) => void;
  let failed!: (error: unknown) => void;
  let result = new Promise<import("@playwright/test").APIResponse>(
    (resolve, reject) => {
      observed = resolve;
      failed = reject;
    },
  );
  let attempts = 0;
  await page.route(
    `**/api/v1/conversations/${id.slice(3)}/continue`,
    async (route) => {
      attempts++;
      try {
        const response = await route.fetch(); // native write or definite refusal
        observed(response);
        if (response.status() === 200) await held;
        await route.fulfill({ response });
      } catch (error) {
        failed(error);
        throw error;
      }
    },
  );
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const delivered = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname ===
            `/api/v1/conversations/${id.slice(3)}/continue`,
      );
      await page.getByRole("button", { name: "Jatka keskustelua" }).click();
      const response = await result;
      if (response.status() === 200) {
        // Status can settle from the journal before this successful HTTP reply.
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        release();
        expect((await delivered).status()).toBe(200);
        await expect(
          page.getByRole("textbox", { name: "Viesti Pi:lle" }),
        ).toBeEnabled();
        await expect(
          page.getByText("Jatkamisen tulos epävarma", { exact: true }),
        ).toHaveCount(0);
        expect(attempts).toBe(attempt + 1); // no browser retry or duplicate POST
        break;
      }
      // A refused write did not start a child. Only control_uncertain may be
      // retried, and only after a fresh affirmative native census in the UI.
      expect(response.status()).toBe(409);
      expect((await response.json()).error.code).toBe("control_uncertain");
      expect((await delivered).status()).toBe(409);
      expect(attempt).toBeLessThan(2);
      await expect(
        page.getByText("Jatkaminen estetty", { exact: true }),
      ).toBeVisible();
      await refreshConversation(page);
      await expect(page.locator(".ah-agent-header")).toContainText(
        "Ei käynnissä",
        {
          timeout: 20000,
        },
      );
      await expect(
        page.getByRole("button", { name: "Jatka keskustelua" }),
      ).toBeVisible();
      result = new Promise((resolve, reject) => {
        observed = resolve;
        failed = reject;
      });
    }
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
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("säilyvä luonnos");
  const conversationURL = new URL(page.url());
  await page
    .getByRole("button", { name: "Kirjaudu uudelleen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Kirjaudu OpenAI-tiliisi" }),
  ).toBeVisible();
  await page.request.get("/fixture/scenario?value=ready");
  await page.request.get("/fixture/pi-state?value=usable");
  await page.getByRole("button", { name: "Aloita kirjautuminen" }).click();
  await expect(
    page.getByRole("heading", { name: "Kirjaudu OpenAI-tiliisi" }),
  ).toHaveCount(0, { timeout: 12000 });
  await expect
    .poll(() => new URL(page.url()).searchParams.get("conversation"))
    .toBe(conversationURL.searchParams.get("conversation"));
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveValue("säilyvä luonnos");
  await expect(
    page.getByText("Kielimallikirjautuminen ei ole kunnossa"),
  ).toHaveCount(0);
});

test("@browser-conversation unsupported account model is not mistaken for expired login", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page.request.get("/fixture/scenario?value=pi-model-unsupported");
  await page.getByRole("textbox", { name: "Viesti Pi:lle" }).fill("kokeilu");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByText("Valittu kielimalli ei ole käytettävissä"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Kirjaudu uudelleen" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Valitse toinen malli" }).click();
  const picker = page.locator(".ah-actionable-notices .ah-pi-model-selector");
  await picker.getByRole("radio", { name: /GPT-6 Astra/ }).check();
  await page.request.get("/fixture/scenario?value=ready");
  const oldURL = page.url();
  await picker
    .getByRole("button", {
      name: "Aloita uusi keskustelu mallilla gpt-6-astra",
    })
    .click();
  await expect(page).not.toHaveURL(oldURL);
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveValue("");
  expect(
    (await (await page.request.get("/api/v1/pi/models")).json()).default_model,
  ).toBe("gpt-6-astra");
  await page.getByRole("textbox", { name: "Viesti Pi:lle" }).fill("uusi malli");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Keskusteluhistoria" })
      .getByText("uusi malli"),
  ).toBeVisible();
  await expect(page.locator(".ah-agent-header .ah-set-chip")).toHaveText(
    /gpt-6-astra/,
  );
  expect(await page.locator("main").innerText()).not.toContain(
    "synthetic-secret",
  );
});

test("@browser-conversation cold open waits for status before reading history", async ({
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
    expect(historyReads).toBe(0);
    releaseStatus();
    await expect(
      page.getByRole("textbox", { name: "Viesti Pi:lle" }),
    ).toBeVisible();
    expect(["missing", "present"]).toContain(nativeHistory);
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
    await other.getByRole("menuitem", { name: "Kirjaudu ulos…" }).click();
    await other
      .getByRole("dialog")
      .getByRole("button", { name: "Kirjaudu ulos" })
      .click();
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
  // A successful snapshot already in flight must not restore the old view
  // after the actual queue write reports an expired session.
  let release!: () => void;
  let started!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const intercepted = new Promise<void>((resolve) => {
    started = resolve;
  });
  let finish!: (outcome: "delivered" | "cancelled" | Error) => void;
  const finished = new Promise<"delivered" | "cancelled" | Error>((resolve) => {
    finish = resolve;
  });
  let signedOut = false;
  let routeStarted = false;
  await page.route("**/api/v1/snapshot", async (route) => {
    routeStarted = true;
    try {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      started();
      await held;
      await route.fulfill({ response });
      finish("delivered");
    } catch (error) {
      started(); // Also unblock the test if the upstream snapshot fetch failed.
      // Navigation on expiry may auto-handle an intercepted request. Only that
      // specific cancellation *after* login is expected; surface every other
      // route/fetch failure rather than hiding it during fixture teardown.
      if (
        signedOut &&
        error instanceof Error &&
        /Route is already handled!/.test(error.message)
      ) {
        finish("cancelled");
      } else {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    }
  });
  let routeOutcome: "delivered" | "cancelled" | Error | undefined;
  try {
    await page.getByRole("button", { name: "Päivitä" }).click();
    await intercepted;
    await page.route("**/api/v1/conversations/*/clear_queue", (route) =>
      route.fulfill({ status: 401 }),
    );
    await page.getByRole("button", { name: "Tyhjennä jono" }).click();
    await expect(
      page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
    ).toBeVisible();
    signedOut = true;
    release();
    routeOutcome = await finished;
    if (routeOutcome instanceof Error) throw routeOutcome;
    // If navigation cancelled the old response there is nothing to deliver;
    // otherwise the late successful snapshot must not resurrect the session.
    await expect(
      page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
    ).toBeVisible();
    await expect(editor).toHaveCount(0);
  } finally {
    release();
    // Wait for the specific handler, not all routes on the page. Never dispose
    // its fetched response while it is still in flight.
    if (routeStarted) routeOutcome = await finished;
    await page.unrouteAll({ behavior: "wait" });
  }
  if (routeOutcome instanceof Error) throw routeOutcome;
});

test("@browser-conversation cursor 409 waits for a newer snapshot before reopening", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  // The tab-wide stream stays active when returning to the catalog.
  await page.getByRole("link", { name: "Etusivu" }).click();
  let streams = 0;
  let snapshots = 0;
  await page.route("**/api/v1/snapshot", (route) => {
    snapshots++;
    return route.continue();
  });
  await page.route("**/api/v1/events?after=*", (route) => {
    streams++;
    if (streams <= 2)
      return route.fulfill({ status: 409, body: "cursor_expired" });
    return route.continue();
  });
  await page.reload();
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect.poll(() => snapshots, { timeout: 10000 }).toBeGreaterThan(1);
  expect(streams).toBe(2); // No replay from a snapshot older than the gap.
});

test("@browser-conversation lost accepted reply recovers on HTTP snapshot without an event", async ({
  page,
}) => {
  // Keep SSE unavailable during the lost receipt and freeze scheduled
  // retries: the HTTP snapshot must initiate the check on its own. Let the
  // initial conversation become writable before disabling its event stream.
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeEnabled();
  await page.route("**/api/v1/events?after=*", (route) => route.abort());
  await page.clock.pauseAt(new Date());
  let sends = 0;
  await page.route("**/api/v1/conversations/*/send", async (route) => {
    sends++;
    const reply = await route.fetch();
    expect(reply.status()).toBe(200);
    await route.abort("failed");
  });
  await page.route("**/api/v1/conversations/*/status", (route) =>
    route.abort(),
  );
  await page.route("**/api/v1/snapshot", (route) => route.abort());
  await editor.fill("original message");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(page.locator(".ah-send-uncertain")).toBeVisible();
  await expect(page.getByText("Lähetysvirhe", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await expect(
    page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeDisabled();
  await expect(editor).toHaveValue("original message");
  await page.unroute("**/api/v1/conversations/*/status");
  await page.unroute("**/api/v1/snapshot");
  await page.getByRole("button", { name: "Yhdistä" }).click();
  await expect(page.locator(".ah-send-uncertain")).toHaveCount(0);
  await expect(editor).toHaveValue("");
  await editor.fill("next deliberate message");
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeEnabled();
  expect(sends).toBe(1);
});

test("@browser-conversation a receipt lost on daemon restart remains unknown", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  let sends = 0;
  await page.route("**/api/v1/conversations/*/send", async (route) => {
    sends++;
    await route.abort("failed");
  });
  await page.route("**/api/v1/conversations/*/status", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.command_id = "";
    body.ack = "";
    body.send_receipt = "";
    await route.fulfill({ response, json: body });
  });
  let lookups = 0;
  await page.route(
    "**/api/v1/conversations/*/receipt?command_id=*",
    (route) => {
      lookups++;
      return route.fulfill({ status: 404 });
    },
  );
  await editor.fill("unknown message");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(page.locator(".ah-send-uncertain")).toBeVisible();
  await expect.poll(() => lookups).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await expect.poll(() => lookups).toBeGreaterThan(1);
  await expect(page.locator(".ah-send-rejected")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeDisabled();
  await expect(editor).toHaveValue("unknown message");
  expect(sends).toBe(1);
});

test("@browser-conversation daemon restart loses controller without declaring the send rejected", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  let sends = 0;
  await page.route("**/api/v1/conversations/*/send", async (route) => {
    sends++;
    await route.abort("failed");
  });
  await page.route("**/api/v1/conversations/*/status", (route) =>
    route.fulfill({ status: 404 }),
  );
  await editor.fill("cannot prove delivery");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByText("Ohjaus ei ole enää käytettävissä", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".ah-send-rejected")).toHaveCount(0);
  await expect(editor).toHaveValue("cannot prove delivery");
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeDisabled();
  expect(sends).toBe(1);
});

test("@browser-conversation queued command with pending ack stays pending without a receipt", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await editor.fill("hidas päätyö");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(editor).toHaveValue("");
  let command = "";
  let queues = 0;
  await page.route("**/api/v1/conversations/*/follow_up", async (route) => {
    queues++;
    command = (route.request().postDataJSON() as { command_id: string })
      .command_id;
    await route.continue();
  });
  await page.route("**/api/v1/conversations/*/status", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (command && body.command_id === command) {
      body.state = "pending";
      body.ack = "pending";
      body.send_receipt = "";
    }
    await route.fulfill({ response, json: body });
  });
  await editor.fill("jonoon vain kerran");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(page.locator(".ah-send-pending")).toBeVisible();
  await expect(page.locator(".ah-send-uncertain")).toHaveCount(0);
  expect(queues).toBe(1);
});

test("@browser-conversation home card blocks archive during Pi work, shows failure and removes on success", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page.getByRole("textbox", { name: "Viesti Pi:lle" }).fill("päätyö");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(page.getByText("Selvä. Kysyit:", { exact: false })).toBeVisible({
    timeout: 30000,
  });
  const agentId = new URL(page.url()).searchParams.get("conversation");
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const agent = body.agents?.find(
      (a: { agent_id: string }) => a.agent_id === agentId,
    );
    if (agent) agent.activity = "running";
    await route.fulfill({ response, json: body });
  });
  await page.getByRole("link", { name: "Etusivu", exact: true }).click();
  await page.reload();
  const card = page.locator(".ah-home-card").filter({ hasText: "päätyö" });
  const archive = card.getByRole("button", { name: "Arkistoi" });
  await expect(card).toBeVisible();
  await expect(archive).toBeDisabled();
  await expect(archive.locator("..")).toHaveAttribute(
    "title",
    "Odota Pi:n vuoron päättymistä.",
  );
  await page.unroute("**/api/v1/snapshot");
  await page.reload();
  await expect(archive).toBeEnabled({ timeout: 30000 });
  let refused = false;
  await page.route("**/api/v1/workspaces", async (route) => {
    if (
      !refused &&
      route.request().method() === "POST" &&
      route.request().postData()?.includes('"conversation_archive"')
    ) {
      refused = true;
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "writer_conflict" } }),
      });
    } else await route.continue();
  });
  await archive.click();
  await expect(card).toBeVisible();
  await expect(card.getByRole("alert")).toContainText(
    "Arkistointia ei voitu vahvistaa",
  );
  await page.locator(".ah-home-name").first().click();
  await expect(page.getByText("Arkiston tila epävarma")).toHaveCount(0);
  await page.getByRole("link", { name: "Etusivu", exact: true }).click();
  await archive.click();
  await expect(card).toHaveCount(0);
  await expect(page).toHaveURL(/\/workspaces$/);
});

test("@browser-conversation archive hides navigation before host reply and rolls back refusal", async ({
  page,
}) => {
  await endedConversation(page);
  const row = page
    .getByRole("navigation")
    .getByRole("link", { name: "synthetic end then continue" });
  await expect(row).toBeVisible();
  let release!: () => void;
  let requested!: () => void;
  const seen = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/workspaces", async (route) => {
    if (
      route.request().method() !== "POST" ||
      !route.request().postData()?.includes('"conversation_archive"')
    ) {
      await route.continue();
      return;
    }
    requested();
    await held;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "writer_conflict" } }),
    });
  });
  await page.getByRole("button", { name: "Arkistoi", exact: true }).click();
  await seen;
  await expect(row).toHaveCount(0);
  await expect(
    page.getByText("Keskustelu arkistoitu.", { exact: false }),
  ).toHaveCount(0);
  release();
  await expect(row).toBeVisible();
  await expect(
    page
      .getByText(/Arkistointia ei tehty|Arkistoinnin tulos on epävarma/)
      .first(),
  ).toBeVisible();
});

test("@browser-conversation new conversation keeps icon bar during archive fact delay", async ({
  page,
}) => {
  await open(page);
  await page.route("**/api/v1/snapshot", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(page.locator(".ah-agent-header")).toBeVisible();
  await expect(
    page.locator(".ah-agent-header").getByRole("button", { name: "Sulje" }),
  ).toBeDisabled();
  await expect(page.getByText("Arkiston tilaa ei voitu tarkistaa")).toHaveCount(
    0,
  );
  await expect(
    page
      .locator(".ah-agent-header")
      .getByRole("button", { name: "Luo uusi otsikko" }),
  ).toBeDisabled();
});

test("@browser-conversation empty browser conversation closes without confirmation", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const close = page
    .locator(".ah-agent-header")
    .getByRole("button", { name: "Sulje" });
  await expect(close).toBeEnabled();
  await close.click();
  await expect(page).toHaveURL(/\/workspaces\/ws_/);
  await expect(page.getByRole("alertdialog", { name: /arkist/i })).toHaveCount(
    0,
  );
  await expect(
    page.locator(".ah-agent-header").getByRole("button", { name: "Sulje" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(page).toHaveURL(/\?conversation=pi:[0-9a-f-]+$/);
  await expect(
    page.locator(".ah-agent-header").getByRole("button", { name: "Sulje" }),
  ).toBeEnabled();
});

test("@browser-conversation failed close restores the conversation", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(page).toHaveURL(/\?conversation=pi:[0-9a-f-]+$/);
  const before = page.url();
  await page.route("**/api/v1/conversations/*/close", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: '{"schema_version":1,"code":"control_uncertain"}',
    }),
  );
  const close = page
    .locator(".ah-agent-header")
    .getByRole("button", { name: "Sulje" });
  await expect(close).toBeEnabled();
  await close.click();
  await expect(page).toHaveURL(before);
  await expect(page.locator(".ah-agent-header")).toBeVisible();
});

test("@browser-conversation archive stays hidden across delayed successful host reply", async ({
  page,
}) => {
  await endedConversation(page);
  const row = page
    .getByRole("navigation")
    .getByRole("link", { name: "synthetic end then continue" });
  let release!: () => void;
  let requested!: () => void;
  const seen = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/workspaces", async (route) => {
    if (
      route.request().method() !== "POST" ||
      !route.request().postData()?.includes('"conversation_archive"')
    ) {
      await route.continue();
      return;
    }
    requested();
    await held;
    await route.continue();
  });
  await page.getByRole("button", { name: "Arkistoi", exact: true }).click();
  await seen;
  await expect(row).toHaveCount(0);
  release();
  await expect(page).toHaveURL(/\/workspaces\/[^?]+$/);
  await expect(row).toHaveCount(0);
});

test("@browser-conversation explicit new-conversation choice leaves native default unchanged", async ({
  page,
}) => {
  await open(page);
  const pill = page.locator(".md-new").first();
  await pill.locator(":scope > summary").click();
  await pill.getByRole("radio", { name: /GPT-6 Nova/ }).check();
  await pill.getByRole("button", { name: "high", exact: true }).click();
  expect(
    (await (await page.request.get("/api/v1/pi/models")).json()).default_model,
  ).toBeNull();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("nova only in this conversation");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(page.locator(".ah-agent-header .ah-set-chip")).toContainText(
    "gpt-6-nova",
  );
  expect(
    (await (await page.request.get("/api/v1/pi/models")).json()).default_model,
  ).toBeNull();
  // The top-bar picker offers a new session, never silent replay into this one.
  await page.locator(".md-chip-picker > summary").click();
  const pop = page.locator(".md-pop");
  await pop.getByRole("radio", { name: /GPT-6 Astra/ }).check();
  await expect(
    pop.getByRole("button", {
      name: "Aloita uusi keskustelu mallilla gpt-6-astra",
    }),
  ).toBeEnabled();
  await expect(pop).toContainText("Aiemmin lähetettyä viestiä ei toisteta");
});

test("@browser-conversation empty composer replacement releases its previous native child", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  for (const model of ["Astra", "Nova", "Astra", "Nova"]) {
    const previous = page.url();
    const composer = page.getByRole("region", { name: "Kirjoita viesti" });
    await composer.locator(".md-new > summary").click();
    await composer
      .getByRole("radio", { name: new RegExp(`GPT-6 ${model}`) })
      .check();
    await composer
      .getByRole("button", { name: /Aloita uusi keskustelu mallilla/ })
      .click();
    await expect(page).not.toHaveURL(previous);
    await expect(
      page.getByRole("button", { name: "Lähetä", exact: true }),
    ).not.toHaveAttribute("aria-busy", "true");
    await expect
      .poll(
        async () =>
          (await (await page.request.get("/api/v1/conversations")).json())
            .sessions.length,
      )
      .toBe(1);
  }
});

test("@conversation-details archive undo returns to conversation; offer pauses and expires", async ({
  page,
}) => {
  const id = await endedConversation(page);
  await archiveFromConfirmedView(page, () =>
    page.getByRole("button", { name: "Arkistoi", exact: true }),
  );
  const notice = page.locator(".ah-archive-notice");
  await expect(notice).toBeVisible();
  await page.clock.install();
  await notice.hover();
  await page.clock.fastForward(9000);
  await expect(notice).toBeVisible();
  const undo = notice.getByRole("button", { name: "Palauta", exact: true });
  await undo.focus();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(9000);
  await expect(notice).toBeVisible();
  await undo.click();
  await expect(page).toHaveURL(new RegExp(`(?:conversation=|agents/)${id}`));
  await expect(notice).toHaveCount(0);
});

test("@conversation-details archive offer expires after eight unpaused seconds", async ({
  page,
}) => {
  await endedConversation(page);
  await archiveFromConfirmedView(page, () =>
    page.getByRole("button", { name: "Arkistoi", exact: true }),
  );
  const notice = page.locator(".ah-archive-notice");
  await expect(notice).toBeVisible();
  await page.clock.install();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(8100);
  await expect(notice).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Palauta näkyviin" }),
  ).toBeVisible();
});

test("@conversation-details failed bash has a cause corner and one failed tool in summary", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page.getByRole("textbox", { name: "Viesti Pi:lle" }).fill("epäonnistu");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  const summary = page.getByRole("button", { name: /PI.*1 epäonnistui/ });
  await expect(summary).toBeVisible({ timeout: 25000 });
  await summary.click();
  const tool = page.locator(".ah-tool-row").filter({ hasText: "bash" }).first();
  await expect(tool).toContainText("paluuarvo 2");
  await expect(
    tool.locator('[title="Command exited with code 2"]'),
  ).toBeVisible();
  await tool.getByRole("button").first().click();
  await expect(tool).toContainText("synteettinen komento epäonnistui");
  await expect(
    tool.locator("pre").filter({ hasText: "Command exited with code 2" }),
  ).toHaveCount(0);
});

test("@conversation-details latest pill names working and unread reply with its count", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  // Layout makes it possible to leave the end during this short synthetic turn.
  await page.addStyleTag({
    content: ".ah-feed { min-height: 4000px !important; }",
  });
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("unread reply");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  const stream = page.locator(".ah-conversation-stream");
  await stream.evaluate((node) => {
    node.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -400, bubbles: true }),
    );
    node.scrollTop = 0;
  });
  await expect(
    page.getByRole("button", { name: "Viimeisimpään, Pi työskentelee" }),
  ).toBeVisible();
  const reply = page.getByRole("button", {
    name: "Viimeisimpään, uusi vastaus",
  });
  await expect(reply).toContainText("Uusi vastaus (2)", { timeout: 25000 });
  await reply.press("Enter");
  await expect(reply).toHaveCount(0);
  await expect(stream).toBeFocused();
});
