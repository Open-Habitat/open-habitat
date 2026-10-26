import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
});

test("@a11y new conversation picker fits, dismisses without saving, and commits only the explicit choice", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const models = [
    { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
    { id: "claude-opus-5-5", name: "Claude Opus 5.5" },
    { id: "claude-fable-5-1", name: "Claude Fable 5.1 1M" },
    { id: "claude-sonnet-5", name: "Claude Sonnet 5" },
    { id: "claude-opus-4-1", name: "Claude Opus 4.1", older: true },
  ].map((m) => ({
    ...m,
    provider: "claude-bridge",
    thinking_levels: ["off", "low", "medium", "high"],
  }));
  let writes = 0;
  await page.route("**/api/v1/pi/models", (route) => {
    if (route.request().method() !== "GET") writes++;
    return route.fulfill({
      json: {
        schema_version: 1,
        default_provider: "claude-bridge",
        default_model: "claude-opus-5-5",
        default_thinking: "medium",
        models,
      },
    });
  });
  await page.route("**/api/v1/pi/claude-login", (route) =>
    route.fulfill({ json: { schema_version: 1, state: "completed" } }),
  );
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const trigger = page.getByTestId("composer-model-picker");
  const menu = page.getByTestId("composer-model-menu");
  // A new native session may not report its model yet. Make a local choice
  // so the comparison exercises formatted model and thinking names too.
  await trigger.click();
  await menu.getByTestId("model-claude-opus-5-5").click();
  await menu.getByTestId("segment-medium").click();
  await menu.getByTestId("model-commit").click();
  await expect(trigger).toHaveAttribute(
    "data-model",
    "claude-bridge/claude-opus-5-5",
  );
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 768 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (value) => document.documentElement.setAttribute("data-theme", value),
        theme,
      );
      // Both locations must render the same readout, not a raw thinking id
      // in the composer or a different icon/surface on one trigger.
      const headerChip = page.locator(".ah-agent-header .ah-set-chip");
      await expect(headerChip).toHaveAttribute(
        "data-model",
        (await trigger.getAttribute("data-model")) ?? "",
      );
      await expect(headerChip).toHaveAttribute(
        "data-thinking",
        (await trigger.getAttribute("data-thinking")) ?? "",
      );
      expect(await trigger.innerText()).toBe(await headerChip.innerText());
      const appearance = (element: Element) => {
        const style = getComputedStyle(element);
        return [
          style.backgroundColor,
          style.color,
          style.borderRadius,
          style.fontSize,
          style.fontWeight,
          style.height,
          style.width,
        ];
      };
      expect(await trigger.evaluate(appearance)).toEqual(
        await headerChip.evaluate(appearance),
      );
      await snapshot(page, info.outputPath(`chips-${width}-${theme}`), {
        labOrigin: new URL(page.url()).origin,
      });
      await trigger.click();
      await expect(menu).toBeVisible();
      await expect(menu.getByTestId("model-claude-opus-5-5")).toBeEnabled();
      expect(
        await menu
          .getByRole("radio")
          .evaluateAll((nodes) =>
            nodes.map((n) => n.getAttribute("data-testid")),
          ),
      ).toEqual([
        "model-claude-fable-5-1",
        "model-claude-opus-5-5",
        "model-claude-sonnet-5",
        "model-claude-haiku-4-5",
      ]);
      const geometry = await menu.evaluate((element) => {
        const r = element.getBoundingClientRect();
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          scroll: element.scrollHeight > element.clientHeight,
          horizontalScroll: element.scrollWidth > element.clientWidth,
        };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(width);
      expect(geometry.top).toBeGreaterThanOrEqual(0);
      expect(geometry.bottom).toBeLessThanOrEqual(768);
      expect(geometry.scroll).toBe(false);
      expect(geometry.horizontalScroll).toBe(false);
      const commit = menu.getByTestId("model-commit");
      await expect(commit).toBeEnabled();
      // A merely nontransparent secondary surface also passed the old
      // regression. Require the actual primary tokens, before any hover.
      await page.mouse.move(2, 2);
      expect(
        await commit.evaluate((button) => {
          const probe = document.createElement("span");
          probe.style.background = "var(--ah-accent)";
          probe.style.color = "var(--ah-on-accent)";
          button.append(probe);
          const expected = getComputedStyle(probe);
          const actual = getComputedStyle(button);
          const primary =
            actual.backgroundColor === expected.backgroundColor &&
            actual.color === expected.color;
          probe.remove();
          return primary;
        }),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).include(".md-empty-picker").analyze())
          .violations,
      ).toEqual([]);
      await snapshot(page, info.outputPath(`picker-${width}-${theme}`), {
        labOrigin: new URL(page.url()).origin,
      });
      // On phones the sheet covers the input; the top viewport corner is
      // outside the panel in both layouts. Use a real pointer, not force-click.
      await page.mouse.click(2, 2);
      await expect(menu).not.toBeVisible();
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(menu).toBeVisible();
      await menu.getByTestId("model-claude-fable-5-1").click();
      await expect(menu).toBeVisible();
      await menu.getByTestId("segment-high").click();
      await page.keyboard.press("Escape");
      await expect(menu).not.toBeVisible();
      await expect(trigger).toBeFocused();
    }
  }
  expect(writes).toBe(0);
  await trigger.click();
  await menu.getByTestId("older-models-toggle").click();
  await expect(menu.getByTestId("model-claude-opus-4-1")).toBeVisible();
  await menu.getByTestId("model-claude-fable-5-1").click();
  await menu.getByTestId("model-commit").click();
  await expect(menu).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute(
    "data-model",
    "claude-bridge/claude-fable-5-1",
  );
  expect(writes).toBe(0);
  await trigger.click();
  await menu.getByTestId("model-default-settings").click();
  await expect(page).toHaveURL(/\/settings\/ai#default-model$/);
});
