import AxeBuilder from "@axe-core/playwright";
import { openLab, snapshot } from "./session.mjs";

const { browser, page, context } = await openLab({ deviceScaleFactor: 2 });
try {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("navigation").waitFor();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  for (const mode of ["network", "answer", "identity"]) {
    await page.route("**/auth/session", async (route) => {
      if (mode === "network") return route.abort("failed");
      if (mode === "answer")
        return route.fulfill({ status: 503, body: "unavailable" });
      const response = await route.fetch();
      const body = await response.json();
      return route.fulfill({
        response,
        json: { ...body, web_identity_id: "wid_example-other" },
      });
    });
    await page.reload();
    await page.getByTestId("workspaces-unavailable-title").waitFor();
    if (mode === "identity") await page.getByTestId("landing-sign-in").waitFor();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await snapshot(
        page,
        `issues/landing-server-did-not-answer/evidence/${mode}-${width}`,
      );
      console.log(`Captured ${mode}-${width}`);
    }
    await page.unroute("**/auth/session");
  }
  await page.clock.resume();
  const results = await new AxeBuilder({ page }).analyze();
  if (results.violations.length)
    throw new Error(
      JSON.stringify(
        results.violations.map(({ id, impact }) => ({ id, impact })),
      ),
    );
  console.log(
    "Six synthetic screenshot/HTML pairs and identity landing axe check passed",
  );
} finally {
  await context.close().catch(() => {});
  await browser.close();
}
