import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Spinoff } from "../src/app/spinoffs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});

test("worker balls keep state and wait independent, with an explain legend", async ({
  page,
}) => {
  const states = [
    "working",
    "working",
    "idle",
    "waiting_parent",
    "unknown",
    "merged",
    "unmerged",
    "failed",
  ] as const;
  const runs: Spinoff[] = states.map((state, n) => ({
    run_id: `01m6wb${n}`.padEnd(26, "0"),
    title: `worker-${n}`,
    state,
    created_at: new Date().toISOString(),
    preserved: state === "unmerged",
    branch: "",
    worktree: "",
    source_branch: "main",
    summary: "",
  }));
  let extra = false;
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    let n = 0;
    for (const agent of body.agents) {
      // Archived conversations are in the snapshot but not on the rail.
      if (n >= 3 || agent.archive === "archived") continue;
      if (n < 2) agent.spinoffs_working = 1;
      else delete agent.spinoffs_working;
      if (n === 2) agent.spinoffs_idle = 1;
      else delete agent.spinoffs_idle;
      agent.process = "daemon_managed_live";
      agent.activity = "idle";
      agent.waiting_on =
        n === 0
          ? [
              {
                process_id: "proc_wait",
                name: "wait",
                kind: "taskfleet_wait",
                run_ids: [runs[0].run_id],
              },
            ]
          : [];
      n++;
    }
    await route.fulfill({ response, json: body });
  });
  await page.route("**/api/v1/agents/pi:*/spinoffs**", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        parent_id: new URL(route.request().url()).pathname
          .split("/agents/")[1]
          .split("/spinoffs")[0],
        availability: "available",
        transcripts: [],
        runs: extra
          ? [
              ...runs,
              {
                ...runs[2],
                run_id: "01m6wbextra".padEnd(26, "0"),
                title: "extra-idle",
              },
            ]
          : runs,
      },
    }),
  );
  await page.route("**/api/v1/conversations/*/processes**", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        owner_generation: "og_example",
        availability: "available",
        unavailable_reason: null,
        interrupted: [],
        processes: [
          {
            id: "proc_wait",
            name: "wait",
            process_token: "pt_wait",
            status: "running",
            started_at: Date.now(),
            command_preview: "",
            ended_at: null,
            exit_code: null,
            signal: null,
            end_reason: null,
            wakes_agent: true,
            run_ids: [runs[0].run_id, runs[2].run_id, runs[3].run_id],
          },
        ],
      },
    }),
  );
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const session = await (await page.request.get("/auth/session")).json();
  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": session.csrf,
        },
        data: { experimental: { "explain-mode": true } },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId("conversation-start").first().click();
  const rail = page.getByRole("navigation");
  // Sub-agents are dots orbiting the row mark's resident (Jari 14.11.2026);
  // the branch mark at the row's end is gone.
  await expect(rail.locator(".ah-worker-branch")).toHaveCount(0);
  const sub = (state: string) =>
    rail
      .locator(`[data-testid="rail-mark"] .oh-sub[data-state="${state}"]`)
      .first();
  await expect(sub("working")).toBeAttached();
  await expect(sub("waiting")).toBeAttached();
  // A working sub-agent breathes; with reduced motion it stands still and
  // the waiting one keeps its own colour.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(
    await sub("working").evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("oh-breathe");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await sub("working").evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  expect(
    await sub("waiting").evaluate((el) => getComputedStyle(el).fill),
  ).not.toBe(await sub("working").evaluate((el) => getComputedStyle(el).fill));
  const railRows = rail.locator(".ah-waiting-spinoff");
  const railCapture = process.env.OH_RAIL_BALL_CAPTURE;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    if (width === 390) await page.getByTestId("navigation-open").click();
    await expect(railRows).toHaveCount(3);
    for (const item of await railRows.all()) {
      const edge = await item.locator(".ah-now-row").boundingBox();
      const mark = await item.getByTestId("rail-mark").boundingBox();
      if (!edge || !mark) throw new Error("rail row not laid out");
      expect(mark.x).toBeGreaterThanOrEqual(edge.x);
      expect(mark.y).toBeGreaterThanOrEqual(edge.y);
      expect(mark.y + mark.height).toBeLessThanOrEqual(edge.y + edge.height);
    }
    for (const theme of railCapture ? (["light", "dark"] as const) : []) {
      await page.emulateMedia({ colorScheme: theme });
      const first = await railRows.first().boundingBox();
      const last = await railRows.last().boundingBox();
      if (!first || !last) throw new Error("rail rows not laid out");
      await page.screenshot({
        path: resolve(
          `../issues/rail-worker-ball-in-branch-icon/evidence/${railCapture}-${width}-${theme}.png`,
        ),
        clip: {
          x: 0,
          y: first.y - 8,
          width: first.x + first.width + 24,
          height: last.y + last.height - first.y + 16,
        },
      });
    }
  }
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.reload();
  const chip = page.getByTestId("background-spinoffs");
  await expect(chip).toHaveAttribute("data-waited", "3");
  await expect(
    chip.locator('.ah-worker-mark[data-kind="idle"][data-waited]'),
  ).toHaveCount(1);
  await expect(
    chip.locator('.ah-worker-mark[data-kind="working"]:not([data-waited])'),
  ).toHaveCount(1);
  await chip.click();
  const row = (n: number) =>
    page.getByTestId(`spinoff-worker-${n}`).locator(".ah-worker-mark");
  await expect(row(2)).toHaveAttribute("data-kind", "idle");
  await expect(row(2)).toHaveAttribute("data-waited", "true");
  await expect(row(3)).toHaveAttribute("data-kind", "waiting_parent");
  await expect(row(4)).toHaveAttribute("data-kind", "unknown");
  await expect(row(5)).toHaveAttribute("data-kind", "merged");
  await expect(row(6)).toHaveAttribute("data-kind", "unfinished");
  await expect(row(7)).toHaveAttribute("data-kind", "failed");
  // A working worker's door travels round the ring; one waiting for the
  // person knocks instead, and reduced motion stills both.
  const ring = (n: number) => row(n).locator(".oh-ring");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(
    await ring(0).evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("oh-turn");
  expect(
    await ring(2).evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await ring(0).evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  if (process.env.OH_VISUAL_CAPTURE === "1") {
    const { snapshot } = await import("../lab/session.mjs");
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await snapshot(
        page,
        resolve(`../issues/worker-badges-pallot/evidence/panel-${theme}`),
        { labOrigin: new URL(page.url()).origin },
      );
    }
    await page.emulateMedia({ colorScheme: "light" });
  }
  // The sixth live worker triggers grouping; idle must not collapse into unknown.
  extra = true;
  await expect(page.getByTestId("spinoff-extra-idle")).toBeVisible();
  await expect(chip.locator('.ah-worker-mark[data-kind="idle"]')).toHaveCount(
    2,
  );
  await page.getByTestId("explain-toggle").click();
  await chip.hover();
  await expect(page.getByTestId("explain-card")).toHaveAttribute(
    "data-card",
    "V11",
  );
  await expect(page.getByTestId("worker-legend")).toBeVisible();
  // The panel's worker row carries the same legend, without blocking opening it.
  await page.getByTestId("spinoff-worker-2").hover();
  await expect(page.getByTestId("explain-card")).toHaveAttribute(
    "data-card",
    "P15",
  );
  await expect(page.getByTestId("worker-legend")).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="explain-card"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  if (process.env.OH_VISUAL_CAPTURE === "1") {
    const { snapshot } = await import("../lab/session.mjs");
    await snapshot(
      page,
      resolve("../issues/worker-badges-pallot/evidence/legend"),
      { labOrigin: new URL(page.url()).origin },
    );
  }
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(chip).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (process.env.OH_VISUAL_CAPTURE === "1") {
    const { snapshot } = await import("../lab/session.mjs");
    await snapshot(
      page,
      resolve("../issues/worker-badges-pallot/evidence/phone"),
      { labOrigin: new URL(page.url()).origin },
    );
  }
});
