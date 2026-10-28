import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  docxFixture,
  markdownFixture,
  pptxFixture,
  xlsxFixture,
} from "../app/documentFixtures";
import { frameCSP } from "../app/documentPreview";
import { AttachmentPreview } from "./AttachmentPreview";
import { wordFrame } from "./DocumentPreview";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const url = "/api/v1/attachments/11111111-1111-4111-8111-111111111111";

function open(name: string, bytes: Uint8Array) {
  render(
    <AttachmentPreview
      attachment={{ image: false, name, url, source: "" }}
      onClose={() => {}}
      read={async () => bytes}
    />,
  );
  return screen.getByTestId("attachment-preview");
}

it("renders Markdown through the sanitising renderer: its HTML and script links stay text", {
  timeout: 20_000,
}, async () => {
  const dialog = open("muistio.md", new TextEncoder().encode(markdownFixture));
  const doc = await within(dialog).findByTestId(
    "attachment-document",
    {},
    // The first test loads the lazy renderer chunk.
    { timeout: 10_000 },
  );
  expect(doc.dataset.previewKind).toBe("markdown");
  await within(doc).findByRole("heading", { level: 1 });
  expect(doc.querySelector("script, [onerror], img")).toBeNull();
  for (const link of Array.from(doc.querySelectorAll("a")))
    expect(link.getAttribute("href") ?? "").not.toMatch(/^javascript:/i);
  // The facts stay beside the preview.
  expect(
    within(dialog).getByTestId("attachment-size").getAttribute("data-bytes"),
  ).toBe(String(new TextEncoder().encode(markdownFixture).length));
});

it("shows a workbook's sheets as tabs, each a table", async () => {
  const dialog = open("taulukko.xlsx", xlsxFixture());
  const tabs = await within(dialog).findAllByRole("tab");
  expect(tabs).toHaveLength(2);
  const table = within(dialog).getByTestId("attachment-sheet");
  expect(within(table).getAllByRole("row")).toHaveLength(5);
});

it("shows a deck as one entry per slide", async () => {
  // jsdom's object URLs do not take this realm's Blob.
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:slide");
  vi.spyOn(URL, "revokeObjectURL").mockReturnValue();
  const dialog = open("esitys.pptx", pptxFixture());
  expect(await within(dialog).findAllByTestId("attachment-slide")).toHaveLength(
    2,
  );
  expect(dialog.querySelector(".ah-attachment-slide-image")).not.toBeNull();
});

it("keeps the facts view for a type without a preview and for a broken document", async () => {
  const legacy = open("vanha.doc", docxFixture());
  await waitFor(() =>
    expect(
      within(legacy).getByTestId("attachment-size").hasAttribute("data-bytes"),
    ).toBe(true),
  );
  expect(within(legacy).queryByTestId("attachment-document")).toBeNull();
  cleanup();
  const broken = open("rikki.xlsx", Uint8Array.of(0x50, 0x4b, 0x03, 0x04, 1));
  await within(broken).findByTestId("attachment-preview-unavailable");
});

it("lays a Word document out as a self-contained page without active content", async () => {
  const page = await wordFrame(docxFixture());
  const doc = new DOMParser().parseFromString(page, "text/html");
  expect(doc.body.textContent).toContain("Synteettinen raportti");
  expect(
    doc
      .querySelector('meta[http-equiv="Content-Security-Policy"]')
      ?.getAttribute("content"),
  ).toBe(frameCSP);
  // The altChunk's foreign HTML is not rendered, and the link cannot run.
  expect(doc.body.textContent).not.toContain("altChunk");
  expect(doc.querySelector("script, iframe, [onerror]")).toBeNull();
  expect(page).not.toMatch(/javascript:/i);
});

it("reads a table's quoted separators, doubled quotes and line breaks as cell text", async () => {
  const { tableRows } = await import("./AttachmentPreview");
  expect(tableRows('a,"b,c",d\r\n"say ""hi""","x\ny",z\n', false)).toEqual([
    ["a", "b,c", "d"],
    ['say "hi"', "x\ny", "z"],
  ]);
  expect(tableRows("a\tb,c\n1\t2", true)).toEqual([
    ["a", "b,c"],
    ["1", "2"],
  ]);
  expect(tableRows("1\n2\n3\n", false, 2)).toHaveLength(2);
  // One very long row is cut at the column limit.
  expect(tableRows(",".repeat(100_000), false)[0]).toHaveLength(50);
});

it("splits a CSV at the separator its first row uses", async () => {
  const { tableRows } = await import("./AttachmentPreview");
  // A Finnish spreadsheet writes semicolons; its decimal commas stay in cells.
  expect(tableRows("päivä;käynnit\nma;1,5\n", false)).toEqual([
    ["päivä", "käynnit"],
    ["ma", "1,5"],
  ]);
  // A quoted separator does not count, and a tie keeps the comma.
  expect(tableRows('a,"b;c;d",e\n', false)).toEqual([["a", "b;c;d", "e"]]);
  expect(tableRows("a;b,c\n", false)).toEqual([["a;b", "c"]]);
  expect(tableRows("a\tb\n1\t2", false)).toEqual([
    ["a", "b"],
    ["1", "2"],
  ]);
});

it("reads the file once while the dialog stays open, however often its caller renders", async () => {
  const bytes = new TextEncoder().encode("a;b\n1;2\n");
  const read = vi.fn(async (_url: string, _signal: AbortSignal) => bytes);
  const preview = () => (
    <AttachmentPreview
      attachment={{ image: false, name: "luvut.csv", url, source: "" }}
      onClose={() => {}}
      // A new function on every render, as a caller's inline closure is.
      read={(u, signal) => read(u, signal)}
      offered={{
        item: { path: "luvut.csv", bytes: bytes.length, kind: "csv" },
        download: url,
      }}
    />
  );
  const { rerender } = render(preview());
  await screen.findByTestId("attachment-preview-table");
  rerender(preview());
  rerender(preview());
  expect(screen.getByTestId("attachment-preview-table")).toBeTruthy();
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(read).toHaveBeenCalledTimes(1);
});
