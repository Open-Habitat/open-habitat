import type { Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

// Sending before Pi runs (Jari 16.10.2026, proto-queued-send): the field is
// always usable, a message waits as a dashed bubble that the daemon holds,
// several are joined into one prompt, Stop gives them back, and a stopped
// conversation resumes only when the person sends. These cases run the real
// gateway, daemon controller and its restart against the synthetic fake Pi.

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});
test.beforeEach(async ({ page }) => {
  expect((await page.request.get("/fixture/reset-clock")).status()).toBe(204);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});

const editor = (page: Page) => page.getByTestId("message-input");
const send = (page: Page) =>
  page.getByTestId("send").and(page.locator('[data-mode="send"]'));
const waiting = (page: Page) => page.getByTestId("waiting-message");

async function scenario(page: Page, value: string) {
  expect(
    (await page.request.get(`/fixture/scenario?value=${value}`)).status(),
  ).toBe(204);
}

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
}

async function openWorkspace(page: Page) {
  await signIn(page);
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await expect(
    page.getByTestId(/^(new-conversation|conversation-start)$/),
  ).toBeEnabled();
}

function conversationId(page: Page) {
  const id = new URL(page.url()).searchParams.get("conversation");
  if (!id?.startsWith("pi:")) throw new Error("missing conversation");
  return id;
}

async function status(page: Page, id: string) {
  const reply = await page.request.get(
    `/api/v1/conversations/${id.slice(3)}/status`,
  );
  return reply.ok() ? await reply.json() : { state: `http_${reply.status()}` };
}

/** The person's messages as Pi saved them in native history. */
async function nativeUserTexts(page: Page, id: string) {
  const reply = await page.request.get(
    `/api/v1/agents/${id}/history?limit=100&after=`,
  );
  expect(reply.ok()).toBe(true);
  const body = await reply.json();
  return (body.entries as { kind: string; content?: { text?: string } }[])
    .filter((e) => e.kind === "user")
    .map((e) => e.content?.text ?? "");
}

function countSends(page: Page) {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/send"))
      posts.push(request.postDataJSON().command_id);
  });
  return posts;
}

/** A browser conversation with one answered turn. */
async function answeredConversation(page: Page, text: string) {
  await openWorkspace(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  const id = conversationId(page);
  await editor(page).fill(text);
  await send(page).click();
  await expectNativeContent(page, `Selvä. Kysyit: "${text}".`, {
    timeout: 20000,
  });
  await expect.poll(async () => (await status(page, id)).state).toBe("idle");
  return id;
}

test("@lazy-resume after a daemon restart the conversation stays writable, opening starts nothing, and the first send is delivered once", async ({
  page,
}) => {
  test.setTimeout(90000);
  const id = await answeredConversation(page, "ennen uudelleenkäynnistystä");
  // A release restarts the daemon: its Pi child and every handle are gone.
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  await page.reload();
  await expect(editor(page)).toBeEnabled({ timeout: 20000 });
  const header = page.locator(".ah-agent-header");
  await expect(header).not.toHaveAttribute("data-control", "read-only");
  await expect(
    page.locator(".ah-conversation-frame").getByTestId("read-only-indicator"),
  ).toHaveCount(0);
  // The conversation's workspace stays the sidebar's current place.
  await expect(
    page
      .getByRole("navigation")
      .locator('.ah-workspace-row a[aria-current="page"]'),
  ).toHaveCount(1);
  await expect(page.getByTestId("continue-conversation")).toHaveCount(0);
  await expectNativeContent(
    page.getByTestId("conversation-timeline"),
    "ennen uudelleenkäynnistystä",
    { exact: true },
  );
  // Opening, reading, scrolling and reconnecting never start Pi.
  await page.locator(".ah-conversation-stream").evaluate((el) => {
    el.scrollTop = 0;
    el.scrollTop = el.scrollHeight;
  });
  await page.reload();
  await expect(editor(page)).toBeEnabled({ timeout: 20000 });
  await page.waitForTimeout(500);
  expect((await status(page, id)).state).toBe("stopped");
  const handles = await (
    await page.request.get("/api/v1/conversations")
  ).json();
  expect(
    handles.sessions.map((s: { agent_id: string }) => s.agent_id),
  ).not.toContain(id);

  const posts = countSends(page);
  await editor(page).fill("jälkeen uudelleenkäynnistyksen");
  await send(page).click();
  await expectNativeContent(
    page,
    'Selvä. Kysyit: "jälkeen uudelleenkäynnistyksen".',
    { timeout: 30000 },
  );
  await expect(waiting(page)).toHaveCount(0);
  // A reconnect neither redraws the delivered message as waiting nor resends it.
  await page.reload();
  await expectNativeContent(
    page,
    'Selvä. Kysyit: "jälkeen uudelleenkäynnistyksen".',
    { timeout: 20000 },
  );
  await page.waitForTimeout(1000);
  await expect(waiting(page)).toHaveCount(0);
  expect(posts).toHaveLength(1);
  expect(
    (await nativeUserTexts(page, id)).filter(
      (t) => t === "jälkeen uudelleenkäynnistyksen",
    ),
  ).toHaveLength(1);
});

test("@lazy-resume Stop before Pi runs returns the waiting message to the field and Pi never receives it", async ({
  page,
}) => {
  test.setTimeout(90000);
  const id = await answeredConversation(page, "ensimmäinen kierros");
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  await page.reload();
  await expect(editor(page)).toBeEnabled({ timeout: 20000 });
  // Pi's own start takes six seconds in this scenario.
  await scenario(page, "pi-slow-start");
  await editor(page).fill("tämä ei saa lähteä");
  await send(page).click();
  const bubble = waiting(page).first();
  await expect(bubble).toHaveAttribute("data-waiting", "waiting");
  // The agreed waiting look (Kupla odottaa): a dashed bubble, not a sent one.
  await expect(bubble).toHaveCSS("border-top-style", "dashed");
  await expect(editor(page)).toHaveValue("");
  await expect(editor(page)).toBeEnabled();
  // No top-bar state while it waits and no account of Pi starting.
  const header = page.locator(".ah-agent-header");
  await expect(header.locator(".ah-agent-topline .ah-status")).toHaveCount(0);
  await expect(page.getByTestId("creation-progress")).toHaveCount(0);
  // Pi starting on send is the normal path (ADR 0020): its process bridge
  // is not up yet, and that is not a connection problem. Two process polls
  // pass inside the six-second start.
  await page.waitForTimeout(4500);
  expect((await status(page, id)).state).toBe("starting");
  await expect(bubble).toHaveAttribute("data-waiting", "waiting");
  const frame = page.locator(".ah-conversation-frame");
  await expect(frame.getByTestId("background-work")).toHaveCount(0);
  // Unknown thinking level ("fake-pi · Ei tiedossa") is not an unknown
  // process/connection state. Keep this assertion about startup errors.
  await expect(frame.getByTestId("working-uncertain")).toHaveCount(0);
  await expect(frame.getByTestId("conversation-problem")).toHaveCount(0);
  await expect(frame.getByRole("alert")).toHaveCount(0);
  await page
    .getByTestId("composer-stop")
    .and(page.locator('[data-stop-target="unsent"]'))
    .click();
  await expect(editor(page)).toHaveValue("tämä ei saa lähteä");
  await expect(waiting(page)).toHaveCount(0);
  await expect(page.getByTestId("held-message-notice")).toBeVisible();
  // Typing woke Pi (wake-stopped-agent), so it stays up for the text that
  // went back to the field; nothing was delivered to it.
  await expect
    .poll(async () => (await status(page, id)).state, { timeout: 30000 })
    .toBe("idle");
  await page.waitForTimeout(500);
  expect(await nativeUserTexts(page, id)).not.toContain("tämä ei saa lähteä");
});

test("@queued-send messages written while a conversation is created reach Pi as one prompt", async ({
  page,
}) => {
  test.setTimeout(90000);
  await scenario(page, "pi-slow-start");
  await signIn(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/conversations", async (route) => {
    if (route.request().method() === "POST") await held;
    await route.continue();
  });
  const posts = countSends(page);
  try {
    await page
      .getByRole("navigation")
      .getByTestId("workspace-start-ordinary-dir")
      .click();
    await expect(page).toHaveURL(/conversation=new$/);
    // The field is usable while the conversation is still being created.
    await expect(editor(page)).toBeFocused();
    await expect(page.getByTestId("creation-progress")).toHaveCount(0);
    await editor(page).fill("Kerro, mitä täällä on.");
    await editor(page).press("Enter");
    await editor(page).fill("Ehdota sitten rakenne.");
    await send(page).click();
    await expect(waiting(page)).toHaveCount(2);
    await expect(waiting(page).first()).toHaveAttribute(
      "data-waiting",
      "waiting",
    );
  } finally {
    release();
  }
  await expect(page).toHaveURL(/conversation=pi:/);
  const id = conversationId(page);
  // Still waiting for Pi after the conversation exists: the same two bubbles.
  await expect(waiting(page)).toHaveCount(2);
  await expect(editor(page)).toBeEnabled();
  await expectNativeContent(page, 'Selvä. Kysyit: "Kerro, mitä täällä on.', {
    timeout: 30000,
  });
  await expect(waiting(page)).toHaveCount(0);
  expect(await nativeUserTexts(page, id)).toEqual([
    "Kerro, mitä täällä on.\n\nEhdota sitten rakenne.",
  ]);
  expect(posts).toHaveLength(2); // one post per message, one native prompt
});

test("@queued-send a failed start keeps the message and a retry delivers it once", async ({
  page,
}) => {
  test.setTimeout(90000);
  await scenario(page, "pi-start-fail");
  await openWorkspace(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  const id = conversationId(page);
  await expect(editor(page)).toBeEnabled();
  await editor(page).fill("säilyvä viesti");
  await send(page).click();
  await expect(page.getByTestId("agent-start-failed")).toBeVisible({
    timeout: 20000,
  });
  await expect(waiting(page)).toHaveCount(1);
  const bubble = waiting(page).first();
  await expect(bubble).toHaveAttribute("data-waiting", "failed");
  await scenario(page, "ready");
  await page.getByTestId("retry").click();
  await expectNativeContent(page, 'Selvä. Kysyit: "säilyvä viesti".', {
    timeout: 30000,
  });
  await expect(waiting(page)).toHaveCount(0);
  expect(await nativeUserTexts(page, id)).toEqual(["säilyvä viesti"]);
});

test("@queued-send a reload while a message waits draws it once and never posts it again", async ({
  page,
}) => {
  test.setTimeout(120000);
  const id = await answeredConversation(page, "alku");
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  await page.reload();
  await expect(editor(page)).toBeEnabled({ timeout: 20000 });
  await scenario(page, "pi-slow-start");
  const posts = countSends(page);
  await editor(page).fill("kesken lähetetty");
  await send(page).click();
  await expect(waiting(page)).toHaveCount(1);
  await page.reload();
  // The daemon's held list redraws the same message; this tab does not post it.
  await expect(waiting(page)).toHaveCount(1, { timeout: 20000 });
  for (let attempt = 0; attempt < 3; attempt++) {
    let observed: Awaited<ReturnType<typeof status>>;
    await expect
      .poll(
        async () => {
          observed = await status(page, id);
          return ["idle", "start_failed"].includes(observed.state);
        },
        { timeout: 30000 },
      )
      .toBe(true);
    if (observed.state === "idle") break;
    // A census can become unproven after the UI's earlier observation. The
    // daemon retains the same message; only an explicit Retry may start Pi.
    expect(observed.start_problem).toBe("unproven");
    expect(attempt).toBeLessThan(2);
    expect(
      observed.held.map((message: { text: string }) => message.text),
    ).toEqual(["kesken lähetetty"]);
    await expect(waiting(page)).toHaveCount(1);
    const restarted = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname ===
          `/api/v1/conversations/${id.slice(3)}/continue`,
    );
    await page.getByTestId("retry").click();
    const reply = await restarted;
    if (reply.status() === 409)
      expect((await reply.json()).error.code).toBe("control_uncertain");
    else expect(reply.status()).toBe(200);
  }
  await expectNativeContent(page, 'Selvä. Kysyit: "kesken lähetetty".', {
    timeout: 30000,
  });
  await expect(waiting(page)).toHaveCount(0);
  expect(posts).toHaveLength(1);
  expect(
    (await nativeUserTexts(page, id)).filter((t) => t === "kesken lähetetty"),
  ).toHaveLength(1);
});

test("@queued-send a fresh conversation shows no missed-event or spinoff notices", async ({
  page,
}) => {
  test.setTimeout(60000);
  // Another conversation's events move the journal past the snapshot first.
  await answeredConversation(page, "toinen keskustelu");
  await page
    .getByRole("navigation")
    .getByTestId("workspace-start-ordinary-dir")
    .click();
  await expect(page).toHaveURL(/conversation=pi:/);
  await expect(editor(page)).toBeEnabled();
  await page.waitForTimeout(3500); // one spinoff refresh interval
  await expect(page.getByTestId("event-gap")).toHaveCount(0);
  await expect(page.getByTestId("spinoff-error")).toHaveCount(0);
});

test("@queued-send Luo työtila gives the new workspace one conversation with focus in its field", async ({
  page,
}) => {
  await signIn(page);
  await page.locator("main").getByTestId("workspace-create").click();
  await page.getByTestId("segment-directory").click();
  await page.getByTestId("directory-name").fill("tuore-tyotila");
  await page.getByTestId("create-directory").click();
  await expect(page).toHaveURL(/\/workspaces\/[^?]+\?conversation=/, {
    timeout: 20000,
  });
  await expect(editor(page)).toBeFocused();
  await expect(page).toHaveURL(/conversation=pi:/, { timeout: 20000 });
  await expect(editor(page)).toBeFocused();
  const workspace = page
    .getByRole("navigation")
    .getByTestId("workspace-tuore-tyotila");
  await expect(workspace.first()).toBeVisible();
  // Exactly one conversation was created for it.
  const sessions = (
    await (await page.request.get("/api/v1/conversations")).json()
  ).sessions as { workspace_id: string }[];
  const wsId = new URL(page.url()).pathname.split("/").pop();
  expect(sessions.filter((s) => s.workspace_id === wsId)).toHaveLength(1);
});

test("@lazy-resume a lost Stop reply still returns the text, exactly once", async ({
  page,
}) => {
  test.setTimeout(90000);
  const id = await answeredConversation(page, "ennen pysäytystä");
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  await page.reload();
  await expect(editor(page)).toBeEnabled({ timeout: 20000 });
  await scenario(page, "pi-slow-start");
  await editor(page).fill("palautuva viesti");
  await send(page).click();
  await expect(waiting(page)).toHaveCount(1);
  // The daemon takes the message back, but its reply never reaches the tab.
  await page.route("**/cancel_held", async (route) => {
    await route.fetch();
    await route.abort("failed");
  });
  await page
    .getByTestId("composer-stop")
    .and(page.locator('[data-stop-target="unsent"]'))
    .click();
  // The cancelled receipt alone restores it.
  await expect(editor(page)).toHaveValue("palautuva viesti", {
    timeout: 20000,
  });
  await expect(waiting(page)).toHaveCount(0);
  await page.waitForTimeout(1500);
  await expect(editor(page)).toHaveValue("palautuva viesti");
  expect(await nativeUserTexts(page, id)).not.toContain("palautuva viesti");
});

type HandoverSample = { waiting: number; native: boolean; processes: boolean };

/** Samples every 25 ms whether the message is drawn as waiting, as native
 * history, and whether a process pill is shown. */
async function sampleHandover(page: Page, text: string) {
  await page.evaluate((needle) => {
    const samples: HandoverSample[] = [];
    const timer = setInterval(() => {
      const feed = document.querySelector(".ah-feed");
      samples.push({
        waiting: document.querySelectorAll('[data-testid="waiting-message"]')
          .length,
        native: [
          ...(feed?.querySelectorAll('li[data-kind="user"]') ?? []),
        ].some(
          (li) =>
            !li.querySelector('[data-testid="waiting-message"]') &&
            (li.textContent ?? "").includes(needle),
        ),
        processes: !!document.querySelector('.ah-bg-badge[data-kind="proc"]'),
      });
    }, 25);
    Object.assign(window, {
      handover: samples,
      stopHandover: () => clearInterval(timer),
    });
  }, text);
}
async function handoverSamples(page: Page) {
  return page.evaluate(() => {
    const w = window as typeof window & {
      handover: HandoverSample[];
      stopHandover: () => void;
    };
    w.stopHandover();
    return w.handover;
  });
}
/** Live snapshots and history reads take over a second on the test server. */
async function liveLatency(page: Page) {
  for (const [pattern, ms] of [
    ["**/api/v1/agents/*/history*", 1200],
    ["**/api/v1/snapshot*", 1700],
  ] as const)
    await page.route(pattern, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      await route.continue();
    });
}

test("@queued-send a waiting message stays until native history replaces it", async ({
  page,
}) => {
  test.setTimeout(90000);
  await scenario(page, "pi-slow-start");
  await openWorkspace(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  await expect(editor(page)).toBeEnabled();
  await liveLatency(page);
  await sampleHandover(page, "Ehdota rakenne.");
  await editor(page).fill("Kerro, mitä täällä on.");
  await editor(page).press("Enter");
  await editor(page).fill("Ehdota rakenne.");
  await send(page).click();
  await expect(waiting(page)).toHaveCount(2);
  await expectNativeContent(page, 'Selvä. Kysyit: "Kerro, mitä täällä on.', {
    timeout: 30000,
  });
  await expect(waiting(page)).toHaveCount(0);
  const samples = await handoverSamples(page);
  const first = samples.findIndex((s) => s.waiting > 0);
  const missing = samples.slice(first).filter((s) => !s.waiting && !s.native);
  expect(first).toBeGreaterThanOrEqual(0);
  expect(missing.length * 25).toBeLessThanOrEqual(50);
  // Neither bubble is drawn twice for longer than a frame.
  const both = samples.filter((s) => s.waiting && s.native);
  expect(both.length * 25).toBeLessThanOrEqual(50);
  expect(samples.filter((s) => s.processes)).toEqual([]);
});

test("@lazy-resume a stopped conversation resumes on send without a process pill", async ({
  page,
}) => {
  test.setTimeout(90000);
  await answeredConversation(page, "ennen pysähtymistä");
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  await page.reload();
  await expect(editor(page)).toBeEnabled({ timeout: 20000 });
  await scenario(page, "pi-slow-start");
  await liveLatency(page);
  await sampleHandover(page, "herätä agentti");
  await editor(page).fill("herätä agentti");
  await send(page).click();
  await expectNativeContent(page, 'Selvä. Kysyit: "herätä agentti".', {
    timeout: 30000,
  });
  // One more process poll after the answer.
  await page.waitForTimeout(2500);
  const samples = await handoverSamples(page);
  expect(samples.filter((s) => s.processes)).toEqual([]);
  const first = samples.findIndex((s) => s.waiting > 0);
  expect(
    samples.slice(first).filter((s) => !s.waiting && !s.native).length * 25,
  ).toBeLessThanOrEqual(50);
});

// Stop while messages are queued (Jari 25.10.2026): what the agent has not
// acted on goes back to the field, once, and nothing is sent until the person
// sends it. The fake Pi delivers a queued message only at a turn boundary, and
// a "hidas" message waits two seconds before any model output, as a real
// model request can; Pi's own events decide what was delivered.
async function workingTurn(page: Page) {
  await openWorkspace(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  const id = conversationId(page);
  await editor(page).fill("hidas päätyö");
  await send(page).click();
  await expect(stopAgent(page)).toBeVisible();
  return id;
}
const stopAgent = (page: Page) =>
  page
    .getByTestId("composer-stop")
    .and(page.locator('[data-stop-target="agent"]'));
async function steer(page: Page, text: string) {
  await editor(page).fill(text);
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="steer"]'))
    .click();
  await expect(editor(page)).toHaveValue("");
}
/** Native history entries after the person's message: has the model acted? */
async function answeredAfter(page: Page, id: string, text: string) {
  const reply = await page.request.get(
    `/api/v1/agents/${id}/history?limit=100&after=`,
  );
  const entries = (await reply.json()).entries as {
    kind: string;
    content?: { text?: string };
  }[];
  const at = entries.findIndex(
    (e) => e.kind === "user" && e.content?.text === text,
  );
  return at >= 0 && entries.slice(at + 1).some((e) => e.kind === "assistant");
}
async function stoppedQuietly(page: Page, id: string, text: string) {
  await expect(stopAgent(page)).toHaveCount(0, { timeout: 20000 });
  await expect.poll(async () => (await status(page, id)).state).toBe("idle");
  // Nothing comes back later from Pi's queue either.
  await page.waitForTimeout(1500);
  return (await nativeUserTexts(page, id)).filter((t) => t === text).length;
}

test("@queued-send Stop returns a still-queued message to the field and sends nothing", async ({
  page,
}) => {
  test.setTimeout(60000);
  const id = await workingTurn(page);
  const posts = countSends(page);
  await steer(page, "jonossa oleva ohjaus");
  await expect(
    page.getByTestId("composer-queue").getByRole("listitem"),
  ).toHaveCount(1);
  await stopAgent(page).click();
  await expect(editor(page)).toHaveValue("jonossa oleva ohjaus");
  await expect(page.getByTestId("composer-queue")).toHaveCount(0);
  expect(await stoppedQuietly(page, id, "jonossa oleva ohjaus")).toBe(0);
  await expect(editor(page)).toHaveValue("jonossa oleva ohjaus");
  expect(posts).toHaveLength(0);
});

test("@queued-send Stop just after Pi delivered a queued message, before any answer, returns it once", async ({
  page,
}) => {
  test.setTimeout(60000);
  const id = await workingTurn(page);
  const posts = countSends(page);
  const text = "hidas ohjaus ehti perille";
  await steer(page, text);
  const queue = page.getByTestId("composer-queue");
  await expect(queue.getByRole("listitem")).toHaveCount(1);
  // Pi takes it at the turn boundary: it leaves the queue and is in history.
  await expect(queue).toHaveCount(0, { timeout: 20000 });
  await stopAgent(page).click();
  await expect(editor(page)).toHaveValue(text);
  // Pi's history keeps its one copy; the turn ended without an answer to it.
  expect(await stoppedQuietly(page, id, text)).toBe(1);
  await expect(editor(page)).toHaveValue(text);
  expect(posts).toHaveLength(0);
  await page.reload();
  await expectNativeContent(page.getByTestId("conversation-timeline"), text, {
    exact: true,
    count: 1,
    timeout: 20000,
  });
});

test("@queued-send Stop after the agent began acting on a queued message keeps it where it is", async ({
  page,
}) => {
  test.setTimeout(60000);
  const id = await workingTurn(page);
  const posts = countSends(page);
  const text = "hidas ohjaus jota agentti jo käsittelee";
  await steer(page, text);
  await expect
    .poll(() => answeredAfter(page, id, text), { timeout: 20000 })
    .toBe(true);
  await stopAgent(page).click();
  expect(await stoppedQuietly(page, id, text)).toBe(1);
  await expect(editor(page)).toHaveValue("");
  expect(posts).toHaveLength(0);
  await expectNativeContent(page.getByTestId("conversation-timeline"), text, {
    exact: true,
    count: 1,
  });
});

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
