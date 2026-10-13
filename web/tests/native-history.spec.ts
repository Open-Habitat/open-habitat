import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./worker-host";
import { hostOrigin } from "../test-ports.mjs";

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
  await fixture(page, "ready");
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
      .getByText("Synteettinen viesti 226", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ah-read-only-footer")).toContainText("Vain luku");
  await page.screenshot({
    path: "test-results/evidence/history-happy.png",
    fullPage: true,
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const heap = async () => {
    const result = await cdp.send("Performance.getMetrics");
    return result.metrics.find((metric) => metric.name === "JSHeapUsedSize")
      ?.value;
  };
  const heapTail = await heap();
  for (let i = 1; i < 11; i++)
    await page.getByRole("button", { name: "Lataa seuraava sivu" }).click();
  console.log(
    `synthetic 25→251 entry heap: ${heapTail}→${await heap()} bytes (CDP live heap, includes whole app; not a retained-size benchmark)`,
  );
  await expect(page.locator(".ah-feed li")).toHaveCount(251);
  await expect(page.getByText("Tuntematon tapahtuma")).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/history-long-unknown.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: "Lataa lohkon sisältö" }).click();
  await expect(page.locator(".ah-feed li").nth(248)).not.toContainText(
    "<script>alert('bad')</script>",
  );
  expect(await page.locator(".ah-feed script").count()).toBe(0);
  expect(writes).toHaveLength(0);
  await page.reload();
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  await expect(
    page
      .locator(".ah-feed")
      .getByText("Synteettinen viesti 226", { exact: true }),
  ).toBeVisible();
});
test("@native-history unwritten terminal session can archive and restore", async ({
  page,
}) => {
  await fixture(page, "ready");
  await login(page);
  await page.goto(`/agents/${agent}`);
  const bar = page.locator(".ah-agent-header");
  await expect(bar.getByRole("button", { name: "Arkistoi" })).toBeEnabled();
  await bar.getByRole("button", { name: "Luo uusi otsikko" }).click();
  await expect(bar).toContainText("Synteettinen otsikko");
  await bar.getByRole("button", { name: "Arkistoi" }).click();
  await page.getByRole("button", { name: "Vahvista arkistointi" }).click();
  await expect(
    bar.getByRole("button", { name: "Palauta näkyviin" }),
  ).toBeEnabled();
  await bar.getByRole("button", { name: "Palauta näkyviin" }).click();
  await expect(bar.getByRole("button", { name: "Arkistoi" })).toBeEnabled();
});
test("@native-history empty native session is read-only", async ({ page }) => {
  await fixture(page, "empty");
  await login(page);
  await page.goto(`/agents/${agent}`);
  await expect(
    page.getByText("Natiivissa historiassa ei ole vielä viestejä."),
  ).toBeVisible();
  await expect(page.locator(".ah-feed li")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/evidence/history-empty.png",
    fullPage: true,
  });
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
  const before = await page
    .locator(".ah-feed li")
    .first()
    .evaluate((el) => el.getBoundingClientRect().top);
  // Avoid scrolling the viewport to the footer button while measuring the first row.
  await page
    .getByRole("button", { name: "Lataa seuraava sivu" })
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
