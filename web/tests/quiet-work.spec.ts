import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./worker-host";

test("@a11y quiet working turn keeps one button across ticks, every click toggles without a jump", async ({
  page,
}) => {
  await page.goto("/?fixture=design-quiet-turn");
  const button = page.getByTestId("turn-work-toggle");
  await expect(button).toBeVisible();
  await button.scrollIntoViewIfNeeded();
  const identity = await button.evaluate((node) => {
    (window as typeof window & { quietButton?: Element }).quietButton = node;
    return node.getBoundingClientRect().top;
  });
  await expect(page.locator(".ah-turn-clock")).toHaveText("0:02", {
    timeout: 5000,
  });
  expect(
    await button.evaluate(
      (node) =>
        node ===
        (window as typeof window & { quietButton?: Element }).quietButton,
    ),
  ).toBe(true);
  await button.click();
  const opened = page.getByTestId("turn-work-toggle");
  await expect(opened).toHaveAttribute("aria-expanded", "true");
  expect(
    Math.abs(
      (await opened.evaluate((node) => node.getBoundingClientRect().top)) -
        identity,
    ),
  ).toBeLessThanOrEqual(1);
  expect(
    await opened.evaluate(
      (node) =>
        node ===
        (window as typeof window & { quietButton?: Element }).quietButton,
    ),
  ).toBe(true);
  await expectNativeContent(page, "Synteettinen vaihe kaksi", {});
  await expect(page.locator(".ah-turn-clock")).toHaveText("0:04", {
    timeout: 5000,
  });
  expect(
    await opened.evaluate(
      (node) =>
        node ===
        (window as typeof window & { quietButton?: Element }).quietButton,
    ),
  ).toBe(true);
  await opened.click();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.click();
  await expect(opened).toHaveAttribute("aria-expanded", "true");
  expect(
    (await new AxeBuilder({ page }).include(".ah-agent-turn").analyze())
      .violations,
  ).toEqual([]);
});

test("@a11y reduced motion removes reveal animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?fixture=design-quiet-turn");
  await page.getByTestId("turn-work-toggle").click();
  await expect(page.locator(".ah-work-revealing > *").first()).toHaveCSS(
    "animation-name",
    "none",
  );
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
