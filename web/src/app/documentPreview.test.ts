import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { markdownLimit, previewKind } from "./attachments";
import {
  docxFixture,
  markdownFixture,
  pdfFixture,
  pptxFixture,
  xlsxFixture,
} from "./documentFixtures";
import {
  excelDate,
  inertMarkup,
  ooxmlLimit,
  PreviewUnavailable,
  readPresentation,
  readWorkbook,
  readZip,
  sheetColumns,
  sheetRows,
} from "./documentPreview";

const text = (value: string) => new TextEncoder().encode(value);

describe("previewKind", () => {
  it("needs the name and the bytes to agree", () => {
    expect(previewKind("raportti.PDF", pdfFixture())).toBe("pdf");
    expect(previewKind("raportti.docx", docxFixture())).toBe("docx");
    // A renamed file keeps the facts view instead of reaching another parser.
    expect(previewKind("raportti.pdf", docxFixture())).toBeNull();
    expect(previewKind("taulukko.xlsx", pdfFixture())).toBeNull();
    expect(previewKind("vanha.doc", docxFixture())).toBeNull();
    expect(previewKind("pdf", pdfFixture())).toBeNull();
  });

  it("takes Markdown only as UTF-8 text within the limit", () => {
    expect(previewKind("muistio.md", text(markdownFixture))).toBe("markdown");
    expect(previewKind("muistio.md", Uint8Array.of(0xff, 0xfe, 0x41))).toBe(
      null,
    );
    expect(
      previewKind("muistio.md", new Uint8Array(markdownLimit + 1).fill(0x61)),
    ).toBeNull();
  });
});

describe("readZip", () => {
  it("refuses an archive whose declared contents exceed the limit before inflating it", () => {
    const zip = zipSync(
      { "xl/workbook.xml": new Uint8Array(ooxmlLimit + 1) },
      { level: 1 },
    );
    expect(zip.length).toBeLessThan(1024 * 1024);
    expect(() => readZip(zip, () => true)).toThrow(PreviewUnavailable);
  });

  it("refuses bytes that are not a zip", () => {
    expect(() => readZip(text("PK\x03\x04 not really"), () => true)).toThrow(
      PreviewUnavailable,
    );
  });
});

describe("readWorkbook", () => {
  it("shows visible sheets with each cell's value where it stands", () => {
    const sheets = readWorkbook(xlsxFixture());
    expect(sheets.map((s) => s.name)).toEqual(["Mittaukset", "Yhteenveto"]);
    expect(sheets[0].rows).toEqual([
      ["Päivä", "Lämpötila", "", "Huom"],
      ["2026-10-24", "21.5", "TRUE", "ok"],
      ["", "", "", ""],
      ["2026-10-25 12:00", "", "", ""],
    ]);
    expect(sheets[0].truncated).toBe(false);
    // A target given from the package root resolves like a relative one.
    expect(sheets[1].rows).toEqual([["Keskiarvo", "21.5"]]);
  });

  it("bounds the grid and says it left cells out", () => {
    const sheets = readWorkbook(
      xlsxFixture({
        extraRows: `<row r="5"><c r="${"BA"}5" t="inlineStr"><is><t>kaukana</t></is></c></row><row r="${sheetRows + 1}"><c r="A${sheetRows + 1}"><v>1</v></c></row>`,
      }),
    );
    expect(sheetColumns).toBeLessThan(53); // BA is column 53
    expect(sheets[0].truncated).toBe(true);
    expect(sheets[0].rows).toHaveLength(4);
    expect(sheets[0].columns).toBe(4);
  });
});

describe("excelDate", () => {
  it("follows the 1900 system's phantom leap day and the 1904 system", () => {
    expect(excelDate(59, false)).toBe("1900-02-28");
    expect(excelDate(61, false)).toBe("1900-03-01");
    expect(excelDate(1, true)).toBe("1904-01-02");
    expect(excelDate(0.75, false)).toBe("18:00");
  });
});

describe("readPresentation", () => {
  it("lists slides in deck order with titles, levels, tables and embedded pictures", () => {
    const slides = readPresentation(pptxFixture());
    expect(slides).toHaveLength(2);
    expect(slides[0].title).toBe("Kvartaali");
    expect(slides[0].blocks).toEqual([
      {
        kind: "text",
        paragraphs: [
          { level: 0, text: "Myynti kasvoi" },
          { level: 1, text: "erityisesti pohjoisessa" },
          { level: 0, text: "rivi\nvaihto" },
        ],
      },
    ]);
    expect(slides[1].blocks.map((b) => b.kind)).toEqual(["table", "image"]);
    expect(slides[1].blocks[0]).toEqual({
      kind: "table",
      rows: [
        ["Alue", "Määrä"],
        ["Pohjoinen", "42"],
      ],
    });
    // The external picture reference is never followed.
    expect(slides[1].blocks[1]).toMatchObject({ type: "image/png" });
  });
});

describe("inertMarkup", () => {
  it("keeps layout and inline pictures and drops everything that runs or loads", () => {
    const root = document.createElement("div");
    root.innerHTML = [
      '<style>p { color: red }</style><p style="margin: 0" onclick="x()">teksti</p>',
      '<a href="javascript:alert(1)">a</a><a href="#n1">b</a><a href="https://example.org">c</a>',
      '<img src="data:image/png;base64,AAAA"><img src="https://example.org/t.png"><img src="data:text/html,x">',
      '<svg><image href="javascript:x"></image><a xlink:href="javascript:x"></a></svg>',
      "<script>x()</script><iframe srcdoc='x'></iframe><object></object><form><input></form><meta http-equiv=refresh content=0><base href=x>",
    ].join("");
    inertMarkup(root);
    expect(root.querySelector("style")?.textContent).toBe("p { color: red }");
    expect(root.querySelector("p")?.getAttribute("style")).toBe("margin: 0");
    expect(root.querySelector("p")?.hasAttribute("onclick")).toBe(false);
    expect(
      Array.from(root.querySelectorAll("a"), (a) => a.getAttribute("href")),
    ).toEqual([null, "#n1", null, null]);
    expect(
      Array.from(root.querySelectorAll("img"), (i) => i.getAttribute("src")),
    ).toEqual(["data:image/png;base64,AAAA", null, null]);
    expect(root.querySelector("image")?.hasAttribute("href")).toBe(false);
    expect(
      root.querySelector("script, iframe, object, form, input, meta, base"),
    ).toBeNull();
  });
});
