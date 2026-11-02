import { openLab, origin, snapshot } from "./session.mjs";

const phase = process.argv[2];
const { browser, page } = await openLab({
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
});
try {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const session = await (
    await page.request.get(`${origin}/auth/session`)
  ).json();
  await page.request.put(`${origin}/api/v1/account/preferences`, {
    headers: { Origin: origin, "X-Agent-Host-CSRF": session.csrf },
    data: { experimental: { "workspace-icons": true } },
  });
  await page.route("**/api/v1/workspaces/start_page*", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ response, json: { ...data, start_page: null } });
  });
  await page.reload();
  await page.goto(
    origin +
      (await page
        .getByTestId("workspace-aurinkokello")
        .first()
        .getAttribute("href")),
  );
  await page.getByTestId("landing-absent").waitFor();
  await page.getByTestId("workspace-icon-suggestions").waitFor();
  await snapshot(
    page,
    `issues/ui-text-no-internals/evidence/${phase}-start-page`,
    { region: '[data-testid="landing-absent"]' },
  );
  await snapshot(
    page,
    `issues/ui-text-no-internals/evidence/${phase}-icon-wish`,
    { region: '[data-testid="workspace-icon-suggestions"]' },
  );
} finally {
  await browser.close();
}
