// Synthetic lab and accepted prototype only (implement-background-strip):
// the Merkit direction of round 2026-10-16-taustatyo-riff against production.
// The lab's fake Pi has no process extension, so the process inventory and
// the spinoff read are synthetic wire fixtures in the round's story. Build
// the round first: node design-system/prototypes/build.mjs rounds/2026-10-16-taustatyo-riff

import { resolve } from "node:path";
import { expect } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const out = "issues/implement-background-strip";
const round = `file://${resolve("design-system/prototypes/dist/2026-10-16-taustatyo-riff.html")}`;
const { browser, page, context } = await openLab();
const proto = await context.newPage();
const now = Date.now();
const min = 60000;
const readme = "01m51k8w2c6v9tq4hd7nx3bfza";
const proc = (id, name, command, start, extra = {}) => ({
  id,
  name,
  command_preview: command,
  process_token: `pt_${id}`,
  status: "running",
  started_at: now - start * min,
  ended_at: null,
  exit_code: null,
  signal: null,
  end_reason: null,
  wakes_agent: false,
  run_ids: [],
  ...extra,
});
const inventory = {
  schema_version: 1,
  owner_generation: "og_lab",
  availability: "available",
  unavailable_reason: null,
  interrupted: [],
  processes: [
    proc("proc_7d40", "hidas-testi", "python3 -m pytest tests/slow -q", 2, {
      wakes_agent: true,
    }),
    proc("proc_8c2e", "testit", "ptw tests/ -- -q", 6),
    proc(
      "proc_3f1a",
      "sivu",
      "python3 -u -m http.server 8000 --directory site",
      3,
    ),
    proc(
      "proc_51d0",
      "haku",
      "python3 scripts/fetch_status.py --since 2026-09-01",
      5,
      {
        status: "exited",
        ended_at: now - 4 * min,
        exit_code: 0,
      },
    ),
    proc(
      "proc_0b77",
      "kello",
      "python3 scripts/watch_status.py --interval 60",
      2,
      {
        status: "exited",
        ended_at: now - 2 * min,
        exit_code: 1,
      },
    ),
    proc(
      "proc_c911",
      "odota-readme",
      `taskfleet run wait ${readme} --output json`,
      4,
      {
        wakes_agent: true,
        run_ids: [readme],
      },
    ),
  ],
};
const run = (run_id, title, state, start, extra = {}) => ({
  run_id,
  title,
  state,
  created_at: new Date(now - start * min).toISOString(),
  summary: "",
  preserved: false,
  branch: "",
  worktree: "",
  source_branch: "main",
  ...extra,
});
const runs = [
  run("01m51h2d7q0x4kc8vbe9t5mwra", "CI: pip-välimuisti", "merged", 25),
  run(
    "01m51j6r3n8w2ty5qc0hd4ks1v",
    "Aikavyöhyke tulosteeseen",
    "unmerged",
    22,
    {
      preserved: true,
      branch: "wt/j6r-timezone",
    },
  ),
  run("01m51m3q8z5c1rv7kd2tx6hnwe", "Testit aikavyöhykkeille", "working", 7),
  run(readme, "README: --today-esimerkki", "working", 4),
];
await page.route("**/api/v1/conversations/*/processes**", (route) =>
  route.fulfill({
    json: route.request().url().includes("/output?")
      ? {
          schema_version: 1,
          process_id: "proc_7d40",
          process_token: "pt_proc_7d40",
          owner_generation: "og_lab",
          omitted_before: 0,
          retention_restarted: false,
          lines: [
            "tests/slow/test_backfill.py ........                                  [ 40%]",
            "tests/slow/test_history.py ......                                    [ 70%]",
          ].map((text) => ({ stream: "stdout", text })),
        }
      : inventory,
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
      runs,
      transcripts: [],
    },
  }),
);

async function protoState(state, width, theme) {
  await proto.setViewportSize({ width: width + 32, height: 1050 });
  await proto.goto(round);
  await proto.keyboard.press("3");
  await proto.selectOption("#theme", theme);
  await proto.locator("#phone").setChecked(width === 390);
  await proto.addStyleTag({
    content: `.frame {width:${width}px!important; max-width:none!important; flex-shrink:0!important; height:900px!important}`,
  });
  // The turn plays and ends; the bells belong to the ended turn.
  await expect(proto.locator(".bg-corner.wait").first()).toBeVisible({
    timeout: 90000,
  });
  if (state !== "rest") {
    await proto.locator(".bg-badge.spin").click();
    if (state === "processes")
      await proto.locator('.bg-tab[data-key="proc"]').click();
  }
  await proto.locator(".frame").screenshot({
    path: `${out}/round-${state}-${width === 390 ? "phone" : "desktop"}-${theme}.png`,
  });
}

async function labState(state, width, theme) {
  // Start from the seeded lab: no earlier capture conversations or their Pi.
  await page.request.get(`${origin}/fixture/daemon-restart`);
  await page.request.get(`${origin}/fixture/lab-conversations-clean`);
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(`${origin}/workspaces`);
  if (width === 390)
    await page.getByRole("button", { name: "Avaa navigaatio" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Uusi keskustelu työtilassa aurinkokello" })
    .click();
  const strip = page.getByRole("region", { name: "Taustatyö" });
  await expect(strip.locator(".ah-bg-corner.wait")).toHaveCount(2);
  if (state === "spinoffs" || state === "processes" || state === "window")
    await strip.getByRole("button", { name: /^Spinoffit:/ }).click();
  if (state === "processes" || state === "window")
    await strip.getByRole("tab", { name: /Prosessit/ }).click();
  if (state === "window") {
    await strip.getByRole("button", { name: /^hidas-testi/ }).click();
    await expect(page.getByText("[ 70%]", { exact: false })).toBeVisible();
  }
  await page.waitForTimeout(300);
  await snapshot(
    page,
    `${out}/lab-${state}-${width === 390 ? "phone" : "desktop"}-${theme}`,
  );
}

try {
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"])
      for (const state of ["rest", "spinoffs", "processes", "window"]) {
        if (state !== "window") await protoState(state, width, theme);
        await labState(state, width, theme);
      }
} finally {
  await browser.close();
}
