import AxeBuilder from "@axe-core/playwright";
import type { Route } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { archiveFromConfirmedView } from "./archive-proof";
import { expect, test } from "./worker-host";

const host = hostOrigin;
const agent = "pi:11111111-1111-4111-8111-111111111111";
test.use({
  baseURL: host,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});
async function fixture(page: import("@playwright/test").Page, mode: string) {
  expect(
    (await page.request.get(`/fixture/history?mode=${mode}`)).status(),
  ).toBe(204);
}
async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  if ((page.viewportSize()?.width ?? 1280) <= 800) {
    await expect(
      page.getByRole("button", { name: "Avaa navigaatio" }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByRole("navigation", { name: "Työtilat ja keskustelut" }),
    ).toContainText("Alice");
  }
}
test("@native-history native page, continuation, unknown, reopen and no writes", async ({
  page,
}) => {
  await fixture(page, "short");
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") writes.push(r.url());
  });
  await login(page);
  await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: /Synteettinen viesti 0/ })
    .click();
  await expect(page).toHaveURL(`/agents/${agent}`);
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  await expect(
    page
      .locator(".ah-feed")
      .getByText("Synteettinen viesti 26", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ah-read-only-footer")).toContainText("Vain luku");
  for (let i = 0; i < 2; i++)
    await page
      .getByRole("button", { name: "Lataa vanhempi historiasivu" })
      .click();
  await expect(page.locator(".ah-feed li")).toHaveCount(51);
  const older = page.getByRole("button", {
    name: "Lataa vanhempi historiasivu",
  });
  await expect(older).toHaveCount(0);
  const refresh = page.waitForResponse((response) =>
    response.url().includes("/history?"),
  );
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await refresh;
  await expect(page.locator(".ah-feed li")).toHaveCount(51);
  await expect(older).toHaveCount(0);
  await expect(page.getByText("Tuntematon tapahtuma")).toBeVisible();
  await page.getByRole("button", { name: "Lataa lohkon sisältö" }).click();
  await expect(page.locator(".ah-feed li").nth(48)).not.toContainText(
    "<script>alert('bad')</script>",
  );
  expect(await page.locator(".ah-feed script").count()).toBe(0);
  expect(writes).toHaveLength(0);
  await page.reload();
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  await expect(
    page
      .locator(".ah-feed")
      .getByText("Synteettinen viesti 26", { exact: true }),
  ).toBeVisible();
});
test("@native-history unwritten terminal session can archive and restore", async ({
  page,
}) => {
  // This journey includes a forced refusal, fresh-page rediscovery and native
  // eligibility re-probes; their bounded waits can exceed the default 30 s.
  test.setTimeout(60000);
  await fixture(page, "ready");
  // Force the same definite refusal that a changed native revision produces
  // under load. Rediscovery must reopen this view, not the optimistic workspace.
  let stale = true;
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const snapshot = await response.json();
    if (stale) {
      const entry = snapshot.agents.find(
        (entry: { agent_id: string }) => entry.agent_id === agent,
      );
      entry.observation_token = "obs_stale_archive";
    }
    await route.fulfill({ response, json: snapshot });
  });
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/v1/workspaces"
    )
      stale = false;
  });
  await login(page);
  await page.goto(`/agents/${agent}`);
  const refused = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/workspaces",
  );
  const bar = page.locator(".ah-agent-header");
  await archiveFromConfirmedView(page, () =>
    bar.getByRole("button", { name: "Arkistoi" }),
  );
  expect((await refused).status()).toBe(409);
  await page.unrouteAll({ behavior: "wait" });
  await page.goto(`/agents/${agent}`);
  await expect(
    bar.getByRole("button", { name: "Palauta näkyviin" }),
  ).toBeEnabled();
  await bar.getByRole("button", { name: "Palauta näkyviin" }).click();
  // Eligibility is re-probed every 5 s. A transient unknown after restore
  // must get another observation before the assertion's deadline.
  await expect(bar.getByRole("button", { name: "Arkistoi" })).toBeEnabled({
    timeout: 15000,
  });
  const titleReply = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(`/api/v1/conversations/${agent.slice(3)}/history_title`) &&
      response.request().method() === "POST",
  );
  await bar.getByRole("button", { name: "Luo uusi otsikko" }).click();
  const response = await titleReply;
  if (response.status() === 409) {
    // A native proof can become uncertain after restore. The browser must not
    // claim a rename when the daemon refuses the write.
    await expect(
      page.getByText("Otsikkoa ei voitu luoda.", { exact: false }),
    ).toBeVisible();
    await expect(bar).not.toContainText("Synteettinen otsikko");
  } else {
    expect(response.status()).toBe(200);
    await expect(bar).toContainText("Synteettinen otsikko");
  }
});
test("@native-history settled terminal history can be titled through Pi", async ({
  page,
}) => {
  test.setTimeout(60000);
  await fixture(page, "ready");
  await login(page);
  await page.goto(`/agents/${agent}`);
  const bar = page.locator(".ah-agent-header");
  // Read a definite refusal before delivering it to the app. A page response
  // body can become unavailable while the view is replaced during recovery.
  const path = `**/api/v1/conversations/${agent.slice(3)}/history_title`;
  let refusal: string | undefined;
  let forwarding: Promise<void> | undefined;
  const capture = (route: Route) => {
    forwarding = (async () => {
      const upstream = await route.fetch();
      if (upstream.status() === 409) {
        try {
          refusal = (await upstream.json()).error?.code;
        } catch {
          refusal = undefined;
        }
      }
      await route.fulfill({ response: upstream });
    })();
    return forwarding;
  };
  await page.route(path, capture);
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await page.reload();
      refusal = undefined;
      const title = bar.getByRole("button", { name: "Luo uusi otsikko" });
      await expect(title).toBeEnabled({ timeout: 15000 });
      const titleReply = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/v1/conversations/${agent.slice(3)}/history_title`,
            ) && response.request().method() === "POST",
      );
      await title.click();
      const response = await titleReply;
      await forwarding;
      if (response.status() === 409 && attempt < 2) {
        // historyTitle returns this only before launching a writer. A later
        // native census may be unknown even after the UI observed eligibility.
        expect(refusal).toBe("control_uncertain");
        await expect(
          page.getByText("Otsikkoa ei voitu luoda.", { exact: false }),
        ).toBeVisible();
        continue; // a new view and affirmative observation, never an uncertain write
      }
      expect(response.status()).toBe(200);
      await expect(bar).toContainText("Synteettinen otsikko");
      return;
    }
  } finally {
    await forwarding;
    await page.unroute(path, capture);
  }
});
test("@native-history empty native session is read-only", async ({ page }) => {
  await fixture(page, "empty");
  await login(page);
  await page.goto(`/agents/${agent}`);
  await expect(
    page.getByText("Natiivissa historiassa ei ole vielä viestejä."),
  ).toBeVisible();
  await expect(page.locator(".ah-feed li")).toHaveCount(0);
  await fixture(page, "ready");
});
test("@native-history mapped identity isolates native content", async ({
  page,
}) => {
  await fixture(page, "ready");
  await page.goto("/");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Bob" }).click();
  await page.goto(`/agents/${agent}`);
  await expect(page.locator(".ah-feed li").first()).toContainText(
    "Bobin synteettinen viesti 226",
  );
  const spoofed = await page.request.get(
    `/api/v1/agents/${agent}/history?limit=1&after=`,
    {
      headers: {
        "X-Agent-Host-Identity": "wid_forged",
        "X-Agent-Host-Display-Name": "GitHub user 42",
      },
    },
  );
  expect(spoofed.status()).toBe(200);
  expect((await spoofed.json()).entries[0].content.text).toBe(
    "Bobin synteettinen viesti 0",
  );
  await expect(page.locator(".ah-feed")).not.toContainText(
    "Synteettinen viesti 0",
  );
});
test("@native-history missing, corrupt and read-only states", async ({
  page,
}) => {
  await fixture(page, "ready");
  await login(page);
  await page.goto(`/agents/${agent}`);
  await expect(
    page
      .locator(".ah-feed")
      .getByText("Synteettinen viesti 226", { exact: true }),
  ).toBeVisible();
  await fixture(page, "corrupt");
  await page.getByRole("button", { name: "Päivitä" }).click();
  await expect(page.getByText("Historia on vanhentunut")).toBeVisible();
  await page.getByRole("link", { name: "Etusivu" }).first().click();
  await expect(
    page.getByText("Historiaa ei voitu tarkistaa").first(),
  ).toBeVisible();
  await page.goto(`/agents/${agent}`);
  await page.screenshot({
    path: "test-results/evidence/history-corrupt.png",
    fullPage: true,
  });
  await fixture(page, "missing");
  await page.getByRole("button", { name: "Päivitä" }).click();
  await expect(page.getByText("Keskustelua ei löydy")).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/history-missing.png",
    fullPage: true,
  });
  await fixture(page, "ready");
});

test("@native-history narrow history keeps actions visible without page overflow", async ({
  page,
}) => {
  await fixture(page, "ready");
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto(`/agents/${agent}`);
  await expect(page.locator(".ah-feed li").first()).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
  await expect(
    page
      .locator(".ah-feed")
      .getByRole("button", { name: /Kopioi/ })
      .first(),
  ).toBeVisible();
});
test("@native-history older page keeps the visible native row anchored", async ({
  page,
}) => {
  await fixture(page, "ready");
  await login(page);
  await page.goto(`/agents/${agent}`);
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  await page.locator(".ah-conversation-stream").evaluate((el) => {
    el.scrollTop = 0;
  });
  const pager = page.getByRole("button", {
    name: "Lataa vanhempi historiasivu",
  });
  const pagerBox = await pager.boundingBox();
  const firstBox = await page.locator(".ah-feed li").first().boundingBox();
  if (!pagerBox || !firstBox) throw new Error("missing history layout");
  // Older history belongs above the loaded entries, inside their column.
  // A direct bare button after the timeline (the live report) fails both.
  expect(pagerBox.y + pagerBox.height).toBeLessThanOrEqual(firstBox.y);
  expect(Math.abs(pagerBox.x - firstBox.x)).toBeLessThan(2);
  expect(Math.abs(pagerBox.width - firstBox.width)).toBeLessThan(2);
  const before = await page
    .locator(".ah-feed li")
    .first()
    .evaluate((el) => el.getBoundingClientRect().top);
  // Avoid scrolling the viewport to the footer button while measuring the first row.
  await page
    .getByRole("button", { name: "Lataa vanhempi historiasivu" })
    .evaluate((button: HTMLElement) => button.click());
  await expect(page.locator(".ah-feed li")).toHaveCount(50);
  const after = await page
    .locator(".ah-feed li")
    .nth(25)
    .evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(after - before)).toBeLessThan(3);
});
test("@native-history warm return paints from cache while revalidating history", async ({
  page,
}) => {
  await fixture(page, "ready");
  await login(page);
  await page.goto(`/agents/${agent}`);
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  await page
    .locator("#main")
    .getByRole("link", { name: "Uusi keskustelu" })
    .click();
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/")) requests.push(request.url());
  });
  const start = await page.evaluate(() => performance.now());
  await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: /Synteettinen viesti 0/ })
    .click();
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  const paint = await page.evaluate(
    () =>
      new Promise<number>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve(performance.now())),
        ),
      ),
  );
  // A warm read-only view paints immediately but checks the native source on
  // open if inotify has failed while the user was away.
  await expect
    .poll(
      () =>
        requests.filter((url) => url.includes(`/agents/${agent}/history`))
          .length,
    )
    .toBe(1);
  // Synthetic lab only: two animation frames, not a WAN latency promise.
  console.log(
    `warm read-only return: ${Math.round(paint - start)} ms, ${requests.length} API requests`,
  );
  expect(paint - start).toBeLessThan(2000);
});

test("@native-history read-only control retains safe history actions on desktop and phone", async ({
  page,
}) => {
  await fixture(page, "ready");
  await login(page);
  await page.goto(`/agents/${agent}`);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const bar = page.locator(".ah-agent-header");
    await expect(bar).toContainText("Ei käynnissä");
    for (const name of ["Luo uusi otsikko", "Arkistoi"])
      await expect(bar.getByRole("button", { name })).toBeEnabled();
    const details = bar.getByRole("button", { name: "Tiedot" });
    await expect(details).toBeEnabled();
    if ((await details.getAttribute("aria-expanded")) === "false")
      await details.click();
    await expect(page.locator(".ah-read-only-footer")).toContainText(
      "Vain luku",
    );
    expect(
      (await new AxeBuilder({ page }).include(".ah-agent-header").analyze())
        .violations,
    ).toEqual([]);
  }
});

test("@native-history cut-off tail preserves readable pages and offers a new conversation", async ({
  page,
}) => {
  await fixture(page, "cut-off");
  await login(page);
  await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: /Synteettinen viesti 0/ })
    .click();
  await expect(
    page.getByText("Keskustelun loppu katkesi", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  await expect(
    page.getByRole("link", { name: "Uusi keskustelu", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Lataa vanhempi historiasivu" })
    .click();
  await expect(
    page.getByText("Keskustelun loppu katkesi", { exact: true }),
  ).toBeVisible();
  // Audit the added notice; the older native unknown-event row is unrelated.
  const results = await new AxeBuilder({ page })
    .include(".ah-notice")
    .analyze();
  expect(results.violations).toEqual([]);
});
