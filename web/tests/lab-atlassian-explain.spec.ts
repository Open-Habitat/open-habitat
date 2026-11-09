import { resolve } from "node:path";
import { snapshot } from "../lab/session.mjs";
import { expect, test } from "./lab-host";

for (const width of [1440, 390]) {
  for (const language of ["fi", "en-US"]) {
    test.describe(`Atlassian explanation ${width} ${language}`, () => {
      test.use({
        ignoreHTTPSErrors: true,
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
      test("maps the connection and administrator request to their own cards", async ({
        page,
      }) => {
        await page.goto("/workspaces");
        await page.getByTestId("github-sign-in").click();
        await page
          .getByRole("link")
          .and(page.locator('a[href*="code=42"]'))
          .click();
        const session = await (await page.request.get("/auth/session")).json();
        for (const data of [
          { experimental: { "atlassian-connect": true } },
          { experimental: { "explain-mode": true } },
          { language },
        ]) {
          expect(
            (
              await page.request.put("/api/v1/account/preferences", {
                headers: {
                  Origin: new URL(page.url()).origin,
                  "X-Agent-Host-CSRF": session.csrf,
                },
                data,
              })
            ).ok(),
          ).toBe(true);
        }
        await page.reload();
        if (width === 390) await page.getByTestId("navigation-open").click();
        await page.getByTestId("account-menu-trigger").click();
        await page.getByTestId("menu-explain").click();
        await expect(page.getByTestId("explain-bar")).toBeVisible();
        await page.getByTestId("account-menu-trigger").click();
        await page.getByTestId("menu-settings").click();
        await page.getByTestId("settings-tiedot").click();
        const tile = page.getByTestId("integration-tile-atlassian");
        await tile.hover();
        await expect(page.getByTestId("explain-card")).toHaveAttribute(
          "data-card",
          "M70",
        );
        if (process.env.OH_VISUAL_CAPTURE === "1")
          await snapshot(
            page,
            resolve(
              `../issues/atlassian-trello-connect/atlassian-card-${width}-${language}`,
            ),
            { labOrigin: new URL(page.url()).origin },
          );
        await tile.getByTestId("integration-connect-open").click();
        const dialog = page.getByRole("dialog");
        const request = dialog.getByTestId("atlassian-approval-request");
        await request.hover();
        await expect(page.getByTestId("explain-card")).toHaveAttribute(
          "data-card",
          "M71",
        );
        if (process.env.OH_VISUAL_CAPTURE === "1")
          await snapshot(
            page,
            resolve(
              `../issues/atlassian-trello-connect/atlassian-approval-${width}-${language}`,
            ),
            { labOrigin: new URL(page.url()).origin },
          );
        await dialog.getByTestId("integration-continue").click();
        await expect(dialog).toHaveAttribute("data-stage", "intro");
        await expect(page.getByTestId("explain-card")).toHaveAttribute(
          "data-card",
          "M73",
        );
        const login = await (
          await page.request.get("/api/v1/integrations/login")
        ).json();
        expect(login.state).toBe("none");
      });
    });
  }
}
