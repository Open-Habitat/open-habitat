import { describe, expect, it } from "vitest";
import { headingLines } from "./editorPreview";
import { splitFrontmatter } from "./frontmatter";

describe("splitFrontmatter", () => {
  it.each([
    "# Title\nBody",
    "Intro\n---\nname: x\n---",
    " ---\nname: x\n---",
    "---\nText",
  ])("leaves non-frontmatter untouched: %s", (text) => {
    expect(splitFrontmatter(text)).toEqual({ frontmatter: null, body: text });
  });
  it("preserves the block and keeps later rules in the body", () => {
    expect(
      splitFrontmatter("---\nname: x\nlist: [a, b]\n---\nAbove\n---\nBelow\n"),
    ).toEqual({
      frontmatter: { raw: "name: x\nlist: [a, b]", lines: 4 },
      body: "Above\n---\nBelow\n",
    });
  });
  it("supports BOM, Windows newlines and end-of-document delimiters", () => {
    expect(splitFrontmatter("\uFEFF---\r\nname: x\r\n...\r\nBody\r\n")).toEqual(
      {
        frontmatter: { raw: "name: x", lines: 3 },
        body: "Body\r\n",
      },
    );
  });
  it("splits malformed YAML without interpreting it", () => {
    expect(
      splitFrontmatter('---\nkey: "open\n---\nBody').frontmatter?.raw,
    ).toBe('key: "open');
  });
  it("does not let frontmatter comments count as headings", () => {
    expect(headingLines("---\n# comment\nname: x\n---\n# Title\n")).toEqual([
      4,
    ]);
  });
  it("stays fast on long hostile lines", () => {
    const text = `---\nk: "${"\\".repeat(200_000)}\n---\n`;
    const started = performance.now();
    splitFrontmatter(text);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
