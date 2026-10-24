import { lazy, type RefObject, Suspense, useRef } from "react";
import type { EditorChange, EditorMergeApi, MergeSource } from "./editorMerge";
import { EditorFileTree } from "./EditorFileTree";
import type { TreeDirectories } from "./editorTree";
import { ControlButton } from "./ControlElements";
import type { FileRef } from "./fileRefs";
import "./BrowserEditor.css";

const CodeMirror = lazy(() => import("./CodeMirrorEditor"));
/** Changes someone else wrote to the open file, as the toolbar shows them. */
export type DiskChanges =
  | { kind: "pending"; source: MergeSource; count: number }
  | {
      kind: "imported";
      source: MergeSource;
      count: number;
      conflicts: number;
      /** The import is the latest change, so undo would take it back. */
      latest: boolean;
    }
  | { kind: "undone"; source: MergeSource };
const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;
export interface BrowserEditorProps {
  engine?: "codemirror6";
  document?: {
    path: string;
    content: string;
    revision: number;
    selection?: FileRef;
  };
  directories: TreeDirectories;
  reveal?: FileRef;
  onLoadDirectory: (path: string) => void;
  picker: boolean;
  dirty: boolean;
  saving: boolean;
  saveBlocked?: boolean;
  loading: boolean;
  problem?: string;
  changes?: DiskChanges;
  /** What the last save did with changes from disk. */
  notice?: string;
  mergeApi?: RefObject<EditorMergeApi | undefined>;
  onPicker: () => void;
  onOpen: (path: string) => void;
  onChange: (content: string, change: EditorChange) => void;
  onSave: () => void;
  onReload: () => void;
  onImportNow: () => void;
  onUndoImport: () => void;
  onReimport: () => void;
}
export function BrowserEditor(p: BrowserEditorProps) {
  const Engine = CodeMirror;
  const pickerButton = useRef<HTMLButtonElement>(null);
  const c = p.changes;
  const agent = c?.source === "agent";
  const conflicts = c?.kind === "imported" ? c.conflicts : 0;
  const state = p.saving
    ? "Tallennetaan"
    : c?.kind === "pending"
      ? `${agent ? "Agentin" : "Levyn"} ${count(c.count, "muutos odottaa", "muutosta odottaa")}`
      : c?.kind === "imported" && conflicts
        ? `Muokattu · ${count(conflicts, "ristiriita", "ristiriitaa")}`
        : c?.kind === "imported"
          ? `Muokattu · ${count(c.count, `${agent ? "agentin" : "levyn"} muutos tuotu`, `${agent ? "agentin" : "levyn"} muutosta tuotu`)}`
          : c?.kind === "undone"
            ? `Muokattu · ilman ${agent ? "agentin" : "levyn"} muutoksia`
            : p.dirty
              ? "Muokattu"
              : "";
  const action =
    p.saving || !c ? undefined : c.kind === "pending" ? (
      <ControlButton
        data-testid="editor-import-now"
        size="row"
        variant="quiet"
        onPress={p.onImportNow}
        aria-label="Tuo nyt; muuten muutokset tuodaan, kun lopetat kirjoittamisen"
      >
        Tuo nyt
      </ControlButton>
    ) : c.kind === "imported" && c.latest ? (
      <ControlButton
        data-testid="editor-undo-import"
        size="row"
        variant="quiet"
        onPress={p.onUndoImport}
      >
        Peru tuonti
      </ControlButton>
    ) : c.kind === "undone" ? (
      <ControlButton
        data-testid="editor-reimport"
        size="row"
        onPress={p.onReimport}
      >
        Tuo uudelleen
      </ControlButton>
    ) : undefined;
  const replacing = c?.kind === "undone" && p.dirty;
  return (
    <div
      className="ah-browser-editor"
      data-testid="browser-editor"
      aria-busy={p.loading || p.saving}
    >
      <div className="ah-browser-toolbar">
        <ControlButton
          ref={pickerButton}
          data-testid="editor-picker"
          size="row"
          onPress={p.onPicker}
          aria-expanded={p.picker}
        >
          Tiedostot
        </ControlButton>
        <code className="ah-browser-filename">
          {p.document?.path ?? "Valitse tiedosto"}
        </code>
        <span
          className="ah-browser-state"
          data-testid="editor-changes"
          data-changes={c?.kind}
          data-source={c?.source}
          data-risk={c?.kind === "undone" || conflicts > 0 || undefined}
        >
          {c?.kind === "pending" ? (
            <span className="ah-merge-dot" aria-hidden="true" />
          ) : null}
          <span role="status" data-testid="editor-dirty">
            {state}
          </span>
          {action}
        </span>
        <ControlButton
          data-testid="editor-save"
          size="row"
          variant={replacing ? "danger" : "secondary"}
          onPress={p.onSave}
          isDisabled={
            !p.dirty || p.saving || p.loading || p.saveBlocked || conflicts > 0
          }
          aria-describedby={conflicts ? "ah-editor-save-reason" : undefined}
        >
          {replacing
            ? agent
              ? "Tallenna ja korvaa agentin versio"
              : "Tallenna ja korvaa levyn versio"
            : "Tallenna"}
        </ControlButton>
      </div>
      {conflicts ? (
        <p
          className="ah-browser-save-reason"
          id="ah-editor-save-reason"
          data-testid="editor-save-reason"
        >
          Tallennus odottaa: valitse{" "}
          {count(
            conflicts,
            "ristiriitaiselle riville",
            "ristiriitaiselle riville",
          )}{" "}
          Sinun, {agent ? "Agentin" : "Levyn"} tai Molemmat.
        </p>
      ) : p.notice ? (
        <p
          className="ah-browser-notice"
          role="status"
          data-testid="editor-notice"
        >
          {p.notice}
        </p>
      ) : null}
      <div className="ah-browser-body">
        <EditorFileTree
          visible={p.picker}
          directories={p.directories}
          reveal={p.reveal}
          openPath={p.document?.path}
          dirty={p.dirty}
          onLoad={p.onLoadDirectory}
          onOpen={p.onOpen}
          onClose={() => {
            p.onPicker();
            pickerButton.current?.focus();
          }}
        />
        <div className="ah-browser-document">
          {p.document ? (
            <Suspense fallback={<p role="status">Ladataan tekstieditoria</p>}>
              <Engine
                key={`${p.engine}:${p.document.revision}`}
                path={p.document.path}
                content={p.document.content}
                selection={p.document.selection}
                onChange={p.onChange}
                onSave={p.onSave}
                disabled={p.saving || p.loading}
                mergeApi={p.mergeApi}
              />
            </Suspense>
          ) : (
            <p role="status">
              Avaa tekstitiedosto valitsimesta tai keskustelun linkistä.
            </p>
          )}
        </div>
      </div>
      {p.problem && (
        <div
          className="ah-browser-problem"
          role="status"
          data-testid="editor-problem"
        >
          <p>{p.problem}</p>
          <ControlButton
            data-testid="editor-reload"
            size="row"
            onPress={p.onReload}
            isDisabled={p.loading || p.saving}
          >
            Hylkää muutokset ja lataa
          </ControlButton>
        </div>
      )}
    </div>
  );
}
