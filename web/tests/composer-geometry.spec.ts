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
      await page.getByTestId("github-sign-in").click();
      await page
        .getByRole("link")
        .and(page.locator('a[href*="code=42"]'))
        .click();
      // Desktop navigation supplies the route; the same workspace page is
      // exercised on a phone without depending on the mobile menu's state.
      const snapshot = await (
        await page.request.get("/api/v1/snapshot")
      ).json();
      const workspace = snapshot.workspaces.find(
        (w: { name: string }) => w.name === "ordinary-dir",
      );
      await page.goto(`/workspaces/${workspace.workspace_id}`);
      const plus = page.getByTestId(/^(new-conversation|conversation-start)$/);
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
      const controllerReady = page.waitForResponse(
        (response) => response.url().endsWith("/status") && response.ok(),
      );
      await plus.click();
      const editor = page.getByTestId("message-input");
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
      // The created conversation replaces the placeholder's editor; measure
      // the one that stays.
      await expect(page).toHaveURL(/conversation=pi:/);
      await controllerReady;
      await expect(editor).toBeEnabled();
      await expect(editor).toBeFocused();
      // Type (rather than fill) the reported command: input handling must not
      // substitute punctuation, and font shaping must leave it literal too.
      await editor.pressSequentially("!uv --version -> != ===");
      await expect(editor).toHaveValue("!uv --version -> != ===");
      for (const surface of [editor, page.locator(".ah-crow-shell code")]) {
        await expect(surface).toHaveCSS("font-variant-ligatures", "none");
        const features = await surface.evaluate(
          (e) => getComputedStyle(e).fontFeatureSettings,
        );
        expect(features).toContain('"calt" 0');
      }
      // Measure the rendered prefix independently of the textarea value.
      // A missing font/feature, or spacing every bang, must fail this check.
      await page.evaluate(() => document.fonts.ready);
      const advances = await editor.evaluate((element) => {
        const style = getComputedStyle(element);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new Error("No canvas context");
        context.font = `${style.fontSize} ${style.fontFamily}`;
        context.fontKerning = "normal";
        const measure = (text: string) => context.measureText(text).width;
        return {
          cell: measure("x"),
          single: measure("!git") - measure("git"),
          double: measure("!!ls") - measure("ls"),
          later: measure("x!x") - measure("xxx"),
        };
      });
      expect(advances.single / advances.cell).toBeCloseTo(2, 1);
      expect(advances.double / advances.cell).toBeCloseTo(3, 1);
      expect(Math.abs(advances.later)).toBeLessThan(0.5);
      const focusContrast = await editor.evaluate((element) => {
        const box = element.parentElement;
        if (!box) throw new Error("Missing editor surface");
        const style = getComputedStyle(box);
        const luminance = (color: string) => {
          const [r, g, b] = (color.match(/[\d.]+/g) ?? []).map(Number);
          const linear = [r, g, b].map((n) => {
            const c = n / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
        };
        const a = luminance(style.borderColor);
        const b = luminance(style.backgroundColor);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
      expect(focusContrast).toBeGreaterThanOrEqual(3);
      await page
        .context()
        .grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.evaluate(() => navigator.clipboard.writeText("!!ls"));
      await editor.press("ControlOrMeta+a");
      await editor.press("ControlOrMeta+v");
      await expect(editor).toHaveValue("!!ls");
      await editor.press("ControlOrMeta+a");
      await editor.press("ControlOrMeta+c");
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        "!!ls",
      );
      await editor.evaluate((element: HTMLTextAreaElement) =>
        element.setSelectionRange(2, 2),
      );
      await editor.press("Backspace");
      await expect(editor).toHaveValue("!ls");
      await editor.press("Backspace");
      await expect(editor).toHaveValue("ls");
      await editor.press("ControlOrMeta+z");
      await expect(editor).toHaveValue("!ls");
      await editor.evaluate((element: HTMLTextAreaElement) =>
        element.setSelectionRange(0, 2),
      );
      await editor.pressSequentially("!!p");
      await expect(editor).toHaveValue("!!ps");
      // Use Chromium's native IME seam, not a rewritten controlled value.
      await editor.press("End");
      const input = await page.context().newCDPSession(page);
      await input.send("Input.imeSetComposition", {
        text: "あ",
        selectionStart: 1,
        selectionEnd: 1,
      });
      await editor.dispatchEvent("keydown", {
        key: "Enter",
        isComposing: true,
      });
      await input.send("Input.insertText", { text: "あ" });
      await expect(editor).toHaveValue("!!psあ");
      await input.detach();
      await editor.fill("Yksi rivi");
      await expect(editor).toHaveCSS("font-variant-ligatures", "none");
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
        page.getByTestId("send").and(page.locator('[data-mode="send"]')),
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
