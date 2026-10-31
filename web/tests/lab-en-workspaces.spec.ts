import type { Page } from "@playwright/test";
import { expect, test } from "./lab-host";

// The workspace views in English (en-workspaces): an English browser with
// the server default on System gets home, the workspace page, its Git
// details and the clone page in English, with none of their Finnish left.
test.use({ locale: "en-GB", viewport: { width: 1280, height: 900 } });

// Words these views said in Finnish; any of them in the main region means a
// message was missed. Host content (names, branches, commit subjects) in
// the lab is Finnish too, so whole words of the interface are matched.
const finnish =
  /\b(Työtilat|Uusi työtila|Avoimet|Valmiit|Keskustelut|Kloonaa|Haetaan|Päivitetty|Seurantahaara|Pohjahaara|Muutokset|Päivitä tila|Mikään ei odota|Kuvake:|Repon tiedot|Ei avointa työtä)\b/;

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
}

test("@lab @ui-language the workspace views speak English to an English browser", async ({
  page,
}) => {
  await signIn(page);
  const main = page.locator("main");

  await expect(page.getByTestId("workspaces-title")).toHaveText("Workspaces");
  await expect(
    main.getByRole("button").and(page.getByTestId("workspace-create")),
  ).toHaveText("New workspace");
  await expect(main).not.toContainText(finnish);

  await page
    .getByRole("navigation")
    .getByRole("link")
    .and(page.getByTestId("workspace-aurinkokello"))
    .click();
  await expect(page.getByTestId("workspace-title")).toBeVisible();
  await expect(page.getByTestId("open-conversations")).toContainText("Open");
  await expect(
    main.getByRole("group", { name: "Workspace actions" }),
  ).toBeVisible();
  await expect(main).not.toContainText(finnish);
  await main
    .getByRole("button")
    .and(page.getByTestId("workspace-git"))
    .first()
    .click();
  const git = page.getByTestId("workspace-git-dialog");
  await expect(git).toContainText("Changes");
  await expect(git.getByTestId("fetch-git")).toHaveText("Refresh state");
  await expect(git).not.toContainText(finnish);
  await page.keyboard.press("Escape");

  await page.goto("/workspaces/new");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(
    "New workspace",
  );
  await expect(
    page.getByRole("searchbox").and(page.getByTestId("repository-search")),
  ).toHaveAttribute("placeholder", "Search by name or type owner/repo");
  await page
    .getByRole("searchbox")
    .and(page.getByTestId("repository-search"))
    .fill("fixture/last");
  await main
    .getByRole("link")
    .and(page.getByTestId("repository-option-fixture/last"))
    .first()
    .click();
  await expect(page.getByTestId("repository-clone")).toHaveText(
    "Clone as workspace",
  );
  await expect(main).not.toContainText(finnish);
});
