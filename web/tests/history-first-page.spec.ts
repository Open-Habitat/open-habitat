import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

const agent = "pi:11111111-1111-4111-8111-111111111111";
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});

// Jari 2.11.2026: a long tool-heavy conversation opened with one or two
// messages. The first page now counts messages, not tool entries. The fixture
// has 150 turns shaped like a measured conductor session (2 messages and
// 10 tool entries per turn), so 100 messages are the newest 50 turns.
test("@history-first-page a tool-heavy conversation opens with 100 messages within a bounded page", async ({
  page,
}) => {
  expect(
    (await page.request.get("/fixture/history?mode=tool-heavy")).status(),
  ).toBe(204);
  await page.goto("/");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByTestId("workspace-navigation")).toContainText("Alice");
  // The same read the view makes on open, taken directly for its size.
  const response = await page.request.get(
    `/api/v1/agents/${agent}/history?messages=100`,
  );
  expect(response.status()).toBe(200);
  const body = await response.body();
  const native = JSON.parse(body.toString()) as {
    entries: {
      kind: string;
      blocks?: { type: string; text?: string }[];
    }[];
    older_complete: boolean;
  };
  const messages = native.entries.filter(
    (entry) =>
      entry.kind === "user" ||
      (entry.kind === "assistant" &&
        (entry.blocks ?? []).some((b) => b.type === "text" && b.text?.trim())),
  ).length;
  expect(messages).toBe(100);
  expect(native.entries).toHaveLength(600);
  expect(native.older_complete).toBe(false);
  // The browser accepts at most 2 MiB; this shape is about 1 MB.
  expect(body.length).toBeLessThan(2 * 1024 * 1024);

  // A cold open, timed from navigation start.
  await page.goto(`/agents/${agent}`);
  const feed = page.locator(".ah-feed");
  await expect(feed).toContainText("Synthetic reply 149.");
  await expect(feed).toContainText("Synthetic prompt 100");
  const paint = await page.evaluate(
    () =>
      new Promise<number>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve(performance.now())),
        ),
      ),
  );
  const read = await page.evaluate(() => {
    const entry = (
      performance.getEntriesByType("resource") as PerformanceResourceTiming[]
    ).find((e) => e.name.includes("/history?messages=100"));
    return entry
      ? { start: entry.startTime, end: entry.responseEnd }
      : { start: -1, end: -1 };
  });
  await expect(feed).not.toContainText("Synthetic prompt 99");
  await expect(page.getByTestId("older-history")).toHaveCount(1);
  // Synthetic lab only: local host and two animation frames, not a WAN
  // promise. The bound catches a page that grew past what renders promptly.
  console.log(
    `tool-heavy first page: ${messages} messages, ${native.entries.length} entries, ${body.length} bytes, ${Math.round(paint)} ms from navigation to paint, history read ${Math.round(read.start)}–${Math.round(read.end)} ms`,
  );
  // App start before the read does not depend on the page; the read and the
  // render of 600 entries took about 0.8 s here (2026-11-02).
  expect(read.start).toBeGreaterThan(0);
  expect(paint - read.start).toBeLessThan(3000);

  // The next page continues from the same message count.
  const older = page.waitForResponse((response) =>
    response.url().includes("before="),
  );
  await page.getByTestId("older-history").click();
  await older;
  await expect(feed).toContainText("Synthetic prompt 50");
  await expect(feed).not.toContainText("Synthetic prompt 49");
  expect((await page.request.get("/fixture/history?mode=ready")).status()).toBe(
    204,
  );
});
