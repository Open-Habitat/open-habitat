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
  const history = await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .locator('a[href*="a1a1a1a1-0000-4000-8000-000000000001"]')
    .first()
    .getAttribute("href");
  if (!history) throw Error("Missing synthetic multi-group history");
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
      if (slug === "conversation-view-fidelity") {
        for (const [name, region] of [
          ["header", ".ah-agent-header"],
          ["composer", ".ah-composer"],
        ]) {
          await snapshot(page, `issues/${slug}/lab-${width}-${theme}-${name}`, {
            region,
          });
        }
        await snapshot(
          page,
          `issues/${slug}/lab-${width}-${theme}-reply-header`,
          { region: ".ah-message-reply header" },
        );
        await page.goto(`${origin}${history}`);
        await page.evaluate(
          (theme) => document.documentElement.setAttribute("data-theme", theme),
          theme,
        );
        await page.locator(".ah-message-reply").first().waitFor();
        await snapshot(page, `issues/${slug}/lab-${width}-${theme}-reply`, {
          region: ".ah-message-reply",
        });
        await fixture("scenario?value=pi-recap");
        await page.goto(`${origin}${workspace}`);
        await page.evaluate(
          (theme) => document.documentElement.setAttribute("data-theme", theme),
          theme,
        );
        await page
          .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
          .click();
        const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
        await editor.fill("Tutki synteettinen työtila");
        await page.getByRole("button", { name: "Lähetä", exact: true }).click();
        await page
          .getByText("luotu automaattisesti")
          .waitFor({ timeout: 30000 });
        await snapshot(page, `issues/${slug}/lab-${width}-${theme}-recap`, {
          region: ".ah-recap",
        });
        await fixture("scenario?value=pi-visual-hold");
        await page.goto(`${origin}${workspace}`);
        await page.evaluate(
          (theme) => document.documentElement.setAttribute("data-theme", theme),
          theme,
        );
        await page
          .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
          .click();
        const workingEditor = page.getByRole("textbox", {
          name: "Viesti Pi:lle",
        });
        await workingEditor.fill("Näytä pitkä tuloste");
        await page.getByRole("button", { name: "Lähetä", exact: true }).click();
        await page.getByRole("button", { name: "Ohjaa" }).waitFor();
        await workingEditor.fill("Pitkä luonnos. ".repeat(50));
        await snapshot(page, `issues/${slug}/lab-${width}-${theme}-working`, {
          region: ".ah-composer",
        });
        await fixture("scenario?value=ready");
      }
      if (
        slug === "turn-thread-fidelity" ||
        slug === "conversation-view-fidelity" ||
        slug === "bash-card-fidelity"
      ) {
        await page.goto(`${origin}${history}`);
        await page.evaluate(
          (theme) => document.documentElement.setAttribute("data-theme", theme),
          theme,
        );
        await page.locator(".ah-agent-turn").last().waitFor();
        await page
          .locator(".ah-agent-turn")
          .nth(2)
          .evaluate((el) => el.setAttribute("data-lab-capture", "groups"));
        await snapshot(page, `issues/${slug}/lab-${width}-${theme}-groups`, {
          region: "[data-lab-capture=groups]",
        });
        await fixture("scenario?value=pi-visual-hold");
        await page.goto(`${origin}${workspace}`);
        await page.evaluate(
          (theme) => document.documentElement.setAttribute("data-theme", theme),
          theme,
        );
        await page
          .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
          .click();
        await page
          .getByRole("textbox", { name: "Viesti Pi:lle" })
          .fill("Näytä pitkä tuloste");
        await page.getByRole("button", { name: "Lähetä", exact: true }).click();
        await page
          .locator(".ah-live-tool-row")
          .first()
          .waitFor({ timeout: 15000 });
        await snapshot(page, `issues/${slug}/lab-${width}-${theme}-live`, {
          region: ".ah-agent-turn:has(.ah-live-tool-row)",
        });
        await fixture("scenario?value=ready");
        await page
          .getByText(/Selvä. Kysyit:/)
          .last()
          .waitFor({ timeout: 30000 });
        await fixture("conversations-reset");
        await fixture("lab-conversations-clean");
        await page.goto(`${origin}${workspace}`);
        await page.evaluate(
          (theme) => document.documentElement.setAttribute("data-theme", theme),
          theme,
        );
        await page
          .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
          .click();
        await page
          .getByRole("textbox", { name: "Viesti Pi:lle" })
          .fill("Näytä komento joka epäonnistuu");
        await page.getByRole("button", { name: "Lähetä", exact: true }).click();
        await page
          .getByText(/Selvä. Kysyit:/)
          .last()
          .waitFor({ timeout: 30000 });
        await page.reload();
        await page
          .locator('.ah-tool-row[data-state="failed"]')
          .first()
          .waitFor();
        await snapshot(page, `issues/${slug}/lab-${width}-${theme}-failed`, {
          region: '.ah-agent-turn:has(.ah-tool-row[data-state="failed"])',
        });
      }
    }
} finally {
  await browser.close();
}
