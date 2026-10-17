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

const editor = (page: Page) =>
  page.getByRole("textbox", { name: "Viesti Pi:lle" });
const send = (page: Page) =>
  page.getByRole("button", { name: "Lähetä", exact: true });
const waiting = (page: Page) => page.locator("[data-waiting]");

async function scenario(page: Page, value: string) {
  expect(
    (await page.request.get(`/fixture/scenario?value=${value}`)).status(),
  ).toBe(204);
}

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
}

async function openWorkspace(page: Page) {
  await signIn(page);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  await expect(
    page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
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
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  const id = conversationId(page);
  await editor(page).fill(text);
  await send(page).click();
  await expect(page.getByText(`Selvä. Kysyit: "${text}".`)).toBeVisible({
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
  await expect(header).not.toContainText("Vain luku");
  await expect(
    page.locator(".ah-conversation-frame").getByText("Vain luku"),
  ).toHaveCount(0);
  // In the sidebar only terminal-origin history remains read-only.
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: /ennen uudelleenkäynnistystä/ }),
  ).not.toContainText("Vain luku");
  await expect(
    page.getByRole("button", { name: "Jatka keskustelua" }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Keskusteluhistoria" })
      .getByText("ennen uudelleenkäynnistystä", { exact: true }),
  ).toBeVisible();
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
  await expect(
    page.getByText('Selvä. Kysyit: "jälkeen uudelleenkäynnistyksen".'),
  ).toBeVisible({ timeout: 30000 });
  await expect(waiting(page)).toHaveCount(0);
  // A reconnect neither redraws the delivered message as waiting nor resends it.
  await page.reload();
  await expect(
    page.getByText('Selvä. Kysyit: "jälkeen uudelleenkäynnistyksen".'),
  ).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1000);
  await expect(waiting(page)).toHaveCount(0);
  expect(posts).toHaveLength(1);
  expect(
    (await nativeUserTexts(page, id)).filter(
      (t) => t === "jälkeen uudelleenkäynnistyksen",
    ),
  ).toHaveLength(1);
});

test("@lazy-resume Stop before Pi runs returns the waiting message to the field and leaves Pi stopped", async ({
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
  const bubble = waiting(page).filter({ hasText: "tämä ei saa lähteä" });
  await expect(bubble).toHaveAttribute("data-waiting", "waiting");
  await expect(bubble).toContainText("Odottaa Pi:tä");
  // The agreed waiting look (Kupla odottaa): a dashed bubble, not a sent one.
  await expect(bubble).toHaveCSS("border-top-style", "dashed");
  await expect(editor(page)).toHaveValue("");
  await expect(editor(page)).toBeEnabled();
  // No top-bar state while it waits and no account of Pi starting.
  const header = page.locator(".ah-agent-header");
  await expect(header).not.toContainText(/Lähetetään|Odottaa sinua/);
  await expect(page.getByText(/Pi käynnistyy|Luodaan keskustelua/)).toHaveCount(
    0,
  );
  // Pi starting on send is the normal path (ADR 0020): its process bridge
  // is not up yet, and that is not a connection problem. Two process polls
  // pass inside the six-second start.
  await page.waitForTimeout(4500);
  expect((await status(page, id)).state).toBe("starting");
  await expect(bubble).toHaveAttribute("data-waiting", "waiting");
  const frame = page.locator(".ah-conversation-frame");
  await expect(frame.getByRole("region", { name: "Taustatyö" })).toHaveCount(0);
  await expect(
    frame.getByText(/yhteys|yhteyttä|ei ole käynnissä|ei tiedossa/i),
  ).toHaveCount(0);
  await expect(frame.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Pysäytä: viesti ei lähde" }).click();
  await expect(editor(page)).toHaveValue("tämä ei saa lähteä");
  await expect(waiting(page)).toHaveCount(0);
  await expect(
    page.getByText("Viesti ei lähtenyt. Se on taas kentässä."),
  ).toBeVisible();
  // The Pi that was started for it is closed again once it is ready.
  await expect
    .poll(async () => (await status(page, id)).state, { timeout: 30000 })
    .toBe("stopped");
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
      .getByRole("button", {
        name: "Uusi keskustelu työtilassa ordinary-dir",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/conversation=new$/);
    // The field is usable while the conversation is still being created.
    await expect(editor(page)).toBeFocused();
    await expect(
      page.getByText(/Luodaan keskustelua|Pi käynnistyy/),
    ).toHaveCount(0);
    await editor(page).fill("Kerro, mitä täällä on.");
    await editor(page).press("Enter");
    await editor(page).fill("Ehdota sitten rakenne.");
    await send(page).click();
    await expect(waiting(page)).toHaveCount(2);
    await expect(waiting(page).first()).toContainText("Odottaa Pi:tä");
  } finally {
    release();
  }
  await expect(page).toHaveURL(/conversation=pi:/);
  const id = conversationId(page);
  // Still waiting for Pi after the conversation exists: the same two bubbles.
  await expect(waiting(page)).toHaveCount(2);
  await expect(editor(page)).toBeEnabled();
  await expect(
    page.getByText('Selvä. Kysyit: "Kerro, mitä täällä on.', { exact: false }),
  ).toBeVisible({ timeout: 30000 });
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
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  const id = conversationId(page);
  await expect(editor(page)).toBeEnabled();
  await editor(page).fill("säilyvä viesti");
  await send(page).click();
  await expect(page.getByText("Pi ei käynnistynyt.")).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText("Viesti on tallessa.")).toBeVisible();
  const bubble = waiting(page).filter({ hasText: "säilyvä viesti" });
  await expect(bubble).toHaveAttribute("data-waiting", "failed");
  await expect(bubble).toContainText("Ei lähtenyt");
  await scenario(page, "ready");
  await page.getByRole("button", { name: "Yritä uudelleen" }).click();
  await expect(page.getByText('Selvä. Kysyit: "säilyvä viesti".')).toBeVisible({
    timeout: 30000,
  });
  await expect(waiting(page)).toHaveCount(0);
  expect(await nativeUserTexts(page, id)).toEqual(["säilyvä viesti"]);
});

test("@queued-send a reload while a message waits draws it once and never posts it again", async ({
  page,
}) => {
  test.setTimeout(90000);
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
  await expect(
    page.getByText('Selvä. Kysyit: "kesken lähetetty".'),
  ).toBeVisible({ timeout: 30000 });
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
    .getByRole("button", {
      name: "Uusi keskustelu työtilassa ordinary-dir",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/conversation=pi:/);
  await expect(editor(page)).toBeEnabled();
  await page.waitForTimeout(3500); // one spinoff refresh interval
  await expect(page.getByText("Tapahtumia jäi väliin")).toHaveCount(0);
  await expect(page.getByText("Spinoffien tilaa ei saada")).toHaveCount(0);
});

test("@queued-send Luo työtila gives the new workspace one conversation with focus in its field", async ({
  page,
}) => {
  await signIn(page);
  await page
    .locator("main")
    .getByRole("button", { name: "Uusi työtila" })
    .click();
  await page.getByRole("button", { name: "Uusi hakemisto" }).click();
  await page.getByRole("textbox", { name: "Nimi" }).fill("tuore-tyotila");
  await page.getByRole("button", { name: "Luo työtila" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^?]+\?conversation=/, {
    timeout: 20000,
  });
  await expect(editor(page)).toBeFocused();
  await expect(page).toHaveURL(/conversation=pi:/, { timeout: 20000 });
  await expect(editor(page)).toBeFocused();
  const workspace = page.getByRole("navigation").getByRole("link", {
    name: "tuore-tyotila",
  });
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
  await page.getByRole("button", { name: "Pysäytä: viesti ei lähde" }).click();
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
        waiting: document.querySelectorAll("[data-waiting]").length,
        native: [
          ...(feed?.querySelectorAll('li[data-kind="user"]') ?? []),
        ].some(
          (li) =>
            !li.querySelector("[data-waiting]") &&
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
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  await expect(editor(page)).toBeEnabled();
  await liveLatency(page);
  await sampleHandover(page, "Ehdota rakenne.");
  await editor(page).fill("Kerro, mitä täällä on.");
  await editor(page).press("Enter");
  await editor(page).fill("Ehdota rakenne.");
  await send(page).click();
  await expect(waiting(page)).toHaveCount(2);
  await expect(
    page.getByText('Selvä. Kysyit: "Kerro, mitä täällä on.', { exact: false }),
  ).toBeVisible({ timeout: 30000 });
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
  await sampleHandover(page, "herätä Pi");
  await editor(page).fill("herätä Pi");
  await send(page).click();
  await expect(page.getByText('Selvä. Kysyit: "herätä Pi".')).toBeVisible({
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
