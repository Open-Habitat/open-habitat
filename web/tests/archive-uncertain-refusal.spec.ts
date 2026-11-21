import { hostOrigin } from "../test-ports.mjs";
import { answeringTaskfleet } from "./answering-taskfleet";
import { expect, test } from "./worker-host";

const agent = "pi:11111111-1111-4111-8111-111111111111";
test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
answeringTaskfleet(test);

// Archiving from a conversation's own view leaves for its workspace at once.
// The host's refusal can arrive before that navigation has rendered (the
// router commits it as a transition), which under load once dropped the
// error entirely. The refusal is forced here, and a throttled CPU holds the
// workspace render open while the reply lands.
test("@archive archive refusal shows in the workspace it left for and stays there", async ({
  page,
}) => {
  test.setTimeout(60000);
  expect((await page.request.get("/fixture/history?mode=ready")).status()).toBe(
    204,
  );
  await page.goto("/");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.goto(`/agents/${agent}`);
  const archive = page
    .locator(".ah-agent-header")
    .getByTestId("archive-conversation");
  // The native census can be momentarily unknown on a loaded host; that is
  // not a refusal, so look again from a fresh view.
  for (let attempt = 0; ; attempt++) {
    try {
      await expect(archive).toBeEnabled({ timeout: 10000 });
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.reload();
    }
  }
  let archives = 0;
  await page.route("**/api/v1/workspaces", (route) => {
    const request = route.request();
    if (
      request.method() !== "POST" ||
      request.postDataJSON()?.action !== "conversation_archive"
    )
      return route.fallback();
    archives++;
    return route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "control_uncertain", message: "synthetic refusal" },
      }),
    });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 20 });
  try {
    await archive.click();
    await expect(page).toHaveURL(/\/workspaces\/[^/?]+$/);
    await expect(page.getByTestId("archive-error")).toBeVisible({
      timeout: 15000,
    });
  } finally {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }
  expect(archives).toBe(1);
  const workspace = page.url();
  // It holds: a refusal does not expire like the undo offer.
  await page.waitForTimeout(1000);
  await expect(page.getByTestId("archive-error")).toBeVisible();
  expect(page.url()).toBe(workspace);
  // Client-side navigation, not a reload that would erase all app state.
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  await expect(page.getByTestId("archive-notice")).toHaveCount(0);
  await expect(page.getByTestId("archive-error")).toHaveCount(0);
});
