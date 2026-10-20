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
import { isTerminalShortcut } from "../components/terminalShortcut";
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

type Connection = {
  id: number;
  key: string;
  socket: TerminalSocket;
  /** Output that arrived before this connection's surface was open. */
  held?: Uint8Array[];
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
  const [sticky, setSticky] = useState({ ctrl: false, alt: false });
  const [confirmClose, setConfirmClose] = useState<TerminalTab>();
  const [toast, setToast] = useState<string>();
  const terminal = useRef<TerminalHandle>(null);
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
  useEffect(() => {
    if (pending && list?.shells.some((s) => `s:${s.shell}` === pending.key))
      setPending(undefined);
  }, [list, pending]);

  const focusTerminal = useCallback(
    () => requestAnimationFrame(() => terminal.current?.focus()),
    [],
  );

  const connect = useCallback(
    (key: string, target: TerminalTarget) => {
      if (!csrf) return;
      sequence.current += 1;
      const id = sequence.current;
      setSurfaceId(id);
      setPhase({ kind: "connecting" });
      setReady(undefined);
      setPaste(undefined);
      setSelection(undefined);
      const mine = () => connection.current?.id === id;
      const socket = new TerminalSocket(
        terminalURL(workspaceId, target),
        csrf,
        () => size.current,
        {
          ready: (r) => {
            if (!mine()) return;
            retries.current = 0;
            setReady(r);
            setPhase({ kind: "open" });
            focusTerminal();
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
            connection.current = undefined;
            setReady(undefined);
            setPending(undefined);
            if (target.kind === "taskfleet") {
              setAttached((a) => a.filter((t) => t !== target.token));
              setToast("Taskfleetin ikkuna sulkeutui.");
            } else setToast("Pääte päättyi. Sen tmux-istunto suljettiin.");
            setActive(undefined);
            void refresh();
          },
          closed: (code, reason) => {
            if (!mine()) return;
            if (code >= 4000 && code < 5000) {
              connection.current = undefined;
              setPending(undefined);
              setToast(terminalRefusal(code, reason));
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
              setToast(
                "Yhteys katkesi ennen kuin pääte avautui. Se saattoi silti avautua; avaa paneeli uudelleen tarkistaaksesi.",
              );
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
                    setPhase({ kind: "refused", text: "Pääte on päättynyt." });
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
      connection.current = { id, key, socket, held: [] };
    },
    [csrf, workspaceId, refresh, onLogin, focusTerminal, setOpen],
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
    setOpen(true);
    setPending({ key: "new", name: "bash" });
    setActive("new");
    focusTerminal();
  };

  const closeTab = async (tab: TerminalTab) => {
    if (tab.readOnly) {
      if (connection.current?.key === tab.key) {
        connection.current.socket.close();
        connection.current = undefined;
      }
      setAttached((a) => a.filter((t) => `t:${t}` !== tab.key));
      if (active === tab.key) setActive(undefined);
      setToast(
        `Irrotettiin ${tab.name}. Ikkuna jatkaa Taskfleetissä; liity uudelleen tmux-valikosta.`,
      );
      return;
    }
    if (tab.key === "new" || !csrf) return;
    try {
      await closeShell(workspaceId, tab.key.slice(2), csrf);
      setToast(`${tab.name} lopetettiin.`);
    } catch (error) {
      if (error instanceof TerminalLogin) onLogin?.();
      else if (error instanceof WriteRefused && error.code === "shell_ended")
        setToast(`${tab.name} oli jo päättynyt.`);
      else
        setToast(
          "Lopetuksen tulos jäi epävarmaksi. Päätteet luetaan uudelleen.",
        );
    }
    void refresh();
  };

  const send = (data: string) => {
    if (ready?.read_only || phase.kind !== "open") return;
    const s = stickyRef.current;
    if (s.ctrl || s.alt) setSticky({ ctrl: false, alt: false });
    connection.current?.socket.send(withModifiers(data, s));
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
    const request = ++openRequest.current;
    try {
      const fresh = await listTerminals(workspaceId);
      if (request !== openRequest.current) return;
      setList(fresh);
      if (!fresh.shells.length && !activeKey) {
        setPending({ key: "new", name: "bash" });
        setActive("new");
      }
      setOpen(true);
      focusTerminal();
    } catch (error) {
      if (request !== openRequest.current) return;
      if (error instanceof TerminalLogin) onLogin?.();
      else setToast("Päätteitä ei voitu lukea. Yritä uudelleen.");
    }
  }, [workspaceId, activeKey, setOpen, focusTerminal, onLogin]);

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
      if (inTerminal)
        tablist.current
          ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
          ?.focus();
      else focusTerminal();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, openPanel, focusTerminal]);

  const notice =
    phase.kind === "connecting" && activeTab ? (
      <p>
        {activeKey === "new" ? "Avataan päätettä…" : "Yhdistetään päätteeseen…"}
      </p>
    ) : phase.kind === "detached" ? (
      <>
        <p>Pääte irrotettiin muualta. Se jatkaa tmuxissa.</p>
        <ControlButton
          size="row"
          variant="secondary"
          onPress={() => {
            connection.current = undefined;
            setNonce((n) => n + 1);
          }}
        >
          Liity uudelleen
        </ControlButton>
      </>
    ) : phase.kind === "refused" ? (
      <p>{phase.text}</p>
    ) : undefined;

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
        paste={paste}
        selection={selection}
        sticky={sticky}
        tablistRef={tablist}
        onSelectTab={(key) => {
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
          navigator.clipboard
            ?.readText()
            .then(askPaste)
            .catch(() =>
              setToast(
                "Selain ei antanut leikepöytää. Liitä Ctrl+V:llä tai pitkällä painalluksella.",
              ),
            );
        }}
        onPasteAnswer={(ok) => {
          const lines = paste;
          setPaste(undefined);
          if (ok && lines) terminal.current?.paste(lines.join("\n"));
          focusTerminal();
        }}
        onCopySelection={() => {
          const text = selection?.text;
          setSelection(undefined);
          terminal.current?.clearSelection();
          if (!text) return;
          navigator.clipboard
            ?.writeText(text)
            .then(() => setToast("Valinta kopioitiin leikepöydälle."))
            .catch(() => setToast("Selain ei antanut kopioida."));
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
                setToast(
                  "Valinta lisättiin keskustelun kenttään. Lähetä, kun olet valmis.",
                );
              }
            : undefined
        }
        onFocusTerminal={focusTerminal}
      >
        {activeTab ? (
          <TerminalSurface
            key={surfaceId}
            ref={terminal}
            label={`Pääte ${activeTab?.name ?? "bash"}${ready?.read_only ? " (vain luku)" : ""}`}
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
            onOpen={() => {
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
              className="ah-dialog"
              role="alertdialog"
              aria-label={`Lopetetaanko ${confirmClose.name}?`}
            >
              <Heading slot="title">Lopetetaanko {confirmClose.name}?</Heading>
              <p>
                Siinä on käynnissä{" "}
                <span className="ah-mono">
                  {confirmClose.command ?? "ohjelma"}
                </span>
                . Lopetus päättää sen ja sulkee päätteen tmux-istunnon.
              </p>
              <p>
                Jos haluat vain pois näkyvistä, piilota paneeli: päätteet
                jatkavat.
              </p>
              <div className="ah-dialog-actions">
                <ControlButton
                  size="page"
                  variant="secondary"
                  autoFocus
                  onPress={() => setConfirmClose(undefined)}
                >
                  Peruuta
                </ControlButton>
                <ControlButton
                  size="page"
                  variant="danger"
                  onPress={() => {
                    const tab = confirmClose;
                    setConfirmClose(undefined);
                    void closeTab(tab);
                  }}
                >
                  Lopeta pääte
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
        {toast ? <ToastRegion message={toast} /> : null}
      </>
    ),
  };
}
