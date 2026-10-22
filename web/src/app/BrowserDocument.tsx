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
import type { FileRef } from "../components/fileRefs";
import {
  type EditorDocument,
  type EditorListing,
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
  const [listing, setListing] = useState<EditorListing>({
    workspace_id: workspace,
    path: "",
    entries: [],
    truncated: false,
  });
  const [picker, setPicker] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveBlocked, setSaveBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [directoryProblem, setDirectoryProblem] = useState<string>();
  const [remote, setRemote] = useState<EditorDocument>();
  const dirty = !!doc && doc.content !== content;
  const current = useRef({ doc, content, dirty, saving, saveBlocked });
  current.current = { doc, content, dirty, saving, saveBlocked };
  const abort = useRef(new AbortController());
  const generation = useRef(0);
  const listingGeneration = useRef(0);
  useLayoutEffect(() => {
    abort.current = new AbortController();
    return () => {
      abort.current.abort();
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
      const token = ++listingGeneration.current;
      try {
        const next = await listEditorFiles(
          workspace,
          path,
          abort.current.signal,
        );
        if (token === listingGeneration.current) {
          setListing(next);
          setDirectoryProblem(undefined);
        }
      } catch {
        if (
          !abort.current.signal.aborted &&
          token === listingGeneration.current
        )
          setDirectoryProblem("Kansiota ei voitu lukea.");
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
    [leave, workspace],
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
      directory={listing.path}
      entries={listing.entries}
      truncated={listing.truncated}
      picker={picker}
      dirty={dirty}
      saveBlocked={saveBlocked}
      saving={saving}
      loading={loading}
      problem={problem ?? directoryProblem}
      remote={remote?.content}
      onPicker={() => setPicker(!picker)}
      onParent={() =>
        void loadDirectory(listing.path.split("/").slice(0, -1).join("/"))
      }
      onOpen={(name, kind) => {
        const path = listing.path ? `${listing.path}/${name}` : name;
        if (kind === "directory") void loadDirectory(path);
        else if (kind === "file") void open({ path });
      }}
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
