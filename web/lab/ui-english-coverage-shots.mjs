#!/usr/bin/env node
// Run from the repository root with the lab started (scripts/lab.sh start):
// node web/lab/ui-english-coverage-shots.mjs
// English evidence for ui-english-coverage: an English browser (System) on
// the main views (sign-in, home, workspace, a conversation with its
// composer, the workers panel, settings) at device scale factor 2. Prints
// every Finnish letter left in a view's text, accessible names, tooltips
// and placeholders. Synthetic lab only; the fake Pi answers in Finnish, and
// its replies are left out of the check as conversation content.
import { chromium } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const out = new URL(
  "../../issues/ui-english-coverage/evidence/",
  import.meta.url,
).pathname;
const settle = (page) => page.waitForTimeout(1200);
const found = [];

async function walk(page, name) {
  const left = await page.evaluate(() => {
    // Conversation content is the agent's and the person's, not the UI's.
    const content =
      '[data-testid="assistant-message"], [data-testid="user-message"], .ah-markdown';
    const own = (el) => !el.closest(content);
    const texts = [];
    const tree = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = tree.nextNode(); n; n = tree.nextNode())
      if (n.parentElement && own(n.parentElement)) texts.push(n.textContent);
    for (const el of document.body.querySelectorAll("*"))
      if (own(el))
        for (const a of ["aria-label", "title", "placeholder", "alt"])
          if (el.getAttribute(a)) texts.push(el.getAttribute(a));
    return [...new Set(texts.filter((t) => /[äöÄÖ]/.test(t)))];
  });
  for (const text of left) found.push(`${name}: ${text.trim()}`);
  await snapshot(page, `${out}${name}`, { html: false });
}

async function fixture(page, path) {
  const response = await page.request.get(`${origin}/fixture/${path}`);
  if (!response.ok()) throw Error(`${path}: ${response.status()}`);
}

// Sign-in, before anyone has signed in.
{
  const browser = await chromium.launch({ headless: true });
  const page = await (
    await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      locale: "en-GB",
    })
  ).newPage();
  await page.goto(`${origin}/workspaces`);
  await page.getByTestId("github-sign-in").waitFor();
  await settle(page);
  await walk(page, "sign-in");
  await browser.close();
}

const { browser, page } = await openLab({
  locale: "en-GB",
  deviceScaleFactor: 2,
});
try {
  await fixture(page, "scenario?value=ready");
  await fixture(page, "conversations-reset");
  await page.goto(`${origin}/workspaces`);
  await page.getByTestId("workspaces-title").waitFor();
  await settle(page);
  await walk(page, "home");

  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId("workspace-title").waitFor();
  await settle(page);
  await walk(page, "workspace");

  // Workers that this conversation started, in English titles.
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
  const run = (n, title, state, extra = {}) => ({
    run_id: `01m5xwzjvnyg37zqaafd5dj00${n}`,
    title,
    state,
    created_at: ago(20 * n),
    harness: "pi",
    profile: "default",
    summary: "",
    preserved: false,
    branch: "",
    worktree: "",
    source_branch: "main",
    ...extra,
  });
  const runs = [
    run(1, "Irrigation timer", "working"),
    run(2, "Form accessibility", "waiting_parent"),
    run(3, "Plant species import", "unmerged", {
      ended_at: ago(30),
      preserved: true,
      branch: "wt/9xk2-plant-species-import",
    }),
    run(4, "Image compression", "merged", { ended_at: ago(40) }),
  ];
  await page.route("**/api/v1/agents/pi:*/spinoffs**", (route) => {
    const url = new URL(route.request().url());
    const only = url.searchParams.get("run");
    return route.fulfill({
      json: {
        schema_version: 1,
        parent_id: url.pathname.split("/agents/")[1].split("/spinoffs")[0],
        availability: "available",
        runs: only ? runs.filter((r) => r.run_id === only) : runs,
        transcripts: [],
      },
    });
  });

  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.waitForURL(/conversation=pi(%3A|:)/);
  await page.getByTestId("message-input").waitFor();
  await settle(page);
  await walk(page, "new-conversation");
  await page.getByTestId("message-input").fill("Check the files");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await page
    .getByTestId("agent-turn")
    .first()
    .getByTestId("history-stage-toggle")
    .first()
    .waitFor({ timeout: 30000 });
  await page.getByTestId("message-input").fill("Next, ");
  await settle(page);
  await walk(page, "conversation");

  const strip = page.getByTestId("background-work");
  await strip.getByTestId("background-spinoffs").click();
  await strip.getByRole("tabpanel").waitFor();
  await settle(page);
  await walk(page, "workers-panel");

  await page.goto(`${origin}/settings`);
  await page.getByRole("main").waitFor();
  await settle(page);
  await walk(page, "settings");
  await page.goto(`${origin}/settings/ulkoasu`);
  await page.getByRole("main").waitFor();
  await settle(page);
  await walk(page, "settings-appearance");
} finally {
  await browser.close();
}
console.log(found.length ? found.join("\n") : "No Finnish letters left.");
