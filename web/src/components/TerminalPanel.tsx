import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useId,
  useRef,
} from "react";
import { ControlButton, IconButton } from "./ControlElements";
import { Icon } from "./Icon";
import { Menu } from "./Overlays";
import "./TerminalPanel.css";
import type { TerminalSelection } from "./Terminal";

// Paneeli (proto-browser-shell, Jari 19.10.2026): the workspace's shells as a
// dock under the conversation. This component draws the dock and reports the
// person's intent; the app layer owns the connections and the host state.

export type TerminalTab = {
  key: string;
  name: string;
  busy: boolean;
  /** The program running, when busy (tmux's pane command). */
  command?: string;
  /** A Taskfleet window watched read-only; its × detaches, never ends it. */
  readOnly?: boolean;
  session?: string;
};

export type TerminalAttachable = {
  token: string;
  name: string;
  session: string;
  busy: boolean;
  command?: string;
};

export type TerminalKey =
  | "Escape"
  | "Tab"
  | "ctrl"
  | "alt"
  | "ArrowLeft"
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowRight"
  | "|"
  | "-"
  | "/"
  | "~";

const keyRow: { key: TerminalKey; label: string; name?: string }[] = [
  { key: "Escape", label: "Esc" },
  { key: "Tab", label: "Tab" },
  { key: "ctrl", label: "Ctrl" },
  { key: "alt", label: "Alt" },
  { key: "ArrowLeft", label: "←", name: "Vasen" },
  { key: "ArrowUp", label: "↑", name: "Ylös" },
  { key: "ArrowDown", label: "↓", name: "Alas" },
  { key: "ArrowRight", label: "→", name: "Oikea" },
  { key: "|", label: "|" },
  { key: "-", label: "-" },
  { key: "/", label: "/" },
  { key: "~", label: "~" },
];

/** The top bar's terminal button: opens and hides the panel. */
export function TerminalToggle({
  open,
  count,
  onPress,
}: {
  open: boolean;
  count: number;
  onPress: () => void;
}) {
  return (
    <ControlButton
      size="row"
      variant="quiet"
      className="ah-topbar-icon ah-terminal-toggle"
      aria-label={count ? `Pääte (${count})` : "Pääte"}
      title="Pääte (Ctrl+Alt+T / ⌃⌥T)"
      aria-pressed={open}
      onPress={onPress}
    >
      <Icon name="terminal" />
      {count ? (
        <span className="ah-terminal-count" aria-hidden="true">
          {count}
        </span>
      ) : null}
    </ControlButton>
  );
}

const tip = (tab: TerminalTab) =>
  tab.busy
    ? `Ajossa: ${tab.command ?? "ohjelma"}`
    : tab.readOnly
      ? `Taskfleet ${tab.session ?? ""} · vain luku`
      : "Kehotteessa";

export function TerminalPanel({
  workspaceLabel,
  tabs,
  activeKey,
  attachable = [],
  height,
  maximized,
  volatile = false,
  offline = false,
  notice,
  paste,
  selection,
  sticky = { ctrl: false, alt: false },
  children,
  tablistRef,
  onSelectTab,
  onCloseTab,
  onNew,
  onAttach,
  onToggleMax,
  onHide,
  onResize,
  onKey,
  onClipboardPaste,
  onPasteAnswer,
  onCopySelection,
  onSendSelection,
  onFocusTerminal,
}: {
  workspaceLabel: string;
  tabs: TerminalTab[];
  activeKey?: string;
  attachable?: TerminalAttachable[];
  height: number;
  maximized: boolean;
  /** Shells end when the server restarts (no lingering): say so. */
  volatile?: boolean;
  /** The connection is gone: the terminal is dimmed and takes no input. */
  offline?: boolean;
  /** A line over the terminal: connecting, detached, a refusal. */
  notice?: ReactNode;
  /** A multi-line paste waiting for a yes. */
  paste?: string[];
  selection?: TerminalSelection;
  sticky?: { ctrl: boolean; alt: boolean };
  children?: ReactNode;
  tablistRef?: Ref<HTMLDivElement>;
  onSelectTab: (key: string) => void;
  onCloseTab: (key: string) => void;
  onNew: () => void;
  onAttach: (token: string) => void;
  onToggleMax: () => void;
  onHide: () => void;
  onResize: (height: number) => void;
  onKey: (key: TerminalKey) => void;
  onClipboardPaste: () => void;
  onPasteAnswer: (ok: boolean) => void;
  onCopySelection: () => void;
  /** Absent when there is no composer to send to. */
  onSendSelection?: () => void;
  onFocusTerminal: () => void;
}) {
  const hostId = useId();
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const setTabs = (node: HTMLDivElement | null) => {
    tabsRef.current = node;
    if (typeof tablistRef === "function") tablistRef(node);
    else if (tablistRef) tablistRef.current = node;
  };
  const focusTab = (key: string) =>
    requestAnimationFrame(() =>
      tabsRef.current
        ?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(key)}"]`)
        ?.focus(),
    );
  const onTabKey = (event: KeyboardEvent, index: number) => {
    const tab = tabs[index];
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const next =
        tabs[
          (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
            tabs.length
        ];
      onSelectTab(next.key);
      focusTab(next.key);
    } else if (event.key === "Enter" || event.key === "ArrowDown") {
      event.preventDefault();
      onSelectTab(tab.key);
      onFocusTerminal();
    } else if (event.key === "Delete") {
      event.preventDefault();
      onCloseTab(tab.key);
    }
  };
  const grip = useRef<{ y: number; h: number }>(undefined);
  const active = tabs.find((t) => t.key === activeKey);
  const activeTabId = active ? `${hostId}-tab-${active.key}` : undefined;
  return (
    <section
      className="ah-terminal-dock"
      aria-label="Päätepaneeli"
      data-max={maximized || undefined}
      style={{ "--ah-terminal-height": `${height}px` } as CSSProperties}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: a focusable separator is the ARIA pattern for a resize grip. */}
      <div
        className="ah-terminal-grip"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Paneelin korkeus"
        aria-valuenow={height}
        aria-valuemin={160}
        aria-valuemax={640}
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          grip.current = { y: event.clientY, h: height };
          const move = (e: PointerEvent) => {
            if (grip.current)
              onResize(grip.current.h + grip.current.y - e.clientY);
          };
          const up = () => {
            grip.current = undefined;
            removeEventListener("pointermove", move);
            removeEventListener("pointerup", up);
          };
          addEventListener("pointermove", move);
          addEventListener("pointerup", up);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          onResize(height + (event.key === "ArrowUp" ? 24 : -24));
        }}
      />
      <div className="ah-terminal-bar">
        <button
          type="button"
          className="ah-terminal-back"
          aria-label="Takaisin keskusteluun"
          onClick={onHide}
        >
          <Icon name="back" />
          <span>Keskustelu</span>
        </button>
        <span className="ah-terminal-ws ah-mono" title={workspaceLabel}>
          {workspaceLabel}
        </span>
        <div className="ah-terminal-tabs" ref={setTabs}>
          {/* Own only the tab buttons: the adjacent close actions must remain
              separate buttons, not children of a tablist (or of a tab). */}
          <div
            role="tablist"
            aria-label={`Päätteet: ${workspaceLabel}`}
            aria-owns={
              tabs.length
                ? tabs.map((tab) => `${hostId}-tab-${tab.key}`).join(" ")
                : undefined
            }
            style={{ position: "absolute", width: 1, height: 1 }}
          />
          {tabs.map((tab, index) => {
            const on = tab.key === activeKey;
            return (
              <div
                key={tab.key}
                className="ah-terminal-tab"
                data-active={on || undefined}
                data-readonly={tab.readOnly || undefined}
              >
                <button
                  type="button"
                  role="tab"
                  id={`${hostId}-tab-${tab.key}`}
                  data-tab={tab.key}
                  aria-selected={on}
                  aria-controls={hostId}
                  tabIndex={on || (!activeKey && index === 0) ? 0 : -1}
                  title={tip(tab)}
                  onClick={() => onSelectTab(tab.key)}
                  onKeyDown={(event) => onTabKey(event, index)}
                >
                  <span className="ah-terminal-mark">
                    {tab.busy ? (
                      <span
                        className="ah-terminal-busy"
                        role="img"
                        aria-label={`Ajossa: ${tab.command ?? "ohjelma"}`}
                      />
                    ) : (
                      <span
                        className="ah-terminal-prompt"
                        role="img"
                        aria-label="Kehotteessa"
                      >
                        $
                      </span>
                    )}
                  </span>
                  <span className="ah-mono">{tab.name}</span>
                  {tab.readOnly ? (
                    <span className="ah-terminal-ro">vain luku</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="ah-terminal-x"
                  tabIndex={-1}
                  aria-label={
                    tab.readOnly ? `Irrota ${tab.name}` : `Lopeta ${tab.name}`
                  }
                  title={
                    tab.readOnly
                      ? "Irrota: Taskfleetin ikkuna jatkaa"
                      : "Lopeta pääte"
                  }
                  onClick={() => onCloseTab(tab.key)}
                >
                  <Icon name={tab.readOnly ? "external" : "cross"} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="ah-terminal-tools">
          {tabs.length ? (
            <IconButton
              size="row"
              variant="quiet"
              aria-label={`Uusi pääte työtilaan ${workspaceLabel}`}
              title="Uusi pääte"
              onPress={onNew}
            >
              <Icon name="plus" />
            </IconButton>
          ) : null}
          {attachable.length ? (
            <Menu
              label="Taskfleetin tmux-ikkunat"
              triggerLabel={`Liity Taskfleetin ikkunaan (${attachable.length})`}
              triggerClassName="ah-terminal-attach"
              trigger={
                <>
                  <Icon name="link" />
                  <span>tmux</span>
                  <span className="ah-terminal-n">{attachable.length}</span>
                </>
              }
              heading="Taskfleetin ikkunat (vain luku)"
              placement="bottom end"
              items={attachable.map((a) => ({
                id: a.token,
                label: a.name,
                description: `${a.session}${a.busy && a.command ? ` · ajaa ${a.command}` : ""}`,
              }))}
              onAction={onAttach}
            />
          ) : null}
          <IconButton
            size="row"
            variant="quiet"
            className="ah-terminal-maxbtn"
            aria-label={maximized ? "Palauta koko" : "Suurenna"}
            title={maximized ? "Palauta koko" : "Suurenna"}
            aria-pressed={maximized}
            onPress={onToggleMax}
          >
            <Icon name={maximized ? "edges" : "expand"} />
          </IconButton>
          <IconButton
            size="row"
            variant="quiet"
            aria-label="Piilota paneeli (päätteet jatkavat)"
            title="Piilota paneeli (päätteet jatkavat)"
            onPress={onHide}
          >
            <Icon name="down" />
          </IconButton>
        </div>
      </div>
      <div
        className="ah-terminal-host"
        id={hostId}
        role="tabpanel"
        aria-labelledby={activeTabId}
        data-offline={offline || undefined}
      >
        {tabs.length ? (
          children
        ) : (
          <div className="ah-terminal-empty">
            <Icon name="terminal" />
            <p>
              Työtilassa <span className="ah-mono">{workspaceLabel}</span> ei
              ole päätettä.
            </p>
            <p className="ah-terminal-sub">
              Pääte on tavallinen bash työtilan hakemistossa. Se jatkaa
              palvelimella, kun suljet selaimen
              {volatile
                ? ", mutta päättyy, jos palvelin käynnistetään uudelleen."
                : "."}
            </p>
            <ControlButton size="row" variant="primary" onPress={onNew}>
              <Icon name="terminal" />
              Avaa pääte
            </ControlButton>
          </div>
        )}
        {offline ? (
          <p className="ah-terminal-offline">Vain luku, kunnes yhteys palaa</p>
        ) : null}
        {notice ? <div className="ah-terminal-notice">{notice}</div> : null}
        {selection ? (
          <div
            className="ah-terminal-chip"
            style={
              selection.at
                ? {
                    top: Math.max(4, selection.at.top - 40),
                    left: Math.max(4, selection.at.left),
                  }
                : undefined
            }
          >
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onCopySelection}
            >
              <Icon name="copy" />
              <span>Kopioi</span>
            </button>
            {onSendSelection ? (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onSendSelection}
              >
                <Icon name="message" />
                <span>Vie keskusteluun</span>
              </button>
            ) : null}
          </div>
        ) : null}
        {paste ? (
          // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Escape answers the paste question without leaving the panel.
          <fieldset
            className="ah-terminal-paste"
            aria-label="Monirivinen liitos"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onPasteAnswer(false);
              }
            }}
          >
            <p>
              <Icon name="copy" />
              <span>
                <strong>Liitetäänkö {paste.length} riviä?</strong> Pääte saa ne
                kuin kirjoitettuina, ja komentotulkki voi ajaa ne heti.
              </span>
            </p>
            <pre className="ah-mono">
              {paste.slice(0, 4).join("\n")}
              {paste.length > 4 ? `\n… ja ${paste.length - 4} riviä lisää` : ""}
            </pre>
            <div className="ah-terminal-paste-actions">
              <ControlButton
                size="row"
                variant="secondary"
                onPress={() => onPasteAnswer(false)}
              >
                Peruuta
              </ControlButton>
              <ControlButton
                size="row"
                variant="primary"
                autoFocus
                onPress={() => onPasteAnswer(true)}
              >
                Liitä
              </ControlButton>
            </div>
          </fieldset>
        ) : null}
      </div>
      {tabs.length ? (
        <>
          <div
            className="ah-terminal-keys"
            role="toolbar"
            aria-label="Päätteen näppäimet"
          >
            {keyRow.map((k) => (
              <button
                type="button"
                key={k.key}
                className="ah-terminal-key"
                data-wide={k.key.length > 3 || undefined}
                aria-label={k.name ?? k.label}
                aria-pressed={
                  k.key === "ctrl"
                    ? sticky.ctrl
                    : k.key === "alt"
                      ? sticky.alt
                      : undefined
                }
                // The on-screen keyboard stays up: the key never takes focus.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onKey(k.key)}
              >
                {k.label}
              </button>
            ))}
            <button
              type="button"
              className="ah-terminal-key"
              data-wide
              aria-label="Liitä leikepöydältä"
              onPointerDown={(e) => e.preventDefault()}
              onClick={onClipboardPaste}
            >
              <Icon name="copy" />
              <span>Liitä</span>
            </button>
          </div>
          <p className="ah-terminal-hint">
            <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd> vie fokuksen välilehtiin
            ja takaisin · <kbd>Tab</kbd> ja <kbd>Esc</kbd> kuuluvat päätteelle ·
            valitse <kbd>Shift</kbd>+vetämällä · <kbd>Ctrl</kbd>+<kbd>C</kbd>{" "}
            kopioi, <kbd>Ctrl</kbd>+<kbd>V</kbd> liittää
            {volatile
              ? " · päätteet päättyvät, jos palvelin käynnistetään uudelleen"
              : ""}
          </p>
        </>
      ) : null}
    </section>
  );
}
