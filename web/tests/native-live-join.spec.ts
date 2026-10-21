import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("native catch-up keeps the held tool and continued answer in one turn", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.request.get("/fixture/scenario?value=pi-visual-hold");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await editor.fill("hidas native join");
  // Mutation samples catch even a duplicate that disappears before an assertion.
  await page.evaluate(() => {
    const samples: {
      turns: number;
      completed: number;
      answering: boolean;
      editor?: number;
    }[] = [];
    const sample = () =>
      samples.push({
        turns: document.querySelectorAll('[data-testid="agent-turn"]').length,
        completed: [
          ...document.querySelectorAll(
            ".ah-message-reply:not(.ah-message-interim)",
          ),
        ].filter((node) => node.getAttribute("data-reply-complete") === "true")
          .length,
        answering:
          document
            .querySelector('[data-testid="agent-turn"]')
            ?.textContent?.includes("Selvä. Kysyit:") ?? false,
        editor: document.querySelector(".ah-cbox")?.getBoundingClientRect().top,
      });
    const observer = new MutationObserver(sample);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    Object.assign(window, {
      joinSamples: samples,
      stopJoinSampling: () => observer.disconnect(),
    });
  });
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const turn = page.getByTestId("agent-turn");
  await expect(turn).toHaveCount(1);
  await expect(turn).toContainText("Katson ensin, mitä työtilassa on.", {
    timeout: 15000,
  });
  // Confirm a real native-history read includes the call while Pi is held.
  const id = new URL(page.url()).searchParams.get("conversation");
  expect(id).toBeTruthy();
  await expect
    .poll(async () => {
      const response = await page.request.get(`/api/v1/agents/${id}/history`);
      const history = await response.json();
      return history.entries?.some((entry: { blocks?: { type: string }[] }) =>
        entry.blocks?.some((block) => block.type === "toolCall"),
      );
    })
    .toBe(true);
  // Force the same native read through the browser, independently of SSE timing.
  await page
    .getByRole("button")
    .and(page.getByTestId("workspace-details"))
    .click();
  await page.getByTestId("conversation-recheck").click();
  await expect(turn).toHaveCount(1);
  await expect(turn).toBeVisible();
  await expect(
    turn
      .getByTestId("message")
      .and(page.locator('[data-reply-complete="true"]')),
  ).toHaveCount(0);
  await expectNativeContent(turn, "Katson ensin, mitä työtilassa on.", {
    exact: true,
    count: 1,
    visible: false,
  });
  const editorTop = await page
    .locator(".ah-cbox")
    .evaluate((node) => node.getBoundingClientRect().top);
  expect(
    await page.evaluate(() =>
      (
        window as typeof window & { joinSamples: { completed: number }[] }
      ).joinSamples.some((sample) => sample.completed > 0),
    ),
  ).toBe(false);
  await page.request.get("/fixture/scenario?value=pi-deltas");
  await expect(turn).toContainText('Selvä. Kysyit: "hidas native join".', {
    timeout: 20000,
  });
  await expect(
    turn
      .getByTestId("message")
      .and(page.locator('[data-reply-complete="true"]')),
  ).toHaveCount(1);
  await expect(turn).toHaveCount(1);
  const samples = await page.evaluate(() => {
    const capture = window as typeof window & {
      joinSamples: {
        turns: number;
        completed: number;
        answering: boolean;
        editor?: number;
      }[];
      stopJoinSampling: () => void;
    };
    capture.stopJoinSampling();
    return capture.joinSamples;
  });
  expect(Math.max(...samples.map((sample) => sample.turns))).toBe(1);
  expect(
    samples.some((sample) => sample.answering && sample.completed === 0),
  ).toBe(true);
  const tops = samples.flatMap((sample) =>
    sample.turns && sample.editor !== undefined ? [sample.editor] : [],
  );
  expect(editorTop).toBeGreaterThan(0);
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
  await test.info().attach("native-join-mutations", {
    body: JSON.stringify(samples),
    contentType: "application/json",
  });
  await page.reload();
  await expect(turn).toHaveCount(1);
  await expect(
    turn
      .getByTestId("message")
      .and(page.locator('[data-reply-complete="true"]')),
  ).toHaveCount(1);
  await expectNativeContent(turn, "Katson ensin, mitä työtilassa on.", {
    exact: true,
    count: 1,
    visible: false,
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
