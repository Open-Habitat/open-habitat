#!/usr/bin/env node
// Background waits as dots on the worker pill, and neutral exit codes
// (background-wait-chip-dots), from the synthetic lab only. A conductor has
// two working workers and waits on one; a release watcher and a dev server
// are its processes. Spinoffs, processes and three completion notes are
// routed replies; every name and id is invented.
import { chromium } from "@playwright/test";
import { origin, snapshot } from "./session.mjs";

const out = new URL(
  "../../issues/background-wait-chip-dots/evidence/",
  import.meta.url,
).pathname;
const waited = "01m6k8h2d7q0x4kc8vbe9t5mw1";
const unwaited = "01m6k8h2d7q0x4kc8vbe9t5mw2";
const merged = "01m6k8h2d7q0x4kc8vbe9t5mw3";
const now = Date.now();
const min = 60000;
const run = (run_id, title, state, age) => ({
  run_id,
  title,
  state,
  created_at: new Date(now - age * min).toISOString(),
  summary: "",
  preserved: false,
  branch: "",
  worktree: "",
  source_branch: "main",
});
const proc = (id, name, command_preview, edit) => ({
  id,
  name,
  command_preview,
  process_token: `pt_${id}`,
  status: "running",
  started_at: now - 5 * min,
  ended_at: null,
  exit_code: null,
  signal: null,
  end_reason: null,
  wakes_agent: true,
  run_ids: [],
  ...edit,
});
const waitCommand = (id) =>
  `cd ~/src/kasvimaa && taskfleet run wait ${id} --check-in 45m --output json`;
const processes = [
  proc("dev", "dev-palvelin", "npm run dev -- --port 5173", {
    started_at: now - 42 * min,
    wakes_agent: false,
  }),
  proc("rel", "julkaisuvahti", 'ssh testi "release-watch wait --json"', {
    started_at: now - 1 * min,
  }),
  proc("wait", "odota-kastelu", waitCommand(waited), {
    started_at: now - 2 * min,
    run_ids: [waited],
  }),
  proc("tests", "testit", "npm test", {
    status: "exited",
    ended_at: now - 9 * min,
    exit_code: 1,
    wakes_agent: false,
  }),
  proc("rel-old", "julkaisuvahti", 'ssh testi "release-watch wait --json"', {
    status: "exited",
    ended_at: now - 20 * min,
    exit_code: 3,
  }),
  proc("lost", "kuvapalvelin", "npx serve ./kuvat", {
    status: "exited",
    ended_at: now - 30 * min,
    end_reason: "spawn_error",
    wakes_agent: false,
  }),
];
const event = (key, edit) => ({
  entry_key: key,
  kind: "unknown",
  content: { media_type: "text/plain", text: "", complete: true },
  blocks: [
    {
      type: "process_event",
      process_event: {
        kind: "crash",
        process_id: key,
        process_name: "julkaisuvahti",
        command_preview: 'ssh testi "release-watch wait --json"',
        exit_code: 3,
        signal: null,
        end_reason: null,
        delivery: "wake",
        run_ids: [],
        ...edit,
      },
    },
  ],
});
const said = (key, kind, text) => ({
  entry_key: key,
  kind,
  content: { media_type: "text/markdown", text, complete: true },
  ...(kind === "assistant" ? { stop_reason: "stop" } : {}),
});
const thread = [
  said(
    "bgw-u",
    "user",
    "Aja kierros: kastelun ajastus ja lomakkeen saavutettavuus workereille.",
  ),
  said(
    "bgw-a1",
    "assistant",
    "Käynnistin kaksi workeria ja jäin odottamaan Kastelun ajastusta taustalle.",
  ),
  event("bgw-n1", {}),
  said(
    "bgw-a2",
    "assistant",
    "Vahti ohitti julkaisun, koska muutos koski vain dokumentaatiota.",
  ),
  event("bgw-n2", {
    process_name: "odota-kastelu",
    command_preview: waitCommand(waited),
    exit_code: 4,
    run_ids: [waited],
  }),
  event("bgw-n3", {
    kind: "crash",
    process_name: "kuvapalvelin",
    command_preview: "npx serve ./kuvat",
    exit_code: null,
    end_reason: "spawn_error",
    delivery: "context",
  }),
  said(
    "bgw-a3",
    "assistant",
    "Välitarkistus: Kastelun ajastus ajaa yhä testejään. Jatkan odotusta.",
  ),
];

for (const [label, width, height] of [
  ["desktop", 1440, 900],
  ["phone", 390, 844],
]) {
  for (const theme of ["light", "dark"]) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width, height },
      deviceScaleFactor: 2,
      colorScheme: theme,
    });
    const page = await context.newPage();
    try {
      await page.route("**/api/v1/agents/pi:*/spinoffs**", (route) =>
        route.fulfill({
          json: {
            schema_version: 1,
            parent_id: new URL(route.request().url()).pathname
              .split("/agents/")[1]
              .split("/spinoffs")[0],
            availability: "available",
            runs: [
              run(waited, "Kastelun ajastus", "working", 18),
              run(unwaited, "Lomakkeen saavutettavuus", "working", 6),
              run(merged, "Kuvien pakkaus", "merged", 40),
            ],
            transcripts: [],
          },
        }),
      );
      await page.route("**/api/v1/conversations/*/processes**", (route) =>
        route.fulfill({
          json: {
            schema_version: 1,
            owner_generation: "og_lab",
            availability: "available",
            unavailable_reason: null,
            processes,
            interrupted: [],
          },
        }),
      );
      await page.route("**/api/v1/conversations/*/status**", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        body.run_active = false;
        body.state = "idle";
        await route.fulfill({ response, json: body });
      });
      await page.route("**/api/v1/agents/pi:*/history**", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        body.entries = thread;
        await route.fulfill({ response, json: body });
      });
      await page.goto(`${origin}/workspaces`);
      await page.getByTestId("github-sign-in").click();
      await page.getByRole("link", { name: "Alice", exact: true }).click();
      // The phone has no rail: the start page lists the conversation too.
      if (width > 800)
        await page
          .getByRole("navigation")
          .getByTestId("workspace-aurinkokello")
          .click();
      await page
        .locator('a[href*="a1a1a1a1-0000-4000-8000-000000000001"]')
        .first()
        .click();
      const strip = page.getByTestId("background-work");
      const pill = strip.getByTestId("background-spinoffs");
      await pill.waitFor();
      await page.getByTestId("process-completion").first().waitFor();
      await page.waitForTimeout(400);
      await snapshot(page, `${out}${label}-${theme}`);
      await pill.click();
      await strip.getByRole("tabpanel").waitFor();
      await strip.getByTestId("ended-runs").click();
      await page.waitForTimeout(200);
      await snapshot(page, `${out}${label}-${theme}-workerit`, { html: false });
      await strip.getByTestId("background-tab-process").click();
      await strip.getByTestId("ended-runs").click();
      await page.waitForTimeout(200);
      await snapshot(page, `${out}${label}-${theme}-prosessit`, {
        html: false,
      });
    } finally {
      await browser.close();
    }
  }
}
