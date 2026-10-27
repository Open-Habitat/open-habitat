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
  await page.evaluate(() => {
    const samples: { gap: boolean; working: boolean }[] = [];
    const timer = setInterval(
      () =>
        samples.push({
          gap: !!document.querySelector('[data-testid="event-gap"]'),
          working:
            document
              .querySelector('[data-testid="message-input"]')
              ?.getAttribute("data-working") === "true",
        }),
      25,
    );
    Object.assign(window, {
      runSamples: samples,
      stopRunSampling: () => clearInterval(timer),
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
  const samples = await page.evaluate(() => {
    const capture = window as typeof window & {
      runSamples: { gap: boolean; working: boolean }[];
      stopRunSampling: () => void;
    };
    capture.stopRunSampling();
    return capture.runSamples;
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
  // The run lasts about 130 × 60 ms plus its reads; most samples are mid-run.
  expect(samples.filter((s) => s.working).length).toBeGreaterThan(130);
  expect(samples.filter((s) => s.gap)).toEqual([]);
  expect(
    await page.evaluate(
      () => (window as unknown as { tailGivenUp: number }).tailGivenUp,
    ),
  ).toBeGreaterThan(0);
});
