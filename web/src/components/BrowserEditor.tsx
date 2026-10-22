import { lazy, Suspense, useRef } from "react";
import { EditorFileTree } from "./EditorFileTree";
import type { TreeDirectories } from "./editorTree";
import { ControlButton } from "./ControlElements";
import type { FileRef } from "./fileRefs";
import "./BrowserEditor.css";

const CodeMirror = lazy(() => import("./CodeMirrorEditor"));
export interface BrowserEditorProps {
  engine?: "codemirror6";
  document?: {
    path: string;
    content: string;
    revision: number;
    selection?: FileRef;
  };
  directories: TreeDirectories;
  onLoadDirectory: (path: string) => void;
  picker: boolean;
  dirty: boolean;
  saving: boolean;
  saveBlocked?: boolean;
  loading: boolean;
  problem?: string;
  remote?: string;
  onPicker: () => void;
  onOpen: (path: string) => void;
  onChange: (content: string) => void;
  onSave: () => void;
  onCompare: () => void;
  onReload: () => void;
  onReconcile: () => void;
}
export function BrowserEditor(p: BrowserEditorProps) {
  const Engine = CodeMirror;
  const pickerButton = useRef<HTMLButtonElement>(null);
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
        <span role="status" data-testid="editor-dirty">
          {p.saving ? "Tallennetaan" : p.dirty ? "Muokattu" : ""}
        </span>
        <ControlButton
          data-testid="editor-save"
          size="row"
          onPress={p.onSave}
          isDisabled={!p.dirty || p.saving || p.loading || p.saveBlocked}
        >
          Tallenna
        </ControlButton>
      </div>
      <div className="ah-browser-body">
        <EditorFileTree
          visible={p.picker}
          directories={p.directories}
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
            data-testid="editor-compare"
            size="row"
            onPress={p.onCompare}
            isDisabled={p.loading || p.saving}
          >
            Lue palvelimelta vertailuun
          </ControlButton>
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
      {p.remote !== undefined && (
        <section
          className="ah-browser-compare"
          aria-label="Palvelimelta luettu versio"
          data-testid="editor-comparison"
        >
          <pre>{p.remote}</pre>
          <ControlButton
            data-testid="editor-reconcile"
            size="row"
            onPress={p.onReconcile}
          >
            Käytä luettua versiota pohjana, säilytä oma teksti
          </ControlButton>
        </section>
      )}
      <p className="ah-browser-warning">
        Myös agentit voivat muokata tiedostoa. Tallennus tarkistaa muutokset,
        mutta ei lukitse natiivityökaluja.
      </p>
    </div>
  );
}
