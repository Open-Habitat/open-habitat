import AxeBuilder from "@axe-core/playwright";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  deviceScaleFactor: 2,
});

test("Markdown preview keeps its rail, keyboard focus and source on desktop and phone", async ({
  page,
}) => {
  const draft = `# Draft\n\n${Array.from({ length: 18 }, (_, i) => `Paragraph ${i}.\n`).join("\n")}\n| A | B |\n| --- | --- |\n| one | two |\n`;
  await page.route("**/api/v1/account/preferences", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.experimental = {
      ...json.experimental,
      "markdown-block-preview": true,
    };
    await route.fulfill({ response, json });
  });
  await page.route("**/api/v1/agents/*/history?*", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    if (json.entries)
      json.entries = [
        {
          entry_key: "preview-reply",
          kind: "assistant",
          content: {
            media_type: "text/plain",
            text: `\`\`\`markdown\n${draft}\`\`\``,
            complete: true,
          },
        },
      ];
    await route.fulfill({ response, json });
  });
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.goto("/agents/pi:a1a1a1a1-0000-4000-8000-000000000001");
  const toggle = page.getByTestId("markdown-preview-toggle");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await toggle.scrollIntoViewIfNeeded();
    const before = await toggle.boundingBox();
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect((await toggle.boundingBox())?.x).toBe(before?.x);
    await expect(page.getByTestId("output-edges")).toHaveCount(0);
    const document = page.locator(".ah-markdown-block-document");
    expect(
      await document.evaluate((e) => e.scrollHeight > e.clientHeight),
    ).toBe(true);
    if (process.env.OH_VISUAL_CAPTURE === "1") {
      const { snapshot } = await import("../lab/session.mjs");
      await snapshot(
        page,
        `../issues/markdown-block-preview/evidence/collapsed-${width}`,
        { labOrigin: new URL(page.url()).origin },
      );
    }
    await page.getByTestId("markdown-preview-expand").click();
    expect(
      await document.evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
    ).toBe(true);
    await expect(document.getByRole("table")).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).include(".ah-markdown-code").analyze())
        .violations,
    ).toEqual([]);
    if (process.env.OH_VISUAL_CAPTURE === "1") {
      const { snapshot } = await import("../lab/session.mjs");
      await snapshot(
        page,
        `../issues/markdown-block-preview/evidence/preview-${width}`,
        { labOrigin: new URL(page.url()).origin },
      );
    }
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("output-edges")).toBeVisible();
  }
});
