import { expect, test } from "@playwright/test";

const host = "https://127.0.0.1:4174";
test.use({
  baseURL: host,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});
async function open(page: import("@playwright/test").Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page.getByRole("link", { name: "ordinary-dir" }).click();
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
  const recheck = page.getByRole("button", {
    name: "Tarkista keskustelulista",
  });
  const first = await create.boundingBox();
  const second = await recheck.boundingBox();
  if (!first || !second) throw new Error("Conversation actions missing");
  expect(second.x - (first.x + first.width)).toBeGreaterThan(8);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(page).toHaveURL(/conversation=pi%3A|conversation=pi:/);
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("Synteettinen testipyyntö");
  let sends = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/send")) sends++;
  });
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByText("Viesti odottaa natiivia hyväksyntää"),
  ).toBeVisible();
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
  await page.getByRole("button", { name: "Pyydä pysäytystä" }).click();
  await expect(
    page.getByText(/Työkalujen päättymistä ei ole vahvistettu/),
  ).toBeVisible();
  await page.goto("/agents/pi:11111111-1111-4111-8111-111111111111");
  await expect(page.getByText("Vain luku · Ohjausta ei ole")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveCount(0);
});
test("@browser-conversation ordinary session loading is not an uncertain create", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/auth/session", async (route) => {
    await held;
    await route.continue();
  });
  await page.getByRole("link", { name: "ordinary-dir" }).click();
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
  await page.getByRole("button", { name: "Tarkista keskustelulista" }).click();
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
  await expect(page.getByText(/Lähetyksen tulos epävarma/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Aiemman pyynnön tulos epävarma")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveValue("Älä lähetä toistamiseen");
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeDisabled();
  expect(attempts).toBe(1);
  await page
    .getByText("Aiemman pyynnön tulos epävarma")
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
        native_history: "readable",
        native_revision: "synthetic-1",
        event_cursor: tail,
        events: tail ? [{ kind: "synthetic-update" }] : [],
      },
    });
  });
  await page.route("**/api/v1/agents/*/history?*", async (route) => {
    const after = new URL(route.request().url()).searchParams.get("after");
    const start = after ? 25 : 0;
    const limit = count === 51 && !after ? 51 : 25;
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
        ...(count > start + limit ? { next_after: "page-2" } : {}),
      }),
    });
  });
  count = 50;
  await page.getByRole("button", { name: "Tarkista tila ja historia" }).click();
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  await page
    .getByRole("button", { name: "Lataa seuraava historiasivu" })
    .click();
  await expect(page.locator(".ah-feed li")).toHaveCount(50);
  const feed = page.locator("section:has(> .ah-timeline)").last();
  await feed.evaluate((node) => {
    node.scrollTop = Math.min(350, node.scrollHeight - node.clientHeight);
  });
  const before = await feed.evaluate((node) => node.scrollTop);
  expect(before).toBeGreaterThan(0);
  await editor.fill("kesken oleva viesti");
  await editor.evaluate((node: HTMLTextAreaElement) => {
    node.focus();
    node.setSelectionRange(4, 9);
  });
  // Idle viewing must not replace the editor with a full-screen loading page.
  // The conversation's own 3-second native status poll is separate from the
  // top-level snapshot revalidation which used to unmount the whole page.
  let snapshotReads = 0;
  await page.route("**/api/v1/snapshot", async (route) => {
    snapshotReads++;
    await route.continue();
  });
  await page.clock.fastForward(60_000);
  expect(snapshotReads).toBe(0);
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue("kesken oleva viesti");
  await expect(page.getByRole("heading", { name: "Ladataan" })).toHaveCount(0);
  // Coming back to the tab still revalidates identity before restoring the view.
  tail = 1;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => snapshotReads).toBeGreaterThan(0);
  await expect(page.locator(".ah-feed li")).toHaveCount(50);
  await expect(
    page.getByText("Viimeisimmät live-tapahtumat (1)"),
  ).toBeVisible();
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
  // An incoming native entry while reading must be signalled, not jump to the bottom.
  count = 51;
  await page.getByRole("button", { name: "Tarkista tila ja historia" }).click();
  await expect(
    page.getByRole("button", { name: "Uutta sisältöä (1)" }),
  ).toBeVisible();
  expect(await feed.evaluate((node) => node.scrollTop)).toBeCloseTo(before, 0);
  await page.getByRole("button", { name: "Tilivalikko" }).click();
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
  await page.getByRole("button", { name: "Tarkista tila ja historia" }).click();
  await expect(
    page.getByText(/Yhteys katkesi tai istunto muuttui/),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveCount(0);
  await expect(page.locator("main script")).toHaveCount(0);
});
