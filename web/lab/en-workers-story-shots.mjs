#!/usr/bin/env node
// English evidence for en-workers: the views the worker-panel spec does not
// reach (the rest card, the next-waiting round, the terminal dock's states,
// operation progress), rendered from a static Storybook build in English at
// device scale factor 2. Story data is synthetic and stays as the stories
// give it; only the interface text is under review.
// Run from the repository root:
//   npx --prefix web storybook build --quiet -o <dir>
//   python3 -m http.server <port> --directory <dir> &
//   node web/lab/en-workers-story-shots.mjs http://127.0.0.1:<port>
import { chromium } from "@playwright/test";

const base = process.argv[2];
if (!base) throw Error("usage: en-workers-story-shots.mjs <storybook origin>");
const out = new URL("../../issues/en-workers/evidence/", import.meta.url)
  .pathname;
const stories = [
  ["rest-card", "conversation-rest-card--asleep"],
  ["rest-card-history", "conversation-rest-card--woken-by-habitat"],
  ["next-waiting-round", "production-next-waiting-round--in-round"],
  ["next-waiting-offer", "production-next-waiting-round--offer"],
  ["terminal-empty", "production-browser-shell--empty"],
  ["terminal-paste", "production-browser-shell--paste-confirmation"],
  ["terminal-taskfleet", "production-browser-shell--taskfleet-read-only"],
  [
    "worker-view-before-history",
    "production-worker-view--claude-before-history",
  ],
  ["operation-progress", "production-catalog--unhappy-states"],
];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    locale: "en-GB",
  });
  for (const [name, id] of stories) {
    await page.goto(
      `${base}/iframe.html?id=${id}&viewMode=story&globals=language:en`,
    );
    await page.locator("#storybook-root > *").first().waitFor();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}${name}.png`, fullPage: true });
    console.log(name);
  }
} finally {
  await browser.close();
}
