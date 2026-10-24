import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// The agent (the synthetic Pi) changes cmd/main.go while the person has
// unsaved text in the browser editor. The fixture file is
//   1 package main / 2 (empty) / 3 func main() { / 4 println("hei") / 5 }
// and the prompts below make Pi's `edit` (or `bash`) change line 1 or line 4.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1366, height: 844 },
});

async function openMain(page: Page, phone: boolean) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole(phone ? "region" : "navigation")
    .filter(phone ? { has: page.getByTestId("workspace-git-project") } : {})
    .getByRole("link")
    .and(page.getByTestId("workspace-git-project"))
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("conversation-start"))
    .click();
  await send(page, "Näytä tiedosto");
  const link = page
    .getByRole("link")
    .and(page.locator('a[href="#cmd%2Fmain.go%3A3-4"]'));
  await expect(link).toBeVisible({ timeout: 20000 });
  await link.click();
  await expect(page.getByTestId("editor-document")).toContainText(
    'println("hei")',
  );
}
async function send(page: Page, text: string) {
  await page.getByTestId("message-input").fill(text);
  await page.getByTestId("send").click();
}
async function disk(page: Page) {
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const workspace = snapshot.workspaces.find(
    (w: { name: string }) => w.name === "git-project",
  ).workspace_id;
  const url = `/api/v1/workspaces/editor/file?${new URLSearchParams({ workspace_id: workspace, path: "cmd/main.go" })}`;
  return (await (await page.request.get(url)).json()).content as string;
}
/** Types at the end of the println line as a person would. */
async function typeOnPrintln(page: Page, text: string) {
  await page.getByTestId("editor-document").getByText("println(").click();
  await page.keyboard.press("End");
  await page.keyboard.type(text);
}
const AGENT = "// Agentin kommentti";

for (const [width, theme] of [
  [1366, "light"],
  [390, "dark"],
] as const)
  test(`@browser-editor @a11y the agent's change waits for a typing pause, and undo and redo take it as one step ${width} ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await openMain(page, width === 390);
    await page.locator("html").evaluate((el, value) => {
      el.dataset.theme = value;
    }, theme);
    const doc = page.getByTestId("editor-document");
    const changes = page.getByTestId("editor-changes");
    await typeOnPrintln(page, " // minun");
    await send(page, "muokkaa tiedostoa");
    // Noticed at once, marked where it lands, but not yet in the text.
    await expect(changes).toHaveAttribute("data-changes", "pending", {
      timeout: 20000,
    });
    await expect(changes).toHaveAttribute("data-source", "agent");
    await expect(page.getByTestId("pending-line").first()).toBeVisible();
    await expect(page.getByTestId("editor-import-now")).toBeVisible();
    expect(await disk(page)).toContain(AGENT);
    await expect(doc).not.toContainText(AGENT);
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-testid="browser-editor"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    // Typing keeps it waiting: each key restarts the two-second pause.
    for (const key of "abcde") {
      await typeOnPrintln(page, key);
      await page.waitForTimeout(700);
      await expect(changes).toHaveAttribute("data-changes", "pending");
    }
    await expect(doc).not.toContainText(AGENT);
    await expect(changes).toHaveAttribute("data-changes", "imported", {
      timeout: 5000,
    });
    await expect(doc).toContainText(AGENT);
    await expect(doc).toContainText('println("hei") // minunabcde');
    await expect(page.getByTestId("conflict")).toHaveCount(0);
    await expect(page.getByTestId("editor-undo-import")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    // Ctrl+Z takes back only the import; the person's typing stays.
    await doc.press("ControlOrMeta+z");
    await expect(doc).not.toContainText(AGENT);
    await expect(doc).toContainText('println("hei") // minunabcde');
    await expect(changes).toHaveAttribute("data-changes", "undone");
    await expect(page.getByTestId("editor-reimport")).toBeVisible();
    await doc.press("ControlOrMeta+Shift+KeyZ");
    await expect(doc).toContainText(AGENT);
    await expect(changes).toHaveAttribute("data-changes", "imported");
    await doc.press("ControlOrMeta+z");
    await expect(doc).not.toContainText(AGENT);
    await doc.press("ControlOrMeta+y");
    await expect(doc).toContainText(AGENT);
    // Typing after the import makes undo take the typing first.
    await typeOnPrintln(page, "!");
    await expect(page.getByTestId("editor-undo-import")).toHaveCount(0);
    await page.getByTestId("editor-save").click();
    await expect(page.getByTestId("editor-dirty")).toBeEmpty();
    const saved = await disk(page);
    expect(saved).toContain(AGENT);
    expect(saved).toContain('println("hei") // minunabcde!');
    await expect(page.getByTestId("replace-note")).toHaveCount(0);
  });

test("@browser-editor save brings waiting changes in and saves at once when nothing conflicts; a bash change stays neutral", async ({
  page,
}) => {
  await openMain(page, false);
  const changes = page.getByTestId("editor-changes");
  await typeOnPrintln(page, " // minun");
  await send(page, "muokkaa bashilla");
  await expect(changes).toHaveAttribute("data-changes", "pending", {
    timeout: 20000,
  });
  // Bash is not a file tool: the editor cannot say the agent wrote it.
  await expect(changes).toHaveAttribute("data-source", "disk");
  await page.getByTestId("editor-save").click();
  await expect(page.getByTestId("editor-dirty")).toBeEmpty();
  const saved = await disk(page);
  expect(saved).toContain(AGENT);
  expect(saved).toContain('println("hei") // minun');
  await expect(page.getByTestId("replace-note")).toHaveCount(0);
});

for (const width of [1366, 390])
  test(`@browser-editor @a11y a conflict waits for a choice, each choice is undoable, and keeping one's own line leaves a note for the agent ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await openMain(page, width === 390);
    const doc = page.getByTestId("editor-document");
    let writes = 0;
    page.on("request", (request) => {
      if (request.method() === "PUT" && request.url().includes("/editor/file"))
        writes++;
    });
    await page.getByTestId("editor-document").getByText("hei").dblclick();
    await page.keyboard.type("minun");
    await send(page, "muokkaa samaa riviä");
    await expect(page.getByTestId("editor-changes")).toHaveAttribute(
      "data-changes",
      "pending",
      { timeout: 20000 },
    );
    // Save before the pause: it imports, and the conflict holds the save.
    await page.getByTestId("editor-save").click();
    await expect(page.getByTestId("conflict")).toHaveCount(1);
    await expect(page.getByTestId("conflict-theirs")).toContainText(
      'println("agentti")',
    );
    await expect(page.getByTestId("editor-save")).toBeDisabled();
    await expect(page.getByTestId("editor-save-reason")).toBeVisible();
    expect(writes).toBe(0);
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-testid="browser-editor"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByTestId("pick-both").click();
    await expect(doc).toContainText('println("minun")');
    await expect(doc).toContainText('println("agentti")');
    await doc.press("ControlOrMeta+z");
    await expect(page.getByTestId("conflict")).toHaveCount(1);
    await page.getByTestId("pick-theirs").click();
    await expect(doc).toContainText('println("agentti")');
    await expect(doc).not.toContainText('println("minun")');
    await doc.press("ControlOrMeta+z");
    await expect(page.getByTestId("conflict")).toHaveCount(1);
    await page.getByTestId("pick-mine").click();
    await expect(page.getByTestId("conflict")).toHaveCount(0);
    await expect(doc).not.toContainText('println("agentti")');
    await page.getByTestId("editor-save").click();
    await expect(page.getByTestId("editor-dirty")).toBeEmpty();
    expect(writes).toBe(1);
    expect(await disk(page)).toContain('println("minun")');
    // The conversation says what was replaced, in the agent's own text.
    const note = page.getByTestId("replace-note");
    await expect(note).toHaveCount(1);
    await expect(note.getByTestId("replace-note-line")).toContainText(
      'println("agentti")',
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-testid="replace-note"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    const sent: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        /\/(send|steer|follow_up)$/.test(new URL(request.url()).pathname)
      )
        sent.push(request.postDataJSON().message);
    });
    if (width === 390) {
      // Closing sends nothing.
      await note.getByTestId("replace-note-dismiss").click();
      await expect(note).toHaveCount(0);
      await expect(page.getByTestId("message-input")).toBeFocused();
      expect(sent).toEqual([]);
      return;
    }
    // Telling sends a short message at once and leaves the draft alone.
    const input = page.getByTestId("message-input");
    await input.fill("oma luonnos");
    await note.getByTestId("tell-agent").click();
    await expect(note).toHaveCount(0);
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toContain("cmd/main.go");
    expect(sent[0]).toContain("Lue tiedosto uudelleen");
    expect(sent[0]).not.toContain("agentti");
    await expect(input).toHaveValue("oma luonnos");
    await expect(input).toBeFocused();
    // The message reaches the conversation; the note for this save stays gone.
    await expect(page.getByText(/Lue tiedosto uudelleen/).first()).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByTestId("replace-note")).toHaveCount(0);
    expect(sent).toHaveLength(1);
  });
