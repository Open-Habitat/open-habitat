import { confirmGitIdentity } from "./git-identity-helper";
import { expect, test } from "./worker-host";
import { hostOrigin } from "../test-ports.mjs";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
test("@github-first synthetic slow native clone exposes per-repository receiving stage", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  // Hold the native receive phase until observed, not for a wall-clock window
  // that the browser can miss when the host is under load.
  await page.request.get("/fixture/clone?mode=hold");
  try {
    await page.goto("/workspaces");
    await page
      .getByRole("button")
      .and(page.getByTestId("github-sign-in"))
      .click();
    await page.getByRole("link").nth(0).click();
    await confirmGitIdentity(page);
    await page.getByRole("checkbox").first().check();
    await page
      .getByRole("button")
      .and(page.getByTestId("repository-proceed"))
      .click();
    await expect(page.getByTestId("repository-clone-progress")).toBeVisible();
    await expect(page.getByTestId("repository-clone-progress")).toHaveAttribute(
      "data-percent",
      "14",
    );
    await expect(page.getByTestId("repository-clone-progress")).toBeVisible();
    await expect(page.getByTestId("repository-clone-progress")).toHaveAttribute(
      "data-received-bytes",
      "125829120",
    );
    await expect(page.getByTestId("repository-clone-progress")).toBeVisible();
    await page.request.get("/fixture/clone?mode=release");
    await expect(
      page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
    ).toBeVisible();
  } finally {
    await page.request.get("/fixture/clone?mode=normal");
    await page.request.get("/fixture/checkout?name=first&mode=absent");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
