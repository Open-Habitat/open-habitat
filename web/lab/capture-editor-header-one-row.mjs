// Synthetic lab, 2x evidence for editor-header-one-row.
import { openLab, origin, snapshot } from "./session.mjs";

const phase = process.argv[2];
if (!["before", "after"].includes(phase))
  throw new Error("before or after required");
for (const width of [1440, 390]) {
  const { browser, page } = await openLab({ width, deviceScaleFactor: 2 });
  try {
    await page.goto(`${origin}/agents/pi:a1a1a1a1-0000-4000-8000-000000000001`);
    await page.getByTestId("toggle-editor").click();
    await page
      .getByTestId("editor-file-entry")
      .and(page.locator('[data-path="cmd"]'))
      .click();
    await page
      .getByTestId("editor-file-entry")
      .and(page.locator('[data-path="cmd/notes.md"]'))
      .click();
    await page.getByTestId("editor-document").waitFor();
    await page.getByTestId("editor-picker").click();
    for (const theme of ["light", "dark"]) {
      await page.locator("html").evaluate((el, theme) => {
        el.dataset.theme = theme;
      }, theme);
      await snapshot(
        page,
        `issues/editor-header-one-row/evidence/${phase}-${width}-${theme}`,
      );
    }
  } finally {
    await browser.close();
  }
}
