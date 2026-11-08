import { expect } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const { browser, page } = await openLab({ deviceScaleFactor: 2 });
const writerContext = await browser.newContext({
  ignoreHTTPSErrors: true,
  locale: "fi-FI",
});
const writer = await writerContext.newPage();
async function create(p) {
  await p.goto(`${origin}/workspaces`);
  await p.getByRole("navigation").getByTestId("workspace-aurinkokello").click();
  await p.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(p.getByTestId("message-input")).toBeEnabled();
}
async function send(p, text) {
  await p.getByTestId("message-input").fill(text);
  await p.getByTestId("send").click();
}
try {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.request.get(`${origin}/fixture/scenario?value=ready`);
  await writer.goto(`${origin}/workspaces`);
  await writer.getByTestId("github-sign-in").click();
  await writer
    .getByRole("link")
    .and(writer.locator('a[href*="code=42"]'))
    .click();
  await create(writer);
  await send(writer, "Tarkista seuraavaksi testit.");
  await expect(
    page.getByTestId("rail-yours").getByTestId("agent-link").first(),
  ).toBeVisible({ timeout: 25000 });
  await create(page);
  await page.request.get(`${origin}/fixture/scenario?value=pi-visual-hold`);
  await send(page, "Korjaa keskustelun asettelu.");
  await expect(page.getByTestId("next-waiting")).toBeVisible();
  await send(page, "Pidä muutos rajattuna kirjoituskentän ympäristöön.");
  await expect(page.getByTestId("composer-queue")).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await snapshot(
      page,
      `issues/queued-steer-above-next-waiting/evidence/stack-${width}`,
    );
  }
} finally {
  await browser.close();
}
