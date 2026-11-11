import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
test("@github-first logout and new cookie erase in-flight catalog", async ({
  context,
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  let release = () => {};
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  let captured!: () => void;
  const started = new Promise<void>((resolve) => {
    captured = resolve;
  });
  try {
    await page.route("**/api/v1/onboarding/github/repos", async (route) => {
      const response = await route.fetch();
      captured();
      await blocked;
      await route.fulfill({ response }).catch(() => {});
    });
    await page.goto("/workspaces");
    await page
      .getByRole("button")
      .and(page.getByTestId("github-sign-in"))
      .click();
    await page.getByRole("link").nth(0).click();
    await started;
    const other = await context.newPage();
    await other.goto("/workspaces");
    // The route settles on the Git identity once the catalog and the
    // identity read have answered; a press begun before its action appears
    // ends on a moved button and is lost.
    const identity = other.getByTestId("git-identity");
    await expect(
      identity
        .getByRole("button")
        .and(
          other
            .getByTestId("git-identity-confirm")
            .or(other.getByTestId("git-identity-continue")),
        ),
    ).toBeVisible();
    await other
      .getByRole("button")
      .and(other.getByTestId("onboarding-abort"))
      .click();
    await other
      .getByRole("button")
      .and(other.getByTestId("logout-confirm"))
      .click();
    await expect(
      other.getByRole("button").and(other.getByTestId("github-sign-in")),
    ).toBeVisible();
    await other
      .getByRole("button")
      .and(other.getByTestId("github-sign-in"))
      .click();
    await other.getByRole("link").nth(1).click();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    release();
    await expect(page.getByTestId("repository-name-fixture/first")).toHaveCount(
      0,
      {
        timeout: 9000,
      },
    );
    // An old-session response can require a fresh load instead of silently
    // rebinding old selections to Bob. The new cookie's catalog starts empty.
    await page.reload();
    await confirmGitIdentity(page);
    await expect(
      page.getByTestId("repository-name-fixture/bob-only"),
    ).toBeVisible();
    await expect(page.getByTestId("repository-selection")).toHaveAttribute(
      "data-count",
      "0",
    );
    await expect(page.getByTestId("repository-selection")).toBeVisible();
  } finally {
    release();
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
