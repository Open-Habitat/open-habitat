import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "@playwright/test";

const host = hostOrigin;
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
  await page.getByRole("button", { name: "Tarkista tila ja historia" }).click();
  await expect(page.locator(".ah-feed li")).toHaveCount(50);
  const feed = page.locator("section:has(> .ah-timeline)").last();
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
  // The conversation's own 3-second native status poll is separate from the
  // top-level snapshot revalidation which used to unmount the whole page.
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

test("@browser-conversation foreground clicks and route changes do not revalidate", async ({
  page,
}) => {
  await open(page);
  let checks = 0;
  page.on("request", (r) => {
    if (r.url().includes("/onboarding/pi/status")) checks++;
  });
  await page.getByRole("button", { name: "Tilivalikko" }).click();
  await page.getByRole("menuitem", { name: "Asetukset" }).click();
  await expect(page.getByRole("heading", { name: "Asetukset" })).toBeVisible();
  await page.getByRole("button", { name: "Takaisin" }).click();
  await page.getByRole("button", { name: "Tarkista keskustelulista" }).click();
  await expect(page.getByText("Keskustelulista tarkistettu.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pi-keskustelut" }),
  ).toBeVisible();
  expect(checks).toBe(0);
  await expect(
    page.getByRole("group", { name: "Pi-keskustelun toiminnot" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 750, height: 720 });
  const first = await page
    .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
    .boundingBox();
  const second = await page
    .getByRole("button", { name: "Tarkista keskustelulista" })
    .boundingBox();
  if (!first || !second) throw new Error("actions missing");
  expect(second.y > first.y || second.x - first.x - first.width > 8).toBe(true);
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
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/api/v1/onboarding/pi/status", async (route) => {
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
    await expect(page.getByRole("heading", { name: "Ladataan" })).toHaveCount(
      0,
    );
  } finally {
    release();
  }
});

test("@browser-conversation stalled and failed revalidation never reveals old identity", async ({
  page,
}) => {
  await page.clock.install();
  await open(page);
  let started!: () => void;
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/api/v1/onboarding/pi/status", async (route) => {
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
    page.getByRole("heading", { name: "Yhteyttä ei saatu" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "ordinary-dir" })).toHaveCount(
    0,
  );
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
  await page.route("**/api/v1/onboarding/pi/status", async (route) => {
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
    await other.getByRole("button", { name: "Tilivalikko" }).click();
    await other.getByRole("menuitem", { name: "Kirjaudu ulos" }).click();
    await other.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await other.getByRole("link", { name: "Bob" }).click();
    release();
    await expect(
      page.getByRole("heading", { name: "Kohdetta ei enää löydy" }),
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

test("@browser-conversation failed snapshot after tab return clears authenticated facts", async ({
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
    page.getByRole("heading", { name: "Yhteyttä ei saatu" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "ordinary-dir" })).toHaveCount(
    0,
  );
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
    await other.getByRole("button", { name: "Tilivalikko" }).click();
    await other.getByRole("menuitem", { name: "Kirjaudu ulos" }).click();
    await other.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await other.getByRole("link", { name: "Bob" }).click();
    await page.evaluate(() =>
      (
        window as unknown as { revealFixtureTab: () => void }
      ).revealFixtureTab(),
    );
    await expect(
      page.getByRole("heading", { name: "Kohdetta ei enää löydy" }),
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
