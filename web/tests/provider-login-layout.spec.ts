import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
import { createHostTest, expect } from "./worker-host";

// Preserve the real helper's code through every option's layout/axe checks.
const test = createHostTest(false, { BROWSER_HOST_HOLD_PI_DEVICE: "1" });

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
type Page = import("@playwright/test").Page;

const option = (page: Page, id: string) => page.getByTestId(`ai-option-${id}`);
const choose = (page: Page, id: string) =>
  page.getByRole("button").and(page.getByTestId(`ai-option-${id}-choose`));

async function aiStep(page: Page) {
  await page.route("**/api/v1/pi/claude-login", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        state: "code",
        attempt_id: "20261020T120000.000000000",
        verification_uri: "https://claude.com/cai/oauth/authorize?synthetic=1",
      },
    }),
  );
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await confirmGitIdentity(page);
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-proceed"))
    .click();
  await expect(
    page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
  ).toBeVisible();
}

for (const width of [1440, 390]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`every AI option opens in place and stays reachable at ${width}px ${colorScheme} @a11y`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      // Audit settled colors, not the selection transition.
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await aiStep(page);
      const checkLayout = async () => {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const violations = (await new AxeBuilder({ page }).analyze())
          .violations;
        expect(violations).toEqual([]);
      };
      // One heading for the step; the sign-ins bring none of their own.
      await expect(
        page.getByTestId("onboarding-card").getByRole("heading"),
      ).toHaveCount(1);
      // ChatGPT is open first; the rest are closed rows.
      await expect(choose(page, "openai")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      for (const id of [
        "claude",
        "key-openai",
        "key-anthropic",
        "key-deepseek",
      ])
        await expect(choose(page, id)).toHaveAttribute(
          "aria-expanded",
          "false",
        );
      // A closed key row is one line: its billing note shows once it opens.
      await expect(
        option(page, "key-deepseek").getByText("DeepSeek laskuttaa käytöstä."),
      ).toBeHidden();
      await expect(page.getByTestId("claude-code-input")).toBeHidden();
      const start = page
        .getByRole("button")
        .and(page.getByTestId("pi-attempt-start"));
      await start.click();
      await expect(page.getByTestId("pi-device-code")).toHaveText("ABCD-1234");
      await expect(page.getByTestId("pi-device-code")).toBeVisible();
      await checkLayout();

      await choose(page, "claude").click();
      await expect(choose(page, "claude")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await expect(choose(page, "openai")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await expect(page.getByTestId("pi-device-code")).toBeHidden();
      await expect(
        page.getByRole("link").and(page.getByTestId("claude-sign-in-link")),
      ).toBeVisible();
      const code = page.getByTestId("claude-code-input");
      await code.fill("synthetic-code");
      await code.focus();
      await expect(code).toBeFocused();
      const confirm = page
        .getByRole("button")
        .and(page.getByTestId("claude-code-confirm"));
      await expect(confirm).toBeEnabled();
      await confirm.scrollIntoViewIfNeeded();
      const box = await confirm.boundingBox();
      if (!box) throw Error("Confirmation button has no layout box");
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      // Everything in the open row starts at the row text's left edge, rather
      // than floating right as the Settings row layout did in the card.
      const text = await option(page, "claude")
        .locator(".ah-ai-option-text")
        .boundingBox();
      const signIn = await page.getByTestId("claude-sign-in").boundingBox();
      if (!text || !signIn) throw Error("Claude row has no layout box");
      if (width > 600) expect(Math.abs(signIn.x - text.x)).toBeLessThan(2);
      expect(signIn.x).toBeLessThan(width / 2);
      await checkLayout();

      for (const [provider, wrong] of [
        ["openai", "sk-ant-abcdefghijklmnopqrstuvwx"],
        ["anthropic", "sk-proj-abcdefghijklmnopqrstuvwx"],
        ["deepseek", "sk-ant-abcdefghijklmnopqrstuvwx"],
      ] as const) {
        await choose(page, `key-${provider}`).click();
        const row = option(page, `key-${provider}`);
        // Only the open key row has a field.
        await expect(page.getByTestId("api-key-input")).toHaveCount(1);
        const input = row.getByTestId("api-key-input");
        const save = row
          .getByRole("button")
          .and(row.getByTestId("api-key-save"));
        await expect(input).toBeVisible();
        await expect(save).toBeDisabled();
        await input.fill(wrong);
        await expect(row.getByRole("alert")).toBeVisible();
        await expect(save).toBeDisabled();
        await input.fill(
          provider === "anthropic"
            ? "sk-ant-abcdefghijklmnopqrstuvwx"
            : "sk-abcdefghijklmnopqrstuvwx",
        );
        await expect(row.getByRole("alert")).toHaveCount(0);
        await expect(save).toBeEnabled();
        const inputBox = await input.boundingBox();
        const saveBox = await save.boundingBox();
        if (!inputBox || !saveBox) throw Error("Key field has no layout box");
        // Tallenna sits on the field's line.
        expect(Math.abs(saveBox.y - inputBox.y)).toBeLessThan(inputBox.height);
      }
      await checkLayout();

      // Back to ChatGPT: the attempt and its code are still there.
      await choose(page, "openai").click();
      await expect(page.getByTestId("pi-device-code")).toHaveText("ABCD-1234");
      await expect(page.getByTestId("pi-device-code")).toBeVisible();
    });
  }
}

test("an API key saved in its onboarding row is stored and shown by its suffix", async ({
  page,
}) => {
  await aiStep(page);
  await choose(page, "key-deepseek").click();
  const row = option(page, "key-deepseek");
  await row
    .getByTestId("api-key-input")
    .fill("sk-deepseekdeepseekdeepseekabcd");
  await row.getByRole("button").and(row.getByTestId("api-key-save")).click();
  await expect(row.getByTestId("api-key-state")).toHaveAttribute(
    "data-present",
    "true",
  );
  await expect(row.getByTestId("api-key-state")).toContainText("sk-…abcd");
  await expect(row.getByTestId("api-key-input")).toHaveValue("");
});
