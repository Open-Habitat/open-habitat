#!/usr/bin/env node
// Synthetic lab only (implement-composer-area): the composer area's key
// states, named as the round's shots are (<form>-<theme>-<n>-<state>) so they
// can be compared side by side with
// issues/proto-composer-area/shots/*-v1-*.png (direction Rivillä).
//   scripts/lab.sh start && node web/lab/capture-composer-area.mjs
import { openLab, origin, snapshot } from "./session.mjs";

const out = "issues/implement-composer-area/shots";
const { browser, page } = await openLab();
page.setDefaultTimeout(25000);
const fixture = async (path) => {
  const response = await page.request.get(`${origin}/fixture/${path}`);
  if (response.status() !== 204) throw new Error(`fixture ${path}`);
};
const field = () => page.getByRole("textbox", { name: "Viesti Pi:lle" });
const composer = ".ah-conversation-frame > .ah-composer";

async function newConversation(width) {
  await fixture("lab-conversations-clean");
  await fixture("scenario?value=ready");
  await page.goto(`${origin}/workspaces`);
  if (width < 600)
    await page.getByRole("button", { name: "Avaa navigaatio" }).click();
  await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("button", { name: "Uusi keskustelu työtilassa aurinkokello" })
    .click();
  await field().waitFor();
}

async function shoot(form, theme, name) {
  await page.waitForTimeout(400);
  await snapshot(page, `${out}/${form}-${theme}-${name}`);
}

try {
  for (const [form, width, height] of [
    ["desk", 1080, 710],
    ["phone", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((t) => localStorage.setItem("nah:theme", t), theme);
      await newConversation(width);
      await shoot(form, theme, "10-new");
      // Pi works on a slow turn: the mode chip, Stop and the queue card.
      await field().fill("hidas työ");
      await field().press("Enter");
      await page.getByRole("button", { name: "Pysäytä Pi" }).waitFor();
      await field().fill("Päivitä myös README");
      await shoot(form, theme, "4-working-draft");
      await field().fill("Älä muuta testien odotusarvoja.");
      await field().press("Enter");
      await field().fill("Kun olet valmis, aja koko testisarja.");
      await field().press("Alt+Enter");
      await page.getByRole("region", { name: "Odottaa Pi:tä" }).waitFor();
      await field().fill("Päivitä myös README");
      await shoot(form, theme, "5-queued");
      await page.getByRole("button", { name: "Palauta kenttään" }).click();
      await page
        .getByRole("region", { name: "Odottaa Pi:tä" })
        .waitFor({ state: "detached" });
      await page
        .getByRole("button", { name: "Lähetä", exact: true })
        .waitFor({ timeout: 40000 });
      // `/` and `@` at the caret, then `!make serve` running.
      await field().fill("");
      await field().focus();
      await page.keyboard.type("/re");
      await page.getByRole("listbox").getByRole("option").first().waitFor();
      await shoot(form, theme, "1-slash");
      await page.keyboard.press("Escape");
      await field().fill("Katso ");
      await field().focus();
      await page.keyboard.press("End");
      await page.keyboard.type("@sta");
      await page.getByRole("listbox").getByRole("option").first().waitFor();
      await shoot(form, theme, "2-at");
      await page.keyboard.press("Escape");
      await field().fill("Katso ");
      await page.keyboard.press(
        process.platform === "darwin" ? "Meta+p" : "Control+p",
      );
      await page
        .getByRole("dialog", { name: "Valitse tiedostot tai komento" })
        .waitFor();
      await page.keyboard.press(
        process.platform === "darwin" ? "Meta+p" : "Control+p",
      );
      await page.getByRole("dialog").getByRole("option").first().waitFor();
      await page.keyboard.press("Tab");
      await shoot(form, theme, "6-palette");
      await page.keyboard.press("Escape");
      await field().fill("!make serve");
      await shoot(form, theme, "7-shell-typed");
      await field().press("Enter");
      await page
        .getByRole("button", { name: "Pysäytä komento make serve" })
        .waitFor();
      await page.getByText("Serving HTTP").first().waitFor();
      await shoot(form, theme, "8-shell-running");
      await field().press("Escape");
      await page
        .getByRole("button", { name: "Pysäytä komento make serve" })
        .waitFor({ state: "detached" });
      await page.locator(composer).waitFor();
    }
  }
} finally {
  await fixture("scenario?value=ready").catch(() => {});
  await browser.close();
}
