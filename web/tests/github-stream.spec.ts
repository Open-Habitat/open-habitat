import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity, passGoogle } from "./git-identity-helper";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
type Page = import("@playwright/test").Page;
async function chooser(page: Page) {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await confirmGitIdentity(page);
}
const row = (page: Page, name: string) =>
  page
    .getByRole("listitem")
    .and(page.getByTestId("onboarding-clone"))
    .and(page.locator(`[data-name="${name}"]`));
const count = async (page: Page) =>
  Number(await (await page.request.get("/fixture/clone-count")).text());
const checkout = async (page: Page, name: string) =>
  (
    await (
      await page.request.get(
        `/api/v1/onboarding/github/checkout?full_name=${encodeURIComponent(name)}`,
      )
    ).json()
  ).state;

test("@github-first continue starts clones in the background and reaches the AI step while one runs", async ({
  page,
}) => {
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  await page.request.get("/fixture/checkout?name=second&mode=absent");
  // Hold the native receive phase until observed, not for a wall-clock window
  // that the browser can miss when the host is under load.
  await page.request.get("/fixture/clone?mode=hold");
  try {
    await chooser(page);
    const before = await count(page);
    await page
      .getByRole("checkbox")
      .and(page.getByTestId("repository-fixture/first"))
      .check();
    await page
      .getByRole("checkbox")
      .and(page.getByTestId("repository-fixture/second"))
      .check();
    await page
      .getByRole("button")
      .and(page.getByTestId("repository-proceed"))
      .click();
    await passGoogle(page);
    // The AI step, while the first clone is still receiving.
    await expect(
      page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
    ).toBeVisible();
    await expect(row(page, "fixture/first")).toHaveAttribute(
      "data-state",
      "running",
    );
    await expect(
      row(page, "fixture/first").getByRole("progressbar"),
    ).toHaveAttribute("aria-valuenow", "14");
    // The daemon runs one clone at a time; the second waits its turn.
    await expect(row(page, "fixture/second")).toHaveAttribute(
      "data-state",
      "waiting",
    );
    expect(await count(page)).toBe(before + 1);
    expect(await checkout(page, "fixture/first")).toBe("cloning");

    // Signing in finishes onboarding; the clones carry on into the workspace
    // view, where the rail shows them.
    await page.request.get("/fixture/pi-state?value=usable");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("heading").and(page.getByTestId("workspaces-title")),
    ).toBeVisible();
    await expect(
      page.getByRole("link").and(page.getByTestId("clone-jobs")),
    ).toHaveAttribute("data-live", "true");
    await page.request.get("/fixture/clone?mode=release");
    await expect.poll(() => checkout(page, "fixture/first")).toBe("confirmed");
    await expect.poll(() => checkout(page, "fixture/second")).toBe("confirmed");
    expect(await count(page)).toBe(before + 2);
    await expect(page.getByTestId("clone-jobs")).toHaveCount(0);
  } finally {
    await page.request.get("/fixture/clone?mode=normal");
    await page.request.get("/fixture/checkout?name=first&mode=absent");
    await page.request.get("/fixture/checkout?name=second&mode=absent");
    await page.request.get("/fixture/scenario?value=ready");
    await page.request.get("/fixture/pi-state?value=usable");
  }
});

test("@github-first a failed background clone is reported in the AI step and retried there", async ({
  page,
}) => {
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  await page.request.get("/fixture/clone?mode=fail-once");
  try {
    await chooser(page);
    const before = await count(page);
    await page
      .getByRole("checkbox")
      .and(page.getByTestId("repository-fixture/first"))
      .check();
    await page
      .getByRole("button")
      .and(page.getByTestId("repository-proceed"))
      .click();
    await passGoogle(page);
    await expect(
      page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
    ).toBeVisible();
    await expect(row(page, "fixture/first")).toHaveAttribute(
      "data-state",
      "failed",
    );
    // The daemon removed what the failed attempt wrote; nothing is lost.
    expect(await checkout(page, "fixture/first")).toBe("absent");
    // Why it failed and the retry are under the card, not in the route.
    await page
      .getByRole("listitem")
      .and(page.getByTestId("onboarding-clone-problem"))
      .and(page.locator('[data-name="fixture/first"]'))
      .getByRole("button")
      .and(page.getByTestId("onboarding-clone-retry"))
      .click();
    await expect(row(page, "fixture/first")).toHaveAttribute(
      "data-state",
      "confirmed",
    );
    expect(await checkout(page, "fixture/first")).toBe("confirmed");
    // Two starts, and the dismissal of the failed job the retry replaced.
    await expect.poll(() => count(page)).toBe(before + 3);
    // The AI step stayed where it was throughout.
    await expect(
      page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
    ).toBeVisible();
  } finally {
    await page.request.get("/fixture/clone?mode=normal");
    await page.request.get("/fixture/checkout?name=first&mode=absent");
    await page.request.get("/fixture/scenario?value=ready");
    await page.request.get("/fixture/pi-state?value=usable");
  }
});
