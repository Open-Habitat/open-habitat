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
      if (n >= 3) continue;
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
  await expect(
    rail.locator('.ah-worker-mark[data-kind="working"][data-waited]'),
  ).toHaveCount(1);
  await expect(
    rail.locator('.ah-worker-mark[data-kind="working"]:not([data-waited])'),
  ).toHaveCount(1);
  await expect(rail.locator('.ah-worker-mark[data-kind="idle"]')).toHaveCount(
    1,
  );
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
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(
    await row(0).evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("ah-pulse");
  expect(
    await row(2).evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await row(0).evaluate((el) => getComputedStyle(el).animationName),
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
