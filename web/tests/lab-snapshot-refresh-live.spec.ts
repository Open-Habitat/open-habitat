import type { Route } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// While an agent turn runs, its interim reply, tool end and final reply each
// make the page read the snapshot again. A read that fails in the browser
// (a dropped request, a host error, a response the page rejects) left no
// trace on the host and showed "connection lost" although the event stream
// kept delivering the turn. The banner belongs to a lost stream; a failed
// read while the stream is open is read again later.
test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

test("@lab failed snapshot refreshes during a live turn show no connection loss", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.request.get("/fixture/conversations-reset");
  expect(
    (await page.request.get("/fixture/scenario?value=pi-deltas")).status(),
  ).toBe(204);
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
    // Record every connection notice the page shows from now on.
    await page.evaluate(() => {
      const seen: string[] = [];
      const note = () => {
        for (const node of document.querySelectorAll(
          '[data-testid^="connection-"][data-state]',
        ))
          seen.push(node.getAttribute("data-state") ?? "");
      };
      new MutationObserver(note).observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-state"],
      });
      Object.assign(window, { connectionNotices: seen });
    });
    // Each failure the browser can meet: no response, a host error, and a
    // response it rejects.
    const failures = [
      (route: Route) => route.abort("failed"),
      (route: Route) =>
        route.fulfill({ status: 503, body: "synthetic failure" }),
      (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: '{"schema_version":1}',
        }),
    ];
    let failing = false;
    let failed = 0;
    // Host snapshots the page received after the failures ended. The body is
    // read here, from the host's answer, because Chromium may already have
    // dropped it by the time a response listener asks for it.
    let recovered = 0;
    await page.route("**/api/v1/snapshot*", async (route) => {
      if (failing) return failures[failed++ % failures.length](route);
      // A read already under way when the failures began does not count.
      const afterFailures = failed > 0;
      try {
        const response = await route.fetch();
        const read =
          response.ok() && (await response.text()).includes('"event_cursor"');
        await route.fulfill({ response });
        if (read && afterFailures) recovered++;
      } catch {
        // The page dropped this read; only a delivered one counts.
        await route.abort().catch(() => {});
      }
    });
    const editor = page.getByTestId("message-input");
    // "hidas" spaces fake Pi's phases two seconds apart.
    await editor.fill("hidas vaiheittainen vuoro");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await expect(editor).toHaveValue("");
    const turn = page.getByTestId("agent-turn").last();
    await expect(
      turn.locator('[data-reply-role="interim"], [data-interim="true"]'),
    ).not.toHaveCount(0, { timeout: 20000 });
    // Every read from the interim reply until the turn ends fails.
    failing = true;
    const finalReply = turn
      .getByTestId("message")
      .and(page.locator('[data-reply-complete="true"]'));
    // The event stream still carries the turn to its end.
    await expect(finalReply).toBeVisible({ timeout: 30000 });
    await expect.poll(() => failed, { timeout: 15000 }).toBeGreaterThan(2);
    // The host is readable again: the page reads it without being asked.
    failing = false;
    await expect.poll(() => recovered, { timeout: 20000 }).toBeGreaterThan(0);
    const notices = await page.evaluate(
      () =>
        (window as typeof window & { connectionNotices: string[] })
          .connectionNotices,
    );
    expect(notices).toEqual([]);
    await expect(page.locator('[data-testid^="connection-"]')).toHaveCount(0);
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});
