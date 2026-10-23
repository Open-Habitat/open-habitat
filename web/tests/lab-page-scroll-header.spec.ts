import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { expect, test } from "./lab-host";

test.use({ reducedMotion: "reduce" });

for (const width of [1440, 390]) {
  for (const singleWorkspace of [false, true]) {
    test(`@a11y @page-scroll-header ${width}px ${singleWorkspace ? "top bar" : "sidebar"}: margins scroll the thread, never the shell`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      expect((await page.request.get("/fixture/open-at-end")).status()).toBe(
        204,
      );
      if (singleWorkspace) {
        expect(
          (
            await page.request.get(
              "/fixture/keep-workspaces?names=aurinkokello",
            )
          ).status(),
        ).toBe(204);
      }
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page
        .getByRole("link")
        .and(page.locator('a[href*="code=42"]'))
        .click();
      const state = await (await page.request.get("/api/v1/snapshot")).json();
      const agent = state.agents.find((a: { title: { display: string } }) =>
        a.title.display.includes("Avaamisen tarkistus"),
      );
      expect(agent).toBeTruthy();
      await page.goto(
        `/workspaces/${agent.workspace_id}?conversation=${encodeURIComponent(agent.agent_id)}`,
      );
      const stream = page.getByTestId("conversation-stream");
      const header = page.locator(".ah-conversation-frame > .ah-agent-header");
      await expect(stream).toBeVisible();
      await expect(page.getByTestId("stage-reply").last()).toBeInViewport();
      await expect(page.locator(".ah-single-bar")).toHaveCount(
        singleWorkspace ? 1 : 0,
      );
      for (const height of [900, 600]) {
        await page.setViewportSize({ width, height });
        // The phone shell follows visualViewport resize events asynchronously.
        await expect
          .poll(
            async () =>
              (await page.locator(".ah-app-shell").boundingBox())?.height,
          )
          .toBe(height);
        await expect
          .poll(() =>
            stream.evaluate((el) => el.scrollHeight - el.clientHeight),
          )
          .toBeGreaterThan(500);
        const headerBounds = await header.boundingBox();
        const bounds = await stream.boundingBox();
        const main = await page.locator("main").boundingBox();
        if (!headerBounds || !bounds || !main)
          throw new Error("Missing shell geometry");
        const headerTop = headerBounds.y;
        // Aim at the viewport's actual margins, not just the text column.
        for (const x of [main.x + 3, main.x + main.width - 3]) {
          await stream.evaluate((el) => {
            el.scrollTop = el.scrollHeight;
          });
          const before = await stream.evaluate((el) => el.scrollTop);
          await page.mouse.move(x, bounds.y + bounds.height / 2);
          await page.mouse.wheel(0, -400);
          await expect
            .poll(() => stream.evaluate((el) => el.scrollTop))
            .toBeLessThan(before - 100);
          await expect
            .poll(async () => (await header.boundingBox())?.y)
            .toBe(headerTop);
          expect(await page.evaluate(() => window.scrollY)).toBe(0);
        }
        // At either end the gesture must not chain to main or the document.
        for (const [edge, delta] of [
          [0, -2000],
          [1, 2000],
        ]) {
          await stream.evaluate((el, end) => {
            el.scrollTop = end ? el.scrollHeight : 0;
          }, edge);
          await page.mouse.wheel(0, delta);
          await expect
            .poll(() =>
              page.evaluate(() => ({
                page: window.scrollY,
                main: document.querySelector("main")?.scrollTop,
                overflow:
                  document.documentElement.scrollHeight - window.innerHeight,
              })),
            )
            .toEqual({ page: 0, main: 0, overflow: 0 });
          await expect(header).toBeInViewport({ ratio: 1 });
        }
      }
      await page.setViewportSize({ width, height: 900 });
      for (const colorScheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme });
        // Audit the changed shell, not the message components another worker owns.
        expect(
          (await new AxeBuilder({ page }).exclude(".ah-feed").analyze())
            .violations,
        ).toEqual([]);
        if (!singleWorkspace) {
          await stream.evaluate((el) => {
            el.scrollTop = el.scrollHeight - el.clientHeight - 400;
          });
          await snapshot(
            page,
            info.outputPath(`scroll-${width}-${colorScheme}`),
            { labOrigin: new URL(page.url()).origin },
          );
        }
      }
    });
  }
}
