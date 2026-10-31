import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// The editor, the context page and the shell around them in English
// (en-shell-editor): an English browser with no choice of its own gets the
// English interface, and these views show no Finnish of their own. The
// conversation's and the file's content are the fixture's, not checked.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1366, height: 844 },
  locale: "en-GB",
});

const finnish = /[äöÄÖ]/;

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
}

async function send(page: Page, text: string) {
  await page.getByTestId("message-input").fill(text);
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
}

test("@en-shell-editor the browser editor speaks English", async ({ page }) => {
  await signIn(page);
  await page
    .getByRole("navigation")
    .getByTestId("workspace-git-project")
    .click();
  await page.getByTestId("conversation-start").click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  await expect(page.getByTestId("toggle-editor")).toHaveAccessibleName(
    "Editor",
  );
  await send(page, "Näytä tiedosto");
  const link = page
    .getByRole("link")
    .and(page.locator('a[href="#cmd%2Fmain.go%3A3-4"]'));
  await expect(link).toBeVisible({ timeout: 20000 });
  await expect(link).toHaveAttribute("title", /^Open in the editor: /);
  await link.click();
  const editor = page.getByTestId("browser-editor");
  await expect(page.getByTestId("editor-document")).toBeVisible();
  await expect(page.getByTestId("editor-document")).toHaveAccessibleName(
    "File text",
  );
  await expect(page.getByTestId("editor-picker")).toHaveText("Files");
  await expect(page.getByTestId("editor-save")).toHaveAccessibleName("Save");
  await expect(page.getByTestId("close-editor")).toHaveAccessibleName(
    "Close editor",
  );
  await expect(page.getByTestId("hide-conversation")).toHaveAccessibleName(
    "Editor in the whole window",
  );
  await expect(page.getByTestId("resize-editor")).toHaveAccessibleName(
    "Conversation width",
  );

  await page.getByTestId("editor-document").fill("synthetic edit\n");
  await expect(page.getByTestId("editor-dirty")).toHaveText("Modified");
  // The picker opens with the editor on a wide screen.
  if (
    (await page.getByTestId("editor-picker").getAttribute("aria-expanded")) !==
    "true"
  )
    await page.getByTestId("editor-picker").click();
  const picker = page.getByTestId("editor-file-picker");
  await expect(picker).toBeVisible();
  await expect(picker).toHaveAccessibleName("Workspace files");
  await expect(picker.getByText("Filter by name")).toBeVisible();
  await expect(picker.getByTestId("editor-file-state")).toHaveText(
    "● Modified",
  );
  // Only the file's own content may carry Finnish; the editor's words do not.
  const chrome = await editor.evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    for (const node of copy.querySelectorAll(
      "[data-testid=editor-document], [data-testid=editor-file-entry] code",
    ))
      node.remove();
    return copy.innerText;
  });
  expect(chrome).not.toMatch(finnish);
});

test("@en-shell-editor the context page speaks English", async ({ page }) => {
  test.setTimeout(90000);
  expect((await page.request.get("/fixture/reset-clock")).status()).toBe(204);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
  await page.request.get("/fixture/scenario?value=ready");
  await signIn(page);
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const pill = page.locator(".md-empty-picker");
  await pill.locator(":scope > summary").click();
  await pill.getByTestId("model-gpt-6-nova").check();
  await pill.getByTestId(/^(model-commit|conversation-model-start)$/).click();
  await send(page, "konteksti 205300");
  const ring = page.locator(".ah-agent-header").getByTestId("context-ring");
  await expect(ring).toHaveAttribute("data-tokens", "205300");
  await ring.click();
  const contextPage = page.getByTestId("context-page");
  await expect(contextPage).toHaveAttribute("data-state", "ready");
  await expect(contextPage.getByRole("heading", { level: 2 })).toHaveText(
    "Context",
  );
  await expect(
    contextPage.getByRole("heading", { name: "What it is made of" }),
  ).toBeVisible();
  await expect(
    page.getByTestId("context-turns").getByRole("columnheader", {
      name: "Request",
    }),
  ).toBeVisible();
  // The requests in the turn table are the person's own words.
  const shown = await contextPage.evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    for (const node of copy.querySelectorAll(".ask, .ah-cd-summary"))
      node.remove();
    return copy.innerText;
  });
  expect(shown).not.toMatch(finnish);
  await expect(page.getByTestId("context-back")).toHaveAccessibleName(
    /^Back to the conversation: /,
  );
});
