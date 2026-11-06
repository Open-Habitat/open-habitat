import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { expect, test } from "./lab-host";

test.use({
  reducedMotion: "reduce",
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});

for (const width of [390, 360]) {
  test(`@a11y phone header keeps one compact block and opens its facts at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    // Give the lab's synthetic model a catalogue name, as on desktop.
    await page.route("**/api/v1/pi/models", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({
        response,
        json: {
          ...body,
          models: [
            ...body.models,
            { ...body.models[0], id: "fake-pi", name: "Claude Opus 5.5" },
          ],
        },
      });
    });
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    const state = await (await page.request.get("/api/v1/snapshot")).json();
    const workspace = state.workspaces.find(
      (w: { name: string }) => w.name === "aurinkokello",
    );
    await page.goto(`/workspaces/${workspace.workspace_id}`);
    await page
      .getByTestId(/^(new-conversation|conversation-start)$/)
      .first()
      .click();
    const header = page.locator(".ah-conversation-frame > .ah-agent-header");
    const facts = header.getByTestId("phone-header-facts");
    await expect(facts).toBeInViewport({ ratio: 1 });
    await expect(facts.locator(".ah-phone-model")).toHaveCount(0);
    await expect(page.locator(".md-empty-picker")).toBeVisible();
    const capture = async (name: string) => {
      if (!process.env.OH_HEADER_CAPTURE) return;
      for (const colorScheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme });
        await snapshot(
          page,
          resolve(
            process.env.OH_HEADER_CAPTURE,
            `${name}-${width}-${colorScheme}`,
          ),
          { labOrigin: new URL(page.url()).origin },
        );
      }
    };
    await capture("new");
    // Disabled tooltip wrappers must not leak the old H/update button.
    await expect(header.getByTestId("conversation-retitle")).toBeHidden();
    await page.getByTestId("message-input").fill("puhelimen yläpalkki");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await expect(facts.locator(".ah-ctx-ring")).toBeVisible();
    await expect(facts.locator(".ah-phone-model")).toBeVisible();
    for (const id of [
      "workspace-title",
      "phone-header-facts",
      "conversation-menu",
    ])
      await expect(header.getByTestId(id)).toBeInViewport({ ratio: 1 });
    for (const id of [
      "git-chip",
      "context-ring",
      "conversation-model",
      "toggle-editor",
      "toggle-terminal",
      "conversation-retitle",
      "conversation-recap",
    ])
      await expect(header.getByTestId(id)).toBeHidden();
    expect((await header.boundingBox())?.height).toBeLessThanOrEqual(64);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await capture("running");

    await facts.click();
    for (const id of ["workspace", "git", "context", "model"])
      await expect(page.getByTestId(`menu-fact-${id}`)).toBeVisible();
    await capture("facts");
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      expect(
        (
          await new AxeBuilder({ page })
            .include(".ah-agent-header")
            .include(".ah-popover")
            .analyze()
        ).violations,
      ).toEqual([]);
    }
    await page.keyboard.press("Escape");
    await expect(facts).toBeFocused();
    await facts.tap();
    await facts.tap();
    await expect(page.getByTestId("menu-fact-git")).toBeHidden();
    await facts.click();
    await page
      .getByTestId("conversation-stream")
      .click({ position: { x: 10, y: 400 } });
    await expect(page.getByTestId("menu-fact-git")).toBeHidden();

    await facts.click();
    await page.getByTestId("menu-fact-git").click();
    await expect(page.getByTestId("git-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(facts).toBeFocused();
    await facts.click();
    await page.getByTestId("menu-fact-context").click();
    await expect(page.getByTestId("context-page")).toBeVisible();
    await page.getByTestId("context-back").click();
    await expect(facts).toBeFocused();
    await facts.click();
    await page.getByTestId("menu-fact-model").click();
    await expect(header.locator(".md-chip-picker")).toHaveAttribute("open", "");
    await expect(header.locator(".md-pop")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(header.locator(".md-pop")).toBeHidden();
    await expect(facts).toBeFocused();

    await header.getByTestId("conversation-menu").click();
    for (const id of [
      "workspace",
      "toggle-editor",
      "toggle-terminal",
      "recap",
      "retitle",
      "archive",
      "details",
    ])
      await expect(page.getByTestId(`menu-${id}`)).toBeVisible();
    await page.getByTestId("menu-toggle-terminal").click();
    await expect(page.getByTestId("terminal-panel")).toBeVisible();
    await page.getByTestId("terminal-back").click();
    await header.getByTestId("conversation-menu").click();
    await page.getByTestId("menu-details").click();
    await expect(page.locator(".ah-details-popover")).toBeInViewport();
    await expect(header.getByTestId("conversation-menu")).toBeFocused();
    await facts.click();
    await page.getByTestId("menu-fact-workspace").click();
    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${workspace.workspace_id}$`),
    );
  });
}
