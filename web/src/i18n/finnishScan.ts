import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseSync } from "vite";

// Finds Finnish in the interface's source outside the catalogs: a string
// literal, template text or JSX text in web/src that carries a Finnish
// letter or a word only the Finnish catalogs use. Comments are not text the
// person sees, so the scan reads the syntax tree (Vite's own parser) rather
// than lines.

/** A piece of text the source would show, where it is. */
export type Finding = { file: string; line: number; text: string };

const finnishLetter = /[äöåÄÖÅ]/;
const word = /[A-Za-zÀ-ÿ]+/g;

type Node = { type: string; start: number; end: number; [k: string]: unknown };

function parse(file: string, source: string) {
  const { program, errors } = parseSync(file, source, {
    lang: file.endsWith(".tsx") ? "tsx" : "ts",
  });
  if (errors.length) throw new Error(`${file}: ${errors[0].message}`);
  return program as unknown as Node;
}

/** Every string, template piece and JSX text in a parsed file. */
function textNodes(program: Node) {
  const out: { start: number; text: string }[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== "object") return;
    const n = node as Node;
    if (n.type === "Literal" && typeof n.value === "string")
      out.push({ start: n.start, text: n.value });
    else if (n.type === "TemplateElement")
      out.push({ start: n.start, text: (n.value as { raw: string }).raw });
    else if (n.type === "JSXText" && String(n.value).trim())
      out.push({ start: n.start, text: String(n.value).trim() });
    // A module path is not text.
    const moduleSource =
      n.type === "ImportDeclaration" || !!n.type?.startsWith("Export");
    for (const [key, child] of Object.entries(n))
      if (typeof child === "object" && !(moduleSource && key === "source"))
        visit(child);
  };
  visit(program);
  return out;
}

function lineOf(source: string, offset: number) {
  let line = 1;
  for (let i = 0; i < offset; i++) if (source[i] === "\n") line++;
  return line;
}

/** The catalogs' own words: a word of at least four letters that some
 * Finnish message uses and no English message does. Read from the source of
 * src/text, where `const fi` holds the Finnish half and the rest of the file
 * the English. */
export function finnishWords(textDir: string) {
  const fi = new Set<string>();
  const en = new Set<string>();
  for (const name of readdirSync(textDir)) {
    const file = join(textDir, name);
    const program = parse(file, readFileSync(file, "utf8"));
    const declarations = (program.body as Node[]).flatMap((s) =>
      s.type === "VariableDeclaration" ? (s.declarations as Node[]) : [],
    );
    const finnish = declarations.find(
      (d) => (d.id as { name?: string }).name === "fi",
    );
    for (const { start, text } of textNodes(program)) {
      const inFinnish =
        !!finnish && start >= finnish.start && start < finnish.end;
      for (const w of text.match(word) ?? [])
        (inFinnish ? fi : en).add(w.toLowerCase());
    }
  }
  return new Set(
    [...fi].filter(
      (w) => w.length >= 4 && !en.has(w) && !finnishLetter.test(w),
    ),
  );
}

/** Whether a text reads as Finnish. */
export function isFinnish(text: string, words: ReadonlySet<string>) {
  if (finnishLetter.test(text)) return true;
  return (text.match(word) ?? []).some((w) => words.has(w.toLowerCase()));
}

/** Source files whose text the person may see: not the catalogs, tests,
 * stories, generated contracts or synthetic fixtures. */
export function sourceFiles(srcDir: string) {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const rel = relative(srcDir, path);
      if (statSync(path).isDirectory()) {
        if (rel !== "text" && rel !== "test" && rel !== "contracts") walk(path);
      } else if (
        /\.tsx?$/.test(name) &&
        !/\.(test|stories)\.tsx?$/.test(name) &&
        !/[Ff]ixtures?\.tsx?$/.test(name)
      )
        out.push(path);
    }
  };
  walk(srcDir);
  return out.sort();
}

/** Every Finnish text in the source, by file relative to srcDir. */
export function scan(srcDir: string, words: ReadonlySet<string>) {
  const findings: Finding[] = [];
  for (const path of sourceFiles(srcDir)) {
    const source = readFileSync(path, "utf8");
    for (const { start, text } of textNodes(parse(path, source)))
      if (isFinnish(text, words))
        findings.push({
          file: relative(srcDir, path),
          line: lineOf(source, start),
          text,
        });
  }
  return findings;
}
