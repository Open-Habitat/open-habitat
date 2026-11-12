import { describe, expect, it } from "vitest";
import { headingLines } from "./editorPreview";
import { splitFrontmatter } from "./frontmatter";

describe("splitFrontmatter", () => {
  it("leaves a document without frontmatter as it is", () => {
    const text = "# Title\n\nBody\n";
    expect(splitFrontmatter(text)).toEqual({ frontmatter: null, body: text });
  });

  it("reads keys and scalars of a skill file", () => {
    const { frontmatter, body } = splitFrontmatter(
      [
        "---",
        "name: personal-data",
        "description: Use when a request touches personal data, such as email,",
        "  calendars or contacts.",
        'title: "Quoted: \\"yes\\""',
        "single: 'it''s'",
        "empty:",
        "plain: value # a comment",
        "---",
        "# Body",
        "",
      ].join("\n"),
    );
    expect(frontmatter?.entries).toEqual([
      { key: "name", value: "personal-data" },
      {
        key: "description",
        value:
          "Use when a request touches personal data, such as email, calendars or contacts.",
      },
      { key: "title", value: 'Quoted: "yes"' },
      { key: "single", value: "it's" },
      { key: "empty", value: "" },
      { key: "plain", value: "value" },
    ]);
    expect(frontmatter?.lines).toBe(9);
    expect(body).toBe("# Body\n");
  });

  it("keeps nested and list values as YAML text and reads block scalars", () => {
    const { frontmatter } = splitFrontmatter(
      [
        "---",
        "tags:",
        "- one",
        "- two",
        "meta:",
        "  owner: jari",
        "  list: [a, b]",
        "notes: |",
        "  first",
        "  second",
        "summary: >-",
        "  folded",
        "  text",
        "...",
        "Body",
      ].join("\n"),
    );
    expect(frontmatter?.entries).toEqual([
      { key: "tags", yaml: "- one\n- two" },
      { key: "meta", yaml: "owner: jari\nlist: [a, b]" },
      { key: "notes", value: "first\nsecond" },
      { key: "summary", value: "folded text" },
    ]);
  });

  it("keeps malformed frontmatter as raw text", () => {
    const { frontmatter, body } = splitFrontmatter(
      "---\nname: ok\njust a sentence\n---\nBody",
    );
    expect(frontmatter).toEqual({
      raw: "name: ok\njust a sentence",
      entries: null,
      lines: 4,
    });
    expect(body).toBe("Body");
    expect(
      splitFrontmatter('---\nkey: "open\n---\n').frontmatter?.entries,
    ).toBe(null);
    expect(splitFrontmatter("---\n- a\n---\n").frontmatter?.entries).toBe(null);
  });

  it("recognises only a block at the very start", () => {
    const later = "Intro\n\n---\nname: x\n---\n";
    expect(splitFrontmatter(later).frontmatter).toBe(null);
    const indented = " ---\nname: x\n---\n";
    expect(splitFrontmatter(indented).frontmatter).toBe(null);
    // Without a closing line the opening `---` is the body's own rule.
    expect(splitFrontmatter("---\n\nText").frontmatter).toBe(null);
  });

  it("leaves a later rule in the body alone", () => {
    const { frontmatter, body } = splitFrontmatter(
      "---\nname: x\n---\nAbove\n\n---\n\nBelow\n",
    );
    expect(frontmatter?.entries).toEqual([{ key: "name", value: "x" }]);
    expect(body).toBe("Above\n\n---\n\nBelow\n");
  });

  it("reads Windows line endings", () => {
    const { frontmatter, body } = splitFrontmatter(
      "---\r\nname: x\r\ndescription: long\r\n  text\r\n---\r\nBody\r\n",
    );
    expect(frontmatter?.entries).toEqual([
      { key: "name", value: "x" },
      { key: "description", value: "long text" },
    ]);
    expect(body).toBe("Body\r\n");
  });

  it("does not let frontmatter comments count as headings", () => {
    expect(headingLines("---\n# comment\nname: x\n---\n# Title\n")).toEqual([
      4,
    ]);
  });
});
