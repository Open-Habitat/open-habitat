import { writeFile } from "node:fs/promises";
import { openLab, origin, snapshot } from "./session.mjs";

const phase = process.argv[2] || "before";
const { browser, page } = await openLab();
await page.request.get(`${origin}/fixture/conversations-reset`);
await page.request.get(`${origin}/fixture/scenario?value=pi-deltas`);
await page
  .getByRole("navigation")
  .getByRole("link", { name: "aurinkokello" })
  .click();
await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
await page
  .getByRole("textbox", { name: "Viesti Pi:lle" })
  .fill("hidas synteettinen työ");
await page.evaluate(() => {
  window.samples = [];
  const sample = () => {
    const box = (s) => document.querySelector(s)?.getBoundingClientRect();
    window.samples.push({
      t: Math.round(performance.now()),
      check: !![...document.querySelectorAll("button")].find(
        (n) => n.textContent === "Tarkista keskustelun tila",
      ),
      progress: document.querySelector(".ah-working-progress")?.textContent,
      recap: !!box(".ah-recap"),
      process: !!box(".ah-process-tray"),
      jump: !!document.querySelector(".ah-floating-controls button"),
      composer: document.querySelector("textarea")?.placeholder,
      disabled: document.querySelector("textarea")?.disabled,
      editorY: box(".ah-composer-entry")?.y,
      notices: document.querySelector(".ah-conversation-notices")?.textContent,
    });
  };
  new MutationObserver(sample).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  window.sampleTimer = setInterval(sample, 50);
});
await page.getByRole("button", { name: "Lähetä", exact: true }).click();
for (const [name, delay] of [
  ["accepted", 400],
  ["streaming", 2200],
  ["tool", 4600],
  ["answer", 6000],
]) {
  await page.waitForTimeout(delay);
  await snapshot(page, `issues/live-turn-flicker/${phase}-${name}`);
}
await page
  .getByRole("button", { name: "Lähetä", exact: true })
  .waitFor({ timeout: 30000 });
await snapshot(page, `issues/live-turn-flicker/${phase}-settled`);
await page.request.get(`${origin}/fixture/scenario?value=pi-recap`);
await page.getByRole("textbox", { name: "Viesti Pi:lle" }).fill("Lyhyt jatko");
await page.getByRole("button", { name: "Lähetä", exact: true }).click();
await page.getByText("luotu automaattisesti").waitFor({ timeout: 30000 });
await snapshot(page, `issues/live-turn-flicker/${phase}-recap`);
await writeFile(
  `issues/live-turn-flicker/${phase}-mutations.json`,
  JSON.stringify(
    await page.evaluate(() => {
      clearInterval(window.sampleTimer);
      return window.samples;
    }),
    null,
    2,
  ),
);
await browser.close();
