import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("@browser-conversation repeated completed turns do not become Pi messages", async ({
  page,
}) => {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
  await page
    .getByRole("navigation")
    .locator('a[data-testid^="workspace-"][data-workspace-name="ordinary-dir"]')
    .click();
  await page.getByTestId("conversation-start").click();
  // Observe both DOM commits and painted frames: a completion row can vanish
  // before a normal locator assertion gets a chance to see it.
  await page.evaluate(() => {
    const samples: { notices: number; unsupported: number }[] = [];
    let active = true;
    const sample = () =>
      samples.push({
        notices: document.querySelectorAll(".ah-live-work .ah-notice").length,
        unsupported: document.querySelectorAll(
          '[data-testid="unpresented-event"]',
        ).length,
      });
    const observer = new MutationObserver(sample);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    const frame = () => {
      if (!active) return;
      sample();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    Object.assign(window, {
      completionSamples: samples,
      stopCompletionSampling: () => {
        active = false;
        observer.disconnect();
        return samples;
      },
    });
  });
  for (let i = 1; i <= 4; i++) {
    await page.getByTestId("message-input").fill(`Vuoro ${i}`);
    await page.getByTestId("send").click();
    await expect(page.locator("main")).toContainText(
      `Selvä. Kysyit: "Vuoro ${i}".`,
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("composer-stop")).toHaveCount(0);
    await expect(page.locator('[data-testid="unpresented-event"]')).toHaveCount(
      0,
    );
  }
  const samples = await page.evaluate(() =>
    (
      window as typeof window & {
        stopCompletionSampling: () => {
          notices: number;
          unsupported: number;
        }[];
      }
    ).stopCompletionSampling(),
  );
  expect(samples.length).toBeGreaterThan(0);
  expect(
    samples.every((sample) => sample.notices === 0 && sample.unsupported === 0),
  ).toBe(true);
  await test.info().attach("completion-frames", {
    body: JSON.stringify(samples),
    contentType: "application/json",
  });
  await page.reload();
  await expect(page.locator('[data-testid="unpresented-event"]')).toHaveCount(
    0,
  );
});
