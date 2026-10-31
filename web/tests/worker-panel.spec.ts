import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Spinoffs } from "../src/app/spinoffs";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect, type Page } from "./worker-host";

const test = createHostTest();
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});

// Review material for Jari, never a passing visual comparison.
const capture = process.env.OH_WORKER_PANEL_CAPTURE;
async function shot(page: Page, name: string, width: number, scheme: string) {
  if (!capture) return;
  mkdirSync(capture, { recursive: true });
  // Let the theme's colour transitions settle before the capture.
  await page.waitForTimeout(500);
  await page.screenshot({
    path: resolve(capture, `${name}-${width}-${scheme}.png`),
  });
}

const id = {
  waited: "01m5xwzjvnyg37zqaafd5dj001",
  elsewhere: "01m5xwzjvnyg37zqaafd5dj002",
  unwaited: "01m5xwzjvnyg37zqaafd5dj003",
  parent: "01m5xwzjvnyg37zqaafd5dj004",
  kept: "01m5xwzjvnyg37zqaafd5dj005",
  landed: "01m5xwzjvnyg37zqaafd5dj006",
  failed: "01m5xwzjvnyg37zqaafd5dj007",
};
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();
const base = {
  summary: "",
  preserved: false,
  branch: "",
  worktree: "",
  source_branch: "main",
};
const runs: Spinoffs["runs"] = [
  {
    ...base,
    run_id: id.waited,
    title: "Kastelun ajastus",
    created_at: ago(18),
    state: "working",
    harness: "pi",
    profile: "oletus",
  },
  {
    ...base,
    run_id: id.elsewhere,
    title: "Hakuindeksin päivitys",
    created_at: ago(11),
    state: "working",
    harness: "pi",
    profile: "nopea",
    other_repository: "kirjasto",
  },
  {
    ...base,
    run_id: id.unwaited,
    title: "Lomakkeen saavutettavuus",
    created_at: ago(6),
    state: "working",
    harness: "claude",
    profile: "tarkka",
  },
  {
    ...base,
    run_id: id.parent,
    title: "Sääaseman CSV-vienti",
    created_at: ago(24),
    state: "waiting_parent",
    harness: "pi",
    profile: "oletus",
  },
  {
    ...base,
    run_id: id.kept,
    title: "Kasvilajien tuonti",
    created_at: ago(80),
    ended_at: ago(50),
    state: "unmerged",
    preserved: true,
    branch: "wt/9xk2-kasvilajien-tuonti",
    harness: "pi",
    profile: "oletus",
  },
  {
    ...base,
    run_id: id.landed,
    title: "Kuvien pakkaus",
    created_at: ago(60),
    ended_at: ago(30),
    state: "merged",
    harness: "pi",
    profile: "oletus",
  },
  {
    ...base,
    run_id: id.failed,
    title: "Vanhan rajapinnan poisto",
    created_at: ago(100),
    ended_at: ago(70),
    state: "failed",
    harness: "claude",
    profile: "claude",
    other_repository: "kirjasto",
  },
];
const wait = (token: string, run: string) => ({
  id: `proc_${token}`,
  name: `odota-${token}`,
  command_preview: `taskfleet run wait ${run} --output json`,
  process_token: `pt_${token}`,
  status: "running",
  started_at: Date.now() - 3 * 60000,
  ended_at: null,
  exit_code: null,
  signal: null,
  end_reason: null,
  wakes_agent: true,
  run_ids: [run],
});

// Rivi (proto-worker-panel direction 1, Jari 27.10.2026): every worker row
// says on its own second line what it means for the agent, so the panel has
// no legend. Waited, not waited and ended rows, the other repository, the
// stop on a waited row and the row opening the worker's own view.
test("@spinoffs @a11y worker panel rows carry their own meaning: waited, not waited, ended, other repository", async ({
  page,
}) => {
  test.setTimeout(90000);
  const stops: unknown[] = [];
  await page.route("**/api/v1/agents/pi:*/spinoffs**", (route) => {
    const url = new URL(route.request().url());
    const run = url.searchParams.get("run");
    return route.fulfill({
      json: {
        schema_version: 1,
        parent_id: url.pathname.split("/agents/")[1].split("/spinoffs")[0],
        availability: "available",
        runs: run ? runs.filter((r) => r.run_id === run) : runs,
        transcripts: [],
      },
    });
  });
  await page.route("**/api/v1/conversations/*/processes**", (route) => {
    if (route.request().url().endsWith("/stop")) {
      stops.push(route.request().postDataJSON());
      return route.fulfill({ json: { schema_version: 1, result: "killed" } });
    }
    return route.fulfill({
      json: {
        schema_version: 1,
        owner_generation: "og_example",
        availability: "available",
        unavailable_reason: null,
        interrupted: [],
        processes: [wait("a", id.waited), wait("b", id.elsewhere)],
      },
    });
  });
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByRole("link")
    .and(page.getByTestId("workspace-ordinary-dir"))
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("conversation-start"))
    .click();
  const strip = page
    .getByRole("region")
    .and(page.getByTestId("background-work"));
  const pill = strip
    .getByRole("button")
    .and(page.getByTestId("background-spinoffs"));
  await expect(pill).toHaveAttribute("data-waited", "2");
  await expect(pill).toHaveAttribute("data-unwaited", "1");
  await pill.click();
  const panel = strip.getByRole("tabpanel");
  const row = (title: string) =>
    panel
      .locator('[data-kind="spin"]')
      .filter({ has: page.getByTestId(`spinoff-${title}`) });

  // No legend: the meaning lives on each row.
  await expect(panel.getByTestId("wait-legend")).toHaveCount(0);
  for (const r of runs)
    await expect(
      row(r.title).getByTestId("spinoff-facts"),
      `${r.title} says what it is`,
    ).not.toBeEmpty();
  // Waited rows carry the stop; the unwaited and parent-waiting do not.
  const waited = row("Kastelun ajastus");
  await expect(waited).toHaveAttribute("data-waited", "true");
  await expect(waited.getByTestId("stop-wait")).toHaveCount(1);
  const unwaited = row("Lomakkeen saavutettavuus");
  await expect(unwaited).toHaveAttribute("data-waited", "false");
  await expect(unwaited.getByTestId("stop-wait")).toHaveCount(0);
  await expect(
    row("Sääaseman CSV-vienti").getByTestId("stop-wait"),
  ).toHaveCount(0);
  // The other repository is named only where it differs; its name is
  // native content and shown unchanged.
  await expect(
    row("Hakuindeksin päivitys").getByTestId("spinoff-repository"),
  ).toHaveText("kirjasto");
  await expect(waited.getByTestId("spinoff-repository")).toHaveCount(0);

  // The preserved run opened the ended fold by itself; failed is its own
  // state, apart from the preserved one that needs the person.
  await expect(row("Kasvilajien tuonti")).toHaveAttribute(
    "data-attention",
    "true",
  );
  await expect(row("Vanhan rajapinnan poisto")).toHaveAttribute(
    "data-state",
    "failed",
  );
  await expect(row("Vanhan rajapinnan poisto")).not.toHaveAttribute(
    "data-attention",
    /.*/,
  );
  await expect(
    row("Vanhan rajapinnan poisto").getByTestId("spinoff-repository"),
  ).toHaveText("kirjasto");
  expect(
    (await new AxeBuilder({ page }).include(".ah-bg-strip").analyze())
      .violations,
  ).toEqual([]);

  for (const [width, scheme] of [
    [1440, "light"],
    [1440, "dark"],
    [390, "light"],
    [390, "dark"],
  ] as const) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.emulateMedia({ colorScheme: scheme });
    // The rows fit the phone without sideways scrolling.
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    await shot(page, "paneeli", width, scheme);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });

  // Stopping a wait stops only the agent's wait process.
  await waited.getByTestId("stop-wait").click();
  await expect.poll(() => stops.length).toBe(1);
  expect(stops[0]).toMatchObject({ process_token: "pt_a" });

  // The row's name opens the worker's own view; back returns to the parent.
  await page.getByTestId("spinoff-Lomakkeen saavutettavuus").click();
  await expect(page).toHaveURL(new RegExp(`spinoff=${id.unwaited}`));
  await expect(page.getByTestId("worker-band")).toBeVisible();
  await page.getByRole("button").and(page.getByTestId("parent-top")).click();
  await expect(page).not.toHaveURL(/spinoff=/);
});

// English (en-workers): an English browser with the server default System
// sees the worker panel, a process window, the worker's own view and the
// terminal dock in English. The fixture titles are ASCII, so a Finnish
// letter there can only be interface text left untranslated.
test.describe("in English", () => {
  test.use({ locale: "en-GB" });
  const capture = process.env.OH_EN_WORKERS_CAPTURE;
  const evidence = async (page: Page, name: string) => {
    if (!capture) return;
    mkdirSync(capture, { recursive: true });
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(capture, `${name}.png`) });
  };
  // Text, accessible names and tooltips in a region; `skip` leaves out a
  // part another view draws (the terminal surface is the browser shell's).
  const finnish = (region: ReturnType<Page["locator"]>, skip?: string) =>
    region.evaluate((root, skip) => {
      const own = (el: Element) => !skip || !el.closest(skip);
      const copy = root.cloneNode(true) as HTMLElement;
      if (skip) for (const el of copy.querySelectorAll(skip)) el.remove();
      // innerText of a detached copy ignores CSS; textContent suffices.
      return [
        copy.textContent ?? "",
        ...[root, ...root.querySelectorAll("*")]
          .filter(own)
          .flatMap((el) => [
            el.getAttribute("aria-label") ?? "",
            el.getAttribute("title") ?? "",
          ]),
      ].filter((s) => /[äöÄÖ]/.test(s));
    }, skip);
  const english: Spinoffs["runs"] = [
    { ...runs[0], title: "Irrigation timer" },
    { ...runs[2], title: "Form accessibility" },
    { ...runs[3], title: "Weather station export" },
    { ...runs[4], title: "Plant species import" },
    { ...runs[5], title: "Image compression" },
    { ...runs[6], title: "Old API removal" },
  ];
  const ended = {
    ...wait("c", ""),
    id: "proc_c",
    name: "build",
    command_preview: "npm run build",
    process_token: "pt_c",
    status: "exited",
    ended_at: Date.now() - 60000,
    exit_code: 1,
    wakes_agent: false,
    run_ids: [],
  };

  test("@spinoffs @ui-language the worker panel, a process, the worker view and the terminal dock speak English", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.route("**/api/v1/agents/pi:*/spinoffs**", (route) => {
      const url = new URL(route.request().url());
      const run = url.searchParams.get("run");
      return route.fulfill({
        json: {
          schema_version: 1,
          parent_id: url.pathname.split("/agents/")[1].split("/spinoffs")[0],
          availability: "available",
          runs: run ? english.filter((r) => r.run_id === run) : english,
          transcripts: [],
        },
      });
    });
    await page.route("**/api/v1/conversations/*/processes**", (route) => {
      if (route.request().url().includes("/output?"))
        return route.fulfill({
          json: {
            schema_version: 1,
            owner_generation: "og_example",
            process_id: "proc_c",
            process_token: "pt_c",
            lines: [
              { stream: "stdout", text: "vite build" },
              { stream: "stderr", text: "error: missing module" },
            ],
            omitted_before: 0,
            retention_restarted: false,
          },
        });
      return route.fulfill({
        json: {
          schema_version: 1,
          owner_generation: "og_example",
          availability: "available",
          unavailable_reason: null,
          interrupted: [],
          processes: [wait("a", id.waited), ended],
        },
      });
    });
    await page.request.get("/fixture/scenario?value=ready");
    await page.goto("/workspaces");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page
      .getByRole("button")
      .and(page.getByTestId("github-sign-in"))
      .click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    await page
      .getByRole("navigation")
      .getByRole("link")
      .and(page.getByTestId("workspace-ordinary-dir"))
      .click();
    await page
      .getByRole("button")
      .and(page.getByTestId("conversation-start"))
      .click();
    const strip = page
      .getByRole("region")
      .and(page.getByTestId("background-work"));
    await expect(strip.getByTestId("background-spinoffs")).toHaveAttribute(
      "data-waited",
      "1",
    );
    expect(await finnish(strip)).toEqual([]);

    await strip.getByTestId("background-spinoffs").click();
    await expect(strip.getByRole("tabpanel")).toBeVisible();
    await expect(strip.getByTestId("ended-runs")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(await finnish(strip)).toEqual([]);
    await evidence(page, "workers-panel");

    await strip.getByTestId("background-tab-process").click();
    await strip.getByTestId("ended-runs").click();
    expect(await finnish(strip)).toEqual([]);
    await evidence(page, "processes-panel");
    await strip.getByTestId("process-open").last().click();
    const dialog = page.getByTestId("process-dialog");
    await expect(dialog.getByTestId("process-output")).toBeVisible();
    expect(await finnish(dialog)).toEqual([]);
    await evidence(page, "process-window");
    await dialog.getByTestId("process-close").click();
    await expect(dialog).toHaveCount(0);

    await strip.getByTestId("background-tab-spinoff").click();
    await page.getByTestId("spinoff-Plant species import").click();
    const band = page.getByTestId("worker-band");
    await expect(band).toBeVisible();
    await expect(page.getByTestId("spinoff-result")).toBeVisible();
    expect(await finnish(band)).toEqual([]);
    expect(await finnish(page.getByTestId("spinoff-result"))).toEqual([]);
    expect(await finnish(page.getByTestId("worker-closed"))).toEqual([]);
    await evidence(page, "worker-view");
    await band.getByTestId("parent-top").click();
    await expect(page).not.toHaveURL(/spinoff=/);

    await page.getByTestId("toggle-terminal").click();
    const dock = page.getByTestId("terminal-panel");
    // The first open starts a shell at once.
    await expect(dock.locator(".xterm-rows")).toContainText("alice@");
    expect(await finnish(dock, ".ah-terminal-surface")).toEqual([]);
    await evidence(page, "terminal-dock");
  });
});
