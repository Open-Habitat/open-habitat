import { mkdir, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { answeringTaskfleet } from "./answering-taskfleet";
import { archiveFromConfirmedView } from "./archive-proof";
import { expect, test } from "./worker-host";

const agent = "pi:11111111-1111-4111-8111-111111111111";
test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
answeringTaskfleet(test);

for (const width of [390, 1280]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`damaged archive restore stays beside its control (${width}, ${colorScheme})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      test.setTimeout(60000);
      expect(
        (await page.request.get("/fixture/history?mode=ready")).status(),
      ).toBe(204);
      await page.goto("/");
      await page.getByTestId("github-sign-in").click();
      await page
        .getByRole("link")
        .and(page.locator('a[href*="code=42"]'))
        .click();
      await page.goto(`/agents/${agent}`);
      const header = page.locator(".ah-agent-header");
      await archiveFromConfirmedView(page, () =>
        header.getByTestId("archive-conversation"),
      );
      await page.goto(`/agents/${agent}`);
      const headerRestore = header
        .getByTestId("restore-conversation")
        .or(
          header
            .getByTestId("archive-conversation")
            .and(page.locator('[data-archive-state="archived"]')),
        );
      await page.setViewportSize({ width, height: 900 });
      const restore = page.getByTestId("archived-foot-restore");
      await expect(restore).toBeEnabled();
      expect(
        (await page.request.get("/fixture/history?mode=corrupt")).status(),
      ).toBe(204);
      const refuse = async (action = restore) => {
        const reply = page.waitForResponse(
          (r) =>
            r.request().method() === "POST" &&
            new URL(r.url()).pathname === "/api/v1/workspaces",
        );
        await action.click();
        const response = await reply;
        expect(response.status()).toBe(409);
        expect((await response.json()).error.code).toBe("history_damaged");
        await expect(page.getByTestId("archive-error")).toBeVisible();
      };
      await refuse();
      const notice = page.getByTestId("archive-notice");
      await expect(notice.getByTestId("restore-notice")).toHaveCount(0);
      await expect(
        page.getByTestId("archived-foot").getByTestId("archive-notice"),
      ).toBeVisible();
      const noticeBox = await notice.boundingBox();
      const buttonBox = await restore.boundingBox();
      if (!noticeBox || !buttonBox) throw new Error("Missing restore feedback");
      expect(noticeBox.y + noticeBox.height).toBeLessThanOrEqual(buttonBox.y);
      expect(buttonBox.y - (noticeBox.y + noticeBox.height)).toBeLessThan(40);
      expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(900);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      if (process.env.OH_VISUAL_CAPTURE === "1") {
        const dir = "/var/tmp/agent-keep/archive-restore-notice-near-button";
        await mkdir(dir, { recursive: true });
        const base = `${dir}/restore-${width}-${colorScheme}`;
        await page.screenshot({ path: `${base}.png`, fullPage: true });
        await writeFile(`${base}.html`, await page.content());
      }
      const axe = await new AxeBuilder({ page })
        .include('[data-testid="archive-notice"]')
        .analyze();
      expect(axe.violations).toEqual([]);
      await notice.getByTestId("notice-close").click();
      await expect(page.getByTestId("archive-error")).toHaveCount(0);
      // A header press still reports in the header area, never in the foot.
      if (width < 760) await header.getByTestId("conversation-menu").click();
      await refuse(
        width < 760 ? page.getByTestId("menu-restore") : headerRestore,
      );
      await expect(
        page.getByTestId("notice-area").getByTestId("archive-notice"),
      ).toBeVisible();
      await expect(
        page.getByTestId("archived-foot").getByTestId("archive-notice"),
      ).toHaveCount(0);
      await notice.getByTestId("notice-close").click();
      await refuse();
      // Client-side navigation, not a reload that would erase all app state.
      if (width < 760) await page.getByTestId("navigation-open").click();
      await page
        .getByRole("navigation")
        .getByTestId("workspace-ordinary-dir")
        .click();
      await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
      await expect(page).toHaveURL(/conversation=pi:/);
      await expect(page.getByTestId("archive-notice")).toHaveCount(0);
      await expect(page.getByTestId("archive-error")).toHaveCount(0);
    });
  }
}
