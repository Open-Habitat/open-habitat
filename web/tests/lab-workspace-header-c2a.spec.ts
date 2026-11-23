import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { expect, test } from "./lab-host";

for (const width of [1280, 390]) {
  for (const locale of ["fi-FI", "en-US"]) {
    test.describe(`${width} ${locale}`, () => {
      test.use({
        viewport: { width, height: 900 },
        locale,
        reducedMotion: "reduce",
      });
      test("@workspace-header-c2a opt-in, tile editing, action layout and Explain survive switching", async ({
        page,
      }) => {
        test.setTimeout(60000);
        await page.goto("/workspaces");
        await page.getByTestId("github-sign-in").click();
        await page
          .getByRole("link")
          .and(page.locator('a[href*="code=42"]'))
          .click();
        const session = await (await page.request.get("/auth/session")).json();
        // A longer default sound must not spill into the neighbouring actions.
        expect(
          (
            await page.request.put("/api/v1/account/preferences", {
              headers: {
                Origin: new URL(page.url()).origin,
                "X-Agent-Host-CSRF": session.csrf,
              },
              data: { sound: { default: "tuulikello" } },
            })
          ).ok(),
        ).toBe(true);
        const model = await (await page.request.get("/api/v1/snapshot")).json();
        const ws = model.workspaces.find(
          (w: { name: string }) => w.name === "aurinkokello",
        );
        let route = `/workspaces/${ws.workspace_id}`;
        const header = page.getByTestId("workspace-strip");
        const switchTo = async (value: "on" | "off") => {
          await page.goto("/settings/experimental");
          const choice = page.getByTestId(
            "experimental-workspace-header-c2a-choice",
          );
          await choice.getByTestId(`segment-${value}`).click();
          await expect(choice.getByTestId(`segment-${value}`)).toHaveAttribute(
            "aria-pressed",
            "true",
          );
          await page.goto(route);
        };
        const capture = async (state: string) => {
          if (!process.env.OH_HEADER_CAPTURE) return;
          await mkdir(process.env.OH_HEADER_CAPTURE, { recursive: true });
          await snapshot(
            page,
            `${process.env.OH_HEADER_CAPTURE}/${locale}-${width}-${state}`,
            { labOrigin: new URL(page.url()).origin },
          );
        };
        await page.goto(route);
        await expect(page.locator(".ah-workspace-page-head")).toBeVisible();
        await expect(header.getByTestId("workspace-title")).toHaveCount(0);
        await capture("off");
        await switchTo("on");
        await expect(header.getByTestId("workspace-title")).toBeVisible();
        await expect(page.locator(".ah-workspace-page-head")).toHaveCount(0);
        await expect(page.getByTestId("workspace-title")).toHaveCount(1);
        await expect(header.getByTestId("copy-path")).toBeVisible();
        await expect(
          header.getByTestId("workspace-archive"),
        ).not.toHaveAttribute("aria-pressed");
        await capture("on");
        if (process.env.OH_HEADER_CAPTURE) {
          for (const theme of ["dark", "contrast"]) {
            await page.evaluate(
              (value) =>
                document.documentElement.setAttribute("data-theme", value),
              theme,
            );
            await capture(`on-${theme}`);
          }
          await page.evaluate(() =>
            document.documentElement.setAttribute("data-theme", "light"),
          );
        }
        const tiles = await header.boundingBox();
        const name = await header.getByTestId("workspace-title").boundingBox();
        const icon = await header.getByTestId("strip-icon").boundingBox();
        const sound = await header.getByTestId("strip-sound").boundingBox();
        const actions = await header
          .getByTestId("workspace-actions")
          .boundingBox();
        expect(tiles && name && icon && sound && actions).toBeTruthy();
        if (!(tiles && name && icon && sound && actions))
          throw new Error("missing header layout");
        const soundValue = await header
          .getByTestId("strip-sound-value")
          .boundingBox();
        expect(soundValue).toBeTruthy();
        if (soundValue)
          expect(soundValue.x + soundValue.width).toBeLessThanOrEqual(
            sound.x + sound.width,
          );
        expect(tiles.x).toBeGreaterThanOrEqual(0);
        expect(tiles.x + tiles.width).toBeLessThanOrEqual(width);
        if (width === 1280) {
          expect(actions.x).toBeGreaterThan(sound.x + sound.width);
          expect(actions.y).toBeCloseTo(icon.y, 0);
        } else {
          expect(name.y).toBeLessThan(icon.y);
          expect(actions.y).toBeGreaterThan(icon.y + icon.height);
          expect(sound.y).toBeCloseTo(icon.y, 0);
        }
        const ids = [
          "new-worktree",
          "open-github",
          "workspace-archive",
          "delete-workspace",
        ];
        const boxes = [];
        for (const id of ids) {
          const button = header.getByTestId(id);
          await expect(button).toHaveAccessibleName(/.+/);
          const box = await button.boundingBox();
          if (!box) throw new Error(`missing ${id}`);
          boxes.push(box);
          if (id !== "new-worktree" || width === 390) {
            expect(box.width).toBe(width === 390 ? 40 : 32);
            expect(box.height).toBe(width === 390 ? 40 : 32);
          }
          if (width === 390) {
            // The agreed 44px touch target is real hit testing, not a CSS assertion.
            expect(
              await button.evaluate((node) => {
                const b = node.getBoundingClientRect();
                return [
                  [b.x - 1, b.y + b.height / 2],
                  [b.right + 1, b.y + b.height / 2],
                  [b.x + b.width / 2, b.y - 1],
                  [b.x + b.width / 2, b.bottom + 1],
                ].every(([x, y]) =>
                  node.contains(document.elementFromPoint(x, y)),
                );
              }),
            ).toBe(true);
          }
          await page.keyboard.press("Tab");
          await ((await button.isDisabled())
            ? button.locator("..")
            : button
          ).focus();
          await expect(page.getByRole("tooltip")).toBeVisible();
          await page.keyboard.press("Escape");
        }
        const archiveBox = boxes[2],
          deleteBox = boxes[3];
        expect(
          deleteBox.x - archiveBox.x - archiveBox.width,
        ).toBeGreaterThanOrEqual(12);
        const violations = await new AxeBuilder({ page })
          .include('[data-testid="workspace-strip"]')
          .analyze();
        expect(violations.violations).toEqual([]);
        const path = await header
          .getByTestId("workspace-path")
          .locator("code")
          .textContent();
        await header.getByTestId("strip-name").click();
        await page.getByTestId("strip-name-input").press("Escape");
        await expect(header.getByTestId("strip-name")).toBeFocused();
        await header.getByTestId("strip-name").click();
        await page
          .getByTestId("strip-name-input")
          .fill("Header layout example");
        const renamed = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === "/api/v1/workspaces" &&
            !!r.request().postData()?.includes('"settings"'),
        );
        await page.getByTestId("strip-name-input").press("Enter");
        const confirmed = await (await renamed).json();
        route = `/workspaces/${confirmed.workspace_id}`;
        await expect(page).toHaveURL(new RegExp(`${route}$`));
        await expect(header.getByTestId("workspace-title")).toHaveText(
          "Header layout example",
        );
        await expect(
          header.getByTestId("workspace-path").locator("code"),
        ).toHaveText(path ?? "");
        if (width === 390) await page.getByTestId("navigation-open").click();
        await page.getByTestId("account-menu-trigger").click();
        await page.getByTestId("menu-explain").click();
        const closeNavigation = page.locator(
          '[data-testid="close-navigation"]:visible',
        );
        if (await closeNavigation.isVisible()) await closeNavigation.click();
        for (const [id, card] of [
          ["new-worktree", "T07"],
          ["open-github", "T03"],
          ["workspace-archive", "T05"],
          ["delete-workspace", "T06"],
          ["copy-path", "T02"],
          ["strip-name", "AS05"],
          ["strip-sound", "AS06"],
        ]) {
          const control = header.getByTestId(id);
          await ((await control.isDisabled())
            ? control.locator("..")
            : control
          ).hover();
          await expect(page.getByTestId("explain-card")).toHaveAttribute(
            "data-card",
            card,
          );
        }
        await header.getByTestId("new-worktree").hover();
        await expect(page.getByTestId("explain-card")).toHaveAttribute(
          "data-card",
          "T07",
        );
        await capture("explain");
        if (process.env.OH_HEADER_CAPTURE && width === 1280) {
          await page.setViewportSize({ width: 1440, height: 900 });
          await header.getByTestId("new-worktree").hover();
          await capture("explain-1440");
          await page.setViewportSize({ width, height: 900 });
        }
        await page.getByTestId("explain-stop").click();
        await header.getByTestId("delete-workspace").click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(header.getByTestId("delete-workspace")).toBeFocused();
        await header.getByTestId("new-worktree").click();
        await expect(page.getByTestId("message-input")).toBeVisible();
        await page.goto(route);
        await switchTo("off");
        await expect(page.locator(".ah-workspace-page-head")).toBeVisible();
        await expect(header.getByTestId("workspace-title")).toHaveCount(0);
        await expect(page.getByTestId("workspace-title")).toHaveText(
          "Header layout example",
        );
        await switchTo("on");
        await header.getByTestId("conversation-start").click();
        await expect(page.getByTestId("message-input")).toBeVisible();
      });
    });
  }
}
