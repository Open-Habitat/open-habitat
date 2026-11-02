import { strToU8, zipSync } from "fflate";

// Synthetic documents for unit tests, stories and browser specs. Each one is
// built here rather than committed as a binary so a reader sees exactly what
// it contains, including the active content the preview must not run.

/**
 * A TrueType font of two glyphs, `.notdef` and a filled square, with only
 * the tables a PDF reader needs; a reader fills in the rest (`cmap`, `name`,
 * `OS/2`, `post`) as it does for the subset fonts a typesetter embeds.
 */
function squareFont(): Uint8Array {
  const u16 = (...values: number[]) =>
    values.flatMap((v) => [(v >> 8) & 0xff, v & 0xff]);
  const u32 = (v: number) => [...u16(v >>> 16), ...u16(v & 0xffff)];
  // One contour, clockwise, from (100, 100) to (900, 900), as deltas.
  const square = [
    ...u16(1, 100, 100, 900, 900, 3, 0),
    1,
    1,
    1,
    1,
    ...u16(100, 0, 800, 0, 100, 800, 0, -800),
    0,
    0,
  ];
  const tables: [string, number[]][] = [
    ["glyf", square],
    [
      "head",
      [
        ...u32(0x10000),
        ...u32(0x10000),
        ...u32(0),
        ...u32(0x5f0f3cf5),
        ...u16(0x000b, 1000),
        ...new Array(16).fill(0),
        ...u16(0, 0, 1000, 1000, 0, 8, 2, 0, 0),
      ],
    ],
    [
      "hhea",
      [
        ...u32(0x10000),
        ...u16(1000, 0, 0, 1000, 0, 0, 1000, 1, 0, 0),
        ...u16(0, 0, 0, 0, 0, 2),
      ],
    ],
    ["hmtx", u16(1000, 0, 1000, 100)],
    ["loca", u16(0, 0, square.length / 2)],
    [
      "maxp",
      [...u32(0x10000), ...u16(2, 4, 1, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0)],
    ],
  ];
  const header = [...u32(0x10000), ...u16(tables.length, 64, 2, 32)];
  const records: number[] = [];
  const data: number[] = [];
  let offset = header.length + tables.length * 16;
  for (const [tag, bytes] of tables) {
    const padded = [
      ...bytes,
      ...new Array((4 - (bytes.length % 4)) % 4).fill(0),
    ];
    let sum = 0;
    for (let i = 0; i < padded.length; i += 4)
      sum =
        (sum +
          ((padded[i] << 24) |
            (padded[i + 1] << 16) |
            (padded[i + 2] << 8) |
            padded[i + 3])) >>>
        0;
    records.push(
      ...[...tag].map((c) => c.charCodeAt(0)),
      ...u32(sum),
      ...u32(offset),
      ...u32(bytes.length),
    );
    data.push(...padded);
    offset += padded.length;
  }
  return Uint8Array.from([...header, ...records, ...data]);
}

/**
 * A text PDF; with `script`, it also asks a viewer to run JavaScript on open.
 * With `embeddedFont`, each page also draws a row of squares in a TrueType
 * font embedded the way typesetters such as Typst do (a Type0 font over a
 * CIDFontType2 with `FontFile2`), which a reader has to rebuild before use.
 */
export function pdfFixture({
  pages = ["Synteettinen PDF"],
  script,
  embeddedFont = false,
}: {
  pages?: string[];
  script?: string;
  embeddedFont?: boolean;
} = {}): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body) + 1; // 1 is the catalog
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let squares = 0;
  if (embeddedFont) {
    // Bytes above 0x7f stay single characters; the file is written in Latin-1.
    const file = String.fromCharCode(...squareFont());
    const fontFile = add(
      `<< /Length ${file.length} /Length1 ${file.length} >>\nstream\n${file}\nendstream`,
    );
    const name = "/SQUARE+Synteettinen";
    const descriptor = add(
      `<< /Type /FontDescriptor /FontName ${name} /Flags 4 /FontBBox [0 0 1000 1000] /ItalicAngle 0 /Ascent 1000 /Descent 0 /CapHeight 1000 /StemV 80 /FontFile2 ${fontFile} 0 R >>`,
    );
    const cidFont = add(
      `<< /Type /Font /Subtype /CIDFontType2 /BaseFont ${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /DW 1000 /CIDToGIDMap /Identity >>`,
    );
    squares = add(
      `<< /Type /Font /Subtype /Type0 /BaseFont ${name} /Encoding /Identity-H /DescendantFonts [${cidFont} 0 R] >>`,
    );
  }
  const action = script
    ? add(`<< /Type /Action /S /JavaScript /JS (${script}) >>`)
    : 0;
  const pageTree = objects.length + 2 + pages.length * 2;
  const kids = pages.map((text) => {
    const stream = `BT /F1 36 Tf 72 720 Td (${text}) Tj ET${squares ? " BT /F2 72 Tf 72 560 Td <00010001000100010001> Tj ET" : ""}`;
    const content = add(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
    return add(
      `<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R${squares ? ` /F2 ${squares} 0 R` : ""} >> >> /Contents ${content} 0 R${script ? ` /AA << /O ${action} 0 R >>` : ""} >>`,
    );
  });
  add(
    `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`,
  );
  const catalog = `<< /Type /Catalog /Pages ${pageTree} 0 R${script ? ` /OpenAction ${action} 0 R /Names << /JavaScript << /Names [(open) ${action} 0 R] >> >>` : ""} >>`;
  let out = "%PDF-1.7\n";
  const offsets: number[] = [];
  [catalog, ...objects].forEach((body, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets)
    out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Offsets count characters, so each character is one byte.
  return Uint8Array.from(out, (c) => c.charCodeAt(0));
}

const relationships = (rels: [string, string, string, string?][]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels
    .map(
      ([id, type, target, mode]) =>
        `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"${mode ? ` TargetMode="${mode}"` : ""}/>`,
    )
    .join("")}</Relationships>`;

const contentTypes = (overrides: [string, string][]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="html" ContentType="text/html"/>${overrides
    .map(
      ([part, type]) => `<Override PartName="${part}" ContentType="${type}"/>`,
    )
    .join("")}</Types>`;

/** A 1×1 PNG. */
export const pixelPNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYioAAAAASUVORK5CYII=",
  ),
  (c) => c.charCodeAt(0),
);

const w =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/**
 * A Word document with a heading and a paragraph. It also carries what a
 * hostile document could: a `javascript:` hyperlink and an altChunk, foreign
 * HTML with a script that a renderer would place in a same-origin frame.
 */
export function docxFixture({
  heading = "Synteettinen raportti",
  paragraph = "Tämä kappale on Word-asiakirjan leipätekstiä.",
}: {
  heading?: string;
  paragraph?: string;
} = {}): Uint8Array {
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${w}><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${heading}</w:t></w:r></w:p><w:p><w:r><w:t>${paragraph}</w:t></w:r></w:p><w:p><w:hyperlink r:id="rLink"><w:r><w:t>Linkki</w:t></w:r></w:hyperlink></w:p><w:altChunk r:id="rChunk"/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${w}><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style></w:styles>`;
  return zipSync({
    "[Content_Types].xml": strToU8(
      contentTypes([
        [
          "/word/document.xml",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
        ],
        [
          "/word/styles.xml",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml",
        ],
      ]),
    ),
    "_rels/.rels": strToU8(
      relationships([["rId1", "officeDocument", "word/document.xml"]]),
    ),
    "word/document.xml": strToU8(document),
    "word/styles.xml": strToU8(styles),
    "word/_rels/document.xml.rels": strToU8(
      relationships([
        ["rStyles", "styles", "styles.xml"],
        [
          "rLink",
          "hyperlink",
          "javascript:parent.__previewRan=1;alert(1)",
          "External",
        ],
        ["rChunk", "aFChunk", "chunk.html"],
      ]),
    ),
    "word/chunk.html": strToU8(
      '<html><body><p>altChunk</p><script>parent.__previewRan=1;alert(1)</script><img src=x onerror="parent.__previewRan=1"></body></html>',
    ),
  });
}

const s =
  'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/**
 * A workbook with two visible sheets and a hidden one. The first sheet has a
 * shared string, an inline string, a number, a date-formatted number, a
 * boolean, a formula's cached text and a gap column.
 */
export function xlsxFixture({
  extraRows = "",
}: {
  /** More `<row>` elements for the first sheet. */
  extraRows?: string;
} = {}): Uint8Array {
  const sheet = (rows: string) =>
    strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${s}><sheetData>${rows}</sheetData></worksheet>`,
    );
  return zipSync({
    "[Content_Types].xml": strToU8(
      contentTypes([
        [
          "/xl/workbook.xml",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
        ],
      ]),
    ),
    "_rels/.rels": strToU8(
      relationships([["rId1", "officeDocument", "xl/workbook.xml"]]),
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${s}><sheets><sheet name="Mittaukset" sheetId="1" r:id="rId1"/><sheet name="Piilo" sheetId="2" state="hidden" r:id="rId2"/><sheet name="Yhteenveto" sheetId="3" r:id="rId3"/></sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      relationships([
        ["rId1", "worksheet", "worksheets/sheet1.xml"],
        ["rId2", "worksheet", "worksheets/sheet2.xml"],
        ["rId3", "worksheet", "/xl/worksheets/sheet3.xml"],
        ["rId4", "sharedStrings", "sharedStrings.xml"],
        ["rId5", "styles", "styles.xml"],
      ]),
    ),
    "xl/sharedStrings.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst ${s}><si><t>Päivä</t></si><si><r><t>Läm</t></r><r><t>pötila</t></r><rPh><t>x</t></rPh></si></sst>`,
    ),
    "xl/styles.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet ${s}><numFmts count="1"><numFmt numFmtId="164" formatCode="d.m.yyyy"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="14"/></cellXfs></styleSheet>`,
    ),
    "xl/worksheets/sheet1.xml": sheet(
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="inlineStr"><is><t>Huom</t></is></c></row>' +
        '<row r="2"><c r="A2" s="1"><v>46319</v></c><c r="B2"><v>21.5</v></c><c r="C2" t="b"><v>1</v></c><c r="D2" t="str"><f>CONCAT("o","k")</f><v>ok</v></c></row>' +
        '<row r="4"><c r="A4" s="2"><v>46320.5</v></c></row>' +
        extraRows,
    ),
    "xl/worksheets/sheet2.xml": sheet(
      '<row r="1"><c r="A1" t="inlineStr"><is><t>salainen</t></is></c></row>',
    ),
    "xl/worksheets/sheet3.xml": sheet(
      '<row r="1"><c r="A1" t="inlineStr"><is><t>Keskiarvo</t></is></c><c r="B1"><v>21.5</v></c></row>',
    ),
  });
}

const p =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

/** A deck of two slides: a title with indented bullets, then a table and a picture. */
export function pptxFixture(): Uint8Array {
  const slide = (tree: string) =>
    strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${p}><p:cSld><p:spTree>${tree}</p:spTree></p:cSld></p:sld>`,
    );
  const shape = (placeholder: string, paragraphs: string) =>
    `<p:sp><p:nvSpPr><p:cNvPr id="2" name="s"/><p:cNvSpPr/><p:nvPr>${placeholder}</p:nvPr></p:nvSpPr><p:txBody>${paragraphs}</p:txBody></p:sp>`;
  return zipSync({
    "[Content_Types].xml": strToU8(
      contentTypes([
        [
          "/ppt/presentation.xml",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
        ],
      ]),
    ),
    "_rels/.rels": strToU8(
      relationships([["rId1", "officeDocument", "ppt/presentation.xml"]]),
    ),
    "ppt/presentation.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation ${p}><p:sldIdLst><p:sldId id="257" r:id="rId3"/><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>`,
    ),
    "ppt/_rels/presentation.xml.rels": strToU8(
      relationships([
        ["rId2", "slide", "slides/slide2.xml"],
        ["rId3", "slide", "slides/slide1.xml"],
      ]),
    ),
    "ppt/slides/slide1.xml": slide(
      shape(
        '<p:ph type="title"/>',
        "<a:p><a:r><a:t>Kvartaali</a:t></a:r></a:p>",
      ) +
        shape(
          '<p:ph idx="1"/>',
          '<a:p><a:r><a:t>Myynti kasvoi</a:t></a:r></a:p><a:p><a:pPr lvl="1"/><a:r><a:t>erityisesti </a:t></a:r><a:r><a:t>pohjoisessa</a:t></a:r></a:p><a:p><a:r><a:t>rivi</a:t></a:r><a:br/><a:r><a:t>vaihto</a:t></a:r></a:p>',
        ),
    ),
    "ppt/slides/slide2.xml": slide(
      `<p:graphicFrame><a:graphic><a:graphicData><a:tbl><a:tr><a:tc><a:txBody><a:p><a:r><a:t>Alue</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>Määrä</a:t></a:r></a:p></a:txBody></a:tc></a:tr><a:tr><a:tc><a:txBody><a:p><a:r><a:t>Pohjoinen</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>42</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>` +
        '<p:pic><p:blipFill><a:blip r:embed="rImg"/></p:blipFill></p:pic>' +
        '<p:pic><p:blipFill><a:blip r:embed="rRemote"/></p:blipFill></p:pic>',
    ),
    "ppt/slides/_rels/slide2.xml.rels": strToU8(
      relationships([
        ["rImg", "image", "../media/image1.png"],
        ["rRemote", "image", "https://example.invalid/track.png", "External"],
      ]),
    ),
    "ppt/media/image1.png": pixelPNG,
  });
}

/** Markdown whose embedded HTML, handlers and script link must stay inert. */
export const markdownFixture = [
  "# Muistio",
  "",
  "Tavallista **lihavoitua** tekstiä ja [linkki](https://example.org).",
  "",
  "- yksi",
  "- kaksi",
  "",
  "<script>window.__previewRan = 1; alert(1)</script>",
  '<img src="x" onerror="window.__previewRan = 1">',
  "[skripti](javascript:window.__previewRan=1)",
  "![seuranta](https://example.invalid/pixel.png)",
].join("\n");
