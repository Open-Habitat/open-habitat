import { readdirSync, readFileSync } from "node:fs";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Locator, type Page, test } from "./worker-host";

test.use({ ignoreHTTPSErrors: true });

test("production controls are constructed only in ControlElements", () => {
  for (const dir of ["components", "app"]) {
    const root = new URL(`../src/${dir}/`, import.meta.url);
    for (const name of readdirSync(root).filter(
      (entry) =>
        entry.endsWith(".tsx") && !/\.(test|stories)\.tsx$/i.test(entry),
    )) {
      if (dir === "components" && name === "ControlElements.tsx") continue;
      const source = readFileSync(new URL(name, root), "utf8");
      expect(source, `${dir}/${name}`).not.toMatch(
        /<(?:button|a|AriaButton)\b/g,
      );
    }
  }
  expect(
    readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8"),
  ).not.toMatch(/<(?:button|a|AriaButton)\b/g);
  const conversation = readFileSync(
    new URL("../src/components/Conversation.tsx", import.meta.url),
    "utf8",
  );
  expect(conversation).toContain("<DisclosureButton tool");
  const css = readFileSync(
    new URL("../src/components/components.css", import.meta.url),
    "utf8",
  );
  expect(css).not.toMatch(
    /biome-ignore-all|\.ah-button\s*\{|\.ah-account-shelf\s*>\s*\.ah-button|\.ah-control\b(?!-reason)/,
  );
  expect(css).not.toMatch(/\.ah-home-card-head a(?:\s*\{|:hover)/);
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
    await feedback(page.locator(".ah-home-card-head a").first(), page);
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
      "--ah-surface-hover",
      "rgb(12, 78, 92)",
    ),
  );
  for (const target of [
    page.locator(".ah-home-card-head a").first(),
    page.locator(".ah-agent-item .ah-nav-link").first(),
  ]) {
    await target.hover();
    await expect(target).toHaveCSS("background-color", "rgb(12, 78, 92)");
  }
  await page.locator(".ah-home-card-head a").first().click();
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

test("@control-states migrated rail, drawer and text links retain their layout", async ({
  page,
}) => {
  await page.request.get(`${hostOrigin}/fixture/reset-clock`);
  await page.request.get(`${hostOrigin}/fixture/conversations-reset`);
  await page.request.get(`${hostOrigin}/fixture/scenario?value=ready`);
  await page.goto(`${hostOrigin}/workspaces`);
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  const row = page.locator(".ah-workspace-row").first();
  await expect(row).toBeVisible();
  expect(
    await row.evaluate((node) => node.getBoundingClientRect().height),
  ).toBeLessThanOrEqual(36);
  const workspace = row.locator(".ah-workspace-link");
  await expect(workspace).toHaveCSS("display", "block");
  expect(
    await workspace.evaluate((node) => {
      const label = node as HTMLElement;
      label.textContent =
        "long-workspace-name-that-does-not-fit-in-the-sidebar";
      return (
        label.getBoundingClientRect().right <=
        (label.parentElement?.getBoundingClientRect().right ?? -1)
      );
    }),
  ).toBe(true);
  await page.locator(".ah-home-card-head a").first().click();
  await expect(page.locator(".ah-header-workspace")).toHaveCSS(
    "padding-left",
    "0px",
  );
  await expect(page.locator(".ah-header-workspace")).toHaveCSS(
    "display",
    "block",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Avaa navigaatio" }).first().click();
  const scrim = page.locator(".ah-mobile-scrim");
  const idle = await scrim.evaluate(
    (node) => getComputedStyle(node).backgroundColor,
  );
  expect(idle).not.toBe("rgba(0, 0, 0, 0)");
  await scrim.hover({ force: true });
  await expect(scrim).toHaveCSS("background-color", idle);
  await scrim.click({ force: true });
  await page.locator(".ah-skip").focus();
  await expect(page.locator(".ah-skip")).not.toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
});
