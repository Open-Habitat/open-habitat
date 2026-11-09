// Synthetic lab only: evidence for issues/model-details-described. The
// header's model card (facts with descriptions), the composer's model picker
// and Settings › Tekoäly's default model, at 1440 and 390, light and dark,
// Finnish and English, device scale 2. Start the lab first
// (scripts/lab.sh start), then from the repository root:
//   node web/lab/capture-model-details.mjs
import { chromium } from "@playwright/test";
import { origin } from "./session.mjs";

const out = new URL(
  "../../issues/model-details-described/evidence/",
  import.meta.url,
).pathname;
const OPUS = "claude-bridge/claude-opus-5-5";
const models = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5" },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5" },
  { id: "claude-fable-5-1", name: "Claude Fable 5.1 1M" },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5" },
  { id: "claude-opus-5", name: "Claude Opus 5", older: true },
].map((m) => ({
  ...m,
  provider: "claude-bridge",
  thinking_levels: ["off", "low", "medium", "high", "xhigh"],
}));
const browser = await chromium.launch({ headless: true });

async function open(width, theme, language) {
  const phone = width <= 800;
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width, height: phone ? 844 : 900 },
    deviceScaleFactor: 2,
    isMobile: phone,
    hasTouch: phone,
    colorScheme: theme,
    locale: language === "fi" ? "fi-FI" : "en-US",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.route("**/api/v1/pi/models", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: {
            schema_version: 1,
            default_provider: "claude-bridge",
            default_model: "claude-sonnet-5-5",
            default_thinking: "high",
            models,
          },
        })
      : route.continue(),
  );
  await page.route("**/api/v1/pi/claude-login", (route) =>
    route.fulfill({ json: { schema_version: 1, state: "completed" } }),
  );
  // The lab's native history names its own model; the card reads Opus 5.5
  // at Medium, as in the prototype round.
  await page.route("**/api/v1/agents/*/history?*", async (route) => {
    const response = await route.fetch();
    const history = await response.json();
    const extra = [];
    for (const entry of history.entries) {
      if (entry.kind === "model_change") {
        entry.content.text = OPUS;
        extra.push({
          ...entry,
          entry_key: `${entry.entry_key}-thinking`,
          kind: "unknown",
          entry_type: "thinking_level_change",
          content: { ...entry.content, text: "medium" },
        });
      }
      if (entry.kind === "assistant") entry.model = OPUS;
    }
    history.entries.unshift(...extra);
    await route.fulfill({ response, json: history });
  });
  await page.goto(`${origin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.waitForURL(/\/workspaces/);
  return { context, page, phone };
}

const name = (language, what, width, theme) =>
  `${out}${language}-${what}-${width}-${theme}.png`;

for (const language of ["fi", "en"]) {
  for (const theme of ["light", "dark"]) {
    for (const width of [1440, 390]) {
      const { context, page, phone } = await open(width, theme, language);
      await page.request.get(`${origin}/fixture/conversations-reset`);
      const state = await (
        await page.request.get(`${origin}/api/v1/snapshot`)
      ).json();
      const ws = state.workspaces.find(
        (w) => w.name === "aurinkokello",
      ).workspace_id;
      await page.goto(`${origin}/workspaces/${ws}`);
      await page.getByTestId("conversation-start").first().click();
      await page.getByTestId("start-here").waitFor();
      // The composer's picker, where the model is chosen.
      const trigger = page.getByTestId("composer-model-picker");
      await trigger.click();
      const menu = page.getByTestId("composer-model-menu");
      await menu.getByTestId("model-claude-opus-5-5").click();
      await menu.getByTestId("segment-medium").click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: name(language, "valitsin", width, theme) });
      await menu.getByTestId("model-commit").click();
      await page.getByTestId("message-input").fill("Synthetic model details");
      await page
        .getByTestId("send")
        .and(page.locator('[data-mode="send"]'))
        .click();
      await page
        .getByTestId("agent-turn")
        .last()
        .getByTestId("history-stage-toggle")
        .waitFor({ timeout: 20000 });
      await page.reload();
      await page.waitForTimeout(800);
      // The header's card: information, not a picker.
      if (phone) {
        await page.getByTestId("phone-header-facts").click();
        await page
          .getByRole("menuitem")
          .and(page.getByTestId("menu-fact-model"))
          .click();
      } else await page.locator(".md-chip-picker > summary").click();
      await page.getByTestId("conversation-model-info").waitFor();
      await page.waitForTimeout(300);
      await page.screenshot({ path: name(language, "tiedot", width, theme) });
      await page.keyboard.press("Escape");
      // Settings › Tekoäly › Oletusmalli chooses with the same words.
      await page.goto(`${origin}/settings/ai`);
      await page.getByTestId("default-model-trigger").click();
      await page.getByTestId("model-claude-sonnet-5-5").waitFor();
      await page.waitForTimeout(300);
      await page.screenshot({ path: name(language, "asetus", width, theme) });
      await context.close();
    }
  }
}
await browser.close();
console.log(`evidence in ${out}`);
