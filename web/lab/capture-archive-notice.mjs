// Synthetic lab only: inject failed source facts, never real user data.
import { openLab, origin, snapshot } from "./session.mjs";

const { browser, page } = await openLab({ width: 1440, height: 1000 });
try {
  await page.request.get(
    `${origin}/fixture/keep-workspaces?names=aurinkokello`,
  );
  let failed = "pi_history";
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.sources.find((f) => f.source === failed).state = "unavailable";
    await route.fulfill({ response, json: body });
  });
  for (const source of ["pi_history", "annotation"]) {
    failed = source;
    await page.goto(`${origin}/`);
    await page.getByText("Arkistoa ei voitu kokonaan tarkistaa").waitFor();
    await snapshot(page, `issues/archive-notice-unclear/lab/${source}`);
  }
} finally {
  await browser.close();
}
