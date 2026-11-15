import { resolve } from "node:path";
import { snapshot } from "../lab/session.mjs";
import { expect, test } from "./lab-host";

for (const width of [1440, 390]) {
  for (const language of ["fi", "en-US"]) {
    test.describe(`Trash confirmation ${width} ${language}`, () => {
      test.use({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      test("explains the opening action and blocks permanent deletion in Explain mode", async ({
        page,
      }) => {
        await page.goto("/workspaces");
        await page.getByTestId("github-sign-in").click();
        await page
          .getByRole("link")
          .and(page.locator('a[href*="code=42"]'))
          .click();
        const session = await (await page.request.get("/auth/session")).json();
        const headers = {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": session.csrf,
        };
        for (const data of [
          { language },
          { experimental: { "explain-mode": true } },
        ]) {
          expect(
            (
              await page.request.put("/api/v1/account/preferences", {
                headers,
                data,
              })
            ).ok(),
          ).toBe(true);
        }
        const state = await (await page.request.get("/api/v1/snapshot")).json();
        const workspace = state.workspaces.find(
          (row: { name: string }) => row.name === "muistiinpanot",
        );
        expect(
          (
            await page.request.post("/api/v1/workspaces", {
              headers,
              data: {
                action: "delete",
                workspace_id: workspace.workspace_id,
                observation_token: workspace.observation_token,
                disposal: "trash",
              },
            })
          ).ok(),
        ).toBe(true);
        await page.goto("/settings/storage");
        if (width === 390) await page.getByTestId("navigation-open").click();
        await page.getByTestId("account-menu-trigger").click();
        await page.getByTestId("menu-explain").click();
        await expect(page.getByTestId("explain-bar")).toBeVisible();
        if (width === 390)
          await page
            .getByRole("button")
            .and(page.getByTestId("close-navigation"))
            .click();
        const open = page.getByTestId("purge-trash");
        await open.hover();
        await expect(page.getByTestId("explain-card")).toHaveAttribute(
          "data-card",
          "T47",
        );
        const capture = async (name: string) => {
          if (process.env.OH_VISUAL_CAPTURE === "1")
            await snapshot(
              page,
              resolve(
                `../issues/trash-item-delete-simple-confirm/${name}-${width}-${language}`,
              ),
              { labOrigin: new URL(page.url()).origin },
            );
        };
        await capture("explain");
        await open.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("textbox")).toHaveCount(0);
        const confirm = dialog.getByTestId("purge-workspace");
        await confirm.hover();
        await expect(page.getByTestId("explain-card")).toHaveAttribute(
          "data-card",
          "T38",
        );
        await capture("confirm");
        await confirm.click();
        await expect(dialog).toBeVisible();
        const listing = await (
          await page.request.post("/api/v1/workspaces", {
            headers,
            data: { action: "trash_list" },
          })
        ).json();
        expect(listing.entries).toHaveLength(1);
      });
    });
  }
}
