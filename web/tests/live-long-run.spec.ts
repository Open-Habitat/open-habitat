import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

// One Pi run of many tool-calling model turns (a long task with git pushes and
// issue calls, often lengthened by steering) saves each message as it ends but
// settles only at its end. Its provisional structure outgrew the live tail,
// and "Tapahtumia jäi väliin" stayed until the run settled although the
// stream was contiguous and native history complete. This run is long enough
// to outgrow even the raised 1000-frame bound once.
test("a long tool-calling run shows no missed-events notice", async ({
  page,
}) => {
  test.setTimeout(60000);
  // Count the daemon giving the tail up, so the run is known to cross the bound.
  await page.addInitScript(() => {
    const listen = EventSource.prototype.addEventListener;
    Object.assign(window, { tailGivenUp: 0 });
    EventSource.prototype.addEventListener = function (
      this: EventSource,
      kind: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (kind === "snapshot.invalidated")
        listen.call(this, kind, (message) => {
          if (String((message as MessageEvent).data).includes("ring_truncated"))
            (window as unknown as { tailGivenUp: number }).tailGivenUp++;
        });
      return listen.call(this, kind, listener, options);
    } as typeof EventSource.prototype.addEventListener;
  });
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").fill("pitkä ajo");
  // A starved host throttles the page's timers, so the 25 ms samples are only
  // the log; a mutation observer sees every appearance of the notice, however
  // short, and the run's span is measured in time rather than in samples.
  await page.evaluate(() => {
    const samples: { at: number; gap: boolean; working: boolean }[] = [];
    const shown: number[] = [];
    const gap = () => !!document.querySelector('[data-testid="event-gap"]');
    const observer = new MutationObserver(() => {
      if (gap()) shown.push(performance.now());
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = setInterval(
      () =>
        samples.push({
          at: performance.now(),
          gap: gap(),
          working:
            document
              .querySelector('[data-testid="message-input"]')
              ?.getAttribute("data-working") === "true",
        }),
      25,
    );
    Object.assign(window, {
      runSamples: samples,
      gapShown: shown,
      stopRunSampling: () => {
        clearInterval(timer);
        observer.disconnect();
      },
    });
  });
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(
    page
      .getByTestId("message-input")
      .and(page.locator('[data-working="true"]')),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="send"]')),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Pitkä ajo valmis.")).toBeVisible();
  const { samples, shown } = await page.evaluate(() => {
    const capture = window as typeof window & {
      runSamples: { at: number; gap: boolean; working: boolean }[];
      gapShown: number[];
      stopRunSampling: () => void;
    };
    capture.stopRunSampling();
    return { samples: capture.runSamples, shown: capture.gapShown };
  });
  const runs: string[] = [];
  for (const s of samples) {
    const key = `gap=${s.gap} working=${s.working}`;
    const last = runs.at(-1);
    if (last?.startsWith(`${key} ×`))
      runs[runs.length - 1] = `${key} ×${Number(last.split(" ×")[1]) + 1}`;
    else runs.push(`${key} ×1`);
  }
  console.log(`long-run states (25 ms samples):\n${runs.join("\n")}`);
  // The run lasts at least 130 × 60 ms; the sampler watched it throughout.
  const working = samples.filter((s) => s.working);
  expect((working.at(-1)?.at ?? 0) - (working[0]?.at ?? 0)).toBeGreaterThan(
    7000,
  );
  const start = samples[0]?.at ?? 0;
  expect(shown.map((at) => Math.round(at - start))).toEqual([]);
  expect(
    await page.evaluate(
      () => (window as unknown as { tailGivenUp: number }).tailGivenUp,
    ),
  ).toBeGreaterThan(0);
});
