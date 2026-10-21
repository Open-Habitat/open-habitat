import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

type Sample = {
  gap: boolean;
  check: boolean;
  stale: boolean;
  words: number;
  streaming: boolean;
};

// A long streamed answer (or a spinoff brief streamed as tool arguments) used
// to outgrow the 128-frame live tail: the daemon stopped streaming, the browser
// showed "Tapahtumia jäi väliin", dropped the partial text and marked the
// history stale until the saved message arrived. Pi's own native writes also
// marked the open history stale until a slow snapshot and read answered.
test("@lab a long stream keeps its text and shows no gap or recovery", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=pi-deltas");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  // Live snapshots and native-history reads take more than a second on the
  // test server (gateway journal, 2026-10-17); the 800 ms warning delay alone
  // does not hide an intermediate state that slow.
  await page.route("**/api/v1/agents/*/history*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page.route("**/api/v1/snapshot*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1700));
    await route.continue();
  });
  await page.getByTestId("message-input").fill("pitkä virta");
  await page.evaluate(() => {
    const samples: Sample[] = [];
    const sample = () => {
      const text = document.querySelector("main")?.textContent ?? "";
      samples.push({
        gap: !!document.querySelector('[data-testid="event-gap"]'),
        check: !!document.querySelector('[data-testid="check-conversation"]'),
        stale: !!document.querySelector('[data-testid="history-stale"]'),
        words: (text.match(/sana\d+/g) ?? []).length,
        streaming:
          document
            .querySelector('[data-testid="message-input"]')
            ?.getAttribute("data-working") === "true",
      });
    };
    const timer = setInterval(sample, 25);
    Object.assign(window, {
      streamSamples: samples,
      stopStreamSampling: () => clearInterval(timer),
    });
  });
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(page, "sana5 ", { timeout: 20000 });
  await expectNativeContent(page, "sana199", { timeout: 30000 });
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="send"]')),
  ).toBeVisible({
    timeout: 15000,
  });
  const samples = await page.evaluate(() => {
    const capture = window as typeof window & {
      streamSamples: Sample[];
      stopStreamSampling: () => void;
    };
    capture.stopStreamSampling();
    return capture.streamSamples;
  });
  await test.info().attach("long-stream-samples", {
    body: JSON.stringify(samples),
    contentType: "application/json",
  });
  // Run-length summary of the visible states, for the issue's evidence.
  const runs: string[] = [];
  for (const s of samples) {
    const key = `gap=${s.gap} check=${s.check} stale=${s.stale} text=${s.words > 0}`;
    if (runs.at(-1)?.startsWith(key)) {
      const [, n] = (runs.at(-1) as string).split(" ×");
      runs[runs.length - 1] = `${key} ×${Number(n) + 1}`;
    } else runs.push(`${key} ×1`);
  }
  console.log(`long-stream states (25 ms samples):\n${runs.join("\n")}`);
  expect(samples.length).toBeGreaterThan(200);
  expect(samples.filter((s) => s.gap)).toEqual([]);
  expect(samples.filter((s) => s.check || s.stale)).toEqual([]);
  // The stream keeps arriving to its end rather than freezing at a bound
  // (the daemon used to stop publishing after 128 tail frames).
  let stall = 0;
  let longest = 0;
  for (let i = 1; i < samples.length; i++) {
    const held =
      samples[i].streaming &&
      samples[i].words >= 30 &&
      samples[i].words < 200 &&
      samples[i].words === samples[i - 1].words;
    stall = held ? stall + 1 : 0;
    longest = Math.max(longest, stall);
  }
  // A 1.2 s history read must not stall the live text. Allow scheduling
  // jitter, but less than half the injected history latency.
  console.log(`longest live-text stall: ${longest * 25} ms`);
  expect(longest * 25).toBeLessThan(600);
  // Once streaming text is shown it only grows until the saved answer.
  const first = samples.findIndex((s) => s.words > 0);
  expect(first).toBeGreaterThanOrEqual(0);
  const shrinks = samples
    .slice(first)
    .filter(
      (s, i, list) => i > 0 && s.words < list[i - 1].words && s.words < 190,
    );
  expect(shrinks).toEqual([]);
});

// Native content is asserted independently of translated controls. This helper
// only reads rendered content; it never finds an element for an interaction.
async function expectNativeContent(
  scope: import("@playwright/test").Page | import("@playwright/test").Locator,
  expected: string | RegExp,
  options: {
    count?: number;
    visible?: boolean;
    exact?: boolean;
    timeout?: number;
  } = {},
) {
  const { count, visible = true, exact = false, timeout } = options;
  const read = () =>
    scope.locator("*").evaluateAll(
      (nodes, args) => {
        const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
        const matches = (node: Element) => {
          if (["SCRIPT", "STYLE", "HEAD"].includes(node.tagName)) return false;
          const text = normalize(node.textContent ?? "");
          return args.regex
            ? new RegExp(args.regex, args.flags).test(text)
            : args.exact
              ? text === normalize(args.text)
              : text.includes(normalize(args.text));
        };
        return nodes.filter(
          (node) =>
            matches(node) &&
            ![...node.children].some(matches) &&
            (!args.visible ||
              (node.getClientRects().length > 0 &&
                getComputedStyle(node).visibility !== "hidden")),
        ).length;
      },
      {
        text: typeof expected === "string" ? expected : "",
        regex: expected instanceof RegExp ? expected.source : "",
        flags: expected instanceof RegExp ? expected.flags : "",
        exact,
        visible,
      },
    );
  if (count === undefined)
    await expect.poll(read, { timeout }).toBeGreaterThan(0);
  else await expect.poll(read, { timeout }).toBe(count);
}
