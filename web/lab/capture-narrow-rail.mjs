import { openLab, snapshot } from "./session.mjs";

const phase = process.argv[2];
if (!["before", "after"].includes(phase))
  throw new Error("Expected before or after");
const { browser, page } = await openLab({ deviceScaleFactor: 2 });
try {
  await page.getByTestId("close-navigation").click();
  const rail = page.getByTestId("workspace-navigation");
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    for (const [name, control] of [
      ["home", page.getByTestId("home-link")],
      ["account", rail.locator("[data-account-controls] button").first()],
    ]) {
      await control.hover();
      await snapshot(
        page,
        `issues/narrow-rail-buttons-uneven/evidence/${phase}-${theme}-${name}`,
        { region: ".ah-rail" },
      );
    }
  }
} finally {
  await browser.close();
}
