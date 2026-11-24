import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./lab-host";

// The offer card's title is text to select and copy, without aiming
// (offer-card-title-copy). The rest of the card still opens the item.

test.use({ reducedMotion: "reduce" });

async function offers(page: Page) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const state = await (await page.request.get("/api/v1/snapshot")).json();
  const workspace = state.workspaces.find(
    (w: { name: string }) => w.name === "aurinkokello",
  );
  await page.goto(`/workspaces/${workspace.workspace_id}`);
  await page
    .getByTestId(/^(new-conversation|conversation-start)$/)
    .first()
    .click();
  await expect(page).toHaveURL(/conversation=pi:/);
  const target = new URL(page.url()).searchParams.get("conversation") ?? "";
  const response = await page.request.get(
    `/fixture/files?target=${encodeURIComponent(target)}&set=types`,
  );
  expect(response.ok()).toBe(true);
  const { offer_ids: ids } = (await response.json()) as { offer_ids: string[] };
  const card = (i: number) =>
    page.locator(`[data-testid="file-offer"][data-offer-id="${ids[i]}"]`);
  await expect(card(3)).toHaveAttribute("data-state", "ready");
  await card(3).scrollIntoViewIfNeeded();
  // The drags below use coordinates, so wait until thumbnails and the
  // stream's own scrolling stop moving the card.
  let last = "";
  await expect
    .poll(async () => {
      const now = JSON.stringify(await card(3).boundingBox());
      const still = now === last;
      last = now;
      return still;
    })
    .toBe(true);
  return card;
}

// Not a click elsewhere: a press inside a still-selected title would start
// dragging the selected text instead of a new selection.
const clearSelection = (page: Page) =>
  page.evaluate(() => document.getSelection()?.removeAllRanges());

const selected = (page: Page) =>
  page.evaluate(() => document.getSelection()?.toString() ?? "");

/** The rectangles of the title's text, one per line fragment. */
const titleLines = (card: Locator) =>
  card.getByTestId("offer-title").evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return [...range.getClientRects()]
      .filter((r) => r.width > 0)
      .map(({ left, right, top, bottom }) => ({ left, right, top, bottom }));
  });

async function firstGlyph(card: Locator) {
  const [line] = await titleLines(card);
  return { x: line.left + 1, y: (line.top + line.bottom) / 2 };
}

test("a drag that overshoots the title selects exactly the title", async ({
  page,
}) => {
  const card = await offers(page);
  const csv = card(3);
  const title = (await csv.getByTestId("offer-title").textContent()) ?? "";
  expect(title.length).toBeGreaterThan(0);
  const box = await csv.boundingBox();
  if (!box) throw new Error("card has no box");
  const start = await firstGlyph(csv);

  // Past the card's right edge, where the card's press would have taken the
  // selection back to the icon.
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 4, start.y, { steps: 6 });
  await page.mouse.move(box.x + box.width + 40, start.y, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => selected(page)).toBe(title);

  // Down over the facts line and into the next card.
  await clearSelection(page);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 30, box.y + box.height + 30, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => selected(page)).toBe(title);

  // A drag backwards past the icon selects to the title's start. The drag
  // down may have scrolled the conversation, so measure again.
  await clearSelection(page);
  await csv.scrollIntoViewIfNeeded();
  const lines = await titleLines(csv);
  const last = lines[lines.length - 1];
  const left = ((await csv.boundingBox())?.x ?? 0) - 20;
  await page.mouse.move(last.right - 3, (last.top + last.bottom) / 2);
  await page.mouse.down();
  await page.mouse.move(left, lines[0].top + 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => selected(page)).toBe(title);

  // None of these drags opened the card.
  await page.evaluate(() => new Promise((r) => setTimeout(r, 450)));
  await expect(csv.getByTestId("offer-open")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("a triple-click selects the title and copying gives it plain", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const card = await offers(page);
  const csv = card(3);
  const title = (await csv.getByTestId("offer-title").textContent()) ?? "";
  const at = await firstGlyph(csv);
  await page.mouse.click(at.x + 4, at.y, { clickCount: 3 });
  await expect.poll(() => selected(page)).toBe(title);
  await page.keyboard.press("ControlOrMeta+c");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(title);

  // A double-click selects a word and leaves the card closed.
  await clearSelection(page);
  await page.mouse.dblclick(at.x + 4, at.y);
  expect((await selected(page)).length).toBeGreaterThan(0);
  await page.evaluate(() => new Promise((r) => setTimeout(r, 450)));
  await expect(csv.getByTestId("offer-open")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("a click on the title that selects nothing opens the card", async ({
  page,
}) => {
  const card = await offers(page);
  const csv = card(3);
  const at = await firstGlyph(csv);
  await page.mouse.click(at.x + 4, at.y);
  await expect(csv.getByTestId("offer-open")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(await selected(page)).toBe("");
  // The same click closes it again, as the rest of the card does. The open
  // card's panel narrows the conversation, which reflows and moves the title;
  // a click at the first point lands on the panel once that layout has come.
  // Aim again where the title has settled.
  const title = csv.getByTestId("offer-title");
  await title.scrollIntoViewIfNeeded();
  let again = await firstGlyph(csv);
  await expect
    .poll(async () => {
      const now = await firstGlyph(csv);
      const still = now.x === again.x && now.y === again.y;
      again = now;
      return still;
    })
    .toBe(true);
  await page.mouse.click(again.x + 4, again.y);
  await expect(csv.getByTestId("offer-open")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("the floating icons leave a long title's lines uncovered", async ({
  page,
}) => {
  const card = await offers(page);
  const csv = card(3);
  // Narrow enough that the file name wraps and runs into the corner.
  await csv.evaluate((el) => {
    el.style.width = "190px";
  });
  await csv.hover();
  const acts = csv.locator(".ah-offer-acts");
  await expect(acts).toBeVisible();
  const a = await acts.boundingBox();
  if (!a) throw new Error("icons have no box");
  const lines = await titleLines(csv);
  expect(lines.length).toBeGreaterThan(1);
  for (const l of lines) {
    const overlapX = Math.min(l.right, a.x + a.width) - Math.max(l.left, a.x);
    const overlapY = Math.min(l.bottom, a.y + a.height) - Math.max(l.top, a.y);
    expect(Math.min(overlapX, overlapY)).toBeLessThanOrEqual(0);
  }
});
