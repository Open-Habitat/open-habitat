#!/usr/bin/env node
// Run from the repository root with the lab started (scripts/lab.sh start):
// node web/lab/ui-language-shots.mjs (only the PNGs are kept; the HTML
// snapshots beside them are for checking the text and stay uncommitted)
// English evidence for ui-language-choice: an English browser (System) sees
// sign-in, the frame and every Settings page in English. Synthetic lab only.
import { chromium } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const out = new URL(
  "../../issues/ui-language-choice/evidence/",
  import.meta.url,
).pathname;
const pages = [
  ["home", "/workspaces"],
  ["settings-account", "/settings/account"],
  ["settings-devices", "/settings/devices"],
  ["settings-keys", "/settings/keys"],
  ["settings-ai", "/settings/ai"],
  ["settings-recap", "/settings/recap"],
  ["settings-code-hosts", "/settings/code-hosts"],
  ["settings-agent-data", "/settings/agent-data"],
  ["settings-machines", "/settings/machines"],
  ["settings-appearance", "/settings/appearance"],
  ["settings-editor", "/settings/editor"],
  ["settings-speech", "/settings/speech"],
  ["settings-storage", "/settings/storage"],
  ["settings-experimental", "/settings/experimental"],
  ["settings-server", "/settings/server"],
  ["settings-server-integrations", "/settings/server-integrations"],
  ["settings-ai-key", "/settings/ai-key"],
  ["settings-speech-key", "/settings/speech-key"],
  ["settings-onboarding", "/settings/onboarding"],
  ["settings-users", "/settings/users"],
  ["settings-disk", "/settings/disk"],
];

// Sign-in, before anyone has signed in.
{
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: "en-GB",
  });
  const page = await context.newPage();
  await page.goto(`${origin}/workspaces`);
  await page.getByTestId("login-heading").waitFor();
  await snapshot(page, `${out}sign-in`);
  await browser.close();
}

const { browser, page } = await openLab({
  locale: "en-GB",
  deviceScaleFactor: 2,
});
try {
  for (const [name, route] of pages) {
    await page.goto(`${origin}${route}`);
    await page.locator("main").waitFor();
    // Rows read from the daemon arrive after the frame.
    await page.waitForTimeout(1200);
    await snapshot(page, `${out}${name}`);
    console.log(name);
  }
} finally {
  await browser.close();
}
