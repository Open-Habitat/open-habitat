#!/usr/bin/env node
// Synthetic lab only (integrations-catalog-core): Asetukset › Integraatiot
// through its states, for side-by-side comparison with the accepted "Tili"
// prototype (design-system/prototypes/rounds/2026-10-18-integraatiot/). The
// Google and Microsoft entries are the lab's stand-ins; the IMAP entry is the
// product's, against the fake himalaya.
//   scripts/lab.sh start && node web/lab/capture-integrations.mjs
import { origin, openLab, snapshot } from "./session.mjs";

const out = "issues/integrations-catalog-core/lab";
const fixture = (page, q) =>
  page.request.get(`${origin}/fixture/integrations?${q}`);
const { browser, page } = await openLab();
const dialog = page.getByRole("dialog");
const tile = (name) => page.locator(".ig-tile").filter({ hasText: name });
const open = async () => {
  await page.goto(`${origin}/settings/integrations`);
  await page.getByRole("heading", { name: "Integraatiot", level: 2 }).waitFor();
  await page.getByText("Luetaan integraatioita").waitFor({ state: "detached" });
  await page.waitForTimeout(400);
};
try {
  await fixture(page, "action=reset");
  await page.setViewportSize({ width: 1280, height: 900 });
  await open();
  await snapshot(page, `${out}/01-empty`);

  // IMAP with an app password: refused, then connected.
  await tile("Sähköposti (IMAP)")
    .getByRole("button", { name: "Yhdistä…" })
    .click();
  await snapshot(page, `${out}/02-imap-intro`);
  await dialog.getByRole("button", { name: "Jatka" }).click();
  await dialog.getByLabel("Sähköpostiosoite").fill("person@example.test");
  await dialog.getByLabel("Sovellussalasana").fill("wrong-password");
  await dialog.getByRole("button", { name: "Yhdistä" }).click();
  await dialog.getByRole("alert").waitFor();
  await snapshot(page, `${out}/03-imap-refused`);
  await dialog.getByLabel("Sovellussalasana").fill("synthetic-app-password");
  await dialog.getByRole("button", { name: "Yhdistä" }).click();
  await dialog.getByText("Yhdistetty: person@example.test.").waitFor();
  await dialog.getByRole("button", { name: "Valmis" }).click();

  // Microsoft with a device code, then folders.
  await tile("Microsoft 365").getByRole("button", { name: "Yhdistä…" }).click();
  await snapshot(page, `${out}/04-microsoft-intro`);
  await dialog.getByRole("button", { name: "Jatka: Microsoft" }).click();
  await dialog.getByText("K7QM2PXDW").waitFor();
  await snapshot(page, `${out}/05-device-code`);
  await fixture(page, "action=approve");
  await dialog.getByText(/Mitkä kansiot synkronoidaan/).waitFor();
  await snapshot(page, `${out}/06-folders`);
  await dialog.getByRole("button", { name: /Aloita synkronointi/ }).click();
  await dialog.getByText(/Yhdistetty: person@work/).waitFor();
  await snapshot(page, `${out}/07-connected`);
  await dialog.getByRole("button", { name: "Valmis" }).click();

  // Google with a pasted redirect: the provider's own page is refused, and
  // a folder that does not fit is shown as such.
  await tile("Google").getByRole("button", { name: "Yhdistä…" }).click();
  await dialog.getByRole("button", { name: "Jatka: Google" }).click();
  await snapshot(page, `${out}/08-paste-open`);
  const popup = page.waitForEvent("popup");
  await dialog.getByRole("link", { name: "Avaa Google" }).click();
  await (await popup).close();
  await dialog
    .getByRole("textbox", { name: "Paluuosoite" })
    .fill("https://accounts.example.test/signin/oauth/consent?authuser=0");
  await dialog.getByRole("button", { name: "Yhdistä" }).click();
  await dialog.getByRole("alert").waitFor();
  await snapshot(page, `${out}/09-paste-wrong`);
  await dialog
    .getByRole("textbox", { name: "Paluuosoite" })
    .fill("http://127.0.0.1:46399/oauth2/callback?state=lab&code=4/synthetic");
  await dialog.getByRole("button", { name: "Yhdistä" }).click();
  await dialog.getByText(/Mitkä kansiot synkronoidaan/).waitFor();
  await dialog.getByText("Kuvat", { exact: true }).click();
  await dialog.getByText("Ei mahdu.").waitFor();
  await snapshot(page, `${out}/10-folders-over-quota`);
  await dialog.getByText("Kuvat", { exact: true }).click();
  await dialog.getByRole("button", { name: /Aloita synkronointi/ }).click();
  await dialog.getByText(/Yhdistetty: person.home/).waitFor();
  await dialog.getByRole("button", { name: "Valmis" }).click();
  await page.waitForTimeout(600);
  await snapshot(page, `${out}/11-accounts`);

  // An expired login, as the tool reports it.
  await fixture(page, "action=expire&provider=google");
  await open();
  await snapshot(page, `${out}/12-expired`);

  // Tenant refusals.
  await fixture(page, "action=outcome&value=consent");
  await page
    .getByRole("button", { name: "Lisää toinen Microsoft 365-tili" })
    .click();
  await dialog.getByRole("button", { name: "Jatka: Microsoft" }).click();
  await dialog.getByRole("alert").waitFor();
  await snapshot(page, `${out}/13-consent-required`);
  await page.keyboard.press("Escape");
  await fixture(page, "action=outcome&value=blocked");
  await page
    .getByRole("button", { name: "Lisää toinen Microsoft 365-tili" })
    .click();
  await dialog.getByRole("button", { name: "Jatka: Microsoft" }).click();
  await dialog.getByRole("alert").waitFor();
  await snapshot(page, `${out}/14-device-code-blocked`);
  await page.keyboard.press("Escape");
  await fixture(page, "action=reset");

  // Removal.
  await page
    .getByRole("article", { name: /person\.home@example\.test/ })
    .getByRole("button", { name: "Poista…" })
    .click();
  await page.getByRole("alertdialog").waitFor();
  await snapshot(page, `${out}/15-remove`);
  await page.keyboard.press("Escape");

  // Phone width and the dark theme.
  await page.setViewportSize({ width: 390, height: 844 });
  await open();
  await snapshot(page, `${out}/16-phone`);
  await page.evaluate(() => localStorage.setItem("nah:theme", "dark"));
  await page.setViewportSize({ width: 1280, height: 900 });
  await open();
  await snapshot(page, `${out}/17-dark`);
  await page.evaluate(() => localStorage.removeItem("nah:theme"));
} finally {
  await browser.close();
}
