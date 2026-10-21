import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});

// Alhaalta (Jari 16.10.2026): a short conversation sits on the composer and
// grows upwards, while a thread taller than the view still scrolls to its
// first line (an auto top margin, not justify-content: flex-end).
test("@thread-fill a short conversation sits on the composer and a tall thread scrolls to its first line", async ({
  page,
}) => {
  test.setTimeout(60000);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
  await page.request.get("/fixture/scenario?value=ready");
  expect((await page.request.get("/fixture/history?mode=short")).status()).toBe(
    204,
  );
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const nav = page.getByTestId("workspace-navigation");
  await nav.getByTestId("workspace-ordinary-dir").click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const stream = page.locator(".ah-conversation-stream");
  // Empty: the invitation is at the bottom, next to the composer.
  const gapBelow = (selector: string) =>
    stream.evaluate((el, s) => {
      const items = el.querySelectorAll(s);
      const last = items[items.length - 1];
      if (!last) return Number.NaN;
      return (
        el.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom
      );
    }, selector);
  await expect(stream.getByTestId("conversation-empty")).toBeVisible();
  await expect
    .poll(() => gapBelow('[data-testid="conversation-empty"]'))
    .toBeLessThan(80);
  await page.getByTestId("message-input").fill("ensimmäinen");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(stream, 'Selvä. Kysyit: "ensimmäinen".', {
    timeout: 20000,
  });
  expect(await gapBelow(".ah-feed > li")).toBeLessThan(80);
  const freeAbove = await stream.evaluate(
    (el) =>
      (el.querySelector(".ah-feed > li")?.getBoundingClientRect().top ?? 0) -
      el.getBoundingClientRect().top,
  );
  // Bottom alignment means the spare space is above, not below the feed;
  // its amount varies with the composer/model controls and font metrics.
  expect(freeAbove).toBeGreaterThan(await gapBelow(".ah-feed > li"));

  // Tall: the native page is taller than the view; its first child is
  // reachable at the top of the scroll range.
  await (
    await nativeConversationLink(page, nav, /Synteettinen viesti 0/)
  ).click();
  await expect(page.locator(".ah-feed li")).toHaveCount(25);
  const top = await stream.evaluate((el) => {
    el.scrollTop = 0;
    const first = el.firstElementChild?.getBoundingClientRect().top ?? 0;
    return {
      offset: first - el.getBoundingClientRect().top,
      tall: el.scrollHeight > el.clientHeight * 1.5,
    };
  });
  expect(top.tall).toBe(true);
  expect(top.offset).toBeGreaterThanOrEqual(0);
  await expect(page.getByTestId("older-history")).toBeInViewport();
});

// Resolve native conversation identity from the host, not translated link copy.
async function nativeConversationLink(
  page: import("@playwright/test").Page,
  scope: import("@playwright/test").Page | import("@playwright/test").Locator,
  title: string | RegExp,
) {
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const agent = snapshot.agents.find((entry: { title: { display: string } }) =>
    typeof title === "string"
      ? entry.title.display.includes(title)
      : title.test(entry.title.display),
  );
  if (!agent) throw new Error("Missing native conversation identity");
  return scope
    .getByTestId(/^(agent-link|home-conversation-.*)$/)
    .and(
      page.locator(
        `a[href*="conversation=${encodeURIComponent(agent.agent_id)}"], a[href*="conversation=${agent.agent_id}"], a[href="/agents/${agent.agent_id}"]`,
      ),
    );
}

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
