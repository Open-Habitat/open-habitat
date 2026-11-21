import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect, type Locator, type Page } from "./worker-host";

// The shared code block (OutputBox) in every place it is used: a reply's
// fenced code in each shape, nested fences in a Markdown file's editor preview.
// The turn Changes diff is covered by turn-changes.spec.ts. Wrap must keep its
// toggle on the rail, really wrap (nothing scrolls sideways) and, off again,
// scroll sideways; each block keeps its own choice.
const test = createHostTest(false);
test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

const words = "synteettinen sana";
const nestedMarkdown = `# Koodit

- Listan kohta:

  \`\`\`
  echo ${`${words} `.repeat(30).trim()}
  \`\`\`

> Lainaus:
>
> \`\`\`python
> print("${`${words} `.repeat(30).trim()}")
> \`\`\`
`;

async function openConversation(page: Page, phone: boolean) {
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
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  await expect(page.getByTestId("message-input")).toBeEnabled();
  await page.getByTestId("message-input").fill("koodilohkot ja tiedosto");
  await page.getByTestId("send").click();
}

/** Whether the block sits inside the given element that carries `text`. */
const nestedIn = (block: Locator, tag: string, text: string) =>
  block.evaluate(
    (figure, [tag, text]) =>
      !!figure.parentElement?.closest(tag)?.textContent?.includes(text),
    [tag, text] as const,
  );
const viewports = (block: Locator) => block.locator("pre.ah-output-viewport");
/** Whether every line of the block is in view without sideways scrolling. */
const fits = (block: Locator) =>
  viewports(block).evaluateAll((pres) =>
    pres.every(
      (pre) =>
        getComputedStyle(pre).whiteSpace === "pre-wrap" &&
        pre.scrollWidth <= pre.clientWidth + 1,
    ),
  );
const overflows = (block: Locator) =>
  viewports(block).evaluateAll(
    (pres) =>
      pres.every((pre) => getComputedStyle(pre).whiteSpace === "pre") &&
      pres.some((pre) => pre.scrollWidth > pre.clientWidth + 1),
  );

/** Wrap on and off again, with the toggle on the rail and inside the block. */
async function wrapsOnRequest(block: Locator) {
  await block.scrollIntoViewIfNeeded();
  const toggle = block.getByTestId("output-wrap");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await overflows(block)).toBe(true);
  await toggle.click();
  // The control stays where it was, pressed, so wrap can be undone.
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => fits(block)).toBe(true);
  // The block itself stays inside its column, its rail too.
  const inside = await block.evaluate((figure) => {
    const column = figure.parentElement?.getBoundingClientRect();
    const box = figure.getBoundingClientRect();
    const rail = figure
      .querySelector('[data-testid="output-wrap"]')
      ?.getBoundingClientRect();
    return (
      !!column &&
      !!rail &&
      box.right <= column.right + 1 &&
      rail.right <= box.right + 1 &&
      rail.left >= box.left
    );
  });
  expect(inside).toBe(true);
  await toggle.click();
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => overflows(block)).toBe(true);
}

for (const [width, height, device, scheme] of [
  [1366, 844, "desktop", "light"],
  [390, 844, "phone", "dark"],
] as const)
  test.describe(() => {
    test.use({ viewport: { width, height }, colorScheme: scheme });

    test(`@code-block-wrap reply code blocks wrap on request on a ${device} (${scheme})`, async ({
      page,
    }) => {
      await openConversation(page, device === "phone");
      const reply = page.locator(".ah-ordered-blocks").filter({
        has: page.locator("figure.ah-markdown-code"),
      });
      const blocks = reply.locator("figure.ah-markdown-code");
      await expect(blocks).toHaveCount(8, { timeout: 30000 });
      const [plain, medium, language, unbroken, many, listed, quoted, short] = [
        0, 1, 2, 3, 4, 5, 6, 7,
      ].map((n) => blocks.nth(n));
      expect(await nestedIn(listed, "li", "Listan kohta")).toBe(true);
      expect(await nestedIn(quoted, "blockquote", "Lainaus")).toBe(true);
      // A block that fits offers no wrap.
      await expect(short.getByTestId("output-wrap")).toHaveCount(0);
      for (const block of [plain, medium, language, unbroken, listed, quoted])
        await wrapsOnRequest(block);
      await expect(many.locator(".ah-bash-head")).toBeVisible();
      await wrapsOnRequest(many);

      // Each block keeps its own choice: wrapping one leaves the others alone,
      // and a long block keeps wrap when its view changes.
      await many.getByTestId("output-wrap").click();
      await expect(plain.getByTestId("output-wrap")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      expect(await overflows(plain)).toBe(true);
      await many.getByTestId("output-expand").click();
      await expect(many.locator(".ah-output-all")).toBeVisible();
      await expect(many.getByTestId("output-wrap")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect.poll(() => fits(many)).toBe(true);
    });

    test(`@code-block-wrap nested fences in a Markdown preview wrap on request on a ${device} (${scheme})`, async ({
      page,
    }) => {
      await openConversation(page, device === "phone");
      const state = await (await page.request.get("/api/v1/snapshot")).json();
      const root = state.workspaces.find(
        (w: { name: string }) => w.name === "git-project",
      ).path;
      await writeFile(join(root, "koodit.md"), nestedMarkdown);
      const link = page
        .getByRole("link")
        .and(page.locator('a[href="#cmd%2Fmain.go%3A3-4"]'));
      await expect(link).toBeVisible({ timeout: 20000 });
      await link.click();
      await expect(page.getByTestId("editor-document")).toBeVisible();
      if (!(await page.getByTestId("editor-file-picker").isVisible()))
        await page.getByTestId("editor-picker").click();
      const entry = page
        .getByTestId("editor-file-entry")
        .and(page.locator('[data-path="koodit.md"]'));
      await entry.click();
      await expect(entry).toHaveAttribute("aria-current", "page");
      await expect(page.getByTestId("codemirror-editor")).toBeAttached();
      if (await page.getByTestId("editor-file-picker").isVisible())
        await page.getByTestId("editor-picker").click();
      await expect(page.getByTestId("editor-file-picker")).toBeHidden();
      const preview = page.getByTestId("editor-preview");
      await expect(preview).toBeVisible();
      const blocks = preview.locator("figure.ah-markdown-code");
      await expect(blocks).toHaveCount(2);
      expect(await nestedIn(blocks.nth(0), "li", "Listan kohta")).toBe(true);
      expect(await nestedIn(blocks.nth(1), "blockquote", "Lainaus")).toBe(true);
      await wrapsOnRequest(blocks.nth(0));
      await wrapsOnRequest(blocks.nth(1));
      await blocks.nth(1).getByTestId("output-wrap").click();
      await expect(blocks.nth(0).getByTestId("output-wrap")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await expect.poll(() => fits(blocks.nth(1))).toBe(true);
    });
  });
