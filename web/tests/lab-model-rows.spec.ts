import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
});

test("@a11y native settings omit startup and no-ops; real changes use display names", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  let changed = false;
  let reads = 0;
  // Native-history-shaped entries over the real isolated lab read path. This
  // proves browser presentation, not real provider behavior or UID isolation.
  await page.route("**/api/v1/agents/*/history?*", async (route) => {
    const response = await route.fetch();
    const history = await response.json();
    const setting = (entry_key: string, text: string, thinking = false) => ({
      entry_key,
      kind: thinking ? "unknown" : "model_change",
      entry_type: thinking ? "thinking_level_change" : "model_change",
      content: { media_type: "text/plain", text, complete: true },
    });
    history.entries = [
      setting("model-start", "claude-bridge/claude-opus-5-5"),
      setting("thinking-start", "medium", true),
      ...history.entries.filter(
        (entry: { kind: string; entry_type?: string }) =>
          entry.kind !== "model_change" &&
          entry.entry_type !== "thinking_level_change",
      ),
      setting("model-noop", "claude-bridge/claude-opus-5-5"),
      setting("thinking-noop", "medium", true),
      ...(changed
        ? [
            setting("model-real", "claude-bridge/claude-fable-5-1"),
            setting("model-repeat", "claude-bridge/claude-fable-5-1"),
            setting("thinking-real", "high", true),
            setting("thinking-repeat", "high", true),
          ]
        : []),
    ];
    reads++;
    await route.fulfill({ response, json: history });
  });
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").fill("Synthetic metadata regression");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(
    page.getByTestId("agent-turn").last().getByTestId("history-stage-toggle"),
  ).toBeVisible({ timeout: 20000 });
  const before = reads;
  await page.reload();
  await expect.poll(() => reads).toBeGreaterThan(before);
  await expect(page.getByTestId("message-input")).toBeVisible();
  await expect(page.getByTestId("session-settings-row")).toHaveCount(0);
  changed = true;
  await page.reload();
  await expect(page.getByTestId("model-change")).toHaveCount(1);
  await expect(page.getByTestId("thinking-change")).toHaveCount(1);
  // Display names and absence of native ids are the contract, not UI wording.
  await expect(page.getByTestId("model-change")).toContainText(
    "Opus 5.5 → Fable 5.1",
  );
  await expect(page.getByTestId("session-settings-row")).toHaveCount(2);
  await expect(page.getByTestId("model-change")).not.toContainText("claude-");
  for (const width of [1440, 390]) {
    for (const theme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.getByTestId("model-change")).toBeVisible();
      expect(
        (await new AxeBuilder({ page }).include("main").analyze()).violations,
      ).toEqual([]);
      await snapshot(page, info.outputPath(`model-rows-${width}-${theme}`), {
        labOrigin: new URL(page.url()).origin,
      });
    }
  }
});
