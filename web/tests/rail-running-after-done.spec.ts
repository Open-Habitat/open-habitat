import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function start(page: Page) {
  const nav = page.getByTestId("workspace-navigation");
  await nav.getByTestId("workspace-ordinary-dir").click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  return new URL(page.url()).searchParams.get("conversation") ?? "";
}

// rail-running-after-done: Pi stays open after its turn and waits for a
// message. The conversation is finished then, with or without what its agent
// left behind, and Käynnissä shows only work going on.
test("@rail-running-after-done a finished conversation leaves Käynnissä and returns only when its agent works", async ({
  page,
}) => {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const nav = page.getByTestId("workspace-navigation");
  const running = nav.getByTestId("rail-running");
  const yours = nav.getByTestId("rail-yours");
  const send = async (text: string) => {
    await page.getByTestId("message-input").fill(text);
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
  };

  const id = await start(page);
  // A conversation nobody has written to yet is not work either.
  await expect(running.getByTestId(`agent-item-${id}`)).toHaveCount(0);
  await send("hidas työ");
  const row = running.getByTestId(`agent-item-${id}`);
  await expect(row).toHaveAttribute("data-ball", "work", { timeout: 25000 });

  // The turn ends: not work. Read here, its reply waits read in Sinun
  // vuorosi until the person answers or says Ei nyt (raise-to-your-turn).
  await expect(page.getByTestId("message-input")).toBeEnabled({
    timeout: 25000,
  });
  await expect(row).toHaveCount(0, { timeout: 25000 });
  await expect(
    yours.getByTestId(`agent-item-${id}`).getByTestId("rail-mark"),
  ).toHaveAttribute("data-state", "read");

  // The agent leaves a file and its notice after the turn: still finished.
  expect(
    (
      await page.request.get(
        `/fixture/files?target=${encodeURIComponent(id)}&set=single`,
      )
    ).status(),
  ).toBe(200);
  await expect(page.getByTestId("file-offer")).toHaveCount(1);
  await nav.getByTestId("snapshot-refresh").press("Enter");
  await expect(row).toHaveCount(0);

  // Elsewhere, the finished conversation stays out of Käynnissä.
  const other = await start(page);
  await expect(running.getByTestId(`agent-item-${other}`)).toHaveCount(0);
  await nav.getByTestId("snapshot-refresh").press("Enter");
  await expect(row).toHaveCount(0);

  // Written to again, it works and is back until that turn ends.
  // Return through the app, rather than cancelling its outstanding reads
  // with a second document navigation (Chromium can exhaust net retries).
  // The field of the conversation being left stays enabled until the
  // returned one replaces it; text typed into it would go with it.
  await page
    .getByTestId("message-input")
    .evaluate((field) => field.setAttribute("data-left", ""));
  await nav.getByTestId(`agent-item-${id}`).getByTestId("agent-link").click();
  await expect(page.locator("[data-left]")).toHaveCount(0);
  await expect(page.getByTestId("message-input")).toBeEnabled();
  await send("hidas jatko");
  await expect(row).toHaveAttribute("data-ball", "work", { timeout: 25000 });
  await expect(row).toHaveCount(0, { timeout: 25000 });
});
