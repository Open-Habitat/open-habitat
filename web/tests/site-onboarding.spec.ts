import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Asetukset › Käyttöönotto against the real gateway handlers of the browser
// host: every change the administrator makes is saved as it is made, the
// preview follows it, a second tab meets a version conflict instead of
// overwriting, and an ordinary person reads only the person-side onboarding.
// Same-UID synthetic evidence, not UID isolation.

test.use({
  trace: "off",
  screenshot: "off",
  video: "off",
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});

async function login(page: Page, name: "Alice" | "Bob" = "Alice") {
  await page.goto("/");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page
    .getByRole("link")
    .nth(name === "Alice" ? 0 : 1)
    .click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
}
const route = (page: Page, step: string) =>
  page.getByRole("button").and(page.getByTestId(`onboarding-route-${step}`));
const segment = (page: Page, group: string, id: string) =>
  page
    .getByTestId(group)
    .getByRole("button")
    .and(page.getByTestId(`segment-${id}`));

const onboarding = async (page: Page) =>
  (await page.request.get("/api/v1/server/onboarding")).json();
const saveState = (page: Page) => page.getByTestId("onboarding-save-state");
/** The change is written: the host has the new version and the status says so. */
async function saved(page: Page, version: number) {
  await expect.poll(async () => (await onboarding(page)).version).toBe(version);
  await expect(saveState(page)).toHaveAttribute("data-state", "saved");
}

test("@site-onboarding an administrator's every change saves itself, and the preview follows", async ({
  page,
}) => {
  await login(page);
  await page.goto("/settings/onboarding");
  await expect(page.getByTestId("onboarding-settings")).toBeVisible();
  const before = await onboarding(page);
  // A site that never saved one has no integration step (Jari 24.10.2026).
  expect(before).toMatchObject({ version: 0, integrations: [] });
  await expect(page.getByTestId(/^onboarding-route-integration:/)).toHaveCount(
    0,
  );
  await expect(route(page, "repositories")).toContainText("Henkilö valitsee");
  await expect(page.getByTestId("onboarding-save")).toHaveCount(0);

  // Repositories: a mode, then a default picked in the production finder.
  await segment(page, "onboarding-repository-mode", "auto").click();
  await saved(page, 1);
  await page
    .getByRole("button")
    .and(page.getByTestId("onboarding-add-repository"))
    .click();
  const finder = page
    .getByRole("dialog")
    .and(page.getByTestId("onboarding-repository-finder"));
  const first = finder
    .getByRole("link")
    .and(finder.getByTestId(/^repository-option-/));
  await expect(first.first()).toBeVisible();
  const picked = (await first.first().getAttribute("data-testid"))?.replace(
    "repository-option-",
    "",
  ) as string;
  expect(picked).toBeTruthy();
  const rows = finder.getByTestId(`repository-option-${picked}`);
  const shown = await rows.count();
  await rows.first().click();
  // The picked row stays where it was picked, marked, and is written at once.
  await expect(rows.first()).toHaveAttribute("aria-current", "page");
  await expect(rows).toHaveCount(shown);
  await saved(page, 2);
  expect((await onboarding(page)).repositories.defaults).toEqual([picked]);
  // Picking it again takes it off; and on again.
  await rows.first().click();
  await expect(rows.first()).not.toHaveAttribute("aria-current", "page");
  await saved(page, 3);
  expect((await onboarding(page)).repositories.defaults).toEqual([]);
  await rows.first().click();
  await expect(rows.first()).toHaveAttribute("aria-current", "page");
  await saved(page, 4);
  await finder
    .getByRole("button")
    .and(page.getByTestId("onboarding-finder-done"))
    .click();
  await expect(page.getByTestId(`onboarding-default-${picked}`)).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/onboarding$/);

  // Integrations: one the installation lacks is shown as not installed.
  const catalog = await (await page.request.get("/api/v1/integrations")).json();
  await route(page, "add-integration").click();
  for (const p of catalog.providers as { id: string; available: boolean }[])
    if (!p.available)
      await expect(
        page.getByTestId("onboarding-integration-choices"),
      ).toContainText("Ei asennettu");
  await page
    .getByRole("button")
    .and(page.getByTestId("onboarding-add-microsoft"))
    .click();
  await saved(page, 5);
  await segment(page, "onboarding-integration-required", "required").click();
  await expect(route(page, "integration:microsoft")).toContainText(
    "Pakollinen",
  );
  await saved(page, 6);

  // AI account: one default instead of every option.
  await route(page, "ai").click();
  await segment(page, "onboarding-ai-way", "default").click();
  await saved(page, 7);
  await page.getByRole("radio", { name: /Claude-tilaus/ }).check();
  await saved(page, 8);

  // Preview: the person's route as this configuration makes it.
  await page
    .getByRole("button")
    .and(page.getByTestId("onboarding-preview-open"))
    .click();
  const preview = page
    .getByRole("dialog")
    .and(page.getByTestId("onboarding-preview"));
  await expect(
    preview.getByTestId("onboarding-preview-screen"),
  ).toHaveAttribute("data-at", "repositories");
  await expect(preview.getByTestId("onboarding-preview-card")).toContainText(
    picked,
  );
  for (const next of ["microsoft", "ai"]) {
    await preview
      .getByRole("button")
      .and(page.getByTestId("onboarding-preview-next"))
      .click();
    await expect(
      preview.getByTestId("onboarding-preview-screen"),
    ).toHaveAttribute("data-at", next);
  }
  await expect(preview.getByTestId("onboarding-preview-ai")).toContainText(
    "Claude-tilaus",
  );
  await expect(preview.getByTestId("onboarding-preview-ai")).not.toContainText(
    "ChatGPT",
  );
  await segment(page, "onboarding-preview-device", "phone").click();
  await expect(preview.getByTestId("onboarding-preview-frame")).toHaveAttribute(
    "data-device",
    "phone",
  );
  // A change in the docked settings is saved too.
  await segment(page, "onboarding-ai-way", "all").click();
  await expect(preview.getByTestId("onboarding-save-state")).toHaveAttribute(
    "data-state",
    "saved",
  );
  expect((await onboarding(page)).ai_account.offer).toBe("all");
  await preview
    .getByRole("button")
    .and(page.getByTestId("onboarding-preview-close"))
    .click();
  await expect(page.getByTestId("onboarding-preview")).toHaveCount(0);

  const after = await onboarding(page);
  expect(after).toMatchObject({
    version: 9,
    repositories: { mode: "auto", defaults: [picked] },
    integrations: [{ provider: "microsoft", required: true }],
    ai_account: { offer: "all" },
  });
  // The person-side read carries the steps and the offer, never the defaults.
  const site = await (await page.request.get("/api/v1/onboarding/site")).json();
  expect(site).toEqual({
    schema_version: 1,
    repositories: { mode: "auto" },
    integrations: after.integrations,
    ai_account: { offer: "all" },
  });
});

test("@site-onboarding a second administrator tab meets a conflict and never overwrites", async ({
  page,
  context,
}) => {
  await login(page);
  await page.goto("/settings/onboarding");
  const other = await context.newPage();
  await other.goto("/settings/onboarding");
  await expect(route(other, "repositories")).toBeVisible();

  // The first tab saves; the second still holds version 0.
  await segment(page, "onboarding-repository-mode", "skip").click();
  await saved(page, 1);
  await route(other, "ai").click();
  await segment(other, "onboarding-ai-way", "default").click();
  const failure = other
    .getByRole("alert")
    .and(other.getByTestId("onboarding-save-failure"));
  await expect(failure).toHaveAttribute("data-state", "conflict");
  expect(await onboarding(page)).toMatchObject({
    version: 1,
    repositories: { mode: "skip" },
    ai_account: { offer: "all" },
  });
  // Editing stays closed until the host is read again.
  await expect(
    other
      .getByTestId("onboarding-ai-way")
      .getByRole("button")
      .and(other.getByTestId("segment-all")),
  ).toBeDisabled();
  await other
    .getByRole("button")
    .and(other.getByTestId("onboarding-reload"))
    .click();
  await expect(failure).toHaveCount(0);
  await expect(route(other, "repositories")).toContainText("Ohitetaan");
  await expect(route(other, "ai")).toContainText("Henkilö valitsee");
  // From the reloaded version the change goes through.
  await segment(other, "onboarding-ai-way", "default").click();
  await saved(other, 2);
});

test("@site-onboarding the repository finder keeps Valmis in view at phone width", async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 740 });
  // A long catalog: the host's own, and forty more owners with one each.
  await page.route("**/api/v1/onboarding/github/repos", async (r) => {
    const real = await r.fetch();
    const body = await real.json();
    const [one] = body.repositories;
    body.repositories = [
      ...body.repositories,
      ...Array.from({ length: 40 }, (_, i) => ({
        ...one,
        full_name: `owner-${i}/long-list`,
      })),
    ];
    await r.fulfill({ response: real, json: body });
  });
  await page.goto("/settings/onboarding");
  await page
    .getByRole("button")
    .and(page.getByTestId("onboarding-add-repository"))
    .click();
  const finder = page
    .getByRole("dialog")
    .and(page.getByTestId("onboarding-repository-finder"));
  await expect(
    finder.getByTestId(/^repository-option-/).nth(20),
  ).toBeAttached();
  const done = finder
    .getByRole("button")
    .and(page.getByTestId("onboarding-finder-done"));
  await expect(done).toBeInViewport({ ratio: 1 });
  const body = finder.locator(".ob-finder-body");
  expect(
    await body.evaluate((e) => e.scrollHeight > e.clientHeight),
  ).toBeTruthy();
  await body.evaluate((e) => {
    e.scrollTop = e.scrollHeight;
  });
  await expect(done).toBeInViewport({ ratio: 1 });
  const box = await finder.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 390).toBeTruthy();
  await done.click();
  await expect(finder).toHaveCount(0);
});

test("@site-onboarding an ordinary person reads only the person-side onboarding", async ({
  page,
}) => {
  await login(page, "Bob");
  expect((await page.request.get("/api/v1/server/onboarding")).status()).toBe(
    403,
  );
  const site = await page.request.get("/api/v1/onboarding/site");
  expect(site.status()).toBe(200);
  expect(Object.keys((await site.json()).repositories)).toEqual(["mode"]);
  const { csrf } = await (await page.request.get("/auth/session")).json();
  const write = await page.request.put("/api/v1/server/onboarding", {
    headers: {
      Origin: hostOrigin,
      "X-Agent-Host-CSRF": csrf,
      "Content-Type": "application/json",
    },
    data: {
      expected_version: 0,
      repositories: { mode: "skip", defaults: [] },
      integrations: [],
      ai_account: { offer: "all" },
    },
  });
  expect(write.status()).toBe(403);
  await page.goto("/settings/onboarding");
  await expect(page.getByTestId("administration-denied")).toBeVisible();
  await expect(page.getByTestId("onboarding-settings")).toHaveCount(0);
});
