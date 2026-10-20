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
  expect(ring, "focused editor draws an outline").not.toBeNull();
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
  await page.getByRole("textbox", { name: "Viesti Pi:lle" }).focus();
  // Anti-aliasing may soften a sample or two; a clipped side shows 0 %.
  await expect
    .poll(
      async () => {
        const sides = await ringSides(page);
        return Object.values(sides).length === 4
          ? Math.min(...Object.values(sides))
          : -1;
      },
      { message: `${label}: ${JSON.stringify(await ringSides(page))}` },
    )
    .toBeGreaterThanOrEqual(90);
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
      await page.goto("/workspaces");
      await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
      await page.getByRole("link", { name: "Alice" }).click();
      if (viewport.width < 600)
        await page.getByRole("button", { name: "Avaa navigaatio" }).click();
      await page
        .getByRole("navigation")
        .getByRole("button", {
          name: "Uusi keskustelu työtilassa aurinkokello",
        })
        .click();
      await expectWholeRing(page, "new conversation, model in the field");
      const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
      await editor.fill("Tutki synteettinen työtila");
      await page.getByRole("button", { name: "Lähetä", exact: true }).click();
      const card = page.getByRole("complementary", {
        name: "Keskustelun yhteenveto",
      });
      await expect(card.getByText("luotu automaattisesti")).toBeVisible({
        timeout: 20000,
      });
      await expectWholeRing(page, "recap above the composer");
      await routeStrip(page);
      await page.reload();
      await expect(
        page.getByRole("region", { name: "Taustatyö" }),
      ).toBeVisible();
      await expect(card).toBeVisible();
      await expectWholeRing(page, "recap and strip above the composer");
    } finally {
      expect(
        (await page.request.get("/fixture/scenario?value=ready")).status(),
      ).toBe(204);
    }
  });
