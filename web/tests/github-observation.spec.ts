import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
import { expect, test } from "./worker-host";

const host = hostOrigin;
test.use({ baseURL: host, ignoreHTTPSErrors: true });
async function enter(page: import("@playwright/test").Page) {
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await confirmGitIdentity(page);
  await expect(page.getByRole("checkbox").first()).toBeVisible();
}
const row = (page: import("@playwright/test").Page, name: string) =>
  page
    .getByRole("listitem")
    .and(page.getByTestId("onboarding-clone"))
    .and(page.locator(`[data-name="${name}"]`));
async function count(page: import("@playwright/test").Page) {
  return Number(await (await page.request.get("/fixture/clone-count")).text());
}
test("@github-first existing checkout advances without duplicate POST", async ({
  page,
}) => {
  await page.request.get("/fixture/checkout?name=first&mode=existing");
  await enter(page);
  const before = await count(page);
  await page.getByRole("checkbox").first().check();
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-proceed"))
    .click();
  await expect(
    page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
  ).toBeVisible();
  await expect(row(page, "fixture/first")).toHaveAttribute(
    "data-state",
    "present",
  );
  expect(await count(page)).toBe(before);
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  await page.request.get("/fixture/scenario?value=ready");
});
test("@github-first a conflicting directory is reported while the other clone completes", async ({
  page,
}, testInfo) => {
  await page.request.get("/fixture/checkout?name=second&mode=conflict");
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  await enter(page);
  const before = await count(page);
  await page.getByRole("checkbox").first().check();
  await page
    .getByRole("checkbox")
    .and(page.getByTestId("repository-fixture/second"))
    .check();
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-proceed"))
    .click();
  await expect(
    page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
  ).toBeVisible();
  await expect(row(page, "fixture/first")).toHaveAttribute(
    "data-state",
    "confirmed",
  );
  // The other directory is never written over and never reported as done.
  await expect(row(page, "fixture/second")).toHaveAttribute(
    "data-state",
    "failed",
  );
  expect(await count(page)).toBe(before + 1);
  await page.screenshot({
    path: testInfo.outputPath("github-error.png"),
    fullPage: true,
  });
  await page.request.get("/fixture/checkout?name=second&mode=absent");
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  await page.request.get("/fixture/scenario?value=ready");
});
test("@github-first lost response reconciles by read without another POST", async ({
  page,
}) => {
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  await enter(page);
  const before = await count(page);
  await page.route("**/api/v1/onboarding/github/clones", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fetch(); // The daemon started the clone; only its browser reply is lost.
    await route.abort();
  });
  await page.getByRole("checkbox").first().check();
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-proceed"))
    .click();
  await expect(
    page.getByRole("heading").and(page.getByTestId("pi-sign-in-title")),
  ).toBeVisible();
  await expect(row(page, "fixture/first")).toHaveAttribute(
    "data-state",
    "confirmed",
  );
  expect(await count(page)).toBe(before + 1);
  await page.request.get("/fixture/checkout?name=first&mode=absent");
  await page.request.get("/fixture/scenario?value=ready");
});
