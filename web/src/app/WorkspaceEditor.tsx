// The workspace editor beside the conversation (Rinnakkain). The editor is
// the person's own code-server on the separate editor origin, in a frame; this
// controller owns the frame, its hand-off, the layout state and the one key
// the app keeps while the editor has focus (Ctrl+Alt+K). Live documents and
// layout are per tab; the engine choice comes from the person's configuration.

import {
  createContext,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ControlButton } from "../components/ControlElements";
import { EditorHeader, EditorHeaderActions } from "../components/EditorHeader";
import { EditorSplit } from "../components/EditorSplit";
import { FileLinkContext, type FileRef } from "../components/fileRefs";
import { HabitatMark } from "../components/HabitatMark";
import { Icon } from "../components/Icon";
import { WarningBanner } from "../components/WarningBanner";
import { liveText } from "../i18n";
import { workspaceEditorText } from "../text/workspaceEditor";
import { type EditorEngine, useEditorChoice } from "./accountPreferences";
import type { BrowserDocumentHandle, LeaveSave } from "./BrowserDocument";
import type { ConversationJournal } from "./conversationJournal";
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
import type { ReplaceNote } from "./editorChanges";

const txt = liveText(workspaceEditorText);
const BrowserDocument = lazy(() => import("./BrowserDocument"));

type Phase = "idle" | "starting" | "loading" | "ready" | "failed";

interface EditorControls {
  open: boolean;
  collapsed: boolean;
  toggleOpen: () => void;
  /** The conversation reports Pi's state for the strip. */
  report: (working: boolean, label: string) => void;
}

const EditorContext = createContext<EditorControls | null>(null);

/** Notes from the browser editor to the conversations whose changes a save
 * replaced. Tool completion arrives directly from the authenticated journal. */
interface EditorChannel {
  notes: ReplaceNote[];
  /** A told or closed note is gone for good: a later save makes a new one. */
  dismiss: (id: number) => void;
}
const EditorChannelContext = createContext<EditorChannel | null>(null);

// Whether an editor is offered changes only with the installation, so a tab
// reads it once per signed-in session (keyed by its CSRF binding): returning
// to a conversation reads nothing new.
const offered = new Map<string, EditorState>();

const composer = () =>
  document.querySelector<HTMLElement>(
    "#ah-editor-conversation .ah-composer textarea, #ah-editor-conversation textarea",
  );

/** Wraps a conversation route. Where no editor is offered (no editor origin,
 * no editor in the person's daemon) it renders only the conversation,
 * in the same place, so the conversation never remounts. */
function WorkspaceEditorInner({
  workspaceId,
  csrf,
  identity,
  children,
  onShownChange,
  onLeaveSaved,
  journal,
}: {
  journal?: ConversationJournal;
  workspaceId?: string;
  csrf?: string;
  identity?: string;
  children: ReactNode;
  onShownChange?: (shown: boolean) => void;
  onLeaveSaved?: (save: LeaveSave) => void;
}) {
  const { engine: preference, busy: preferenceBusy } = useEditorChoice(
    identity,
    csrf,
  );
  const [engine, setEngine] = useState<EditorEngine>(() =>
    window.innerWidth <= 800 ? "codemirror6" : preference,
  );
  const browser = engine !== "vscode";
  const browserDocument = useRef<BrowserDocumentHandle>(null);
  useLayoutEffect(
    () =>
      journal?.subscribeTools((report) =>
        browserDocument.current?.observe(report),
      ),
    [journal],
  );
  // A document's resource binding is not the selected workspace. A native
  // removal/refresh can remove the latter without permission to lose a buffer.
  const [browserWorkspace, setBrowserWorkspace] = useState(workspaceId);
  const [state, setState] = useState<EditorState | undefined>(() =>
    csrf ? offered.get(csrf) : undefined,
  );
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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
  const [pi, setPi] = useState({ working: false, label: txt.waitingForYou });
  const [notes, setNotes] = useState<ReplaceNote[]>([]);
  // Not derived from the list: a dismissed note's id must not come back.
  const noteId = useRef(0);
  const channel = useMemo<EditorChannel>(
    () => ({
      notes,
      dismiss: (id) =>
        setNotes((before) => before.filter((note) => note.id !== id)),
    }),
    [notes],
  );
  const [unread, setUnread] = useState(false);
  const iframe = useRef<HTMLIFrameElement>(null);
  const pendingToken = useRef<{ token: string; at: number } | undefined>(
    undefined,
  );
  const lastMint = useRef(0);
  const pendingOpen = useRef<
    { ref: FileRef; workspace: string; text?: string } | undefined
  >(undefined);
  const attachBrowser = useCallback(
    (handle: BrowserDocumentHandle | null) => {
      browserDocument.current = handle;
      const pending = pendingOpen.current;
      if (handle && pending && pending.workspace === browserWorkspace) {
        void handle.open(pending.ref).then((ok) => {
          if (ok && pendingOpen.current === pending) {
            pendingOpen.current = undefined;
            setOpened(pending.text);
          }
        });
      }
    },
    [browserWorkspace],
  );
  useLayoutEffect(() => {
    if (!browser || browserWorkspace === workspaceId) return;
    const handle = browserDocument.current;
    if (!handle?.retains()) {
      setBrowserWorkspace(workspaceId);
      return;
    }
    // A workspace that vanished from an observation is not the person
    // leaving: the document stays bound to its own until they act.
    if (!workspaceId) return;
    // Going to another workspace's conversation leaves the document, so it
    // saves as closing does; only a failed save asks.
    let live = true;
    void handle.leave().then((ok) => {
      if (live && ok) setBrowserWorkspace(workspaceId);
    });
    return () => {
      live = false;
    };
  }, [browser, workspaceId, browserWorkspace]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const available =
    !preferenceBusy &&
    !!(browser ? browserWorkspace : workspaceId) &&
    !!csrf &&
    (browser || state === "stopped" || state === "running");

  // Whether the editor is offered at all; a read starts nothing.
  useEffect(() => {
    if (!workspaceId || !csrf || browser) return;
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
  }, [workspaceId, csrf, browser]);

  // Below 800 px an open VS Code asks, on Habitat's own row, to be saved
  // there first: Habitat cannot see or save VS Code's buffers, so VS Code
  // stays until the person switches (Jari 7.11.2026). Staying holds until
  // the window crosses the breakpoint again.
  const compactDeclined = useRef(false);
  const [phoneAsk, setPhoneAsk] = useState(false);
  const toPhoneEditor = useCallback(() => {
    setPhoneAsk(false);
    setFrame(undefined);
    setPhase("idle");
    setEngine("codemirror6");
  }, []);
  useEffect(() => {
    const resize = () => {
      setTotal(window.innerWidth);
      if (window.innerWidth > 800) {
        compactDeclined.current = false;
        setPhoneAsk(false);
        return;
      }
      if (compactDeclined.current || engine === "codemirror6") return;
      if (frame) setPhoneAsk(true);
      else toPhoneEditor();
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [engine, frame, toPhoneEditor]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only a changed stored preference requests an engine switch; growing the viewport does not.
  useEffect(() => {
    const next = window.innerWidth <= 800 ? "codemirror6" : preference;
    if (next === engine) return;
    // Another tab's preference is an observation, not a request to discard.
    // Keep this live document; a later clean opening adopts the stored choice.
    if (browserDocument.current?.retains() || frame) return;
    setFrame(undefined);
    setPhase("idle");
    setEngine(next);
  }, [preference]);
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

  const focusConversationPending = useRef(false);
  const showConversation = useCallback(() => {
    if (!collapsed) {
      composer()?.focus({ preventScroll: true });
      return;
    }
    focusConversationPending.current = true;
    setCollapsed(false);
  }, [collapsed]);
  useLayoutEffect(() => {
    // A frame callback can precede React's expansion commit. Focus only once
    // the column is no longer display:none, without moving its reading place.
    if ((!open || !collapsed) && focusConversationPending.current) {
      focusConversationPending.current = false;
      composer()?.focus({ preventScroll: true });
    }
  }, [collapsed, open]);

  const focusEditor = useCallback(() => {
    if (browser) {
      browserDocument.current?.focus();
      return;
    }
    iframe.current?.focus();
    post({ type: "focus" });
  }, [post, browser]);

  // The first open mints the hand-off, which also names the editor origin;
  // the frame page asks for it when it has no editor session.
  const start = useCallback(async () => {
    if (!csrf || !workspaceId || browser) return;
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
  }, [csrf, workspaceId, frame, browser]);

  const latest = useRef({ browser, workspaceId });
  latest.current = { browser, workspaceId };
  const close = useCallback(() => {
    if (latest.current.browser) setBrowserWorkspace(latest.current.workspaceId);
    setCollapsed(false);
    focusConversationPending.current = true;
    setOpen(false);
  }, []);
  const show = useCallback(
    (next: boolean) => {
      if (!next) {
        // Closing saves the document's text; only a failed save asks.
        const handle = browserDocument.current;
        if (!handle) close();
        else
          void handle.leave().then((ok) => {
            if (ok) close();
          });
        return;
      }
      if (!open) {
        const selected = window.innerWidth <= 800 ? "codemirror6" : preference;
        if (selected !== engine) {
          setFrame(undefined);
          setPhase("idle");
          setEngine(selected);
        }
      }
      setOpen(true);
    },
    [open, preference, engine, close],
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
          ? txt.fileNotFound(ref.path)
          : outcome.kind === "refused" && outcome.code === "editor_not_running"
            ? txt.notYetReceived
            : outcome.kind === "login"
              ? txt.sessionEnded
              : txt.noOpenReply,
      );
    },
    [csrf, focusEditor],
  );

  const [opened, setOpened] = useState<string>();
  const openFile = useCallback(
    (ref: FileRef, text: string) => {
      if (!workspaceId) return;
      if (
        !open &&
        (window.innerWidth <= 800 ? "codemirror6" : preference) !== engine
      ) {
        pendingOpen.current = { ref, workspace: workspaceId, text };
        setOpened(text);
        show(true);
        return;
      }
      if (browser && workspaceId !== browserWorkspace) {
        const move = () => {
          pendingOpen.current = { ref, workspace: workspaceId, text };
          setBrowserWorkspace(workspaceId);
          setOpen(true);
        };
        const handle = browserDocument.current;
        if (!handle) move();
        else
          void handle.leave().then((ok) => {
            if (ok) move();
          });
        return;
      }
      if (browser) {
        setOpen(true);
        pendingOpen.current = { ref, workspace: workspaceId, text };
        if (browserDocument.current) {
          pendingOpen.current = undefined;
          void browserDocument.current.open(ref).then((ok) => {
            if (ok) setOpened(text);
          });
        }
        return;
      }
      setOpened(text);
      if (!open) show(true);
      if (phaseRef.current === "ready" && frame?.workspace === workspaceId)
        void deliver(ref, workspaceId);
      else pendingOpen.current = { ref, workspace: workspaceId, text };
    },
    [
      workspaceId,
      browserWorkspace,
      open,
      show,
      frame,
      deliver,
      browser,
      preference,
      engine,
    ],
  );
  const links = useMemo(
    () =>
      available ? { open: openFile, opened, workspace: workspaceId } : null,
    [available, openFile, opened, workspaceId],
  );

  // The frame page's messages. Only its own window on the editor origin is
  // heard; code-server's webviews share the origin but are other windows.
  // Install at commit: a message after drag expansion must not call a helper
  // that still thinks the now-visible conversation is collapsed.
  useLayoutEffect(() => {
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
          showConversation();
          return;
      }
    };
    const handler = (event: MessageEvent) => void listen(event);
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [frame, csrf, post, deliver, showConversation]);

  // Ctrl+Alt+K outside the editor frame. Inside it, the frame page sends
  // "toggle" instead, since a frame keeps its keys. Like the message listener,
  // this must describe the committed layout before another input can arrive.
  useLayoutEffect(() => {
    if (!available) return;
    const key = (event: KeyboardEvent) => {
      if (!isEditorKey(event)) return;
      event.preventDefault();
      if (!open) {
        show(true);
        requestAnimationFrame(focusEditor);
      } else if (collapsed) {
        showConversation();
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
  }, [available, open, collapsed, show, focusEditor, showConversation]);

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
            toggleOpen: () => show(!open),
            report,
          }
        : null,
    [available, open, collapsed, show, report],
  );

  const editorShown = open && available;
  // The app rail narrows to its compact strip beside an open editor, so the
  // account menu and navigation stay where they always are.
  useEffect(() => {
    onShownChange?.(editorShown);
  }, [editorShown, onShownChange]);
  useEffect(() => () => onShownChange?.(false), [onShownChange]);
  const retry = () => {
    setFrame(undefined);
    setPhase("idle");
  };
  const overlay =
    phase === "ready" && frame ? null : phase === "failed" ? (
      <div className="ah-editor-overlay" role="status">
        <div>
          <strong>{txt.vscodeFailed}</strong>
          <span>{txt.vscodeFailedDetail}</span>
          <ControlButton size="row" onPress={retry}>
            {txt.retry}
          </ControlButton>
        </div>
      </div>
    ) : (
      <div className="ah-editor-overlay" role="status">
        <div>
          <strong>
            <HabitatMark state="loading" size={16} />{" "}
            {phase === "loading" ? txt.loadingInterface : txt.startingVSCode}
          </strong>
          <span>{txt.firstOpenSlow}</span>
        </div>
      </div>
    );
  const headerActions = {
    collapsed,
    onToggleCollapsed: () => {
      if (collapsed) showConversation();
      else setCollapsed(true);
    },
    onClose: () => show(false),
  };
  const editor =
    available && (frame || editorShown) ? (
      <>
        {!browser && <EditorHeader title="VS Code" {...headerActions} />}
        {browser && browserWorkspace && csrf ? (
          <Suspense
            fallback={
              <>
                <EditorHeader title="CodeMirror 6" {...headerActions} />
                <p role="status">{txt.loadingEditor}</p>
              </>
            }
          >
            {browserWorkspace !== workspaceId && (
              <p
                className="ah-editor-workspace-warning"
                role="status"
                data-testid="editor-workspace-changed"
              >
                {txt.workspaceGone}
              </p>
            )}
            <BrowserDocument
              key={browserWorkspace}
              engine="codemirror6"
              toolbarActions={<EditorHeaderActions {...headerActions} />}
              workspace={browserWorkspace}
              csrf={csrf}
              ref={attachBrowser}
              onLeaveSaved={onLeaveSaved}
              onReplaced={(note) =>
                setNotes((before) => [
                  ...before,
                  { ...note, id: ++noteId.current },
                ])
              }
            />
          </Suspense>
        ) : (
          <div className="ah-editor-frame">
            {frame ? (
              <iframe
                data-testid="workspace-editor"
                ref={iframe}
                key={frame.src}
                src={frame.src}
                title={txt.vscodeFrame}
                allow="clipboard-read; clipboard-write"
              />
            ) : null}
            {overlay}
            {note ? (
              <p
                data-testid="editor-problem"
                className="ah-editor-note"
                role="status"
              >
                {note}
              </p>
            ) : null}
          </div>
        )}
        {!browser && phoneAsk ? (
          <div className="ah-editor-phone-ask">
            <WarningBanner
              data-testid="editor-phone-ask"
              tone="neutral"
              title={txt.phoneTitle}
              actions={
                <>
                  <ControlButton
                    data-testid="editor-phone-stay"
                    size="row"
                    variant="quiet"
                    onPress={() => {
                      compactDeclined.current = true;
                      setPhoneAsk(false);
                    }}
                  >
                    {txt.phoneStay}
                  </ControlButton>
                  <ControlButton
                    data-testid="editor-phone-switch"
                    size="row"
                    variant="primary"
                    onPress={toPhoneEditor}
                  >
                    {txt.phoneSwitch}
                  </ControlButton>
                </>
              }
            >
              {txt.phoneBody}
            </WarningBanner>
          </div>
        ) : null}
      </>
    ) : null;

  return (
    <EditorContext.Provider value={controls}>
      <EditorChannelContext.Provider value={channel}>
        <FileLinkContext.Provider value={links}>
          <EditorSplit
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
            onShowConversation={showConversation}
          >
            {children}
          </EditorSplit>
        </FileLinkContext.Provider>
      </EditorChannelContext.Provider>
    </EditorContext.Provider>
  );
}

export function WorkspaceEditor(props: {
  journal?: ConversationJournal;
  workspaceId?: string;
  csrf?: string;
  identity?: string;
  children: ReactNode;
  /** Whether the editor is beside the conversation now. */
  onShownChange?: (shown: boolean) => void;
  /** Leaving the editor saved its text; the owner offers to undo it. */
  onLeaveSaved?: (save: LeaveSave) => void;
}) {
  return (
    <WorkspaceEditorInner
      key={`${props.identity ?? ""}:${props.csrf ?? ""}`}
      {...props}
    />
  );
}

/** The conversation header's editor controls; nothing where no editor is
 * offered. */
export function EditorHeaderControls() {
  const editor = useContext(EditorContext);
  if (!editor) return null;
  return (
    <span className="ah-editor-controls">
      <ControlButton
        data-testid="toggle-editor"
        size="row"
        variant="quiet"
        className={`ah-editor-toggle${editor.open ? " ah-editor-toggle-on" : ""}`}
        aria-label={editor.open ? txt.closeEditor : txt.editor}
        title={editor.open ? txt.closeEditor : txt.openEditor}
        aria-pressed={editor.open}
        onPress={editor.toggleOpen}
      >
        <Icon name="editor" />
      </ControlButton>
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

/** Notes for one conversation about agent changes a save replaced. */
export function useReplaceNotes(workspace: string, conversation?: string) {
  const channel = useContext(EditorChannelContext);
  const notes = channel?.notes;
  const dismiss = channel?.dismiss;
  return useMemo(
    () => ({
      notes: (notes ?? []).filter(
        (note) =>
          note.workspace === workspace && note.conversation === conversation,
      ),
      dismiss: dismiss ?? (() => {}),
    }),
    [notes, dismiss, workspace, conversation],
  );
}
