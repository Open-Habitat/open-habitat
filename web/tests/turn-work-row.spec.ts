import type { Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 860 },
});

async function send(page: Page, prompt: string) {
  await page.getByTestId("message-input").fill(prompt);
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
}

// A turn's summary row and work share the rail with its replies (Jari
// 29.10.2026): the hover ends on the content's right edge, every work node
// sits on the rail, and the row keeps the same space to a message of the
// person as to the agent's replies.
test("@turn-work-row summary row and work nodes line up with the turn", async ({
  page,
}) => {
  test.setTimeout(90_000);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  // A failed read and a successful bash in the first turn.
  await send(page, "virhekortti");
  const toggles = page.getByTestId("history-stage-toggle");
  await expect(toggles).toHaveCount(1, { timeout: 30000 });
  await send(page, "toinen");
  await expect(toggles).toHaveCount(2, { timeout: 30000 });
  // Real Pi often starts a turn with a tool and may stop it after one: the
  // synthetic Pi always writes an interim reply first and a final one last,
  // so drop the second turn's interim reply and the first turn's final one.
  // The summary rows then also sit right below and above the person's own
  // messages.
  await page.route("**/api/v1/agents/*/history*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const entries: {
      kind: string;
      blocks?: { type: string; text?: string }[];
    }[] = body.entries ?? [];
    const users = entries.flatMap((e, i) => (e.kind === "user" ? [i] : []));
    body.entries = entries.filter((entry, i) => {
      if (entry.kind !== "assistant" || !entry.blocks) return true;
      if (i > users[1])
        entry.blocks = entry.blocks.filter(
          (b) => !(b.type === "text" && b.text?.startsWith("Katson ensin")),
        );
      // The first turn's last assistant entry is its final reply.
      const last = entries.findLastIndex(
        (e, j) => j < users[1] && e.kind === "assistant",
      );
      return i !== last;
    });
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await expect(toggles).toHaveCount(2, { timeout: 30000 });
  await toggles.first().click();
  await expect(toggles.first()).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByTestId("tool-row").and(page.locator('[data-state="failed"]')),
  ).toBeVisible();

  const geometry = await page.evaluate(() => {
    const box = (e: Element | null) => e?.getBoundingClientRect();
    return [...document.querySelectorAll(".ah-agent-turn")].map((turn) => {
      const rail = getComputedStyle(turn, "::before");
      const railCentre =
        turn.getBoundingClientRect().left +
        Number.parseFloat(rail.left) +
        Number.parseFloat(rail.width) / 2;
      const nodes = [
        ...turn.querySelectorAll(".ah-turn-work .ah-ordered-blocks > *"),
      ].map((block) => {
        const node = getComputedStyle(block, "::before");
        return (
          block.getBoundingClientRect().left +
          Number.parseFloat(node.left) +
          Number.parseFloat(node.width) / 2 -
          railCentre
        );
      });
      const row = box(turn.querySelector(".ah-turn-stage > button"));
      const li = turn.closest("li");
      const previous = box(
        li?.previousElementSibling?.querySelector(".ah-message") ?? null,
      );
      const next = box(
        li?.nextElementSibling?.querySelector(".ah-message") ?? null,
      );
      const stage = turn.querySelector(".ah-turn-stage");
      const before = box(
        stage?.previousElementSibling?.querySelector(".ah-message") ?? null,
      );
      const after = box(
        stage?.nextElementSibling?.matches(".ah-turn-work")
          ? stage.nextElementSibling
          : (stage?.nextElementSibling?.querySelector(".ah-message") ?? null),
      );
      const reply = box(turn.querySelector(".ah-turn-reply .ah-message"));
      const above = before ?? previous;
      const below = after ?? next;
      return {
        nodes,
        rowRight: row?.right,
        replyRight: reply?.right,
        // Space above and below the summary row, to whatever is there.
        above: row && above ? row.top - above.bottom : undefined,
        below: row && below ? below.top - row.bottom : undefined,
        turnGap: Number.parseFloat(getComputedStyle(turn).rowGap),
      };
    });
  });
  const [first, second] = geometry;
  // Both work nodes (a failed and a successful tool) are on the rail.
  expect(first.nodes.length).toBeGreaterThanOrEqual(2);
  for (const offset of first.nodes) expect(Math.abs(offset)).toBeLessThan(0.5);
  for (const turn of geometry) {
    expect(
      Math.abs((turn.rowRight ?? 0) - (turn.replyRight ?? 0)),
    ).toBeLessThan(0.5);
    // The first turn's row sits between its interim reply and the open work,
    // then (closed) above the person's next message; the second's sits below
    // the person's message and above its reply.
    for (const gap of [turn.above, turn.below])
      expect(Math.abs((gap ?? Number.NaN) - turn.turnGap)).toBeLessThan(0.5);
  }
  await toggles.first().click();
  const closedBelow = await toggles.first().evaluate((button) => {
    const next = button
      .closest("li")
      ?.nextElementSibling?.querySelector(".ah-message");
    return (
      (next?.getBoundingClientRect().top ?? Number.NaN) -
      button.getBoundingClientRect().bottom
    );
  });
  expect(Math.abs(closedBelow - first.turnGap)).toBeLessThan(0.5);
  expect(second.nodes).toEqual([]);
});
