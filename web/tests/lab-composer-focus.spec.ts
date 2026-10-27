import type { Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

// The fraction of each side of the focused editor's outline that is actually
// painted on screen in the outline colour. A scrolling ancestor, a later
// positioned sibling or the viewport hides part of it whatever the cause, so
// this reads pixels rather than the CSS that produced them.
async function ringSides(page: Page) {
  const ring = await page.evaluate(() => {
    const editor = document.activeElement;
    if (!(editor instanceof HTMLTextAreaElement)) return null;
    // The ring is drawn on the box that holds the field and its bottom row.
    const owner =
      [editor, editor.closest(".ah-cbox")].find(
        (node): node is HTMLElement =>
          node instanceof HTMLElement &&
          getComputedStyle(node).outlineStyle !== "none",
      ) ?? null;
    if (!owner) return null;
    const s = getComputedStyle(owner);
    const r = owner.getBoundingClientRect();
    return {
      color: s.outlineColor,
      width: Number.parseFloat(s.outlineWidth),
      offset: Number.parseFloat(s.outlineOffset),
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
    };
  });
  // No outline yet (the editor lost focus to a remount): the caller polls.
  if (!ring) return {};
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const shot = await page.screenshot();
  return page.evaluate(
    async ({ b64, ring, viewport }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(
        new Blob([bytes], { type: "image/png" }),
      );
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d");
      if (!context) return {};
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);
      const want = (ring.color.match(/[\d.]+/g) ?? []).map(Number);
      const scale = bitmap.width / viewport.width;
      const painted = (x: number, y: number) => {
        const ix = Math.round(x * scale);
        const iy = Math.round(y * scale);
        if (ix < 0 || iy < 0 || ix >= bitmap.width || iy >= bitmap.height)
          return false;
        const i = (iy * bitmap.width + ix) * 4;
        return (
          Math.abs(pixels.data[i] - want[0]) +
            Math.abs(pixels.data[i + 1] - want[1]) +
            Math.abs(pixels.data[i + 2] - want[2]) <
          60
        );
      };
      const d = ring.offset + ring.width / 2;
      const side = (
        at: (t: number) => [number, number],
        from: number,
        to: number,
      ) => {
        let hit = 0;
        let n = 0;
        // Leave out the rounded corners.
        for (let t = from + 12; t <= to - 12; t += 2) {
          n++;
          if (painted(...at(t))) hit++;
        }
        return Math.round((100 * hit) / n);
      };
      return {
        top: side((x) => [x, ring.top - d], ring.left, ring.right),
        bottom: side((x) => [x, ring.bottom + d], ring.left, ring.right),
        left: side((y) => [ring.left - d, y], ring.top, ring.bottom),
        right: side((y) => [ring.right + d, y], ring.top, ring.bottom),
      };
    },
    { b64: shot.toString("base64"), ring, viewport },
  );
}

async function expectWholeRing(page: Page, label: string) {
  // Anti-aliasing may soften a sample or two; a clipped side shows 0 %.
  // The sides of the last attempt name which edge is clipped on failure.
  let last: unknown = {};
  await expect
    .poll(
      async () => {
        // The composer may still be remounted as its sources arrive, which
        // drops focus; focus whatever editor is current on every attempt.
        await page.getByTestId("message-input").focus();
        const sides = await ringSides(page);
        last = sides;
        return Object.values(sides).length === 4
          ? Math.min(...Object.values(sides))
          : -1;
      },
      { message: label },
    )
    .toBeGreaterThanOrEqual(90)
    .catch((error: Error) => {
      throw new Error(`${error.message}\nlast sides: ${JSON.stringify(last)}`);
    });
}

// The background strip appears only with background work; the lab's fake Pi
// has none, so a synthetic process inventory stands in for it.
async function routeStrip(page: Page) {
  await page.route("**/api/v1/conversations/*/processes**", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        owner_generation: "og_lab",
        availability: "available",
        unavailable_reason: null,
        interrupted: [],
        processes: [
          {
            id: "proc_7d40",
            name: "hidas-testi",
            command_preview: "python3 -m pytest tests/slow -q",
            process_token: "pt_proc_7d40",
            status: "running",
            started_at: Date.now() - 120000,
            ended_at: null,
            exit_code: null,
            signal: null,
            end_reason: null,
            wakes_agent: false,
            run_ids: [],
          },
        ],
      },
    }),
  );
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
])
  test(`@lab composer focus ring stays whole under the recap and strip (${viewport.name})`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize(viewport);
    expect(
      (await page.request.get("/fixture/scenario?value=pi-recap")).status(),
    ).toBe(204);
    try {
      await page.clock.install();
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page
        .getByRole("link")
        .and(page.locator('a[href*="code=42"]'))
        .click();
      if (viewport.width < 600)
        await page.getByTestId("navigation-open").click();
      await page
        .getByRole("navigation")
        .getByTestId("workspace-start-aurinkokello")
        .click();
      // Creation first mounts a local draft; inspect the native composer only
      // after its sources arrive, rather than the field it replaces.
      await expect(page.getByTestId("command-palette")).toBeVisible();
      await expectWholeRing(page, "new conversation, model in the field");
      const editor = page.getByTestId("message-input");
      await editor.fill("Tutki synteettinen työtila");
      await page
        .getByTestId("send")
        .and(page.locator('[data-mode="send"]'))
        .click();
      // Typing holds a fresh recap back for a while; let that pause pass.
      await page.clock.fastForward(61_000);
      const card = page.getByTestId("recap-card");
      await expect(card).toHaveAttribute("data-trigger", "automatic", {
        timeout: 20000,
      });
      await expectWholeRing(page, "recap above the composer");
      await routeStrip(page);
      await page.reload();
      await expect(page.getByTestId("background-work")).toBeVisible();
      await expect(card).toBeVisible();
      await expectWholeRing(page, "recap and strip above the composer");
    } finally {
      expect(
        (await page.request.get("/fixture/scenario?value=ready")).status(),
      ).toBe(204);
    }
  });
