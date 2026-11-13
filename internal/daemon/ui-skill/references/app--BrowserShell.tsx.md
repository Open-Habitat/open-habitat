# app/BrowserShell.tsx

Generated from web/src/app/BrowserShell.tsx; do not edit.

```tsx
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { ControlButton } from "../components/ControlElements";
import { ToastRegion } from "../components/Status";
import {
  type TerminalHandle,
  type TerminalSelection,
  TerminalSurface,
} from "../components/Terminal";
import {
  type TerminalKey,
  TerminalPanel,
  type TerminalTab,
  TerminalToggle,
} from "../components/TerminalPanel";
import { leaveHistoryKey } from "../components/terminalModes";
import { isTerminalShortcut } from "../components/terminalShortcut";
import { WarningBanner, WarningBannerView } from "../components/WarningBanner";
import { liveText, useLanguage } from "../i18n";
import { browserShellText } from "../text/browserShell";
import { useExperimentalFeature } from "./accountPreferences";
import { WriteRefused } from "./mutations";
import {
  closeShell,
  listTerminals,
  type TerminalList,
  TerminalLogin,
  type TerminalReady,
  TerminalSocket,
  type TerminalTarget,
  terminalRefusal,
  terminalURL,
} from "./terminals";

// Per-viewer conveniences only; a failing storage leaves the defaults.
const txt = liveText(browserShellText);

function stored(storage: () => Storage, key: string) {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}
function store(storage: () => Storage, key: string, value: string) {
  try {
    storage().setItem(key, value);
  } catch {
    // The panel works without it.
  }
}
const local = () => localStorage;
// Typing ahead of a shell is a few keystrokes; a paste waits for the shell.
const typedLimit = 4096;

type Connection = {
  id: number;
  key: string;
  socket: TerminalSocket;
  /** Output that arrived before this connection's surface was open. */
  held?: Uint8Array[];
  /** Keys typed into the focused surface before the shell was ready; they go
   * to the shell once it is, as a native terminal's would. */
  typed?: string[];
  /** Set with readiness, before React renders it: input then goes straight
   * to the socket, or nowhere for a read-only terminal. */
  readOnly?: boolean;
};
type Phase =
  | { kind: "connecting" }
  | { kind: "open" }
  | { kind: "offline" }
  | { kind: "detached" }
  | { kind: "refused"; text: string };

const keySequences: Partial<Record<TerminalKey, string>> = {
  Escape: "\x1b",
  Tab: "\t",
  ArrowUp: "\x1b[A",
  ArrowDown: "\x1b[B",
  ArrowRight: "\x1b[C",
  ArrowLeft: "\x1b[D",
};

/** Sticky Ctrl turns the next character into its control code. */
export function withModifiers(
  data: string,
  sticky: { ctrl: boolean; alt: boolean },
) {
  let out = data;
  if (sticky.ctrl && out.length === 1) {
    const c = out.toUpperCase().charCodeAt(0);
    if (out === " ") out = "\x00";
    else if (c >= 0x40 && c <= 0x5f) out = String.fromCharCode(c & 0x1f);
  }
  if (sticky.alt) out = `\x1b${out}`;
  return out;
}

/** The lines of a paste, without the trailing newline most copies carry. */
export function pasteLines(text: string) {
  return text.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
}

/** Shells with the same window name are told apart as bash, bash-2, … */
export function tabNames(names: string[]) {
  const seen = new Map<string, number>();
  return names.map((raw) => {
    const name = raw || "bash";
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    return n === 1 ? name : `${name}-${n}`;
  });
}

/**
 * The workspace's shells for a conversation view: the top bar's toggle and
 * the dock under the composer (Paneeli). Only the visible tab holds a
 * connection; the shells themselves run in tmux whatever the browser does.
 */
export function useBrowserShell({
  workspaceId,
  workspaceLabel,
  csrf,
  onLogin,
  onSendToConversation,
}: {
  workspaceId: string;
  workspaceLabel: string;
  csrf?: string;
  onLogin?: () => void;
  /** Absent when the conversation takes no input. */
  onSendToConversation?: (text: string) => void;
}): { toggle: ReactNode; panel: ReactNode } {
  // Opening is an explicit intent in this view, not a cross-workspace preference.
  // Restoring a bare open flag used to mount an empty dock without opening a shell.
  const [open, setOpenState] = useState(false);
  const openRequest = useRef(0);
  const setOpen = useCallback((value: boolean) => {
    if (!value) openRequest.current += 1;
    setOpenState(value);
  }, []);
  const [height, setHeightState] = useState(() => {
    const h = Number(stored(local, "oh.terminal.height"));
    return h >= 160 && h <= 640 ? h : 280;
  });
  const setHeight = (h: number) => {
    const next = Math.max(160, Math.min(640, Math.round(h)));
    setHeightState(next);
    store(local, "oh.terminal.height", String(next));
  };
  const [maximized, setMaximized] = useState(false);
  const [list, setList] = useState<TerminalList>();
  const [attached, setAttached] = useState<string[]>([]);
  const [active, setActive] = useState<string>();
  // A tab the list does not show yet: a shell being opened ("new"), then
  // the numbered shell it became until the next list read includes it.
  const [pending, setPending] = useState<{ key: string; name: string }>();
  const [phase, setPhase] = useState<Phase>({ kind: "connecting" });
  const [ready, setReady] = useState<TerminalReady>();
  const [surfaceId, setSurfaceId] = useState(0);
  const [nonce, setNonce] = useState(0);
  const [paste, setPaste] = useState<string[]>();
  const [selection, setSelection] = useState<TerminalSelection>();
  // The text copy on select put on the clipboard; the chip says so while
  // that text is the selection.
  const [copied, setCopied] = useState<string>();
  const [urlOffer, setUrlOffer] = useState<string>();
  const copyOnSelect = useExperimentalFeature("terminal-copy-on-select");
  const openUrls = useExperimentalFeature("terminal-open-urls");
  const [sticky, setSticky] = useState({ ctrl: false, alt: false });
  const [confirmClose, setConfirmClose] = useState<TerminalTab>();
  const [toast, setToast] = useState<string>();
  const [shellNotice, setShellNotice] = useState<{
    text: string;
    tone: "danger" | "neutral";
  }>();
  useLanguage();
  const terminal = useRef<TerminalHandle>(null);
  const focusOnOpen = useRef(false);
  const tablist = useRef<HTMLDivElement>(null);
  const connection = useRef<Connection>(undefined);
  const size = useRef({ cols: 80, rows: 24 });
  const retries = useRef(0);
  const sequence = useRef(0);
  const stickyRef = useRef(sticky);
  stickyRef.current = sticky;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const refresh = useCallback(async () => {
    try {
      setList(await listTerminals(workspaceId));
    } catch (error) {
      if (error instanceof TerminalLogin) onLogin?.();
    }
  }, [workspaceId, onLogin]);
  // Read once for the count, and while the panel is open for the busy marks.
  useEffect(() => {
    void refresh();
    if (!open) return;
    const timer = setInterval(() => void refresh(), 3000);
    return () => clearInterval(timer);
  }, [open, refresh]);

  const tabs = useMemo<TerminalTab[]>(() => {
    const shells = list?.shells ?? [];
    const names = tabNames(shells.map((s) => s.name));
    const out: TerminalTab[] = shells.map((s, i) => ({
      key: `s:${s.shell}`,
      name: names[i],
      busy: s.busy,
      command: s.command,
    }));
    if (pending && !out.some((t) => t.key === pending.key))
      out.push({ key: pending.key, name: pending.name, busy: false });
    for (const token of attached) {
      const w = list?.taskfleet.find((t) => t.token === token);
      if (w)
        out.push({
          key: `t:${token}`,
          name: w.name,
          busy: w.busy,
          command: w.command,
          readOnly: true,
          session: w.session,
        });
    }
    return out;
  }, [list, attached, pending]);
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];
  const activeKey = activeTab?.key;
  // Read by socket callbacks, which outlive the render that made them.
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  useEffect(() => {
    if (pending && list?.shells.some((s) => `s:${s.shell}` === pending.key))
      setPending(undefined);
  }, [list, pending]);

  const focusTerminal = useCallback(() => {
    // An explicit entry may precede the new surface's mount.
    focusOnOpen.current = true;
    requestAnimationFrame(() => terminal.current?.focus());
  }, []);

  const connect = useCallback(
    (key: string, target: TerminalTarget) => {
      if (!csrf) return;
      sequence.current += 1;
      const id = sequence.current;
      if (document.activeElement?.closest(".ah-terminal-surface"))
        focusOnOpen.current = true;
      setSurfaceId(id);
      setPhase({ kind: "connecting" });
      setReady(undefined);
      setPaste(undefined);
      setSelection(undefined);
      setUrlOffer(undefined);
      const mine = () => connection.current?.id === id;
      const socket = new TerminalSocket(
        terminalURL(workspaceId, target),
        csrf,
        () => size.current,
        {
          ready: (r) => {
            if (!mine()) return;
            const c = connection.current;
            if (c) {
              const typed = c.typed ?? [];
              c.typed = undefined;
              c.readOnly = !!r.read_only;
              if (!c.readOnly) for (const text of typed) c.socket.send(text);
            }
            retries.current = 0;
            setReady(r);
            setPhase({ kind: "open" });
            // Readiness reports transport state, not an intent to move focus.
            if (r.shell && connection.current) {
              // A new shell becomes its numbered tab without reconnecting.
              const key = `s:${r.shell}`;
              connection.current.key = key;
              // The window is named after its program once bash runs;
              // the list reports that name.
              setPending((p) => (p ? { key, name: p.name } : p));
              setActive(key);
              void refresh();
            }
          },
          data: (bytes) => {
            if (!mine() || !connection.current) return;
            if (connection.current.held) connection.current.held.push(bytes);
            else terminal.current?.write(bytes);
          },
          exit: (state) => {
            if (!mine()) return;
            if (state === "detached") {
              setPhase({ kind: "detached" });
              return;
            }
            const ended = connection.current?.key;
            connection.current = undefined;
            setReady(undefined);
            setPending(undefined);
            // The shell ended itself (exit, Ctrl-D) and tmux ended its
            // session: drop its tab now rather than after the next list
            // read, and close the panel when it was the last one.
            const last = !tabsRef.current.some(
              (t) => t.key !== ended && t.key !== "new",
            );
            if (target.kind === "taskfleet") {
              setAttached((a) => a.filter((t) => t !== target.token));
              if (!last)
                setShellNotice({
                  text: txt.taskfleetWindowClosed,
                  tone: "neutral",
                });
            } else {
              setList((current) =>
                current
                  ? {
                      ...current,
                      shells: current.shells.filter(
                        (s) => `s:${s.shell}` !== ended,
                      ),
                    }
                  : current,
              );
              if (!last)
                setShellNotice({ text: txt.shellEnded, tone: "neutral" });
            }
            if (last) {
              setOpen(false);
              setMaximized(false);
            }
            setActive(undefined);
            void refresh();
          },
          closed: (code, reason) => {
            if (!mine()) return;
            if (code >= 4000 && code < 5000) {
              connection.current = undefined;
              setPending(undefined);
              setShellNotice({
                text: terminalRefusal(code, reason),
                tone: "danger",
              });
              setOpen(false);
              setMaximized(false);
              if (reason === "shell_ended" || key === "new") {
                setActive(undefined);
                void refresh();
              }
              return;
            }
            if (connection.current?.key === "new") {
              // Whether the shell was made is unknown: never open another
              // automatically. The list shows it if it exists.
              connection.current = undefined;
              setPending(undefined);
              setActive(undefined);
              setShellNotice({ text: txt.lostBeforeOpen, tone: "neutral" });
              setOpen(false);
              setMaximized(false);
              void refresh();
              return;
            }
            // The shell keeps running on the server; try again with backoff.
            setPhase({ kind: "offline" });
            const delay = Math.min(10_000, 1000 * 2 ** retries.current);
            retries.current += 1;
            setTimeout(() => {
              if (!mine()) return;
              void listTerminals(workspaceId).then(
                (fresh) => {
                  if (!mine()) return;
                  setList(fresh);
                  const still =
                    target.kind === "taskfleet"
                      ? fresh.taskfleet.some((t) => t.token === target.token)
                      : fresh.shells.some(
                          (s) => `s:${s.shell}` === connection.current?.key,
                        );
                  connection.current = undefined;
                  if (still) setNonce((n) => n + 1);
                  else {
                    setPhase({ kind: "refused", text: txt.ended });
                    setActive(undefined);
                  }
                },
                (error) => {
                  if (!mine()) return;
                  if (error instanceof TerminalLogin) {
                    connection.current = undefined;
                    onLogin?.();
                    return;
                  }
                  connection.current = undefined;
                  setNonce((n) => n + 1);
                },
              );
            }, delay);
          },
        },
      );
      connection.current = { id, key, socket, held: [], typed: [] };
    },
    [csrf, workspaceId, refresh, onLogin, setOpen],
  );

  // The visible tab holds the one connection; hiding the panel lets it go.
  // biome-ignore lint/correctness/useExhaustiveDependencies: nonce asks for a fresh connection to the same tab.
  useEffect(() => {
    const want = open ? activeKey : undefined;
    if (connection.current && connection.current.key === want) return;
    connection.current?.socket.close();
    connection.current = undefined;
    if (!want) return;
    if (want === "new") connect("new", { kind: "shell", shell: "new" });
    else if (want.startsWith("s:"))
      connect(want, { kind: "shell", shell: want.slice(2) });
    else connect(want, { kind: "taskfleet", token: want.slice(2) });
  }, [open, activeKey, nonce, connect]);
  useEffect(
    () => () => {
      openRequest.current += 1;
      connection.current?.socket.close();
      connection.current = undefined;
    },
    [],
  );

  const startNew = () => {
    setShellNotice(undefined);
    setOpen(true);
    setPending({ key: "new", name: "bash" });
    setActive("new");
    focusTerminal();
  };

  const closeTab = async (tab: TerminalTab) => {
    setShellNotice(undefined);
    if (tab.readOnly) {
      if (connection.current?.key === tab.key) {
        connection.current.socket.close();
        connection.current = undefined;
      }
      setAttached((a) => a.filter((t) => `t:${t}` !== tab.key));
      if (active === tab.key) setActive(undefined);
      setToast(txt.detachedNamed(tab.name));
      return;
    }
    if (tab.key === "new" || !csrf) return;
    // This gesture owns the outcome. Do not let the socket's concurrent exit
    // announce an unexpected shell end (or reconnect to the closing shell).
    if (connection.current?.key === tab.key) {
      const closing = connection.current;
      connection.current = undefined;
      closing.socket.close();
      setReady(undefined);
      setPhase({ kind: "connecting" });
    }
    const closed = () => {
      setList((current) =>
        current
          ? {
              ...current,
              shells: current.shells.filter((s) => `s:${s.shell}` !== tab.key),
            }
          : current,
      );
      setPending((p) => (p?.key === tab.key ? undefined : p));
      if (activeKey === tab.key) setActive(undefined);
      if (tabs.length === 1) {
        setOpen(false);
        setMaximized(false);
        setToast(undefined);
      } else setToast(txt.stopped(tab.name));
    };
    try {
      await closeShell(workspaceId, tab.key.slice(2), csrf);
      closed();
    } catch (error) {
      if (error instanceof TerminalLogin) onLogin?.();
      else if (error instanceof WriteRefused && error.code === "shell_ended")
        closed();
      else setShellNotice({ text: txt.stopUncertain, tone: "neutral" });
      // A refused or uncertain close must not leave a live tab disconnected.
      setNonce((n) => n + 1);
    }
    void refresh();
  };

  const send = (data: string) => {
    const c = connection.current;
    if (!c || c.readOnly) return;
    // Readiness is the connection's own: the rendered phase may still say
    // connecting just after the shell became ready.
    if (!c.typed && phase.kind !== "open" && phase.kind !== "connecting")
      return;
    const s = stickyRef.current;
    if (s.ctrl || s.alt) setSticky({ ctrl: false, alt: false });
    // The surface's key for leaving tmux's history leads typed input; the
    // modifiers belong to what was typed.
    const lead = data.startsWith(leaveHistoryKey) ? leaveHistoryKey : "";
    const text = lead + withModifiers(data.slice(lead.length), s);
    if (!c.typed) c.socket.send(text);
    else if (c.typed.reduce((n, t) => n + t.length, text.length) <= typedLimit)
      c.typed.push(text);
  };

  const askPaste = (text: string) => {
    if (ready?.read_only || phase.kind !== "open") return;
    const lines = pasteLines(text);
    if (lines.length < 2) terminal.current?.paste(lines[0] ?? "");
    else setPaste(lines);
  };

  // An explicit open reuses an existing shell or starts one, never both.
  // Read at the time of the gesture: the mount-time count may be stale.
  const openPanel = useCallback(async () => {
    setShellNotice(undefined);
    const request = ++openRequest.current;
    try {
      const fresh = await listTerminals(workspaceId);
      if (request !== openRequest.current) return;
      setList(fresh);
      const hasAttachment = fresh.taskfleet.some((t) =>
        attached.includes(t.token),
      );
      if (!fresh.shells.length && !hasAttachment) {
        setPending({ key: "new", name: "bash" });
        setActive("new");
      }
      setOpen(true);
      focusTerminal();
    } catch (error) {
      if (request !== openRequest.current) return;
      if (error instanceof TerminalLogin) onLogin?.();
      else setShellNotice({ text: txt.listFailed, tone: "neutral" });
    }
  }, [workspaceId, attached, setOpen, focusTerminal, onLogin]);

  // Capture before the composer's Enter handler or xterm can consume it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isTerminalShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (!open) {
        void openPanel();
        return;
      }
      const inTerminal = document.activeElement?.closest(
        ".ah-terminal-surface",
      );
      if (inTerminal) {
        focusOnOpen.current = false;
        tablist.current
          ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
          ?.focus();
      } else focusTerminal();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, openPanel, focusTerminal]);

  const notice =
    phase.kind === "connecting" && activeTab ? (
      <p data-testid="terminal-connecting">
        {activeKey === "new" ? txt.opening : txt.connecting}
      </p>
    ) : phase.kind === "detached" ? (
      <>
        <p>{txt.detachedElsewhere}</p>
        <ControlButton
          size="row"
          variant="secondary"
          onPress={() => {
            connection.current = undefined;
            setNonce((n) => n + 1);
          }}
        >
          {txt.rejoin}
        </ControlButton>
      </>
    ) : phase.kind === "refused" ? (
      <p>{phase.text}</p>
    ) : undefined;

  // An open (including maximized) dock must show its own failures. When
  // closed, use the conversation's notice stack rather than a timed toast.
  const EventNotice = open ? WarningBannerView : WarningBanner;
  const eventNotice = shellNotice ? (
    <EventNotice
      data-testid="terminal-event-notice"
      tone={shellNotice.tone}
      lifetime="event"
      actions={
        <ControlButton
          data-testid="terminal-notice-close"
          size="row"
          variant="quiet"
          aria-label={txt.dismissNotice}
          onPress={() => setShellNotice(undefined)}
        >
          ×
        </ControlButton>
      }
    >
      {shellNotice.text}
    </EventNotice>
  ) : null;

  const panel = open ? (
    <>
      <TerminalPanel
        workspaceLabel={workspaceLabel}
        tabs={tabs}
        activeKey={activeKey}
        attachable={(list?.taskfleet ?? []).filter(
          (t) => !attached.includes(t.token),
        )}
        height={height}
        maximized={maximized}
        volatile={list?.survives_restart === false}
        offline={phase.kind === "offline"}
        notice={notice}
        feedback={eventNotice}
        paste={paste}
        selection={selection}
        selectionCopied={!!selection && selection.text === copied}
        urlOffer={openUrls ? urlOffer : undefined}
        onDismissUrl={() => {
          setUrlOffer(undefined);
          focusTerminal();
        }}
        sticky={sticky}
        tablistRef={tablist}
        onSelectTab={(key) => {
          focusOnOpen.current = false;
          if (pending?.key === "new" && key !== "new") setPending(undefined);
          setActive(key);
        }}
        onCloseTab={(key) => {
          const tab = tabs.find((t) => t.key === key);
          if (!tab) return;
          if (tab.busy && !tab.readOnly) setConfirmClose(tab);
          else void closeTab(tab);
        }}
        onNew={startNew}
        onAttach={(token) => {
          setAttached((a) => (a.includes(token) ? a : [...a, token]));
          if (pending?.key === "new") setPending(undefined);
          setActive(`t:${token}`);
          focusTerminal();
        }}
        onToggleMax={() => setMaximized((m) => !m)}
        onHide={() => {
          setOpen(false);
          setMaximized(false);
        }}
        onResize={setHeight}
        onKey={(key) => {
          if (key === "ctrl" || key === "alt") {
            setSticky((s) => ({ ...s, [key]: !s[key] }));
            return;
          }
          const seq = keySequences[key];
          if (seq) {
            if (ready?.read_only || phase.kind !== "open") return;
            connection.current?.socket.send(seq);
          } else send(key);
          focusTerminal();
        }}
        onClipboardPaste={() => {
          setShellNotice(undefined);
          navigator.clipboard
            ?.readText()
            .then(askPaste)
            .catch(() =>
              setShellNotice({ text: txt.noClipboard, tone: "danger" }),
            );
        }}
        onPasteAnswer={(ok) => {
          const lines = paste;
          setPaste(undefined);
          if (ok && lines) terminal.current?.paste(lines.join("\n"));
          focusTerminal();
        }}
        onCopySelection={() => {
          setShellNotice(undefined);
          const text = selection?.text;
          setSelection(undefined);
          terminal.current?.clearSelection();
          if (!text) return;
          navigator.clipboard
            ?.writeText(text)
            .then(() => setToast(txt.copied))
            .catch(() =>
              setShellNotice({ text: txt.copyRefused, tone: "danger" }),
            );
          focusTerminal();
        }}
        onSendSelection={
          onSendToConversation
            ? () => {
                const text = selection?.text;
                setSelection(undefined);
                terminal.current?.clearSelection();
                if (!text) return;
                onSendToConversation(text);
                setToast(txt.sentToComposer);
              }
            : undefined
        }
        onFocusTerminal={focusTerminal}
      >
        {activeTab ? (
          <TerminalSurface
            key={surfaceId}
            ref={terminal}
            label={txt.terminalLabel(
              activeTab?.name ?? "bash",
              !!ready?.read_only,
            )}
            readOnly={ready?.read_only}
            offline={phase.kind === "offline"}
            fixedSize={
              ready?.read_only && ready.cols && ready.rows
                ? { cols: ready.cols, rows: ready.rows }
                : undefined
            }
            onData={send}
            onResize={(cols, rows) => {
              size.current = { cols, rows };
              if (!ready?.read_only)
                connection.current?.socket.resize(cols, rows);
            }}
            onSelection={setSelection}
            onPasteRequest={askPaste}
            copyOnSelect={copyOnSelect}
            onCopied={setCopied}
            onOpenUrl={openUrls ? setUrlOffer : undefined}
            onOpen={() => {
              if (focusOnOpen.current) {
                focusOnOpen.current = false;
                terminal.current?.focus();
              }
              const c = connection.current;
              if (!c || c.id !== surfaceId || !c.held) return;
              for (const bytes of c.held) terminal.current?.write(bytes);
              c.held = undefined;
            }}
          />
        ) : null}
      </TerminalPanel>
      {confirmClose ? (
        <ModalOverlay
          isOpen
          isDismissable
          className="ah-overlay"
          onOpenChange={(o) => {
            if (!o) setConfirmClose(undefined);
          }}
        >
          <Modal className="ah-modal">
            <Dialog
              data-testid="close-terminal-dialog"
              className="ah-dialog"
              role="alertdialog"
              aria-label={txt.stopQuestion(confirmClose.name)}
            >
              <Heading slot="title">
                {txt.stopQuestion(confirmClose.name)}
              </Heading>
              <p>
                {txt.running(
                  <span className="ah-mono">
                    {confirmClose.command ?? txt.program}
                  </span>,
                )}
              </p>
              <p>{txt.hideInstead}</p>
              <div className="ah-dialog-actions">
                <ControlButton
                  size="page"
                  variant="secondary"
                  autoFocus
                  data-testid="cancel"
                  onPress={() => setConfirmClose(undefined)}
                >
                  {txt.cancel}
                </ControlButton>
                <ControlButton
                  size="page"
                  variant="danger"
                  data-testid="confirm-close-terminal"
                  onPress={() => {
                    const tab = confirmClose;
                    setConfirmClose(undefined);
                    void closeTab(tab);
                  }}
                >
                  {txt.stop}
                </ControlButton>
              </div>
            </Dialog>
          </Modal>
        </ModalOverlay>
      ) : null}
    </>
  ) : null;

  const toggle = (
    <TerminalToggle
      open={open}
      count={list?.shells.length ?? 0}
      onPress={() => {
        if (open) {
          setOpen(false);
          setMaximized(false);
        } else {
          void openPanel();
        }
      }}
    />
  );
  return {
    toggle,
    panel: (
      <>
        {panel}
        {!open ? eventNotice : null}
        {toast ? <ToastRegion message={toast} /> : null}
      </>
    ),
  };
}

```
