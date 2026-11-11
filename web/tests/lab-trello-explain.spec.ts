import { resolve } from "node:path";
import { snapshot } from "../lab/session.mjs";
import { expect, test } from "./lab-host";

for (const width of [1440, 390]) {
  for (const language of ["fi", "en-US"]) {
    // Phone captures are dark so both schemes are reviewed.
    const colorScheme = width === 390 ? "dark" : "light";
    test.describe(`Trello explanation ${width} ${language}`, () => {
      test.use({
        ignoreHTTPSErrors: true,
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
        colorScheme,
      });
      test("maps the Trello connection and its administrator request to their own cards", async ({
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
          { experimental: { "trello-connect": true } },
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
        const tile = page.getByTestId("integration-tile-trello");
        await tile.hover();
        await expect(page.getByTestId("explain-card")).toHaveAttribute(
          "data-card",
          "M76",
        );
        const capture = async (name: string) => {
          if (process.env.OH_VISUAL_CAPTURE === "1")
            await snapshot(
              page,
              resolve(
                `../issues/atlassian-trello-connect/trello-${name}-${width}-${language}-${colorScheme}`,
              ),
              { labOrigin: new URL(page.url()).origin },
            );
        };
        await capture("card");
        await tile.getByTestId("integration-connect-open").click();
        const dialog = page.getByRole("dialog");
        await dialog.getByTestId("trello-approval-request").hover();
        await expect(page.getByTestId("explain-card")).toHaveAttribute(
          "data-card",
          "M78",
        );
        await capture("approval");
        await dialog.getByRole("radiogroup").hover();
        await expect(page.getByTestId("explain-card")).toHaveAttribute(
          "data-card",
          "M81",
        );
        // Signing in is a lasting action: it waits while explaining.
        await dialog.getByTestId("integration-continue").click();
        await expect(dialog).toHaveAttribute("data-stage", "intro");
        await expect(page.getByTestId("explain-card")).toHaveAttribute(
          "data-card",
          "M80",
        );
        const login = await (
          await page.request.get("/api/v1/integrations/login")
        ).json();
        expect(login.state).toBe("none");
      });
    });
  }
}
