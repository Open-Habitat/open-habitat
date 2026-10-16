import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

const host = hostOrigin;
test.use({
  baseURL: host,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});
async function login(page: Page, name: "Alice" | "Bob" = "Alice") {
  await page.goto("/");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeVisible();
}
async function state(page: Page, native: string) {
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (!body.auth) {
      await route.fulfill({ response });
      return;
    }
    body.auth.native_github.state = native;
    await route.fulfill({ response, json: body });
  });
}
async function settings(page: Page) {
  await page.getByRole("button", { name: /Tilivalikko/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Asetukset" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Asetukset" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Asetukset" })).toBeFocused();
}
test("@account-settings verified native state, route return and explicit disconnect", async ({
  page,
}) => {
  await state(page, "connected");
  await login(page);
  await expect(page.getByRole("navigation")).toContainText("Alice");
  await expect(page.getByRole("navigation")).not.toContainText(
    "GitHub user 42",
  );
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  await expect(page.getByRole("menuitem", { name: "Asetukset" })).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/account-menu.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.locator(".ah-workspace-link").first().click();
  await expect(page.locator("main h1")).toHaveText("git-project");
  const returnPath = new URL(page.url()).pathname;
  await settings(page);
  await expect(
    page.locator("#main").getByText("Yhdistetty", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Selaimesta uloskirjautuminen ei poista GitHub-valtuutusta/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tarkista katkaisu" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Katkaise paikallinen GitHub-yhteys" }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Tili" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Yhteydet tällä palvelimella" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "OpenAI (Pi)" }),
  ).toBeVisible();
  await expect(page.getByText("Pi-tunnukset käytettävissä")).toBeVisible();
  await page.getByText("Tumma", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByText("Vaalea", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    page.getByRole("button", { name: "Kirjaudu ulos…" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/account-connected.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Takaisin" }).click();
  await expect(page).toHaveURL(new RegExp(`${returnPath}$`));
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeFocused();
  await settings(page);
  await page.reload();
  await expect(
    page.locator("#main").getByText("Yhdistetty", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Takaisin" }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeFocused();
});
test("@account-settings partial, unknown and logout/user switch", async ({
  page,
}) => {
  await state(page, "partial");
  await login(page);
  await settings(page);
  await expect(page.getByText("Osittainen yhteys")).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/account-partial.png",
    fullPage: true,
  });
  await page.unroute("**/api/v1/snapshot");
  await state(page, "unknown");
  await page.reload();
  await expect(page.getByText("Tilaa ei tiedetä")).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/account-unknown.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  await page.getByRole("menuitem", { name: "Kirjaudu ulos…" }).click();
  await expect(
    page.getByRole("dialog", { name: "Kirjaudutaanko ulos tästä selaimesta?" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Palvelimen tunnukset");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kirjaudu ulos" })
    .click();
  await expect(
    page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/workspaces$/);
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Bob" }).click();
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeVisible();
  await expect(page.getByRole("navigation")).not.toContainText(
    "GitHub user 42",
  );
  await page.goto("/settings");
  await expect(page.getByText("Tilaa ei tiedetä")).toBeVisible();
});
test("@account-settings Pi default model is read from native models and saved", async ({
  page,
}) => {
  await login(page);
  await settings(page);
  const older = page.getByText("Vanhemmat mallit (3)");
  await expect(page.getByRole("radio", { name: /GPT 5.4/ })).not.toBeVisible();
  await older.click();
  await page.getByRole("radio", { name: /GPT 5.4/ }).click();
  await expect(page.getByRole("radio", { name: /GPT 5.4/ })).toBeChecked();
  await page.reload();
  await expect(page.getByRole("radio", { name: /GPT 5.4/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /GPT 5.4/ })).toBeVisible();
});

test("@account-settings Pi credentials change while the page is open; uncertainty is not success", async ({
  page,
}) => {
  await login(page);
  await page.route("**/api/v1/onboarding/pi/status", (route) =>
    route.fulfill({ json: { schema_version: 1, pi: { state: "missing" } } }),
  );
  await settings(page);
  await expect(page.getByText("Pi-kirjautuminen puuttuu")).toBeVisible();
  await page.getByRole("button", { name: "Kirjaudu Pi:hin" }).click();
  await expect(
    page.getByRole("heading", { name: "Kirjaudu OpenAI-tiliisi" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Aloita kirjautuminen" }),
  ).toBeVisible();
  await page.unrouteAll();
  await page.goto("/workspaces");
  await expect(page.getByRole("button", { name: /Tilivalikko/ })).toBeVisible();
  await page.route("**/api/v1/onboarding/pi/status", (route) =>
    route.fulfill({ json: { schema_version: 1, pi: { state: "unknown" } } }),
  );
  // Client navigation, not a new first-load check: the gate remains intact.
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  await page.getByRole("menuitem", { name: "Asetukset" }).click();
  await expect(page.getByText("Pi-tilaa ei voitu vahvistaa")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Kirjaudu Pi:hin uudelleen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Takaisin" }).click();
  await page.unrouteAll();
  await page.route("**/api/v1/onboarding/pi/status", (route) =>
    route.fulfill({ status: 502, body: "bad gateway" }),
  );
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  await page.getByRole("menuitem", { name: "Asetukset" }).click();
  await expect(page.getByText("Pi-tilaa ei voitu vahvistaa")).toBeVisible();
  await expect(page.getByText(/Yhteyttä ei ole vahvistettu/)).toBeVisible();
});

test("@account-settings direct settings URL cannot bypass initial Pi gate", async ({
  page,
}) => {
  await login(page);
  await page.route("**/api/v1/onboarding/pi/status", (route) =>
    route.fulfill({ json: { schema_version: 1, pi: { state: "missing" } } }),
  );
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Kirjaudu OpenAI-tiliisi" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Asetukset" })).toHaveCount(0);
  await page.unrouteAll();
  await page.route("**/api/v1/onboarding/pi/status", (route) =>
    route.fulfill({ json: { schema_version: 1, pi: { state: "unknown" } } }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Kirjaudu OpenAI-tiliisi" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Asetukset" })).toHaveCount(0);
});

test("@account-settings unavailable snapshot does not display previous identity", async ({
  page,
}) => {
  await login(page);
  await settings(page);
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Yhteyttä ei saatu" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Työtilat ja keskustelut" }),
  ).toHaveCount(0);
  await expect(page.getByText("Oma tili")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/evidence/account-unavailable.png",
    fullPage: true,
  });
});

test("@account-settings compact phone drawer and settings preserve status and radio keyboard selection", async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Avaa navigaatio" }).click();
  const nav = page.getByRole("navigation", { name: "Työtilat ja keskustelut" });
  const firstAgent = nav.locator(".ah-agent-item .ah-nav-link").first();
  await expect(firstAgent).toHaveAttribute("aria-describedby", /.+/);
  await expect(firstAgent).toHaveAccessibleDescription(
    /Tila ei tiedossa · Vain luku/,
  );
  await expect(firstAgent).toContainText("Vain luku");
  await expect(firstAgent.locator(".ah-nav-mark")).toBeVisible();
  await page.getByRole("button", { name: /Tilivalikko/ }).click();
  await page.getByRole("menuitem", { name: "Asetukset" }).click();
  await expect(page.getByRole("radiogroup", { name: "Teema" })).toBeVisible();
  await page.getByRole("radio", { name: "Vaalea" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Tumma" })).toBeChecked();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

test("@account-settings refused defaults and observation-only fallback cannot write a choice", async ({
  page,
}) => {
  await login(page);
  const { csrf } = await (await page.request.get("/auth/session")).json();
  expect(
    (
      await page.request.post("/api/v1/pi/models", {
        headers: {
          "X-Agent-Host-CSRF": csrf,
          Origin: new URL(page.url()).origin,
        },
        data: { model: "gpt-5.5", thinking: "high" },
      })
    ).status(),
  ).toBe(200);
  await settings(page);
  await expect(page.getByRole("radio", { name: /GPT 5.5/ })).toBeChecked();
  await expect(
    page.getByRole("button", { name: "high", exact: true }),
  ).toBeDisabled();
  await page.goto("/workspaces");
  const href = await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir", exact: true })
    .getAttribute("href");
  await page.goto(href ?? "/workspaces");
  await expect(
    page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }),
  ).toBeDisabled();
  await page.locator(".md-new > summary").click();
  await expect(
    page.getByRole("button", { name: "high", exact: true }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: /GPT-6 Astra/ }).check();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeEnabled();
  expect(
    (await (await page.request.get("/api/v1/pi/models")).json()).default_model,
  ).toBe("gpt-5.5");
  // A native catalog failure can show evidence, not offer a guaranteed-to-fail write.
  await page.route("**/api/v1/pi/models", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        schema_version: 1,
        default_provider: "openai-codex",
        default_model: "gpt-6-astra",
        catalog_status: "unavailable",
        models: [
          {
            id: "gpt-6-astra",
            name: "Observed Astra",
            outcome: "answered",
            observed_at: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    }),
  );
  await page.goto("/settings");
  await expect(
    page.getByRole("radio", { name: /Observed Astra/ }),
  ).toBeDisabled();
  await expect(page.getByText(/vain keskusteluista tutut/)).toBeVisible();
});
