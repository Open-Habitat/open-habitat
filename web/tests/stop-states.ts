import type { Page } from "@playwright/test";

/** What one animation frame showed while a stop was under way. */
export type StopSample = {
  banner: boolean;
  recheck: boolean;
  uncertain: boolean;
  /** A notice inside the running turn, such as a raw Pi lifecycle signal. */
  liveNotice: boolean;
  queue: boolean;
  draft: string;
  height: number;
  running: boolean;
};

/** Records every frame from now on, so a state shown for a single frame
 * between two assertions is still seen. */
export async function recordStopStates(page: Page) {
  await page.evaluate(() => {
    const samples: StopSample[] = [];
    const shown = (id: string) =>
      !!document.querySelector(`[data-testid="${id}"]`);
    const tick = () => {
      samples.push({
        banner: [
          "send-receipt",
          "send-error",
          "conversation-problem",
          "conversation-stale",
          "event-gap",
        ].some(shown),
        recheck: shown("conversation-recheck"),
        uncertain: !!document.querySelector(
          '[data-testid="working-uncertain"][data-state="uncertain"], [data-testid="composer-notice"][data-stopping="uncertain"]',
        ),
        liveNotice: !!document.querySelector(".ah-live-work .ah-notice"),
        queue: shown("composer-queue"),
        draft:
          document.querySelector<HTMLTextAreaElement>(
            '[data-testid="message-input"]',
          )?.value ?? "",
        height: Math.round(
          document
            .querySelector(".ah-conversation-frame > .ah-composer")
            ?.getBoundingClientRect().height ?? 0,
        ),
        running: !!document.querySelector(
          '[data-testid="composer-stop"][data-stop-target="agent"]',
        ),
      });
      requestAnimationFrame(tick);
    };
    Object.assign(window, { stopSamples: samples });
    tick();
  });
}

export async function stopStates(page: Page): Promise<StopSample[]> {
  return page.evaluate(
    () => (window as unknown as { stopSamples: StopSample[] }).stopSamples,
  );
}
