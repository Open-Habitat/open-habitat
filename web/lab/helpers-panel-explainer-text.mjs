// Synthetic lab only; run under timeout after scripts/lab.sh start.
import { expect } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const out = new URL(
  "../../issues/helpers-panel-explainer-text/evidence/",
  import.meta.url,
).pathname;
for (const language of ["fi", "en-US"]) {
  for (const width of [1440, 390]) {
    const { browser, context, page } = await openLab({
      width,
      height: 900,
      deviceScaleFactor: 2,
    });
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.route("**/api/v1/agents/pi:*/spinoffs**", (route) => {
        const url = new URL(route.request().url());
        return route.fulfill({
          json: {
            schema_version: 1,
            parent_id: url.pathname.split("/agents/")[1].split("/spinoffs")[0],
            availability: "available",
            transcripts: [],
            runs: [
              {
                run_id: "01m6r1q934veb852ke10x2r3ac",
                title: "Review layout",
                created_at: new Date().toISOString(),
                state: "waiting_parent",
                preserved: false,
                branch: "layout-review",
                worktree: "",
                source_branch: "main",
                summary: "",
                harness: "pi",
                resident: {
                  name: "layout-review",
                  round_state: "waiting",
                  rounds: 1,
                  landed_round: 1,
                  report: "Layout reviewed",
                  reported_at: new Date().toISOString(),
                },
              },
            ],
          },
        });
      });
      const session = await (
        await page.request.get(`${origin}/auth/session`)
      ).json();
      for (const data of [
        { language },
        { experimental: { "named-workers": true } },
        { experimental: { "explain-mode": true } },
        { experimental: { "remote-browser": true } },
      ]) {
        expect(
          (
            await page.request.put(`${origin}/api/v1/account/preferences`, {
              headers: { Origin: origin, "X-Agent-Host-CSRF": session.csrf },
              data,
            })
          ).ok(),
        ).toBeTruthy();
      }
      const state = await (
        await page.request.get(`${origin}/api/v1/snapshot`)
      ).json();
      const ws = state.workspaces.find(
        (w) => w.name === "aurinkokello",
      ).workspace_id;
      await page.goto(`${origin}/workspaces/${ws}`);
      await page.getByTestId("conversation-start").first().click();
      await page
        .getByTestId("message-input")
        .fill("näytä kortit taustaprosessi virhekortti tiedosto kaavio");
      await page
        .getByTestId("send")
        .and(page.locator('[data-mode="send"]'))
        .click();
      await expect(page.getByTestId("history-stage-toggle").last()).toBeVisible(
        { timeout: 20000 },
      );
      const target = new URL(page.url()).searchParams.get("conversation");
      expect(
        (
          await page.request.get(
            `${origin}/fixture/files?target=${encodeURIComponent(target)}&set=single`,
          )
        ).ok(),
      ).toBeTruthy();
      await page.reload();
      await expect(page.getByTestId("assets-chip")).toBeVisible();
      await page.getByTestId("background-helpers").click();
      await page.getByTestId("explain-toggle").click();
      const show = async (id, target, name) => {
        await target.scrollIntoViewIfNeeded();
        await target.hover();
        await expect(page.getByTestId("explain-card")).toHaveAttribute(
          "data-card",
          id,
        );
        await snapshot(page, `${out}${language}-${width}-${name}`);
      };
      await show("V15", page.getByTestId("background-helpers"), "helpers");
      await show("V16", page.getByTestId("helper-layout-review"), "helper-row");
      await page.keyboard.press("Escape");
      await page.getByTestId("background-helpers").click();
      const chip = page.getByTestId("assets-chip");
      await chip.click();
      await page.getByTestId("explain-toggle").click();
      await show("V17", page.getByTestId("asset-open").first(), "asset-row");
      await show(
        "V25",
        page.getByTestId("assets-list").getByTestId("offer-download").first(),
        "download",
      );
      await page.keyboard.press("Escape");
      await page.getByTestId("assets-close").click();
      await page.getByTestId("browser-chip").click();
      await page.getByTestId("explain-toggle").click();
      await show("B01", page.getByTestId("browser-chip"), "browser");
      await show("B03", page.getByTestId("browser-look"), "browser-look");
      await page.keyboard.press("Escape");
    } finally {
      await context.close();
      await browser.close();
    }
  }
}
