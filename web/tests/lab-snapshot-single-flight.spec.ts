import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// Through the live route a snapshot read takes seconds (a remote gateway,
// 2026-10-23..30: about 2.9 s), longer than a running turn's invalidations
// are apart. Each refresh used to abort the read before it, so no read
// finished during a turn: on 2026-10-16 the test server's tunnel logged
// dozens of cancelled snapshot reads in a row after a restart, the page
// stayed "Yhteys katkesi" for the whole turn, and Yhdistä's own read was
// cancelled the same way. A refresh during a read now waits for it.
// "pitkä ajo" is fake Pi's tool-heavy run.
test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

test("@lab @reconnect a running turn does not cancel slow snapshot reads", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=pi-deltas");
  try {
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    await page
      .getByRole("navigation")
      .getByTestId("workspace-aurinkokello")
      .click();
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await page.route("**/api/v1/snapshot*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue().catch(() => {});
    });
    // The page's own record of each read: answered, or aborted by the page.
    await page.evaluate(() =>
      sessionStorage.setItem("oh:debug-reconnect", "true"),
    );
    const reads = { answered: 0, aborted: 0 };
    page.on("console", (message) => {
      if (!message.text().startsWith("[reconnect] ")) return;
      const record = JSON.parse(message.text().slice("[reconnect] ".length));
      if (record.event !== "request" || record.path !== "/api/v1/snapshot")
        return;
      if (record.outcome === "response") reads.answered++;
      if (record.outcome === "aborted") reads.aborted++;
    });
    await page.getByTestId("message-input").fill("pitkä ajo");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    const finalReply = page
      .getByTestId("agent-turn")
      .last()
      .getByTestId("message")
      .and(page.locator('[data-reply-complete="true"]'));
    await expect(finalReply).toBeVisible({ timeout: 40000 });
    // The run's 130 tool steps rewrite the session for about ten seconds and
    // ask for reads all along; at 2.5 s a read, some were answered meanwhile.
    expect(reads.answered).toBeGreaterThan(1);
    expect(reads.aborted).toBe(0);
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});
