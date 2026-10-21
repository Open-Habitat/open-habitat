import { expect, test } from "./worker-host";

// The fixture renders the production ToolRow without starting a Pi session.
test("@tool-layout long tool targets truncate without clipping the name", async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?fixture=design-tool-layout");
    const row = page.locator(".ah-tool-row");
    await expect(row.getByTestId("history-tool-toggle")).toBeVisible();
    await expect(row.locator(".ah-tool-name")).toHaveText("bash");
    await expect(row.locator(".ah-tool-target")).toContainText("find");
    const geometry = await row.evaluate((node) => {
      const name = node.querySelector(".ah-tool-name") as HTMLElement;
      const target = node.querySelector(".ah-tool-target") as HTMLElement;
      const button = node.querySelector("button") as HTMLElement;
      return {
        nameWidth: name.getBoundingClientRect().width,
        nameScroll: name.scrollWidth,
        targetWidth: target.clientWidth,
        targetScroll: target.scrollWidth,
        right: button.getBoundingClientRect().right,
      };
    });
    expect(geometry.nameWidth).toBeGreaterThanOrEqual(geometry.nameScroll);
    expect(geometry.targetScroll).toBeGreaterThan(geometry.targetWidth);
    expect(geometry.right).toBeLessThanOrEqual(width);
  }
});
