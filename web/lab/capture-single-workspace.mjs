#!/usr/bin/env node
// Single-workspace mode (issue implement-single-workspace-mode): paired
// screenshots and inert HTML of the prototype round 2026-10-17-yksi-tyotila's
// Yläpalkissa states, from the synthetic lab only: one workspace, its menu
// and account menu, a conversation, the move to two workspaces and back.
// Run from the repository root with the lab started:
// PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node web/lab/capture-single-workspace.mjs
// It removes all but two of Alice's lab workspaces; restart the lab after.
import { mkdir } from "node:fs/promises";
import { openLab, origin, snapshot } from "./session.mjs";

const out = "issues/implement-single-workspace-mode/evidence";
await mkdir(out, { recursive: true });
for (const [width, name] of [
  [1440, "desktop"],
  [390, "phone"],
]) {
  const { browser, page } = await openLab({ width, height: 900 });
  try {
    const fixture = async (path) => {
      const response = await page.request.get(`${origin}/fixture/${path}`);
      if (response.status() !== 204)
        throw Error(`${path}: ${response.status()}`);
    };
    await page.locator("main h1").first().waitFor();
    await fixture("scenario?value=ready");
    await fixture("keep-workspaces?names=aurinkokello,muistiinpanot");
    await page.goto(`${origin}/workspaces`);
    await page
      .getByRole("heading", { name: "Työtilat", exact: true })
      .waitFor();
    const notes = await page
      .locator("main")
      .getByRole("link", { name: "muistiinpanot", exact: true })
      .first()
      .getAttribute("href");
    if (!notes) throw Error("Missing synthetic workspace");
    await page.goto(`${origin}${notes}`);
    await page.getByRole("button", { name: "Poista työtila…" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Siirrä roskakoriin" })
      .click();
    const notice = page.locator(".ah-archive-notice");
    await notice.getByText(/näkymä keskittyy siihen/).waitFor();
    await page.getByRole("heading", { name: "Keskustelut" }).waitFor();
    await page.waitForTimeout(600);
    await snapshot(page, `${out}/${name}-1-to-single`);
    await notice.getByRole("button", { name: "Sulje ilmoitus" }).click();
    await page.waitForTimeout(300);
    await snapshot(page, `${out}/${name}-2-home`);
    await page
      .getByRole("button", { name: "Työtilan aurinkokello toiminnot" })
      .click();
    await page.getByRole("menuitem", { name: /Siirrä roskakoriin/ }).waitFor();
    await snapshot(page, `${out}/${name}-3-menu`);
    await page.keyboard.press("Escape");
    await page.locator(".ah-single-bar .ah-account-shelf button").click();
    await page.getByRole("menuitem", { name: "Asetukset" }).waitFor();
    await snapshot(page, `${out}/${name}-4-account`);
    await page.keyboard.press("Escape");
    await page.locator(".ah-home-card a").first().click();
    await page.locator(".ah-conversation-frame").waitFor();
    await page.waitForTimeout(800);
    await snapshot(page, `${out}/${name}-5-conversation`);
    // Back to two: the Trash restores muistiinpanot, and the sidebar returns.
    await page.goto(`${origin}/settings#tallennustila`);
    await page.getByRole("button", { name: "Palauta muistiinpanot" }).click();
    // The mode notice comes from the next snapshot; a reload would not see
    // a change. Home is reached inside the app, so the notice stays.
    await page
      .locator(".ah-archive-notice")
      .getByText(/sivupalkki näyttää ne ryhminä/)
      .waitFor();
    await page.getByRole("link", { name: "Etusivu" }).first().click();
    await page
      .getByRole("heading", { name: "Työtilat", exact: true })
      .waitFor();
    await page.locator(".ah-archive-notice").hover();
    await page.waitForTimeout(600);
    await snapshot(page, `${out}/${name}-6-to-multi`);
  } finally {
    await browser.close();
  }
}

// The prototype's Yläpalkissa direction in the same states.
{
  const { execFileSync } = await import("node:child_process");
  const { chromium } = await import("@playwright/test");
  const { resolve } = await import("node:path");
  const built = resolve(".cache/lab/proto-yksi-tyotila.html");
  execFileSync("node", [
    "design-system/prototypes/build.mjs",
    "design-system/prototypes/rounds/2026-10-17-yksi-tyotila",
    "--out",
    built,
  ]);
  const proto = await chromium.launch({ headless: true });
  try {
    for (const name of ["desktop", "phone"]) {
      const page = await proto.newPage({
        viewport: { width: 1280, height: 900 },
      });
      await page.goto(`file://${built}`);
      if (name === "phone") {
        await page.check("#phone");
        await page.evaluate(() => document.activeElement?.blur());
      }
      await page.keyboard.press("3");
      const frame = page.locator(".frame");
      const shot = async (step) => {
        await page.waitForTimeout(400);
        await frame.screenshot({
          path: `${out}/prototype-${name}-${step}.png`,
        });
      };
      await shot("2-home");
      await page.locator("[data-wsmenu]:visible").first().click();
      await shot("3-menu");
      await page.keyboard.press("Escape");
      await page.locator('[data-menu="user3"]:visible').first().click();
      await shot("4-account");
      await page.keyboard.press("Escape");
      await page.mouse.click(5, 5);
      await page.locator(".kc-title").first().click();
      await shot("5-conversation");
      await page.locator("[data-home]:visible").first().click();
      await page.locator("[data-wsmenu]:visible").first().click();
      await page.locator('[data-wa="add"]').click();
      await page.locator("[data-repo]").first().click();
      await page.waitForTimeout(1500);
      await shot("6-to-multi");
      await page.locator("[data-trash]").nth(1).click();
      await page.locator('dialog[open] button[value="ok"]').click();
      await page.waitForTimeout(500);
      await shot("1-to-single");
      await page.close();
    }
  } finally {
    await proto.close();
  }
}
