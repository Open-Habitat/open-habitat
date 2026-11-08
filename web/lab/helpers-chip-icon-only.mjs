// Synthetic lab evidence: start scripts/lab.sh, then run this under timeout.
import { expect } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const out = new URL(
  "../../issues/helpers-chip-icon-only/evidence/",
  import.meta.url,
).pathname;
for (const language of ["fi", "en-US"]) {
  const { browser, context, page } = await openLab({ deviceScaleFactor: 2 });
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
              state: "working",
              preserved: false,
              branch: "",
              worktree: "",
              source_branch: "main",
              summary: "",
              harness: "pi",
              resident: {
                name: "layout-review",
                round_state: "working",
                rounds: 1,
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
    ]) {
      const response = await page.request.put(
        `${origin}/api/v1/account/preferences`,
        {
          headers: { Origin: origin, "X-Agent-Host-CSRF": session.csrf },
          data,
        },
      );
      expect(response.ok()).toBeTruthy();
    }
    const state = await (
      await page.request.get(`${origin}/api/v1/snapshot`)
    ).json();
    const ws = state.workspaces.find(
      (w) => w.name === "aurinkokello",
    ).workspace_id;
    await page.goto(`${origin}/workspaces/${ws}`);
    await page.getByTestId("conversation-start").first().click();
    const chip = page.getByTestId("background-helpers");
    await expect(chip).toBeVisible();
    await expect(chip).toHaveText("");
    await expect(chip).toHaveAccessibleName(/\S/);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await expect(chip).toBeVisible();
      await page.mouse.move(0, 0);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await snapshot(page, `${out}${language}-${width}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }
}
