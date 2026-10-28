import type { Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

// Jari 27.10.2026 (Birch, 0.1.0-pilot.12): back at a conversation after about
// an hour, the field no longer took his message; switching conversations did
// not help, only a reload did. These cases walk that pause as a laptop lives
// it: an unsent draft, the network gone while the machine sleeps, an hour on
// the page's clock, Pi stopped for idleness meanwhile, and on wake a few
// seconds in which reads still fail. An idle conversation sends no events
// afterwards, so nothing later repairs a page the wake left broken.
//
// On 0.1.0-pilot.12 the open stream case ended stale for good, with Send
// refused until a reload, and the dropped stream case took the focus from the
// field while the person typed.

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});
test.beforeEach(async ({ page }) => {
  expect((await page.request.get("/fixture/reset-clock")).status()).toBe(204);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});

const editor = (page: Page) => page.getByTestId("message-input");

for (const stream of ["survives", "drops"] as const)
  test(`@long-pause the composer takes and sends a message after an hour's sleep without a reload (stream ${stream})`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.clock.install();
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    await page
      .getByRole("navigation")
      .getByTestId("workspace-ordinary-dir")
      .click();
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await expect(page).toHaveURL(/conversation=pi:/);
    await editor(page).fill("ennen taukoa");
    await editor(page).press("Enter");
    await expect(page.locator("main")).toContainText('Kysyit: "ennen taukoa"', {
      timeout: 20000,
    });
    await editor(page).fill("luonnos");

    // Sleep. Offline mode fails new requests; an open stream either rides
    // the sleep out or is cut with the host connection.
    await page.context().setOffline(true);
    if (stream === "drops")
      expect(
        (
          await page.request.get("/fixture/daemon-restart?transport_only=1")
        ).status(),
      ).toBe(204);
    await page.clock.fastForward("01:00:00");
    expect((await page.request.get("/fixture/idle-stop")).status()).toBe(204);
    // Wake: the network takes a moment, and reads in it fail.
    let failed = 0;
    let settled = false;
    await page.route(/\/api\/v1\/(snapshot|events)/, (route) => {
      if (settled) return route.fallback();
      failed++;
      return route.abort("internetdisconnected");
    });
    await page.context().setOffline(false);
    // Streams that failed while offline (the fast-forward fires their
    // retries) put the journal in transport backoff, at most 30 s.
    await expect.poll(() => failed, { timeout: 35000 }).toBeGreaterThan(0);
    await page.waitForTimeout(3000);
    settled = true;

    // The person clicks back into the field and types on while the page
    // recovers. Every key lands, the caret stays, and Enter sends.
    await editor(page).click();
    for (const key of " ja jatka") {
      await page.keyboard.type(key);
      await page.clock.runFor(1000);
    }
    await expect(editor(page)).toBeFocused();
    await expect(editor(page)).toHaveValue("luonnos ja jatka");
    await expect(page.getByTestId("connection-stale")).toHaveCount(0, {
      timeout: 20000,
    });
    await editor(page).press("Enter");
    await expect(page.locator("main")).toContainText(
      'Kysyit: "luonnos ja jatka"',
      { timeout: 20000 },
    );
    await expect(editor(page)).toHaveValue("");
  });
