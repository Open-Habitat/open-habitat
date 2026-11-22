import { mkdir, writeFile } from "node:fs/promises";
import { devices, type Locator } from "@playwright/test";
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
    zoomsSmallText: true,
    device: devices["iPhone 13"],
  },
  {
    name: "Android Chrome",
    pan: 0,
    zoomsSmallText: false,
    device: devices["Pixel 7"],
  },
]) {
  test.describe(`phone keyboard (${phone.name})`, () => {
    test.use({
      userAgent: phone.device.userAgent,
      deviceScaleFactor: phone.device.deviceScaleFactor,
      isMobile: phone.device.isMobile,
      hasTouch: phone.device.hasTouch,
      viewport: { width: 390, height: 844 },
    });
    test("swipes stay in their scroll region and viewport bounce does not move chrome", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 844 });
      await open(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
      await page.getByTestId("message-input").fill("scroll baseline");
      await page
        .getByTestId("send")
        .and(page.locator('[data-mode="send"]'))
        .click();
      await expectNativeContent(page, 'Selvä. Kysyit: "scroll baseline".', {
        exact: true,
      });
      await page.getByTestId("message-input").blur();
      const shell = page.locator(".ah-app-shell");
      const stream = page.locator(".ah-conversation-stream");
      const header = page.locator(".ah-agent-header");
      const composer = page.locator(".ah-composer");
      const tops = async () =>
        Promise.all(
          [header, composer].map((el) =>
            el.evaluate((node) => node.getBoundingClientRect().top),
          ),
        );
      const initialTops = await tops();
      const cdp = await page.context().newCDPSession(page);
      const stationary = async () => {
        expect(
          await page.evaluate(() => [
            window.scrollY,
            document.scrollingElement?.scrollTop,
          ]),
        ).toEqual([0, 0]);
        expect(
          await shell.evaluate((el) => el.getBoundingClientRect().top),
        ).toBe(0);
        expect(await tops()).toEqual(initialTops);
      };
      const swipe = async (target: Locator, direction: number) => {
        const box = await target.boundingBox();
        if (!box) throw new Error("missing swipe target");
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        for (let dy = 10; dy <= 100; dy += 10) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x, y: y + direction * dy }],
          });
          await page.evaluate(() => new Promise(requestAnimationFrame));
          await stationary();
        }
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await stationary();
      };
      // A short transcript, header and composer have no content to scroll.
      for (const target of [
        page.locator(".ah-agent-header"),
        page.locator(".ah-composer"),
        stream,
      ]) {
        await swipe(target, -1);
        await swipe(target, 1);
      }
      if (process.env.OH_PHONE_SCROLL_CAPTURE) {
        const base = `${process.env.OH_PHONE_SCROLL_CAPTURE}/${phone.name.replaceAll(" ", "-")}`;
        await mkdir(process.env.OH_PHONE_SCROLL_CAPTURE, { recursive: true });
        await page.screenshot({ path: `${base}.png` });
        await writeFile(`${base}.html`, await page.content());
      }
      await page.getByTestId("navigation-open").click();
      await swipe(page.locator(".ah-rail-foot"), -1);
      await swipe(page.locator(".ah-rail-foot"), 1);
      await page
        .getByTestId("close-navigation")
        .filter({ visible: true })
        .click();
      // The lock must not disable the transcript's native touch scrolling.
      await page.addStyleTag({
        content: ".ah-timeline { min-height: 3000px; }",
      });
      await expect
        .poll(() => stream.evaluate((el) => el.scrollHeight - el.clientHeight))
        .toBeGreaterThan(1000);
      await stream.evaluate((el) => {
        el.scrollTop = 500;
      });
      await swipe(stream, -1);
      await expect
        .poll(() => stream.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(520);
      await cdp.detach();
      // Desktop mobile emulation cannot produce Safari's elastic viewport.
      // Inject that event separately; it must not be mistaken for keyboard pan.
      await page.evaluate(() => {
        const viewport = window.visualViewport;
        if (!viewport) throw new Error("missing visual viewport");
        Object.defineProperty(viewport, "offsetTop", {
          configurable: true,
          value: 45,
        });
        viewport.dispatchEvent(new Event("scroll"));
      });
      await stationary();
      await page.evaluate(() => {
        Object.defineProperty(window.visualViewport, "offsetTop", {
          configurable: true,
          value: -45,
        });
        window.visualViewport?.dispatchEvent(new Event("scroll"));
      });
      await stationary();
    });
    test("late overview and keyboard leave the editor and latest turn in view", async ({
      page,
    }) => {
      // Desktop Playwright cannot open an OS keyboard. Emulate its separate
      // visual viewport, including Safari's pan, rather than resize the layout.
      await page.addInitScript((zoomsSmallText) => {
        const viewport = new EventTarget();
        Object.assign(viewport, { height: 844, offsetTop: 0, scale: 1 });
        Object.defineProperty(window, "visualViewport", { value: viewport });
        if (!zoomsSmallText) return;
        // iOS WebKit zooms into a focused field whose text is under 16px;
        // the zoomed visual viewport then no longer stands for the keyboard.
        document.addEventListener("focusin", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          if (!target.matches("textarea, input, [contenteditable]")) return;
          const size = Number.parseFloat(getComputedStyle(target).fontSize);
          if (size < 16) Object.assign(viewport, { scale: 16 / size });
        });
      }, phone.zoomsSmallText);
      let showRecap = false;
      await page.route("**/api/v1/agents/*/recap", (route) =>
        route.fulfill({
          json: {
            schema_version: 1,
            latest_message: "done1",
            latest_message_at: new Date().toISOString(),
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
      // The compact facts line stays available while the overview steps
      // aside, leaving at least two fifths of the room for the conversation.
      const context = page
        .getByTestId("phone-header-facts")
        .locator(".ah-ctx-ring");
      await expect(context).toBeInViewport({ ratio: 1 });
      await expect(page.locator(".ah-recap")).toBeHidden();
      expect(
        await stream.evaluate((el) => el.getBoundingClientRect().height),
      ).toBeGreaterThanOrEqual(440 * 0.4);
      await resize(844, 0);
      await editorVisible(844);
      await expect(context).toBeInViewport({ ratio: 1 });
      await expect(page.locator(".ah-recap")).toBeVisible();
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
