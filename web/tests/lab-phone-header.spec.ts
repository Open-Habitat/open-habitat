import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./lab-host";

test.use({ reducedMotion: "reduce", isMobile: true, hasTouch: true });

// A phone header that wraps every control onto its own line left the
// conversation a strip of the screen (five rows on an iPhone). It stays two
// rows: title with the panels and the menu, then the conversation's state.
for (const width of [390, 360]) {
  test(`@a11y phone conversation header keeps two rows and its actions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    const state = await (await page.request.get("/api/v1/snapshot")).json();
    const workspace = state.workspaces.find(
      (w: { name: string }) => w.name === "aurinkokello",
    );
    await page.goto(`/workspaces/${workspace.workspace_id}`);
    await page
      .getByTestId(/^(new-conversation|conversation-start)$/)
      .first()
      .click();
    await page.getByTestId("message-input").fill("puhelimen yläpalkki");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    const header = page.locator(".ah-conversation-frame > .ah-agent-header");
    const visible = [
      "workspace-title",
      "context-ring",
      "git-chip",
      "conversation-model",
      "toggle-editor",
      "toggle-terminal",
      "conversation-menu",
    ];
    for (const id of visible)
      await expect(header.getByTestId(id)).toBeInViewport({ ratio: 1 });
    const rows = await header.evaluate((element) => {
      const tops = [...element.querySelectorAll(".ah-agent-topline > *")]
        .map((child) => child.getBoundingClientRect())
        .filter((box) => box.width > 1 && box.height > 1)
        .map((box) => box.top + box.height / 2);
      return tops.filter(
        (centre, i) => tops.findIndex((c) => Math.abs(c - centre) < 12) === i,
      ).length;
    });
    expect(rows).toBeLessThanOrEqual(2);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);

    // The secondary actions are in the menu, with the whole title.
    await header.getByTestId("conversation-menu").click();
    const menu = page.getByRole("menu");
    for (const id of ["workspace", "retitle", "archive", "details"])
      await expect(
        menu.getByRole("menuitem").and(page.getByTestId(`menu-${id}`)),
      ).toBeVisible();
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      expect(
        (
          await new AxeBuilder({ page })
            .include(".ah-agent-header")
            .include(".ah-popover")
            .analyze()
        ).violations,
      ).toEqual([]);
    }
    await menu
      .getByRole("menuitem")
      .and(page.getByTestId("menu-details"))
      .click();
    await expect(page.locator(".ah-details-popover")).toBeInViewport();
    await expect(header.getByTestId("conversation-menu")).toBeFocused();

    await header.getByTestId("conversation-menu").click();
    await menu
      .getByRole("menuitem")
      .and(page.getByTestId("menu-workspace"))
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${workspace.workspace_id}$`),
    );
  });
}
