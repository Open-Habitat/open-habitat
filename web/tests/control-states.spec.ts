import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { hostOrigin } from "../test-ports.mjs";

test.use({ ignoreHTTPSErrors: true });

// Scope this guard to the migrated controls; the remaining raw controls belong to migrate-bespoke-controls.
test("migrated controls cannot bypass their shared component", () => {
  const sources = [
    "Primitives.tsx",
    "Overlays.tsx",
    "Navigation.tsx",
    "ReturnView.tsx",
    "Conversation.tsx",
  ];
  for (const name of sources) {
    const source = readFileSync(
      new URL(`../src/components/${name}`, import.meta.url),
      "utf8",
    );
    if (name === "Overlays.tsx") {
      expect(source).not.toMatch(/<AriaButton\b|<MenuItem\b|<button\b/);
    }
    if (name === "Primitives.tsx") expect(source).not.toMatch(/<AriaButton\b/);
    if (name === "ReturnView.tsx") {
      expect(source).not.toMatch(/<Link\b/);
      expect(source).toContain(
        '<LinkRow href={conversation.href} kind="return">',
      );
    }
    if (name === "Conversation.tsx") {
      expect(source).not.toContain('className="ah-disclosure-button"');
      expect(source).toContain("<DisclosureButton tool");
    }
    if (name === "Navigation.tsx") {
      expect(source).toContain('kind="agent"');
      expect(source).toContain('kind="workspace"');
      expect(source).toContain('kind="home"');
      expect(source).toContain("<RefreshIconButton onPress={onRefresh} />");
    }
  }
  const css = readFileSync(
    new URL("../src/components/components.css", import.meta.url),
    "utf8",
  );
  expect(css).not.toMatch(
    /biome-ignore-all|\.ah-button\s*\{|\.ah-account-shelf\s*>\s*\.ah-button/,
  );
  expect(css).not.toMatch(/\.ah-continue-list a(?:\s*\{|:hover)/);
  expect(css).toContain(".ah-tool-row .ah-tool-output {");
  expect(css).toContain(".ah-conversation-frame .ah-composer {");
  expect(css).not.toContain(".ah-tool-row .ah-tool-row .ah-tool-output");
  expect(css).not.toContain(".ah-tool-row .ah-conversation-frame .ah-composer");
  expect(css).toContain(".ah-account-trigger {");
});

async function feedback(control: Locator, page: Page, press = true) {
  await expect(control).toHaveAttribute(
    "data-ah-primitive",
    /button|link|menu-item|disclosure/,
  );
  await control.scrollIntoViewIfNeeded();
  const background = () =>
    control.evaluate((node) => getComputedStyle(node).backgroundColor);
  const idle = await background();
  await control.hover();
  await expect.poll(background).not.toBe(idle);
  if (press) {
    const hover = await background();
    await page.mouse.down();
    await expect.poll(background).not.toBe(hover);
    await page.mouse.move(0, 0);
    await page.mouse.up();
  }
  // Programmatic keyboard focus is used here to avoid opening a menu or following a link.
  await page.keyboard.press("Tab");
  await control.focus();
  await expect(control).toHaveCSS("outline-width", "2px");
}

test("@control-states shared feedback on navigation, list, button and menu in both themes", async ({
  page,
}) => {
  await page.request.get(`${hostOrigin}/fixture/reset-clock`);
  await page.request.get(`${hostOrigin}/fixture/conversations-reset`);
  await page.request.get(`${hostOrigin}/fixture/scenario?value=ready`);
  await page.goto(`${hostOrigin}/workspaces`);
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await feedback(page.locator(".ah-continue-list a").first(), page);
    await feedback(page.locator(".ah-agent-item .ah-nav-link").first(), page);
    await expect(page.locator(".ah-workspace-row").first()).toHaveAttribute(
      "title",
      /.+/,
    );
    const menu = page.getByRole("button", { name: /Tilivalikko/ });
    await feedback(menu, page, false);
    await menu.click();
    await feedback(
      page.getByRole("menuitem", { name: "Asetukset" }),
      page,
      false,
    );
    await page.keyboard.press("Escape");
    await feedback(page.getByRole("button", { name: "Päivitä" }), page);
  }
  // One shared recipe token changes the same state across views.
  await page.evaluate(() =>
    document.documentElement.style.setProperty(
      "--ah-surface-2",
      "rgb(12, 78, 92)",
    ),
  );
  for (const target of [
    page.locator(".ah-continue-list a").first(),
    page.locator(".ah-agent-item .ah-nav-link").first(),
  ]) {
    await target.hover();
    await expect(target).toHaveCSS("background-color", "rgb(12, 78, 92)");
  }
  await page.locator(".ah-continue-list a").first().click();
  await expect(page.locator(".ah-conversation-frame")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const composer = page.locator(".ah-composer");
  await expect(composer).toBeVisible();
  await expect(composer).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(composer).toHaveCSS("border-top-width", "0px");
  const action = page
    .locator(".ah-composer [data-ah-primitive=button]")
    .first();
  if (await action.isEnabled()) await feedback(action, page);
  else {
    await expect(action).toHaveAttribute("data-disabled", "true");
    await expect(action).toHaveCSS("cursor", "not-allowed");
  }
});
