import AxeBuilder from "@axe-core/playwright";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });
for (const width of [1440, 390]) {
  for (const theme of ["light", "dark"]) {
    test(`@lab @a11y authored start page and safe draft ${width} ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.request.get("/fixture/conversations-reset");
      await page.request.get("/fixture/scenario?value=ready");
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page
        .getByRole("link")
        .and(page.locator('a[href*="code=42"]'))
        .click();
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);
      if (width === 390) await page.getByTestId("navigation-open").click();
      await page
        .getByRole("navigation")
        .getByTestId("workspace-start-aurinkokello")
        .click();
      const field = page.getByTestId("message-input");
      await expect(page.getByTestId("starting-goal")).toHaveCount(6);
      // Repository-authored content is a contract, not product wording.
      await expect(page.getByTestId("start-page-title")).toHaveText(
        "Aurinkopolku",
      );
      await expect(
        page.getByTestId("start-page-body").locator("strong"),
      ).toHaveText("retkireittien suunnittelija");
      const sent: string[] = [];
      page.on("request", (r) => {
        if (
          r.method() === "POST" &&
          /\/(send|steer|follow_up)$/.test(new URL(r.url()).pathname)
        )
          sent.push(r.url());
      });
      await expect(page.getByTestId("start-page-title")).toBeInViewport();
      const { snapshot } = await import("../lab/session.mjs");
      await snapshot(page, testInfo.outputPath(`home-${width}-${theme}`), {
        labOrigin,
      });
      await field.fill("Oma keskeneräinen ajatus.");
      await page.getByTestId("starting-goal").first().focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("guide-title")).toBeFocused();
      await expect(field).toHaveValue("Oma keskeneräinen ajatus.");
      await page.getByTestId("guide-back").click();
      await expect(page.getByTestId("starting-goal").first()).toBeFocused();
      await expect(field).toHaveValue("Oma keskeneräinen ajatus.");
      await page.getByTestId("starting-goal").first().click();
      await expect(page.getByTestId("guide-back")).toBeInViewport();
      if (width === 1440) {
        await page.setViewportSize({ width: 390, height: 900 });
        await expect(page.getByTestId("guide-back")).toBeInViewport();
        await expect(page.getByTestId("guide-start-top")).toBeInViewport();
        await page.setViewportSize({ width, height: 900 });
        await expect(page.getByTestId("guide-back")).toBeInViewport();
      }
      const guideAudit = await new AxeBuilder({ page })
        .include('[data-testid="start-here"]')
        .analyze();
      expect(guideAudit.violations).toEqual([]);
      await snapshot(page, testInfo.outputPath(`guide-${width}-${theme}`), {
        labOrigin,
      });
      await page.getByTestId("guide-request").locator("summary").click();
      await expect(page.getByTestId("guide-prompt")).toHaveText(
        "/skill:pytest-debug Selvitä ongelman syy: [kuvaile havainto]. Tee ensin pieni toistava testi. Korjaa juurisyy ja aja aiheeseen liittyvät testit. Kerro, mitä tarkistit ja mikä jäi tarkistamatta.",
      );
      await page.getByTestId("guide-start-top").click();
      await expect(field).toHaveValue(
        "/skill:pytest-debug Selvitä ongelman syy: [kuvaile havainto]. Tee ensin pieni toistava testi. Korjaa juurisyy ja aja aiheeseen liittyvät testit. Kerro, mitä tarkistit ja mikä jäi tarkistamatta.\n\nOma keskeneräinen ajatus.\n\n",
      );
      await expect(field).toBeFocused();
      await field.fill("Oma keskeneräinen ajatus.");
      await page.getByTestId("starting-goal").nth(1).click();
      await page.getByTestId("guide-start-bottom").click();
      await expect(field).toHaveValue(
        "Lue repon ohjeet ja kerro lyhyesti, mitä Aurinkopolku tekee. Näytä tärkeimmät hakemistot ja mistä testit ajetaan. Älä muuta tiedostoja.\n\nOma keskeneräinen ajatus.\n\n",
      );
      await expect(field).toBeFocused();
      expect(
        await field.evaluate((node: HTMLTextAreaElement) => [
          node.selectionStart,
          node.selectionEnd,
          node.value.length,
        ]),
      ).toEqual([
        "Lue repon ohjeet ja kerro lyhyesti, mitä Aurinkopolku tekee. Näytä tärkeimmät hakemistot ja mistä testit ajetaan. Älä muuta tiedostoja.\n\nOma keskeneräinen ajatus.\n\n"
          .length,
        "Lue repon ohjeet ja kerro lyhyesti, mitä Aurinkopolku tekee. Näytä tärkeimmät hakemistot ja mistä testit ajetaan. Älä muuta tiedostoja.\n\nOma keskeneräinen ajatus.\n\n"
          .length,
        "Lue repon ohjeet ja kerro lyhyesti, mitä Aurinkopolku tekee. Näytä tärkeimmät hakemistot ja mistä testit ajetaan. Älä muuta tiedostoja.\n\nOma keskeneräinen ajatus.\n\n"
          .length,
      ]);
      await field.press("X");
      await expect(field).toHaveValue(
        "Lue repon ohjeet ja kerro lyhyesti, mitä Aurinkopolku tekee. Näytä tärkeimmät hakemistot ja mistä testit ajetaan. Älä muuta tiedostoja.\n\nOma keskeneräinen ajatus.\n\nX",
      );
      await field.fill("");
      await page.getByTestId("starting-goal").nth(2).click();
      await page.getByTestId("guide-request").locator("summary").click();
      const fullRequest = page.getByTestId("guide-prompt");
      await expect(fullRequest).toContainText(
        "docs/esimerkit/erittain-pitka-synteettinen-julkaisun-valmistelun-tarkistuslistan-tiedostonimi.md",
      );
      expect(
        await fullRequest.evaluate(
          (node) =>
            node.scrollHeight > node.clientHeight &&
            node.scrollWidth <= node.clientWidth,
        ),
      ).toBe(true);
      const request = await fullRequest.innerText();
      await snapshot(page, testInfo.outputPath(`request-${width}-${theme}`), {
        labOrigin,
      });
      await page.getByTestId("guide-start-top").click();
      await expect(field).toHaveValue(`${request}\n\n`);
      await field.fill("");
      await page.getByTestId("starting-goal").nth(1).click();
      await page.getByTestId("guide-start-top").click();
      await expect(field).toHaveValue(
        "Lue repon ohjeet ja kerro lyhyesti, mitä Aurinkopolku tekee. Näytä tärkeimmät hakemistot ja mistä testit ajetaan. Älä muuta tiedostoja.\n\n",
      );
      await expect(field).toBeFocused();
      expect(
        await field.evaluate(
          (node: HTMLTextAreaElement) =>
            node.selectionStart === node.value.length &&
            node.selectionEnd === node.value.length,
        ),
      ).toBe(true);
      expect(sent).toEqual([]);
      await expect(page.getByTestId("user-content")).toHaveCount(0);
      const audit = await new AxeBuilder({ page })
        .include('[data-testid="start-here"]')
        .analyze();
      expect(audit.violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.reload();
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);
      await expect(field).toHaveValue(
        "Lue repon ohjeet ja kerro lyhyesti, mitä Aurinkopolku tekee. Näytä tärkeimmät hakemistot ja mistä testit ajetaan. Älä muuta tiedostoja.\n\n",
      );
      await page.goto("/workspaces");
      if (width === 390) await page.getByTestId("navigation-open").click();
      await page
        .getByRole("navigation")
        .getByTestId("workspace-start-muistiinpanot")
        .click();
      await expect(page.getByTestId("start-page-hint")).toBeVisible();
      await expect(page.getByTestId("starting-goal")).toHaveCount(0);
      await expect(page.getByTestId("start-page-title")).toHaveCount(0);
      await snapshot(page, testInfo.outputPath(`absent-${width}-${theme}`), {
        labOrigin,
      });
      // Exercise the validated command-list boundary, not a transport error.
      await page.route("**/api/v1/**/commands*", async (route) => {
        const response = await route.fetch();
        const list = await response.json();
        await route.fulfill({
          response,
          json: { ...list, start_page: { state: "needs_update" } },
        });
      });
      await field.fill("Oma keskeneräinen ajatus.");
      await page.reload();
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);
      await expect(page.getByTestId("start-page-needs-update")).toBeVisible();
      await expect(page.getByTestId("start-page-hint")).toHaveCount(0);
      await expect(page.getByTestId("starting-goal")).toHaveCount(0);
      await expect(field).toHaveValue("Oma keskeneräinen ajatus.");
      const unavailableAudit = await new AxeBuilder({ page })
        .include('[data-testid="start-here"]')
        .analyze();
      expect(unavailableAudit.violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await snapshot(
        page,
        testInfo.outputPath(`needs-update-${width}-${theme}`),
        {
          labOrigin,
        },
      );
      expect(sent).toEqual([]);
    });
  }
}
