import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Locator } from "@playwright/test";
import { expect, test } from "./lab-host";

test.use({ reducedMotion: "reduce", deviceScaleFactor: 2 });

// Between the phone breakpoint and a wide window the sidebar leaves the
// conversation 800-1000 px, and one row of state chips and actions squeezed
// the title to its dots. The title keeps a readable share; what does not fit
// beside it moves to a second row, and every desktop action stays visible.
const branch =
  "wt/korjaa-otsikkorivin-tilanjako-kapeassa-keskustelusarakkeessa";
for (const width of [1024, 1280, 1600, 1920]) {
  test(`@a11y desktop conversation header keeps the title readable at ${width}px with the sidebar open`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.route("**/api/v1/workspaces/git?*", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({ response, json: { ...body, branch } });
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
      .fill("Tarkista otsikkorivin tilanjako kapeassa keskustelusarakkeessa");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await expect(page.locator(".ah-rail")).toBeVisible();
    const header = page.locator(".ah-conversation-frame > .ah-agent-header");
    await expect(header.getByTestId("git-chip")).toHaveAttribute(
      "data-branch",
      branch,
    );
    // Review material for the issue, not a visual comparison.
    if (process.env.OH_DESKTOP_HEADER_CAPTURE)
      await page.screenshot({
        path: resolve(process.env.OH_DESKTOP_HEADER_CAPTURE, `${width}.png`),
        clip: { x: 0, y: 0, width, height: 240 },
      });
    for (const id of [
      "workspace-title",
      "conversation-workspace",
      "git-chip",
      "context-ring",
      "conversation-model",
      "toggle-editor",
      "toggle-terminal",
      "conversation-retitle",
      "workspace-details",
    ])
      await expect(header.getByTestId(id)).toBeInViewport({ ratio: 1 });
    await expectReadable(header, 2);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      expect(
        (await new AxeBuilder({ page }).include(".ah-agent-header").analyze())
          .violations,
      ).toEqual([]);
    }

    // Beside the open editor the column narrows further: the state may take
    // one more row, but the title keeps its share and nothing overlaps.
    await header.getByTestId("toggle-editor").click();
    await expect(page.locator(".ah-editor-open")).toBeVisible();
    if (process.env.OH_DESKTOP_HEADER_CAPTURE)
      await page.screenshot({
        path: resolve(
          process.env.OH_DESKTOP_HEADER_CAPTURE,
          `${width}-editor.png`,
        ),
        clip: { x: 0, y: 0, width, height: 240 },
      });
    await expectReadable(header, 3);
  });
}

async function expectReadable(header: Locator, maxRows: number) {
  const geometry = await header.evaluate((element) => {
    const title = element.querySelector("h1") as HTMLElement;
    const boxes = [
      ...element.querySelectorAll(
        ".ah-agent-topline > *, .ah-agent-topline > * > summary",
      ),
    ]
      .map((child) => child.getBoundingClientRect())
      .filter((box) => box.width > 1 && box.height > 1);
    const tops = boxes.map((box) => box.top + box.height / 2);
    return {
      row: (
        element.querySelector(".ah-agent-topline") as HTMLElement
      ).getBoundingClientRect().width,
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
      rows: tops.filter(
        (centre, i) => tops.findIndex((c) => Math.abs(c - centre) < 12) === i,
      ).length,
    };
  });
  // Either the whole title or a quarter of the row: enough words to
  // recognise the conversation, whatever the chips beside it hold.
  expect(geometry.title).toBeGreaterThanOrEqual(
    Math.min(geometry.titleText, geometry.row / 4),
  );
  expect(geometry.rows).toBeLessThanOrEqual(maxRows);
  expect(geometry.overlaps).toBe(0);
}
