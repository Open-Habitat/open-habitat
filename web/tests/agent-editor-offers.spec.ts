import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Agent editor offers against the real daemon route and the browser editor:
// the account offer goes through the agent route's confinement, and a press
// opens the workspace file at its line through the editor's own file links.
// Same-UID synthetic evidence.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1366, height: 844 },
});

async function conversation(page: Page) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByRole("link")
    .and(page.getByTestId("workspace-git-project"))
    .click();
  await page.getByTestId("conversation-start").click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  const url = new URL(page.url());
  return {
    id: url.searchParams.get("conversation") ?? "",
    workspace: url.pathname.split("/").pop() ?? "",
  };
}

async function offer(
  page: Page,
  target: string,
  workspace: string,
  path: string,
  line: number,
) {
  return page.request.get(
    `/fixture/editor-offer?${new URLSearchParams({ target, workspace, path, line: String(line) })}`,
  );
}

test("@browser-editor a conversation offer opens the workspace file at its line in the editor", async ({
  page,
}) => {
  const { id, workspace } = await conversation(page);
  expect((await offer(page, id, workspace, "cmd/main.go", 4)).status()).toBe(
    200,
  );
  const card = page.getByTestId("editor-offer");
  await expect(card).toHaveAttribute("data-state", "ready");
  // Nothing opens without the press.
  await expect(page.getByTestId("editor-document")).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="editor-offer"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await card.getByTestId("editor-offer-open").click();
  const doc = page.getByTestId("editor-document");
  await expect(doc).toContainText('println("hei")');
  await expect(doc.locator(".cm-activeLine")).toContainText('println("hei")');
});

test("@browser-editor an account offer is checked by the daemon and opens from the tray", async ({
  page,
}) => {
  const { workspace } = await conversation(page);
  // The agent route refuses what the editor must not open: nothing arrives.
  for (const path of ["../ordinary-dir/README.md", "cmd", "missing.go"])
    expect((await offer(page, "account", workspace, path, 1)).status()).toBe(
      400,
    );
  expect(
    (await offer(page, "account", workspace, "cmd/main.go", 4)).status(),
  ).toBe(200);
  const card = page.getByTestId("view-tray").getByTestId("editor-offer");
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute("data-state", "ready");
  await card.getByTestId("editor-offer-open").click();
  const doc = page.getByTestId("editor-document");
  await expect(doc.locator(".cm-activeLine")).toContainText('println("hei")');
});
