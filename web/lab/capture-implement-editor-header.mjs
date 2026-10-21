// Synthetic lab only; run after the focused browser spec builds its host/assets.
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { snapshot } from "./session.mjs";

const port = 15494;
const origin = `https://app.oh.localhost:${port}`;
const host = spawn("../.cache/browser-host", ["dist"], {
  env: {
    ...process.env,
    BROWSER_HOST_OWNER_PID: String(process.pid),
    BROWSER_HOST_PORT: String(port),
    BROWSER_HOST_LAB: "1",
    BROWSER_HOST_EDITOR: "1",
  },
  stdio: ["ignore", "pipe", "inherit"],
});
let browser;
try {
  await new Promise((resolve, reject) => {
    host.stdout.on("data", (data) => {
      if (data.toString().includes("BROWSER_HOST_READY")) resolve();
    });
    host.on("exit", (code) => reject(new Error(`Lab exited ${code}`)));
    host.on("error", reject);
  });
  browser = await chromium.launch({
    args: [`--host-resolver-rules=MAP *.oh.localhost:443 127.0.0.1:${port}`],
  });
  for (const width of [1366, 390]) {
    const page = await browser.newPage({
      ignoreHTTPSErrors: true,
      viewport: { width, height: 900 },
    });
    await page.goto(`${origin}/workspaces`);
    await page.getByTestId("github-sign-in").click();
    await page.locator('a[href*="code=42"]').click();
    await page
      .getByTestId("workspace-aurinkokello")
      .filter({ visible: true })
      .first()
      .click();
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await page.getByTestId("message-input").fill("Missä tiedosto on?");
    await page.getByTestId("send").click();
    await page.locator('a[href="#cmd%2Fmain.go%3A3-4"]').waitFor();
    await page.getByTestId("message-input").fill("Säilytä tämä luonnos.");
    await page.getByTestId("toggle-editor").click();
    await page
      .frameLocator('[data-testid="workspace-editor"]')
      .frameLocator("#editor")
      .getByRole("heading", { level: 1 })
      .waitFor();
    for (const theme of ["light", "dark"]) {
      await page.locator("html").evaluate((el, value) => {
        el.dataset.theme = value;
      }, theme);
      const base = `../issues/implement-editor-header/evidence/${width}-${theme}`;
      await snapshot(page, `${base}-split`, { labOrigin: origin });
      await page.getByTestId("hide-conversation").click();
      await snapshot(page, `${base}-full`, { labOrigin: origin });
      await page.getByTestId("show-conversation").click();
    }
    await page.close();
  }
} finally {
  await browser?.close();
  host.kill("SIGTERM");
}
