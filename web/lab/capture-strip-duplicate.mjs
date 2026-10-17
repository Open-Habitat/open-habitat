// Synthetic lab only (strip-duplicate-spinoff-ui): a seeded conversation with
// history, one running background process and one working spinoff created
// after the newest row, as on the test server. Process inventory and spinoff
// read are synthetic wire fixtures; no personal browser or live data.
// Usage: node web/lab/capture-strip-duplicate.mjs <before|after>
import { expect } from "@playwright/test";
import { openLab, snapshot } from "./session.mjs";

const out = "issues/strip-duplicate-spinoff-ui";
const label = process.argv[2] ?? "after";
const { browser, page } = await openLab();
const now = Date.now();
await page.route("**/api/v1/conversations/*/processes**", (route) =>
  route.fulfill({
    json: {
      schema_version: 1,
      owner_generation: "og_lab",
      availability: "available",
      unavailable_reason: null,
      interrupted: [],
      processes: [
        {
          id: "proc_8c2e",
          name: "testit",
          command_preview: "ptw tests/ -- -q",
          process_token: "pt_proc_8c2e",
          status: "running",
          started_at: now - 120000,
          ended_at: null,
          exit_code: null,
          signal: null,
          end_reason: null,
          wakes_agent: false,
          run_ids: [],
        },
      ],
    },
  }),
);
await page.route("**/api/v1/agents/pi:*/spinoffs**", (route) =>
  route.fulfill({
    json: {
      schema_version: 1,
      parent_id: new URL(route.request().url()).pathname
        .split("/agents/")[1]
        .split("/spinoffs")[0],
      availability: "available",
      runs: [
        {
          run_id: "01m51m3q8z5c1rv7kd2tx6hnwe",
          title: "ui-test-ok",
          state: "working",
          created_at: new Date(now).toISOString(),
          summary: "",
          preserved: false,
          branch: "",
          worktree: "",
          source_branch: "main",
        },
      ],
      transcripts: [],
    },
  }),
);
try {
  for (const [width, theme] of [
    [1440, "light"],
    [1440, "dark"],
    [390, "light"],
    [390, "dark"],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(
      `${page.url().split("/").slice(0, 3).join("/")}/workspaces`,
    );
    if (width === 390)
      await page.getByRole("button", { name: "Avaa navigaatio" }).click();
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Miksi CI epäonnistuu macOS:llä?" })
      .click();
    const strip = page.getByRole("region", { name: "Taustatyö" });
    await expect(
      strip.getByRole("button", { name: /^Spinoffit:/ }),
    ).toBeVisible();
    await page.waitForTimeout(500);
    await snapshot(
      page,
      `${out}/${label}-${width === 390 ? "phone" : "desktop"}-${theme}`,
      { html: label === "after" },
    );
  }
} finally {
  await browser.close();
}
