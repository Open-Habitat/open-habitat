import type { Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

// Drag across the first full line of a prose paragraph in the latest reply
// that is inside the viewport, then extend the selection by keyboard.
async function selectLine(page: Page) {
  const line = await page.evaluate(() => {
    const turn = [
      ...document.querySelectorAll('[data-testid="agent-turn"]'),
    ].at(-1);
    for (const p of turn?.querySelectorAll(".ah-markdown p") ?? []) {
      const range = document.createRange();
      range.selectNodeContents(p);
      const rect = [...range.getClientRects()].find(
        (r) => r.top > 80 && r.bottom < innerHeight - 220 && r.width > 240,
      );
      if (rect) return { x: rect.left, y: rect.top + rect.height / 2 };
    }
    return null;
  });
  if (!line) throw new Error("no visible reply line");
  await page.mouse.move(line.x + 4, line.y);
  await page.mouse.down();
  await page.mouse.move(line.x + 220, line.y, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.press("Shift+ArrowRight");
  const selected = await page.evaluate(() => String(getSelection()));
  expect(selected.length).toBeGreaterThan(10);
  return selected;
}

const selection = (page: Page) => page.evaluate(() => String(getSelection()));

test("@lab a selection in a live and in a settled reply survives updates, and code labels hold still", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=pi-deltas");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  // The synthetic answer has a code block and a long paragraph that keeps
  // growing word by word for about twelve seconds.
  await page.getByTestId("message-input").fill("pitkä virta");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const turn = page.getByTestId("agent-turn").last();
  await expect(turn.locator(".ah-markdown p")).not.toHaveCount(0, {
    timeout: 20000,
  });
  await expect
    .poll(() => turn.textContent(), { timeout: 20000 })
    .toMatch(/sana5 /);
  const live = await selectLine(page);
  const words = async () =>
    ((await turn.textContent())?.match(/sana\d+/g) ?? []).length;
  const before = await words();
  await expect.poll(words, { timeout: 10000 }).toBeGreaterThan(before + 10);
  expect(await selection(page)).toBe(live);

  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="send"]')),
  ).toBeVisible({ timeout: 30000 });

  // A settled reply keeps its DOM: the selection, the code block and its
  // label stay unchanged while the pointer moves over the copy control and
  // the page keeps re-rendering around them.
  await page.evaluate(() => getSelection()?.removeAllRanges());
  const settled = await selectLine(page);
  const window_ = turn.locator(".ah-markdown-code .ah-bash-window").first();
  await window_.scrollIntoViewIfNeeded();
  await window_.evaluate((node) => {
    Object.assign(node, { ahProbe: true });
  });
  const copy = window_.getByTestId("output-copy");
  const box = await copy.boundingBox();
  if (!box) throw new Error("no copy control");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
  const label = window_.locator(".ah-output-meta");
  const read = () =>
    label.evaluate((node) => Number(getComputedStyle(node).opacity));
  const resting = await read();
  expect(resting).toBeGreaterThan(0.5);
  const samples: number[] = [];
  for (let i = 0; i < 40; i++) {
    await page.mouse.move(
      box.x + box.width / 2 + ((i % 5) - 2) * 6,
      box.y + box.height / 2 + ((i % 3) - 1) * 10,
    );
    samples.push(await read());
    await page.waitForTimeout(60);
  }
  expect(samples.every((value) => value === resting)).toBe(true);
  expect(
    await turn
      .locator(".ah-markdown-code .ah-bash-window")
      .first()
      .evaluate((node) => "ahProbe" in node),
  ).toBe(true);
  expect(await selection(page)).toBe(settled);
});
