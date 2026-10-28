import { describe, expect, it } from "vitest";
import { frameCSP } from "../app/documentPreview";
import { inertPage } from "./EditorFilePreview";
import {
  fileView,
  headingLines,
  heightToLine,
  lineToHeight,
} from "./editorPreview";

it("gives a preview to Markdown, tables, SVG and HTML, not to data or code", () => {
  expect(
    ["a.md", "b.MARKDOWN", "c.csv", "d.tsv", "e.svg", "f.html", "g.htm"].map(
      (path) => fileView(path)?.kind,
    ),
  ).toEqual([
    "markdown",
    "markdown",
    "table",
    "table",
    "image",
    "page",
    "page",
  ]);
  for (const path of ["a.json", "b.yaml", "c.go", "d.txt", "csv", undefined])
    expect(fileView(path)).toBeUndefined();
});

describe("same place in text and preview", () => {
  const text = [
    "Johdanto", // 0
    "```",
    "# not a heading in a fence",
    "```",
    "# Yksi", // 4
    "a",
    "  ## Kaksi", // 6
    "b",
    "~~~~",
    "## not either",
    "~~~", // a shorter fence does not close it
    "~~~~",
    "### Kolme", // 12
    "#hashtag",
  ].join("\n");
  it("finds the headings the rendered document shows", () => {
    expect(headingLines(text)).toEqual([4, 6, 12]);
  });
  const lines = text.split("\n").length;
  const headings = headingLines(text);
  const heights = [100, 300, 700];
  it("maps a line inside a section proportionally between its headings", () => {
    expect(lineToHeight(4, lines, headings, heights, 1000)).toBe(100);
    expect(lineToHeight(5, lines, headings, heights, 1000)).toBe(200);
    expect(lineToHeight(2, lines, headings, heights, 1000)).toBe(50);
    expect(lineToHeight(13, lines, headings, heights, 1000)).toBe(850);
  });
  it("returns to the line it came from", () => {
    for (let line = 0; line < lines; line++)
      expect(
        heightToLine(
          lineToHeight(line, lines, headings, heights, 1000),
          lines,
          headings,
          heights,
          1000,
        ),
      ).toBe(line);
  });
  it("falls back to the whole document when the headings disagree", () => {
    expect(lineToHeight(7, lines, headings, [10], 1400)).toBe(700);
    expect(heightToLine(700, lines, headings, [10], 1400)).toBe(7);
  });
});

it("makes an HTML file an inert page that fetches nothing", () => {
  const page = inertPage(
    `<html><head><title>t</title><meta http-equiv="refresh" content="0;url=https://example.test/"><link rel="stylesheet" href="https://example.test/a.css"><base href="https://example.test/"><style>h1{color:teal}</style></head>
<body onload="steal()"><h1>Kutsu</h1><script>steal()</script><img src="kuva.png" onerror="steal()"><a href="https://example.test/">linkki</a><a href="#alku">alku</a><form action="https://example.test/"><input name="x"></form><iframe src="https://example.test/"></iframe><svg><a href="javascript:steal()"><text>x</text></a></svg></body></html>`,
  );
  const doc = new DOMParser().parseFromString(page, "text/html");
  const policies = doc.querySelectorAll(
    'meta[http-equiv="Content-Security-Policy"]',
  );
  expect(policies).toHaveLength(1);
  expect(policies[0].getAttribute("content")).toBe(frameCSP);
  expect(doc.querySelector('meta[http-equiv="refresh"]')).toBeNull();
  expect(
    doc.querySelector("script, link, base, form, input, iframe, title"),
  ).toBeNull();
  expect(doc.querySelector("[onload], [onerror]")).toBeNull();
  expect(doc.querySelector("img")?.hasAttribute("src")).toBe(false);
  const hrefs = Array.from(doc.querySelectorAll("a"), (a) =>
    a.getAttribute("href"),
  );
  expect(hrefs).toEqual([null, "#alku", null]);
  // The page's own content and styles stay.
  expect(doc.querySelector("h1")?.textContent).toBe("Kutsu");
  expect(doc.querySelector("style:last-of-type")?.textContent).toContain(
    "teal",
  );
});
