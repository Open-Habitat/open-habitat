import type { Locator } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function expectIconCentred(button: Locator) {
  const offset = await button.evaluate((element) => {
    const outer = element.getBoundingClientRect();
    const svg = element.querySelector("svg");
    const range = document.createRange();
    range.selectNodeContents(element);
    const inner = svg?.getBoundingClientRect() ?? range.getBoundingClientRect();
    return {
      vertical: Math.abs(
        inner.y + inner.height / 2 - outer.y - outer.height / 2,
      ),
      contained: inner.y >= outer.y && inner.bottom <= outer.bottom,
    };
  });
  expect(offset.contained).toBe(true);
  expect(offset.vertical).toBeLessThanOrEqual(3);
}

for (const width of [1440, 390]) {
  for (const theme of ["light", "dark"] as const) {
    test(`@composer-geometry ${width}px ${theme}: centred controls and a steady editor surface`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.request.get("/fixture/scenario?value=ready");
      await page.goto("/workspaces");
      await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
      await page.getByRole("link", { name: "Alice", exact: true }).click();
      // Desktop navigation supplies the route; the same workspace page is
      // exercised on a phone without depending on the mobile menu's state.
      const snapshot = await (
        await page.request.get("/api/v1/snapshot")
      ).json();
      const workspace = snapshot.workspaces.find(
        (w: { name: string }) => w.name === "ordinary-dir",
      );
      await page.goto(`/workspaces/${workspace.workspace_id}`);
      const plus = page.getByRole("button", {
        name: "Aloita uusi Pi-keskustelu",
        exact: true,
      });
      await expect(plus).toBeEnabled();
      await expectIconCentred(plus);
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/api/v1/conversations", async (route) => {
        if (route.request().method() === "POST") await held;
        await route.continue();
      });
      await plus.click();
      const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
      try {
        // While the conversation is created the field is already usable, and
        // the embedded picker and textarea are one surface (no inner slab).
        await expect(editor).toBeEnabled();
        await expect(editor).toBeFocused();
        expect(
          await editor.evaluate((e) => getComputedStyle(e).backgroundColor),
        ).toBe("rgba(0, 0, 0, 0)");
      } finally {
        release();
      }
      await expect(editor).toBeEnabled();
      await editor.fill("Yksi rivi");
      await page.mouse.move(0, 0);
      const background = () =>
        editor.evaluate((e) => getComputedStyle(e).backgroundColor);
      const rest = await background();
      await editor.hover();
      expect(await background()).toBe(rest);
      await editor.fill("Ensimmäinen rivi\nToinen rivi\nKolmas rivi");
      await editor.hover();
      expect(await background()).toBe(rest);
      await expectIconCentred(
        page.getByRole("button", { name: "Lähetä", exact: true }),
      );
      // Every visible SVG-only shared control in the reached view, including
      // disabled title/archive controls, must keep the icon inside its box.
      for (const button of await page
        .locator('[data-ah-primitive="button"]:visible')
        .all()) {
        if (
          await button.evaluate(
            (e) => !!e.querySelector("svg") && !e.textContent?.trim(),
          )
        )
          await expectIconCentred(button);
      }
    });
  }
}
