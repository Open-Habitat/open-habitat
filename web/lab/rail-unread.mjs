// Synthetic production UI evidence for rail-unread-badge.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { expect } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const host = spawn(".cache/browser-host", ["web/dist"], {
  env: {
    ...process.env,
    BROWSER_HOST_LAB: "1",
    BROWSER_HOST_PORT: new URL(origin).port,
    BROWSER_HOST_OWNER_PID: String(process.pid),
  },
  stdio: ["ignore", "pipe", "inherit"],
});
let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("lab readiness timeout")),
      30000,
    );
    host.stdout.on("data", (data) => {
      if (data.toString().includes("BROWSER_HOST_READY")) {
        clearTimeout(timer);
        resolve();
      }
    });
    host.once("error", reject);
    host.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`lab exited ${code}`));
    });
  });
  const session = await openLab();
  browser = session.browser;
  const { page, context } = session;
  const writer = await context.newPage();
  await writer.goto(`${origin}/workspaces`);
  await writer
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await writer.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(writer).toHaveURL(/conversation=pi(?:%3A|:)/);
  await expect(writer.getByTestId("message-input")).toBeEnabled();
  await writer
    .getByTestId("message-input")
    .fill("Synthetic unread reply for navigation evidence");
  await writer
    .getByTestId("send")
    .and(writer.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByTestId("unread-replies")).toBeVisible({
    timeout: 25000,
  });
  await writer.close();
  await page.bringToFront();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 390) await page.getByTestId("navigation-open").click();
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      // Capture settled theme colours, not an intermediate CSS transition.
      await page.evaluate(() =>
        Promise.allSettled(
          document.getAnimations().map((animation) => animation.finished),
        ),
      );
      await snapshot(
        page,
        `issues/rail-unread-badge/evidence/unread-${width}-${theme}`,
      );
    }
  }
} finally {
  await browser?.close();
  host.kill("SIGTERM");
  if (host.exitCode === null && host.signalCode === null)
    await once(host, "exit");
}
