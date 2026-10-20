import type { Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

// The composer area, direction Rivillä (round 2026-10-19-koko-alakerta): the
// keyboard flows the round checked in its prototype, here against the real
// controller, the daemon's bash relay and file list, and the fake Pi.

const mod = process.platform === "darwin" ? "Meta" : "Control";

async function newConversation(
  page: Page,
  viewport?: { width: number; height: number },
) {
  if (viewport) await page.setViewportSize(viewport);
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  if (viewport && viewport.width < 600)
    await page.getByRole("button", { name: "Avaa navigaatio" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Uusi keskustelu työtilassa aurinkokello" })
    .click();
  return page.getByRole("textbox", { name: "Viesti Pi:lle" });
}

/** Starts a slow turn so there is time to steer and queue while Pi works. */
async function startWork(page: Page) {
  const field = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await field.fill("hidas työ");
  await field.press("Enter");
  await expect(page.getByRole("button", { name: "Pysäytä Pi" })).toBeVisible({
    timeout: 20000,
  });
  await expect(field).toHaveAttribute(
    "placeholder",
    /Ohjaa Pi:tä… · (Alt|⌥)\+Enter: työn jälkeen/,
  );
}

test("@lab composer: Enter steers, Alt+Enter queues, the chip swaps, and the queue comes back into the field", async ({
  page,
}) => {
  test.setTimeout(90000);
  const field = await newConversation(page);
  await startWork(page);
  // Enter steers while Pi works; Alt+Enter goes once the other way.
  await field.fill("Älä muuta testien odotusarvoja.");
  await field.press("Enter");
  await field.fill("Aja lopuksi koko testisarja.");
  await field.press("Alt+Enter");
  const queue = page.getByRole("region", { name: "Odottaa Pi:tä" });
  await expect(queue).toContainText("Ohjaus");
  await expect(queue).toContainText("Älä muuta testien odotusarvoja.");
  await expect(queue).toContainText("Työn jälkeen");
  await expect(queue).toContainText("Aja lopuksi koko testisarja.");
  // Alt+Enter did not change the chosen mode.
  await expect(
    page.getByRole("button", {
      name: "Viestin tapa: Ohjaa. Vaihda: Työn jälkeen",
    }),
  ).toBeVisible();
  // The chip is reached by keyboard and swaps the mode; the next Enter goes that way.
  await field.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: /^Viestin tapa/ }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Viestin tapa: Työn jälkeen. Vaihda: Ohjaa",
    }),
  ).toBeVisible();
  await field.fill("Kirjoita yhteenveto.");
  await field.press("Enter");
  await expect(queue.getByRole("listitem")).toHaveCount(3);
  await expect(queue.getByRole("listitem").nth(2)).toContainText(
    "Työn jälkeen",
  );
  // Palauta kenttään takes them back in Pi's order; nothing is left queued.
  await field.fill("");
  await queue.getByRole("button", { name: "Palauta kenttään" }).click();
  await expect(field).toHaveValue(
    "Älä muuta testien odotusarvoja.\n\nAja lopuksi koko testisarja.\n\nKirjoita yhteenveto.",
  );
  await expect(queue).toHaveCount(0);
});

test("@lab composer: Esc in the field stops Pi and puts the queue back into the field", async ({
  page,
}) => {
  test.setTimeout(90000);
  const field = await newConversation(page);
  await startWork(page);
  await field.fill("Tarkista myös README.");
  await field.press("Alt+Enter");
  await expect(
    page.getByRole("region", { name: "Odottaa Pi:tä" }),
  ).toContainText("Tarkista myös README.");
  await field.focus();
  await field.press("Escape");
  await expect(field).toHaveValue("Tarkista myös README.");
  await expect(page.getByRole("region", { name: "Odottaa Pi:tä" })).toHaveCount(
    0,
  );
  await expect(
    page
      .getByText("Keskeytystä pyydetään")
      .or(
        page.getByText(
          /Keskeytyspyyntö vastaanotettiin|Keskeytyksen tulos epävarma/,
        ),
      )
      .first(),
  ).toBeVisible({ timeout: 35000 });
});

test("@lab composer: !make serve runs through Pi, shows its run chip, and Esc stops it", async ({
  page,
}) => {
  test.setTimeout(90000);
  const field = await newConversation(page);
  await field.fill("Aloita");
  await field.press("Enter");
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("button", { name: "Pysäytä Pi" })).toHaveCount(
    0,
    { timeout: 20000 },
  );
  await field.fill("!make serve");
  await expect(page.getByText("Komento työtilassa")).toBeVisible();
  await expect(page.getByText("Pi näkee tulosteen")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aja" })).toBeVisible();
  await field.press("Enter");
  // The field clears, as in Pi's TUI; the command's block streams its output.
  await expect(field).toHaveValue("");
  const run = page.getByRole("region", { name: "Sinä · komento" });
  await expect(run).toContainText("make serve");
  await expect(run).toContainText("Serving HTTP", { timeout: 15000 });
  await expect(run).toContainText("ajossa");
  const stop = page.getByRole("button", { name: "Pysäytä komento make serve" });
  await expect(stop).toBeVisible();
  await expect(page.locator(".ah-crow-run")).toContainText("make serve");
  // A second command while one runs is refused, not queued.
  await field.fill("!ls");
  await field.press("Enter");
  await expect(
    page.getByText("Edellinen komento on vielä käynnissä. Pysäytä se ensin."),
  ).toBeVisible();
  await field.fill("");
  await field.press("Escape");
  await expect(stop).toHaveCount(0, { timeout: 15000 });
  // Pi's own history entry takes over from the live block.
  const saved = page.getByRole("region", {
    name: "Sinä · paikallinen komento",
  });
  await expect(saved).toContainText("peruttu", { timeout: 15000 });
  await expect(saved).toContainText("make serve");
});

test("@lab composer: `!!` keeps the output from Pi and finishes with its exit code", async ({
  page,
}) => {
  test.setTimeout(90000);
  const field = await newConversation(page);
  await field.fill("!!git status");
  await expect(page.getByText("vain sinulle, ei Pi:lle")).toBeVisible();
  // A new conversation's command waits for the Pi it starts.
  await field.press("Enter");
  const saved = page.getByRole("region", {
    name: "Sinä · paikallinen komento",
  });
  await expect(saved).toContainText("ei mallin kontekstissa", {
    timeout: 25000,
  });
  await expect(saved).toContainText("paluuarvo 0");
});

test("@lab composer: `/` and `@` complete at the caret from Pi's list and the workspace", async ({
  page,
}) => {
  test.setTimeout(90000);
  const field = await newConversation(page);
  await field.focus();
  await page.keyboard.type("/rev");
  const list = page.getByRole("listbox");
  await expect(list.getByRole("option", { name: /\/review/ })).toBeVisible({
    timeout: 15000,
  });
  await page.keyboard.press("Enter");
  await expect(field).toHaveValue("/review ");
  // Pi's dialog commands are listed but not run.
  await page.keyboard.type("/mc");
  const mcp = list.getByRole("option", { name: /\/mcp/ });
  await expect(mcp).toHaveAttribute("aria-disabled", "true");
  await expect(mcp).toContainText("vain Pi:n päätteessä");
  await page.keyboard.press("Escape");
  await expect(list).toHaveCount(0);
  await expect(field).toHaveValue("/review /mc");
  // A mid-line `/` is a mention: nothing is highlighted, so Enter would send.
  await field.fill("");
  await page.keyboard.type("katso /re");
  await expect(list).toBeVisible();
  await expect(field).not.toHaveAttribute("aria-activedescendant", /./);
  await page.keyboard.press("Escape");
  // `@` lists the workspace's own files and Tab inserts the top match.
  await field.fill("");
  await page.keyboard.type("lue @status");
  await expect(
    list.getByRole("option", { name: /status/ }).first(),
  ).toBeVisible({ timeout: 10000 });
  await page.keyboard.press("Tab");
  await expect(field).toHaveValue(/^lue @\S*status\S* $/);
  // The Komennot button opens the same list with a search; Enter puts the
  // command at the start of the message.
  await field.fill("korjaa testit");
  await page.getByRole("button", { name: "Komennot" }).click();
  const search = page.getByRole("combobox", {
    name: "Hae komentoa tai taitoa",
  });
  await expect(search).toBeFocused();
  await search.fill("fix");
  await search.press("Enter");
  await expect(field).toHaveValue("/fix-tests korjaa testit");
  await expect(field).toBeFocused();
});

test("@lab composer: Ctrl/⌘+P opens the palette, marks two files with Tab and inserts both", async ({
  page,
}) => {
  test.setTimeout(90000);
  const field = await newConversation(page);
  await field.fill("Katso ");
  await field.press(`${mod}+p`);
  const palette = page.getByRole("dialog", {
    name: "Valitse tiedostot tai komento",
  });
  await expect(palette).toBeVisible();
  await expect(palette.getByRole("tab", { name: /Muutetut/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  // Ctrl/⌘+P again moves to the next tab.
  await page.keyboard.press(`${mod}+p`);
  await expect(palette.getByRole("tab", { name: "Tiedostot" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const options = palette.getByRole("option");
  await expect(options.nth(1)).toBeVisible({ timeout: 10000 });
  const paths = await palette
    .locator(".ah-choice-path")
    .evaluateAll((nodes) => nodes.slice(0, 2).map((node) => node.textContent));
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(palette.getByText("lisää 2 polkua")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(palette).toHaveCount(0);
  await expect(field).toHaveValue(`Katso @${paths[0]} @${paths[1]} `);
  // Esc returns to the field at the same caret without changing the text.
  const before = await field.inputValue();
  await field.press(`${mod}+p`);
  await expect(palette).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(before);
});

test("@lab composer on a phone: the bottom row fits while Pi works and the list spans the width", async ({
  page,
}) => {
  test.setTimeout(90000);
  const viewport = { width: 390, height: 844 };
  await newConversation(page, viewport);
  await startWork(page);
  const row = page.locator(".ah-crow");
  const fits = await row.evaluate((node) => ({
    overflow: node.scrollWidth - node.clientWidth,
    right: node.getBoundingClientRect().right,
    labels: [...node.querySelectorAll(".ah-crow-lbl")].map(
      (label) => getComputedStyle(label).display,
    ),
  }));
  expect(fits.overflow).toBeLessThanOrEqual(1);
  expect(fits.right).toBeLessThanOrEqual(viewport.width);
  // Komennot and Tiedosto drop their labels while Pi works.
  expect(fits.labels).toEqual(["none", "none"]);
  for (const name of ["Pysäytä Pi", "Ohjaa"])
    expect(
      (await page.getByRole("button", { name, exact: true }).boundingBox())
        ?.height ?? 0,
    ).toBeGreaterThanOrEqual(36);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(viewport.width);
});
