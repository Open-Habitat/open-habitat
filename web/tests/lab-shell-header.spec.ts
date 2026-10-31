import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { expect, test } from "./lab-host";

test.use({ reducedMotion: "reduce" });

for (const width of [1440, 390]) {
  for (const oneWorkspace of [false, true]) {
    test(`@a11y shell header survives navigation and scrolling at ${width}px ${oneWorkspace ? "one workspace" : "many workspaces"}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 600 });
      expect((await page.request.get("/fixture/open-at-end")).status()).toBe(
        204,
      );
      if (oneWorkspace) {
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
      for (const path of [
        "/workspaces",
        `/workspaces/${agent.workspace_id}?conversation=${encodeURIComponent(agent.agent_id)}`,
        "/settings",
      ]) {
        await page.goto(path);
        const header = page.locator(
          width === 390 ? ".ah-mobile-toolbar" : ".ah-rail-head",
        );
        await expect(header).toBeInViewport({ ratio: 1 });
        const conversationHeader = page.locator(
          ".ah-conversation-frame > .ah-agent-header",
        );
        if (path.includes("?conversation="))
          await expect(conversationHeader).toBeInViewport({ ratio: 1 });
        const main = page.locator("main");
        const bounds = await main.boundingBox();
        if (!bounds) throw new Error("Missing main geometry");
        await page.mouse.move(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        );
        await page.mouse.wheel(0, 3000);
        // Also jump to the boundary: do not let an assertion race the wheel's
        // asynchronous scroll, or pass just because the header starts visible.
        await main.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        await expect(header).toBeInViewport({ ratio: 1 });
        if (path.includes("?conversation="))
          await expect(conversationHeader).toBeInViewport({ ratio: 1 });
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
        for (const colorScheme of ["light", "dark"] as const) {
          await page.emulateMedia({ colorScheme });
          expect(
            (await new AxeBuilder({ page }).exclude(".ah-feed").analyze())
              .violations,
          ).toEqual([]);
          if (oneWorkspace || !path.includes("?conversation=")) continue;
          await snapshot(
            page,
            info.outputPath(`conversation-${width}-${colorScheme}`),
            { labOrigin: new URL(page.url()).origin },
          );
        }
      }
    });
  }
}
