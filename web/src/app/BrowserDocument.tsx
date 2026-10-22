import {
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useBlocker, useLocation } from "react-router";
import { BrowserEditor } from "../components/BrowserEditor";
import type { TreeDirectories } from "../components/editorTree";
import type { FileRef } from "../components/fileRefs";
import {
  type EditorDocument,
  EditorReadError,
  listEditorFiles,
  readEditorFile,
  saveEditorFile,
} from "./editorFiles";

export interface BrowserDocumentHandle {
  open: (ref: FileRef) => Promise<boolean>;
  leave: () => boolean;
  switchEngine: () => boolean;
  retains: () => boolean;
  focus: () => void;
}
export default function BrowserDocument({
  workspace,
  engine = "codemirror6",
  csrf,
  ref,
}: {
  engine?: "codemirror6";
  workspace: string;
  csrf: string;
  ref?: Ref<BrowserDocumentHandle>;
}) {
  const [doc, setDoc] = useState<EditorDocument>();
  const [content, setContent] = useState("");
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState<FileRef>();
  const [directories, setDirectories] = useState<TreeDirectories>({});
  const pendingDirectories = useRef(new Map<string, AbortSignal>());
  const [picker, setPicker] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveBlocked, setSaveBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [remote, setRemote] = useState<EditorDocument>();
  const dirty = !!doc && doc.content !== content;
  const current = useRef({ doc, content, dirty, saving, saveBlocked });
  current.current = { doc, content, dirty, saving, saveBlocked };
  const abort = useRef(new AbortController());
  const generation = useRef(0);
  useLayoutEffect(() => {
    abort.current = new AbortController();
    return () => {
      abort.current.abort();
      pendingDirectories.current.clear();
      generation.current++;
    };
  }, []);
  const leave = useCallback(() => {
    if (current.current.saving) return false;
    return (
      !current.current.dirty ||
      window.confirm(
        "Hylätäänkö tallentamattomat muutokset? Peruuta ja tallenna ensin, jos haluat säilyttää ne.",
      )
    );
  }, []);
  const location = useLocation();
  const approvedRoute = useRef<string | undefined>(undefined);
  const blocker = useBlocker(({ nextLocation }) => {
    const allowed = leave();
    approvedRoute.current = allowed ? nextLocation.key : undefined;
    return !allowed;
  });
  useEffect(() => {
    if (blocker.state === "blocked") blocker.reset();
  }, [blocker]);
  useEffect(() => {
    // Permission covers this commit's resource rebind, not later observations
    // when navigation happened to keep the same document mounted.
    if (approvedRoute.current === location.key)
      approvedRoute.current = undefined;
  }, [location.key]);
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
    async (path: string) => {
      if (pendingDirectories.current.has(path)) return;
      const signal = abort.current.signal;
      pendingDirectories.current.set(path, signal);
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
  const open = useCallback(
    async (target: FileRef) => {
      if (!leave()) return false;
      // Do not discard the current buffer until the candidate was read safely.
      const before = current.current.content;
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
        // Typing during the read must not be overwritten by its delayed reply.
        if (current.current.content !== before && !leave()) return false;
        // Reveal only the explicit target's ancestors, never scan recursively.
        const parts = next.path.split("/");
        for (let i = 1; i < parts.length; i++)
          void loadDirectory(parts.slice(0, i).join("/"));
        setDoc(next);
        setContent(next.content);
        setRevision((n) => n + 1);
        setSelection(target);
        setRemote(undefined);
        setProblem(undefined);
        setSaveBlocked(false);
        if (window.innerWidth <= 800) setPicker(false);
        return true;
      } catch (error) {
        if (!abort.current.signal.aborted && token === generation.current)
          setProblem(
            error instanceof EditorReadError && error.code === "unsupported"
              ? "Tiedoston tyyppiä, merkistöä tai suojausmetadataa ei tueta."
              : error instanceof EditorReadError && error.code === "too_large"
                ? "Tiedosto on liian suuri. Enimmäiskoko on 1 MiB."
                : "Tiedostoa ei voitu lukea työtilasta.",
          );
        return false;
      } finally {
        if (token === generation.current) setLoading(false);
      }
    },
    [leave, workspace, loadDirectory],
  );
  useImperativeHandle(
    ref,
    () => ({
      open,
      leave,
      switchEngine: () => {
        if (!leave()) return false;
        setContent(current.current.doc?.content ?? "");
        setRevision((r) => r + 1);
        return true;
      },
      // Observations cannot request a discard. A committed route may already
      // have obtained one for this document; do not prompt a second time.
      retains: () =>
        current.current.saving ||
        (current.current.dirty && approvedRoute.current !== location.key),
      focus: () =>
        document
          .querySelector<HTMLElement>('[data-testid="editor-document"]')
          ?.focus(),
    }),
    [open, leave, location.key],
  );
  const save = async () => {
    const state = current.current;
    if (!state.doc || state.saving || state.saveBlocked || !state.dirty) return;
    current.current.saving = true;
    setSaving(true);
    const token = generation.current;
    const result = await saveEditorFile(state.doc, state.content, csrf);
    if (abort.current.signal.aborted || token !== generation.current) return;
    setSaving(false);
    if (result.kind === "ok") {
      // The changed resource is this document reply, not a workspace snapshot.
      setDoc(result.document);
      setProblem(undefined);
      setRemote(undefined);
    } else {
      setSaveBlocked(
        result.kind === "uncertain" ||
          (result.kind === "refused" && result.code === "file_changed"),
      );
      setProblem(
        result.kind === "refused" && result.code === "file_changed"
          ? "Tiedosto on muuttunut palvelimella. Oma teksti säilyy. Lue versio vertailuun ja sovita muutokset ennen tallennusta."
          : result.kind === "invalid"
            ? "Teksti sisältää merkkejä, joita ei voida tallentaa."
            : result.kind === "uncertain"
              ? "Tallennuksen tulos ei ole tiedossa. Oma teksti säilyy. Lue palvelimen versio ennen uutta yritystä."
              : "Tallennus ei onnistunut. Oma teksti säilyy.",
      );
    }
  };
  const compare = async () => {
    if (!doc || saving) return;
    const token = ++generation.current;
    setLoading(true);
    try {
      const next = await readEditorFile(
        workspace,
        doc.path,
        abort.current.signal,
      );
      if (!abort.current.signal.aborted && token === generation.current)
        setRemote(next);
    } catch {
      if (!abort.current.signal.aborted)
        setProblem("Vertailuversiota ei voitu lukea. Oma teksti säilyy.");
    } finally {
      if (token === generation.current) setLoading(false);
    }
  };
  return (
    <BrowserEditor
      engine={engine}
      document={
        doc
          ? { path: doc.path, content: doc.content, revision, selection }
          : undefined
      }
      directories={directories}
      onLoadDirectory={(path) => void loadDirectory(path)}
      picker={picker}
      dirty={dirty}
      saveBlocked={saveBlocked}
      saving={saving}
      loading={loading}
      problem={problem}
      remote={remote?.content}
      onPicker={() => setPicker(!picker)}
      onOpen={(path) => void open({ path })}
      onChange={(next) => {
        approvedRoute.current = undefined;
        setContent(next);
      }}
      onSave={() => void save()}
      onCompare={() => void compare()}
      onReload={() => {
        if (doc) void open({ path: doc.path });
      }}
      onReconcile={() => {
        if (remote) {
          setDoc(remote);
          setRemote(undefined);
          setProblem(undefined);
          setSaveBlocked(false);
        }
      }}
    />
  );
}
