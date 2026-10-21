import * as monaco from "monaco-editor/editor/editor.api.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import "monaco-editor/editor/contrib/find/browser/findController.js";
import "monaco-editor/editor/contrib/clipboard/browser/clipboard.js";
import "monaco-editor/editor/contrib/unicodeHighlighter/browser/unicodeHighlighter.js";
import "monaco-editor/editor/contrib/wordOperations/browser/wordOperations.js";
import "monaco-editor/editor/contrib/linesOperations/browser/linesOperations.js";
import "monaco-editor/editor/contrib/comment/browser/comment.js";
import "monaco-editor/editor/contrib/indentation/browser/indentation.js";
import "monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching.js";
import "monaco-editor/languages/definitions/markdown/register.js";
import "monaco-editor/languages/definitions/javascript/register.js";
import "monaco-editor/languages/definitions/typescript/register.js";
import "monaco-editor/languages/definitions/html/register.js";
import "monaco-editor/languages/definitions/css/register.js";
import "monaco-editor/languages/definitions/go/register.js";
import "monaco-editor/languages/definitions/python/register.js";
import "monaco-editor/languages/definitions/shell/register.js";
import "monaco-editor/languages/definitions/yaml/register.js";
import { useEffect, useRef } from "react";
import type { FileRef } from "./fileRefs";

// No language-service/extension host: only lazy syntax tokenizers and the local
// core text worker. Disposing the last model releases Monaco's core worker.
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
monaco.languages.register({ id: "json", extensions: [".json"] });
monaco.languages.setMonarchTokensProvider("json", {
  tokenizer: {
    root: [
      [/"(?:[^"\\]|\\.)*"(?=\s*:)/, "type"],
      [/"(?:[^"\\]|\\.)*"/, "string"],
      [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, "number"],
      [/\b(?:true|false|null)\b/, "keyword"],
    ],
  },
});
const languages: Record<string, string> = {
  md: "markdown",
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  html: "html",
  htm: "html",
  css: "css",
  go: "go",
  py: "python",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  yaml: "yaml",
  yml: "yaml",
};
function theme(parent: HTMLElement) {
  const css = getComputedStyle(parent);
  const token = (name: string) => {
    const value = css.getPropertyValue(`--ah-${name}`).trim();
    // Production CSS minification shortens hex tokens; Monaco requires 6/8 digits.
    return /^#[\da-f]{3,4}$/i.test(value)
      ? `#${[...value.slice(1)].map((digit) => digit + digit).join("")}`
      : value;
  };
  monaco.editor.defineTheme("habitat", {
    base: document.documentElement.dataset.theme === "dark" ? "vs-dark" : "vs",
    inherit: true,
    rules: [
      { token: "", foreground: token("ink").slice(1) },
      ...["keyword", "string", "number", "comment"].map((name) => ({
        token: name,
        foreground: token(`syntax-${name}`).slice(1),
      })),
      { token: "type", foreground: token("syntax-title").slice(1) },
    ],
    colors: {
      "editor.background": token("surface"),
      "editor.foreground": token("ink"),
      "editorCursor.foreground": token("ink"),
      "editor.selectionBackground": token("accent-soft"),
      "editor.inactiveSelectionBackground": token("accent-soft"),
      "editorLineNumber.foreground": token("muted"),
      "editorLineNumber.activeForeground": token("ink"),
      "editor.lineHighlightBackground": token("surface-2"),
      "editorWidget.background": token("surface-2"),
      "editorWidget.foreground": token("ink"),
      focusBorder: token("focus"),
    },
  });
  monaco.editor.setTheme("habitat");
}
export default function MonacoEditor({
  content,
  path,
  selection,
  onChange,
  onSave,
  disabled = false,
}: {
  content: string;
  path: string;
  selection?: FileRef;
  onChange: (value: string) => void;
  onSave: () => void;
  disabled?: boolean;
}) {
  const parent = useRef<HTMLDivElement>(null);
  const view = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(
    undefined,
  );
  const callbacks = useRef({ onChange, onSave });
  callbacks.current = { onChange, onSave };
  // biome-ignore lint/correctness/useExhaustiveDependencies: Replacement remounts the adapter; saving/keystrokes must not reset history or focus.
  useEffect(() => {
    if (!parent.current) return;
    theme(parent.current);
    const model = monaco.editor.createModel(
      content,
      languages[path.split(".").pop()?.toLowerCase() ?? ""] ?? "plaintext",
    );
    model.setEOL(monaco.editor.EndOfLineSequence.LF);
    const editor = monaco.editor.create(parent.current, {
      model,
      theme: "habitat",
      automaticLayout: true,
      fontFamily: getComputedStyle(parent.current).getPropertyValue(
        "--ah-mono",
      ),
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      readOnly: disabled,
      ariaLabel: "Tiedoston teksti",
      accessibilitySupport: "on",
      // Stable textarea input across Chromium/Firefox/Safari and assistive tools;
      // do not opt into Monaco's experimental native EditContext.
      editContext: false,
      tabFocusMode: true,
      links: false,
      contextmenu: false,
      unicodeHighlight: { ambiguousCharacters: false },
    });
    view.current = editor;
    // Keep the shared focus target on Monaco's real accessible input.
    editor
      .getDomNode()
      ?.querySelector("textarea, [contenteditable=true]")
      ?.setAttribute("data-testid", "editor-document");
    const changed = model.onDidChangeContent(() =>
      callbacks.current.onChange(
        model.getValue(monaco.editor.EndOfLinePreference.LF),
      ),
    );
    // Capture Save from find/replace inputs too, not only the text input.
    const saveKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.code === "KeyS") {
        event.preventDefault();
        event.stopPropagation();
        callbacks.current.onSave();
      } else if (event.ctrlKey && event.code === "KeyM") {
        event.preventDefault();
        event.stopPropagation();
        editor.updateOptions({
          tabFocusMode: !editor.getOption(
            monaco.editor.EditorOption.tabFocusMode,
          ),
        });
      }
    };
    const container = parent.current;
    container.addEventListener("keydown", saveKey, true);
    const observer = new MutationObserver(() => {
      if (parent.current) theme(parent.current);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class", "style"],
    });
    return () => {
      observer.disconnect();
      container.removeEventListener("keydown", saveKey, true);
      changed.dispose();
      editor.dispose();
      model.dispose();
      view.current = undefined;
    };
  }, [path]);
  useEffect(() => {
    view.current?.updateOptions({ readOnly: disabled });
  }, [disabled]);
  useEffect(() => {
    const editor = view.current;
    const model = editor?.getModel();
    if (!editor || !model || !selection) return;
    const start = Math.max(
      1,
      Math.min(selection.line ?? 1, model.getLineCount()),
    );
    const end = Math.max(
      start,
      Math.min(selection.end ?? start, model.getLineCount()),
    );
    editor.setSelection(
      new monaco.Range(start, 1, end, model.getLineMaxColumn(end)),
    );
    editor.revealLinesInCenter(start, end);
    editor.focus();
  }, [selection]);
  return <div className="ah-monaco" ref={parent} data-testid="monaco-editor" />;
}
