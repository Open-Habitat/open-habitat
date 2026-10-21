import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

test("@lab live turn never flashes recovery controls or moves the editor while streaming", async ({
  page,
}) => {
  test.setTimeout(60000);
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
  // Make the ordinary native-history invalidation observable across frames.
  await page.route("**/api/v1/agents/*/history*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    // A read still delayed here when the test swaps this route for the
    // failing one below has already been taken over by that route.
    await route.continue().catch(() => {});
  });
  await page.getByTestId("message-input").fill("hidas tallennettu vuoro");
  await page.evaluate(() => {
    const samples: {
      check: boolean;
      stale: boolean;
      editor: number | undefined;
      working: boolean;
      streaming: boolean;
    }[] = [];
    const sample = () => {
      samples.push({
        check: !!document.querySelector('[data-testid="check-conversation"]'),
        stale: !!document.querySelector('[data-testid="history-stale"]'),
        editor: document.querySelector(".ah-cbox")?.getBoundingClientRect().top,
        working: !!document.querySelector(".ah-working-progress"),
        streaming:
          document
            .querySelector('[data-testid="message-input"]')
            ?.getAttribute("data-working") === "true",
      });
    };
    const observer = new MutationObserver(sample);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    const timer = setInterval(sample, 16);
    Object.assign(window, {
      liveTurnSamples: samples,
      stopLiveTurnSampling: () => {
        observer.disconnect();
        clearInterval(timer);
      },
    });
  });
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(page, "Katson ensin,", { timeout: 15000 });
  const editorTop = await page
    .locator(".ah-cbox")
    .evaluate((node) => node.getBoundingClientRect().top);
  await expectNativeContent(page, 'Selvä. Kysyit: "hidas tallennettu vuoro".', {
    timeout: 20000,
  });
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="send"]')),
  ).toBeVisible({
    timeout: 10000,
  });
  const samples = await page.evaluate(() => {
    const capture = window as typeof window & {
      liveTurnSamples: {
        check: boolean;
        stale: boolean;
        editor?: number;
        working: boolean;
        streaming: boolean;
      }[];
      stopLiveTurnSampling: () => void;
    };
    capture.stopLiveTurnSampling();
    return capture.liveTurnSamples;
  });
  expect(samples.length).toBeGreaterThan(100);
  expect(samples.filter((sample) => sample.check || sample.stale)).toEqual([]);
  expect(samples.some((sample) => sample.working)).toBe(false);
  // Send/queue mode and final recap are deliberate transitions. During the
  // intervening stream, the visible editor must remain anchored.
  expect(editorTop).toBeGreaterThan(0);
  const tops = samples
    .filter((sample) => sample.streaming)
    .flatMap((sample) => (sample.editor === undefined ? [] : [sample.editor]));
  expect(tops.length).toBeGreaterThan(100);
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
  await test.info().attach("live-turn-samples", {
    body: JSON.stringify(samples),
    contentType: "application/json",
  });

  // A real sustained history failure must still offer recovery (not hidden
  // forever to satisfy the no-flicker assertion).
  await page.unroute("**/api/v1/agents/*/history*");
  await page.route("**/api/v1/agents/*/history*", (route) =>
    route.fulfill({ status: 503, body: "synthetic failure" }),
  );
  await page.reload();
  await expect(page.getByTestId("conversation-recheck")).toBeVisible({
    timeout: 15000,
  });
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
