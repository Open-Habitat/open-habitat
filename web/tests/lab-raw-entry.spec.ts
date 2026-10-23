import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

for (const width of [1440, 390]) {
  for (const theme of ["light", "dark"] as const) {
    test(`@a11y raw native bookkeeping stays out of the conversation ${width} ${theme}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.request.get("/fixture/conversations-reset");
      await page.request.get("/fixture/scenario?value=ready");
      const warnings: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "warning") warnings.push(message.text());
      });
      let injected = 0;
      // Exercise the actual legacy controller-status path that produced the row,
      // beside real native history and the typed event stream.
      await page.route("**/api/v1/conversations/*/status*", async (route) => {
        const response = await route.fetch();
        const status = await response.json();
        status.events = [
          ...status.events,
          { type: "entry_appended" },
          { type: "queue_update" },
          { type: "session_info_changed" },
          { type: "compaction_end" },
          { type: "response", payload: "private-control-sentinel" },
          { type: "future_event", payload: "private-unknown-sentinel" },
        ];
        injected++;
        await route.fulfill({ response, json: status });
      });
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      const state = await (await page.request.get("/api/v1/snapshot")).json();
      const workspace = state.workspaces.find(
        (w: { name: string }) => w.name === "aurinkokello",
      );
      await page.goto(`/workspaces/${workspace.workspace_id}`);
      await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
      await expect.poll(() => injected).toBeGreaterThan(0);
      await expect.poll(() => warnings.length).toBeGreaterThan(0);
      await expect(page.getByTestId("unpresented-event")).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText(
        "private-control-sentinel",
      );
      await expect(page.locator("body")).not.toContainText(
        "private-unknown-sentinel",
      );
      expect(warnings.join("\n")).not.toMatch(
        /private-|future_event|entry_appended/,
      );
      // A supported message remains usable and is not lost with the raw frames.
      await page.getByTestId("message-input").fill("Tarkista muutos.");
      await page
        .getByTestId("send")
        .and(page.locator('[data-mode="send"]'))
        .click();
      await expect(page.locator("main")).toContainText(
        'Selvä. Kysyit: "Tarkista muutos.".',
        { timeout: 20000 },
      );
      await expect(page.getByTestId("composer-stop")).toHaveCount(0);
      await expect(page.getByTestId("unpresented-event")).toHaveCount(0);
      expect(
        (await new AxeBuilder({ page }).include("main").analyze()).violations,
      ).toEqual([]);
      await snapshot(page, info.outputPath(`conversation-${width}-${theme}`), {
        labOrigin: new URL(page.url()).origin,
      });
    });
  }
}
