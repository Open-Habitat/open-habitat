import { Compartment, EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
} from "@codemirror/language";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";
import type { FileRef } from "./fileRefs";

async function grammar(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "md":
      return (await import("@codemirror/lang-markdown")).markdown();
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return (await import("@codemirror/lang-javascript")).javascript({
        jsx: ext.endsWith("x"),
        typescript: ext.startsWith("t"),
      });
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
const theme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--ah-surface)",
    color: "var(--ah-ink)",
  },
  ".cm-scroller": { fontFamily: "var(--ah-mono)", overflow: "auto" },
  ".cm-content": { caretColor: "var(--ah-ink)" },
  ".cm-cursor": { borderLeftColor: "var(--ah-ink)" },
  ".cm-gutters": {
    backgroundColor: "var(--ah-surface-2)",
    color: "var(--ah-muted)",
    borderColor: "var(--ah-line)",
  },
  "&.cm-focused": {
    outline: "2px solid var(--ah-focus)",
    outlineOffset: "-2px",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "var(--ah-accent-soft)" },
  ".cm-activeLine": { backgroundColor: "var(--ah-hover)" },
});
const syntax = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.keyword, color: "var(--ah-syntax-keyword)" },
    { tag: [tags.string, tags.regexp], color: "var(--ah-syntax-string)" },
    { tag: [tags.number, tags.bool], color: "var(--ah-syntax-number)" },
    {
      tag: [tags.heading, tags.function(tags.variableName)],
      color: "var(--ah-syntax-title)",
    },
    { tag: tags.comment, color: "var(--ah-syntax-comment)" },
  ]),
);

/** Trusted bundled engine; repository text is only an EditorState document.
 * No preview, project plugin, language server or execution path exists. */
export default function CodeMirrorEditor({
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
  const view = useRef<EditorView | undefined>(undefined);
  const callbacks = useRef({ onChange, onSave });
  callbacks.current = { onChange, onSave };
  const editable = useRef(new Compartment());
  // biome-ignore lint/correctness/useExhaustiveDependencies: Document replacement remounts this view; keystrokes and save state must not reset history or focus.
  useEffect(() => {
    if (!parent.current) return;
    const language = new Compartment();
    const editor = new EditorView({
      parent: parent.current,
      state: EditorState.create({
        doc: content,
        extensions: [
          theme,
          syntax,
          lineNumbers(),
          highlightActiveLine(),
          history(),
          language.of([]),
          editable.current.of(EditorState.readOnly.of(disabled)),
          EditorView.contentAttributes.of({
            "aria-label": "Tiedoston teksti",
            "data-testid": "editor-document",
            spellcheck: "false",
          }),
          keymap.of([
            {
              key: "Mod-s",
              run: () => {
                callbacks.current.onSave();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged)
              callbacks.current.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    let active = true;
    void grammar(path).then((extension) => {
      if (active) editor.dispatch({ effects: language.reconfigure(extension) });
    });
    return () => {
      active = false;
      view.current = undefined;
      editor.destroy();
    };
    // The controller remounts this view on document replacement, not each keystroke.
  }, [path]);
  useEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure(EditorState.readOnly.of(disabled)),
    });
  }, [disabled]);
  useEffect(() => {
    const editor = view.current;
    if (!editor || !selection) return;
    const start = editor.state.doc.line(
      Math.max(1, Math.min(selection.line ?? 1, editor.state.doc.lines)),
    );
    const end = editor.state.doc.line(
      Math.max(
        start.number,
        Math.min(selection.end ?? start.number, editor.state.doc.lines),
      ),
    );
    editor.dispatch({
      selection: { anchor: start.from, head: end.to },
      scrollIntoView: true,
    });
    editor.focus();
  }, [selection]);
  return (
    <div
      className="ah-codemirror"
      ref={parent}
      data-testid="codemirror-editor"
    />
  );
}
