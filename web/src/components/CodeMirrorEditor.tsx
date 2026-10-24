// The browser editor's engine. Changes someone else wrote to the open file
// live here as editor state rather than beside it, so CodeMirror's own history
// handles them: bringing them in is one isolated history event, and Ctrl+Z
// undoes it together with its highlights and open conflicts (Ctrl+Y or
// Ctrl+Shift+Z brings them back). Picking a side on a conflict is an ordinary
// undoable edit too. Lines where waiting changes will land are marked but are
// not history: undoing an import does not make it wait again.
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
  undo,
  undoDepth,
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
import { type RefObject, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { type ConflictPick, EditorConflict } from "./EditorConflict";
import { editorGrammar } from "./editorGrammar";
import {
  type ConflictMark,
  type EditorChange,
  type EditorMergeApi,
  emptyMerge,
  lineChanges,
  type MergeSource,
  type MergeState,
} from "./editorMerge";

export type { EditorChange, EditorMergeApi, MergeState };
import type { FileRef } from "./fileRefs";

const mapState = (s: MergeState, ch: ChangeSet): MergeState => ({
  ...s,
  incoming: s.incoming.map((r) => ({
    from: ch.mapPos(r.from, -1),
    to: ch.mapPos(r.to, 1),
  })),
  conflicts: s.conflicts.map((c) => ({
    ...c,
    from: ch.mapPos(c.from, -1),
    to: ch.mapPos(c.to, 1),
  })),
  pending: s.pending.map((p) => ch.mapPos(p, -1)),
});
const setMerge = StateEffect.define<MergeState>({
  map: (value, changes) => mapState(value, changes as ChangeSet),
});
const mergeField = StateField.define<MergeState>({
  create: () => emptyMerge,
  update(value, tr) {
    let next = tr.docChanged ? mapState(value, tr.changes) : value;
    for (const e of tr.effects) if (e.is(setMerge)) next = e.value;
    return next;
  },
});
// Undo restores the merge state from before the event, and redo the one from
// before the undo.
const undoMerge = invertedEffects.of((tr) =>
  tr.docChanged && tr.effects.some((e) => e.is(setMerge))
    ? [setMerge.of({ ...tr.startState.field(mergeField), pending: [] })]
    : [],
);

class ConflictWidget extends WidgetType {
  root?: Root;
  constructor(
    readonly conflict: ConflictMark,
    readonly source: MergeSource,
  ) {
    super();
  }
  eq(other: ConflictWidget) {
    return (
      other.conflict.id === this.conflict.id && other.source === this.source
    );
  }
  toDOM(view: EditorView) {
    const dom = document.createElement("div");
    dom.className = "ah-merge-conflict-host";
    dom.dataset.testid = "conflict";
    this.root = createRoot(dom);
    this.root.render(
      <EditorConflict
        theirs={this.conflict.theirs}
        source={this.source}
        onPick={(pick) => resolve(view, this.conflict.id, pick)}
      />,
    );
    return dom;
  }
  ignoreEvent() {
    return true;
  }
  destroy() {
    const root = this.root;
    // React must not unmount synchronously inside CodeMirror's update.
    queueMicrotask(() => root?.unmount());
  }
}
class PendingTag extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const tag = document.createElement("span");
    tag.className = "ah-merge-pending-tag";
    tag.dataset.testid = "pending-line";
    tag.textContent = "odottaa";
    return tag;
  }
}
const pendingTag = Decoration.widget({ side: 1, widget: new PendingTag() });

const mergeDecorations = EditorView.decorations.compute(
  [mergeField],
  (state) => {
    const s = state.field(mergeField);
    const doc = state.doc;
    const out: Range<Decoration>[] = [];
    const lines = (from: number, to: number, className: string) => {
      const last = doc.lineAt(Math.max(from, to)).number;
      for (let n = doc.lineAt(from).number; n <= last; n++)
        out.push(Decoration.line({ class: className }).range(doc.line(n).from));
    };
    for (const r of s.incoming)
      if (r.to > r.from) lines(r.from, r.to, "ah-merge-incoming");
    for (const c of s.conflicts) {
      out.push(
        Decoration.widget({
          block: true,
          side: -1,
          widget: new ConflictWidget(c, s.source),
        }).range(doc.lineAt(c.from).from),
      );
      if (c.mine.length) lines(c.from, c.to, "ah-merge-mine");
    }
    for (const p of s.pending) {
      const line = doc.lineAt(p);
      out.push(Decoration.line({ class: "ah-merge-pending" }).range(line.from));
      out.push(pendingTag.range(line.to));
    }
    return Decoration.set(out, true);
  },
);

function resolve(view: EditorView, id: number, pick: ConflictPick) {
  const s = view.state.field(mergeField);
  const c = s.conflicts.find((x) => x.id === id);
  if (!c) return;
  const chosen =
    pick === "mine"
      ? c.mine
      : pick === "theirs"
        ? c.theirs
        : [...c.mine, ...c.theirs];
  const text = chosen.join("\n");
  // A conflict with no lines of the person's own is an insertion at c.from.
  const changes = view.state.changes(
    c.mine.length
      ? { from: c.from, to: c.to, insert: text }
      : { from: c.from, insert: chosen.length ? `${text}\n` : "" },
  );
  const next = mapState(
    { ...s, conflicts: s.conflicts.filter((x) => x.id !== id) },
    changes,
  );
  if (pick !== "mine" && c.theirs.length) {
    const from =
      pick === "both" && c.mine.length
        ? c.from + c.mine.join("\n").length + 1
        : c.from;
    next.incoming = [
      ...next.incoming,
      { from, to: from + c.theirs.join("\n").length },
    ];
  }
  view.dispatch({
    changes,
    effects: setMerge.of(next),
    userEvent: "select.conflict",
  });
  view.focus();
}

let nextConflict = 1;

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
  mergeApi,
}: {
  content: string;
  path: string;
  selection?: FileRef;
  onChange: (value: string, change: EditorChange) => void;
  onSave: () => void;
  disabled?: boolean;
  mergeApi?: RefObject<EditorMergeApi | undefined>;
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
          mergeField,
          mergeDecorations,
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
          EditorView.updateListener.of((update) => {
            const merge = update.state.field(mergeField);
            if (
              !update.docChanged &&
              merge === update.startState.field(mergeField)
            )
              return;
            callbacks.current.onChange(update.state.doc.toString(), {
              merge,
              typed: update.transactions.some(
                (tr) =>
                  tr.docChanged &&
                  (tr.isUserEvent("input") || tr.isUserEvent("delete")),
              ),
              importLatest:
                merge.imported && undoDepth(update.state) === merge.depth,
            });
          }),
        ],
      }),
    });
    view.current = editor;
    if (mergeApi)
      mergeApi.current = {
        text: () => editor.state.doc.toString(),
        merge: () => editor.state.field(mergeField),
        bring(merged, source) {
          const target = Text.of(merged.text.split("\n"));
          const line = (n: number) => target.line(Math.min(n, target.lines));
          editor.dispatch({
            changes: lineChanges(editor.state.doc.toString(), merged.text),
            effects: setMerge.of({
              source,
              imported: true,
              count: merged.incoming.length + merged.conflicts.length,
              depth: undoDepth(editor.state) + 1,
              incoming: merged.incoming.map(([a, b]) => ({
                from: line(a + 1).from,
                to: line(b).to,
              })),
              conflicts: merged.conflicts.map((c) => ({
                id: nextConflict++,
                from: line(c.line + 1).from,
                to: c.mine.length
                  ? line(c.line + c.mine.length).to
                  : line(c.line + 1).from,
                mine: c.mine,
                theirs: c.theirs,
              })),
              pending: [],
            }),
            annotations: [
              isolateHistory.of("full"),
              Transaction.userEvent.of("import"),
            ],
          });
        },
        showPending(lines, source) {
          const doc = editor.state.doc;
          editor.dispatch({
            effects: setMerge.of({
              ...editor.state.field(mergeField),
              source,
              pending: lines.map(
                (n) => doc.line(Math.min(n + 1, doc.lines)).from,
              ),
            }),
            annotations: Transaction.addToHistory.of(false),
          });
        },
        follow(text) {
          editor.dispatch({
            changes: lineChanges(editor.state.doc.toString(), text),
            effects: setMerge.of(emptyMerge),
            annotations: [
              Transaction.addToHistory.of(false),
              Transaction.userEvent.of("import.follow"),
            ],
          });
        },
        clear() {
          editor.dispatch({
            effects: setMerge.of(emptyMerge),
            annotations: Transaction.addToHistory.of(false),
          });
        },
        undo() {
          undo(editor);
          editor.focus();
        },
      };
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
      if (mergeApi) mergeApi.current = undefined;
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
