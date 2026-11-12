/** One top-level key of a document's frontmatter. A scalar is shown as
 * text; anything nested (a list, a mapping) keeps its YAML source. */
export type FrontmatterEntry =
  | { key: string; value: string }
  | { key: string; yaml: string };

/** A document split into its leading YAML frontmatter and its body.
 * `entries` is null when the block is there but is not the simple
 * key–value YAML this reader understands; `raw` is then shown as is. */
export type Frontmatter = {
  raw: string;
  entries: FrontmatterEntry[] | null;
  /** How many source lines the block takes, closing line included. */
  lines: number;
};

/**
 * Splits off a frontmatter block: only at the very start of the text, a
 * `---` line, then everything up to the first `---` or `...` line. Without a
 * closing line there is no frontmatter, and a later `---` is the body's own.
 * Nothing in the block is evaluated: no tags, anchors, includes or types,
 * only text.
 */
export function splitFrontmatter(text: string): {
  frontmatter: Frontmatter | null;
  body: string;
} {
  const source = text.startsWith("﻿") ? text.slice(1) : text;
  const lines = source.split("\n");
  if (!/^---[ \t]*\r?$/.test(lines[0] ?? ""))
    return { frontmatter: null, body: text };
  const close = lines.findIndex(
    (line, n) => n > 0 && /^(---|\.\.\.)[ \t]*\r?$/.test(line),
  );
  if (close < 0) return { frontmatter: null, body: text };
  const block = lines.slice(1, close).map((line) => line.replace(/\r$/, ""));
  return {
    frontmatter: {
      raw: block.join("\n"),
      entries: parseEntries(block),
      lines: close + 1,
    },
    body: lines.slice(close + 1).join("\n"),
  };
}

const keyLine =
  /^([^\s#:'"[\]{},&*!|>%@`-][^:]*?|"[^"]*"|'[^']*')[ \t]*:(?:[ \t]+(.*))?$/;

function parseEntries(block: string[]): FrontmatterEntry[] | null {
  const entries: FrontmatterEntry[] = [];
  let n = 0;
  while (n < block.length) {
    const line = block[n];
    if (/^\s*(#.*)?$/.test(line)) {
      n++;
      continue;
    }
    const match = keyLine.exec(line);
    if (!match) return null;
    const key = unquoteKey(match[1]);
    const inline = (match[2] ?? "").trim();
    // A key's value continues on indented lines, and a block list may start
    // at the key's own column.
    const rest: string[] = [];
    n++;
    while (
      n < block.length &&
      (/^\s*$/.test(block[n]) ||
        /^[ \t]/.test(block[n]) ||
        (!inline && /^-([ \t]|$)/.test(block[n])))
    )
      rest.push(block[n++]);
    while (rest.length && /^\s*$/.test(rest[rest.length - 1])) rest.pop();
    const entry = parseValue(key, inline, rest);
    if (!entry) return null;
    entries.push(entry);
  }
  return entries;
}

function parseValue(
  key: string,
  inline: string,
  rest: string[],
): FrontmatterEntry | null {
  if (/^[&*!]/.test(inline)) return { key, yaml: [inline, ...rest].join("\n") };
  if (!inline)
    return rest.length ? { key, yaml: dedent(rest) } : { key, value: "" };
  const block = /^([|>])[+-]?[1-9]?[+-]?(\s+#.*)?$/.exec(inline);
  if (block) {
    const lines = dedent(rest).split("\n");
    return {
      key,
      value: block[1] === "|" ? lines.join("\n") : fold(lines),
    };
  }
  const tail = rest.map((line) => line.trim());
  if (inline.startsWith('"') || inline.startsWith("'")) {
    const quoted = unquote(fold([inline, ...tail]));
    return quoted === null ? null : { key, value: quoted };
  }
  // A plain scalar may continue on more indented lines; YAML folds them.
  return {
    key,
    value: fold([stripComment(inline), ...tail.map(stripComment)]),
  };
}

function unquoteKey(key: string): string {
  return unquote(key) ?? key.trim();
}

function unquote(text: string): string | null {
  const value = stripComment(text);
  const quote = value[0];
  if ((quote !== '"' && quote !== "'") || value.length < 2) return null;
  if (value[value.length - 1] !== quote) return null;
  const inner = value.slice(1, -1);
  if (quote === "'") {
    if (inner.replace(/''/g, "").includes("'")) return null;
    return inner.replace(/''/g, "'");
  }
  if (/(^|[^\\])(\\\\)*"/.test(inner)) return null;
  return inner.replace(/\\(.)/g, (_, c: string) =>
    c === "n" ? "\n" : c === "t" ? "\t" : c,
  );
}

// ` #` starts a comment after a plain scalar; inside quotes it is text.
function stripComment(text: string): string {
  const quote = text[0] === '"' || text[0] === "'" ? text[0] : "";
  if (quote) {
    const end = text.lastIndexOf(quote);
    return end > 0
      ? text.slice(0, end + 1) + text.slice(end + 1).replace(/\s+#.*$/, "")
      : text;
  }
  return text.replace(/(^|\s)#.*$/, "").trimEnd();
}

function fold(lines: string[]): string {
  return lines
    .join("\n")
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .join("\n");
}

function dedent(lines: string[]): string {
  const indents = lines
    .filter((line) => line.trim())
    .map((line) => /^[ \t]*/.exec(line)?.[0].length ?? 0);
  const cut = indents.length ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(cut)).join("\n");
}
