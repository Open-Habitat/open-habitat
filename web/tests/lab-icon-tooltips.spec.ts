import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { expect, test } from "./lab-host";

test.use({ deviceScaleFactor: 2, reducedMotion: "reduce" });
test("@a11y header icons explain themselves promptly without covering controls", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const state = await (await page.request.get("/api/v1/snapshot")).json();
  const workspace = state.workspaces.find(
    (w: { name: string }) => w.name === "aurinkokello",
  );
  await page.goto(`/workspaces/${workspace.workspace_id}`);
  await page
    .getByTestId(/^(new-conversation|conversation-start)$/)
    .first()
    .click();
  const editor = page.getByTestId("toggle-editor");
  await expect(editor).toBeVisible();
  await expect(editor).not.toHaveAttribute("title");
  await editor.hover();
  const tip = page.getByRole("tooltip");
  await expect(tip).toBeVisible({ timeout: 600 });
  const buttonBox = await editor.boundingBox();
  const tipBox = await tip.boundingBox();
  expect(
    buttonBox &&
      tipBox &&
      (tipBox.y >= buttonBox.y + buttonBox.height ||
        tipBox.y + tipBox.height <= buttonBox.y),
  ).toBe(true);
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    expect(
      (
        await new AxeBuilder({ page })
          .include('[role="tooltip"]')
          .include(".ah-agent-header")
          .analyze()
      ).violations,
    ).toEqual([]);
    if (process.env.OH_VISUAL_CAPTURE === "1")
      await snapshot(
        page,
        resolve(`../issues/icon-tooltips-slow/header-${colorScheme}`),
        { labOrigin: new URL(page.url()).origin },
      );
  }
  await page.getByTestId("toggle-terminal").hover();
  await expect(tip).toBeVisible({ timeout: 150 });
  await page.keyboard.press("Escape");
  await expect(tip).toHaveCount(0);
});
