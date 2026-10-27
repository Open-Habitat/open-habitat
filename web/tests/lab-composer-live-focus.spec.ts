import type { Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// A person keeps typing the next message while the agent's turn runs: the
// interim reply, its tool row and the final reply arrive under the composer
// and must not take the focus or the caret from it. Each of them also makes
// the page refresh its snapshot, and a refresh can fail on a busy host; the
// failed one marked the view stale, which focused the workspace heading.
test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

async function openNewConversation(page: Page, phone: boolean) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  if (phone) await page.getByTestId("navigation-open").click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
])
  test(`@lab typing keeps the composer focus through a live turn (${viewport.name})`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize(viewport);
    await page.request.get("/fixture/conversations-reset");
    expect(
      (await page.request.get("/fixture/scenario?value=pi-deltas")).status(),
    ).toBe(204);
    try {
      await openNewConversation(page, viewport.width < 600);
      const editor = page.getByTestId("message-input");
      // "hidas" spaces fake Pi's phases two seconds apart.
      await editor.fill("hidas vaiheittainen vuoro");
      await page
        .getByTestId("send")
        .and(page.locator('[data-mode="send"]'))
        .click();
      await expect(editor).toHaveValue("");
      // Fail the snapshot refresh that the interim reply brings.
      let failNext = false;
      let failed = 0;
      await page.route("**/api/v1/snapshot*", async (route) => {
        if (!failNext) return route.continue();
        failNext = false;
        failed++;
        await route.fulfill({ status: 503, body: "synthetic failure" });
      });
      await editor.focus();
      // Record every focus departure from the field, with where it went.
      await page.evaluate(() => {
        const losses: string[] = [];
        document.addEventListener(
          "focusout",
          (event) => {
            const from = event.target as Element | null;
            if (from?.getAttribute("data-testid") !== "message-input") return;
            const to = event.relatedTarget as Element | null;
            losses.push(
              to
                ? `${to.tagName.toLowerCase()}${to.getAttribute("data-testid") ? `[${to.getAttribute("data-testid")}]` : ""}.${[...to.classList].join(".")}`
                : "(none)",
            );
          },
          true,
        );
        Object.assign(window, { composerFocusLosses: losses });
      });
      const turn = page.getByTestId("agent-turn").last();
      const finalReply = turn
        .getByTestId("message")
        .and(page.locator('[data-reply-complete="true"]'));
      let typed = "";
      const word = "kirjoitan seuraavaa viestiä ";
      let sawInterim = false;
      let sawTool = false;
      // Type one character at a time until the final reply has settled,
      // as a person would while reading along.
      for (let i = 0; i < 600; i++) {
        const key = word[i % word.length];
        await page.keyboard.type(key);
        typed += key;
        if (!sawInterim) {
          sawInterim =
            (await turn
              .locator('[data-reply-role="interim"], [data-interim="true"]')
              .count()) > 0;
          failNext = sawInterim;
        }
        if (!sawTool)
          sawTool =
            (await turn.locator("[data-tool-name], .ah-turn-strip").count()) >
            0;
        if (i > 20 && (await finalReply.count()) > 0) break;
        await page.waitForTimeout(40);
      }
      await expect(finalReply).toBeVisible({ timeout: 20000 });
      // Keep typing a little after the turn settles: completion re-renders too.
      for (const key of "loppu") {
        await page.keyboard.type(key);
        typed += key;
        await page.waitForTimeout(60);
      }
      const losses = await page.evaluate(
        () =>
          (window as typeof window & { composerFocusLosses: string[] })
            .composerFocusLosses,
      );
      expect(losses).toEqual([]);
      await expect(editor).toBeFocused();
      await expect(editor).toHaveValue(typed);
      expect(
        await editor.evaluate(
          (node: HTMLTextAreaElement) =>
            node.selectionStart === node.value.length &&
            node.selectionEnd === node.value.length,
        ),
      ).toBe(true);
      expect(sawInterim).toBe(true);
      expect(sawTool).toBe(true);
      expect(failed).toBe(1);
    } finally {
      await page.request.get("/fixture/scenario?value=ready");
    }
  });
