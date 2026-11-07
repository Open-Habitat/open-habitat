import {
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useBlocker } from "react-router";
import { BrowserEditor, type DiskChanges } from "../components/BrowserEditor";
import {
  changeCount,
  type EditorChange,
  type EditorMergeApi,
  emptyMerge,
  landing,
  type Merged,
  type MergeSource,
  type MergeState,
  replaced,
  threeWay,
} from "../components/editorMerge";
import type { TreeDirectories } from "../components/editorTree";
import type { FileRef } from "../components/fileRefs";
import { UnsavedChangesDialog } from "../components/UnsavedChangesDialog";
import { formatDate, liveText } from "../i18n";
import { browserDocumentText } from "../text/browserDocument";
import {
  attribution,
  type ReplaceNote,
  type ToolReport,
} from "./editorChanges";
import {
  type EditorDocument,
  EditorReadError,
  listEditorFiles,
  readEditorFile,
  saveEditorFile,
} from "./editorFiles";
import { keepsEditor } from "./editorRoute";
import { blockAutomaticReload } from "./reloadSafety";

// Jari's choice (2026-10-24): a change someone else wrote to the open file is
// noticed at once and marked where it will land, but it comes into the text
// only after the person has paused typing this long, and never sooner than
// this after it was noticed, so the text does not change the instant the
// mark appears. Save brings it in at the latest.
export const IMPORT_PAUSE_MS = 2000;

/** A disk version noticed but not yet in the text. */
interface Pending {
  disk: EditorDocument;
  origin: string;
  source: MergeSource;
  conversation?: string;
  count: number;
  at: number;
}
/** What imports since the last open or save brought: the version they started
 * from and the newest disk text. A save compares its text with these to tell
 * which disk changes it replaced. */
interface Written {
  origin: string;
  theirs: string;
  source: MergeSource;
  conversation?: string;
}
interface Claim {
  source: MergeSource;
  conversation?: string;
}
const txt = liveText(browserDocumentText);

/** What a save that leaving made replaced: the version on disk before it and
 * the one it wrote. Kumoa writes the first back on the second's version. */
export interface LeaveSave {
  before: EditorDocument;
  after: EditorDocument;
}
type SaveOutcome =
  | { kind: "saved"; before: EditorDocument; after: EditorDocument }
  | { kind: "clean" }
  | { kind: "busy" }
  | { kind: "gone" }
  /** Nothing was written; the reason says why in the person's words. */
  | { kind: "held"; reason: string };

export interface BrowserDocumentHandle {
  open: (ref: FileRef) => Promise<boolean>;
  /** Leaving keeps the person's text: it is saved without asking, and only
   * a save that cannot be done asks whether to discard it (Jari 7.11.2026).
   * Resolves whether the document may go. */
  leave: () => Promise<boolean>;
  retains: () => boolean;
  focus: () => void;
  /** An agent tool call finished in a conversation beside the editor. */
  observe: (report: ToolReport) => void;
}
export default function BrowserDocument({
  workspace,
  engine = "codemirror6",
  csrf,
  ref,
  onReplaced,
  onLeaveSaved,
  toolbarActions,
}: {
  toolbarActions?: ReactNode;
  engine?: "codemirror6";
  workspace: string;
  csrf: string;
  ref?: Ref<BrowserDocumentHandle>;
  /** A save replaced changes an agent's file tool wrote. */
  onReplaced?: (note: Omit<ReplaceNote, "id">) => void;
  /** Leaving saved unsaved text; the owner offers to undo it. */
  onLeaveSaved?: (save: LeaveSave) => void;
}) {
  const [doc, setDoc] = useState<EditorDocument>();
  const [content, setContent] = useState("");
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState<FileRef>();
  const [reveal, setReveal] = useState<FileRef>();
  const [directories, setDirectories] = useState<TreeDirectories>({});
  const pendingDirectories = useRef(new Map<string, AbortSignal>());
  const [picker, setPicker] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveBlocked, setSaveBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string>();
  const mergeApi = useRef<EditorMergeApi | undefined>(undefined);
  const [pending, setPendingState] = useState<Pending>();
  const pendingRef = useRef<Pending | undefined>(undefined);
  const [written, setWrittenState] = useState<Written>();
  const writtenRef = useRef<Written | undefined>(undefined);
  const [merge, setMerge] = useState<{ state: MergeState; latest: boolean }>({
    state: emptyMerge,
    latest: false,
  });
  const [notice, setNotice] = useState<string>();
  const lastTyped = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  // A check that arrived while a save was in flight runs after it.
  const deferred = useRef<{ claim?: Claim } | undefined>(undefined);
  const dirty = !!doc && doc.content !== content;
  const current = useRef({
    doc,
    content,
    dirty,
    saving,
    saveBlocked,
    loading,
  });
  current.current = { doc, content, dirty, saving, saveBlocked, loading };
  const setPending = (next?: Pending) => {
    pendingRef.current = next;
    setPendingState(next);
  };
  const setWritten = (next?: Written) => {
    writtenRef.current = next;
    setWrittenState(next);
  };
  const adopt = useCallback((next: EditorDocument) => {
    current.current.doc = next;
    setDoc(next);
  }, []);
  const abort = useRef(new AbortController());
  const generation = useRef(0);
  const [asking, setAsking] = useState<string>();
  const answer = useRef<((discard: boolean) => void) | undefined>(undefined);
  useLayoutEffect(() => {
    abort.current = new AbortController();
    return () => {
      abort.current.abort();
      pendingDirectories.current.clear();
      generation.current++;
      window.clearTimeout(timer.current);
      answer.current?.(false);
    };
  }, []);
  // The save in flight, which leaving waits for before it decides.
  const inflight = useRef<Promise<SaveOutcome>>(
    Promise.resolve({ kind: "clean" }),
  );
  const saveRef = useRef(() => inflight.current);
  // Read at the moment it is needed: a save adopts its reply before the
  // render that would refresh `dirty`.
  const unsaved = useCallback(
    () =>
      !!current.current.doc &&
      current.current.doc.content !== current.current.content,
    [],
  );
  const leftSaved = useRef(onLeaveSaved);
  leftSaved.current = onLeaveSaved;
  const leaving = useRef<Promise<boolean> | undefined>(undefined);
  const leave = useCallback((): Promise<boolean> => {
    leaving.current ??= (async () => {
      let first: EditorDocument | undefined;
      let last: EditorDocument | undefined;
      const ask = (reason: string) =>
        new Promise<boolean>((resolve) => {
          answer.current = (discard) => {
            answer.current = undefined;
            setAsking(undefined);
            resolve(discard);
          };
          setAsking(reason);
        });
      try {
        // Typing during a save makes the text dirty again; it is saved too.
        for (let attempt = 0; ; attempt++) {
          while (current.current.saving && !abort.current.signal.aborted)
            await inflight.current;
          if (abort.current.signal.aborted) return false;
          if (!unsaved()) return true;
          if (attempt === 3) return false;
          const outcome = await saveRef.current();
          if (outcome.kind === "saved") {
            first ??= outcome.before;
            last = outcome.after;
          } else if (outcome.kind === "clean") return true;
          else if (outcome.kind === "gone") return false;
          else if (outcome.kind === "held") return await ask(outcome.reason);
        }
      } finally {
        leaving.current = undefined;
        if (first && last && !abort.current.signal.aborted)
          leftSaved.current?.({ before: first, after: last });
      }
    })();
    return leaving.current;
  }, [unsaved]);
  // A route that unmounts the editor waits for the save; one that keeps it
  // (another conversation, Settings) keeps the text as it is.
  const blocker = useBlocker(
    ({ nextLocation }) =>
      (unsaved() || current.current.saving) && !keepsEditor(nextLocation),
  );
  const answered = useRef<unknown>(undefined);
  useEffect(() => {
    if (blocker.state !== "blocked" || answered.current === blocker) return;
    answered.current = blocker;
    void leave().then((ok) => {
      if (abort.current.signal.aborted) return;
      if (ok) blocker.proceed();
      else blocker.reset();
    });
  }, [blocker, leave]);
  useEffect(
    () =>
      blockAutomaticReload(
        () => current.current.dirty || current.current.saving,
      ),
    [],
  );
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!current.current.dirty && !current.current.saving) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, []);
  const loadDirectory = useCallback(
    async (path: string, background = false) => {
      if (pendingDirectories.current.has(path)) return;
      const signal = abort.current.signal;
      pendingDirectories.current.set(path, signal);
      if (!background)
        setDirectories((before) => ({
          ...before,
          [path]: { ...before[path], loading: true, error: false },
        }));
      try {
        const next = await listEditorFiles(workspace, path, signal);
        if (!signal.aborted) {
          setDirectories((before) => ({
            ...before,
            [path]: { entries: next.entries, truncated: next.truncated },
          }));
        }
      } catch {
        if (!signal.aborted) {
          setDirectories((before) => ({
            ...before,
            [path]: { ...before[path], loading: false, error: true },
          }));
        }
      } finally {
        if (pendingDirectories.current.get(path) === signal)
          pendingDirectories.current.delete(path);
      }
    },
    [workspace],
  );
  useEffect(() => {
    void loadDirectory("");
  }, [loadDirectory]);
  // A newly opened or reloaded document starts with no changes from disk.
  const forget = useCallback(() => {
    window.clearTimeout(timer.current);
    pendingRef.current = undefined;
    setPendingState(undefined);
    writtenRef.current = undefined;
    setWrittenState(undefined);
    setMerge({ state: emptyMerge, latest: false });
    setNotice(undefined);
  }, []);
  const open = useCallback(
    async (target: FileRef) => {
      if (target.path.endsWith("/")) {
        // Revealing a directory never replaces (or asks to discard) a buffer.
        // Load only this path and its ancestors, not a recursive workspace scan.
        const parts = target.path.split("/");
        setPicker(true);
        setReveal({ ...target });
        for (let i = 1; i < parts.length; i++)
          void loadDirectory(parts.slice(0, i).join("/"));
        return true;
      }
      // A save in flight finishes before a new read can supersede it.
      while (current.current.saving && !abort.current.signal.aborted)
        await inflight.current;
      // Do not save or replace the current buffer until the candidate was
      // read safely.
      const token = ++generation.current;
      setLoading(true);
      try {
        const next = await readEditorFile(
          workspace,
          target.path,
          abort.current.signal,
        );
        if (abort.current.signal.aborted || token !== generation.current)
          return false;
        // Opening another file saves the text, also what was typed during
        // the read, before the reply replaces it.
        if (unsaved()) {
          if (!(await leave())) return false;
          if (abort.current.signal.aborted || token !== generation.current)
            return false;
        }
        // Reveal only the explicit target's ancestors, never scan recursively.
        const parts = next.path.split("/");
        for (let i = 1; i < parts.length; i++)
          void loadDirectory(parts.slice(0, i).join("/"));
        forget();
        adopt(next);
        setContent(next.content);
        setRevision((n) => n + 1);
        setSelection(target);
        setReveal({ path: next.path });
        setProblem(undefined);
        setSaveBlocked(false);
        if (window.innerWidth <= 800) setPicker(false);
        return true;
      } catch (error) {
        if (!abort.current.signal.aborted && token === generation.current)
          setProblem(
            error instanceof EditorReadError && error.code === "unsupported"
              ? txt.unsupported
              : error instanceof EditorReadError && error.code === "too_large"
                ? txt.tooLarge
                : txt.unreadable,
          );
        return false;
      } finally {
        if (token === generation.current) setLoading(false);
      }
    },
    [leave, workspace, loadDirectory, forget, adopt, unsaved],
  );
  // Brings the waiting version into the text: one undoable history event.
  // Its disk version becomes the base the next save is compared against.
  const importNow = (): Merged | undefined => {
    window.clearTimeout(timer.current);
    const waiting = pendingRef.current;
    const api = mergeApi.current;
    // A newer version waits while a conflict is open: merging it against the
    // base the open conflict already moved past would hide that conflict.
    if (!waiting || !api || api.merge().conflicts.length) return undefined;
    setPending(undefined);
    const before = writtenRef.current;
    const write: Written = {
      origin: before?.origin ?? waiting.origin,
      theirs: waiting.disk.content,
      source: waiting.source,
      conversation: waiting.conversation ?? before?.conversation,
    };
    setWritten(write);
    adopt(waiting.disk);
    const merged = threeWay(api.text(), waiting.origin, waiting.disk.content);
    api.bring(merged, waiting.source);
    setNotice(undefined);
    return merged;
  };
  const schedule = () => {
    const waiting = pendingRef.current;
    if (!waiting) return;
    window.clearTimeout(timer.current);
    const due = Math.max(lastTyped.current, waiting.at) + IMPORT_PAUSE_MS;
    timer.current = window.setTimeout(
      () => {
        // A save in flight imports for itself; this one would race it.
        if (current.current.saving) schedule();
        else importNow();
      },
      Math.max(0, due - Date.now()),
    );
  };
  // A fresh read of the open file. Who wrote it is known only from an agent's
  // file tool call; otherwise the wording stays neutral.
  const detect = (fresh: EditorDocument, claim?: Claim) => {
    const base = current.current.doc;
    if (!base || fresh.path !== base.path) return;
    const waiting = pendingRef.current;
    if (fresh.version === (waiting?.disk.version ?? base.version)) {
      if (waiting && claim?.source === "agent" && waiting.source !== "agent") {
        const named = { ...waiting, ...claim };
        setPending(named);
        mergeApi.current?.showPending(
          landing(mergeApi.current.text(), named.origin, fresh.content),
          "agent",
        );
      }
      return;
    }
    const api = mergeApi.current;
    const text = api?.text() ?? current.current.content;
    const origin = base.content;
    if (text === origin && !waiting) {
      // An unedited document follows the disk quietly.
      adopt(fresh);
      if (api) api.follow(fresh.content);
      else {
        setContent(fresh.content);
        setRevision((n) => n + 1);
      }
      return;
    }
    const merged = threeWay(text, origin, fresh.content);
    if (!changeCount(merged)) {
      // The disk has nothing the text lacks (or went back to the base).
      setPending(undefined);
      api?.showPending([], waiting?.source ?? "disk");
      adopt(fresh);
      return;
    }
    const source = claim?.source ?? waiting?.source ?? "disk";
    const next: Pending = {
      disk: fresh,
      origin,
      source,
      conversation: claim?.conversation ?? waiting?.conversation,
      count: changeCount(merged),
      at: waiting?.at ?? Date.now(),
    };
    setPending(next);
    api?.showPending(landing(text, origin, fresh.content), source);
    setNotice(undefined);
    schedule();
  };
  const checking = useRef(Promise.resolve());
  const check = (claim?: Claim) => {
    // Checks run one at a time so a slower old read cannot follow a newer one.
    checking.current = checking.current
      .then(async () => {
        const state = current.current;
        if (!state.doc || state.loading) return;
        if (state.saving) {
          deferred.current = {
            claim: claim ?? deferred.current?.claim,
          };
          return;
        }
        const token = generation.current;
        let fresh: EditorDocument;
        try {
          fresh = await readEditorFile(
            workspace,
            state.doc.path,
            abort.current.signal,
          );
        } catch {
          // A file that cannot be read now is reported by the next save.
          return;
        }
        if (abort.current.signal.aborted || token !== generation.current)
          return;
        if (current.current.saving) {
          deferred.current = { claim: claim ?? deferred.current?.claim };
          return;
        }
        setSaveBlocked(false);
        detect(fresh, claim);
      })
      .catch(() => {});
  };
  useEffect(() => {
    // A change made over SSH or by another tab shows when the person returns.
    const look = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", look);
    document.addEventListener("visibilitychange", look);
    return () => {
      window.removeEventListener("focus", look);
      document.removeEventListener("visibilitychange", look);
    };
  });
  const observe = (report: ToolReport) => {
    const state = current.current;
    if (!state.doc || report.workspace !== workspace) return;
    const bearing = attribution(report, state.doc.path);
    if (bearing === "other") return;
    check(
      bearing === "agent"
        ? { source: "agent", conversation: report.conversation }
        : undefined,
    );
  };
  const observeRef = useRef(observe);
  observeRef.current = observe;
  useImperativeHandle(
    ref,
    () => ({
      open,
      leave,
      // Observations cannot request a discard or a save.
      retains: () => current.current.saving || unsaved(),
      focus: () =>
        document
          .querySelector<HTMLElement>('[data-testid="editor-document"]')
          ?.focus(),
      observe: (report) => observeRef.current(report),
    }),
    [open, leave, unsaved],
  );
  const saved = (next: EditorDocument, text: string) => {
    adopt(next);
    setProblem(undefined);
    setSaveBlocked(false);
    mergeApi.current?.clear();
    const write = writtenRef.current;
    setWritten(undefined);
    if (!write) {
      setNotice(undefined);
      return;
    }
    const lost = replaced(text, write.origin, write.theirs);
    const agent = write.source === "agent";
    const noted =
      agent && lost.length > 0 && !!write.conversation && !!onReplaced;
    if (noted && write.conversation)
      onReplaced?.({
        workspace,
        conversation: write.conversation,
        path: next.path,
        at: formatDate(new Date(), { hour: "2-digit", minute: "2-digit" }),
        changes: lost,
      });
    setNotice(
      !lost.length
        ? txt.savedMerged(agent)
        : agent
          ? txt.savedReplacedAgent(lost.length, !!noted)
          : txt.savedReplacedDisk(lost.length),
    );
  };
  const held = (): SaveOutcome => {
    const name = current.current.doc?.path.split("/").pop() ?? "";
    const source =
      pendingRef.current?.source ?? mergeApi.current?.merge().source;
    return {
      kind: "held",
      reason: txt.leaveConflict(name, source === "agent"),
    };
  };
  const failed = (reason: string): SaveOutcome => {
    setProblem(reason);
    return { kind: "held", reason };
  };
  const saveNow = async (): Promise<SaveOutcome> => {
    const state = current.current;
    if (!state.doc) return { kind: "clean" };
    if (state.saving) return { kind: "busy" };
    if (state.saveBlocked) return { kind: "held", reason: txt.saveUnknown };
    // Save is the latest moment waiting changes come in. With a conflict the
    // save waits for the person's choices.
    if (pendingRef.current && !importNow()) return held();
    if (mergeApi.current?.merge().conflicts.length) return held();
    current.current.saving = true;
    setSaving(true);
    const token = generation.current;
    const gone = () =>
      abort.current.signal.aborted || token !== generation.current;
    try {
      // The daemon refuses a stale base; a read first turns most refusals
      // into an ordinary import. A write landing in between is read again.
      for (let attempt = 0; attempt < 3; attempt++) {
        const base = current.current.doc;
        if (!base) return { kind: "clean" };
        let fresh: EditorDocument | undefined;
        try {
          fresh = await readEditorFile(
            workspace,
            base.path,
            abort.current.signal,
          );
        } catch {
          // The write below still carries the base version.
        }
        if (gone()) return { kind: "gone" };
        if (fresh && fresh.version !== base.version) {
          detect(fresh);
          if (pendingRef.current && !importNow()) return held();
          // Open conflicts, new or from an earlier import, hold the write.
          if (mergeApi.current?.merge().conflicts.length) return held();
        }
        const doc = current.current.doc;
        const text = mergeApi.current?.text() ?? current.current.content;
        if (!doc || text === doc.content) return { kind: "clean" };
        const result = await saveEditorFile(doc, text, csrf);
        if (gone()) return { kind: "gone" };
        if (result.kind === "ok") {
          // The changed resource is this document reply, not a workspace snapshot.
          saved(result.document, text);
          return { kind: "saved", before: doc, after: result.document };
        }
        if (result.kind === "refused" && result.code === "file_changed")
          continue;
        if (result.kind === "uncertain") {
          // Whether the write happened shows in the file itself.
          try {
            const after = await readEditorFile(
              workspace,
              doc.path,
              abort.current.signal,
            );
            if (gone()) return { kind: "gone" };
            if (after.content === text) {
              saved(after, text);
              return { kind: "saved", before: doc, after };
            }
            detect(after);
            return failed(txt.noSaveReply);
          } catch {
            if (gone()) return { kind: "gone" };
            setSaveBlocked(true);
            return failed(txt.saveUnknown);
          }
        }
        return failed(
          result.kind === "invalid" ? txt.invalidText : txt.saveFailed,
        );
      }
      return failed(txt.keptChanging);
    } finally {
      // A newer opening superseded this save, but the document lives on and
      // must not stay marked as saving.
      if (!abort.current.signal.aborted) {
        current.current.saving = false;
        setSaving(false);
      }
      if (!gone()) {
        const queued = deferred.current;
        deferred.current = undefined;
        if (queued) check(queued.claim);
      }
    }
  };
  const save = () => {
    if (!current.current.saving) inflight.current = saveNow();
    return inflight.current;
  };
  saveRef.current = save;
  const changes: DiskChanges | undefined =
    pending && !merge.state.conflicts.length
      ? { kind: "pending", source: pending.source, count: pending.count }
      : merge.state.imported
        ? {
            kind: "imported",
            source: merge.state.source,
            count: merge.state.count,
            conflicts: merge.state.conflicts.length,
            latest: merge.latest,
          }
        : written && dirty
          ? { kind: "undone", source: written.source }
          : undefined;
  return (
    <>
      <BrowserEditor
        toolbarActions={toolbarActions}
        engine={engine}
        document={
          doc
            ? { path: doc.path, content: doc.content, revision, selection }
            : undefined
        }
        directories={directories}
        reveal={reveal}
        onLoadDirectory={loadDirectory}
        picker={picker}
        dirty={dirty}
        saveBlocked={saveBlocked}
        saving={saving}
        loading={loading}
        problem={problem}
        changes={changes}
        notice={notice}
        mergeApi={mergeApi}
        onPicker={() => setPicker(!picker)}
        onOpen={(path) => void open({ path })}
        onChange={(next: string, change: EditorChange) => {
          current.current.content = next;
          setContent(next);
          setMerge({ state: change.merge, latest: change.importLatest });
          if (change.typed) {
            lastTyped.current = Date.now();
            setNotice(undefined);
          }
          // Typing restarts the pause; resolving the last conflict lets a
          // version that waited behind it come in.
          if (change.typed || !change.merge.conflicts.length) schedule();
        }}
        onSave={() => void save()}
        onReload={() => {
          if (doc) void open({ path: doc.path });
        }}
        onImportNow={() => void importNow()}
        onUndoImport={() => mergeApi.current?.undo()}
        onReimport={() => {
          const write = writtenRef.current;
          const api = mergeApi.current;
          if (!write || !api) return;
          api.bring(
            threeWay(api.text(), write.origin, write.theirs),
            write.source,
          );
        }}
      />
      {asking !== undefined ? (
        <UnsavedChangesDialog
          reason={asking}
          onDiscard={() => answer.current?.(true)}
          onKeep={() => answer.current?.(false)}
        />
      ) : null}
    </>
  );
}
