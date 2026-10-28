import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function openConversation(page: Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await page.getByTestId("message-input").fill("Check the synthetic workspace");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(
    page,
    'Selvä. Kysyit: "Check the synthetic workspace".',
    { timeout: 20000 },
  );
}

test("title regeneration after daemon restart uses native history without continuing Pi", async ({
  page,
}) => {
  await openConversation(page);
  const url = page.url();
  const agent = new URL(url).searchParams.get("conversation");
  if (!agent?.startsWith("pi:")) throw new Error("Missing conversation ID");
  const id = agent.slice(3);
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  await page.goto(url);
  const retitle = page.getByTestId("conversation-retitle");
  await expect(retitle).toBeEnabled();
  // Read the native reply before forwarding it: the title can change the route,
  // after which Chromium may discard the old document's response body.
  let body: unknown;
  await page.route(/\/(regenerate_title|history_title)$/, async (route) => {
    const reply = await route.fetch();
    body = await reply.json();
    await route.fulfill({ response: reply });
  });
  const response = page.waitForResponse((reply) =>
    /\/(regenerate_title|history_title)$/.test(reply.url()),
  );
  await retitle.click();
  const reply = await response;
  expect(reply.status(), JSON.stringify(body)).toBe(200);
  expect(body).toMatchObject({ state: "done" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Synteettinen otsikko",
  );
  // Naming a stopped history must not leave a controllable Pi running.
  expect(
    (
      await (
        await page.request.get(`/api/v1/conversations/${id}/status`)
      ).json()
    ).state,
  ).toBe("stopped");
});

test("pending live title animates arrow and dots; failures use the conversation notice area @a11y", async ({
  page,
}) => {
  await openConversation(page);
  const retitle = page.getByTestId("conversation-retitle");
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/regenerate_title", async (route) => {
    await held;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"schema_version":1,"error":{"code":"native_source_unavailable"}}',
    });
  });
  try {
    await retitle.click();
    await expect(retitle).toBeDisabled();
    await expect(page.getByTestId("conversation-title")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    const arrow = page.getByTestId("title-arrow");
    expect(
      await arrow.evaluate((el) => el.getAnimations().length),
    ).toBeGreaterThan(0);
    const dots = page.getByTestId("title-dots");
    await expect(dots).toBeVisible();
    expect(
      await dots
        .locator("i")
        .first()
        .evaluate((element) => element.getAnimations().length),
    ).toBeGreaterThan(0);
  } finally {
    release();
  }
  const notice = page
    .locator(".ah-conversation-notices")
    .getByTestId("title-error");
  await expect(notice).toBeVisible();
  await expect(
    page.locator(".ah-agent-header").getByTestId("title-error"),
  ).toHaveCount(0);
  await expect(retitle).toBeEnabled();
  expect(
    await page
      .getByTestId("title-arrow")
      .evaluate((el) => el.getAnimations().length),
  ).toBe(0);
  expect(
    await page
      .getByTestId("title-dots")
      .locator("i")
      .first()
      .evaluate((el) => el.getAnimations().length),
  ).toBe(0);
  const a11y = await new AxeBuilder({ page })
    .include(".ah-conversation-notices")
    .analyze();
  expect(a11y.violations).toEqual([]);
  await page.unroute("**/regenerate_title");
  // A real live RPC title request still uses the live operation. The fake Pi
  // lacks a model runtime, so its fixed failure must retain the existing title.
  let liveTitle: unknown;
  await page.route("**/regenerate_title", async (route) => {
    const response = await route.fetch();
    liveTitle = await response.json();
    await route.fulfill({ response });
  });
  await retitle.click();
  await expect
    .poll(() => liveTitle)
    .toMatchObject({
      state: "failed",
      reason: "model_unavailable",
    });
  await expect(notice).toBeVisible();
  await expect(retitle).toBeEnabled();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Check the synthetic workspace",
  );
});

test("@a11y compact header keeps the title on its phone row and model facts read-only", async ({
  page,
}) => {
  await openConversation(page);
  const header = page.locator(".ah-agent-header");
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (value) => document.documentElement.setAttribute("data-theme", value),
      theme,
    );
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await header.locator("h1").evaluate((el) => {
        // Longer than the title's whole row, which the state chips no longer
        // share when the column is narrow.
        el.textContent =
          "Pitkä keskustelun otsikko jonka pitäisi saada tilaa työkalujen rinnalla silloinkin kun ikkuna on kapea ja sivupalkki auki";
      });

      const title = await header.locator("h1").boundingBox();
      if (width !== 390) expect(title?.width).toBeGreaterThan(200);
      const measure = () =>
        header.locator("h1").evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const text = range.getBoundingClientRect();
          return {
            unshortened: text.width <= el.clientWidth + 1,
            oneLine:
              text.height <=
              Number.parseFloat(getComputedStyle(el).lineHeight) + 1,
          };
        });
      const long = await measure();
      expect(long.unshortened && long.oneLine).toBe(false);
      if (width === 390) {
        // On a phone the title shares its row with the panel buttons and the
        // menu, beside the floating navigation; the model chip sits on the
        // row below. The title takes all the room that row leaves it.
        const model = await header.locator(".ah-set-chip").boundingBox();
        const titleGroup = await page
          .getByTestId("conversation-title")
          .boundingBox();
        const next = await page
          .getByTestId("conversation-title")
          .evaluate((el) => {
            const own = el.getBoundingClientRect();
            const right = [...(el.parentElement?.children ?? [])]
              .map((child) => child.getBoundingClientRect())
              .filter(
                (box) =>
                  box.width > 1 &&
                  box.left >= own.right - 1 &&
                  Math.abs(
                    box.top + box.height / 2 - (own.top + own.height / 2),
                  ) < 12,
              )
              .map((box) => box.left);
            return Math.min(...right);
          });
        const gap = await header
          .locator(".ah-agent-topline")
          .evaluate(
            (el) => Number.parseFloat(getComputedStyle(el).columnGap) || 0,
          );
        expect(
          (titleGroup?.x ?? 0) + (titleGroup?.width ?? 0) + gap,
        ).toBeCloseTo(next, 0);
        expect(model?.y).toBeGreaterThanOrEqual(
          (title?.y ?? 0) + (title?.height ?? 0),
        );
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      // A bounded generated title must fit without expanding the title control.
      // Retain the preceding long native-name case: user names are not shortened.
      // The phone's title row is narrower than the bound: there the title
      // stays on one line and shortens, and the menu carries it in full.
      await header.locator("h1").evaluate((el) => {
        el.textContent = "Muistutuksen testaus";
      });
      expect(await measure()).toEqual({
        unshortened: width !== 390,
        oneLine: true,
      });
      const pill = header.locator(".md-chip-picker > summary");
      await pill.click();
      const info = header.getByTestId("conversation-model-info");
      await expect(info).toBeVisible();
      await expect(info.locator("button, input, select")).toHaveCount(0);
      const box = await info.boundingBox();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      expect(
        (await new AxeBuilder({ page }).include(".ah-agent-header").analyze())
          .violations,
      ).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(pill).toBeFocused();
    }
  }
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
