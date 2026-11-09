import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect, type Page } from "./worker-host";

// The host's edge relay breaks the browser's real connections as the world
// does. A connection that goes silent (a laptop's sleep, a network that
// changed underneath, a proxy that drops a stream without telling anyone)
// gives the page no error: the event stream looks open and the page stops
// following the host without any notice, so there is not even a Yhdistä.
const test = createHostTest(false, { BROWSER_HOST_EDGE: "1" });
test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function open(page: Page) {
  await page.addInitScript(() =>
    sessionStorage.setItem("oh:debug-reconnect", "true"),
  );
  const trace: Record<string, unknown>[] = [];
  page.on("console", (message) => {
    if (message.text().startsWith("[reconnect] "))
      trace.push(JSON.parse(message.text().slice("[reconnect] ".length)));
  });
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
  await page
    .getByRole("navigation")
    .locator('a[data-testid^="workspace-"][data-workspace-name="ordinary-dir"]')
    .click();
  await expect(page.getByTestId("conversation-start")).toBeEnabled();
  await expect
    .poll(() => trace.some((d) => d.event === "stream" && d.outcome === "open"))
    .toBe(true);
  return trace;
}

/** Whether the page still follows the host: a daemon restart must reach it. */
async function follows(page: Page, trace: Record<string, unknown>[]) {
  const from = trace.length;
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  await expect
    .poll(
      () =>
        trace
          .slice(from)
          .some((d) => d.event === "cursor" && d.outcome === "new-instance"),
      { timeout: 30000 },
    )
    .toBe(true);
  await expect(
    page.locator('[data-testid^="connection-"][data-state]'),
  ).toHaveCount(0);
}

test("@reconnect the event stream is reopened when the machine wakes from sleep", async ({
  page,
}) => {
  await page.clock.install();
  const trace = await open(page);
  // The connections die silently while the lid is closed.
  await page.request.get("/fixture/edge?mode=freeze");
  await page.clock.fastForward("10:00");
  await follows(page, trace);
  expect(trace.some((d) => d.event === "revive")).toBe(true);
});

test("@reconnect the event stream is reopened when the network returns", async ({
  page,
  context,
}) => {
  const trace = await open(page);
  await context.setOffline(true);
  await page.request.get("/fixture/edge?mode=freeze");
  await context.setOffline(false);
  await follows(page, trace);
  expect(trace.some((d) => d.event === "revive")).toBe(true);
});
