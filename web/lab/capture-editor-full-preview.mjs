// Captures the browser editor's full-view previews for editor-full-preview-icons
// from the synthetic lab (scripts/lab.sh start), at device scale factor 2.
// Writes only into issues/editor-full-preview-icons/evidence/.

import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { origin, snapshot } from "./session.mjs";

const out = fileURLToPath(
  new URL("../../issues/editor-full-preview-icons/evidence/", import.meta.url),
);
const browser = await chromium.launch({ headless: true });
for (const [device, width, height] of [
  ["tyopoyta", 1440, 900],
  ["puhelin", 390, 844],
].filter(([d]) => !process.env.ONLY || d === process.env.ONLY))
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width, height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(`${origin}/workspaces`);
    await page.getByTestId("github-sign-in").click();
    await page.locator('a[href*="code=42"]').click();
    await page.goto(`${origin}/agents/pi:a1a1a1a1-0000-4000-8000-000000000001`);
    await page.locator("html").evaluate((el, value) => {
      el.dataset.theme = value;
    }, theme);
    await page.getByTestId("toggle-editor").click();
    await page.getByTestId("hide-conversation").click();
    const picker = page.getByTestId("editor-file-picker");
    const open = async (path) => {
      if (!(await picker.isVisible()))
        await page.getByTestId("editor-picker").click();
      const entry = page
        .getByTestId("editor-file-entry")
        .and(page.locator(`[data-path="${path}"]`));
      if (!(await entry.isVisible()))
        await page
          .getByTestId("editor-file-entry")
          .and(page.locator('[data-path="cmd"]'))
          .click();
      await entry.click();
      await page
        .getByTestId("editor-file-entry")
        .and(page.locator(`[data-path="${path}"][aria-current="page"]`))
        .waitFor({ state: "attached" });
      if (await picker.isVisible())
        await page.getByTestId("editor-picker").click();
    };
    const preview = page.getByTestId("editor-preview");
    const shot = (name) =>
      snapshot(page, `${out}${device}-${theme}-${name}`, {
        region: "main",
        // One inert HTML twin per view is enough; each carries the fonts.
        html: device === "tyopoyta" && theme === "light",
      });
    const doc = page.getByTestId("editor-document");

    await open("cmd/notes.md");
    await doc.click();
    await doc.press("Control+End");
    await doc.pressSequentially("\nMuokattu rivi.");
    await page.mouse.move(0, 0);
    await shot("md-teksti");
    await doc.press("Control+E");
    await preview.locator(".ah-markdown").waitFor();
    await page
      .getByTestId("mermaid-diagram")
      .first()
      .waitFor({ timeout: 20000 });
    await shot("md-esikatselu");
    await preview.press("Escape");
    // Back to the file as it was, so the next capture starts clean.
    await doc.press("Control+Z");
    await page
      .getByTestId("editor-dirty")
      .filter({ hasText: /^$/ })
      .waitFor({ state: "attached" });

    await open("cmd/taulu.csv");
    await doc.click();
    await doc.press("Control+E");
    await preview.getByTestId("editor-preview-table").waitFor();
    await shot("csv-taulukko");
    if (theme === "light") {
      await preview.press("Escape");
      await open("cmd/tunnus.svg");
      await page.getByTestId("editor-preview-toggle").click();
      await preview.getByTestId("editor-preview-image").waitFor();
      await shot("svg-kuva");
      await open("cmd/sivu.html");
      await page.getByTestId("editor-preview-toggle").click();
      await page
        .frameLocator('[data-testid="editor-preview-page"]')
        .locator("h1")
        .waitFor();
      await shot("html-sivu");
    }
    await context.close();
  }
await browser.close();
