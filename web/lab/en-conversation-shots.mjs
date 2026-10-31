#!/usr/bin/env node
// Run from the repository root with the lab started (scripts/lab.sh start):
// node web/lab/en-conversation-shots.mjs (only the PNGs are kept; the HTML
// snapshots beside them are for checking the text and stay uncommitted)
// English evidence for en-conversation: an English browser (System) sees a
// conversation, its turn and details, file offers, the file panel, a recap
// and the Pi sign-in in English. Synthetic lab only; the view offer and
// panel come from tests/ui-language-views.spec.ts with OH_VISUAL_CAPTURE=1.
import { chromium } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const out = new URL("../../issues/en-conversation/evidence/", import.meta.url)
  .pathname;

async function fixture(page, path) {
  const response = await page.request.get(`${origin}/fixture/${path}`);
  if (!response.ok()) throw Error(`${path}: ${response.status()}`);
  return response;
}

async function conversation(page) {
  await page.goto(`${origin}/workspaces`);
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.waitForURL(/conversation=pi(%3A|:)/);
  return new URL(page.url()).searchParams.get("conversation") ?? "";
}

const { browser, page } = await openLab({
  locale: "en-GB",
  deviceScaleFactor: 2,
});
try {
  await fixture(page, "scenario?value=ready");
  await fixture(page, "conversations-reset");

  // A turn with its work open, then the details.
  const id = await conversation(page);
  await page.getByTestId("message-input").fill("Check the files");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const turn = page.getByTestId("agent-turn").first();
  const stage = turn.getByTestId("history-stage-toggle").first();
  await stage.waitFor({ timeout: 30000 });
  await stage.click();
  await turn
    .getByTestId("tool-row")
    .and(page.locator('[data-tool-name="bash"]'))
    .getByTestId("history-tool-toggle")
    .click();
  await page.waitForTimeout(800);
  await snapshot(page, `${out}conversation-turn`);
  await page
    .getByRole("button")
    .and(page.getByTestId("workspace-details"))
    .click();
  await page.waitForTimeout(500);
  await snapshot(page, `${out}conversation-details`);
  await page
    .getByRole("button")
    .and(page.getByTestId("workspace-details"))
    .click();

  // File offers and the conversation's file panel.
  await fixture(page, `files?target=${encodeURIComponent(id)}&set=types`);
  await page.getByTestId("file-offer").first().waitFor();
  await page.waitForTimeout(1200);
  await snapshot(page, `${out}file-offers`);
  await fixture(page, `files?target=${encodeURIComponent(id)}&set=folder`);
  const show = page.getByTestId("file-offer-show-files").first();
  await show.waitFor({ timeout: 15000 }).catch(() => {});
  if (await show.count()) {
    await show.click();
    await page.getByTestId("file-shelf").waitFor();
    await page.waitForTimeout(800);
    await snapshot(page, `${out}file-shelf`);
    await page.getByTestId("close-file-shelf").click();
  }

  // The view offer and panel need the test host's view listener; they
  // are captured by tests/ui-language-conversation.spec.ts.

  // A recap, asked for at once from the header's menu.
  await fixture(page, "scenario?value=pi-recap");
  await fixture(page, "conversations-reset");
  await page.clock.install();
  await conversation(page);
  await page.getByTestId("message-input").fill("Explore the workspace");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await page
    .getByTestId("agent-turn")
    .first()
    .getByTestId("stage-reply")
    .first()
    .waitFor({ timeout: 30000 });
  await page.clock.fastForward(61_000);
  try {
    await page.getByTestId("recap-card").waitFor({ timeout: 20000 });
    await page.waitForTimeout(800);
    await snapshot(page, `${out}recap`);
  } catch {
    console.log("recap: no card appeared, skipped");
  }
} finally {
  await browser.close();
}

// The Pi sign-in during onboarding, with its device code.
{
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: "en-GB",
  });
  const page = await context.newPage();
  try {
    await fixture(page, "scenario?value=pi-onboarding");
    await fixture(page, "pi-state?value=missing");
    await page.goto(`${origin}/workspaces`);
    await page.getByTestId("github-sign-in").click();
    await page.getByRole("link").nth(0).click();
    const panel = page.getByTestId("git-identity");
    await panel.waitFor();
    await page
      .getByTestId("git-identity-confirm")
      .or(page.getByTestId("git-identity-continue"))
      .click();
    await page.getByTestId("repository-proceed").click();
    await page.getByTestId("pi-attempt-start").click();
    await page.getByTestId("pi-device-code").waitFor({ timeout: 15000 });
    await snapshot(page, `${out}pi-sign-in`);
  } finally {
    await fixture(page, "scenario?value=ready").catch(() => {});
    await browser.close();
  }
}
