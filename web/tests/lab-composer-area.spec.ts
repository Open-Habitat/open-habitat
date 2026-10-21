import AxeBuilder from "@axe-core/playwright";
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
  // These journeys exercise the native composer's sources and controls, not
  // the local draft field shown while creation/status is still in flight.
  await expect(
    page.getByRole("button", { name: "Komennot", exact: true }),
  ).toBeVisible();
  return page.getByRole("textbox", { name: "Viesti agentille" });
}

/** Starts a slow turn so there is time to steer and queue while Pi works. */
async function startWork(page: Page) {
  const field = page.getByRole("textbox", { name: "Viesti agentille" });
  await field.fill("hidas työ");
  await field.press("Enter");
  await expect(
    page.getByRole("button", { name: "Pysäytä agentti" }),
  ).toBeVisible({
    timeout: 20000,
  });
  await expect(field).toHaveAttribute(
    "placeholder",
    /Ohjaa agenttia… · (Alt|⌥)\+Enter: työn jälkeen/,
  );
}

test("@lab composer: typing across a turn end keeps focus, selection and text", async ({
  page,
}) => {
  const field = await newConversation(page);
  await startWork(page);
  // A slow/lost completion-status read must block sending, not local typing.
  // Let the native turn finish, but lose the idle status reply at that boundary.
  let lostCompletion = false;
  await page.route("**/status*", async (route) => {
    const response = await route.fetch();
    const status = await response.json();
    if (status.state === "idle") {
      lostCompletion = true;
      await route.fulfill({ status: 503, body: "" });
    } else await route.fulfill({ response });
  });
  await field.fill("Seuraava viesti: loppu");
  await field.press("Home");
  await page.keyboard.type("Alku. ");
  await expect(field).toBeFocused();
  // Use the keyboard, not locator.fill/press after completion: those would
  // silently refocus a field that the application had blurred or replaced.
  await expect.poll(() => lostCompletion, { timeout: 30000 }).toBe(true);
  await expect(
    page
      .getByText("Yhteys katkesi. Näytetään viimeisin tunnettu tila.")
      .first(),
  ).toBeVisible();
  if (process.env.OH_FOCUS_CAPTURE) {
    const { snapshot } = await import("../lab/session.mjs");
    await snapshot(page, process.env.OH_FOCUS_CAPTURE, {
      labOrigin: new URL(page.url()).origin,
    });
  }
  await expect(field).toBeFocused();
  await page.keyboard.type("Jatko. ");
  await expect(field).toHaveValue("Alku. Jatko. Seuraava viesti: loppu");
  await expect(
    page.getByRole("button", { name: "Ohjaa", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() === "POST") writes++;
  });
  await page.keyboard.press("Enter");
  await expect(field).toHaveValue("Alku. Jatko. Seuraava viesti: loppu");
  // Recover through the production retry, without clicking or refocusing.
  await page.unroute("**/status*");
  await expect(field).toHaveAttribute("placeholder", "Kirjoita agentille…", {
    timeout: 15000,
  });
  await expect(field).toBeFocused();
  expect(writes).toBe(0);
  await page.keyboard.type("jatkuu ");
  await expect(field).toHaveValue("Alku. Jatko. jatkuu Seuraava viesti: loppu");
});

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
  const queue = page.getByRole("region", { name: "Odottaa agenttia" });
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
  for (const name of ["Liitä tiedosto", "Komennot", "Tiedosto"]) {
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name, exact: true })).toBeFocused();
  }
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
    page.getByRole("region", { name: "Odottaa agenttia" }),
  ).toContainText("Tarkista myös README.");
  await field.focus();
  await field.press("Escape");
  await expect(field).toHaveValue("Tarkista myös README.");
  await expect(
    page.getByRole("region", { name: "Odottaa agenttia" }),
  ).toHaveCount(0);
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
  // Pi's terminal dialogs are not offered, even when searched by name.
  await page.keyboard.type("/llama");
  const llama = list.getByRole("option", { name: /\/llama/ });
  await expect(list).toBeVisible();
  await expect(llama).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(list).toHaveCount(0);
  await expect(field).toHaveValue("/review /llama");
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
  await expect(palette.getByRole("tab", { name: "Tiedostot" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  // Ctrl/⌘+P again moves to the explicit changed-only filter.
  await page.keyboard.press(`${mod}+p`);
  await expect(palette.getByRole("tab", { name: /Muutetut/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await palette.getByRole("tab", { name: "Tiedostot" }).click();
  const search = palette.getByRole("combobox", { name: "Hae" });
  // Terms do not have to occur in path order; both must match the same file.
  await search.fill("rows scripts");
  await expect(palette.getByRole("option")).toHaveCount(1);
  await expect(palette.getByRole("option")).toContainText(
    "scripts/status_rows.py",
  );
  await expect(
    palette.getByRole("option").getByTitle("muutettu"),
  ).toBeVisible();
  await search.fill("scripts missing");
  await expect(palette.getByRole("option")).toHaveCount(0);
  await search.fill("");
  const options = palette.getByRole("option");
  await expect(options.nth(1)).toBeVisible({ timeout: 10000 });
  expect(
    (await new AxeBuilder({ page }).include(".ah-palette").analyze())
      .violations,
  ).toEqual([]);
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
  // Attachment, command and file buttons drop their labels while Pi works.
  expect(fits.labels).toEqual(["none", "none", "none"]);
  for (const name of ["Pysäytä agentti", "Ohjaa"])
    expect(
      (await page.getByRole("button", { name, exact: true }).boundingBox())
        ?.height ?? 0,
    ).toBeGreaterThanOrEqual(36);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(viewport.width);
});
