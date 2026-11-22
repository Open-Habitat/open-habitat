import { mkdir, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./lab-host";
import { rewrite, type World } from "./rail-worlds";

// The default rail (rail-space round 3, Jari
// 22.11.2026: C Leveämpi with B's logic). The rule itself is tested in
// railAllocation.test.ts; here the real rail at the round's laptop heights
// in its worlds: ordinary (4 waiting, 2 running, 12 quiet, 18 workspaces),
// little content (3 / 0 / 5, 6) and crowded (6 / 4 / 30, 40).

const ORDINARY: World = { yours: 4, running: 2, quiet: 12, workspaces: 18 };
const LITTLE: World = { yours: 3, running: 0, quiet: 5, workspaces: 6 };
const CROWDED: World = { yours: 6, running: 4, quiet: 30, workspaces: 40 };

const rail = (page: Page) =>
  page.getByRole("navigation").and(page.getByTestId("workspace-navigation"));

const selected = (page: Page) =>
  rail(page).locator(
    'li[data-testid^="agent-item-"]:has([aria-current="page"])',
  );

/** Signs in to the lab world and opens its first waiting conversation. */
async function open(page: Page, w: World) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(rail(page)).toBeVisible();
  let first = "";
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = rewrite(await response.json(), w);
    first ||= `${body.agents.find((a) => a.turn_mark)?.agent_id}`;
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await expect(
    rail(page).locator('li[data-testid^="agent-item-"]').first(),
  ).toBeVisible();
  await rail(page)
    .getByTestId(`agent-item-${first}`)
    .getByRole("link")
    .first()
    .click();
  await expect(selected(page)).toHaveCount(1);
  await settled(page);
  return first;
}

/** The rule measures after layout; wait until its result holds still. */
async function settled(page: Page) {
  await expect(rail(page)).toHaveAttribute("data-ready", "");
  let last = "";
  await expect
    .poll(async () => {
      const now = await rail(page).evaluate(
        (el) => `${el.dataset.step}|${el.getAttribute("style")}`,
      );
      const same = now === last;
      last = now;
      return same;
    })
    .toBe(true);
}

/** Rows wholly in sight: inside the window and every clipping ancestor up
 * to the rail, and on top at their middle (not under an edge chip). */
const seen = (page: Page) =>
  page.evaluate(() => {
    const inSight = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (!r.height) return false;
      const top = r.top + 2;
      const bottom = r.bottom - 2;
      if (top < 0 || bottom > innerHeight) return false;
      for (let a = el.parentElement; a; a = a.parentElement) {
        if (getComputedStyle(a).overflowY !== "visible") {
          const b = a.getBoundingClientRect();
          if (top < b.top || bottom > b.bottom) return false;
        }
        if (a.matches(".ah-rail")) break;
      }
      const x = r.left + Math.min(14, r.width / 2);
      const hit = document.elementFromPoint(x, (r.top + r.bottom) / 2);
      return !!hit && el.contains(hit);
    };
    const count = (sel: string) =>
      [...document.querySelectorAll(`.ah-rail ${sel}`)].filter(inSight).length;
    return {
      conv: count('li[data-testid^="agent-item-"]'),
      ws: count(".ah-workspace-list > li"),
    };
  });

const capture = process.env.OH_VISUAL_CAPTURE === "1";
async function shoot(page: Page, name: string) {
  if (!capture) return;
  const dir = "/var/tmp/agent-keep/rail-adaptive-graduate";
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
  await writeFile(`${dir}/${name}.html`, await page.content());
}

test.use({ reducedMotion: "reduce" });

for (const height of [720, 900, 1080]) {
  test.describe(`ordinary 1280 × ${height}`, () => {
    test.use({ viewport: { width: 1280, height } });
    test(`@adaptive-rail shares the height out by the rule at ${height}`, async ({
      page,
    }) => {
      await open(page, ORDINARY);
      const box = await rail(page).boundingBox();
      if (!box) throw new Error("no rail");
      // Wider in a window that leaves the conversation its room.
      expect(box.width).toBeGreaterThan(340);
      // Every place and the search are in sight; the rail never scrolls.
      for (const id of [
        "home-link",
        "rail-shares",
        "rail-resources",
        "search-door",
      ])
        await expect(rail(page).getByTestId(id)).toBeInViewport({ ratio: 1 });
      await expect(rail(page).getByTestId("workspace-create")).toBeInViewport({
        ratio: 1,
      });
      await expect(
        rail(page).getByTestId("account-menu-trigger"),
      ).toBeInViewport({ ratio: 1 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
      // Ordinary content is below "enough" at laptop heights: the places
      // stay an icon row, and the lists get what they free.
      await expect(rail(page)).toHaveAttribute("data-step", "0");
      const now = await seen(page);
      // The conversations keep their minimum (seven rows, one of them may
      // sit under an edge chip) and Työtilat its floor.
      expect(now.conv).toBeGreaterThanOrEqual(6);
      expect(now.ws).toBeGreaterThanOrEqual(3);
      // Hiljaiset stays open; past a dozen workspaces the filter sits on
      // Työtilat's heading row.
      await expect(rail(page).getByTestId("rail-quiet-fold")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      const filter = await rail(page)
        .getByTestId("workspace-filter")
        .boundingBox();
      const create = await rail(page)
        .getByTestId("workspace-create")
        .boundingBox();
      if (!filter || !create) throw new Error("no heading row");
      expect(
        Math.abs(filter.y + filter.height / 2 - (create.y + create.height / 2)),
      ).toBeLessThan(6);
      // A resting row names its workspace (the selected row's focused
      // actions temporarily replace that name).
      await expect(
        rail(page).getByTestId("rail-row-workspace").nth(1),
      ).toBeVisible();
      // Työtilat's lower edge says how many lie below, and pages the list.
      const below = rail(page).getByTestId("rail-ws-below");
      await expect(below).toBeVisible();
      expect(await below.getAttribute("aria-label")).toBeTruthy();
      await shoot(page, `ordinary-${height}-on`);
      const list = rail(page).getByTestId("rail-workspace-scroll");
      await below.click();
      await expect
        .poll(() => list.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(0);
      await expect(rail(page).getByTestId("rail-ws-above")).toBeVisible();
      await rail(page).getByTestId("rail-ws-above").click();
      await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBe(0);
    });
  });
}

test.describe("little content 1280 × 1080", () => {
  test.use({ viewport: { width: 1280, height: 1080 } });
  test("@adaptive-rail with everything shown the places grow to rows", async ({
    page,
  }) => {
    await open(page, LITTLE);
    await expect(rail(page)).toHaveAttribute("data-step", "2");
    await shoot(page, "little-1080-on");
    const now = await seen(page);
    expect(now).toEqual({
      conv: LITTLE.yours + LITTLE.quiet,
      ws: LITTLE.workspaces,
    });
    await expect(rail(page).getByTestId("rail-ws-below")).toHaveCount(0);
    // Six workspaces need no filter.
    await expect(rail(page).getByTestId("workspace-filter")).toHaveCount(0);
    await expect(rail(page).getByTestId("search-door")).toBeInViewport();
    await shoot(page, "little-1080-on");
    // Shrinking the window takes the places back to an icon row, and the
    // search stays a press away.
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(rail(page)).toHaveAttribute("data-step", "0");
    await rail(page).getByTestId("search-door").click();
    await expect(page.getByTestId("switcher")).toBeVisible();
  });
});

test.describe("crowded 1280 × 720", () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test("@adaptive-rail crowded, Hiljaiset stays open and every place works", async ({
    page,
  }) => {
    await open(page, CROWDED);
    await expect(rail(page).getByTestId("rail-quiet-fold")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const now = await seen(page);
    expect(now.conv).toBeGreaterThanOrEqual(5);
    expect(now.ws).toBeGreaterThanOrEqual(3);
    // The conversations scroll in their region with their edge chips.
    await expect(rail(page).getByTestId("rail-beyond-below")).toBeVisible();
    await shoot(page, "crowded-720-on");
    const axe = await new AxeBuilder({ page }).include(".ah-rail").analyze();
    expect(axe.violations).toEqual([]);
    // Folded by hand, Hiljaiset's workspace pills take its place: the
    // conversations keep their minimum and Työtilat its floor.
    await rail(page).getByTestId("rail-quiet-fold").click();
    await settled(page);
    // Reaching the heading scrolled the region; back at its top, count.
    await rail(page)
      .getByTestId("rail-conversations")
      .evaluate((el) => {
        el.scrollTop = 0;
      });
    await shoot(page, "crowded-720-folded");
    const folded = await seen(page);
    expect(folded.conv).toBeGreaterThanOrEqual(6);
    expect(folded.ws).toBeGreaterThanOrEqual(3);
    // A place leads where the fixed rail's row did.
    await rail(page).getByTestId("rail-shares").click();
    await expect(page).toHaveURL(/\/shares$/);
    await expect(rail(page).getByTestId("rail-shares")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await rail(page).getByTestId("home-link").click();
    await expect(page).toHaveURL(/\/workspaces$/);
  });
});

test.describe("narrower window 1100 × 900", () => {
  test.use({ viewport: { width: 1100, height: 900 } });
  test("@adaptive-rail narrows back before the conversation gives way", async ({
    page,
  }) => {
    await open(page, ORDINARY);
    const narrow = await rail(page).boundingBox();
    await page.setViewportSize({ width: 1280, height: 900 });
    await settled(page);
    const wide = await rail(page).boundingBox();
    if (!narrow || !wide) throw new Error("missing rail");
    expect(wide.width).toBeGreaterThan(narrow.width);
    await page.setViewportSize({ width: 1000, height: 900 });
    await settled(page);
    expect((await rail(page).boundingBox())?.width).toBe(narrow.width);
  });
});

test("place count stays at the row end", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1080 });
  await page.route("**/api/v1/view-addresses", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        max_days: 30,
        addresses: [
          {
            address_id: `a${"a".repeat(26)}`,
            view_id: `v${"a".repeat(26)}`,
            title: "Synthetic output",
            url: `${new URL(route.request().url()).origin}/n/${"a".repeat(43)}`,
            content_url: `https://example.test/${"a".repeat(43)}/`,
            state: "public",
            created_at: "2026-01-01T00:00:00Z",
            public_until: "2099-01-01T00:00:00Z",
          },
        ],
      },
    }),
  );
  await open(page, LITTLE);
  const shares = rail(page).getByTestId("rail-shares");
  await shares.click();
  await expect(page.getByTestId("shares-page")).toBeVisible();
  const rowCount = shares.locator(".ah-rail-place-count");
  const checkRow = async (name: string) => {
    await expect(rowCount).toBeVisible();
    await expect
      .poll(async () =>
        shares.evaluate((el) => {
          const count = el.querySelector(".ah-rail-place-count");
          const label = el.querySelector(".ah-rail-home-label");
          if (!count || !label) return false;
          const edge = el.getBoundingClientRect().right;
          const box = count.getBoundingClientRect();
          return (
            box.left > label.getBoundingClientRect().right &&
            Math.abs(
              edge -
                box.right -
                Number.parseFloat(getComputedStyle(el).paddingRight),
            ) < 2
          );
        }),
      )
      .toBe(true);
    if (capture) {
      const dir = "/var/tmp/agent-keep/rail-outputs-count-at-row-end";
      await mkdir(dir, { recursive: true });
      await page.screenshot({ path: `${dir}/${name}.png` });
      await writeFile(`${dir}/${name}.html`, await page.content());
    }
  };
  await checkRow("desktop");
  const steps = new Set<string>();
  for (let height = 1080; height >= 600; height -= 20) {
    await page.setViewportSize({ width: 1280, height });
    await settled(page);
    const step = await rail(page).getAttribute("data-step");
    if (!step) throw new Error("missing rail step");
    steps.add(step);
    if (step === "2") continue;
    const badge = shares.locator(".ah-place-count");
    await expect(badge).toBeVisible();
    const badgeBox = await badge.boundingBox();
    const placeBox = await shares.boundingBox();
    if (!badgeBox || !placeBox) throw new Error("missing place badge");
    expect(badgeBox.x).toBeGreaterThanOrEqual(placeBox.x);
    expect(badgeBox.x + badgeBox.width).toBeLessThanOrEqual(
      placeBox.x + placeBox.width,
    );
    await expect(shares).toHaveAttribute("aria-label", /\S/);
    if (steps.size === 3) break;
  }
  expect([...steps].sort()).toEqual(["0", "1", "2"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("navigation-open").click();
  await checkRow("phone");
});

test.describe("phone drawer", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  test("@adaptive-rail the phone keeps its drawer", async ({ page }) => {
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    await expect(page.getByTestId("navigation-open")).toBeVisible();
    await page.getByTestId("navigation-open").click();
    await expect(rail(page)).toBeVisible();
    await expect(rail(page)).not.toHaveClass(/ah-rail-adaptive/);
    await expect(rail(page).getByTestId("rail-places")).toHaveCount(0);
  });
});
