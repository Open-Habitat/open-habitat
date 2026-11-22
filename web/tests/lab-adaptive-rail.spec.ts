import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./lab-host";
import { rewrite, type World } from "./rail-worlds";

// The adaptive rail (adaptive-rail, experimental; rail-space round 3, Jari
// 22.11.2026: C Leveämpi with B's logic). The rule itself is tested in
// railAllocation.test.ts; here the real rail at the round's laptop heights
// in its worlds: ordinary (4 waiting, 2 running, 12 quiet, 18 workspaces),
// little content (3 / 0 / 5, 6) and crowded (6 / 4 / 30, 40).

const ORDINARY: World = { yours: 4, running: 2, quiet: 12, workspaces: 18 };
const LITTLE: World = { yours: 3, running: 0, quiet: 5, workspaces: 6 };
const CROWDED: World = { yours: 6, running: 4, quiet: 30, workspaces: 40 };

const rail = (page: Page) =>
  page.getByRole("navigation").and(page.getByTestId("workspace-navigation"));

async function choose(page: Page, adaptive: boolean) {
  const session = await (await page.request.get("/auth/session")).json();
  const put = await page.request.put("/api/v1/account/preferences", {
    headers: {
      Origin: new URL(page.url()).origin,
      "X-Agent-Host-CSRF": session.csrf,
    },
    data: { experimental: { "adaptive-rail": adaptive } },
  });
  expect(put.status()).toBe(200);
}

const selected = (page: Page) =>
  rail(page).locator(
    'li[data-testid^="agent-item-"]:has([aria-current="page"])',
  );

/** Signs in to the lab in the world, with the feature on or off, and opens
 * the first waiting conversation from its row. */
async function open(page: Page, w: World, adaptive = true) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(rail(page)).toBeVisible();
  await choose(page, adaptive);
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
  if (adaptive) await settled(page);
  return first;
}

/** Turns the feature on or off in the open page. */
async function toggle(page: Page, adaptive: boolean) {
  await choose(page, adaptive);
  await page.reload();
  await expect(selected(page)).toHaveCount(1);
  if (adaptive) await settled(page);
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
  const dir = "/var/tmp/agent-keep/rail-adaptive-impl";
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}

test.use({ reducedMotion: "reduce" });

for (const height of [720, 900, 1080]) {
  test.describe(`ordinary 1280 × ${height}`, () => {
    test.use({ viewport: { width: 1280, height } });
    test(`@adaptive-rail shares the height out by the rule at ${height}`, async ({
      page,
    }) => {
      await open(page, ORDINARY, false);
      const fixed = await seen(page);
      await shoot(page, `ordinary-${height}-off`);
      await toggle(page, true);
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
      expect(now.conv + now.ws).toBeGreaterThan(fixed.conv + fixed.ws + 2);
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
      // A conversation row names its workspace.
      await expect(
        rail(page).getByTestId("rail-row-workspace").first(),
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
    await open(page, ORDINARY, false);
    const fixed = await rail(page).boundingBox();
    await toggle(page, true);
    const box = await rail(page).boundingBox();
    expect(box?.width).toBe(fixed?.width);
  });
});

test.describe("off", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test("@adaptive-rail off, the rail is the fixed one", async ({ page }) => {
    await open(page, ORDINARY, false);
    await expect(rail(page)).not.toHaveClass(/ah-rail-adaptive/);
    await expect(rail(page).getByTestId("rail-places")).toHaveCount(0);
    await expect(rail(page).getByTestId("rail-ws-below")).toHaveCount(0);
    await expect(
      rail(page).locator(".ah-rail-home-row").getByTestId("home-link"),
    ).toBeVisible();
    await expect(
      rail(page).locator(".ah-rail-content").getByTestId("search-door"),
    ).toBeVisible();
  });
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
    const session = await (await page.request.get("/auth/session")).json();
    await page.request.put("/api/v1/account/preferences", {
      headers: {
        Origin: new URL(page.url()).origin,
        "X-Agent-Host-CSRF": session.csrf,
      },
      data: { experimental: { "adaptive-rail": true } },
    });
    await page.reload();
    await page.getByTestId("navigation-open").click();
    await expect(rail(page)).toBeVisible();
    await expect(rail(page)).not.toHaveClass(/ah-rail-adaptive/);
    await expect(rail(page).getByTestId("rail-places")).toHaveCount(0);
  });
});
