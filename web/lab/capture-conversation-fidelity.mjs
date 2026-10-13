#!/usr/bin/env node
// Paired screenshots and inert HTML from synthetic lab, never a live host.
import { openLab, origin, snapshot } from "./session.mjs";

const slug = process.argv[2];
if (
  ![
    "bash-card-fidelity",
    "turn-thread-fidelity",
    "conversation-view-fidelity",
  ].includes(slug)
)
  throw Error("Expected fidelity issue slug");
const { browser, page } = await openLab();
try {
  const fixture = async (path) => {
    const response = await page.request.get(`${origin}/fixture/${path}`);
    if (response.status() !== 204) throw Error(`${path}: ${response.status()}`);
  };
  const workspace = await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: "aurinkokello", exact: true })
    .first()
    .getAttribute("href");
  if (!workspace) throw Error("Missing synthetic workspace");
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await fixture("scenario?value=ready");
      await fixture("conversations-reset");
      await fixture("lab-conversations-clean");
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/workspaces`);
      await page.goto(`${origin}${workspace}`);
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      await page
        .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
        .click();
      const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
      await editor.fill("Näytä pitkä tuloste");
      await page.getByRole("button", { name: "Lähetä", exact: true }).click();
      await page
        .getByText(/Selvä. Kysyit:/)
        .last()
        .waitFor({ timeout: 30000 });
      await page.reload();
      await page.locator(".ah-bash-card").first().waitFor();
      await snapshot(page, `issues/${slug}/lab-${width}-${theme}-bash`, {
        region:
          slug === "bash-card-fidelity"
            ? ".ah-tool-row:has(.ah-bash-card)"
            : undefined,
      });
    }
} finally {
  await browser.close();
}
