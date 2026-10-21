import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("@thinking-title @a11y reasoning titles stay on their own disclosure row in both states", async ({
  page,
}) => {
  // Supply invented reasoning through the validated history boundary. This
  // tests production rendering, not native Pi's choice of summary wording.
  await page.route("**/api/v1/agents/*/history?*", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    if (!json.entries) return route.fulfill({ response });
    const content = (text: string) => ({
      media_type: "text/plain",
      text,
      complete: true,
    });
    json.entries = [
      {
        entry_key: "thinking-user",
        kind: "user",
        content: content("Explain the extension message"),
      },
      {
        entry_key: "thinking-assistant",
        kind: "assistant",
        content: content("Synthetic reply"),
        blocks: [
          {
            type: "thinking",
            text: "**Interpreting extension messages**\n\nKeep **other emphasis** and the rest of the reasoning.\n\n- First point\n- Second point",
          },
          {
            type: "thinking",
            text: "**Checking the source**\n\nThis second block has its own title.",
          },
          {
            // Claude-shaped: no heading, so the first line is the title.
            type: "thinking",
            text: "The user wants to know why the extension message arrives twice when the session is resumed after a restart.\nLet me read the relay first.\n\nThen the journal.",
          },
          { type: "text", text: "Synthetic reply" },
        ],
      },
    ];
    await route.fulfill({ response, json });
  });
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.goto("/agents/pi:11111111-1111-4111-8111-111111111111");
  await page.getByTestId("history-stage-toggle").click();
  const first = page.getByTestId("thinking-toggle").nth(0);
  const second = page.getByTestId("thinking-toggle").nth(1);
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(second).toHaveAttribute("aria-expanded", "false");
  await expectNativeContent(page, "other emphasis", {
    exact: true,
    count: 0,
    visible: false,
  });
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(second).toHaveAttribute("aria-expanded", "false");
  const body = page.locator(".ah-think-long blockquote");
  await expect(body.locator("strong")).toHaveText("other emphasis");
  await expect(body.getByRole("listitem")).toHaveText([
    "First point",
    "Second point",
  ]);
  await expect(body).not.toContainText("Interpreting extension messages");
  await second.click();
  await expectNativeContent(page, "This second block has its own title.", {});
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(second).toHaveAttribute("aria-expanded", "true");
  const untitled = page.getByTestId("thinking-toggle").nth(2);
  await expect(untitled).toHaveAttribute("aria-expanded", "false");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const toggle of [first, untitled]) {
      const geometry = await toggle.evaluate((button) => {
        const [label, title] = [...button.children].map((child) =>
          child.getBoundingClientRect(),
        );
        const row = button.getBoundingClientRect();
        return {
          sameRow: Math.abs(label.top - title.top) < 1,
          fits: row.right <= window.innerWidth,
        };
      });
      expect(geometry).toEqual({ sameRow: true, fits: true });
    }
  }
  await untitled.click();
  // The preview stays part of the reasoning it summarizes.
  await expect(page.locator(".ah-think-long blockquote").last()).toContainText(
    "The user wants to know why",
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await first.evaluate((button) => {
      const [label, title] = [...button.children].map((child) =>
        child.getBoundingClientRect(),
      );
      const row = button.getBoundingClientRect();
      return {
        sameRow: Math.abs(label.top - title.top) < 1,
        fits: row.right <= window.innerWidth,
      };
    });
    expect(geometry).toEqual({ sameRow: true, fits: true });
  }
  expect(
    (
      await new AxeBuilder({ page })
        .include(".ah-conversation-stream")
        .analyze()
    ).violations,
  ).toEqual([]);
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
