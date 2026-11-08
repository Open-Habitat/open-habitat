import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// The context view (experimental) through the real gateway and daemon: the
// list comes from Pi's own reading of the synthetic Pi's session (the
// daemon's helper over the pinned Pi), and Tiivistä nyt goes through the
// daemon's compact route to the synthetic Pi's RPC compact, its progress and
// outcome showing in the conversation too. The pinned Pi's own compaction
// runs in the daemon's native test.
test.beforeEach(async ({ page }) => {
  expect((await page.request.get("/fixture/reset-clock")).status()).toBe(204);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
  reducedMotion: "reduce",
});

async function send(page: Page, text: string) {
  await page.getByTestId("message-input").fill(text);
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByText(`Selvä. Kysyit: "${text}".`).last()).toBeVisible({
    timeout: 20000,
  });
}

test("@context-view lists what fills the context, opens a file by its name and compacts with Pi", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const session = await (await page.request.get("/auth/session")).json();
  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": session.csrf,
        },
        data: { experimental: { "conversation-context-view": true } },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-git-project")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const pill = page.locator(".md-empty-picker");
  await pill.locator(":scope > summary").click();
  await pill.getByTestId("model-gpt-6-nova").check();
  await pill.getByTestId(/^(model-commit|conversation-model-start)$/).click();
  // Two large reads of one file and a short turn: Pi's own cut keeps the
  // newest 20 000 tokens or so and has the first read to summarize.
  await send(page, "lue loki ensimmäinen");
  await send(page, "lue loki toinen");
  await send(page, "kolmas");

  await page.locator(".ah-agent-header").getByTestId("context-ring").click();
  const view = page.getByTestId("context-view");
  await expect(view).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("view.png") });
  // Pi's technical figures give way to the view.
  await expect(page.getByTestId("context-parts")).toHaveCount(0);
  await expect(page.getByTestId("context-turns")).toHaveCount(0);
  const seen = page.getByTestId("context-seen");
  const file = seen.getByTestId("context-item").filter({ hasText: "main.go" });
  await expect(file).toHaveCount(1);
  await expect(file).toContainText(/luki klo \d\d\.\d\d ja \d\d\.\d\d/);
  await expect(
    seen.getByTestId("context-item").filter({ hasText: "Viestit ja agentin" }),
  ).toHaveCount(1);
  // Files only: the read file stays, the conversation and commands go.
  await page
    .getByTestId("context-files-filter")
    .getByRole("button", { name: /Vain tiedostot/ })
    .click();
  await expect(page.getByTestId("context-files-note")).toBeVisible();
  await expect(
    seen.getByTestId("context-item").filter({ hasText: "Viestit ja agentin" }),
  ).toHaveCount(0);
  await expect(file).toHaveCount(1);
  expect(
    (await new AxeBuilder({ page }).include(".ah-cd-page").analyze())
      .violations,
  ).toEqual([]);

  // The file's name opens it beside the conversation, as a file link does.
  await file.getByTestId("context-item-open").click();
  await expect(
    page.getByTestId("browser-editor").locator(".ah-browser-filename"),
  ).toHaveText("cmd/main.go");

  // A summary that fails: the page and the conversation both say so.
  const ring = page.locator(".ah-agent-header").getByTestId("context-ring");
  const notice = page.getByTestId("compaction-notice");
  await page.getByTestId("compact-open").click();
  await page
    .getByTestId("compact-dialog")
    .getByRole("textbox")
    .fill("epäonnistu");
  await page.getByTestId("compact-confirm").click();
  await expect(page.getByTestId("compacting")).toBeVisible();
  await expect(page.getByTestId("compact-outcome")).toContainText(
    "Tiivistys ei onnistunut",
    { timeout: 20000 },
  );
  await ring.click();
  await expect(notice).toHaveAttribute("data-state", "failed");
  await expect(notice).toContainText("Tiivistys ei onnistunut");
  await ring.click();

  // The confirmation says by clock time what Pi summarizes and keeps.
  await page.getByTestId("compact-open").click();
  const dialog = page.getByTestId("compact-dialog");
  await expect(dialog).toContainText(/viesteistä klo \d\d\.\d\d–\d\d\.\d\d/);
  await expect(dialog).toContainText("jäävät ennalleen");
  expect(
    (await new AxeBuilder({ page }).include(".ah-cv-modal").analyze())
      .violations,
  ).toEqual([]);
  await dialog.getByRole("textbox").fill("Säilytä lokin luvut");
  await page.screenshot({ path: testInfo.outputPath("dialog.png") });
  await dialog.getByTestId("compact-confirm").click();
  await expect(dialog).toHaveCount(0);
  // Progress shows at once where it was pressed and in the conversation,
  // and the conversation keeps Pi's compaction as its mark.
  await expect(page.getByTestId("compacting")).toBeVisible();
  await ring.click();
  await expect(notice).toHaveAttribute("data-state", "running");
  await expect(notice).toContainText("Agentti tiivistää keskustelua");
  await page.screenshot({ path: testInfo.outputPath("compacting.png") });
  const mark = page.getByTestId("compaction-marker");
  await expect(mark).toContainText(/Keskustelu tiivistettiin klo \d/, {
    timeout: 20000,
  });
  await expect(notice).toHaveCount(0);
  await mark.getByText("Yhteenveto").click();
  await expect(mark).toContainText("Säilytä lokin luvut");
  await page.screenshot({ path: testInfo.outputPath("compacted.png") });
  await ring.click();
  // Right after, Pi refuses another until the conversation goes on.
  await expect(page.getByTestId("compacted")).toContainText("Tiivistetty klo", {
    timeout: 20000,
  });
  await expect(page.getByTestId("compact-open")).toHaveCount(0);
  const gone = page.getByTestId("context-summary-only");
  await expect(gone).toBeVisible();

  // A phone shows the same page within its width.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(view).toBeVisible();
  await expect(page.getByTestId("compacted")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("phone.png"),
    fullPage: true,
  });
  expect(
    await view.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
});
