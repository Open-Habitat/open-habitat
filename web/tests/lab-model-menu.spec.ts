import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
});

test("@a11y model metadata names and capability order agree with the header at desktop and phone sizes", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const models = [
    { id: "claude-opus-5-5", name: "Claude Opus 5.5" },
    { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
    { id: "claude-fable-5-1", name: "Claude Fable 5.1 1M" },
    { id: "claude-sonnet-5", name: "Claude Sonnet 5" },
  ].map((m) => ({
    ...m,
    provider: "claude-bridge",
    thinking_levels: ["off", "low", "medium", "high"],
  }));
  // Presentation seams only: the isolated lab still supplies native histories,
  // routing and authentication. No claim about live provider availability.
  await page.route("**/api/v1/pi/models", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        default_provider: "claude-bridge",
        default_model: "claude-opus-5-5",
        models,
      },
    }),
  );
  await page.route("**/api/v1/agents/*/history?*", async (route) => {
    const response = await route.fetch();
    const history = await response.json();
    for (const entry of history.entries) {
      if (entry.kind === "model_change")
        entry.content.text = "claude-bridge/claude-opus-5-5";
      if (entry.kind === "assistant")
        entry.model = "claude-bridge/claude-opus-5-5";
    }
    await route.fulfill({ response, json: history });
  });
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
    .fill("Synthetic model presentation check");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(
    page.getByTestId("agent-turn").last().getByTestId("history-stage-toggle"),
  ).toBeVisible({ timeout: 20000 });
  await page.reload();
  const chip = page.locator(".md-chip-picker > summary");
  await expect(chip).toHaveAttribute(
    "data-model",
    "claude-bridge/claude-opus-5-5",
  );
  // Model display names are the feature's contract, not translated UI copy.
  await expect(chip).toContainText("Opus 5.5");
  await chip.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByTestId("conversation-model-info");
  await expect(menu).toBeVisible();
  // The card is facts, not a picker: the conversation's model first, the
  // same sign-in's other models after it in capability order, each known
  // model with its description.
  await expect(menu.locator("button, input, select")).toHaveCount(0);
  await expect(menu.getByTestId("model-current")).toHaveAttribute(
    "data-model",
    "claude-opus-5-5",
  );
  await expect(
    menu.getByTestId("model-current").getByTestId("model-description"),
  ).toHaveCount(1);
  const rows = menu.getByTestId("model-options").locator("li");
  await expect(rows).toHaveText([/^Fable 5\.1/, /^Sonnet 5/, /^Haiku 4\.5/]);
  await expect(rows.getByTestId("model-description")).toHaveCount(3);
  await expect(menu.getByTestId("thinking-options")).toHaveAttribute(
    "data-levels",
    "off low medium high",
  );
  const check = async (width: number) => {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (value) => document.documentElement.setAttribute("data-theme", value),
        theme,
      );
      const bounds = await rows.evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right };
        }),
      );
      expect(
        bounds.every(
          (r, i) =>
            r.x >= 0 && r.right <= width && (i === 0 || r.y > bounds[i - 1].y),
        ),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).include(".md-chip-picker").analyze())
          .violations,
      ).toEqual([]);
      await snapshot(page, info.outputPath(`menu-${width}-${theme}`), {
        labOrigin: new URL(page.url()).origin,
      });
    }
  };
  await check(1440);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(chip).toBeFocused();
  // On a phone the model is on the facts line (Alarivi, Jari 6.11.2026); its
  // row in the facts menu opens the same card, and Esc returns to the line.
  await page.setViewportSize({ width: 390, height: 900 });
  const facts = page.getByTestId("phone-header-facts");
  await expect(facts.locator(".ah-phone-model")).toContainText("Opus 5.5");
  await facts.click();
  await page
    .getByRole("menuitem")
    .and(page.getByTestId("menu-fact-model"))
    .click();
  await expect(menu).toBeVisible();
  await check(390);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(facts).toBeFocused();
});
