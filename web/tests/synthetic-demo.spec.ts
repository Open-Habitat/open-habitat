import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { demoOrigin, ports } from "../test-ports.mjs";

const base = demoOrigin;
test.use({ baseURL: base, viewport: { width: 1280, height: 720 } });
for (const [scenario, heading] of [
  ["ready", "Työtilat"],
  ["empty", "Työtilat"],
  ["partial", "Työtilat"],
  ["missing", "Työtilat"],
  ["unavailable", "Yhteyttä ei saatu"],
  ["login", "Tervetuloa Open Habitatiin"],
] as const) {
  test(`synthetic ${scenario} scenario and a11y`, async ({ page }) => {
    await page.goto(`/workspaces?scenario=${scenario}`);
    await expect(page.locator("main h1")).toHaveText(heading);
    await expect(page.locator(".ah-demo-banner")).toContainText(
      "SYNTEETTINEN DEMO",
    );
    if (scenario === "ready") {
      await expect(
        page.getByRole("link", { name: "git-project" }),
      ).toBeVisible();
      await page.getByRole("link", { name: "git-project" }).click();
      await expect(page.locator("main h1")).toHaveText("git-project");
      await page
        .getByRole("textbox", { name: "Suodata työtiloja" })
        .fill("nonsense");
      await expect(
        page.getByText("Hakua vastaavia kohteita ei ole."),
      ).toBeVisible();
      await page.getByRole("button", { name: "Tyhjennä haku" }).click();
      await page.getByRole("link", { name: "Siirry sisältöön" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("main")).toBeFocused();
    }
    if (scenario === "partial") {
      await expect(page.getByRole("link", { name: "uncertain" })).toBeVisible();
      await expect(
        page.getByText(
          "Kaikkia työtiloja ei voitu tarkistaa. Näet vain löytyneet työtilat.",
        ),
      ).toBeVisible();
    }
    if (scenario === "empty")
      await expect(
        page.getByText("Työtiloja ei vielä ole", { exact: true }).first(),
      ).toBeVisible();
    if (scenario === "missing")
      await expect(
        page.getByText("Työtilakansiota ei löydy", { exact: true }),
      ).toBeVisible();
    if (scenario === "login") {
      await expect(
        page.getByRole("button", { name: "Kirjaudu GitHubilla" }),
      ).toBeDisabled();
      await expect(
        page.getByText("Simuloidussa demossa ei voi kirjautua."),
      ).toBeVisible();
    }
    const violations = (
      await new AxeBuilder({ page }).analyze()
    ).violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(violations).toEqual([]);
    await page.screenshot({
      path: `test-results/evidence/demo-${scenario}.png`,
      fullPage: true,
    });
  });
}
test("synthetic login error is visually distinct and never echoes query detail", async ({
  page,
}) => {
  await page.goto(
    "/workspaces?scenario=login&auth_error=%3Cscript%3Eunsafe%3C%2Fscript%3E",
  );
  await expect(
    page.getByRole("heading", { name: "Tervetuloa Open Habitatiin" }),
  ).toBeVisible();
  await expect(page.getByText("Kirjautumisessa tapahtui virhe")).toBeVisible();
  await expect(page.locator(".ah-notice.ah-tone-danger")).toBeVisible();
  await expect(page.getByText(/unsafe|script/)).toHaveCount(0);
  await page.screenshot({
    path: "test-results/evidence/demo-login-error.png",
    fullPage: true,
  });
});
test("no authentication, fixture routes, production build fixture, or external host", async ({
  page,
  request,
}) => {
  await page.goto("/workspaces?scenario=ready");
  expect((await request.get(`${base}/auth/github/start`)).status()).toBe(404);
  expect((await request.get(`${base}/fixture/provider`)).status()).toBe(404);
  expect(
    (await request.get(`${base}/__open-in-editor?file=/etc/hostname`)).status(),
  ).toBe(404);
  expect(
    (
      await request.get(`${base}/api/v1/snapshot`, {
        headers: { "Sec-Fetch-Site": "cross-site" },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.get(`${base}/workspaces`, {
        headers: { Host: "example.org" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.get(`${base}/workspaces`, {
        headers: { Host: `localhost:${ports.demo}` },
      })
    ).status(),
  ).toBe(403);
  await expect(
    page.getByRole("button", { name: /Oma tili, Tilivalikko/ }),
  ).toBeVisible();
});
