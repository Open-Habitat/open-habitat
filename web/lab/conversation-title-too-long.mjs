// Synthetic lab capture of the native-history title regeneration journey.
import { execFileSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { openLab, snapshot, origin } from "./session.mjs";

const { browser, page } = await openLab();
page.setDefaultTimeout(20000);
try {
  await page.request.get(`${origin}/fixture/scenario?value=ready`);
  await page.goto(new URL("/workspaces", page.url()).href);
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page
    .getByTestId("message-input")
    .fill("Testataan muistutusta tässä keskustelussa");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await page.locator(".ah-agent-header h1").waitFor();
  // Wait for the synthetic native turn to settle before restarting its daemon.
  await page.getByTestId("conversation-retitle").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const button = document.querySelector(
      '[data-testid="conversation-retitle"]',
    );
    return button && !button.disabled;
  });
  await page.getByTestId("history-stage-toggle").last().waitFor();
  const url = page.url();
  await page.request.get(`${origin}/fixture/daemon-restart`);
  await page.goto(url);
  await page.getByTestId("conversation-retitle").click();
  await page.waitForFunction(
    () =>
      document.querySelector(".ah-agent-header h1")?.textContent ===
      "Synteettinen otsikko",
  );
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (theme) => document.documentElement.setAttribute("data-theme", theme),
      theme,
    );
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const out = `issues/conversation-title-too-long/${theme}-${width}`;
      await snapshot(page, out);
      execFileSync("avifenc", [
        "-j",
        "1",
        "-q",
        "80",
        `${out}.png`,
        `${out}.avif`,
      ]);
      unlinkSync(`${out}.png`);
    }
  }
} finally {
  await browser.close();
}
