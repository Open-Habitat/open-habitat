import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});

for (const language of ["fi", "en-US"] as const) {
  test(`@lab attachment refusal dismiss explains and waits (${language})`, async ({
    page,
  }) => {
    await page.request.get("/fixture/conversations-reset");
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    const session = await (await page.request.get("/auth/session")).json();
    const response = await page.request.put("/api/v1/account/preferences", {
      headers: {
        Origin: new URL(page.url()).origin,
        "X-Agent-Host-CSRF": session.csrf,
      },
      data: { experimental: { "explain-mode": true } },
    });
    expect(response.ok()).toBe(true);
    expect(
      (
        await page.request.put("/api/v1/account/preferences", {
          headers: {
            Origin: new URL(page.url()).origin,
            "X-Agent-Host-CSRF": session.csrf,
          },
          data: { language },
        })
      ).ok(),
    ).toBe(true);
    await page.reload();
    const state = await (await page.request.get("/api/v1/snapshot")).json();
    const ws = state.workspaces.find(
      (w: { name: string }) => w.name === "aurinkokello",
    );
    await page.goto(`/workspaces/${ws.workspace_id}`);
    await page.getByTestId("conversation-start").first().click();
    await expect(page).toHaveURL(/conversation=pi:/);
    await expect(page.getByTestId("start-here")).toBeVisible();
    const composer = page.locator(".ah-composer");
    await composer
      .locator('input[type="file"]')
      .evaluate((element: HTMLInputElement) => {
        const files = new DataTransfer();
        files.items.add(
          new File([new Uint8Array(21 * 1024 * 1024)], "synthetic.bin"),
        );
        element.files = files.files;
        element.dispatchEvent(new Event("change", { bubbles: true }));
      });
    await expect(page.getByTestId("attachment-refusal")).toBeVisible();
    const dismiss = page.getByTestId("attachment-refusal-dismiss");
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-testid="attachment-refusal"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByTestId("explain-toggle").click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await dismiss.hover();
      await expect(page.getByTestId("explain-card")).toHaveAttribute(
        "data-card",
        "V32",
      );
      await dismiss.click();
      await expect(page.getByTestId("attachment-refusal")).toBeVisible();
      if (process.env.OH_VISUAL_CAPTURE === "1") {
        await snapshot(
          page,
          resolve(`../issues/attachment-refusal-sticks/${language}-${width}`),
          { labOrigin: new URL(page.url()).origin },
        );
      }
    }
    await page.getByTestId("explain-stop").click();
    await dismiss.click();
    await expect(page.getByTestId("attachment-refusal")).toHaveCount(0);
  });
}
