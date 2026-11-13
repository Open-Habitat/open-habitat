import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Spinoffs } from "../src/app/spinoffs";
import type { SpinoffWork } from "../src/app/spinoffWork";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect, type Page } from "./worker-host";

// Lause (proto-worker-row-work-facts, Jari 29.10.2026), behind its
// Kokeelliset ominaisuudet switch: the worker row says in words what the
// worker has produced. The Workers list and its work facts are served here;
// the switch is the person's own daemon's.
const test = createHostTest();
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

// Review material for Jari, never a passing visual comparison.
const capture = process.env.OH_WORKER_SENTENCE_CAPTURE;
async function shot(page: Page, name: string) {
  if (!capture) return;
  mkdirSync(capture, { recursive: true });
  for (const [width, scheme] of [
    [1440, "light"],
    [1440, "dark"],
    [390, "light"],
  ] as const) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: resolve(capture, `${name}-${width}-${scheme}.png`),
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

const id = {
  busy: "01m5yq1t6wkd3r8n2c4h7pqb01",
  fresh: "01m5yq1t6wkd3r8n2c4h7pqb02",
  silent: "01m5yq1t6wkd3r8n2c4h7pqb03",
  failed: "01m5yq1t6wkd3r8n2c4h7pqb04",
  landed: "01m5yq1t6wkd3r8n2c4h7pqb05",
};
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();
const run = (
  run_id: string,
  title: string,
  state: Spinoffs["runs"][number]["state"],
): Spinoffs["runs"][number] => ({
  run_id,
  title,
  state,
  created_at: ago(20),
  ended_at: state === "working" ? undefined : ago(5),
  summary: "",
  preserved: state !== "working",
  branch: state === "working" ? "" : `wt/${run_id.slice(-4)}`,
  worktree: "",
  source_branch: "main",
  harness: "pi",
});
const runs = [
  run(id.busy, "Sääaseman CSV-vienti", "working"),
  run(id.fresh, "Vanhan rajapinnan poisto", "working"),
  run(id.silent, "Kuvagallerian lataus", "working"),
  run(id.failed, "Lomakkeen saavutettavuus", "failed"),
  run(id.landed, "Kuvien pakkaus", "merged"),
];
const work: SpinoffWork["runs"] = [
  {
    run_id: id.busy,
    git: "available",
    dirty_count: 3,
    ahead: 2,
    behind: 0,
    added: 146,
    removed: 12,
    pull_request_state: "found",
    pull_request: {
      number: 412,
      state: "draft",
      url: "https://github.com/example-owner/example-repo/pull/412",
      checks: { passed: 2, failed: 0, pending: 1 },
    },
  },
  {
    run_id: id.fresh,
    git: "available",
    dirty_count: 0,
    ahead: 0,
    behind: 0,
    pull_request_state: "unknown",
  },
  { run_id: id.silent, git: "unavailable", pull_request_state: "unknown" },
  {
    run_id: id.failed,
    git: "available",
    dirty_count: 2,
    ahead: 1,
    behind: 2,
    added: 23,
    removed: 9,
    pull_request_state: "found",
    pull_request: {
      number: 405,
      state: "open",
      url: "https://github.com/example-owner/example-repo/pull/405",
      checks: { passed: 3, failed: 1, pending: 0 },
    },
  },
];

/** Serves the Workers list and their work facts, and counts the work reads. */
async function workers(page: Page) {
  const reads = { work: 0 };
  await page.route("**/api/v1/agents/pi:*/spinoffs**", (route) => {
    const url = new URL(route.request().url());
    const selected = url.searchParams.get("run");
    return route.fulfill({
      json: {
        schema_version: 1,
        parent_id: url.pathname.split("/agents/")[1].split("/spinoffs")[0],
        availability: "available",
        runs: selected ? runs.filter((r) => r.run_id === selected) : runs,
        transcripts: [],
      },
    });
  });
  await page.route("**/api/v1/agents/pi:*/spinoff-work", (route) => {
    reads.work++;
    const url = new URL(route.request().url());
    return route.fulfill({
      json: {
        schema_version: 1,
        parent_id: url.pathname.split("/agents/")[1].split("/spinoff-work")[0],
        availability: "available",
        runs: work,
      },
    });
  });
  await page.route("**/api/v1/conversations/*/processes**", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        owner_generation: "og_example",
        availability: "available",
        unavailable_reason: null,
        interrupted: [],
        processes: [],
      },
    }),
  );
  return reads;
}
async function signIn(page: Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
}
async function startConversation(page: Page) {
  await page
    .getByRole("navigation")
    .getByRole("link")
    .and(page.getByTestId("workspace-ordinary-dir"))
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("conversation-start"))
    .click();
  await expect(page).toHaveURL(/conversation=pi/);
}
const strip = (page: Page) =>
  page.getByRole("region").and(page.getByTestId("background-work"));
const pill = (page: Page) =>
  strip(page).getByRole("button").and(page.getByTestId("background-spinoffs"));
const row = (page: Page, title: string) =>
  strip(page)
    .getByRole("tabpanel")
    .locator('[data-kind="spin"]')
    .filter({ has: page.getByTestId(`spinoff-${title}`) });

test("@worker-row-sentence @a11y each row says its work by default and the worker view's header links its PR", async ({
  page,
}) => {
  test.setTimeout(120000);
  const reads = await workers(page);
  await signIn(page);
  await startConversation(page);
  await pill(page).click();
  await expect(row(page, "Sääaseman CSV-vienti")).toBeVisible();
  await expect.poll(() => reads.work).toBeGreaterThan(0);

  const busy = row(page, "Sääaseman CSV-vienti");
  await expect(busy.getByTestId("spinoff-work")).toHaveAttribute(
    "data-tone",
    "work",
  );
  await expect(busy.getByTestId("spinoff-pr")).toBeVisible();
  // Nothing yet and not known read differently, and neither claims a PR.
  const fresh = row(page, "Vanhan rajapinnan poisto").getByTestId(
    "spinoff-work",
  );
  const silent = row(page, "Kuvagallerian lataus").getByTestId("spinoff-work");
  await expect(fresh).toHaveAttribute("data-tone", "muted");
  await expect(silent).toHaveAttribute("data-tone", "muted");
  expect(await fresh.textContent()).not.toBe(await silent.textContent());
  await expect(
    row(page, "Vanhan rajapinnan poisto").getByTestId("spinoff-pr"),
  ).toHaveCount(0);
  // gh said nothing for one worker Git answered for: one panel note.
  await expect(strip(page).getByTestId("spinoff-work-note")).toHaveCount(1);
  // A landed worker's work is in its source branch: no facts.
  const fold = strip(page)
    .getByRole("button")
    .and(page.getByTestId("ended-runs"));
  if ((await fold.getAttribute("aria-expanded")) !== "true") await fold.click();
  await expect(
    row(page, "Lomakkeen saavutettavuus").getByTestId("spinoff-work"),
  ).toBeVisible();
  await expect(
    row(page, "Kuvien pakkaus").getByTestId("spinoff-work"),
  ).toHaveCount(0);
  expect(
    (await new AxeBuilder({ page }).include(".ah-bg-strip").analyze())
      .violations,
  ).toEqual([]);
  await shot(page, "paneeli");

  // The sentence wraps on a phone instead of pushing the panel sideways.
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = strip(page).getByRole("tabpanel");
  expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.setViewportSize({ width: 1440, height: 900 });

  // The worker view's header carries the PR beside Git (worker-header-status);
  // the sentence line is gone from the band.
  await page.getByTestId("spinoff-Sääaseman CSV-vienti").click();
  await expect(page).toHaveURL(new RegExp(`spinoff=${id.busy}`));
  await expect(page.getByTestId("worker-work")).toHaveCount(0);
  const topline = page.locator(".ah-agent-topline");
  // Without a registered worktree the chip shows spinoff-work's counts.
  await expect(topline.getByTestId("git-chip")).toHaveAttribute(
    "data-changes",
    "3",
  );
  await expect(
    topline.getByRole("link").and(page.getByTestId("worker-pr")),
  ).toHaveAttribute(
    "href",
    "https://github.com/example-owner/example-repo/pull/412",
  );
  expect(
    (await new AxeBuilder({ page }).include(".ah-agent-topline").analyze())
      .violations,
  ).toEqual([]);
  await shot(page, "worker");
});
