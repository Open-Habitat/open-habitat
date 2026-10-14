import { type ReactNode, useEffect, useRef, useState } from "react";
import hljs from "highlight.js/lib/core";

const grammars = {
  python: () => import("highlight.js/lib/languages/python"),
  rust: () => import("highlight.js/lib/languages/rust"),
  json: () => import("highlight.js/lib/languages/json"),
  yaml: () => import("highlight.js/lib/languages/yaml"),
  bash: () => import("highlight.js/lib/languages/bash"),
  markdown: () => import("highlight.js/lib/languages/markdown"),
  typescript: () => import("highlight.js/lib/languages/typescript"),
  javascript: () => import("highlight.js/lib/languages/javascript"),
  go: () => import("highlight.js/lib/languages/go"),
  xml: () => import("highlight.js/lib/languages/xml"),
  css: () => import("highlight.js/lib/languages/css"),
  ini: () => import("highlight.js/lib/languages/ini"),
  diff: () => import("highlight.js/lib/languages/diff"),
} as const;
type Grammar = keyof typeof grammars;
const aliases: Record<string, Grammar | "plain"> = {
  text: "plain",
  plain: "plain",
  plaintext: "plain",
  txt: "plain",
  py: "python",
  python: "python",
  rs: "rust",
  rust: "rust",
  json: "json",
  jsonc: "json",
  yml: "yaml",
  yaml: "yaml",
  sh: "bash",
  shell: "bash",
  bash: "bash",
  zsh: "bash",
  md: "markdown",
  markdown: "markdown",
  ts: "typescript",
  tsx: "typescript",
  typescript: "typescript",
  js: "javascript",
  jsx: "javascript",
  javascript: "javascript",
  golang: "go",
  go: "go",
  html: "xml",
  xml: "xml",
  css: "css",
  toml: "ini",
  ini: "ini",
  patch: "diff",
  diff: "diff",
};
export function syntaxLanguage(label?: string): Grammar | "plain" | undefined {
  return label ? aliases[label.toLowerCase().trim()] : undefined;
}
const loaded = new Map<Grammar, Promise<void>>();
function load(language: Grammar) {
  let pending = loaded.get(language);
  if (!pending) {
    pending = grammars[language]().then(({ default: grammar }) => {
      hljs.registerLanguage(language, grammar);
    });
    loaded.set(language, pending);
    pending.catch(() => loaded.delete(language));
  }
  return pending;
}
// Only token scopes emitted by the bundled grammars may become DOM classes.
const scopes = new Set([
  "keyword",
  "built_in",
  "type",
  "literal",
  "number",
  "string",
  "subst",
  "symbol",
  "regexp",
  "title",
  "function_",
  "class_",
  "params",
  "comment",
  "doctag",
  "meta",
  "meta-string",
  "section",
  "name",
  "tag",
  "attr",
  "attribute",
  "variable",
  "template-variable",
  "property",
  "selector-tag",
  "selector-class",
  "selector-id",
  "selector-attr",
  "selector-pseudo",
  "addition",
  "deletion",
  "bullet",
  "code",
  "quote",
  "link",
  "emphasis",
  "strong",
  "formula",
  "operator",
  "punctuation",
  "char",
  "escape",
  "language_",
  "diff",
  "template-tag",
  "template-variable",
]);
export function safeHighlightedNodes(html: string, source: string): ReactNode {
  const doc = new DOMParser().parseFromString(
    `<body>${html}</body>`,
    "text/html",
  );
  if (doc.body.textContent !== source) return source;
  function convert(node: Node, key: number): ReactNode {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeName !== "SPAN") return node.textContent;
    const span = node as HTMLElement;
    const classes = [...span.classList];
    if (
      !classes.length ||
      classes.some(
        (name) => !scopes.has(name.replace(/^hljs-/, "")) && !scopes.has(name),
      )
    )
      return span.textContent;
    return (
      <span
        key={key}
        className={classes
          .filter((name) => name.startsWith("hljs-") || scopes.has(name))
          .join(" ")}
      >
        {Array.from(span.childNodes, convert)}
      </span>
    );
  }
  return Array.from(doc.body.childNodes, convert);
}
const MAX_HIGHLIGHT = 16_384;
/** Plain text is always rendered immediately; parsing only decorates a visible, bounded block. */
export function SyntaxCode({
  text,
  language,
  complete = true,
  active = true,
  detect = false,
}: {
  text: string;
  language?: string;
  complete?: boolean;
  active?: boolean;
  detect?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(
    typeof IntersectionObserver === "undefined",
  );
  const [result, setResult] = useState<{
    text: string;
    language?: string;
    nodes: ReactNode;
  }>();
  useEffect(() => {
    if (!active || !ref.current || typeof IntersectionObserver === "undefined")
      return;
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    if (!active || !visible || !text || text.length > MAX_HIGHLIGHT) return;
    const selected = syntaxLanguage(language);
    if (
      selected === "plain" ||
      (language && !selected) ||
      (!language && (!detect || !complete || text.length < 40))
    )
      return;
    let cancelled = false;
    const timer = window.setTimeout(
      async () => {
        try {
          if (selected) await load(selected);
          else
            await Promise.all(
              (["python", "javascript", "json", "bash"] as const).map(load),
            );
          if (cancelled) return;
          const highlighted = selected
            ? hljs.highlight(text, { language: selected, ignoreIllegals: true })
            : hljs.highlightAuto(text, [
                "python",
                "javascript",
                "json",
                "bash",
              ]);
          // A weak guess must never turn ordinary prose into noisy syntax colours.
          if (!selected && (highlighted.relevance < 8 || !highlighted.language))
            return;
          setResult({
            text,
            language,
            nodes: safeHighlightedNodes(highlighted.value, text),
          });
        } catch {
          /* Missing grammar or invalid input: keep the original text. */
        }
      },
      complete ? 0 : 180,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [text, language, complete, active, detect, visible]);
  return (
    <code ref={ref} className="ah-syntax">
      {active &&
      visible &&
      result?.text === text &&
      result.language === language
        ? result.nodes
        : text}
    </code>
  );
}
