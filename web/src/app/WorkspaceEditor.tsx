// The workspace editor beside the conversation (Rinnakkain). The editor is
// the person's own code-server on the separate editor origin, in a frame; this
// controller owns the frame, its hand-off, the layout state and the one key
// the app keeps while the editor has focus (Ctrl+Alt+K). Everything here is
// per browser tab: nothing about the editor is stored on the host.
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ControlButton } from "../components/ControlElements";
import { EditorSplit } from "../components/EditorSplit";
import { FileLinkContext, type FileRef } from "../components/fileRefs";
import { Icon } from "../components/Icon";
import {
  clampConversationWidth,
  conversationMin,
  defaultConversationWidth,
  type EditorState,
  editorFrameMessage,
  editorFrameURL,
  editorStatus,
  isEditorKey,
  maxConversationWidth,
  mintEditorHandoff,
  openInEditor,
  rememberConversationWidth,
  rememberedConversationWidth,
} from "./editor";

type Phase = "idle" | "starting" | "loading" | "ready" | "failed";

interface EditorControls {
  open: boolean;
  collapsed: boolean;
  railOpen: boolean;
  toggleOpen: () => void;
  toggleCollapsed: () => void;
  toggleRail: () => void;
  /** The conversation reports Pi's state for the strip. */
  report: (working: boolean, label: string) => void;
}

const EditorContext = createContext<EditorControls | null>(null);

const phoneQuery = "(max-width: 800px)";
const usePhone = () => {
  const [phone, setPhone] = useState(
    () => window.matchMedia?.(phoneQuery).matches ?? false,
  );
  useEffect(() => {
    const query = window.matchMedia?.(phoneQuery);
    if (!query) return;
    const change = () => setPhone(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return phone;
};

// Whether an editor is offered changes only with the installation, so a tab
// reads it once per signed-in session (keyed by its CSRF binding): returning
// to a conversation reads nothing new.
const offered = new Map<string, EditorState>();

const composer = () =>
  document.querySelector<HTMLElement>(
    "#ah-editor-conversation .ah-composer textarea, #ah-editor-conversation textarea",
  );

/** Wraps a conversation route. Where no editor is offered (no editor origin,
 * no editor in the person's daemon, a phone) it renders only the conversation,
 * in the same place, so the conversation never remounts. */
export function WorkspaceEditor({
  workspaceId,
  csrf,
  children,
}: {
  workspaceId?: string;
  csrf?: string;
  children: ReactNode;
}) {
  const phone = usePhone();
  const [state, setState] = useState<EditorState | undefined>(() =>
    csrf ? offered.get(csrf) : undefined,
  );
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [frame, setFrame] = useState<{
    origin: string;
    workspace: string;
    src: string;
  }>();
  const [note, setNote] = useState<string>();
  const [total, setTotal] = useState(() => window.innerWidth);
  const [width, setWidth] = useState(
    () =>
      rememberedConversationWidth() ??
      defaultConversationWidth(window.innerWidth),
  );
  const [pi, setPi] = useState({ working: false, label: "Odottaa sinua" });
  const [unread, setUnread] = useState(false);
  const iframe = useRef<HTMLIFrameElement>(null);
  const pendingToken = useRef<{ token: string; at: number } | undefined>(
    undefined,
  );
  const lastMint = useRef(0);
  const pendingOpen = useRef<{ ref: FileRef; workspace: string } | undefined>(
    undefined,
  );
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const available =
    !!workspaceId &&
    !!csrf &&
    !phone &&
    (state === "stopped" || state === "running");

  // Whether the editor is offered at all; a read starts nothing.
  useEffect(() => {
    if (!workspaceId || !csrf || phone) return;
    const known = offered.get(csrf);
    if (known) {
      setState(known);
      return;
    }
    const abort = new AbortController();
    editorStatus(abort.signal)
      .then((next) => {
        offered.set(csrf, next);
        setState(next);
      })
      .catch(() => {
        if (!abort.signal.aborted) setState("absent");
      });
    return () => abort.abort();
  }, [workspaceId, csrf, phone]);

  // A phone has no editor: turning the window into one closes it.
  useEffect(() => {
    if (phone) setOpen(false);
  }, [phone]);
  useEffect(() => {
    const resize = () => setTotal(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const shown = clampConversationWidth(width, total);

  const post = useCallback(
    (message: Record<string, unknown>) => {
      if (frame && iframe.current?.contentWindow)
        iframe.current.contentWindow.postMessage(
          { source: "open-habitat", ...message },
          frame.origin,
        );
    },
    [frame],
  );

  const focusEditor = useCallback(() => {
    iframe.current?.focus();
    post({ type: "focus" });
  }, [post]);

  // The first open mints the hand-off, which also names the editor origin;
  // the frame page asks for it when it has no editor session.
  const start = useCallback(async () => {
    if (!csrf || !workspaceId) return;
    if (frame?.workspace === workspaceId && phaseRef.current !== "failed")
      return;
    setPhase("starting");
    setNote(undefined);
    try {
      lastMint.current = Date.now();
      const handoff = await mintEditorHandoff(csrf);
      pendingToken.current = { token: handoff.token, at: Date.now() };
      setFrame({
        origin: handoff.origin,
        workspace: workspaceId,
        src: editorFrameURL(handoff.origin, workspaceId),
      });
    } catch {
      setPhase("failed");
    }
  }, [csrf, workspaceId, frame]);

  const show = useCallback(
    (next: boolean) => {
      setOpen(next);
      setRailOpen(false);
      if (next) void start();
    },
    [start],
  );

  // A workspace change while the editor is open opens that workspace.
  useEffect(() => {
    if (open && workspaceId && frame && frame.workspace !== workspaceId) {
      setFrame(undefined);
      setPhase("idle");
    }
  }, [open, workspaceId, frame]);
  useEffect(() => {
    if (open && !frame && phase === "idle") void start();
  }, [open, frame, phase, start]);

  const deliver = useCallback(
    async (ref: FileRef, workspace: string) => {
      if (!csrf) return;
      setNote(undefined);
      const outcome = await openInEditor(csrf, workspace, ref);
      if (outcome.kind === "ok") {
        focusEditor();
        return;
      }
      setNote(
        outcome.kind === "refused" && outcome.code === "file_unavailable"
          ? `Tiedostoa ${ref.path} ei löydy työtilasta.`
          : outcome.kind === "refused" && outcome.code === "editor_not_running"
            ? "VS Code ei vielä ottanut tiedostoa vastaan. Yritä hetken päästä uudelleen."
            : outcome.kind === "login"
              ? "Istunto on päättynyt. Kirjaudu uudelleen."
              : "Tiedoston avaamisesta ei saatu vastausta.",
      );
    },
    [csrf, focusEditor],
  );

  const [opened, setOpened] = useState<string>();
  const openFile = useCallback(
    (ref: FileRef, text: string) => {
      if (!workspaceId) return;
      setOpened(text);
      if (!open) show(true);
      if (phaseRef.current === "ready" && frame?.workspace === workspaceId)
        void deliver(ref, workspaceId);
      else pendingOpen.current = { ref, workspace: workspaceId };
    },
    [workspaceId, open, show, frame, deliver],
  );
  const links = useMemo(
    () => (available ? { open: openFile, opened } : null),
    [available, openFile, opened],
  );

  // The frame page's messages. Only its own window on the editor origin is
  // heard; code-server's webviews share the origin but are other windows.
  useEffect(() => {
    if (!frame) return;
    const listen = async (event: MessageEvent) => {
      if (
        event.origin !== frame.origin ||
        event.source !== iframe.current?.contentWindow
      )
        return;
      const message = editorFrameMessage(event.data);
      if (!message) return;
      switch (message.type) {
        case "need-token": {
          let token = pendingToken.current;
          pendingToken.current = undefined;
          if (!token || Date.now() - token.at > 50_000) {
            // At most one fresh hand-off every few seconds, whatever asks.
            if (!csrf || Date.now() - lastMint.current < 3000) return;
            lastMint.current = Date.now();
            try {
              token = {
                token: (await mintEditorHandoff(csrf)).token,
                at: Date.now(),
              };
            } catch {
              return;
            }
          }
          post({ type: "token", token: token.token });
          return;
        }
        case "starting":
          setPhase("starting");
          return;
        case "loading":
          setPhase("loading");
          return;
        case "ready": {
          setPhase("ready");
          const queued = pendingOpen.current;
          pendingOpen.current = undefined;
          if (queued && queued.workspace === frame.workspace)
            void deliver(queued.ref, queued.workspace);
          return;
        }
        case "failed":
          setPhase("failed");
          return;
        case "toggle":
          setCollapsed(false);
          requestAnimationFrame(() =>
            composer()?.focus({ preventScroll: true }),
          );
          return;
      }
    };
    const handler = (event: MessageEvent) => void listen(event);
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [frame, csrf, post, deliver]);

  // Ctrl+Alt+K outside the editor frame. Inside it, the frame page sends
  // "toggle" instead, since a frame keeps its keys.
  useEffect(() => {
    if (!available) return;
    const key = (event: KeyboardEvent) => {
      if (!isEditorKey(event)) return;
      event.preventDefault();
      if (!open) {
        show(true);
        requestAnimationFrame(focusEditor);
      } else if (collapsed) {
        setCollapsed(false);
        requestAnimationFrame(() => composer()?.focus({ preventScroll: true }));
      } else if (
        document
          .getElementById("ah-editor-conversation")
          ?.contains(document.activeElement)
      )
        focusEditor();
      else composer()?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [available, open, collapsed, show, focusEditor]);

  // The rail over the editor closes with Escape or a route change.
  useEffect(() => {
    if (!railOpen) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRailOpen(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [railOpen]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A new workspace route is the change that closes it.
  useEffect(() => setRailOpen(false), [workspaceId]);

  // A reply that finishes while the conversation is hidden marks the strip.
  const wasWorking = useRef(false);
  const report = useCallback(
    (working: boolean, label: string) => {
      setPi((previous) =>
        previous.working === working && previous.label === label
          ? previous
          : { working, label },
      );
      if (wasWorking.current && !working && open && collapsed) setUnread(true);
      wasWorking.current = working;
    },
    [open, collapsed],
  );
  useEffect(() => {
    if (!collapsed) setUnread(false);
  }, [collapsed]);

  const controls = useMemo<EditorControls | null>(
    () =>
      available
        ? {
            open,
            collapsed,
            railOpen,
            toggleOpen: () => show(!open),
            toggleCollapsed: () => setCollapsed((c) => !c),
            toggleRail: () => setRailOpen((r) => !r),
            report,
          }
        : null,
    [available, open, collapsed, railOpen, show, report],
  );

  const editorShown = open && available;
  const retry = () => {
    setFrame(undefined);
    setPhase("idle");
  };
  const overlay =
    phase === "ready" && frame ? null : phase === "failed" ? (
      <div className="ah-editor-overlay" role="status">
        <div>
          <strong>VS Codea ei voitu avata</strong>
          <span>Editori ei käynnistynyt, tai istunto ei siirtynyt sille.</span>
          <ControlButton size="row" onPress={retry}>
            Yritä uudelleen
          </ControlButton>
        </div>
      </div>
    ) : (
      <div className="ah-editor-overlay" role="status">
        <div>
          <strong>
            <span aria-hidden="true" className="ah-status-dot ah-running" />{" "}
            {phase === "loading"
              ? "Ladataan editorin käyttöliittymää"
              : "Käynnistetään VS Code"}
          </strong>
          <span>
            Ensimmäinen avaus voi kestää puoli minuuttia. Editori pysyy
            käynnissä, kunnes sitä ei ole käytetty puoleen tuntiin.
          </span>
        </div>
      </div>
    );
  const editor =
    available && (frame || editorShown) ? (
      <>
        {frame ? (
          <iframe
            ref={iframe}
            key={frame.src}
            src={frame.src}
            title="VS Code: työtilan editori"
            allow="clipboard-read; clipboard-write"
          />
        ) : null}
        {overlay}
        {note ? (
          <p className="ah-editor-note" role="status">
            {note}
          </p>
        ) : null}
      </>
    ) : null;

  return (
    <EditorContext.Provider value={controls}>
      <FileLinkContext.Provider value={links}>
        <EditorSplit
          className={railOpen && editorShown ? "ah-editor-rail" : undefined}
          open={editorShown}
          collapsed={collapsed}
          width={shown}
          min={conversationMin}
          max={maxConversationWidth(total)}
          editor={editor}
          strip={{ ...pi, unread }}
          onResize={(next, commit) => {
            const clamped = clampConversationWidth(next, total);
            setWidth(clamped);
            if (commit) rememberConversationWidth(clamped);
          }}
          onCollapse={setCollapsed}
          onReset={() => {
            const next = defaultConversationWidth(total);
            setCollapsed(false);
            setWidth(next);
            rememberConversationWidth(next);
          }}
          onShowConversation={() => {
            setCollapsed(false);
            requestAnimationFrame(() =>
              composer()?.focus({ preventScroll: true }),
            );
          }}
        >
          {children}
        </EditorSplit>
      </FileLinkContext.Provider>
    </EditorContext.Provider>
  );
}

/** The conversation header's editor controls; nothing where no editor is
 * offered. */
export function EditorHeaderControls() {
  const editor = useContext(EditorContext);
  if (!editor) return null;
  return (
    <span className="ah-editor-controls">
      {editor.open ? (
        <ControlButton
          size="row"
          variant="quiet"
          aria-label="Työtilat ja keskustelut"
          title="Näytä työtilat editorin päällä"
          aria-expanded={editor.railOpen}
          onPress={editor.toggleRail}
        >
          <Icon name="menu" />
        </ControlButton>
      ) : null}
      <ControlButton
        size="row"
        variant="quiet"
        className={`ah-editor-toggle${editor.open ? " ah-editor-toggle-on" : ""}`}
        aria-label={editor.open ? "Sulje editori" : "Editori"}
        title={
          editor.open
            ? "Sulje editori"
            : "Avaa työtilan VS Code keskustelun viereen (Ctrl+Alt+K)"
        }
        onPress={editor.toggleOpen}
      >
        <Icon name="editor" />
      </ControlButton>
      {editor.open ? (
        <ControlButton
          size="row"
          variant="quiet"
          aria-label="Piilota keskustelu"
          title="Piilota keskustelu (Enter jakajassa tai Ctrl+Alt+K)"
          onPress={editor.toggleCollapsed}
        >
          <Icon name="forward" />
        </ControlButton>
      ) : null}
    </span>
  );
}

/** A conversation tells the editor Pi's state, for the hidden-conversation
 * strip. */
export function useEditorActivity(working: boolean, label: string) {
  const editor = useContext(EditorContext);
  const report = editor?.report;
  useEffect(() => {
    report?.(working, label);
  }, [report, working, label]);
}
