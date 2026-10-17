import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// Uusi työtila as a page (Kloonaussivulla, Jari 17.10.2026) through the real
// gateway and daemon clone jobs (ADR 0024) on a synthetic home. Only the git
// and gh programs are synthetic; /fixture/clone holds or fails their clone.

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

async function signIn(page: Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await expect(
    page.getByRole("heading", { name: "Työtilat", level: 1 }),
  ).toBeVisible();
}
async function openPage(page: Page) {
  await page
    .locator("main")
    .getByRole("button", { name: "Uusi työtila" })
    .click();
  await expect(page).toHaveURL(/\/workspaces\/new$/);
  await expect(
    page.getByRole("heading", { name: "Uusi työtila", level: 1 }),
  ).toBeVisible();
}
async function choose(page: Page, name: string) {
  await page.getByRole("searchbox", { name: "Hae repoa" }).fill(name);
  await page
    .locator("main")
    .getByRole("link", { name: new RegExp(name.split("/")[1]) })
    .first()
    .click();
  await expect(
    page.getByRole("complementary", { name: "Repon tiedot" }),
  ).toContainText(name.split("/")[1]);
}
const card = (page: Page, name: string) =>
  page.getByRole("article", { name: `Kloonaus ${name}` });
const railBlock = (page: Page) =>
  page.getByRole("navigation").getByRole("link", { name: /^Kloonaukset:/ });
const posts = async (page: Page) =>
  Number(await (await page.request.get("/fixture/clone-count")).text());

test("@lab @a11y a clone succeeds, is opened from its card and the page passes axe", async ({
  page,
}) => {
  await signIn(page);
  await openPage(page);
  // The catalog in sections; the organisation repo is on page 1 here, and
  // an exact owner/repo outside the catalog is looked up on GitHub.
  await expect(
    page.getByRole("heading", { name: /synthetic-org/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Näytä kaikki/ }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Hae repoa" })
    .fill("nobody/missing");
  await expect(
    page.getByText("Repoa ei ole, tai sinulla ei ole siihen pääsyä."),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Hae repoa" })
    .fill("public-org/workmux");
  await page.getByRole("link", { name: /workmux/ }).click();
  await expect(page).toHaveURL(/repo=public-org%2Fworkmux/);
  await expect(
    page.getByRole("complementary", { name: "Repon tiedot" }),
  ).toContainText("Synthetic lookup");
  const result = await new AxeBuilder({ page })
    .exclude("[data-live-announcer]")
    .analyze();
  expect(
    result.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);

  const before = await posts(page);
  await choose(page, "fixture/last");
  await page.getByRole("button", { name: "Kloonaa työtilaksi" }).click();
  const job = card(page, "fixture/last");
  await expect(job).toContainText("Valmis", { timeout: 15000 });
  expect(await posts(page)).toBe(before + 1);
  await job.getByRole("button", { name: "Avaa työtila" }).click();
  // A fresh clone gets its first conversation (Jari 16.10.2026).
  await expect(page).toHaveURL(/conversation=pi:/, { timeout: 20000 });
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "last", exact: true }),
  ).toBeVisible();
  // Opening forgets the finished job; nothing is left for the rail.
  await expect(railBlock(page)).toHaveCount(0);
});

test("@lab the person can leave during a clone and come back through the rail", async ({
  page,
}) => {
  await page.request.get("/fixture/clone?mode=hold");
  await signIn(page);
  await openPage(page);
  await choose(page, "fixture/last");
  await page.getByRole("button", { name: "Kloonaa työtilaksi" }).click();
  const job = card(page, "fixture/last");
  await expect(job.getByRole("status")).toContainText("14 %");
  // A second clone waits: one runs at a time.
  await choose(page, "fixture/older");
  await expect(
    page.getByRole("button", { name: "Kloonaa työtilaksi" }),
  ).toBeDisabled();
  const elsewhere = page.locator(".ah-rail-content .ah-workspace-link").first();
  const name = (await elsewhere.innerText()).trim();
  await elsewhere.click();
  await expect(page.locator("main h1")).toHaveText(name);
  await expect(railBlock(page)).toContainText("last");
  await expect(railBlock(page)).toContainText("14 %");
  // A reload loses nothing: the job is the daemon's.
  await page.reload();
  await expect(railBlock(page)).toContainText("14 %");
  await railBlock(page).click();
  await expect(page).toHaveURL(/\/workspaces\/new$/);
  await expect(card(page, "fixture/last").getByRole("status")).toContainText(
    "14 %",
  );
  await page.request.get("/fixture/clone?mode=release");
  await expect(card(page, "fixture/last")).toContainText("Valmis", {
    timeout: 15000,
  });
  await expect(railBlock(page)).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "last", exact: true }),
  ).toBeVisible();
});

test("@lab a failed clone leaves nothing and its retry succeeds", async ({
  page,
}) => {
  await page.request.get("/fixture/clone?mode=fail-once");
  await signIn(page);
  await openPage(page);
  await choose(page, "fixture/last");
  await page.getByRole("button", { name: "Kloonaa työtilaksi" }).click();
  const job = card(page, "fixture/last");
  await expect(job).toContainText("Kloonaus epäonnistui", { timeout: 15000 });
  await expect(job).toContainText("levylle ei jäänyt mitään");
  await expect(railBlock(page)).toContainText("epäonnistui");
  const before = await posts(page);
  await job.getByRole("button", { name: "Yritä uudelleen" }).click();
  await expect(job).toContainText("Valmis", { timeout: 15000 });
  // The failed attempt's notice is forgotten once the retry started.
  await expect(page.getByText("Kloonaus epäonnistui")).toHaveCount(0);
  expect(await posts(page)).toBe(before + 2); // start + dismiss
});

test("@lab a running clone is cancelled only after confirmation", async ({
  page,
}) => {
  await page.request.get("/fixture/clone?mode=hold");
  await signIn(page);
  await openPage(page);
  await choose(page, "fixture/last");
  await page.getByRole("button", { name: "Kloonaa työtilaksi" }).click();
  const job = card(page, "fixture/last");
  await expect(job.getByRole("status")).toContainText("14 %");
  await job.getByRole("button", { name: "Keskeytä" }).click();
  await expect(job).toContainText("Keskeytetäänkö?");
  await job.getByRole("button", { name: "Jatka kloonausta" }).click();
  await expect(job.getByRole("status")).toContainText("14 %");
  await job.getByRole("button", { name: "Keskeytä" }).click();
  await job.getByRole("button", { name: "Keskeytä" }).click();
  await expect(job).toHaveCount(0, { timeout: 15000 });
  await expect(railBlock(page)).toHaveCount(0);
  const seen = await (
    await page.request.get(
      "/api/v1/onboarding/github/checkout?full_name=fixture%2Flast",
    )
  ).json();
  expect(seen.state).toBe("absent");
});

// A clone cut by a daemon restart leaves a .git without commits. It is not a
// workspace; the page and the rail show it, and only Aloita alusta or Poista
// keskeneräinen act on it (Jari 17.10.2026: never by itself).
test("@lab an interrupted clone is restarted or removed only explicitly", async ({
  page,
}) => {
  await page.request.get("/fixture/checkout?name=first&mode=interrupted");
  await page.request.get("/fixture/checkout?name=second&mode=interrupted");
  await signIn(page);
  await expect(
    page.locator("main").getByRole("link", { name: "first", exact: true }),
  ).toHaveCount(0);
  await expect(railBlock(page)).toContainText("first");
  await expect(railBlock(page)).toContainText("keskeytyi");
  const before = await posts(page);
  await railBlock(page).click();
  const first = card(page, "fixture/first");
  const second = card(page, "fixture/second");
  await expect(first).toContainText("Kloonaus keskeytyi");
  await expect(second).toContainText("Kloonaus keskeytyi");
  // Nothing restarted by itself.
  expect(await posts(page)).toBe(before);
  await second.getByRole("button", { name: /Poista keskeneräinen/ }).click();
  await expect(second).toHaveCount(0);
  await first.getByRole("button", { name: "Aloita alusta" }).click();
  await expect(card(page, "fixture/first")).toContainText("Valmis", {
    timeout: 15000,
  });
  expect(await posts(page)).toBe(before + 2);
  await expect(railBlock(page)).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "first", exact: true }),
  ).toBeVisible();
});

test("@lab on a phone the list and the details are shown one at a time", async ({
  page,
}) => {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspaces/new");
  await choose(page, "fixture/last");
  await expect(page.getByRole("searchbox", { name: "Hae repoa" })).toBeHidden();
  await page.getByRole("link", { name: "Kaikki repot" }).click();
  await expect(page).toHaveURL(/\/workspaces\/new$/);
  await expect(
    page.getByRole("searchbox", { name: "Hae repoa" }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Repon tiedot" }),
  ).toBeHidden();
});
