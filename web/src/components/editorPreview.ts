import { splitFrontmatter } from "./frontmatter";
import type { IconName } from "./Icon";

/** What the full-view preview of an open text file is. JSON, YAML and code
 * have none: folding already shows their structure. */
export type FileView = {
  kind: "markdown" | "table" | "image" | "page";
  icon: IconName;
};
const views: [RegExp, FileView][] = [
  [/\.(md|markdown)$/i, { kind: "markdown", icon: "eye" }],
  [/\.(csv|tsv)$/i, { kind: "table", icon: "table" }],
  [/\.svg$/i, { kind: "image", icon: "image" }],
  [/\.html?$/i, { kind: "page", icon: "eye" }],
];
export const fileView = (path?: string): FileView | undefined =>
  path ? views.find(([pattern]) => pattern.test(path))?.[1] : undefined;

/** The 0-based lines of a Markdown text's ATX headings outside fences and
 * frontmatter, in the order the rendered document shows them. */
export function headingLines(text: string): number[] {
  const out: number[] = [];
  let fence: string | undefined;
  const skip = splitFrontmatter(text).frontmatter?.lines ?? 0;
  text.split("\n").forEach((line, n) => {
    if (n < skip) return;
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker?.[0] === fence[0] && marker.length >= fence.length)
        fence = undefined;
    } else if (marker) fence = marker;
    else if (/^ {0,3}#{1,6}(\s|$)/.test(line)) out.push(n);
  });
  return out;
}

/** Where a text line is in a rendered document, as a height: the section
 * between two headings maps proportionally onto the space between them.
 * `heights` are the rendered headings' tops in order, `total` the rendered
 * height. When the two disagree on the heading count, the whole document
 * maps proportionally. */
export function lineToHeight(
  line: number,
  lines: number,
  headings: number[],
  heights: number[],
  total: number,
): number {
  const [hs, ys] =
    headings.length === heights.length ? [headings, heights] : [[], []];
  const k = hs.findLastIndex((h) => h <= line);
  const [a, b] = [k < 0 ? 0 : hs[k], hs[k + 1] ?? lines];
  const [ya, yb] = [k < 0 ? 0 : ys[k], ys[k + 1] ?? total];
  return ya + ((line - a) / Math.max(1, b - a)) * (yb - ya);
}

/** The inverse: which text line a rendered height shows. */
export function heightToLine(
  y: number,
  lines: number,
  headings: number[],
  heights: number[],
  total: number,
): number {
  const [hs, ys] =
    headings.length === heights.length ? [headings, heights] : [[], []];
  const k = ys.findLastIndex((h) => h <= y);
  const [a, b] = [k < 0 ? 0 : hs[k], hs[k + 1] ?? lines];
  const [ya, yb] = [k < 0 ? 0 : ys[k], ys[k + 1] ?? total];
  // A hair over the floor, so a line's own height maps back to it.
  return Math.floor(a + ((y - ya) / Math.max(1, yb - ya)) * (b - a) + 1e-6);
}
