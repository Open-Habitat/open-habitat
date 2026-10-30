import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./lab-host";

// Setting the workspace icon from its page (workspace-icons, experimental;
// proto-workspace-icon-setting's Otsikko) through the real gateway, daemon
// and lab repositories: the heading's icon opens the picker, a choice is
// written to .open-habitat.yaml and committed alone and silently, and the
// rail follows from the next snapshot. A directory without Git gets the file.

const capture = process.env.OH_WORKSPACE_ICONS_CAPTURE;
async function shot(page: Page, name: string) {
  if (!capture) return;
  mkdirSync(capture, { recursive: true });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(capture, `${name}-${scheme}.png`) });
  }
  await page.emulateMedia({ colorScheme: "light" });
}

async function session(page: Page) {
  const s = await (await page.request.get("/auth/session")).json();
  return {
    Origin: new URL(page.url()).origin,
    "X-Agent-Host-CSRF": s.csrf as string,
  };
}
const rail = (page: Page) => page.getByRole("navigation");
const railIcon = (page: Page, name: string) =>
  rail(page).getByTestId(`workspace-${name}`).getByTestId("workspace-icon");
type GitRead = {
  files: { path: string; status: string }[];
  commits: { hash: string }[];
};
async function git(page: Page, id: string): Promise<GitRead> {
  const r = await page.request.get(`/api/v1/workspaces/git?workspace_id=${id}`);
  expect(r.ok()).toBeTruthy();
  return r.json();
}
async function openWorkspace(page: Page, name: string) {
  await rail(page)
    .getByRole("link")
    .and(page.getByTestId(`workspace-${name}`))
    .click();
  await expect(page).toHaveURL(/\/workspaces\/ws_/);
  return new URL(page.url()).pathname.split("/").pop() ?? "";
}

test("@workspace-icons the heading's icon sets the workspace icon and commits only the config", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const picker = page.getByTestId("workspace-icon-picker");
  const id = await openWorkspace(page, "aurinkokello");
  // Without the experiment the heading has no icon.
  await expect(page.getByTestId("workspace-title")).toBeVisible();
  await expect(picker).toHaveCount(0);
  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: await session(page),
        data: { experimental: { "workspace-icons": true } },
      })
    ).ok(),
  ).toBeTruthy();
  // The person's Git identity, which a commit needs; without it the page
  // says the file waits for a commit.
  expect(
    (
      await page.request.post("/api/v1/account/git-identity", {
        headers: await session(page),
        data: {
          name: "Synthetic lab",
          email: "synthetic@example.invalid",
          mode: "settings",
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.reload();
  await expect(picker).toBeVisible();
  await expect(page.getByTestId("workspace-icon-source")).toBeVisible();
  const before = await git(page, id);
  expect(before.files.length).toBeGreaterThan(0);

  // An emoji from the grid: on the page at once, no announcement.
  await picker.click();
  const dialog = page
    .getByRole("dialog")
    .and(page.getByTestId("workspace-icon-dialog"));
  await expect(dialog).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include(".ah-wsip-popover").analyze())
      .violations,
  ).toEqual([]);
  await shot(page, "valitsin");
  const choice = dialog.getByTestId("workspace-icon-emoji").nth(4);
  const emoji = (await choice.textContent()) ?? "";
  await choice.click();
  await expect(dialog).toHaveCount(0);
  const head = picker.getByTestId("workspace-icon");
  await expect(head).toHaveAttribute("data-kind", "emoji");
  await expect(head).toHaveText(emoji);
  await expect(railIcon(page, "aurinkokello")).toHaveText(emoji);
  await expect(page.getByTestId("workspace-icon-note")).toHaveCount(0);
  // One new commit holding only the config; the agent's work is untouched.
  await expect
    .poll(async () => (await git(page, id)).commits[0]?.hash)
    .not.toBe(before.commits[0]?.hash);
  const after = await git(page, id);
  expect(after.files).toEqual(before.files);
  await shot(page, "valittu");

  // Letters typed into the field, then Automaattinen: the derived glyph.
  await picker.click();
  await dialog.getByTestId("workspace-icon-letters-input").fill("ak");
  await dialog.getByTestId("workspace-icon-letters-input").press("Enter");
  await expect(head).toHaveAttribute("data-kind", "glyph");
  await expect(head).toHaveText("AK");
  await expect(railIcon(page, "aurinkokello")).toHaveText("AK");
  await picker.click();
  await expect(dialog.getByTestId("workspace-icon-letters")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await dialog.getByTestId("workspace-icon-auto").click();
  await expect(railIcon(page, "aurinkokello")).toHaveText("AU");
  await expect
    .poll(async () => {
      const s = await (await page.request.get("/api/v1/snapshot")).json();
      return s.workspaces.find(
        (w: { workspace_id: string }) => w.workspace_id === id,
      )?.icon_auto;
    })
    .toBe(true);
  expect((await git(page, id)).files).toEqual(before.files);

  // A typed emoji; the logo stays offered on its own whatever the config says.
  await openWorkspace(page, "kotisivu");
  await expect(head).toHaveAttribute("data-kind", "image");
  await picker.click();
  await dialog.getByTestId("workspace-icon-own").fill("🧮");
  await dialog.getByTestId("workspace-icon-own-use").click();
  await expect(railIcon(page, "kotisivu")).toHaveText("🧮");
  await picker.click();
  await dialog.getByTestId("workspace-icon-logo").click();
  await expect(railIcon(page, "kotisivu")).toHaveAttribute(
    "data-kind",
    "image",
  );

  // A directory without Git just gets the file, silently too.
  await openWorkspace(page, "muistiinpanot");
  await picker.click();
  await dialog.getByTestId("workspace-icon-emoji").first().click();
  await expect(railIcon(page, "muistiinpanot")).toHaveAttribute(
    "data-kind",
    "emoji",
  );
  await expect(page.getByTestId("workspace-icon-note")).toHaveCount(0);

  // On a phone the picker is a sheet along the bottom edge.
  await page.setViewportSize({ width: 390, height: 844 });
  await picker.click();
  await expect(dialog).toBeVisible();
  const box = await page.locator(".ah-wsip-popover").boundingBox();
  expect(box && Math.round(box.y + box.height)).toBe(844);
  expect(box && Math.round(box.width)).toBe(390);
  await shot(page, "puhelin-valitsin");
});
