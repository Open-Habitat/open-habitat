#!/usr/bin/env node
// Paired screenshots and inert HTML of closed stage rows (counts and elapsed
// time, no command) and the final reply header, from the synthetic lab only.
import { openLab, snapshot } from "./session.mjs";

const out = new URL("../../issues/turn-summary-plain/review/", import.meta.url)
  .pathname;
const theme = (page, value) =>
  page.evaluate(
    (value) => document.documentElement.setAttribute("data-theme", value),
    value,
  );
for (const [name, width, mode] of [
  ["stages-1440-light", 1440, "light"],
  ["stages-1440-dark", 1440, "dark"],
  ["stages-390-light", 390, "light"],
]) {
  const { browser, page } = await openLab({ width: 1440, height: 1400 });
  try {
    await page
      .getByTestId("workspace-navigation")
      .getByText("Miksi CI epäonnistuu macOS:llä?")
      .first()
      .click();
    const turn = page
      .getByTestId("agent-turn")
      .filter({ hasText: "Fleetrepo on ajan tasalla" });
    await turn.waitFor();
    await page.setViewportSize({ width, height: 1400 });
    await theme(page, mode);
    await turn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await snapshot(page, `${out}${name}`);
  } finally {
    await browser.close();
  }
}
