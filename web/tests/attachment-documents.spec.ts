import AxeBuilder from "@axe-core/playwright";
import {
  docxFixture,
  markdownFixture,
  pdfFixture,
  pptxFixture,
  xlsxFixture,
} from "../src/app/documentFixtures";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

// Each document carries what a hostile file could: a PDF that asks to run
// JavaScript on open, Markdown with script and handler HTML, a Word file
// with a `javascript:` link and an altChunk of foreign HTML with a script.
// Every one of them sets `__previewRan` or opens an alert if it ever runs.
const files = [
  {
    name: "tarjous.pdf",
    bytes: pdfFixture({
      pages: ["Tarjous", "Liite"],
      script: "app.alert(1); this.__previewRan = 1;",
    }),
  },
  { name: "muistio.md", bytes: new TextEncoder().encode(markdownFixture) },
  { name: "raportti.docx", bytes: docxFixture() },
  { name: "mittaukset.xlsx", bytes: xlsxFixture() },
  { name: "kvartaali.pptx", bytes: pptxFixture() },
  // A legacy format keeps the name, type and size view.
  { name: "vanha.doc", bytes: docxFixture() },
];

test("documents preview in the app's dialog without running anything they carry", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  // A drop is taken only once the composer accepts attachments, the same
  // state that enables its attach button; earlier the files are ignored.
  await expect(page.getByTestId("attach-file")).toBeEnabled();
  await page.locator(".ah-conversation-stream").evaluate(
    (element, list) => {
      const data = new DataTransfer();
      for (const file of list)
        data.items.add(new File([new Uint8Array(file.bytes)], file.name));
      element.dispatchEvent(
        new DragEvent("drop", {
          dataTransfer: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    files.map((f) => ({ name: f.name, bytes: Array.from(f.bytes) })),
  );
  const chips = page.locator(".ah-composer").getByTestId("attachment-chip");
  // Six files upload one after another, which on a loaded host takes longer
  // than one ordinary wait.
  await expect(chips).toHaveCount(files.length, { timeout: 30_000 });
  const preview = page.getByTestId("attachment-preview");
  const document = preview.getByTestId("attachment-document");
  const openChip = async (index: number) => {
    await chips.nth(index).getByTestId("attachment-open").click();
    await expect(preview).toBeVisible();
  };
  const close = async (button = false) => {
    if (button) await preview.getByTestId("attachment-preview-close").click();
    else await page.keyboard.press("Escape");
    await expect(preview).toHaveCount(0);
  };
  const ran = () =>
    page.evaluate(() => (window as { __previewRan?: number }).__previewRan);

  // PDF: pdf.js draws the pages; the open action's script never runs.
  await openChip(0);
  await expect(document).toHaveAttribute("data-preview-kind", "pdf");
  const pages = preview.getByTestId("attachment-pdf-page");
  await expect(pages).toHaveCount(2);
  await expect
    .poll(() =>
      pages.first().evaluate((canvas: HTMLCanvasElement) => {
        const context = canvas.getContext("2d");
        if (!context || !canvas.width) return 0;
        const { data } = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        );
        let ink = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i] < 128) ink += 1;
        return ink;
      }),
    )
    .toBeGreaterThan(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await close();

  // Markdown: rendered, with its HTML left out and its script link dead.
  await openChip(1);
  await expect(document).toHaveAttribute("data-preview-kind", "markdown");
  await expect(document.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(document.locator("script, img, [onerror]")).toHaveCount(0);
  for (const link of await document.locator("a").all())
    expect(await link.getAttribute("href")).not.toMatch(/^javascript:/i);
  await close();

  // Word: laid out in a frame the app cannot reach into and that cannot run
  // or navigate; clicking its script link does nothing.
  await openChip(2);
  const frame = preview.getByTestId("attachment-docx-frame");
  await expect(frame).toBeVisible();
  const word = page.frameLocator('[data-testid="attachment-docx-frame"]');
  await expectNativeText(word.locator("body"), "Synteettinen raportti");
  await expect(word.locator("script, iframe")).toHaveCount(0);
  expect(
    await frame.evaluate(
      (element: HTMLIFrameElement) => element.contentDocument === null,
    ),
  ).toBe(true);
  await word.locator("a").first().click();
  await expect(frame).toBeVisible();
  // axe cannot run inside a frame that runs no scripts. Legacy mode audits
  // the page and the frame element and skips cross-origin frame contents.
  expect(
    (await new AxeBuilder({ page }).setLegacyMode().analyze()).violations,
  ).toEqual([]);
  // Focus inside the frame keeps keys there, so the dialog closes by button.
  await close(true);

  // Excel: each visible sheet is a tab of a plain table.
  await openChip(3);
  const tabs = preview.getByRole("tab");
  await expect(tabs).toHaveCount(2);
  await expectNativeText(preview.getByTestId("attachment-sheet"), "Lämpötila");
  await tabs.nth(1).click();
  await expectNativeText(preview.getByTestId("attachment-sheet"), "Keskiarvo");
  await close();

  // PowerPoint: the slides' text, tables and the embedded picture.
  await openChip(4);
  await expect(preview.getByTestId("attachment-slide")).toHaveCount(2);
  await expect
    .poll(() =>
      preview
        .locator(".ah-attachment-slide-image")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(1);
  await close();

  // A legacy format: name, type and size, no document.
  await openChip(5);
  await expect(preview.getByTestId("attachment-size")).toHaveAttribute(
    "data-bytes",
    String(files[5].bytes.length),
  );
  await expect(document).toHaveCount(0);
  await close();

  // The same dialog on a phone stays within the screen; the page fits it.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const index of [0, 2]) {
    await openChip(index);
    const target =
      index === 0
        ? pages.first()
        : preview.getByTestId("attachment-docx-frame");
    await expect(target).toBeVisible();
    const box = await preview.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
    expect(box && box.y >= 0 && box.y + box.height <= 844).toBe(true);
    const shown = await target.boundingBox();
    expect(shown && shown.x >= 0 && shown.x + shown.width <= 390).toBe(true);
    await expect(preview.getByTestId("attachment-original")).toBeInViewport();
    await close();
  }

  expect(dialogs).toEqual([]);
  expect(await ran()).toBeUndefined();
});

// Native content is asserted only as the document's own text.
async function expectNativeText(
  scope: import("@playwright/test").Locator,
  text: string,
) {
  await expect
    .poll(() => scope.evaluate((node) => node.textContent ?? ""))
    .toContain(text);
}
