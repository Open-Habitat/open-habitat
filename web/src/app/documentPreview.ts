import { type Unzipped, unzipSync } from "fflate";
import { utf8 } from "./attachments";

const extension = (name: string) =>
  /\.([A-Za-z0-9]{1,8})$/.exec(name)?.[1].toLowerCase();

/**
 * An Office file is a zip whose parts are inflated in the tab. The declared
 * sizes bound that before anything is inflated; a file that lies about them
 * can only exhaust the person's own tab, which the browser contains.
 */
export const ooxmlLimit = 100 * 1024 * 1024;
const ooxmlEntries = 10_000;

/** Thrown when a document cannot be shown; the dialog keeps the facts view. */
export class PreviewUnavailable extends Error {}

/**
 * Refuses a zip whose declared contents are too large to inflate in the tab,
 * reading only its directory.
 */
export function zipWithinLimits(bytes: Uint8Array): void {
  let total = 0;
  let entries = 0;
  try {
    unzipSync(bytes, {
      filter(file) {
        total += file.originalSize;
        entries += 1;
        return false;
      },
    });
  } catch {
    throw new PreviewUnavailable("not a zip");
  }
  if (total > ooxmlLimit || entries > ooxmlEntries)
    throw new PreviewUnavailable("too large");
}

/** The parts of an Office zip that `wanted` accepts, within the limits. */
export function readZip(
  bytes: Uint8Array,
  wanted: (path: string) => boolean,
): Unzipped {
  zipWithinLimits(bytes);
  try {
    return unzipSync(bytes, { filter: (file) => wanted(file.name) });
  } catch {
    throw new PreviewUnavailable("not a zip");
  }
}

function xml(parts: Unzipped, path: string): Document | null {
  const data = parts[path];
  const text = data && utf8(data);
  if (!text) return null;
  const doc = new DOMParser().parseFromString(text, "application/xml");
  return doc.getElementsByTagName("parsererror").length ? null : doc;
}

/** Elements by local name, whatever prefix the producer chose. */
const all = (node: Document | Element, name: string) =>
  Array.from(node.getElementsByTagNameNS("*", name));

const child = (node: Element, name: string) =>
  Array.from(node.children).find((c) => c.localName === name);

const relationshipNS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** A package part's relationships, ids to resolved part paths. */
function relationships(parts: Unzipped, path: string): Map<string, string> {
  const slash = path.lastIndexOf("/");
  const folder = path.slice(0, slash + 1);
  const rels = xml(parts, `${folder}_rels/${path.slice(slash + 1)}.rels`);
  const map = new Map<string, string>();
  for (const rel of rels ? all(rels, "Relationship") : []) {
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    if (!id || !target || rel.getAttribute("TargetMode") === "External")
      continue;
    map.set(id, resolve(folder, target));
  }
  return map;
}

function resolve(folder: string, target: string): string {
  const segments = (target.startsWith("/") ? target.slice(1) : folder + target)
    .split("/")
    .filter(Boolean);
  const out: string[] = [];
  for (const segment of segments) {
    if (segment === "..") out.pop();
    else if (segment !== ".") out.push(segment);
  }
  return out.join("/");
}

const relId = (node: Element, name: string) =>
  node.getAttributeNS(relationshipNS, name) ??
  // Some producers write the prefixed name without declaring it.
  node.getAttribute(`r:${name}`);

/* ----------------------------------------------------------------- xlsx */

export type Sheet = {
  name: string;
  /** Rows as shown, each padded to `columns`. */
  rows: string[][];
  columns: number;
  /** The sheet had more rows or columns than the preview shows. */
  truncated: boolean;
};

export const sheetRows = 1000;
export const sheetColumns = 50;

/** Excel's built-in number formats that are dates or times. */
const dateFormats = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57,
]);

function isDateFormat(code: string): boolean {
  // Quoted text, escapes and [Red]/[$-409] sections are not date tokens.
  const bare = code.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, "");
  return /[dmyhs]/i.test(bare) && !/^General$/i.test(bare);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A serial day number in the workbook's epoch as `YYYY-MM-DD[ hh:mm]`. */
export function excelDate(serial: number, date1904: boolean): string {
  // 1900 system: day 60 is the non-existent 1900-02-29 Excel keeps for Lotus.
  const days = date1904 ? serial + 1462 : serial < 60 ? serial + 1 : serial;
  const ms = Math.round((days - 25569) * 86400 * 1000);
  const at = new Date(ms);
  if (Number.isNaN(at.getTime())) return String(serial);
  const date = `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
  const time = at.getUTCHours() || at.getUTCMinutes() || at.getUTCSeconds();
  if (serial < 1 && serial >= 0)
    return `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`;
  return time
    ? `${date} ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`
    : date;
}

/** `B12` as zero-based column and row. */
export function cellRef(ref: string): { column: number; row: number } | null {
  const match = /^([A-Z]{1,3})([0-9]{1,7})$/.exec(ref);
  if (!match) return null;
  let column = 0;
  for (const letter of match[1])
    column = column * 26 + letter.charCodeAt(0) - 64;
  return { column: column - 1, row: Number(match[2]) - 1 };
}

export function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

/** Text of a string item, without phonetic runs. */
function stringItem(item: Element): string {
  return all(item, "t")
    .filter((t) => t.parentElement?.localName !== "rPh")
    .map((t) => t.textContent ?? "")
    .join("");
}

/** The visible sheets of a workbook with each cell's stored value as text. */
export function readWorkbook(bytes: Uint8Array): Sheet[] {
  const parts = readZip(bytes, (path) => /^xl\/.*\.(xml|rels)$/.test(path));
  const workbook = xml(parts, "xl/workbook.xml");
  if (!workbook) throw new PreviewUnavailable("no workbook");
  const date1904 = all(workbook, "workbookPr").some((p) =>
    /^(1|true)$/.test(p.getAttribute("date1904") ?? ""),
  );
  const rels = relationships(parts, "xl/workbook.xml");
  const shared = xml(parts, "xl/sharedStrings.xml");
  const strings = shared ? all(shared, "si").map(stringItem) : [];
  const styles = xml(parts, "xl/styles.xml");
  const custom = new Map(
    (styles ? all(styles, "numFmt") : []).map((f) => [
      Number(f.getAttribute("numFmtId")),
      f.getAttribute("formatCode") ?? "",
    ]),
  );
  const xfs = styles ? all(styles, "cellXfs").at(0) : undefined;
  const dateStyle = (xfs ? Array.from(xfs.children) : []).map((xf) => {
    const id = Number(xf.getAttribute("numFmtId") ?? 0);
    const code = custom.get(id);
    return code === undefined ? dateFormats.has(id) : isDateFormat(code);
  });

  const sheets: Sheet[] = [];
  for (const entry of all(workbook, "sheet")) {
    const state = entry.getAttribute("state");
    if (state === "hidden" || state === "veryHidden") continue;
    const path = rels.get(relId(entry, "id") ?? "");
    const doc = path ? xml(parts, path) : null;
    if (!doc) continue;
    const grid: string[][] = [];
    let columns = 0;
    let truncated = false;
    let nextRow = 0;
    for (const row of all(doc, "row")) {
      const r = Number(row.getAttribute("r") ?? nextRow + 1) - 1;
      nextRow = r + 1;
      let nextColumn = 0;
      for (const cell of Array.from(row.children)) {
        if (cell.localName !== "c") continue;
        const at = cellRef(cell.getAttribute("r") ?? "") ?? {
          row: r,
          column: nextColumn,
        };
        nextColumn = at.column + 1;
        const text = cellText(cell, strings, dateStyle, date1904);
        if (text === "") continue;
        if (at.row >= sheetRows || at.column >= sheetColumns) {
          truncated = true;
          continue;
        }
        grid[at.row] ??= [];
        grid[at.row][at.column] = text;
        columns = Math.max(columns, at.column + 1);
      }
    }
    const rows = Array.from(grid, (row) =>
      Array.from({ length: columns }, (_, i) => row?.[i] ?? ""),
    );
    sheets.push({
      name: entry.getAttribute("name") ?? "",
      rows,
      columns,
      truncated,
    });
  }
  return sheets;
}

function cellText(
  cell: Element,
  strings: string[],
  dateStyle: boolean[],
  date1904: boolean,
): string {
  const type = cell.getAttribute("t") ?? "n";
  if (type === "inlineStr") {
    const is = child(cell, "is");
    return is ? stringItem(is) : "";
  }
  const value = child(cell, "v")?.textContent ?? "";
  if (value === "") return "";
  switch (type) {
    case "s":
      return strings[Number(value)] ?? "";
    case "b":
      return value === "1" ? "TRUE" : "FALSE";
    case "str":
    case "e":
      return value;
    default: {
      const number = Number(value);
      if (!Number.isFinite(number)) return value;
      if (dateStyle[Number(cell.getAttribute("s") ?? 0)])
        return excelDate(number, date1904);
      return String(number);
    }
  }
}

/* ----------------------------------------------------------------- pptx */

export type SlideBlock =
  | { kind: "text"; paragraphs: { level: number; text: string }[] }
  | { kind: "table"; rows: string[][] }
  | { kind: "image"; type: string; bytes: Uint8Array };

export type Slide = { title: string; blocks: SlideBlock[] };

const imageTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

function paragraphs(body: Element) {
  return Array.from(body.children)
    .filter((p) => p.localName === "p")
    .map((p) => ({
      level: Number(child(p, "pPr")?.getAttribute("lvl") ?? 0) || 0,
      text: Array.from(p.children)
        .map((run) =>
          run.localName === "br"
            ? "\n"
            : run.localName === "r" || run.localName === "fld"
              ? (child(run, "t")?.textContent ?? "")
              : "",
        )
        .join(""),
    }))
    .filter((p) => p.text.trim() !== "");
}

/**
 * Each slide's text, tables and pictures in reading order. Layout, theme and
 * charts are not reproduced: no small permissive renderer draws slides, so
 * the preview is the outline a reader needs to recognise the deck.
 */
export function readPresentation(bytes: Uint8Array): Slide[] {
  const parts = readZip(bytes, (path) => path.startsWith("ppt/"));
  const presentation = xml(parts, "ppt/presentation.xml");
  if (!presentation) throw new PreviewUnavailable("no presentation");
  const rels = relationships(parts, "ppt/presentation.xml");
  const slides: Slide[] = [];
  for (const id of all(presentation, "sldId")) {
    const path = rels.get(relId(id, "id") ?? "");
    const doc = path ? xml(parts, path) : null;
    if (!path || !doc) continue;
    const slideRels = relationships(parts, path);
    const slide: Slide = { title: "", blocks: [] };
    const tree = all(doc, "spTree").at(0);
    if (tree) walk(tree, slide, slideRels, parts);
    slides.push(slide);
  }
  return slides;
}

function walk(
  node: Element,
  slide: Slide,
  rels: Map<string, string>,
  parts: Unzipped,
) {
  for (const shape of Array.from(node.children)) {
    switch (shape.localName) {
      case "grpSp":
        walk(shape, slide, rels, parts);
        break;
      case "sp": {
        const body = child(shape, "txBody");
        if (!body) break;
        const text = paragraphs(body);
        if (!text.length) break;
        const type = all(shape, "ph").at(0)?.getAttribute("type");
        if (!slide.title && (type === "title" || type === "ctrTitle"))
          slide.title = text.map((p) => p.text).join(" ");
        else slide.blocks.push({ kind: "text", paragraphs: text });
        break;
      }
      case "graphicFrame":
        for (const table of all(shape, "tbl"))
          slide.blocks.push({
            kind: "table",
            rows: all(table, "tr").map((tr) =>
              all(tr, "tc").map((tc) => {
                const body = child(tc, "txBody");
                return body
                  ? paragraphs(body)
                      .map((p) => p.text)
                      .join("\n")
                  : "";
              }),
            ),
          });
        break;
      case "pic": {
        const blip = all(shape, "blip").at(0);
        const path = blip && rels.get(relId(blip, "embed") ?? "");
        const type = path && imageTypes[extension(path) ?? ""];
        const data = path && parts[path];
        if (type && data)
          slide.blocks.push({ kind: "image", type, bytes: data });
        break;
      }
    }
  }
}

/* ----------------------------------------------------------------- docx */

/** Elements that could load, navigate or run something; never kept. */
const activeElements =
  "script, iframe, frame, frameset, object, embed, applet, link, meta, base, form, input, button, textarea, select, portal, noscript, template";

/**
 * Removes active content from a rendered document so the sandboxed frame
 * only has to stop what slips through, not everything a document can carry:
 * no event handlers, and only same-document or `data:` image references.
 */
export function inertMarkup(root: Element): void {
  for (const element of Array.from(root.querySelectorAll(activeElements)))
    element.remove();
  for (const element of [root, ...Array.from(root.querySelectorAll("*"))])
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (
        name.startsWith("on") ||
        name === "srcset" ||
        name === "formaction" ||
        name === "srcdoc" ||
        ((name === "href" || name === "xlink:href") &&
          !value.startsWith("#") &&
          !/^data:image\/(png|jpeg|gif|webp|bmp);/i.test(value)) ||
        (name === "src" &&
          !/^data:image\/(png|jpeg|gif|webp|bmp);/i.test(value))
      )
        element.removeAttribute(attribute.name);
    }
}

/**
 * The policy of a previewed document's frame. The frame's sandbox already
 * withholds scripts and the app's origin; this also keeps it from fetching
 * anything, so opening a document never tells anyone it was opened.
 */
export const frameCSP =
  "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'";
