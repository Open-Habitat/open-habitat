import { mkdir } from "node:fs/promises";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./lab-host";
import { rewrite, type World } from "./rail-worlds";

// rail-scroll-region, direction 1 Työtilat (Jari 21.11.2026): the rail
// never scrolls as a whole. The conversation sections share one region at
// the top and Työtilat's list scrolls in its own, so browsing the
// workspaces never moves a conversation. When the conversations do not fit
// either, their region scrolls and its edges name the sections out of
// sight. Desktop Hiljaiset stays open until the person folds it.
// The lab's snapshot is rewritten on the wire into the
// prototype's two worlds: crowded (6 waiting, 5 running, 30 quiet, 40
// workspaces) and ordinary (2 / 1 / 5, 24 workspaces).

const CROWDED: World = { yours: 6, running: 5, quiet: 30, workspaces: 40 };
const ORDINARY: World = { yours: 2, running: 1, quiet: 5, workspaces: 24 };

async function open(
  page: Page,
  w: World,
  { phone = false }: { phone?: boolean } = {},
) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(
    page.getByTestId(phone ? "navigation-open" : "workspace-navigation"),
  ).toBeVisible();
  let first = "";
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = rewrite(await response.json(), w);
    first ||= `${body.agents.find((a) => a.turn_mark)?.agent_id}`;
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  if (phone) await page.getByTestId("navigation-open").click();
  await expect(
    rail(page).locator('li[data-testid^="agent-item-"]').first(),
  ).toBeVisible();
  // The first waiting conversation, opened from its row as a person would.
  await region(page)
    .getByTestId(`agent-item-${first}`)
    .getByRole("link")
    .first()
    .click();
  if (phone) {
    // Opening a conversation closes the drawer; open it again.
    await expect(rail(page)).toBeHidden();
    await page.getByTestId("navigation-open").click();
  }
  await expect(selected(page)).toHaveCount(1);
  return first;
}

const rail = (page: Page) =>
  page.getByRole("navigation").and(page.getByTestId("workspace-navigation"));
const region = (page: Page) => rail(page).getByTestId("rail-conversations");
const list = (page: Page) => rail(page).getByTestId("rail-workspace-scroll");
const content = (page: Page) => rail(page).locator(".ah-rail-content");
const selected = (page: Page) =>
  region(page).locator(
    'li[data-testid^="agent-item-"]:has([aria-current="page"])',
  );

/** Whether an element's own box scrolls (and how far it is scrolled). */
const scrolling = (l: Locator) =>
  l.evaluate((el) => ({
    scrolls: el.scrollHeight > el.clientHeight + 1,
    top: el.scrollTop,
    overflow: getComputedStyle(el).overflowY,
  }));

/** The element's box lies wholly inside the region's visible box. */
async function inSight(row: Locator, box: Locator) {
  const [r, b] = await Promise.all([row.boundingBox(), box.boundingBox()]);
  if (!r || !b) return false;
  return r.y >= b.y - 1 && r.y + r.height <= b.y + b.height + 1;
}

/** The rail as a whole never scrolls: its content box clips and stays at 0. */
async function railStill(page: Page) {
  const c = await scrolling(content(page));
  expect(c.overflow).toBe("clip");
  expect(c.top).toBe(0);
}

async function rowTops(page: Page) {
  return region(page)
    .locator('li[data-testid^="agent-item-"]')
    .evaluateAll((rows) =>
      rows.map((r) => Math.round(r.getBoundingClientRect().top)),
    );
}

const capture = process.env.OH_VISUAL_CAPTURE === "1";
async function shoot(page: Page, name: string) {
  if (!capture) return;
  const dir = "/var/tmp/agent-keep/rail-scroll-region";
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}

test.use({ reducedMotion: "reduce" });

test.describe("crowded 1440 × 1000", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test("@rail-scroll-region workspace scrolling leaves conversations still", async ({
    page,
  }) => {
    await open(page, CROWDED);
    await railStill(page);
    // Crowding does not change or persist the person's fold choice.
    await expect(rail(page).getByTestId("rail-quiet-fold")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      await page.evaluate(() => localStorage.getItem("nah:rail-quiet-folded")),
    ).toBeNull();
    expect((await scrolling(region(page))).scrolls).toBe(true);
    await expect(region(page).getByTestId("rail-beyond-below")).toBeVisible();
    await expect(region(page).getByTestId("rail-beyond-above")).toHaveCount(0);
    // Työtilat's heading, its new-workspace button and filter stay; its
    // list is the region that scrolls.
    await expect(rail(page).getByTestId("workspace-create")).toBeInViewport();
    await expect(rail(page).getByTestId("workspace-filter")).toBeInViewport();
    expect((await scrolling(list(page))).scrolls).toBe(true);
    const before = await rowTops(page);
    await list(page).hover();
    await page.mouse.wheel(0, 4000);
    await expect
      .poll(async () => (await scrolling(list(page))).top)
      .toBeGreaterThan(0);
    await expect(list(page)).toHaveAttribute("data-above", "");
    // The last workspace row and its + are reachable; no conversation moved.
    const last = list(page).locator(".ah-workspace-row").last();
    await expect(last).toBeInViewport({ ratio: 1 });
    expect(await rowTops(page)).toEqual(before);
    await railStill(page);
    await shoot(page, "crowded-1000");
  });
});

for (const [locale, scheme] of [
  ["fi-FI", "light"],
  ["en-US", "dark"],
] as const) {
  test.describe(`crowded 1440 × 700 ${locale} ${scheme}`, () => {
    test.use({
      viewport: { width: 1440, height: 700 },
      locale,
      colorScheme: scheme,
    });
    test(`@rail-scroll-region edge chips name what is out of sight (${locale}, ${scheme})`, async ({
      page,
    }) => {
      await open(page, CROWDED);
      await railStill(page);
      expect((await scrolling(region(page))).scrolls).toBe(true);
      await expect(region(page)).toHaveAttribute("data-scrolls", "");
      // At the top: rows below, Hiljaiset (open, out of sight) with all
      // its conversations.
      const below = region(page).getByTestId("rail-beyond-below");
      await expect(below).toBeVisible();
      await expect(
        below.getByTestId("rail-beyond-below-quiet").locator("b"),
      ).toHaveText(String(CROWDED.quiet));
      await expect(region(page).getByTestId("rail-beyond-above")).toHaveCount(
        0,
      );
      // Each chip has a name of its own for assistive technology.
      for (const chip of await below.getByRole("button").all())
        expect(await chip.getAttribute("aria-label")).toBeTruthy();
      await shoot(page, `crowded-700-${locale}-${scheme}`);
      // The chip scrolls to its section; Sinun vuorosi's rows now lie above.
      await below.getByTestId("rail-beyond-below-quiet").click();
      await expect(
        rail(page).getByTestId("rail-quiet").getByRole("heading"),
      ).toBeInViewport({ ratio: 1 });
      const above = region(page).getByTestId("rail-beyond-above");
      await expect(above.getByTestId("rail-beyond-above-yours")).toBeVisible();
      const hidden = Number(
        await above
          .getByTestId("rail-beyond-above-yours")
          .locator("b")
          .textContent(),
      );
      expect(hidden).toBeGreaterThan(0);
      expect(hidden).toBeLessThanOrEqual(CROWDED.yours);
      // The heading is not under the chip.
      const head = await rail(page)
        .getByTestId("rail-quiet")
        .getByRole("heading")
        .boundingBox();
      const chip = await above.boundingBox();
      if (!head || !chip) throw new Error("Missing geometry");
      expect(head.y).toBeGreaterThanOrEqual(chip.y + chip.height - 1);
      await railStill(page);
      await shoot(page, `crowded-700-jumped-${locale}-${scheme}`);
    });
  });
}

test.describe("keyboard at 700", () => {
  test.use({ viewport: { width: 1440, height: 700 } });
  test("@rail-scroll-region ⌥↑/⌥↓ reveal each opened row in its region", async ({
    page,
  }) => {
    test.setTimeout(180000);
    await open(page, CROWDED);
    // A manual fold and reopen is kept; every quiet row is a keyboard
    // destination again.
    await rail(page).getByTestId("rail-quiet-fold").click();
    await rail(page).getByTestId("rail-quiet-fold").click();
    await expect(rail(page).getByTestId("rail-quiet-fold")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      await page.evaluate(() => localStorage.getItem("nah:rail-quiet-folded")),
    ).toBe("0");
    const total = CROWDED.yours + CROWDED.running + CROWDED.quiet;
    const order = await region(page)
      .locator('li[data-testid^="agent-item-"]')
      .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-testid")));
    expect(order).toHaveLength(total);
    const step = async (key: "Alt+ArrowDown" | "Alt+ArrowUp", at: number) => {
      await page.keyboard.press(key);
      await expect(selected(page)).toHaveAttribute(
        "data-testid",
        `${order[at]}`,
      );
      await expect.poll(() => inSight(selected(page), region(page))).toBe(true);
    };
    // The lab's conversation is read only (no composer): the keys work
    // from the page itself.
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    for (let i = 1; i < total; i++) await step("Alt+ArrowDown", i);
    // At the end: the rows above are named, the open row is in sight.
    await expect(
      region(page).getByTestId("rail-beyond-above-yours"),
    ).toBeVisible();
    await railStill(page);
    for (let i = total - 2; i >= 0; i--) await step("Alt+ArrowUp", i);
    await railStill(page);
  });
});

test.describe("ordinary 1440 × 900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("@rail-scroll-region nothing but Työtilat scrolls in ordinary use", async ({
    page,
  }) => {
    await open(page, ORDINARY);
    await railStill(page);
    // Not crowded: Hiljaiset stays open and every conversation is in sight.
    await expect(rail(page).getByTestId("rail-quiet-fold")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect((await scrolling(region(page))).scrolls).toBe(false);
    const rows = region(page).locator('li[data-testid^="agent-item-"]');
    await expect(rows).toHaveCount(
      ORDINARY.yours + ORDINARY.running + ORDINARY.quiet,
    );
    for (const row of await rows.all())
      expect(await inSight(row, region(page))).toBe(true);
    await expect(region(page).getByTestId("rail-beyond-below")).toHaveCount(0);
    expect((await scrolling(list(page))).scrolls).toBe(true);
    await shoot(page, "ordinary-900");
  });
});

test.describe("phone drawer", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  test("@rail-scroll-region the drawer keeps the regions", async ({ page }) => {
    await open(page, CROWDED, { phone: true });
    await railStill(page);
    // Unlike desktop, the crowded drawer still folds automatically, without
    // storing that as the person's explicit choice.
    await expect(rail(page).getByTestId("rail-quiet-fold")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(
      await page.evaluate(() => localStorage.getItem("nah:rail-quiet-folded")),
    ).toBeNull();
    await expect(rail(page).getByTestId("workspace-create")).toBeInViewport();
    expect((await scrolling(list(page))).scrolls).toBe(true);
    await expect(selected(page)).toBeInViewport({ ratio: 1 });
    await shoot(page, "crowded-phone");
  });
});
