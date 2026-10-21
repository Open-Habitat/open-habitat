import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

const host = hostOrigin;
// The host shares both controller capacity and the OAuth peer admission bucket
// across tests. Advance fixture time between cases (never within a session),
// so earlier logins cannot exhaust a later case's real gateway rate limit.
test.beforeEach(async ({ page }) => {
  expect((await page.request.get("/fixture/reset-clock")).status()).toBe(204);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});
test.use({
  baseURL: host,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});
async function open(page: import("@playwright/test").Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await expect(
    page.getByTestId(/^(new-conversation|conversation-start)$/),
  ).toBeEnabled();
}

for (const phone of [
  {
    name: "iOS Safari",
    pan: 45,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  },
  {
    name: "Android Chrome",
    pan: 0,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
  },
]) {
  test.describe(`phone keyboard (${phone.name})`, () => {
    test.use({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: phone.userAgent,
    });
    test("late overview and keyboard leave the editor and latest turn in view", async ({
      page,
    }) => {
      // Desktop Playwright cannot open an OS keyboard. Emulate its separate
      // visual viewport, including Safari's pan, rather than resize the layout.
      await page.addInitScript(() => {
        const viewport = new EventTarget();
        Object.assign(viewport, { height: 844, offsetTop: 0, scale: 1 });
        Object.defineProperty(window, "visualViewport", { value: viewport });
      });
      let showRecap = false;
      await page.route("**/api/v1/agents/*/recap", (route) =>
        route.fulfill({
          json: {
            schema_version: 1,
            latest_message: "done1",
            recap: showRecap
              ? {
                  recap: "Synteettinen tilannekatsaus. ".repeat(35),
                  next: "Jatka työtä.",
                  through: "done1",
                  generated_at: Date.now(),
                  trigger: "manual",
                }
              : null,
          },
        }),
      );
      // Reuse desktop sign-in/navigation setup; the conversation itself opens
      // with phone layout and touch input.
      await page.setViewportSize({ width: 1280, height: 844 });
      await open(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
      const field = page.getByTestId("message-input");
      await field.fill("phone baseline");
      await page
        .getByTestId("send")
        .and(page.locator('[data-mode="send"]'))
        .click();
      await expectNativeContent(page, 'Selvä. Kysyit: "phone baseline".', {
        exact: true,
      });
      const conversationURL = page.url();
      await page.goto("/workspaces");
      showRecap = true;
      await page.goto(conversationURL);
      await expect(page.locator(".ah-recap")).toBeVisible();
      await page.addStyleTag({
        content: ".ah-timeline { min-height: 3000px; }",
      });
      const stream = page.locator(".ah-conversation-stream");
      const atLatest = () =>
        expect
          .poll(() =>
            stream.evaluate(
              (el) => el.scrollHeight - el.scrollTop - el.clientHeight,
            ),
          )
          .toBeLessThan(2);
      await atLatest();
      await field.fill("still writing");
      await field.focus();
      const resize = async (height: number, offsetTop: number) => {
        await page.evaluate(
          ({ height, offsetTop }) => {
            const viewport = window.visualViewport;
            if (!viewport) throw new Error("missing visual viewport");
            Object.assign(viewport, { height, offsetTop });
            viewport.dispatchEvent(new Event("resize"));
            viewport.dispatchEvent(new Event("scroll"));
          },
          { height, offsetTop },
        );
      };
      const editorVisible = async (bottom: number) => {
        await expect
          .poll(() => field.evaluate((el) => el.getBoundingClientRect().bottom))
          .toBeLessThanOrEqual(bottom);
        const bounds = await field.boundingBox();
        if (!bounds) throw new Error("missing editor bounds");
        expect(bounds.y).toBeGreaterThanOrEqual(phone.pan);
        await expect(field).toBeFocused();
        await expect(field).toHaveValue("still writing");
        await atLatest();
      };
      await resize(440, phone.pan);
      await editorVisible(440 + phone.pan);
      await resize(844, 0);
      await editorVisible(844);
    });
  });
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
