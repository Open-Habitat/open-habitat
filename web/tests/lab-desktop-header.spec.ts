import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./lab-host";

test.use({ reducedMotion: "reduce", deviceScaleFactor: 2 });

// The desktop conversation header is one row (proto-conversation-header,
// round 2, direction 1). When the column is short of room the chips shorten
// in place, in a fixed order, until the title keeps 40 % of the row or its
// whole text; the rarely used actions move into the ⋯ menu. A long title,
// branch and model name must not take the row from it, beside the sidebar
// or the open editor.
const branch =
  "wt/korjaa-otsikkorivin-tilanjako-kapeassa-keskustelusarakkeessa";
const capture = process.env.OH_HEADER_CAPTURE;
for (const width of [1024, 1280, 1600, 1920]) {
  test(`@a11y desktop conversation header stays one row with a readable title at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 800 });
    await page.route("**/api/v1/workspaces/git?*", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({ response, json: { ...body, branch } });
    });
    // A long catalogue name for the lab's model: the chip shows the short
    // form of whatever the catalogue calls it, so the row must survive one.
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
            {
              ...body.models[0],
              id: "fake-pi",
              name: "Claude Opus 5.5 Extended Preview 1M",
            },
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
    await page
      .getByTestId("message-input")
      .fill(
        "Tarkista otsikkorivin tilanjako kapeassa keskustelusarakkeessa ja kerro, mitkä sirut lyhenevät ensin",
      );
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await expect(page.locator(".ah-rail")).toBeVisible();
    const header = page.locator(".ah-conversation-frame > .ah-agent-header");
    const git = header.getByTestId("git-chip");
    await expect(git).toHaveAttribute("data-branch", branch);
    await expect(header.getByTestId("conversation-model")).toContainText(
      "Extended Preview",
    );

    // The quiet chips: no branch name and no zero counts on the Git chip,
    // which still names the branch for its readers; only the model on the
    // model chip, whose level is in its tooltip and name.
    await expect(git).not.toContainText(branch);
    await expect(git.locator(".zero")).toHaveCount(0);
    await expect(git).toHaveAttribute("aria-label", new RegExp(branch));
    const model = header.getByTestId("conversation-model");
    await expect(model).toHaveAttribute(
      "title",
      /^Opus 5.5 Extended Preview · ajattelutaso /,
    );
    await expect(model).toHaveAttribute("aria-label", /ajattelutaso/);
    await expect(model.locator(".ah-set-thinking")).toHaveCount(0);
    expect(
      await git.evaluate((el) => getComputedStyle(el).borderTopColor),
    ).toBe("rgba(0, 0, 0, 0)");

    await expectOneRow(page, header, width);
    await shoot(page, header, `${width}-sidebar`);
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      expect(
        (await new AxeBuilder({ page }).include(".ah-agent-header").analyze())
          .violations,
      ).toEqual([]);
    }
    await page.emulateMedia({ colorScheme: "light" });

    // The activity is a dot; its state shows as text on hover and on
    // keyboard focus, and is the dot's accessible name.
    const activity = header.getByTestId("header-activity");
    const tip = activity.locator(".ah-header-tip");
    await expect(tip).toBeHidden();
    await activity.hover();
    await expect(tip).toBeVisible();
    // One read: the duration in both ticks while the turn runs.
    const [tipText, label] = await activity.evaluate((el) => [
      el.querySelector(".ah-header-tip")?.textContent,
      el.getAttribute("aria-label"),
    ]);
    expect(tipText).toBe(label);
    await page.mouse.move(2, 790);
    await expect(tip).toBeHidden();
    await activity.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(activity).toBeFocused();
    await expect(tip).toBeVisible();
    await shoot(page, header, `${width}-activity-tip`, 120);
    await page.keyboard.press("Escape");

    // Beside the open editor the column narrows to 440-640 px: the same
    // one row, with more of it shortened.
    await header.getByTestId("toggle-editor").click();
    await expect(page.locator(".ah-editor-open")).toBeVisible();
    await expectOneRow(page, header, width);
    await shoot(page, header, `${width}-editor`);
  });
}

async function shoot(page: Page, header: Locator, name: string, extra = 0) {
  if (!capture) return;
  const box = await header.boundingBox();
  if (!box) return;
  // A menu just closed returns focus to its trigger; the picture is of rest.
  if (!name.includes("tip"))
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.screenshot({
      path: resolve(capture, `${name}-${colorScheme}.png`),
      clip: {
        x: 0,
        y: 0,
        width: page.viewportSize()?.width ?? 0,
        height: box.y + box.height + extra,
      },
    });
  }
  await page.emulateMedia({ colorScheme: "light" });
}

async function expectOneRow(page: Page, header: Locator, width: number) {
  // The header measures itself on the frame after a layout change, so the
  // row is read until it holds and its steps stay put between two reads,
  // not after a guessed delay; the menu checks below follow those steps.
  let geometry = await measure(header);
  await expect(async () => {
    const previous = geometry.steps;
    geometry = await measure(header);
    expect(geometry.steps, "steps settled").toBe(previous);
    expect(geometry.rows, `rows at steps "${geometry.steps}"`).toBe(1);
    expect(geometry.overlaps).toBe(0);
    expect(geometry.outside).toBe(0);
    expect(
      geometry.title,
      `title share at steps "${geometry.steps}": ${geometry.parts}`,
    ).toBeGreaterThanOrEqual(
      Math.min(geometry.titleText, geometry.row * 0.4) - 1,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }).toPass({ timeout: 10_000 });

  // Every action is in view, directly or through the ⋯ menu, and the state
  // the row no longer shows is in the menu.
  for (const id of [
    "workspace-title",
    "header-activity",
    "git-chip",
    "context-ring",
    "toggle-editor",
    "toggle-terminal",
  ])
    await expect(header.getByTestId(id)).toBeInViewport({ ratio: 1 });
  const menu = header.getByTestId("conversation-menu");
  const steps = geometry.steps.split(" ");
  if (!steps.includes("1")) {
    await expect(header.getByTestId("conversation-workspace")).toBeInViewport({
      ratio: 1,
    });
    await expect(menu).toBeHidden();
  } else await expect(menu).toBeInViewport({ ratio: 1 });
  if (!steps.includes("3")) {
    for (const id of [
      "conversation-recap",
      "conversation-retitle",
      "workspace-details",
    ])
      await expect(header.getByTestId(id)).toBeInViewport({ ratio: 1 });
    if (!steps.includes("1")) return;
    // The menu holds the workspace, which the row no longer shows, and
    // renaming, which the menu always offers.
    await menu.click();
    const items = page.getByRole("menu").getByRole("menuitem");
    await expect(items).toHaveCount(2);
    await expect(items.and(page.getByTestId("menu-workspace"))).toBeVisible();
    await expect(items.and(page.getByTestId("menu-rename"))).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(items).toHaveCount(0);
    return;
  }
  await menu.click();
  const items = page.getByRole("menu");
  const expected = [
    "workspace",
    "rename",
    "recap",
    "retitle",
    "archive",
    "details",
  ];
  if (steps.includes("6")) expected.push("git");
  if (steps.includes("7")) expected.push("model");
  else
    await expect(header.getByTestId("conversation-model")).toBeInViewport({
      ratio: 1,
    });
  for (const id of expected)
    await expect(
      items.getByRole("menuitem").and(page.getByTestId(`menu-${id}`)),
    ).toBeVisible();
  const popover = await page.locator(".ah-popover").boundingBox();
  expect(popover && popover.x + popover.width).toBeLessThanOrEqual(width);
  if (!steps.includes("6")) {
    await page.keyboard.press("Escape");
    await expect(items).toHaveCount(0);
    return;
  }
  // The Git row opens the chip's layer, which names the branch.
  await items.getByRole("menuitem").and(page.getByTestId("menu-git")).click();
  const details = page.getByRole("dialog").and(page.getByTestId("git-dialog"));
  await expect(details).toBeVisible();
  await expect(details).toContainText(branch);
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
}

function measure(header: Locator) {
  return header.evaluate((element) => {
    const row = element.querySelector(".ah-agent-topline") as HTMLElement;
    const title = element.querySelector("h1") as HTMLElement;
    const boxes = [...row.querySelectorAll(":scope > *, :scope > * > summary")]
      .map((child) => child.getBoundingClientRect())
      .filter((box) => box.width > 1 && box.height > 1);
    const tops = boxes.map((box) => box.top + box.height / 2);
    const own = row.getBoundingClientRect();
    return {
      row: own.width,
      right: own.right,
      steps: row.dataset.shorten ?? "",
      // What took the row, for a failure's message.
      parts: [...row.children]
        .map((child) => {
          const box = child.getBoundingClientRect();
          return box.width
            ? `${child.className.split(" ")[0]} ${Math.round(box.width)}`
            : "";
        })
        .filter(Boolean)
        .join(", "),
      title: title.getBoundingClientRect().width,
      titleText: title.scrollWidth,
      // A shortened chip whose content spills out covers its neighbour.
      overlaps: boxes.filter((a, i) =>
        boxes.some(
          (b, j) =>
            j > i &&
            a.left < b.right - 1 &&
            b.left < a.right - 1 &&
            a.top < b.bottom - 1 &&
            b.top < a.bottom - 1 &&
            !(a.left <= b.left && a.right >= b.right) &&
            !(b.left <= a.left && b.right >= a.right),
        ),
      ).length,
      outside: boxes.filter((box) => box.right > own.right + 1).length,
      rows: tops.filter(
        (centre, i) => tops.findIndex((c) => Math.abs(c - centre) < 12) === i,
      ).length,
    };
  });
}
