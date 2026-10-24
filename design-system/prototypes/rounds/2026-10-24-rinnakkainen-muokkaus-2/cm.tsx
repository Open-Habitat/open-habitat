// Production CodeMirrorEditor with the round's merge state. The state lives in
// the editor, not beside it, so CodeMirror's own history handles it: bringing
// the agent's changes in is one isolated history event, and Ctrl+Z undoes it
// together with its highlights and open conflicts (Ctrl+Y or Ctrl+Shift+Z brings them
// back). Picking Sinun / Agentin / Molemmat on a conflict is an ordinary
// undoable edit too.
import {
  type ChangeSet,
  Compartment,
  EditorState,
  type Range,
  StateEffect,
  StateField,
  Text,
  Transaction,
} from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  invertedEffects,
  isolateHistory,
  redo,
  undo,
} from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import {
  Decoration,
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  WidgetType,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { type MutableRefObject, type ReactNode, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { editorGrammar } from "../../../../web/src/components/editorGrammar";
import { type Merged, lineChanges } from "./merge";

export type Source = "agent" | "disk";
export type Pick = "mine" | "theirs" | "both";
export type ConflictMark = { id: number; from: number; to: number; mine: string[]; theirs: string[] };
export type MergeState = {
  source: Source;
  imported: boolean;
  /** Agent changes brought in, counted at import. */
  count: number;
  agent: { from: number; to: number }[];
  conflicts: ConflictMark[];
  /** Line starts where a waiting change will land (Rivimerkit only). */
  pending: number[];
};
export const emptyMerge: MergeState = { source: "agent", imported: false, count: 0, agent: [], conflicts: [], pending: [] };

const mapState = (s: MergeState, ch: ChangeSet): MergeState => ({
  ...s,
  agent: s.agent.map((r) => ({ from: ch.mapPos(r.from, -1), to: ch.mapPos(r.to, 1) })),
  conflicts: s.conflicts.map((c) => ({ ...c, from: ch.mapPos(c.from, -1), to: ch.mapPos(c.to, 1) })),
  pending: s.pending.map((p) => ch.mapPos(p, -1)),
});
const setMerge = StateEffect.define<MergeState>({ map: (v, ch) => mapState(v, ch as ChangeSet) });
const mergeField = StateField.define<MergeState>({
  create: () => emptyMerge,
  update(value, tr) {
    let next = tr.docChanged ? mapState(value, tr.changes) : value;
    for (const e of tr.effects) if (e.is(setMerge)) next = e.value;
    return next;
  },
});
// Undo restores the state before the event. A waiting change is not part of
// the history: undoing the import does not make it wait again.
const undoMerge = invertedEffects.of((tr) =>
  tr.effects.some((e) => e.is(setMerge)) && tr.docChanged
    ? [setMerge.of({ ...tr.startState.field(mergeField), pending: [] })]
    : [],
);

/** The round draws the conflict card with production controls. */
export type ConflictRenderer = (c: ConflictMark, source: Source, pick: (p: Pick) => void) => ReactNode;
class ConflictWidget extends WidgetType {
  root?: Root;
  constructor(
    readonly c: ConflictMark,
    readonly source: Source,
    readonly render: ConflictRenderer,
  ) {
    super();
  }
  eq(o: ConflictWidget) {
    return o.c.id === this.c.id && o.source === this.source;
  }
  toDOM(view: EditorView) {
    const dom = document.createElement("div");
    dom.className = "cfe-cw-host";
    this.root = createRoot(dom);
    this.root.render(this.render(this.c, this.source, (p) => resolve(view, this.c.id, p)));
    return dom;
  }
  destroy() {
    const r = this.root;
    queueMicrotask(() => r?.unmount());
  }
}
const pendingTag = Decoration.widget({
  side: 1,
  widget: new (class extends WidgetType {
    toDOM() {
      const s = document.createElement("span");
      s.className = "cfe-pending-tag";
      s.textContent = "odottaa";
      return s;
    }
  })(),
});

function decorations(render: ConflictRenderer) {
  return EditorView.decorations.compute([mergeField], (state) => {
    const s = state.field(mergeField), doc = state.doc, out: Range<Decoration>[] = [];
    const lines = (from: number, to: number, cls: string) => {
      for (let n = doc.lineAt(from).number; n <= doc.lineAt(Math.max(from, to)).number; n++)
        out.push(Decoration.line({ class: cls }).range(doc.line(n).from));
    };
    for (const r of s.agent) lines(r.from, r.to, "cfe-mark-agent");
    for (const c of s.conflicts) {
      const at = doc.lineAt(c.from).from;
      out.push(Decoration.widget({ block: true, side: -1, widget: new ConflictWidget(c, s.source, render) }).range(at));
      if (c.mine.length) lines(c.from, c.to, "cfe-mark-conflict");
    }
    for (const p of s.pending) {
      const line = doc.lineAt(p);
      out.push(Decoration.line({ class: "cfe-mark-pending" }).range(line.from));
      out.push(pendingTag.range(line.to));
    }
    return Decoration.set(out, true);
  });
}

function resolve(view: EditorView, id: number, pick: Pick) {
  const s = view.state.field(mergeField), c = s.conflicts.find((x) => x.id === id);
  if (!c) return;
  const chosen = pick === "mine" ? c.mine : pick === "theirs" ? c.theirs : [...c.mine, ...c.theirs];
  const text = chosen.join("\n");
  // A conflict with no lines of the person's own is an insertion before c.from.
  const spec = c.mine.length ? { from: c.from, to: c.to, insert: text } : { from: c.from, insert: text ? `${text}\n` : "" };
  const changes = view.state.changes(spec);
  const next = mapState({ ...s, conflicts: s.conflicts.filter((x) => x.id !== id) }, changes);
  if (pick !== "mine" && c.theirs.length) {
    const from = pick === "both" && c.mine.length ? c.from + c.mine.join("\n").length + 1 : c.from;
    next.agent = [...next.agent, { from, to: from + c.theirs.join("\n").length }];
  }
  view.dispatch({ changes, effects: setMerge.of(next), userEvent: "select.conflict" });
  view.focus();
}

export type EditorApi = {
  doc: () => string;
  merge: () => MergeState;
  /** Brings a merge into the buffer as one undoable event. */
  bring: (m: Merged, source: Source) => void;
  /** Rivimerkit: marks where the waiting changes will land (not undoable). */
  showPending: (lines: number[], source: Source) => void;
  /** After a save the highlights have done their job. */
  clear: () => void;
  undo: () => void;
  redo: () => void;
  /** Review aid: types into a line as a person would. */
  type: (line: number, text: string) => void;
};

const theme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "var(--ah-surface)", color: "var(--ah-ink)" },
  ".cm-scroller": { fontFamily: "var(--ah-mono)", overflow: "auto" },
  ".cm-content": { caretColor: "var(--ah-ink)" },
  ".cm-cursor": { borderLeftColor: "var(--ah-ink)" },
  ".cm-gutters": { backgroundColor: "var(--ah-surface-2)", color: "var(--ah-muted)", borderColor: "var(--ah-line)" },
  "&.cm-focused": { outline: "2px solid var(--ah-focus)", outlineOffset: "-2px" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--ah-accent-soft)",
  },
  ".cm-activeLine": { backgroundColor: "var(--ah-hover)" },
});
const syntax = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.keyword, color: "var(--ah-syntax-keyword)" },
    { tag: [tags.string, tags.regexp], color: "var(--ah-syntax-string)" },
    { tag: [tags.number, tags.bool], color: "var(--ah-syntax-number)" },
    {
      tag: [tags.heading, tags.function(tags.variableName), tags.typeName, tags.tagName, tags.attributeName, tags.propertyName],
      color: "var(--ah-syntax-title)",
    },
    { tag: tags.strong, fontWeight: "bold" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.link, color: "var(--ah-syntax-title)", textDecoration: "underline" },
    { tag: tags.comment, color: "var(--ah-syntax-comment)" },
  ]),
);

let nextConflict = 1;

/** Trusted bundled engine; repository text is only an EditorState document.
 * No preview, project plugin, language server or execution path exists. */
export default function CodeMirrorEditor({
  content,
  path,
  onChange,
  onSave,
  disabled = false,
  api,
  renderConflict,
}: {
  content: string;
  path: string;
  /** `typed` is true when the person (not an import or a pick) changed the text. */
  onChange: (value: string, merge: MergeState, typed: boolean) => void;
  onSave: () => void;
  disabled?: boolean;
  api: MutableRefObject<EditorApi | undefined>;
  renderConflict: ConflictRenderer;
}) {
  const parent = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onChange, onSave });
  callbacks.current = { onChange, onSave };
  const editable = useRef(new Compartment());
  const view = useRef<EditorView | undefined>(undefined);
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
          mergeField,
          decorations(renderConflict),
          lineNumbers(),
          highlightActiveLine(),
          history(),
          undoMerge,
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
          EditorView.updateListener.of((u) => {
            const changed = u.state.field(mergeField) !== u.startState.field(mergeField);
            if (!u.docChanged && !changed) return;
            const typed = u.transactions.some(
              (tr) => tr.docChanged && (tr.isUserEvent("input") || tr.isUserEvent("delete")),
            );
            callbacks.current.onChange(u.state.doc.toString(), u.state.field(mergeField), typed);
          }),
        ],
      }),
    });
    view.current = editor;
    api.current = {
      doc: () => editor.state.doc.toString(),
      merge: () => editor.state.field(mergeField),
      bring(m, source) {
        const target = Text.of(m.text.split("\n"));
        const changes = editor.state.changes(lineChanges(editor.state.doc.toString(), m.text));
        const line = (n: number) => target.line(Math.min(n, target.lines));
        const state: MergeState = {
          source,
          imported: true,
          count: m.agent.length + m.conflicts.length,
          agent: m.agent.map(([a, b]) => ({ from: line(a + 1).from, to: line(b).to })),
          conflicts: m.conflicts.map((c) => ({
            id: nextConflict++,
            from: line(c.line + 1).from,
            to: c.mine.length ? line(c.line + c.mine.length).to : line(c.line + 1).from,
            mine: c.mine,
            theirs: c.theirs,
          })),
          pending: [],
        };
        editor.dispatch({
          changes,
          effects: setMerge.of(state),
          annotations: [isolateHistory.of("full"), Transaction.userEvent.of("import")],
        });
      },
      showPending(lines, source) {
        const doc = editor.state.doc;
        editor.dispatch({
          effects: setMerge.of({ ...editor.state.field(mergeField), source, pending: lines.map((n) => doc.line(Math.min(n + 1, doc.lines)).from) }),
          annotations: Transaction.addToHistory.of(false),
        });
      },
      clear() {
        editor.dispatch({ effects: setMerge.of(emptyMerge), annotations: Transaction.addToHistory.of(false) });
      },
      undo: () => {
        undo(editor);
      },
      redo: () => {
        redo(editor);
      },
      type(n, text) {
        const at = editor.state.doc.line(Math.min(n, editor.state.doc.lines)).to;
        editor.dispatch({ changes: { from: at, insert: text }, selection: { anchor: at + text.length }, userEvent: "input.type" });
      },
    };
    let active = true;
    void editorGrammar(path)
      .then((extension) => {
        if (active) editor.dispatch({ effects: language.reconfigure(extension) });
      })
      // A failed chunk must not disable editing or saving the plain document.
      .catch(() => {});
    return () => {
      active = false;
      view.current = undefined;
      api.current = undefined;
      editor.destroy();
    };
    // The controller remounts this view on document replacement, not each keystroke.
  }, [path]);
  useEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure(EditorState.readOnly.of(disabled)),
    });
  }, [disabled]);
  return <div className="ah-codemirror" ref={parent} data-testid="codemirror-editor" />;
}
