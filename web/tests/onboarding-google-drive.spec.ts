import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
import { expect, type Page, test } from "./worker-host";

// Onboarding's Google step with a Google Drive larger than the home, against
// the synthetic host: the real gateway, daemon and relay, whose stand-in
// Google entry offers the whole drive with an estimate over the room and
// counts its folders while the person chooses (/fixture/integrations
// action=bigdrive, then action=count). Same-UID synthetic evidence: it
// proves the relay, the contract and the step, not a real Google Drive.

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

const button = (page: Page, id: string) =>
  page.getByRole("button").and(page.getByTestId(id));
const fixture = (page: Page, query: string) =>
  page.request.get(`/fixture/integrations?${query}`);

/** From sign-in to the Google step's folder choice, with a big drive. */
async function atFolderChoice(page: Page) {
  expect(
    (
      await page.request.get("/fixture/onboarding?integrations=google")
    ).status(),
  ).toBe(204);
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await fixture(page, "action=bigdrive&provider=google");
  await page.goto("/workspaces");
  await button(page, "github-sign-in").click();
  await page.getByRole("link").nth(0).click();
  await confirmGitIdentity(page);
  await button(page, "repository-proceed").click();
  await page
    .getByTestId("integration-tile-google")
    .getByRole("button")
    .and(page.getByTestId("integration-connect-open"))
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-continue"))
    .click();
  // The page that will not load is announced before the person leaves.
  await expect(
    dialog
      .getByRole("note")
      .and(dialog.getByTestId("integration-redirect-expected")),
  ).toBeVisible();
  const popup = page.waitForEvent("popup");
  await dialog
    .getByRole("link")
    .and(dialog.getByTestId("integration-provider-link"))
    .click();
  await (await popup).close();
  await expect(
    dialog
      .getByRole("note")
      .and(dialog.getByTestId("integration-redirect-expected")),
  ).toBeVisible();
  await dialog
    .getByRole("textbox")
    .and(dialog.getByTestId("integration-redirect-input"))
    .fill("http://127.0.0.1:46399/oauth2/callback?state=lab&code=4/synthetic");
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("integration-connect"))
    .click();
  await expect(dialog.getByTestId("integration-folder-choice")).toBeVisible();
  return dialog;
}

const service = (page: Page, id: string) =>
  page
    .getByRole("article")
    .and(page.getByTestId("integration-account-google"))
    .getByTestId(`integration-service-${id}`)
    .getByTestId("integration-service-state");

test("@github-first a drive larger than the home leads to its folders or on without files", async ({
  page,
}) => {
  try {
    const dialog = await atFolderChoice(page);
    const box = (id: string) =>
      dialog.getByTestId(`integration-folder-${id}`).getByRole("checkbox");
    const start = button(page, "integration-sync-start");
    // Nothing is chosen in advance, and the step says why.
    await expect(
      dialog.getByTestId("integration-folders-too-big"),
    ).toBeVisible();
    await expect(box("all")).not.toBeChecked();
    await expect(start).toBeDisabled();
    await expect(
      dialog.getByTestId("integration-folder-row-photos"),
    ).toHaveAttribute("data-measuring", "true");
    // The counts arrive while the dialog stays open.
    await fixture(page, "action=count");
    await expect(
      dialog.getByTestId("integration-folder-row-photos"),
    ).toHaveAttribute("data-known", "true");
    await expect(
      dialog.getByTestId("integration-folder-row-all"),
    ).toHaveAttribute("data-measuring", "false");
    await dialog.getByTestId("integration-folder-photos").click();
    await expect(box("photos")).toBeChecked();
    await expect(dialog.getByTestId("integration-capacity")).toHaveAttribute(
      "data-over",
      "true",
    );
    await expect(start).toBeDisabled();
    await dialog.getByTestId("integration-folder-photos").click();
    await expect(box("photos")).not.toBeChecked();
    // Leaving the files out still connects mail, calendar and contacts.
    await button(page, "integration-sync-skip").click();
    await expect(dialog.getByTestId("integration-connected")).toBeVisible();
    await button(page, "integration-done").click();
    await expect(service(page, "drive")).toHaveAttribute(
      "data-failure",
      "not_chosen",
    );
    for (const id of ["mail", "calendar", "contacts"])
      await expect(service(page, id)).toHaveAttribute("data-state", "ok");
    const go = button(page, "integration-onboarding-continue");
    await expect(go).toHaveAttribute("data-connected", "true");
    await go.click();
    await expect(
      page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
    ).toBeVisible();
  } finally {
    await fixture(page, "action=reset");
    await page.request.get("/fixture/scenario?value=ready");
  }
});

test("@github-first a drive chosen on its estimate and refused keeps the other services checked", async ({
  page,
}) => {
  try {
    const dialog = await atFolderChoice(page);
    // Chosen before the count: the estimate warns but does not forbid.
    await dialog.getByTestId("integration-folder-all").click();
    await expect(
      dialog.getByTestId("integration-folder-all").getByRole("checkbox"),
    ).toBeChecked();
    await button(page, "integration-sync-start").click();
    await expect(dialog.getByTestId("integration-quota-refusal")).toBeVisible();
    await button(page, "dialog-close").last().click();
    await expect(service(page, "drive")).toHaveAttribute(
      "data-failure",
      "quota_insufficient",
    );
    // The person's sign-in worked: the other services are not "unknown".
    for (const id of ["mail", "calendar", "contacts"])
      await expect(service(page, id)).toHaveAttribute("data-state", "ok");
    await expect(
      button(page, "integration-onboarding-continue"),
    ).toHaveAttribute("data-connected", "true");
  } finally {
    await fixture(page, "action=reset");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
