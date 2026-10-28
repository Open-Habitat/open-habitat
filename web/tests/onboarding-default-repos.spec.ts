import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
import { expect, type Page, test } from "./worker-host";

// The site's default repositories on a new person's route (ADR 0030),
// against the synthetic host: the real gateway (its first-login access check,
// plan and per-person record) and the real daemon handlers (plan queue,
// marked catalog). The synthetic person can read fixture/ repositories but
// not private-org/. Same-UID evidence: that an unreadable default never
// reaches another Unix user's UID is the two-UID VM test's claim.

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

const hidden = "private-org/secret";
const defaults = ["fixture/bob-only", "fixture/team-default", hidden];

/** The administrator configures the site; then a new person signs in and
 * reaches the Git identity, the first step of their route. */
async function signIn(page: Page, mode: string, names = defaults) {
  expect(
    (
      await page.request.get(
        `/fixture/onboarding?mode=${mode}&defaults=${encodeURIComponent(names.join(","))}`,
      )
    ).status(),
  ).toBe(204);
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  // The second synthetic identity has never signed in on this host.
  await page.getByRole("link").nth(1).click();
}
async function newPerson(page: Page, mode: string, names = defaults) {
  await signIn(page, mode, names);
  await confirmGitIdentity(page);
}
const cloneJobs = async (page: Page) =>
  (await (await page.request.get("/api/v1/onboarding/github/clones")).json())
    .jobs as { full_name: string; state: string }[];
const step = (page: Page, id: string) =>
  page
    .getByRole("navigation", { name: "Käyttöönoton vaiheet" })
    .getByTestId(`onboarding-step-${id}`);
const box = (page: Page, name: string) =>
  page.getByRole("checkbox").and(page.getByTestId(`repository-${name}`));

/** Nothing the person's browser can read names the unreadable default. */
async function expectHidden(page: Page) {
  await expect(page.getByText(hidden)).toHaveCount(0);
  for (const path of [
    "/api/v1/onboarding/site",
    "/api/v1/onboarding/github/repos",
    "/api/v1/onboarding/github/clones",
  ]) {
    const body = await (await page.request.get(path)).text();
    expect(body).not.toContain("private-org");
  }
}

test("@site-defaults auto: the readable defaults are locked rows already being fetched", async ({
  page,
}) => {
  await newPerson(page, "auto");
  await expect(
    page.getByRole("heading").and(page.getByTestId("repository-chooser-title")),
  ).toBeVisible();
  // One in the person's catalog and one looked up by name.
  for (const name of ["fixture/bob-only", "fixture/team-default"]) {
    await expect(page.getByTestId(`repository-locked-${name}`)).toBeVisible();
    await expect(box(page, name)).toBeChecked();
    await expect(box(page, name)).toBeDisabled();
  }
  await expectHidden(page);
  // The person adds one more; the site's own are not asked for again.
  await box(page, "fixture/second").check();
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-proceed"))
    .click();
  await expect(page.locator('[data-testid="onboarding-clone"]')).toHaveCount(3);
  await expect
    .poll(async () => {
      const list = await (
        await page.request.get("/api/v1/onboarding/github/clones")
      ).json();
      return list.jobs
        .filter((j: { state: string }) => j.state === "confirmed")
        .map((j: { full_name: string }) => j.full_name)
        .sort();
    })
    .toEqual(["fixture/bob-only", "fixture/second", "fixture/team-default"]);
});

test("@site-defaults auto: the Git identity is confirmed while a default is still cloning", async ({
  page,
}) => {
  // A large default repository takes minutes; the clone holds the daemon's
  // ~/src writer all that time. Confirming the identity must not wait for it.
  await page.request.get("/fixture/clone?mode=hold");
  try {
    await signIn(page, "auto");
    await expect
      .poll(
        async () =>
          (await cloneJobs(page)).filter((j) => j.state === "running").length,
      )
      .toBe(1);
    const panel = page.getByTestId("git-identity");
    const confirm = panel
      .getByRole("button")
      .and(page.getByTestId("git-identity-confirm"));
    await expect(confirm).toBeVisible();
    await confirm.click();
    await expect(
      page
        .getByRole("heading")
        .and(page.getByTestId("repository-chooser-title")),
    ).toBeVisible();
    await expect(page.getByTestId("git-identity-error")).toHaveCount(0);
    const identity = await (
      await page.request.get("/api/v1/account/git-identity")
    ).json();
    expect(identity.name).not.toBe("");
    expect(identity.email).toContain("@");
    // The clone was still in progress the whole time.
    expect(
      (await cloneJobs(page)).filter((j) => j.state === "running"),
    ).toHaveLength(1);
  } finally {
    await page.request.get("/fixture/clone?mode=release");
    await page.request.get("/fixture/clone?mode=normal");
  }
  await expect
    .poll(async () =>
      (await cloneJobs(page))
        .filter((j) => j.state === "confirmed")
        .map((j) => j.full_name)
        .sort(),
    )
    .toEqual(["fixture/bob-only", "fixture/team-default"]);
});

test("@site-defaults preselected: the readable defaults start selected and nothing is fetched before Continue", async ({
  page,
}) => {
  await newPerson(page, "preselected");
  for (const name of ["fixture/bob-only", "fixture/team-default"]) {
    await expect(box(page, name)).toBeChecked();
    await expect(box(page, name)).toBeEnabled();
  }
  await expect(page.locator('[data-testid^="repository-locked-"]')).toHaveCount(
    0,
  );
  await expectHidden(page);
  const list = await (
    await page.request.get("/api/v1/onboarding/github/clones")
  ).json();
  expect(list.jobs).toEqual([]);
  expect(list.planned).toEqual([]);
  // The person may drop a preselected default.
  await box(page, "fixture/team-default").uncheck();
  await expect(page.getByTestId("repository-selection")).toHaveAttribute(
    "data-count",
    "1",
  );
});

test("@site-defaults skip: the defaults are fetched without a chooser and named on the route", async ({
  page,
}) => {
  await newPerson(page, "skip");
  await expect(page.getByTestId("repository-chooser")).toHaveCount(0);
  await expect(step(page, "repositories")).toBeVisible();
  const clones = step(page, "repositories").getByTestId("onboarding-clone");
  await expect(clones).toHaveCount(2);
  await expect(
    step(page, "repositories").locator(
      '[data-name="fixture/bob-only"], [data-name="fixture/team-default"]',
    ),
  ).toHaveCount(2);
  await expectHidden(page);
  await expect(
    clones.and(page.locator('[data-state="confirmed"]')),
  ).toHaveCount(2, { timeout: 20_000 });
});

test("@site-defaults skip without defaults removes Repot from the route", async ({
  page,
}) => {
  await newPerson(page, "skip", []);
  await expect(page.getByTestId("repository-chooser")).toHaveCount(0);
  await expect(step(page, "github")).toBeVisible();
  await expect(step(page, "repositories")).toHaveCount(0);
  const list = await (
    await page.request.get("/api/v1/onboarding/github/clones")
  ).json();
  expect(list.jobs).toEqual([]);
});

test("@site-defaults the administrator sees the sign-in receipt on the person's row; the person cannot", async ({
  page,
  browser,
}) => {
  // The receipt is written in the sign-in callback, before the route.
  await newPerson(page, "auto");
  expect((await page.request.get("/api/v1/server/access")).status()).toBe(403);

  // The administrator signs in with usable Pi, so lands past their own route.
  await page.request.get("/fixture/scenario?value=ready");
  await page.request.get("/fixture/pi-state?value=usable");
  const admin = await (
    await browser.newContext({ baseURL: hostOrigin, ignoreHTTPSErrors: true })
  ).newPage();
  await admin.goto("/settings");
  await admin
    .getByRole("button")
    .and(admin.getByTestId("github-sign-in"))
    .click();
  await admin.getByRole("link").nth(0).click();
  await expect(admin).not.toHaveURL(/fixture\/provider/);
  await admin.goto("/settings/users");
  const receipt = admin.getByTestId("access-onboarding-43");
  // The unreadable default is the one named; the handed-over ones are only
  // counted.
  await expect(receipt.locator('[data-outcome="no_access"] code')).toHaveText([
    hidden,
  ]);
  await expect(receipt.locator("code")).toHaveCount(1);
  await admin.context().close();
});
