import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 1000 },
  reducedMotion: "reduce",
});

test("a saved long opening reply survives an exhausted preview budget and two tools", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").fill("virhekortti");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.locator('[data-reply-role="final"]')).toHaveCount(1, {
    timeout: 30_000,
  });

  // Reproduce the native projection: thinking spends the 16 KiB preview
  // budget, so the following text has no preview but remains readable.
  // Keep the host-backed turn's two calls, results and final reply intact.
  const opening = Array.from(
    { length: 4 },
    (_, i) =>
      `Section ${i + 1}. This is the summary and the instructions for the person. Review the changes, compare the results, and keep the original files until verification is complete.`,
  ).join("\n\n");
  let entryKey = "";
  let revision = "";
  let agentId = "";
  let blockIndex = -1;
  await page.route("**/api/v1/agents/*/history*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const entry = body.entries.find(
      (e: { kind: string; blocks?: { type: string }[] }) =>
        e.kind === "assistant" && e.blocks?.some((b) => b.type === "text"),
    );
    entryKey = entry.entry_key;
    revision = entry.native_revision ?? body.native_revision;
    agentId = body.agent_id;
    entry.blocks.unshift({
      type: "thinking",
      text: "Synthetic private reasoning. ".repeat(700).slice(0, 16384),
    });
    blockIndex = entry.blocks.findIndex(
      (b: { type: string }) => b.type === "text",
    );
    entry.blocks[blockIndex] = { type: "text", text: "", readable: true };
    entry.truncated_blocks = true;
    await route.fulfill({ response, json: body });
  });
  await page.route("**/api/v1/agents/*/entries/*/blocks/*?*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.endsWith(`/entries/${entryKey}/blocks/${blockIndex}`))
      return route.continue();
    await route.fulfill({
      json: {
        schema_version: 1,
        agent_id: agentId,
        native_revision: revision,
        entry_key: entryKey,
        block_index: blockIndex,
        offset: 0,
        chunk: { media_type: "text/plain", text: opening, complete: true },
      },
    });
  });
  await page.reload();
  const interim = page.locator('[data-reply-role="interim"]');
  await expect(interim).toHaveCount(1);
  await expect(interim).toContainText("Section 1.");
  await expect(interim).toContainText("Section 4.");
  await expect(interim).toBeVisible();
  await expect(page.locator('[data-reply-role="final"]')).toHaveCount(1);
  await expect(page.locator('[data-tool-count="2"]')).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.locator(".ah-turn-work")).toHaveCount(0);
  await interim.scrollIntoViewIfNeeded();
  await snapshot(page, testInfo.outputPath("long-opening-reply"), {
    labOrigin: new URL(page.url()).origin,
  });
});
