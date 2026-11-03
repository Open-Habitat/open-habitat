import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { expect, test } from "./lab-host";

// The pending title's arrow and dots are motion; each case turns it off once
// to see them stop.
test.use({ reducedMotion: "no-preference" });

for (const width of [1440, 390]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`title generation preserves the header at ${width}px ${colorScheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page
        .getByRole("link")
        .and(page.locator('a[href*="code=42"]'))
        .click();
      const state = await (await page.request.get("/api/v1/snapshot")).json();
      const agent = state.agents.find(
        (a: { history: string }) => a.history === "readable",
      );
      expect(agent).toBeTruthy();
      const original =
        "CI-ajon aikakatkaisu, joka toistuu vain maanantaiaamuisin";
      let complete = false;
      const replacement = "Synteettinen uusi otsikko";
      await page.route("**/api/v1/snapshot", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        body.agents.find(
          (a: { agent_id: string }) => a.agent_id === agent.agent_id,
        ).title.display = complete ? replacement : original;
        await route.fulfill({ response, json: body });
      });
      await page.goto(
        `/workspaces/${agent.workspace_id}?conversation=${encodeURIComponent(agent.agent_id)}`,
      );
      const title = page.getByTestId("workspace-title");
      const row = page.getByTestId("conversation-title");
      // On a phone the action lives in the header menu, without the arrow.
      const phone = width < 800;
      const menu = page.getByTestId("conversation-menu");
      const action = phone
        ? page.getByRole("menuitem").and(page.getByTestId("menu-retitle"))
        : page.getByTestId("conversation-retitle");
      const openAction = async () => {
        if (phone && !(await action.isVisible())) await menu.click();
      };
      await expect(title).toHaveText(original);
      for (const failed of [false, true]) {
        let release!: () => void;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route("**/history_title", async (route) => {
          await held;
          if (!failed) complete = true;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              schema_version: 1,
              state: failed ? "failed" : "done",
              ...(failed ? { reason: "model_unavailable" } : {}),
            }),
          });
        });
        await openAction();
        await action.click();
        await expect(row).toHaveAttribute("aria-busy", "true");
        await expect(title).toHaveText(failed ? replacement : original);
        await openAction();
        await expect(action).toBeDisabled();
        if (phone) await page.keyboard.press("Escape");
        await expect(page.getByTestId("title-dots")).toBeVisible();
        const dots = page.getByTestId("title-dots").locator("i");
        const arrow = page.getByTestId("title-arrow");
        if (!phone)
          expect(
            await arrow.evaluate((el) => el.getAnimations().length),
          ).toBeGreaterThan(0);
        expect(
          await dots.first().evaluate((el) => el.getAnimations().length),
        ).toBeGreaterThan(0);
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        expect(
          await dots.first().evaluate((el) => el.getAnimations().length),
        ).toBe(0);
        expect(await arrow.evaluate((el) => el.getAnimations().length)).toBe(0);
        await expect(phone ? menu : action).toBeInViewport({ ratio: 1 });
        if (!failed) {
          expect(
            (await new AxeBuilder({ page }).exclude(".ah-feed").analyze())
              .violations,
          ).toEqual([]);
          if (process.env.OH_VISUAL_CAPTURE === "1")
            await snapshot(
              page,
              fileURLToPath(
                new URL(
                  `../../issues/title-regenerate-arrow-spin/evidence/pending-${width}-${colorScheme}`,
                  import.meta.url,
                ),
              ),
              { labOrigin: new URL(page.url()).origin },
            );
        }
        release();
        await expect(row).toHaveAttribute("aria-busy", "false");
        await expect(title).toHaveText(replacement);
        await openAction();
        await expect(action).toBeEnabled();
        if (phone) await page.keyboard.press("Escape");
        await page.emulateMedia({
          colorScheme,
          reducedMotion: "no-preference",
        });
        expect(await arrow.evaluate((el) => el.getAnimations().length)).toBe(0);
        expect(
          await dots.first().evaluate((el) => el.getAnimations().length),
        ).toBe(0);
        if (failed) await expect(page.getByTestId("title-error")).toBeVisible();
        await page.unroute("**/history_title");
        await page.emulateMedia({
          colorScheme,
          reducedMotion: "no-preference",
        });
      }
    });
  }
}
