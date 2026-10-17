import { useMemo } from "react";
import { IconButton } from "./ControlElements";
import { Icon } from "./Icon";
import { OutputBox } from "./OutputBox";
import { SyntaxCode } from "./SyntaxCode";

type Edit = { oldText: string; newText: string };
type Args = { path?: string; content?: string; edits?: Edit[] };
function isEdit(value: unknown): value is Edit {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).oldText === "string" &&
    typeof (value as Record<string, unknown>).newText === "string"
  );
}
function argsOf(raw: string): Args | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const o = value as Record<string, unknown>;
    let edits: unknown = o.edits;
    if (typeof edits === "string") {
      try {
        edits = JSON.parse(edits);
      } catch {
        edits = undefined;
      }
    }
    const valid = Array.isArray(edits)
      ? edits.filter(isEdit)
      : isEdit(edits)
        ? [edits]
        : [];
    if (isEdit(o)) valid.push({ oldText: o.oldText, newText: o.newText });
    return {
      path:
        typeof (value as Record<string, unknown>).path === "string"
          ? (value as Record<string, string>).path
          : undefined,
      content:
        typeof (value as Record<string, unknown>).content === "string"
          ? (value as Record<string, string>).content
          : undefined,
      edits: valid.length ? valid : undefined,
    };
  } catch {
    return null;
  }
}
// Pi read's continuation note is not a line of the file.
function readContent(output: string): { text: string; note?: string } {
  const match =
    /\n\n(\[(?:Showing lines \d+-\d+ of \d+[^\n]*|\d+ more lines in file\. [^\n]*)\])$/.exec(
      output,
    );
  return match
    ? { text: output.slice(0, match.index), note: match[1] }
    : { text: output };
}
const lineCount = (text: string) => text.replace(/\n$/, "").split("\n").length;
const language = (path?: string) =>
  ({
    py: "python",
    md: "markdown",
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    sh: "shell",
    go: "go",
    json: "json",
    rs: "rust",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    css: "css",
    html: "html",
    xml: "xml",
    ini: "ini",
    diff: "diff",
    patch: "diff",
  })[path?.split(".").pop() ?? ""] ?? "";
function lcs<T>(a: T[], b: T[]): [" " | "-" | "+", T][] {
  // Bound quadratic work on large files; diff view is only a display aid.
  if (a.length * b.length > 250000)
    return [
      ...a.map((x) => ["-", x] as ["-", T]),
      ...b.map((x) => ["+", x] as ["+", T]),
    ];
  const dp = Array.from(
    { length: a.length + 1 },
    () => new Uint32Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: [" " | "-" | "+", T][] = [];
  let i = 0,
    j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push([" ", a[i++]]);
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(["-", a[i++]]);
    else out.push(["+", b[j++]]);
  }
  while (i < a.length) out.push(["-", a[i++]]);
  while (j < b.length) out.push(["+", b[j++]]);
  return out;
}
const tokens = (s: string) => s.match(/\s+|[\w.]+|[^\w\s]/g) ?? [];
export function editLines(oldText: string, newText: string) {
  return lcs(oldText.split("\n"), newText.split("\n"));
}
function marked(a: string, b: string, kind: "-" | "+") {
  return lcs(tokens(a), tokens(b))
    .filter(([op]) => op === " " || op === kind)
    .map(([op, word], i) =>
      op === " " ? (
        // biome-ignore lint/suspicious/noArrayIndexKey: Position in immutable token sequence.
        <span key={i}>{word}</span>
      ) : kind === "-" ? (
        // biome-ignore lint/suspicious/noArrayIndexKey: Position in immutable token sequence.
        <del key={i}>{word}</del>
      ) : (
        // biome-ignore lint/suspicious/noArrayIndexKey: Position in immutable token sequence.
        <ins key={i}>{word}</ins>
      ),
    );
}
// Pi edit results include a unified diff on many native versions. Preserve it
// rather than re-diffing the replacement arguments when present.
function nativeDiff(text?: string): [" " | "-" | "+", string][] | null {
  if (!text || !/^--- [^\n]+\n\+\+\+ [^\n]+\n@@/m.test(text)) return null;
  return text
    .split("\n")
    .filter((line) => /^[ +-]/.test(line) && !/^(--- |\+\+\+ )/.test(line))
    .map((line) => [line[0] as " " | "-" | "+", line.slice(1)]);
}
function editOps(
  args: Args | null,
  output?: string,
): [" " | "-" | "+", string][] | null {
  const native = nativeDiff(output);
  if (native) return native;
  if (!args?.edits?.length) return null;
  return args.edits.flatMap((edit, i) => [
    ...(i ? [[" ", `⋯ muutos ${i + 1}`] as [" ", string]] : []),
    ...editLines(edit.oldText, edit.newText),
  ]);
}
export function FileToolCard({
  name,
  argumentsText,
  output,
  failed = false,
}: {
  name: string;
  argumentsText: string;
  output?: string;
  failed?: boolean;
}) {
  const args = useMemo(() => argsOf(argumentsText), [argumentsText]);
  if (failed)
    return (
      <pre className="ah-file-error">{output ?? "Työkalu epäonnistui."}</pre>
    );
  if (
    (!args &&
      !(
        (name === "edit" && nativeDiff(output)) ||
        (name === "read" && output !== undefined)
      )) ||
    !["read", "write", "edit"].includes(name)
  )
    return (
      <>
        <pre>{argumentsText}</pre>
        {output ? <pre>{output}</pre> : null}
      </>
    );
  if (name === "read" && output !== undefined) {
    const { text, note } = readContent(output);
    return (
      <>
        <OutputBox
          text={text}
          language={language(args?.path)}
          copyLabel="Kopioi sisältö"
        />
        {note ? (
          <p role="note" className="ah-pi-boundary">
            {note}
          </p>
        ) : null}
      </>
    );
  }
  if (name === "read") return null;
  if (name === "write")
    return args?.content !== undefined ? (
      <OutputBox
        text={args?.content ?? ""}
        language={language(args?.path)}
        copyLabel="Kopioi sisältö"
      />
    ) : null;
  const ops = editOps(args, output);
  if (!ops) return <pre>{argumentsText}</pre>;
  const rows: { type: " " | "-" | "+"; text: string; pair?: string }[] = [];
  for (let i = 0; i < ops.length; ) {
    if (ops[i][0] === " ") {
      rows.push({ type: " ", text: ops[i++][1] });
      continue;
    }
    const removed: string[] = [],
      added: string[] = [];
    while (ops[i]?.[0] === "-") removed.push(ops[i++][1]);
    while (ops[i]?.[0] === "+") added.push(ops[i++][1]);
    removed.forEach((text, n) => {
      rows.push({ type: "-", text, pair: added[n] });
    });
    added.forEach((text, n) => {
      rows.push({ type: "+", text, pair: removed[n] });
    });
  }
  const replacements = args?.edits?.map((e) => e.newText);
  return (
    <div className="ah-file-diff-box">
      {language(args?.path) ? (
        <small className="ah-output-meta">{language(args?.path)}</small>
      ) : null}
      <pre className="ah-file-diff">
        {rows.map(({ type, text, pair }, i) => (
          <span
            className={`ah-diff-line ah-diff-${type === " " ? "context" : type === "-" ? "remove" : "add"}`}
            // biome-ignore lint/suspicious/noArrayIndexKey: Position in immutable diff sequence.
            key={i}
          >
            <span className="ah-diff-sign" aria-hidden="true">
              {type === "-" ? "−" : type}
            </span>
            <span>
              {type === "-" ? (
                <span className="ah-sr-only">poistettu: </span>
              ) : type === "+" ? (
                <span className="ah-sr-only">lisätty: </span>
              ) : null}
              {pair !== undefined ? (
                type === "-" ? (
                  marked(text, pair, "-")
                ) : (
                  marked(pair, text, "+")
                )
              ) : (
                <SyntaxCode
                  text={text || " "}
                  language={language(args?.path)}
                />
              )}
            </span>
          </span>
        ))}
      </pre>
      <IconButton
        size="inline"
        variant="quiet"
        aria-label={
          replacements?.length
            ? replacements.length === 1
              ? "Kopioi uusi teksti"
              : "Kopioi uudet tekstit"
            : "Kopioi diffi"
        }
        onPress={() =>
          void navigator.clipboard.writeText(
            replacements?.join("\n\n") ?? output ?? "",
          )
        }
      >
        <Icon name="copy" />
      </IconButton>
    </div>
  );
}
export function fileStat(
  name: string,
  argumentsText: string,
  output?: string,
  failed = false,
) {
  if (failed) return undefined;
  const args = argsOf(argumentsText);
  if (
    !args &&
    !(
      (name === "edit" && nativeDiff(output)) ||
      (name === "read" && output !== undefined)
    )
  )
    return undefined;
  if (name === "read" && output !== undefined)
    return `${lineCount(readContent(output).text)} riviä`;
  if (name === "write" && args?.content !== undefined)
    return `uusi · ${lineCount(args?.content)} riviä`;
  if (name === "edit") {
    const ops = editOps(args, output);
    if (!ops) return undefined;
    return `+${ops.filter((x) => x[0] === "+").length} −${ops.filter((x) => x[0] === "-").length}`;
  }
  return undefined;
}
