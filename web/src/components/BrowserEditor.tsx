import { lazy, Suspense } from "react";
import { ControlButton } from "./ControlElements";
import type { FileRef } from "./fileRefs";
import "./BrowserEditor.css";
const CodeMirror = lazy(() => import("./CodeMirrorEditor"));
export interface BrowserEditorProps {
  document?: {
    path: string;
    content: string;
    revision: number;
    selection?: FileRef;
  };
  directory: string;
  entries: { name: string; kind: "file" | "directory" | "unsupported" }[];
  truncated: boolean;
  picker: boolean;
  dirty: boolean;
  saving: boolean;
  saveBlocked?: boolean;
  loading: boolean;
  problem?: string;
  remote?: string;
  onPicker: () => void;
  onOpen: (name: string, kind: "file" | "directory" | "unsupported") => void;
  onParent: () => void;
  onChange: (content: string) => void;
  onSave: () => void;
  onCompare: () => void;
  onReload: () => void;
  onReconcile: () => void;
}
export function BrowserEditor(p: BrowserEditorProps) {
  return (
    <div
      className="ah-browser-editor"
      data-testid="browser-editor"
      aria-busy={p.loading || p.saving}
    >
      <div className="ah-browser-toolbar">
        <ControlButton
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
        {p.picker && (
          <nav
            aria-label="Työtilan tiedostot"
            className="ah-browser-picker"
            data-testid="editor-file-picker"
          >
            <div>
              <code>{p.directory || "/"}</code>
              <ControlButton
                size="row"
                onPress={p.onPicker}
                aria-label="Sulje tiedostovalitsin"
              >
                Sulje
              </ControlButton>
            </div>
            {p.directory && (
              <ControlButton
                data-testid="editor-parent"
                size="row"
                onPress={p.onParent}
              >
                Ylempi kansio
              </ControlButton>
            )}
            <ul>
              {p.entries.map((entry) => (
                <li key={entry.name}>
                  <ControlButton
                    data-testid="editor-file-entry"
                    size="row"
                    onPress={() => p.onOpen(entry.name, entry.kind)}
                    isDisabled={entry.kind === "unsupported"}
                  >
                    <span aria-hidden="true">
                      {entry.kind === "directory" ? "▸ " : ""}
                    </span>
                    <code>{entry.name}</code>
                  </ControlButton>
                </li>
              ))}
            </ul>
            {p.truncated && (
              <p role="status">
                Vain osa tiedostoista näkyy. Käytä suurille kansioille
                natiivityökaluja.
              </p>
            )}
          </nav>
        )}
        <div className="ah-browser-document">
          {p.document ? (
            <Suspense fallback={<p role="status">Ladataan tekstieditoria</p>}>
              <CodeMirror
                key={p.document.revision}
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
