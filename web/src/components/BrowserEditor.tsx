import {
  lazy,
  type ReactNode,
  type RefObject,
  Suspense,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { useText } from "../i18n";
import { browserEditorText } from "../text/browserEditor";
import type { EditorPlaceApi } from "./CodeMirrorEditor";
import { ControlButton, controlStyles } from "./ControlElements";
import { EditorFileTree } from "./EditorFileTree";
import type { EditorChange, EditorMergeApi, MergeSource } from "./editorMerge";
import {
  type FileView,
  fileView,
  headingLines,
  heightToLine,
  lineToHeight,
} from "./editorPreview";
import type { TreeDirectories } from "./editorTree";
import type { FileRef } from "./fileRefs";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import "./BrowserEditor.css";

const CodeMirror = lazy(() => import("./CodeMirrorEditor"));
// Tables, pictures and pages load with the first such file.
const loadFilePreview = () => import("./EditorFilePreview");
const FilePreview = lazy(loadFilePreview);
const apple = () => /Mac|iPhone|iPad/.test(navigator.platform);
// Cmd on Apple keyboards, where Ctrl+E is CodeMirror's end of line.
const mod = (e: KeyboardEvent) => (apple() ? e.metaKey : e.ctrlKey);
// Matched by `code`, so a layout or Option never changes the key. Ctrl/⌘+Alt+P
// rather than Ctrl/⌘+E, which browsers keep for themselves (a sidebar, the
// address bar's search) before the page sees it; Shift+V is VS Code's. AltGr
// arrives as Ctrl+Alt on Windows and is left alone.
const previewKey = (e: KeyboardEvent) =>
  mod(e) &&
  (e.altKey
    ? !e.shiftKey && e.code === "KeyP" && !e.getModifierState("AltGraph")
    : e.shiftKey && e.code === "KeyV");
const saveKey = (e: KeyboardEvent) =>
  mod(e) && !e.altKey && !e.shiftKey && e.code === "KeyS";
/** Mounted with the preview's content, once a lazy renderer has loaded. */
function Mounted({
  then,
  children,
}: {
  then: () => void;
  children: ReactNode;
}) {
  const ran = useRef(then);
  useEffect(() => {
    ran.current();
  }, []);
  return children;
}
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
export interface BrowserEditorProps {
  /** Workspace layout controls, alongside the document's own actions. */
  toolbarActions?: ReactNode;
  engine?: "codemirror6";
  document?: {
    path: string;
    content: string;
    revision: number;
    selection?: FileRef;
  };
  directories: TreeDirectories;
  reveal?: FileRef;
  onLoadDirectory: (path: string, background?: boolean) => void;
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
// Same place both ways: Markdown maps by its headings, in the same order in
// the text and the rendered document, and by the relative place inside a
// section; a table row carries its text line. A picture or page is one view.
const top = (el: Element, from: Element) =>
  el.getBoundingClientRect().top - from.getBoundingClientRect().top;
function markdownGeometry(preview: HTMLElement, text: string) {
  const doc = preview.querySelector(".ah-markdown");
  if (!doc) return;
  const base = top(doc, preview) + preview.scrollTop;
  const heights = Array.from(
    doc.querySelectorAll("h1, h2, h3, h4, h5, h6"),
    (h) => top(h, doc),
  );
  return {
    base,
    args: [
      text.split("\n").length,
      headingLines(text),
      heights,
      doc.scrollHeight,
    ] as const,
  };
}
// A heading lands a little below the top edge rather than under it.
const breathing = 12;
function previewHeight(
  preview: HTMLElement,
  view: FileView | undefined,
  text: string,
  line: number,
): number {
  if (view?.kind === "markdown") {
    const g = markdownGeometry(preview, text);
    return g ? g.base + lineToHeight(line, ...g.args) - breathing : 0;
  }
  if (view?.kind !== "table") return 0;
  const rows = Array.from(
    preview.querySelectorAll<HTMLElement>("tbody tr[data-line]"),
  );
  const row = rows.findLast((r) => Number(r.dataset.line) <= line);
  const head = preview.querySelector("thead");
  if (!row || row === rows[0]) return 0;
  return (
    top(row, preview) +
    preview.scrollTop -
    (head?.getBoundingClientRect().height ?? 0)
  );
}
function previewLine(
  preview: HTMLElement,
  view: FileView | undefined,
  text: string,
): number {
  if (!preview.scrollTop) return 0;
  if (view?.kind === "markdown") {
    const g = markdownGeometry(preview, text);
    return g
      ? heightToLine(preview.scrollTop + breathing - g.base, ...g.args)
      : 0;
  }
  if (view?.kind !== "table") return 0;
  // The header cells stick; the row group itself scrolls away.
  const edge = preview
    .querySelector("thead th")
    ?.getBoundingClientRect().bottom;
  if (edge === undefined) return 0;
  const row = Array.from(
    preview.querySelectorAll<HTMLElement>("tbody tr[data-line]"),
  ).find((r) => r.getBoundingClientRect().bottom > edge + 2);
  return row ? Number(row.dataset.line) : 0;
}
export function BrowserEditor(p: BrowserEditorProps) {
  const t = useText(browserEditorText);
  const Engine = CodeMirror;
  const pickerButton = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const place = useRef<EditorPlaceApi | undefined>(undefined);
  const path = p.document?.path;
  const view = fileView(path);
  // The preview belongs to the file it was opened on: another file opens as
  // text. It is shown in place of the text, which stays mounted while
  // hidden, so history and the cursor survive.
  const [previewed, setPreviewed] = useState<string>();
  const shown = !!view && previewed === path;
  // The preview follows the buffer, not the file on disk; a large file
  // renders behind typing instead of on every keystroke.
  const [live, setLive] = useState({ revision: -1, text: "" });
  const text =
    p.document && live.revision === p.document.revision
      ? live.text
      : (p.document?.content ?? "");
  const rendered = useDeferredValue(text);
  const pane = (name: string) =>
    root.current?.querySelector<HTMLElement>(`.ah-browser-${name}`);
  // Where the preview lands when its content has mounted.
  const arrival = useRef<{ line: number; focus: boolean }>(undefined);
  const arrive = () => {
    const a = arrival.current;
    arrival.current = undefined;
    const preview = pane("preview");
    if (!a || !preview) return;
    preview.scrollTop = previewHeight(preview, view, text, a.line);
    if (a.focus) preview.focus({ preventScroll: true });
  };
  /** Text or preview, opening each where the reader was in the other. */
  const show = (preview: boolean) => {
    if (!view || !path || preview === shown) return;
    const holder = ["source", "preview", "toolbar"].find((name) =>
      pane(name)?.contains(document.activeElement),
    );
    const now = pane("preview");
    const line = now
      ? previewLine(now, view, text)
      : (place.current?.topLine() ?? 0);
    if (preview) {
      // Focus moves into the preview unless a toolbar button holds it.
      arrival.current = {
        line,
        focus: holder === "source" || holder === "preview",
      };
      setPreviewed(path);
      return;
    }
    setPreviewed(undefined);
    requestAnimationFrame(() => {
      place.current?.showLine(line);
      // Hiding the part that has focus must not drop it on the page.
      if (holder === "preview")
        pane("source")
          ?.querySelector<HTMLElement>(".cm-content")
          ?.focus({ preventScroll: true });
    });
  };
  const showRef = useRef({ show, shown, save: () => {} });
  // Ctrl/Cmd+Alt+P and VS Code's Ctrl/Cmd+Shift+V switch between text and
  // preview, Esc returns to the text. Captured before CodeMirror sees them;
  // a file without a preview keeps them as the browser's own.
  const previewable = !!view;
  useEffect(() => {
    const el = root.current;
    if (!el || !previewable) return;
    const onKey = (e: KeyboardEvent) => {
      const { show, shown, save } = showRef.current;
      if (previewKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        show(!shown);
      } else if (shown && saveKey(e)) {
        // The text's own Ctrl/Cmd+S is hidden with it.
        e.preventDefault();
        save();
      } else if (
        e.key === "Escape" &&
        shown &&
        !e.defaultPrevented &&
        !(e.target as Element).closest?.(".ah-browser-picker")
      ) {
        e.preventDefault();
        e.stopPropagation();
        show(false);
      }
    };
    el.addEventListener("keydown", onKey, true);
    return () => el.removeEventListener("keydown", onKey, true);
  }, [previewable]);
  // A link to a line asks for the text.
  const selection = p.document?.selection;
  useEffect(() => {
    if (selection) setPreviewed(undefined);
  }, [selection]);
  // A table, picture or page opens without waiting for its renderer.
  useEffect(() => {
    if (view && view.kind !== "markdown") void loadFilePreview();
  }, [view]);
  const c = p.changes;
  const agent = c?.source === "agent";
  const conflicts = c?.kind === "imported" ? c.conflicts : 0;
  const state = p.saving
    ? t.saving
    : c?.kind === "pending"
      ? t.pending(agent, c.count)
      : c?.kind === "imported" && conflicts
        ? t.conflicts(conflicts)
        : c?.kind === "imported"
          ? t.imported(agent, c.count)
          : c?.kind === "undone"
            ? t.undone(agent)
            : p.dirty
              ? t.modified
              : "";
  const action =
    p.saving || !c ? undefined : c.kind === "pending" ? (
      <ControlButton
        data-testid="editor-import-now"
        size="row"
        variant="quiet"
        onPress={p.onImportNow}
        aria-label={t.importNowHint}
      >
        {t.importNow}
      </ControlButton>
    ) : c.kind === "imported" && c.latest ? (
      <ControlButton
        data-testid="editor-undo-import"
        size="row"
        variant="quiet"
        onPress={p.onUndoImport}
      >
        {t.undoImport}
      </ControlButton>
    ) : c.kind === "undone" ? (
      <ControlButton
        data-testid="editor-reimport"
        size="row"
        onPress={p.onReimport}
      >
        {t.reimport}
      </ControlButton>
    ) : undefined;
  const replacing = c?.kind === "undone" && p.dirty;
  const saveDisabled =
    !p.dirty || p.saving || p.loading || p.saveBlocked || conflicts > 0;
  showRef.current = {
    show,
    shown,
    save: () => {
      if (!saveDisabled) p.onSave();
    },
  };
  return (
    <div
      ref={root}
      className="ah-browser-editor"
      data-testid="browser-editor"
      aria-busy={p.loading || p.saving}
    >
      <header className="ah-browser-toolbar" data-testid="editor-header">
        <ControlButton
          ref={pickerButton}
          data-testid="editor-picker"
          size="row"
          onPress={p.onPicker}
          aria-expanded={p.picker}
          aria-label={t.files}
          title={t.files}
        >
          <Icon name="folder" />
        </ControlButton>
        <code className="ah-browser-filename" title={p.document?.path}>
          {p.document?.path ?? t.chooseFile}
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
        {view ? (
          // One choice of two: the text or the file's own preview.
          <fieldset
            aria-label={t.view}
            className={`${controlStyles.segmented} ah-browser-views`}
            data-testid="editor-view"
          >
            <ControlButton
              data-testid="editor-text-toggle"
              size="row"
              variant="quiet"
              presentation="segment"
              aria-label={t.text}
              aria-pressed={!shown}
              aria-keyshortcuts={shown ? "Escape" : undefined}
              title={shown ? t.backToText : t.text}
              onPress={() => show(false)}
            >
              <Icon name="pencil" />
            </ControlButton>
            <ControlButton
              data-testid="editor-preview-toggle"
              size="row"
              variant="quiet"
              presentation="segment"
              aria-label={t.views[view.kind]}
              aria-pressed={shown}
              aria-keyshortcuts="Control+Alt+P Meta+Alt+P Control+Shift+V Meta+Shift+V"
              title={`${t.views[view.kind]} · ${apple() ? "⌥⌘P" : "Ctrl+Alt+P"}`}
              onPress={() => show(true)}
            >
              <Icon name={view.icon} />
            </ControlButton>
          </fieldset>
        ) : null}
        {replacing ? (
          <ControlButton
            data-testid="editor-save"
            size="row"
            variant="danger"
            onPress={p.onSave}
            isDisabled={saveDisabled}
          >
            {agent ? t.saveReplaceAgent : t.saveReplaceDisk}
          </ControlButton>
        ) : (
          // Unsaved changes show beside the path and fill the icon, so the
          // save stays in sight without its word.
          <ControlButton
            data-testid="editor-save"
            size="row"
            variant={p.dirty && !saveDisabled ? "primary" : "secondary"}
            onPress={p.onSave}
            isDisabled={saveDisabled}
            aria-label={t.save}
            title={t.saveWith(apple() ? "⌘S" : "Ctrl+S")}
            aria-describedby={conflicts ? "ah-editor-save-reason" : undefined}
          >
            <Icon name="save" />
          </ControlButton>
        )}
        {p.toolbarActions}
      </header>
      {conflicts ? (
        <p
          className="ah-browser-save-reason"
          id="ah-editor-save-reason"
          data-testid="editor-save-reason"
        >
          {t.saveWaits(conflicts, agent)}
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
        <div
          className="ah-browser-document"
          data-preview={shown ? "only" : "off"}
        >
          {p.document ? (
            <>
              <div className="ah-browser-source">
                <Suspense fallback={<p role="status">{t.loadingEditor}</p>}>
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
                    place={place}
                  />
                </Suspense>
              </div>
              {shown && view ? (
                // A scrolling region is reachable from the keyboard.
                <section
                  className="ah-browser-preview"
                  data-testid="editor-preview"
                  data-kind={view.kind}
                  aria-label={t.views[view.kind]}
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: the region scrolls.
                  tabIndex={0}
                >
                  <Suspense fallback={<p role="status">{t.loadingPreview}</p>}>
                    <Mounted then={arrive}>
                      {view.kind === "markdown" ? (
                        <Markdown text={rendered} document />
                      ) : (
                        <FilePreview
                          kind={view.kind}
                          text={rendered}
                          path={p.document.path}
                        />
                      )}
                    </Mounted>
                  </Suspense>
                </section>
              ) : null}
            </>
          ) : (
            <p role="status">{t.openHint}</p>
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
            {t.discardReload}
          </ControlButton>
        </div>
      )}
    </div>
  );
}
