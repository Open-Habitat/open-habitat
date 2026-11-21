import { expect, type Page } from "@playwright/test";

type Hook = (fn: (args: { page: Page }) => Promise<void>) => void;

/** Runs each case of the calling file with an installed Taskfleet that answers
 * with no runs, as every installation's core runtime ships one.
 *
 * Named helpers graduated, so an archive first reads the conversation's
 * helpers, and an unreadable helper state rightly asks before archiving. The
 * synthetic host's default Taskfleet cannot be read, which would stop each
 * archive at that question. The worker's host outlives a spec, so the default
 * comes back after each case for the specs that test the unreadable state. */
export function answeringTaskfleet(test: {
  beforeEach: Hook;
  afterEach: Hook;
}) {
  test.beforeEach(async ({ page }) => {
    expect(
      (await page.request.get("/fixture/taskfleet?status=empty")).status(),
    ).toBe(204);
  });
  test.afterEach(async ({ page }) => {
    await page.request.get("/fixture/taskfleet?status=none");
  });
}
