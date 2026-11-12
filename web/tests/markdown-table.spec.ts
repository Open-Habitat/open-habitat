import AxeBuilder from "@axe-core/playwright";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  deviceScaleFactor: 2,
});

// Jari's hour report (12.11.2026): short date and hour columns beside a long
// Finnish description.
const hours = [
  "| Pvm | h | Kuvaus |",
  "| --- | --- | --- |",
  "| 11-10 | 8,25 | Työpäivä Contosoilla klo 7.00–16.15 (lounastauko 1 h): Jarmon kanssa Altiumin suunnittelusäännöt ja DRC agentin kautta; Annan Open Habitat -käyttöönotto ja riskikomponenttien historia; Aleksin kanssa Bezala, selaimen agenttikäyttö ja agenttiohjeiden ylläpito; Tonin kanssa projektipäällikön tilannekuva embedded-ohjelmistosta; Marinan tehtävien siirron läpikäynti; toimitusaineistojen siirto Contosoin omiin repoihin |",
  "| 11-11 | 0,5 | Keskustelu Peterin kanssa |",
  "| 11-11 | 0,5 | Contosoin Open Habitat -ympäristö ja SharePoint-yhteys |",
  "| 11-12 | 1,0 | 10.11. tapaamisten viimeistely: litteroinnit ja muistiot (Jarmo, Toni, Marina), jatkotoimet työjonoon ja palaveritallentimen vaihtoehtojen tarkennus |",
].join("\n");
const wide = [
  "| Tunnus | Nimi | Tila | Omistaja | Päivitetty | Kuvaus | Huomio |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  "| OH-1 | Selainistunnot | valmis | Jari Mustonen | 2026-11-10 | Istunnot jatkuvat palvelimella tmuxissa | Ei toimenpiteitä |",
].join("\n");

test("Markdown tables keep short cells whole and scroll a wide table in its own region", async ({
  page,
}) => {
  await page.route("**/api/v1/agents/*/history?*", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    if (json.entries)
      json.entries = [
        {
          entry_key: "table-reply",
          kind: "assistant",
          content: {
            media_type: "text/plain",
            text: `Kirjasin marraskuun tunnit:\n\n${hours}\n\nMarraskuun yhteissumma on nyt **19,5 h** (ennen 9,25 h).\n\n${wide}\n`,
            complete: true,
          },
        },
      ];
    await route.fulfill({ response, json });
  });
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.goto("/agents/pi:a1a1a1a1-0000-4000-8000-000000000001");
  const regions = page.locator(".ah-markdown-table");
  await expect(regions).toHaveCount(2);
  const hourTable = regions.nth(0);
  const wideTable = regions.nth(1);
  // Captured before any assertion so the same spec records the old layout;
  // a tall viewport keeps the composer clear of the reply.
  if (process.env.OH_VISUAL_CAPTURE === "1") {
    const { snapshot } = await import("../lab/session.mjs");
    const label = process.env.OH_TABLE_CAPTURE_LABEL || "after";
    for (const width of [1440, 390])
      for (const scheme of ["light", "dark"] as const) {
        await page.setViewportSize({ width, height: 2600 });
        await page.emulateMedia({ colorScheme: scheme });
        await hourTable.scrollIntoViewIfNeeded();
        await snapshot(
          page,
          `../issues/markdown-table-columns-crushed/evidence/${label}-${width}-${scheme}`,
          {
            labOrigin: new URL(page.url()).origin,
            region: ".ah-markdown",
            html: false,
          },
        );
      }
    await page.emulateMedia({ colorScheme: "light" });
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await hourTable.scrollIntoViewIfNeeded();
    // Every short cell (date, hours, header) stays on one line.
    const lineCounts = await hourTable
      .locator("tr > :is(th, td):nth-child(-n + 2)")
      .evaluateAll((cells) =>
        cells.map((cell) => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          const lines = new Set(
            Array.from(range.getClientRects()).map((r) => Math.round(r.top)),
          );
          return [cell.textContent, lines.size];
        }),
      );
    expect(lineCounts.length).toBe(10);
    for (const [text, lines] of lineCounts)
      expect(lines, `${text} wraps at ${width}px`).toBe(1);
    // The description column wraps rather than widening the table.
    expect(
      await hourTable.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    ).toBe(true);
    if (width === 390) {
      // The wide table scrolls inside its region, not the page.
      expect(
        await wideTable.evaluate((e) => e.scrollWidth > e.clientWidth + 1),
      ).toBe(true);
      await wideTable.focus();
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(() => wideTable.evaluate((e) => e.scrollLeft))
        .toBeGreaterThan(0);
      await wideTable.evaluate((e) => {
        e.scrollLeft = 0;
      });
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await expect(page.getByRole("group", { name: "Taulukko" })).toHaveCount(2);
    expect(
      (await new AxeBuilder({ page }).include(".ah-markdown-table").analyze())
        .violations,
    ).toEqual([]);
  }
});
