import { resolve } from "node:path";
import { snapshot } from "../lab/session.mjs";
import { expect, test } from "./lab-host";

test.use({ deviceScaleFactor: 2, reducedMotion: "reduce" });

for (const touch of [false, true]) {
  test.describe(touch ? "touch offers" : "pointer offers", () => {
    test.use({ hasTouch: touch });
    test("corner actions do not squeeze a narrow title column", async ({
      page,
    }) => {
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
      const response = await page.request.get(
        `/fixture/files?target=${encodeURIComponent(target)}&set=types`,
      );
      expect(response.ok()).toBe(true);
      const { offer_ids: ids } = await response.json();
      const card = page.locator(
        `[data-testid="file-offer"][data-offer-id="${ids[3]}"]`,
      );
      await expect(card).toHaveAttribute("data-state", "ready");
      expect(
        await page.evaluate(() => matchMedia("(hover: hover)").matches),
      ).toBe(!touch);

      // The production assets list currently uses compact rows, not OfferCard.
      // Exercise the actual card at list-sized widths rather than testing a
      // different component or relying on a wide conversation to expose this.
      for (const width of [340, 240]) {
        await card.evaluate((el, width) => {
          el.style.width = `${width}px`;
        }, width);
        await page.mouse.move(0, 0);
        const measure = () =>
          card.evaluate((el) => {
            const body = el.querySelector<HTMLElement>(".ah-offer-body");
            const acts = el.querySelector<HTMLElement>(".ah-offer-acts");
            if (!body || !acts)
              throw new Error("Offer body or actions missing");
            const before = body.getBoundingClientRect();
            const actions = acts.getBoundingClientRect();
            // Removing only the action row must not give the title more width.
            const oldDisplay = acts.style.display;
            acts.style.display = "none";
            const without = body.getBoundingClientRect().width;
            acts.style.display = oldDisplay;
            return {
              width: before.width,
              without,
              bodyBottom: before.bottom,
              actionsTop: actions.top,
            };
          });
        const idle = await measure();
        expect(Math.abs(idle.width - idle.without)).toBeLessThanOrEqual(1);
        if (touch) {
          await expect(card.locator(".ah-offer-acts")).toBeVisible();
          expect(idle.actionsTop).toBeGreaterThanOrEqual(idle.bodyBottom);
        } else {
          await card.hover();
          await expect(card.locator(".ah-offer-acts")).toBeVisible();
          expect(
            Math.abs((await measure()).width - idle.width),
          ).toBeLessThanOrEqual(1);
          await card.getByTestId("offer-open").focus();
          await page.mouse.move(0, 0);
          await expect(card.locator(".ah-offer-acts")).toBeVisible();
          expect(
            Math.abs((await measure()).width - idle.width),
          ).toBeLessThanOrEqual(1);
        }
        if (process.env.OH_OFFER_LAYOUT_CAPTURE === "1") {
          await snapshot(
            page,
            resolve(
              `../issues/offer-card-corner-icons-in-flow/evidence/${touch ? "touch" : "pointer"}-${width}`,
            ),
            {
              labOrigin: new URL(page.url()).origin,
              region: `[data-testid="file-offer"][data-offer-id="${ids[3]}"]`,
            },
          );
        }
      }
    });
  });
}
