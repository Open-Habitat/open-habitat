import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect, type Page } from "./worker-host";

// rail-title-icon-stale-after-restart (Jari 16.11.): after the host
// restarted, a conversation started and written in kept its placeholder title
// and a stale ball in the rail while the daemon had already named it. A proxy
// whose upstream went down with the host can leave the browser's event stream
// open and silent; every other request still works, so nothing told the page
// it had stopped following the host.
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
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const nav = page.getByTestId("workspace-navigation");
  await nav.getByTestId("workspace-ordinary-dir").click();
  await expect(
    page.getByTestId(/^(new-conversation|conversation-start)$/),
  ).toBeEnabled();
  await expect
    .poll(() => trace.some((d) => d.event === "stream" && d.outcome === "open"))
    .toBe(true);
  return { nav, trace };
}

async function start(page: Page, text: string) {
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  const id = new URL(page.url()).searchParams.get("conversation") ?? "";
  await send(page, text);
  return id;
}

async function send(page: Page, text: string) {
  await page.getByTestId("message-input").fill(text);
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
}

test("@rail-title-restart the rail converges to the daemon's title and ball when the stream went silent across a restart", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.clock.install();
  const { nav, trace } = await open(page);
  await page.request.get("/fixture/title-model?value=Lokien%20tutkinta");
  // The host goes down under the proxy; the browser's stream stays open.
  trace.length = 0;
  await page.request.get("/fixture/edge-silence-streams");
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  const id = await start(page, "Tutki synteettinen loki");
  const row = nav.getByTestId(`agent-item-${id}`);
  await expect(row).toBeVisible();
  // The daemon names the conversation after its first turn.
  await expect
    .poll(
      async () => {
        const snapshot = await (
          await page.request.get("/api/v1/snapshot")
        ).json();
        return snapshot.agents.find(
          (a: { agent_id: string }) => a.agent_id === id,
        )?.title.display;
      },
      { timeout: 30000 },
    )
    .toBe("Lokien tutkinta");
  // Creation's snapshot may already have replaced the old stream. Otherwise
  // give the silence watchdog its three missed heartbeats. Either path must
  // learn the new daemon's facts and reopen the stream without a reload.
  // conversationJournal.test.tsx tests the watchdog itself with held events.
  if (!trace.some((d) => d.event === "cursor" && d.outcome === "new-instance"))
    await page.clock.fastForward("01:10");
  await expect(row).toContainText("Lokien tutkinta", { timeout: 20000 });
  await expect(row).toHaveAttribute("data-ball", "you");
  await expect
    .poll(() => {
      const restarted = trace.findIndex(
        (d) => d.event === "cursor" && d.outcome === "new-instance",
      );
      return (
        restarted >= 0 &&
        trace
          .slice(restarted + 1)
          .some((d) => d.event === "stream" && d.outcome === "open")
      );
    })
    .toBe(true);
});

test("@rail-title-restart a conversation left without a title by a restart is named when it continues", async ({
  page,
}) => {
  test.setTimeout(120000);
  const { nav } = await open(page);
  // The first turn's title is lost: here the model is unavailable, as when
  // the daemon stops while generating it.
  const id = await start(page, "Selvitä varmuuskopiot");
  const row = nav.getByTestId(`agent-item-${id}`);
  await expect(row).toContainText("Selvitä varmuuskopiot", { timeout: 30000 });
  await expect(row).toHaveAttribute("data-ball", "you", { timeout: 30000 });
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  await page.request.get("/fixture/title-model?value=Varmuuskopiot");
  await expect(page.getByTestId("message-input")).toBeEnabled({
    timeout: 20000,
  });
  await send(page, "Jatka siitä");
  await expect(row).toContainText("Varmuuskopiot", { timeout: 30000 });
  await expect(row).not.toContainText("Selvitä");
});
