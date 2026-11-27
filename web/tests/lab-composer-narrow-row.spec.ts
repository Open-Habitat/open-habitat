import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { openHeaderPanel } from "./conversation-view";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

// The composer's bottom row in a narrow conversation column: a file open in
// the side panel narrows the column without changing the viewport, and the
// row's aids (Liitä, Komennot, Tiedosto, Sanele) once drew over each other
// and under Send. Whatever the row decides to show, no two of its controls
// may overlap and all of them stay inside the row.

type Box = { x: number; y: number; width: number; height: number };

const intersect = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;

async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  if (!found) throw new Error("control has no box");
  return found;
}

async function expectRowLegible(page: Page, working = false) {
  const row = page.locator(".ah-crow");
  const ids = [
    ...(working ? ["composer-mode", "composer-stop"] : []),
    "attach-file",
    "command-palette",
    "file-picker",
    "dictation-mic",
    "send",
  ];
  // The model's pill clips its name in a narrow row, but it must not be
  // squeezed out of sight to make room for the aids.
  const model = row.getByTestId("composer-model-picker");
  if (await model.count()) ids.splice(3, 0, "composer-model-picker");
  const controls: [string, Box][] = [];
  for (const id of ids) {
    const control = row.getByTestId(id);
    await expect(control).toBeVisible();
    expect((await box(control)).width, `${id} keeps its width`).toBeGreaterThan(
      20,
    );
    // Visible or collapsed to an icon, the control keeps a name.
    await expect(control).toHaveAccessibleName(/\S/);
    controls.push([id, await box(control)]);
  }
  const outer = await box(row);
  for (const [id, b] of controls) {
    expect(b.x, `${id} starts inside the row`).toBeGreaterThanOrEqual(
      outer.x - 0.5,
    );
    expect(b.x + b.width, `${id} ends inside the row`).toBeLessThanOrEqual(
      outer.x + outer.width + 0.5,
    );
  }
  for (let i = 0; i < controls.length; i++)
    for (let j = i + 1; j < controls.length; j++)
      expect(
        intersect(controls[i][1], controls[j][1]),
        `${controls[i][0]} and ${controls[j][0]} overlap`,
      ).toBe(false);
  // A label wider than its button would spill over its neighbour unseen by
  // the boxes above.
  const spilled = await row.evaluate((node) =>
    [...node.querySelectorAll<HTMLElement>("button")]
      .filter((b) => b.offsetParent && b.scrollWidth > b.clientWidth + 1)
      .map((b) => b.dataset.testid ?? b.className),
  );
  expect(spilled).toEqual([]);
}

for (const width of [1280, 1440, 390]) {
  test(`@lab composer row ${width}px${width > 800 ? " beside an open file" : ""}: the controls never overlap`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    await page.request.get("/fixture/conversations-reset");
    await page.request.get("/fixture/scenario?value=ready");
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page.locator('a[href*="code=42"]').click();
    // Sanele is in the row only with a speech key.
    await page.goto("/settings/speech");
    await page
      .getByTestId("speech-key-input")
      .fill("syntheticSonioxKey00000000");
    await page.getByTestId("speech-key-save").click();
    await expect(page.getByTestId("speech-key-source")).toHaveAttribute(
      "data-source",
      "own",
    );
    const state = await (await page.request.get("/api/v1/snapshot")).json();
    const workspace = state.workspaces.find(
      (w: { name: string }) => w.name === "aurinkokello",
    );
    await page.goto(`/workspaces/${workspace.workspace_id}`);
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await expect(page).toHaveURL(/conversation=pi:/);
    await expect(page.getByTestId("dictation-mic")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    if (width > 800) {
      const before = await box(page.locator(".ah-crow"));
      await openHeaderPanel(page, "toggle-editor");
      for (const path of ["cmd", "cmd/main.go"])
        await page
          .getByTestId("editor-file-entry")
          .and(page.locator(`[data-path="${path}"]`))
          .click();
      await expect(page.getByTestId("editor-document")).toBeVisible();
      // The panel narrowed the column, which is the case under test.
      await expect
        .poll(async () => (await box(page.locator(".ah-crow"))).width)
        .toBeLessThan(before.width - 100);
      await expectRowLegible(page);
      // The editor at its widest leaves the conversation its narrowest.
      await page.getByTestId("resize-editor").focus();
      await page.keyboard.press("End");
      await expect
        .poll(async () => (await box(page.locator(".ah-crow"))).width)
        .toBeLessThan(before.width / 2);
    }
    await expectRowLegible(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      (await new AxeBuilder({ page }).include(".ah-crow").analyze()).violations,
    ).toEqual([]);
    // While Pi works, Ohjaa and Stop take room from the same row.
    expect(
      (
        await page.request.get("/fixture/scenario?value=pi-visual-hold")
      ).status(),
    ).toBe(204);
    const field = page.getByTestId("message-input");
    await field.fill("työ");
    await field.press("Enter");
    await expect(
      page
        .getByTestId("composer-stop")
        .and(page.locator('[data-stop-target="agent"]')),
    ).toBeVisible({ timeout: 20_000 });
    await expect(field).toHaveAttribute("data-working", "true");
    await expect
      .poll(async () =>
        (await page.request.get("/fixture/pi-visual-ready")).status(),
      )
      .toBe(204);
    await expectRowLegible(page, true);
  });
}
