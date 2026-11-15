/** Splitting stays separate from YAML parsing so editor navigation does not
 * load the parser before the lazy preview is opened. */
export type Frontmatter = {
  raw: string;
  /** How many source lines the block takes, closing line included. */
  lines: number;
};

/** Only a delimited block at the start is front matter. An unclosed opening
 * delimiter remains Markdown, as does a later horizontal rule. */
export function splitFrontmatter(text: string): {
  frontmatter: Frontmatter | null;
  body: string;
} {
  const source = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const lines = source.split("\n");
  if (!/^---[ \t]*\r?$/.test(lines[0] ?? ""))
    return { frontmatter: null, body: text };
  const close = lines.findIndex(
    (line, n) => n > 0 && /^(---|\.\.\.)[ \t]*\r?$/.test(line),
  );
  if (close < 0) return { frontmatter: null, body: text };
  return {
    frontmatter: {
      raw: lines
        .slice(1, close)
        .map((line) => line.replace(/\r$/, ""))
        .join("\n"),
      lines: close + 1,
    },
    body: lines.slice(close + 1).join("\n"),
  };
}
