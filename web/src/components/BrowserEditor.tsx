import {
  lazy,
  type RefObject,
  Suspense,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { ControlButton } from "./ControlElements";
import { EditorFileTree } from "./EditorFileTree";
import type { EditorChange, EditorMergeApi, MergeSource } from "./editorMerge";
import type { TreeDirectories } from "./editorTree";
import type { FileRef } from "./fileRefs";
import { Markdown } from "./Markdown";
import "./BrowserEditor.css";

const CodeMirror = lazy(() => import("./CodeMirrorEditor"));
const markdownPath = (path?: string) =>
  !!path && /\.(md|markdown)$/i.test(path);
/** Beside the text, or in its place. A narrow editor shows either one. */
type Preview = "off" | "side" | "only";
// Cmd on Apple keyboards, where Ctrl+K is CodeMirror's delete-to-line-end.
const mod = (e: KeyboardEvent) =>
  /Mac|iPhone|iPad/.test(navigator.platform) ? e.metaKey : e.ctrlKey;
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
  const root = useRef<HTMLDivElement>(null);
  const markdown = markdownPath(p.document?.path);
  const [preview, setPreview] = useState<Preview>("off");
  const shown = markdown ? preview : "off";
  // The preview follows the buffer, not the file on disk; a large file
  // renders behind typing instead of on every keystroke.
  const [live, setLive] = useState({ revision: -1, text: "" });
  const text =
    p.document && live.revision === p.document.revision
      ? live.text
      : (p.document?.content ?? "");
  const rendered = useDeferredValue(text);
  const toggle = (want: Exclude<Preview, "off">) => {
    const next = shown === want ? "off" : want;
    const pane = (name: string) =>
      root.current?.querySelector<HTMLElement>(`.ah-browser-${name}`);
    const holder = ["source", "preview"].find((name) =>
      pane(name)?.contains(document.activeElement),
    );
    setPreview(next);
    // Hiding the pane that has focus must not drop it on the page: it moves
    // to the pane that is left.
    requestAnimationFrame(() => {
      const source = pane("source");
      if (
        holder === "source" &&
        source &&
        getComputedStyle(source).display === "none"
      )
        pane("preview")?.focus();
      else if (holder === "preview" && !pane("preview"))
        source?.querySelector<HTMLElement>(".cm-content")?.focus();
    });
  };
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;
  // VS Code's keys: Ctrl/Cmd+Shift+V opens the preview in place of the text,
  // Ctrl/Cmd+K then V beside it. Captured before CodeMirror sees them.
  useEffect(() => {
    const el = root.current;
    if (!el || !markdown) return;
    let chord = false;
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const wasChord = chord;
      chord = false;
      if (wasChord && key === "v" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        toggleRef.current("side");
      } else if (mod(e) && e.shiftKey && !e.altKey && key === "v") {
        e.preventDefault();
        e.stopPropagation();
        toggleRef.current("only");
      } else if (mod(e) && !e.shiftKey && !e.altKey && key === "k") {
        e.preventDefault();
        e.stopPropagation();
        chord = true;
      } else if (wasChord && ["control", "meta"].includes(key)) chord = true;
    };
    el.addEventListener("keydown", onKey, true);
    return () => el.removeEventListener("keydown", onKey, true);
  }, [markdown]);
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
      ref={root}
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
        {markdown ? (
          <ControlButton
            data-testid="editor-preview-toggle"
            size="row"
            variant="quiet"
            // Pressed means shown, whichever way: pressing closes it.
            onPress={() => toggle(shown === "off" ? "side" : shown)}
            aria-pressed={shown !== "off"}
            aria-keyshortcuts="Control+Shift+V Meta+Shift+V"
          >
            Esikatselu
          </ControlButton>
        ) : null}
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
        <div className="ah-browser-document" data-preview={shown}>
          {p.document ? (
            <>
              <div className="ah-browser-source">
                <Suspense
                  fallback={<p role="status">Ladataan tekstieditoria</p>}
                >
                  <Engine
                    key={`${p.engine}:${p.document.revision}`}
                    path={p.document.path}
                    content={p.document.content}
                    selection={p.document.selection}
                    onChange={(content, change) => {
                      if (p.document)
                        setLive({
                          revision: p.document.revision,
                          text: content,
                        });
                      p.onChange(content, change);
                    }}
                    onSave={p.onSave}
                    disabled={p.saving || p.loading}
                    mergeApi={p.mergeApi}
                  />
                </Suspense>
              </div>
              {shown !== "off" ? (
                // A scrolling region is reachable from the keyboard.
                <section
                  className="ah-browser-preview"
                  data-testid="editor-preview"
                  aria-label="Esikatselu"
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: the region scrolls.
                  tabIndex={0}
                >
                  <Markdown text={rendered} />
                </section>
              ) : null}
            </>
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
