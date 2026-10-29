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

// Review material for Jari, never a passing visual comparison.
const capture = process.env.OH_WORKER_PANEL_CAPTURE;
async function shot(page: Page, name: string) {
  if (!capture) return;
  mkdirSync(capture, { recursive: true });
  for (const [width, scheme] of [
    [1440, "light"],
    [1440, "dark"],
    [390, "light"],
    [390, "dark"],
  ] as const) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: resolve(capture, `${name}-${width}-${scheme}.png`),
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

const id = {
  live: "01m5yq1t6wkd3r8n2c4h7pqa01",
  kept: "01m5yq1t6wkd3r8n2c4h7pqa02",
  failed: "01m5yq1t6wkd3r8n2c4h7pqa03",
  cleanup: "01m5yq1t6wkd3r8n2c4h7pqa04",
};
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();
const ended = (
  run_id: string,
  title: string,
  state: "unmerged" | "failed" | "merged",
  slug: string,
): Spinoffs["runs"][number] => ({
  run_id,
  title,
  state,
  created_at: ago(90),
  ended_at: ago(45),
  summary: "",
  preserved: true,
  branch: `wt/${slug}`,
  worktree: `/home/example/src/ordinary-dir__worktrees/wt-${slug}`,
  source_branch: "main",
  harness: "pi",
  profile: "oletus",
});
function scene() {
  return [
    {
      run_id: id.live,
      title: "Kastelun ajastus",
      state: "working" as const,
      created_at: ago(10),
      summary: "",
      preserved: false,
      branch: "",
      worktree: "",
      source_branch: "main",
      harness: "pi" as const,
    },
    ended(id.kept, "Kasvilajien tuonti", "unmerged", "kasvilajit"),
    ended(id.failed, "Sääaseman vienti", "failed", "saaasema"),
    ended(id.cleanup, "Kuvien pakkaus", "merged", "kuvat"),
  ];
}

/** Serves the Workers list from `runs`, which a case changes as the agent
 * would change the disk. */
async function workers(page: Page, runs: () => Spinoffs["runs"]) {
  await page.route("**/api/v1/agents/pi:*/spinoffs**", (route) => {
    const url = new URL(route.request().url());
    const run = url.searchParams.get("run");
    const all = runs();
    return route.fulfill({
      json: {
        schema_version: 1,
        parent_id: url.pathname.split("/agents/")[1].split("/spinoffs")[0],
        availability: "available",
        runs: run ? all.filter((r) => r.run_id === run) : all,
        transcripts: [],
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
  await signIn(page);
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
/** The person's messages as the browser posted them, by route. */
function posts(page: Page) {
  const sent: { route: string; message: string }[] = [];
  page.on("request", (request) => {
    const route = new URL(request.url()).pathname.split("/").at(-1) ?? "";
    if (
      request.method() === "POST" &&
      ["send", "steer", "follow_up"].includes(route)
    )
      sent.push({ route, message: request.postDataJSON().message });
  });
  return sent;
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

// Jari 29.10.2026 (proto-ended-worker-lifecycle round 3, Vanhempi): an ended
// row's request goes to the conversation that started the worker as the
// person's own message. A busy parent queues it as a follow-up; the row
// follows the request from the conversation itself; "jätä toistaiseksi"
// brings back the ball; a row whose branch and worktree are gone leaves.
test("@ended-worker @a11y Käsittele kaikki queues one request in the busy parent, the rows follow it, and a row leaves once its work is gone", async ({
  page,
}) => {
  test.setTimeout(120000);
  let runs = scene();
  await workers(page, () => runs);
  await startConversation(page);
  await page.getByTestId("message-input").fill("hidas päätyö");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("composer-stop")).toBeVisible();
  const sent = posts(page);

  // The closed pill: a ball per unfinished row and the request beside it.
  await expect(pill(page)).toHaveAttribute("data-unfinished", "2");
  await expect(strip(page).getByTestId("ask-all-pill")).toBeVisible();
  await pill(page).click();
  const kept = row(page, "Kasvilajien tuonti");
  const failed = row(page, "Sääaseman vienti");
  const cleanup = row(page, "Kuvien pakkaus");
  await expect(kept.getByTestId("ask-agent")).toBeVisible();
  // A merged row with its worktree left has its own button only.
  await expect(cleanup.getByTestId("ask-agent")).toBeVisible();
  await expect(cleanup).not.toHaveAttribute("data-attention", /.*/);
  expect(
    (await new AxeBuilder({ page }).include(".ah-bg-strip").analyze())
      .violations,
  ).toEqual([]);
  await shot(page, "paattyneet");

  await strip(page).getByTestId("ask-all").click();
  // One follow-up naming both unfinished runs with their native facts; the
  // turn the person started is not redirected.
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].route).toBe("follow_up");
  for (const fact of [
    id.kept,
    id.failed,
    "wt/kasvilajit",
    "/home/example/src/ordinary-dir__worktrees/wt-saaasema",
  ])
    expect(sent[0].message).toContain(fact);
  expect(sent[0].message).not.toContain(id.cleanup);
  // Pressing never navigates: the panel stays and the rows take it.
  await expect(strip(page).getByRole("tabpanel")).toBeVisible();
  await expect(kept).toHaveAttribute("data-phase", "queued");
  await expect(failed).toHaveAttribute("data-phase", "queued");
  await expect(kept.getByTestId("request-show")).toBeVisible();
  await expect(strip(page).getByTestId("ask-all")).toHaveCount(0);
  await expect(strip(page).getByTestId("ask-all-pill")).toHaveCount(0);
  await expect(pill(page)).toHaveAttribute("data-unfinished", "0");
  await expect(pill(page)).toHaveAttribute("data-handled", "2");
  await expect(cleanup.getByTestId("ask-agent")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include(".ah-bg-strip").analyze())
      .violations,
  ).toEqual([]);
  await shot(page, "jonossa");

  // Pi takes the follow-up after its turn and answers: the agent waits for
  // the person.
  await expect(kept).toHaveAttribute("data-phase", "answer", {
    timeout: 30000,
  });
  // The request is in the conversation exactly as sent.
  await expect(
    page.getByText(sent[0].message.split("\n")[0]).first(),
  ).toBeVisible();
  await shot(page, "odottaa-vastausta");

  // The answer is an ordinary message; once its turn is over the work is
  // still on disk, so the rows wait again.
  await page.getByTestId("message-input").fill("jätä toistaiseksi");
  await page.getByTestId("send").click();
  await expect(kept).not.toHaveAttribute("data-phase", /.*/, {
    timeout: 30000,
  });
  await expect(pill(page)).toHaveAttribute("data-unfinished", "2");
  await expect(kept.getByTestId("ask-agent")).toBeVisible();

  // The agent removed one branch and worktree: the row says so, folds away
  // and the panel says it left.
  runs = runs.filter((r) => r.run_id !== id.kept);
  await expect(kept).toHaveAttribute("data-leaving", "true", {
    timeout: 10000,
  });
  await expect(kept).toHaveCount(0, { timeout: 10000 });
  await expect(strip(page).getByTestId("background-notice")).toBeVisible();
  await expect(pill(page)).toHaveAttribute("data-unfinished", "1");
  // The rows fit the phone without sideways scrolling.
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = strip(page).getByRole("tabpanel");
  expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
});

// The worker's own view carries the same request: it returns to the parent,
// which sends it at once, without a turn running directly.
test("@ended-worker the worker view's Kerro agentille sends from the parent conversation", async ({
  page,
}) => {
  test.setTimeout(90000);
  await workers(page, scene);
  await startConversation(page);
  const sent = posts(page);
  await pill(page).click();
  await page.getByTestId("spinoff-Kuvien pakkaus").click();
  await expect(page).toHaveURL(new RegExp(`spinoff=${id.cleanup}`));
  await page.getByTestId("worker-tell").click();
  await expect(page).not.toHaveURL(/spinoff=/);
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].route).toBe("send");
  expect(sent[0].message).toContain(id.cleanup);
  expect(sent[0].message).toContain("wt/kuvat");
  await expect(row(page, "Kuvien pakkaus")).toHaveAttribute(
    "data-phase",
    /sent|checking|answer/,
  );
});

// A parent the browser cannot write to (a Pi run in a terminal): the request
// starts a new conversation in the workspace and names the parent there.
test("@ended-worker a read-only parent's request starts a new conversation", async ({
  page,
}) => {
  test.setTimeout(90000);
  await workers(page, scene);
  await signIn(page);
  const created: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/v1/conversations"
    )
      created.push(request.url());
  });
  const sent = posts(page);
  await page.goto("/agents/pi:11111111-1111-4111-8111-111111111111");
  await expect(
    page.locator(".ah-read-only-footer").getByTestId("read-only-indicator"),
  ).toBeVisible();
  await pill(page).click();
  await row(page, "Kasvilajien tuonti").getByTestId("ask-agent").click();
  await expect.poll(() => sent.length).toBe(1);
  expect(created).toHaveLength(1);
  expect(sent[0].route).toBe("send");
  expect(sent[0].message).toContain(id.kept);
  await expect(strip(page).getByTestId("background-notice")).toBeVisible();
  // The worker's own view and back: the request is still the new one's.
  await page.getByTestId("spinoff-Kasvilajien tuonti").click();
  await page.getByRole("button").and(page.getByTestId("parent-top")).click();
  await pill(page).click();
  await expect(
    row(page, "Kasvilajien tuonti").getByTestId("ask-agent"),
  ).toHaveCount(0);
  await row(page, "Kasvilajien tuonti").getByTestId("request-show").click();
  await expect(page).toHaveURL(/conversation=pi/);
  await expect(page.getByText(id.kept).first()).toBeVisible({
    timeout: 20000,
  });
});
