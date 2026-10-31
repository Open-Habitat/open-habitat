#!/usr/bin/env node
// Run from the repository root with the lab started (scripts/lab.sh start):
// node web/lab/en-shell-editor-shots.mjs (only the PNGs are kept; the HTML
// snapshots beside them are for checking the text and stay uncommitted)
// English evidence for en-shell-editor: an English browser (System) sees the
// editor, the context page, the terminal and the frame around them in
// English. The fake Pi's replies and the fixture files stay as they are.
// Synthetic lab only.
import { openLab, origin, snapshot } from "./session.mjs";

const out = new URL("../../issues/en-shell-editor/evidence/", import.meta.url)
  .pathname;
const { browser, page } = await openLab({
  locale: "en-GB",
  deviceScaleFactor: 2,
  width: 1440,
  height: 900,
});
const fixture = async (path) => {
  const response = await page.request.get(`${origin}/fixture/${path}`);
  if (response.status() !== 204) throw Error(`${path}: ${response.status()}`);
};
const send = async (text) => {
  await page.getByTestId("message-input").fill(text);
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
};
try {
  await fixture("scenario?value=ready");
  await fixture("conversations-reset");
  await fixture("lab-conversations-clean");
  const id = await page.evaluate(
    async () =>
      (await (await fetch("/api/v1/snapshot")).json()).workspaces.find(
        (w) => w.name === "aurinkokello",
      ).workspace_id,
  );
  await page.goto(`${origin}/workspaces/${id}`);
  await page.getByTestId("conversation-start").click();
  await page.getByTestId("message-input").waitFor();
  await send("Where is the tiedosto?");
  const link = page.locator('a[href="#cmd%2Fmain.go%3A3-4"]').first();
  await link.waitFor({ timeout: 30_000 });
  await snapshot(page, `${out}conversation`);

  await link.click();
  await page.getByTestId("editor-document").waitFor();
  await page.waitForTimeout(800);
  await snapshot(page, `${out}editor`);
  await page.getByTestId("editor-document").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" // edited");
  await page.waitForTimeout(400);
  await snapshot(page, `${out}editor-modified`);
  await page.getByTestId("hide-conversation").click();
  await page.waitForTimeout(400);
  await snapshot(page, `${out}editor-full-window`);
  await page.getByTestId("show-conversation").click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByTestId("close-editor").click();

  await send("konteksti 205300");
  const ring = page.locator(".ah-agent-header").getByTestId("context-ring");
  await ring.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await ring.click();
  await page
    .getByTestId("context-page")
    .and(page.locator('[data-state="ready"]'))
    .waitFor({ timeout: 30_000 });
  await snapshot(page, `${out}context-page`);
  await page.keyboard.press("Escape");

  await page.getByTestId("toggle-terminal").click();
  await page.getByTestId("terminal-panel").waitFor();
  await page.waitForTimeout(2500);
  await snapshot(page, `${out}terminal`);
} finally {
  await browser.close();
}
