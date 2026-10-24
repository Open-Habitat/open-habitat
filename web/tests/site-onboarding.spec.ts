import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Asetukset › Käyttöönotto against the real gateway handlers of the browser
// host: the administrator edits and saves the site onboarding, previews the
// person's view, and meets a version conflict; an ordinary person reads only
// the person-side onboarding. Same-UID synthetic evidence, not UID isolation.

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

test("@site-onboarding an administrator edits, previews and saves the site onboarding", async ({
  page,
}) => {
  await login(page);
  await page.goto("/settings/onboarding");
  await expect(page.getByTestId("onboarding-settings")).toBeVisible();
  const before = await (
    await page.request.get("/api/v1/server/onboarding")
  ).json();
  expect(before.version).toBe(0);
  await expect(route(page, "repositories")).toContainText("Henkilö valitsee");

  // Repositories: a mode and a default picked in the production finder.
  await segment(page, "onboarding-repository-mode", "auto").click();
  await page
    .getByRole("button")
    .and(page.getByTestId("onboarding-add-repository"))
    .click();
  const finder = page
    .getByRole("dialog")
    .and(page.getByTestId("onboarding-repository-finder"));
  const option = finder.getByTestId(/^repository-option-/).first();
  const picked = (await option.getAttribute("data-testid"))?.replace(
    "repository-option-",
    "",
  );
  expect(picked).toBeTruthy();
  await option.click();
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
  await segment(page, "onboarding-integration-required", "required").click();
  await expect(route(page, "integration:microsoft")).toContainText(
    "Pakollinen",
  );

  // AI account: one default instead of every option.
  await route(page, "ai").click();
  await segment(page, "onboarding-ai-way", "default").click();
  await page.getByRole("radio", { name: /Claude-tilaus/ }).check();

  // Preview: the person's route as this draft makes it, settings docked.
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
    picked as string,
  );
  // Repot, then Google and the required Microsoft step, then AI-tili.
  for (const next of ["google", "microsoft", "ai"]) {
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
  await preview
    .getByRole("button")
    .and(page.getByTestId("onboarding-preview-close"))
    .click();
  await expect(page.getByTestId("onboarding-preview")).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/v1/server/onboarding")).json())
      .version,
  ).toBe(0);

  await page
    .getByRole("button")
    .and(page.getByTestId("onboarding-save"))
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "tallennettu" }),
  ).toBeVisible();
  const after = await (
    await page.request.get("/api/v1/server/onboarding")
  ).json();
  expect(after).toMatchObject({
    version: 1,
    repositories: { mode: "auto", defaults: [picked] },
    integrations: [
      { provider: "google", required: false },
      { provider: "microsoft", required: true },
    ],
    ai_account: { offer: "claude" },
  });
  // The person-side read carries the steps and the offer, never the defaults.
  const site = await (await page.request.get("/api/v1/onboarding/site")).json();
  expect(site).toEqual({
    schema_version: 1,
    repositories: { mode: "auto" },
    integrations: after.integrations,
    ai_account: { offer: "claude" },
  });

  // Someone else saves meanwhile: this draft is refused, nothing is written,
  // and reloading brings the host's version.
  const { csrf } = await (await page.request.get("/auth/session")).json();
  const other = await page.request.put("/api/v1/server/onboarding", {
    headers: {
      Origin: hostOrigin,
      "X-Agent-Host-CSRF": csrf,
      "Content-Type": "application/json",
    },
    data: {
      expected_version: 1,
      ...after,
      version: undefined,
      schema_version: undefined,
      ai_account: { offer: "all" },
    },
  });
  expect(other.status()).toBe(200);
  await route(page, "repositories").click();
  await segment(page, "onboarding-repository-mode", "skip").click();
  await page
    .getByRole("button")
    .and(page.getByTestId("onboarding-save"))
    .click();
  await expect(page.getByRole("alert")).toContainText("muutettu toisaalla");
  expect(
    (await (await page.request.get("/api/v1/server/onboarding")).json())
      .repositories.mode,
  ).toBe("auto");
  await page
    .getByRole("button")
    .and(page.getByTestId("onboarding-reload"))
    .click();
  await expect(route(page, "ai")).toContainText("Henkilö valitsee");
  await expect(page.getByTestId("onboarding-dirty")).toHaveText(
    "Ei tallentamattomia muutoksia",
  );
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
