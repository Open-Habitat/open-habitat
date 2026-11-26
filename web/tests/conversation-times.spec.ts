import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Times in a conversation (conversation-times, experimental) through the
// real gateway and daemon. The synthetic native session spans Friday
// 20.11.2026 to Tuesday 24.11.; the page's clock stands on Tuesday morning in
// Helsinki, so the days read Friday's date, Eilen and Tänään.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  locale: "fi-FI",
  timezoneId: "Europe/Helsinki",
  reducedMotion: "reduce",
});

const agent = "pi:11111111-1111-4111-8111-111111111111";

async function prefer(page: Page, on: boolean) {
  const s = await (await page.request.get("/auth/session")).json();
  const put = await page.request.put("/api/v1/account/preferences", {
    headers: {
      Origin: new URL(page.url()).origin,
      "X-Agent-Host-CSRF": s.csrf,
    },
    data: { experimental: { "conversation-times": on } },
  });
  expect(put.status()).toBe(200);
}

async function signIn(page: Page) {
  await page.clock.setFixedTime(new Date("2026-11-24T08:12:00Z"));
  expect((await page.request.get("/fixture/history?mode=times")).status()).toBe(
    204,
  );
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByTestId("workspace-navigation")).toBeAttached();
}

const feed = (page: Page) => page.locator(".ah-feed");

for (const width of [1440, 390]) {
  test(`@conversation-times days, message times and long turns' durations ${width}`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await prefer(page, true);
    await page.goto(`/agents/${agent}`);
    await expect(feed(page)).toContainText("Synthetic 18 pages.", {
      timeout: 15000,
    });

    // One separator where each day begins: Friday, Monday and Tuesday.
    const days = feed(page).getByTestId("day-separator");
    await expect(days).toHaveCount(3);
    expect(
      await days
        .locator("time")
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("datetime"))),
    ).toEqual([
      "2026-11-20T12:02:10.000Z",
      "2026-11-23T07:30:00.000Z",
      "2026-11-24T07:52:00.000Z",
    ]);

    // Every saved message carries its time: five of the person's and eight
    // replies, the interim ones included, and the stopped row.
    await expect(
      feed(page).getByTestId("message").getByTestId("message-time"),
    ).toHaveCount(13);
    await expect(
      feed(page).getByTestId("turn-stopped").getByTestId("message-time"),
    ).toHaveCount(1);

    // Only the multi-stage long turns say how long they took: the 48-minute
    // turn on its final answer and the stopped one on its stopped row. The
    // single-stage 23-minute turn's work row already says it.
    const took = feed(page).getByTestId("turn-took");
    await expect(took).toHaveCount(2);
    await expect(
      feed(page)
        .locator('[data-reply-kind="final"]')
        .filter({ hasText: "Synthetic language pass done." })
        .getByTestId("turn-took"),
    ).toHaveCount(1);
    await expect(
      feed(page).getByTestId("turn-stopped").getByTestId("turn-took"),
    ).toHaveCount(1);

    // The time sits right after the name and before Kopioi, on one line.
    for (const card of await feed(page).getByTestId("message").all()) {
      const name = await card.locator("header > strong").boundingBox();
      const time = await card
        .locator("header > [data-testid=message-time]")
        .boundingBox();
      const copy = await card.getByTestId("message-copy").boundingBox();
      if (!name || !time || !copy) throw new Error("header part missing");
      expect(time.x).toBeGreaterThanOrEqual(name.x + name.width);
      expect(copy.x).toBeGreaterThanOrEqual(time.x + time.width);
      expect(
        Math.abs(time.y + time.height / 2 - (name.y + name.height / 2)),
      ).toBeLessThan(name.height);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    const audit = await new AxeBuilder({ page }).include(".ah-feed").analyze();
    expect(audit.violations).toEqual([]);
  });
}

test("@conversation-times the switch off keeps the conversation without times", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await prefer(page, false);
  await page.goto(`/agents/${agent}`);
  await expect(feed(page)).toContainText("Synthetic 18 pages.", {
    timeout: 15000,
  });
  await expect(feed(page).getByTestId("day-separator")).toHaveCount(0);
  await expect(feed(page).getByTestId("message-time")).toHaveCount(0);
  await expect(feed(page).getByTestId("turn-took")).toHaveCount(0);
  // The stopped row keeps its own time as before.
  await expect(
    feed(page).getByTestId("turn-stopped").locator("time"),
  ).toHaveAttribute("datetime", "2026-11-23T11:18:20.000Z");
});
