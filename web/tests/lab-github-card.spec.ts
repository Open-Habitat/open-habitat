import { resolve } from "node:path";
import { snapshot } from "../lab/session.mjs";
import { expect, test } from "./lab-host";

for (const width of [1440, 390]) {
  for (const language of ["fi", "en-US", "en-GB"]) {
    test.describe(`GitHub card ${width} ${language}`, () => {
      test.use({
        ignoreHTTPSErrors: true,
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
      test("explains visible actions and blocks lasting effects", async ({
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
        await page.route("**/api/v1/snapshot", async (route) => {
          const response = await route.fetch();
          const body = await response.json();
          if (body.auth)
            body.auth.native_github = {
              state: "connected",
              login: "alice",
              scopes: ["gist", "read:org", "repo"],
            };
          await route.fulfill({ response, json: body });
        });
        await page.route("**/api/v1/account/github/disconnect", (route) =>
          route.fulfill({
            status: 403,
            json: { error: { code: "reauthentication_required" } },
          }),
        );
        await page.emulateMedia({
          colorScheme: language === "fi" ? "light" : "dark",
          contrast: language === "en-GB" ? "more" : "no-preference",
        });
        await page.goto("/settings/code-hosts");
        await expect(page.getByTestId("github-footer")).toBeVisible();
        if (process.env.OH_VISUAL_CAPTURE === "1")
          await snapshot(
            page,
            resolve(`../issues/github-card-visible/card-${width}-${language}`),
            { labOrigin: new URL(page.url()).origin },
          );
        if (width === 390) await page.getByTestId("navigation-open").click();
        await page.getByTestId("account-menu-trigger").click();
        await page.getByTestId("menu-explain").click();
        await expect(page.getByTestId("explain-bar")).toBeVisible();
        if (width === 390)
          await page
            .getByTestId("close-navigation")
            .and(page.locator(".ah-mobile-close"))
            .click();
        const card = page.getByTestId("explain-card");
        await page.getByTestId("github-reconnect").hover();
        await expect(card).toHaveAttribute("data-card", "GH03");
        await page.getByTestId("github-reconnect").click();
        await expect(page).toHaveURL(/\/settings\/code-hosts$/);
        await page.getByTestId("github-disconnect-inspect").hover();
        await expect(card).toHaveAttribute("data-card", "GH04");
        await page.getByTestId("github-disconnect-inspect").click();
        await page.getByTestId("github-disconnect-reauth").hover();
        await expect(card).toHaveAttribute("data-card", "GH05");
        if (process.env.OH_VISUAL_CAPTURE === "1")
          await snapshot(
            page,
            resolve(
              `../issues/github-card-visible/dialog-${width}-${language}`,
            ),
            { labOrigin: new URL(page.url()).origin },
          );
        await page.getByTestId("github-disconnect-reauth").click();
        await expect(page).toHaveURL(/\/settings\/code-hosts$/);
        await page.getByTestId("cancel").click();
        await expect(page.getByTestId("github-disconnect-dialog")).toHaveCount(
          0,
        );
        let posts = 0;
        await page.unroute("**/api/v1/account/github/disconnect");
        await page.route("**/api/v1/account/github/disconnect", (route) => {
          if (route.request().method() === "POST") posts++;
          return route.fulfill({
            json: {
              state: "connected",
              scope: "user",
              observation_token: "synthetic-explain-observation",
            },
          });
        });
        await page.getByTestId("github-disconnect-inspect").click();
        await page.getByTestId("github-disconnect-confirm").hover();
        await expect(card).toHaveAttribute("data-card", "GH06");
        await page.getByTestId("github-disconnect-confirm").click();
        expect(posts).toBe(0);
        await expect(
          page.getByTestId("github-disconnect-dialog"),
        ).toBeVisible();
      });
    });
  }
}
