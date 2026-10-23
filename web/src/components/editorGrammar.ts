import { StreamLanguage } from "@codemirror/language";

// Only the selected bundled grammar is fetched; unknown extensions stay plain.
export async function editorGrammar(path: string) {
  const ext = path.split("/").pop()?.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "md":
    case "markdown":
      return (await import("@codemirror/lang-markdown")).markdown();
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
    case "ts":
    case "tsx":
    case "mts":
    case "cts":
      return (await import("@codemirror/lang-javascript")).javascript({
        jsx: ext.endsWith("x"),
        typescript: ["ts", "tsx", "mts", "cts"].includes(ext),
      });
    case "php":
    case "phtml":
      return (await import("@codemirror/lang-php")).php();
    case "rs":
      return (await import("@codemirror/lang-rust")).rust();
    case "sql":
      return (await import("@codemirror/lang-sql")).sql();
    case "toml":
      return StreamLanguage.define(
        (await import("@codemirror/legacy-modes/mode/toml")).toml,
      );
    case "json":
      return (await import("@codemirror/lang-json")).json();
    case "html":
    case "htm":
      return (await import("@codemirror/lang-html")).html();
    case "css":
      return (await import("@codemirror/lang-css")).css();
    case "go":
      return (await import("@codemirror/lang-go")).go();
    case "py":
      return (await import("@codemirror/lang-python")).python();
    case "yaml":
    case "yml":
      return (await import("@codemirror/lang-yaml")).yaml();
    case "sh":
    case "bash":
    case "zsh":
      return StreamLanguage.define(
        (await import("@codemirror/legacy-modes/mode/shell")).shell,
      );
    default:
      return [];
  }
}
