import { resolve } from "node:path";
import { snapshot } from "../lab/session.mjs";
import { expect, test } from "./lab-host";

test.use({ deviceScaleFactor: 2, reducedMotion: "reduce" });

for (const width of [1440, 390]) {
  test(`offer corner tooltips size to their text at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
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
    await expect(page).toHaveURL(/conversation=pi:/);
    const target = new URL(page.url()).searchParams.get("conversation") ?? "";
    for (const set of ["types", "folder"]) {
      const response = await page.request.get(
        `/fixture/files?target=${encodeURIComponent(target)}&set=${set}`,
      );
      expect(response.ok()).toBe(true);
      const { offer_ids: ids } = await response.json();
      for (const id of ids) {
        const card = page.locator(
          `[data-testid="file-offer"][data-offer-id="${id}"]`,
        );
        await expect(card).toHaveAttribute("data-state", "ready");
        for (const action of ["offer-open-tab", "offer-download"]) {
          const control = card.getByTestId(action);
          if (!(await control.count())) continue;
          await card.hover();
          await control.hover();
          const tip = page.getByRole("tooltip");
          await expect(tip).toBeVisible();
          const geometry = await tip.evaluate((el) => {
            const style = getComputedStyle(el);
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (!context)
              throw new Error("Canvas text measurement unavailable");
            context.font = style.font;
            const textWidth = context.measureText(el.textContent ?? "").width;
            const box = el.getBoundingClientRect();
            return {
              width: box.width,
              height: box.height,
              left: box.left,
              right: box.right,
              textWidth,
              lineHeight: parseFloat(style.lineHeight),
              paddingY:
                parseFloat(style.paddingTop) + parseFloat(style.paddingBottom),
            };
          });
          // These short action labels fit on one line, independently of the
          // card's containing block and the trigger's distance from its edge.
          expect(geometry.width).toBeGreaterThanOrEqual(geometry.textWidth);
          expect(geometry.height).toBeLessThanOrEqual(
            geometry.lineHeight + geometry.paddingY + 3,
          );
          expect(geometry.left).toBeGreaterThanOrEqual(0);
          expect(geometry.right).toBeLessThanOrEqual(width);
          if (process.env.OH_OFFER_TOOLTIP_CAPTURE === "1" && id === ids[0])
            await snapshot(
              page,
              resolve(
                `../issues/offer-card-tooltip-narrow/evidence/${set}-${action}-${width}`,
              ),
              {
                labOrigin: new URL(page.url()).origin,
              },
            );
          await page.mouse.move(0, 0);
          await expect(tip).toHaveCount(0);
        }
      }
    }
  });
}
