#!/usr/bin/env node
// Run from the repository root with the lab started (scripts/lab.sh start):
// node web/lab/en-workspaces-shots.mjs
// English evidence for en-workspaces: an English browser (System) sees home,
// the workspace page with its Git details and icon picker, and the clone
// page in English, at device scale factor 2. Synthetic lab only.
import { openLab, origin, snapshot } from "./session.mjs";

const out = new URL("../../issues/en-workspaces/evidence/", import.meta.url)
  .pathname;
const settle = (page) => page.waitForTimeout(1200);

const { browser, page } = await openLab({
  locale: "en-GB",
  deviceScaleFactor: 2,
});
try {
  await page.locator("main").waitFor();
  await page.getByTestId("workspaces-title").waitFor();
  // The icon picker is experimental: turn it on for this person.
  const session = await (
    await page.request.get(`${origin}/auth/session`)
  ).json();
  await page.request.put(`${origin}/api/v1/account/preferences`, {
    headers: { Origin: origin, "X-Agent-Host-CSRF": session.csrf },
    data: { experimental: { "workspace-icons": true } },
  });
  await page.reload();
  await page.getByTestId("workspaces-title").waitFor();
  await settle(page);
  await snapshot(page, `${out}home`);

  await page
    .getByRole("navigation")
    .getByRole("link")
    .and(page.getByTestId("workspace-aurinkokello"))
    .click();
  await page.getByTestId("workspace-title").waitFor();
  await settle(page);
  await snapshot(page, `${out}workspace-page`);

  await page.getByTestId("workspace-git").first().click();
  await page.getByTestId("workspace-git-dialog").waitFor();
  await settle(page);
  await snapshot(page, `${out}workspace-git`);
  await page.keyboard.press("Escape");

  await page.getByTestId("workspace-icon-picker").click();
  await page.getByTestId("workspace-icon-dialog").waitFor();
  await snapshot(page, `${out}workspace-icon-picker`);
  await page.keyboard.press("Escape");

  await page.getByTestId("delete-workspace").click();
  await page.waitForTimeout(2500);
  await snapshot(page, `${out}workspace-delete`);
  await page.keyboard.press("Escape");

  await page.goto(`${origin}/workspaces/new`);
  await page.getByTestId("repository-search").waitFor();
  await settle(page);
  await snapshot(page, `${out}clone-page`);

  await page.getByTestId("repository-search").fill("fixture/last");
  await page.getByTestId("repository-option-fixture/last").first().click();
  await page.getByTestId("repository-clone").waitFor();
  await snapshot(page, `${out}clone-details`);

  await page.goto(`${origin}/workspaces/new?source=directory`);
  await page.getByTestId("directory-name").waitFor();
  await snapshot(page, `${out}new-directory`);
} finally {
  await browser.close();
}
