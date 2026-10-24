// Production CodeMirrorEditor with two round-only additions, so the
// directions that bring the agent's text into the buffer can show it:
// `marks` decorates whole lines, and `patch` applies a line-level change as
// one transaction, keeping the cursor and undo history (Ctrl+Z undoes it).
import {
  Compartment,
  EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";
import { diff } from "./diff";

export type LineMark = { line: number; kind: "agent" | "conflict" };
const setMarks = StateEffect.define<LineMark[]>();
const marksField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    let next = value.map(tr.changes);
    for (const e of tr.effects)
      if (e.is(setMarks)) {
        const b = new RangeSetBuilder<Decoration>();
        for (const m of [...e.value].sort((x, y) => x.line - y.line))
          if (m.line <= tr.state.doc.lines)
            b.add(
              tr.state.doc.line(m.line).from,
              tr.state.doc.line(m.line).from,
              Decoration.line({ class: `cfe-mark-${m.kind}` }),
            );
        next = b.finish();
      }
    return next;
  },
  provide: (f) => EditorView.decorations.from(f),
});
import { editorGrammar } from "../../../../web/src/components/editorGrammar";
import type { FileRef } from "../../../../web/src/components/fileRefs";

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
      tag: [
        tags.heading,
        tags.function(tags.variableName),
        tags.typeName,
        tags.tagName,
        tags.attributeName,
        tags.propertyName,
      ],
      color: "var(--ah-syntax-title)",
    },
    { tag: tags.strong, fontWeight: "bold" },
    { tag: tags.emphasis, fontStyle: "italic" },
    {
      tag: tags.link,
      color: "var(--ah-syntax-title)",
      textDecoration: "underline",
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
  marks = [],
  patch,
}: {
  marks?: LineMark[];
  patch?: { id: number; text: string };
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
          marksField,
          lineNumbers(),
          highlightActiveLine(),
          history(),
          language.of([]),
          editable.current.of(EditorState.readOnly.of(disabled)),
          EditorView.contentAttributes.of({
            tabindex: "0",
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
    void editorGrammar(path)
      .then((extension) => {
        if (active)
          editor.dispatch({ effects: language.reconfigure(extension) });
      })
      // A failed chunk must not disable editing or saving the plain document.
      .catch(() => {});
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
  // The patch runs first, so marks can name the lines it brings in.
  useEffect(() => {
    const editor = view.current;
    if (!editor || !patch) return;
    const now = editor.state.doc.toString();
    if (now === patch.text) return;
    const lines = now.split("\n");
    const offset = (line: number) =>
      lines.slice(0, line).reduce((n, l) => n + l.length + 1, 0);
    const n = lines.length;
    const changes = diff(now, patch.text).map((h) => {
      if (h.from >= n)
        return { from: now.length, insert: `\n${h.lines.join("\n")}` };
      if (h.to < n)
        return {
          from: offset(h.from),
          to: offset(h.to),
          insert: h.lines.map((l) => `${l}\n`).join(""),
        };
      // Through the last line, which has no newline of its own.
      if (!h.lines.length && h.from > 0)
        return { from: offset(h.from) - 1, to: now.length, insert: "" };
      return { from: offset(h.from), to: now.length, insert: h.lines.join("\n") };
    });
    editor.dispatch({ changes });
  }, [patch?.id]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Marks are compared by value.
  useEffect(() => {
    view.current?.dispatch({ effects: setMarks.of(marks) });
  }, [JSON.stringify(marks)]);
  return (
    <div
      className="ah-codemirror"
      ref={parent}
      data-testid="codemirror-editor"
    />
  );
}
