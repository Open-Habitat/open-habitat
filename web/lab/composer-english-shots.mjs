#!/usr/bin/env node
// Run from the repository root with the lab started (scripts/lab.sh start):
// node web/lab/composer-english-shots.mjs (only the PNGs are kept; the HTML
// snapshots beside them are for checking the text and stay uncommitted)
// English evidence for en-composer: an English browser (System) sees the
// composer, its lists, the picker, a `!` command, the attachment menu, a
// dictation notice and the onboarding AI options in English. Synthetic lab
// only.
import { openLab, origin, snapshot } from "./session.mjs";

const out = new URL("../../issues/en-composer/evidence/", import.meta.url)
  .pathname;

const { browser, page } = await openLab({
  locale: "en-GB",
  deviceScaleFactor: 2,
});
const shot = async (name, region) => {
  await page.waitForTimeout(400);
  await snapshot(page, `${out}${name}`, { region });
  console.log(name);
};
try {
  const data = await (
    await page.request.get(`${origin}/api/v1/snapshot`)
  ).json();
  const workspace =
    data.workspaces.find((w) => w.name === "ordinary-dir") ??
    data.workspaces[0];
  await page.goto(`${origin}/workspaces/${workspace.workspace_id}`);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.waitForURL(/conversation=pi:/);
  const field = page.getByTestId("message-input");
  await field.waitFor();
  await shot("composer-idle");

  await field.fill("/");
  await page.locator(".ah-choice-pop").waitFor();
  await page.waitForTimeout(800);
  await shot("composer-commands");
  await field.press("Escape");

  await field.fill("Look at @");
  await page.locator(".ah-choice-pop").waitFor();
  await page.waitForTimeout(800);
  await shot("composer-files");
  await field.press("Escape");

  await field.fill("");
  await field.press("ControlOrMeta+p");
  await page.getByTestId("composer-palette").waitFor();
  await page.waitForTimeout(800);
  await shot("composer-palette");
  await page.getByTestId("palette-tab-cmd").click();
  await page.waitForTimeout(800);
  await shot("composer-palette-commands");
  await page.keyboard.press("Escape");

  await field.fill("!ls");
  await shot("composer-command", ".ah-composer");
  await field.press("Enter");
  await page.getByTestId("command-run").first().waitFor();
  await page.waitForTimeout(1500);
  await shot("composer-command-run");

  await page.getByTestId("attach-file").click();
  await page.getByTestId("attachment-panel").waitFor();
  await shot("composer-attachment-menu");
  await page.keyboard.press("Escape");

  const mic = page.getByTestId("dictation-mic");
  if (await mic.count()) {
    await mic.click();
    await page.getByTestId("dictation-notice").waitFor({ timeout: 10000 });
    await shot("composer-dictation-notice", ".ah-composer");
  } else console.log("no mic in this lab: dictation not captured");

  // The onboarding AI step's options, in the administrator's preview of a
  // new person's route.
  await page.goto(`${origin}/settings/onboarding`);
  await page.getByTestId("onboarding-preview-open").click();
  const options = page.getByTestId("ai-options");
  for (let i = 0; i < 6 && !(await options.count()); i++) {
    await page.getByTestId("onboarding-preview-next").first().click();
    await page.waitForTimeout(400);
  }
  if (await options.count()) await shot("onboarding-ai-options");
  else console.log("the preview showed no AI step: options not captured");
} finally {
  await browser.close();
}
