import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const base = "http://127.0.0.1:4184";
test.use({ baseURL: base, viewport: { width: 1280, height: 720 } });
for (const [scenario, heading] of [
  ["ready", "Workspacet"],
  ["empty", "Workspacet"],
  ["partial", "Workspacet"],
  ["missing", "Workspacet"],
  ["unavailable", "Yhteyttä ei saatu"],
  ["login", "Kirjaudu jatkaaksesi"],
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
        .getByRole("textbox", { name: "Suodata workspaceja ja agentteja" })
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
        page.getByText(/määrä voi olla puutteellinen/),
      ).toBeVisible();
    }
    if (scenario === "empty")
      await expect(
        page.getByText("Workspaceja ei ole", { exact: true }).first(),
      ).toBeVisible();
    if (scenario === "missing")
      await expect(
        page.getByText("Lähdettä ei löydy", { exact: true }),
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
        headers: { Host: "localhost:4184" },
      })
    ).status(),
  ).toBe(403);
  await expect(page.getByText("Demo-käyttäjä (synteettinen)")).toBeVisible();
});
