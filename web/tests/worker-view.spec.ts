import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect, type Page } from "./worker-host";

const test = createHostTest();
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

const runID = "01m53wnktnxb4w2xgdd79a66de";
// Review material for Jari, never a passing visual comparison.
const capture = process.env.OH_WORKER_VIEW_CAPTURE;
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
    await page.screenshot({
      path: resolve(capture, `${name}-${width}-${scheme}.png`),
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}
async function fixture(page: Page, query: string) {
  expect((await page.request.get(`/fixture/taskfleet?${query}`)).status()).toBe(
    204,
  );
}

// The accepted worker view (proto-worker-view, Kehys + Pääte keskustelussa,
// Jari 26.10.2026) through the real gateway and daemon: a Claude Code
// worker's view before its native session exists, after Claude Code files
// it under the worker's own worktree, and once the run has landed.
test("@worker-view @a11y a Claude worker's conversation replaces its terminal card when its history appears, without a composer, desktop and phone", async ({
  page,
}) => {
  test.setTimeout(90000);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
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
  const composer = page
    .getByRole("textbox")
    .and(page.getByTestId("message-input"));
  await composer.fill("käynnistä worker");
  await page.getByRole("button").and(page.getByTestId("send")).click();
  await expect(page.locator("main")).toContainText(
    'Selvä. Kysyit: "käynnistä worker".',
    { timeout: 20000 },
  );
  const parentURL = page.url();
  const parent = new URL(parentURL).searchParams
    .get("conversation")
    ?.replace(/^pi:/, "");
  expect(parent).toMatch(/^[0-9a-f-]{36}$/);
  const worker = `parent=${parent}&workspace=ordinary-dir&harness=claude`;
  await fixture(page, `${worker}&status=running&history=none`);
  await page.goto(`${parentURL}&spinoff=${runID}`);

  const band = page.getByTestId("worker-band");
  const card = page
    .getByRole("region")
    .and(page.getByTestId("worker-terminal-card"));
  await expect(band).toBeVisible();
  await expect(card).toBeVisible();
  // The header's facts (worker-header-status): this worker's worktree is not
  // on disk and Claude Code's usage is not read, so each says "?" and why.
  const topline = page.locator(".ah-agent-topline");
  await expect(topline.getByTestId("git-chip")).toHaveAttribute(
    "data-unknown",
    "true",
  );
  await expect(topline.getByTestId("git-chip")).toHaveAccessibleName(
    /Git-tilaa ei saatu luettua/,
  );
  await expect(topline.getByTestId("context-ring")).toHaveAccessibleName(
    /Claude Coden käyttötietoja/,
  );
  await expect(topline.getByTestId("worker-model")).toHaveText("Malli ?");
  await expect(page.getByTestId("worker-work")).toHaveCount(0);
  // The brief comes from Taskfleet's run before any history exists.
  await expect(page.locator('[data-voice="brief"]')).toContainText(
    "Lisää kellonäkymälle testit kesäajan vaihtumiselle.",
  );
  await expect(composer).toHaveCount(0);
  // The recorded window is only a pointer: the terminal route, which finds
  // no such Taskfleet window here, refuses it, and the card says so.
  await expect(card.getByTestId("worker-terminal-problem")).toBeVisible();
  await page.getByTestId("worker-terminal-expand").click();
  await expect(page.getByTestId("worker-terminal-full")).toBeVisible();
  await page.getByTestId("worker-terminal-close").click();
  await expect(card).toBeVisible();
  // Workers are not listed in the sidebar; the parent row stays current.
  await expect(page.getByRole("navigation")).not.toContainText("ui-test-ok");
  await shot(page, "claude-ei-viela-historiaa");

  await fixture(page, `${worker}&status=running&history=ready`);
  await expect(page.locator("main")).toContainText(
    "Kesäajan vaihde puuttuu testeistä.",
  );
  await expect(card).toHaveCount(0);
  // Claude's Bash call is the conversation's own bash tool row.
  await page
    .getByRole("button")
    .and(page.getByTestId("history-stage-toggle"))
    .first()
    .click();
  await expect(
    page.locator('[data-testid="tool-row"][data-tool-name="bash"]'),
  ).toBeVisible();
  await expect(page.locator(".ah-worker-arrived[role=status]")).toBeVisible();
  // Readable workers have no terminal marker; a native prompt still opens it.
  await expect(page.getByTestId("worker-terminal-row")).toHaveCount(0);
  await page.route("**/api/v1/agents/pi:*/spinoffs**", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const run of body.runs) run.awaiting_input = true;
    await route.fulfill({ response, json: body });
  });
  await page.getByTestId("worker-prompt-terminal").click();
  await expect(
    page.getByRole("region").and(page.getByTestId("worker-terminal-full")),
  ).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("worker-terminal-close"))
    .click();
  await expect(page.getByTestId("worker-terminal-row")).toHaveCount(0);
  await page.unroute("**/api/v1/agents/pi:*/spinoffs**");
  // The history's first message is the brief, shown once.
  await expect(page.locator('[data-voice="brief"]')).toHaveCount(1);
  await expect(composer).toHaveCount(0);
  expect(
    (await new AxeBuilder({ page }).include(".ah-worker-frame").analyze())
      .violations,
  ).toEqual([]);
  await shot(page, "claude-historia-saapui");

  // The phone keeps the band, the ask action and the conversation in view.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button").and(page.getByTestId("worker-ask")),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.scrollingElement?.scrollWidth ?? Number.POSITIVE_INFINITY,
    ),
  ).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1440, height: 900 });

  // No composer: asking goes through the main agent, one press away.
  await page.getByRole("button").and(page.getByTestId("worker-ask")).click();
  await expect(page).not.toHaveURL(/spinoff=/);
  await expect(composer).toBeVisible();

  await fixture(page, `${worker}&status=done&history=ready&landed=1`);
  await page.goto(`${parentURL}&spinoff=${runID}`);
  await expect(
    page.getByRole("complementary").and(page.getByTestId("spinoff-result")),
  ).toHaveAttribute("data-tone", "ok");
  await expect(page.getByTestId("worker-terminal-row")).toHaveCount(0);
  await shot(page, "claude-laskeutui");
  await page.getByRole("button").and(page.getByTestId("parent-top")).click();
  await expect(composer).toBeVisible();
});

// worker-header-status: a worker in a registered worktree of a Git workspace
// gets production's Git chip and layer for its own files, read through the
// workspace Git route by the place ID the spinoffs read names; the pull
// request sits beside it and a Pi worker's ring is its own session's reading.
test("@worker-view @a11y a worker's header carries its Git, pull request, context and model", async ({
  page,
}) => {
  test.setTimeout(90000);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
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
  await page
    .getByRole("textbox")
    .and(page.getByTestId("message-input"))
    .fill("käynnistä worker");
  await page.getByRole("button").and(page.getByTestId("send")).click();
  await expect(page.locator("main")).toContainText(
    'Selvä. Kysyit: "käynnistä worker".',
    { timeout: 20000 },
  );
  const parentURL = page.url();
  const parent = new URL(parentURL).searchParams
    .get("conversation")
    ?.replace(/^pi:/, "");
  expect(
    (
      await page.request.get(`/fixture/cross-workspace?parent=${parent}`)
    ).status(),
  ).toBe(204);
  // The host's own Git and Taskfleet answers; only what this host has no
  // native source for is added: a Pi session's usage and gh's pull request.
  await page.route("**/api/v1/agents/pi:*/spinoffs?run=*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const run of body.runs) {
      run.harness = "pi";
      run.profile = "pi-codex";
    }
    body.transcripts = [
      {
        node_id: "n-0001",
        harness: "pi",
        availability: "available",
        truncated: false,
        entries: [
          {
            entry_key: "u1",
            kind: "user",
            content: {
              media_type: "text/plain",
              text: "Lisää korkeusprofiili.",
              complete: true,
            },
          },
          {
            entry_key: "t1",
            kind: "unknown",
            entry_type: "thinking_level_change",
            content: { media_type: "text/plain", text: "high", complete: true },
          },
          {
            entry_key: "a1",
            kind: "assistant",
            model: "openai-codex/gpt-5.5",
            context_tokens: 210000,
            content: {
              media_type: "text/markdown",
              text: "Korkeusprofiili piirtyy nyt reitin alle.",
              complete: true,
            },
          },
        ],
      },
    ];
    await route.fulfill({ response, json: body });
  });
  await page.route("**/api/v1/agents/pi:*/spinoff-work", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const run of body.runs) {
      run.pull_request_state = "found";
      run.pull_request = {
        number: 418,
        state: "open",
        url: "https://github.com/example-owner/example-repo/pull/418",
        checks: { passed: 4, failed: 0, pending: 2 },
      };
    }
    await route.fulfill({ response, json: body });
  });
  const gitReads: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/workspaces/git?")) gitReads.push(r.url());
  });
  await page.goto(`${parentURL}&spinoff=${runID}`);
  const topline = page.locator(".ah-agent-topline");
  const chip = topline.getByRole("button").and(page.getByTestId("git-chip"));
  await expect(chip).toHaveAttribute("data-branch", "cross-worker");
  await expect(chip).not.toHaveAttribute("data-unknown", /.*/);
  expect(gitReads.length).toBeGreaterThan(0);
  await expect(
    topline.getByRole("link").and(page.getByTestId("worker-pr")),
  ).toHaveAttribute(
    "href",
    "https://github.com/example-owner/example-repo/pull/418",
  );
  const ring = topline.getByTestId("context-ring");
  await expect(ring).not.toHaveAttribute("data-unknown", /.*/);
  await expect(ring).toHaveAttribute("data-tokens", "210000");
  await expect(topline.getByTestId("worker-model")).toHaveAttribute(
    "title",
    /· High$/,
  );
  // Git opens production's layer for the worker's own branch, read only.
  await chip.click();
  const layer = page.getByRole("dialog").and(page.getByTestId("git-dialog"));
  await expect(layer).toContainText("cross-worker");
  await expect(
    layer.getByRole("button").and(page.getByTestId("fetch-git")),
  ).toBeDisabled();
  expect(
    (await new AxeBuilder({ page }).include(".ah-worker-frame").analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(layer).toHaveCount(0);
  // The model is read only: it opens the worker's details, no picker.
  await topline.getByTestId("worker-model").click();
  await expect(page.locator(".ah-agent-header")).toContainText("PR #418");
  await topline.getByTestId("worker-model").click();
  await shot(page, "otsikkorivi");
  // A phone reads Git, context and model into the header's facts line.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("phone-header-facts")).toBeVisible();
  await expect(topline.getByTestId("worker-pr")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.scrollingElement?.scrollWidth ?? Number.POSITIVE_INFINITY,
    ),
  ).toBeLessThanOrEqual(390);
});
