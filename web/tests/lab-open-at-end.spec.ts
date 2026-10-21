import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});

test("@lab opening from home, sidebar and workspace always lands at latest", async ({
  page,
}) => {
  await page.request.get("/fixture/open-at-end");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const end = async () => {
    await expect(page.getByTestId("stage-reply").last()).toContainText(
      "Viimeisin vastaus on tässä.",
    );
    await expect(page.getByTestId("stage-reply").last()).toBeInViewport();
    await expect
      .poll(() =>
        page
          .locator(".ah-conversation-stream")
          .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
      )
      .toBeLessThan(2);
  };
  const leave = async () => {
    await page.locator(".ah-conversation-stream").hover();
    await page.mouse.wheel(0, -4000);
    await expect
      .poll(() =>
        page
          .locator(".ah-conversation-stream")
          .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
      )
      .toBeGreaterThan(100);
    await page.getByTestId("home-link").filter({ visible: true }).click();
  };
  const card = (
    await nativeConversationLink(
      page,
      page.locator("main"),
      "Avaamisen tarkistus",
    )
  ).locator(
    'xpath=ancestor::article[starts-with(@data-testid, "conversation-card-")]',
  );
  await card.getByTestId("open-conversation").click();
  await end();
  await leave();
  await (
    await nativeConversationLink(
      page,
      page.getByRole("navigation"),
      "Avaamisen tarkistus",
    )
  ).click();
  await end();
  await leave();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await (
    await nativeConversationLink(
      page,
      page.locator("main"),
      "Avaamisen tarkistus",
    )
  ).click();
  await end();
});

test("@lab native extension messages keep process summaries and omit empty cards", async ({
  page,
}) => {
  await page.request.get("/fixture/open-at-end");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.goto("/agents/pi:a1a1a1a1-0000-4000-8000-000000000001");
  // Native structured details, never XML, determine the completion block.
  const notification = page.getByRole("note");
  await expect(notification).toHaveCount(1);
  const toggle = notification.getByTestId("process-completion-toggle");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expectNativeContent(notification, /Merkintä säilyy historiassa/, {});
  await expect(notification.locator("pre, process_event")).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".ah-feed")).not.toContainText("<process_event");
  await expect(page.getByTestId("extension-message-heading")).toHaveCount(0);
  await expect(page.locator(".ah-feed")).not.toContainText(
    "not for the browser",
  );
  await expect(page.locator(".ah-feed")).not.toContainText(
    "Synthetic internal instruction",
  );
});

test("@lab a controlled conversation reopens at latest instead of its old reading anchor", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page
    .getByTestId("message-input")
    .fill(
      "Ohjatun avauksen tarkistus\n\n" +
        "Pitkä synteettinen kappale.\n\n".repeat(30),
    );
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByTestId("message-input")).toBeEnabled({
    timeout: 20000,
  });
  await expect(page.locator(".ah-turn-reply").last()).toContainText(
    "Selvä. Kysyit:",
    { timeout: 20000 },
  );
  const href = new URL(page.url()).pathname + new URL(page.url()).search;
  for (const from of ["home", "sidebar", "workspace"]) {
    const stream = page.locator(".ah-conversation-stream");
    await stream.hover();
    await page.mouse.wheel(0, -4000);
    await expect
      .poll(() =>
        stream.evaluate(
          (el) => el.scrollHeight - el.scrollTop - el.clientHeight,
        ),
      )
      .toBeGreaterThan(100);
    await page.getByTestId("home-link").filter({ visible: true }).click();
    if (from === "home") {
      await (
        await nativeConversationLink(
          page,
          page.locator("main"),
          "Ohjatun avauksen tarkistus",
        )
      )
        .locator(
          'xpath=ancestor::article[starts-with(@data-testid, "conversation-card-")]',
        )
        .getByTestId("open-conversation")
        .click();
    } else if (from === "sidebar") {
      await page.getByRole("navigation").locator(`a[href="${href}"]`).click();
    } else {
      await page
        .getByRole("navigation")
        .getByTestId("workspace-aurinkokello")
        .click();
      await page.locator("main").locator(`a[href="${href}"]`).first().click();
    }
    await expect
      .poll(() =>
        page
          .locator(".ah-conversation-stream")
          .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
      )
      .toBeLessThan(2);
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
