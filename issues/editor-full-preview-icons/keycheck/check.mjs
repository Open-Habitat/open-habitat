// Headed Chromium; keys arrive from X, not CDP, so the browser's own
// accelerators (Ctrl+E focuses the omnibox search) see them first.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
const origin = process.argv[2];
const py = process.argv[3];
const browser = await chromium.launch({ headless: false, args: ["--window-position=0,0", "--window-size=1400,950"] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: null });
const page = await context.newPage();
await page.goto(`${origin}/workspaces`);
await page.getByTestId("github-sign-in").click();
await page.locator('a[href*="code=42"]').click();
await page.goto(`${origin}/agents/pi:a1a1a1a1-0000-4000-8000-000000000001`);
await page.getByTestId("toggle-editor").click();
await page.getByTestId("hide-conversation").click();
await page.getByTestId("editor-file-entry").and(page.locator('[data-path="cmd"]')).click();
await page.getByTestId("editor-file-entry").and(page.locator('[data-path="cmd/notes.md"]')).click();
await page.getByTestId("editor-picker").click();
const doc = page.getByTestId("editor-document");
await doc.waitFor();
const box = await doc.locator(".cm-line").first().boundingBox();
// Screen position of the first line: window chrome sits above the viewport.
const off = await page.evaluate(() => ({ x: window.screenX + (window.outerWidth - window.innerWidth), y: window.screenY + (window.outerHeight - window.innerHeight) }));
const x = Math.round(off.x + box.x + 40), y = Math.round(off.y + box.y + box.height / 2);
const result = {};
const send = (...keys) => execFileSync(process.env.PYBIN, [py, String(x), String(y), ...keys]);
send("Control_L", "e");
result.ctrlE = await page.getByTestId("editor-preview").isVisible();
result.focusInPage = await page.evaluate(() => document.hasFocus());
// Esc goes back (focus is in the preview now; click lands in the preview).
send("Escape");
result.escBack = (await page.getByTestId("editor-preview").count()) === 0;
send("Control_L", "Shift_L", "v");
result.ctrlShiftV = await page.getByTestId("editor-preview").isVisible();
send("Control_L", "Shift_L", "v");
result.ctrlShiftVBack = (await page.getByTestId("editor-preview").count()) === 0;
// Control: on code there is no preview listener, so Chrome takes Ctrl+E.
await page.getByTestId("editor-picker").click();
await page.getByTestId("editor-file-entry").and(page.locator('[data-path="cmd/main.go"]')).click();
await page.getByTestId("editor-picker").click();
await page.waitForTimeout(500);
await page.evaluate(() => { window.__blur = 0; window.addEventListener("blur", () => window.__blur++); });
send("Control_L", "e");
result.controlWindowBlurred = await page.evaluate(() => window.__blur);
result.controlActive = await page.evaluate(() => document.activeElement?.className);
send("Control_L", "l");
result.controlCtrlLBlurred = await page.evaluate(() => window.__blur);
result.controlCodeFileFocusInPage = await page.evaluate(() => document.hasFocus());
result.chromium = browser.version();
console.log(JSON.stringify(result));
await browser.close();
