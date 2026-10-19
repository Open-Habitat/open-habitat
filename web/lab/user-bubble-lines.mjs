import { openLab, snapshot } from "./session.mjs";
const { browser, page } = await openLab();
try {
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill(
      Array.from(
        { length: 7 },
        (_, i) => `Rivi ${i + 1}: tämä on viestin rivi numero ${i + 1}.`,
      ).join("\n"),
    );
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await page
    .locator('.ah-feed > li[data-kind="user"] .ah-user-content')
    .last()
    .waitFor();
  await snapshot(
    page,
    "issues/user-bubble-joins-typed-lines/evidence/seven-lines",
  );
} finally {
  await browser.close();
}
