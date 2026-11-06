import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

// The composer's lists inside the field (composer-lists-in-field,
// experimental; proto-composer-popover-placement rounds 3 and 4, Puu and
// Lista) against the real gateway, daemon and the lab's aurinkokello
// checkout: scripts/ and tests/ hold changes, cmd/ does not. The folders,
// their counts, the ranked search and the previews come from the person's
// own daemon reading Git.

// OH_COMPOSER_LISTS_CAPTURE=<dir> writes screenshots and static HTML there.
const capture = process.env.OH_COMPOSER_LISTS_CAPTURE;
async function shot(page: Page, name: string) {
  if (!capture) return;
  const { snapshot } = await import("../lab/session.mjs");
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await snapshot(page, resolve(capture, `${name}-${scheme}`), {
      region: ".ah-composer",
      labOrigin: new URL(page.url()).origin,
    });
  }
  await page.emulateMedia({ colorScheme: "light" });
}

async function newConversation(page: Page, width: number) {
  await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const session = async () =>
    (await (await page.request.get("/auth/session")).json()) as {
      csrf?: string;
    };
  await expect.poll(async () => (await session()).csrf).toBeTruthy();
  const s = await session();
  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": s.csrf as string,
        },
        data: { experimental: { "composer-lists-in-field": true } },
      })
    ).ok(),
  ).toBeTruthy();
  await page.reload();
  if (width < 600) await page.getByTestId("navigation-open").click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-start-aurinkokello")
    .click();
  await expect(page.getByTestId("command-palette")).toBeVisible();
  return page.getByTestId("message-input");
}

const list = (page: Page) => page.getByTestId("composer-field-list");
const row = (page: Page, path: string) =>
  list(page).locator(`[role="option"][data-path="${path}"]`);
const selectedPath = (page: Page) =>
  list(page).locator('[role="option"][aria-selected="true"]');

test("@lab composer lists in the field: browse the tree, search by name, show in folder, mark two", async ({
  page,
}) => {
  test.setTimeout(120000);
  const field = await newConversation(page, 1440);
  await field.fill("Katso ");
  await page.getByTestId("file-picker").click();
  // The list is part of the field box, between the text and the row.
  await expect(list(page)).toBeVisible();
  await expect(
    page.locator(".ah-cbox").getByTestId("composer-field-list"),
  ).toHaveCount(1);
  const listBox = await list(page).boundingBox();
  const fieldBox = await field.boundingBox();
  const rowBox = await page.locator(".ah-crow").boundingBox();
  expect(listBox && fieldBox && rowBox).toBeTruthy();
  if (!listBox || !fieldBox || !rowBox) return;
  expect(listBox.y).toBeGreaterThanOrEqual(fieldBox.y + fieldBox.height - 1);
  expect(listBox.y + listBox.height).toBeLessThanOrEqual(rowBox.y + 1);
  await expect(page.getByTestId("composer-palette")).toHaveCount(0);

  // The folders holding changes start open with the changed files in place;
  // a folder without changes is closed.
  await expect(row(page, "scripts/")).toHaveAttribute("data-open", "true");
  await expect(row(page, "tests/")).toHaveAttribute("data-open", "true");
  await expect(row(page, "cmd/")).toHaveAttribute("data-open", "false");
  await expect(
    row(page, "scripts/status_rows.py").getByTestId("file-git-mark"),
  ).toHaveAttribute("data-git-mark", "modified");
  await expect(
    row(page, "scripts/").getByTestId("composer-folder-changed"),
  ).toBeVisible();
  // The selection starts on the first changed file; its diff shows beside.
  await expect(selectedPath(page)).toHaveAttribute("data-path", /./);
  const preview = list(page).locator(".ah-pal-prev");
  await expect(preview).toBeVisible();
  await expect(preview.locator("pre")).toBeVisible({ timeout: 10000 });
  expect(
    (await new AxeBuilder({ page }).include(".ah-choice-in").analyze())
      .violations,
  ).toEqual([]);
  await shot(page, "tree-1440");

  // A closed folder opens in place from the daemon's read of it.
  await row(page, "cmd/").click();
  await expect(row(page, "cmd/")).toHaveAttribute("data-open", "true");
  await expect(row(page, "cmd/main.go")).toBeVisible({ timeout: 10000 });
  const search = page.getByTestId("command-search");
  await search.press("ArrowLeft");
  await expect(row(page, "cmd/")).toHaveAttribute("data-open", "false");

  // A search lists by name with the folder after it, changed files first.
  await search.fill("status");
  await expect(row(page, "scripts/status_rows.py")).toBeVisible({
    timeout: 10000,
  });
  const order = await list(page)
    .getByRole("option")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-path")));
  expect(order.slice(0, 2)).toEqual([
    "scripts/status_rows.py",
    "tests/test_status_rows.py",
  ]);
  await expect(page.getByTestId("composer-list-note")).toBeVisible();
  await shot(page, "search-1440");
  // → shows the selected file in its folder.
  await search.press("ArrowDown");
  await search.press("End");
  await search.press("ArrowRight");
  await expect(search).toHaveValue("");
  await expect(selectedPath(page)).toHaveAttribute(
    "data-path",
    "tests/test_status_rows.py",
  );

  // Tab marks two rows and Enter adds both paths at the caret.
  await search.press("ArrowUp");
  const first = await selectedPath(page).getAttribute("data-path");
  await search.press("Tab");
  const second = await selectedPath(page).getAttribute("data-path");
  await search.press("Tab");
  await expect(page.getByTestId("composer-marked")).toBeVisible();
  await shot(page, "marked-1440");
  await search.press("Enter");
  await expect(list(page)).toHaveCount(0);
  await expect(field).toHaveValue(`Katso @${first} @${second} `);
  await expect(field).toBeFocused();

  // Komennot opens inside the field too; Enter puts the command first.
  await page.getByTestId("command-palette").click();
  await expect(list(page)).toHaveAttribute("data-kind", "cmd");
  await search.fill("fix");
  await search.press("Enter");
  await expect(field).toHaveValue(/^\/fix-tests Katso @/);
});

test("@lab composer lists in the field on a phone: no preview, boxes mark and the row adds them", async ({
  page,
}) => {
  test.setTimeout(120000);
  const field = await newConversation(page, 390);
  await field.fill("");
  await page.getByTestId("file-picker").click();
  await expect(row(page, "scripts/status_rows.py")).toBeVisible({
    timeout: 10000,
  });
  await expect(list(page).locator(".ah-pal-prev")).toBeHidden();
  const box = await page.locator(".ah-cbox").boundingBox();
  const listBox = await list(page).boundingBox();
  if (!box || !listBox) throw new Error("no layout");
  expect(listBox.x).toBeGreaterThanOrEqual(box.x);
  expect(listBox.x + listBox.width).toBeLessThanOrEqual(box.x + box.width);
  await row(page, "scripts/status_rows.py")
    .getByTestId("composer-mark")
    .click();
  await row(page, "tests/").getByTestId("composer-mark").click();
  await shot(page, "marked-390");
  await page.getByTestId("composer-marked-add").click();
  await expect(field).toHaveValue("@scripts/status_rows.py @tests/ ");
});
