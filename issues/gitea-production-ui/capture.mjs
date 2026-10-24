// Review material for Jari: the existing production components with the
// synthetic Gitea, as screenshots beside their inert static HTML twins.
// Synthetic lab only (scripts/lab.sh start); snapshot() refuses any other
// host. Run from the repository root:
//   node issues/gitea-production-ui/capture.mjs
import { fileURLToPath } from "node:url";
import { openLab, origin, snapshot } from "../../web/lab/session.mjs";

const out = fileURLToPath(new URL("./evidence/", import.meta.url));
const { browser, page } = await openLab({ width: 1280, height: 900 });
const fixture = (action) => page.request.get(`${origin}/fixture/gitea?action=${action}`);
const { url, token } = await (await fixture("enable")).json();
const shot = async (name, themes = ["light"]) => {
  for (const theme of themes) {
    await page.emulateMedia({ colorScheme: theme });
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
      document.documentElement.style.colorScheme = value;
    }, theme);
    // Let colour transitions finish before the picture is taken.
    await page.waitForTimeout(800);
    await snapshot(page, `${out}gitea-${name}-${theme}`);
  }
  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "light";
  });
};
const testId = (id) => page.getByTestId(id);
try {
  await page.goto(`${origin}/settings/integrations`);
  await testId("integration-tile-gitea")
    .getByTestId("integration-connect-open")
    .click();
  const dialog = testId("gitea-dialog");
  await page.setViewportSize({ width: 390, height: 568 });
  await dialog.getByTestId("gitea-address").fill(url.replace(/^https:\/\//, ""));
  await dialog.getByTestId("gitea-token").fill("not-the-token");
  await dialog.getByTestId("gitea-token-help").click();
  await dialog
    .getByTestId("gitea-agent-note")
    .evaluate((e) => e.scrollIntoView({ block: "end" }));
  await dialog.getByTestId("gitea-submit").click();
  await dialog.getByTestId("gitea-error").waitFor();
  await shot("form-error-390x568", ["light", "dark"]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await dialog.getByTestId("gitea-token").fill(token);
  await dialog.getByTestId("gitea-submit").click();
  await dialog.getByTestId("gitea-connected").waitFor();
  await shot("connected");
  await dialog.getByTestId("gitea-done").click();
  await testId("gitea-connection").waitFor();
  await shot("integrations");

  await page.goto(`${origin}/workspaces/new`);
  const search = testId("repository-search");
  const gitea = (name) =>
    page.locator(
      `main [data-testid="repository-option-${name}"][data-source="gitea"]`,
    );
  await search.fill("fixture/first");
  await gitea("fixture/first").waitFor();
  await shot("common-search-desktop", ["light", "dark"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await shot("common-search-phone");
  await page.setViewportSize({ width: 1280, height: 900 });
  await search.fill("");
  await shot("common-list-desktop");

  await fixture("hold");
  await search.fill("fixture/notes");
  await gitea("fixture/notes").click();
  await testId("repo-details-source").waitFor();
  await shot("details-desktop");
  await testId("repository-clone").click();
  await page
    .locator('[data-testid="clone-job"][data-repository="fixture/notes"]')
    .waitFor();
  await page.locator("main").evaluate((main) => {
    main.scrollTop = 0;
  });
  await shot("job-running-desktop");
  await fixture("release");
  await page
    .locator(
      '[data-testid="clone-job"][data-repository="fixture/notes"][data-state="confirmed"]',
    )
    .waitFor({ timeout: 20000 });

  await fixture("fail");
  await page.goto(`${origin}/workspaces/new`);
  await testId("repository-source-note").waitFor();
  await shot("source-failed-desktop");
} finally {
  await fixture("recover").catch(() => {});
  await fixture("release").catch(() => {});
  await browser.close();
}
