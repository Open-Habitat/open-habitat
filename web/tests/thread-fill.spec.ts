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
      // An item that renders nothing takes no space and is not the last one.
      const last = [...el.querySelectorAll(s)]
        .filter((item) => item.getBoundingClientRect().height > 0)
        .at(-1);
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
  // Below the last message is only the stream's own padding (Jari
  // 29.10.2026): no list margin, and no empty item under a running turn.
  const spareBelow = () =>
    stream.evaluate((el) => {
      const shown = [...el.querySelectorAll(".ah-feed > li")].filter(
        (li) => li.getBoundingClientRect().height > 0,
      );
      const bottom = shown.at(-1)?.getBoundingClientRect().bottom;
      return (
        el.getBoundingClientRect().bottom -
        (bottom ?? Number.NaN) -
        Number.parseFloat(getComputedStyle(el).paddingBottom) -
        Number.parseFloat(getComputedStyle(el, "::after").height)
      );
    });
  expect(Math.abs(await spareBelow())).toBeLessThan(1);
  await page.getByTestId("message-input").fill("hidas toinen");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByTestId("turn-work-toggle")).toBeVisible({
    timeout: 20000,
  });
  await expect.poll(async () => Math.abs(await spareBelow())).toBeLessThan(1);
  // The turn's start, before the first reply (Jari 30.10.2026): the live row
  // sits on the composer. Nothing but the stream's bottom padding is under
  // it, a hold included once its brief window has passed, and that padding
  // is smaller than the stream's top one.
  const atStart = () =>
    stream.evaluate((el) => {
      const shown = [...el.querySelectorAll(".ah-feed > li")].filter(
        (li) => li.getBoundingClientRect().height > 0,
      );
      const last = shown.at(-1);
      const style = getComputedStyle(el);
      return {
        working: last?.textContent?.includes("Kysyit") === false,
        under:
          el.getBoundingClientRect().bottom -
          (last?.getBoundingClientRect().bottom ?? Number.NaN) -
          Number.parseFloat(style.paddingBottom),
        end: Number.parseFloat(style.paddingBottom),
        top: Number.parseFloat(style.paddingTop),
      };
    });
  await expect
    .poll(async () => {
      const s = await atStart();
      return s.working && Math.abs(s.under) < 1;
    })
    .toBe(true);
  const start = await atStart();
  expect(start.end).toBeLessThan(start.top);
  await expectNativeContent(stream, 'Selvä. Kysyit: "hidas toinen".', {
    timeout: 30000,
  });

  // Tall: the native page is taller than the view; its first child is
  // reachable at the top of the scroll range.
  // A terminal history that has ended is reached through the start page.
  await nav.getByTestId("home-link").click();
  await (
    await nativeConversationLink(
      page,
      page.locator("main"),
      /Synteettinen viesti 0/,
    )
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
