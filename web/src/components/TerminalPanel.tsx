import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useId,
  useRef,
} from "react";
import { textNow, useText } from "../i18n";
import { terminalPanelText } from "../text/terminalPanel";
import { ControlButton, controlClassName, IconButton } from "./ControlElements";
import { Icon } from "./Icon";
import { Menu } from "./Overlays";
import { TooltipButton } from "./QuickTooltip";
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

const keyRow: {
  key: TerminalKey;
  label: string;
  name?: keyof (typeof terminalPanelText)["fi"]["keys"];
}[] = [
  { key: "Escape", label: "Esc" },
  { key: "Tab", label: "Tab" },
  { key: "ctrl", label: "Ctrl" },
  { key: "alt", label: "Alt" },
  { key: "ArrowLeft", label: "←", name: "left" },
  { key: "ArrowUp", label: "↑", name: "up" },
  { key: "ArrowDown", label: "↓", name: "down" },
  { key: "ArrowRight", label: "→", name: "right" },
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
  const txt = useText(terminalPanelText);
  return (
    <ControlButton
      data-testid="toggle-terminal"
      size="row"
      variant="quiet"
      className="ah-topbar-icon ah-terminal-toggle"
      aria-label={txt.toggle(count)}
      title={txt.toggleTitle}
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

/** A program in the terminal asked to open an address (its $BROWSER). The
 * person sees where it leads before anything opens, and opens it with a
 * press of their own, which browsers also allow as a new tab. */
function UrlOffer({ url, onDismiss }: { url: string; onDismiss?: () => void }) {
  const txt = useText(terminalPanelText);
  const host = new URL(url).host;
  return (
    <section
      data-testid="terminal-url-offer"
      className="ah-terminal-url"
      aria-label={txt.urlOffer}
    >
      <p>
        <Icon name="globe" />
        <span>
          <strong>{txt.urlQuestion(host)}</strong> {txt.urlWhy}
        </span>
      </p>
      <p className="ah-terminal-url-full ah-mono" data-testid="terminal-url">
        {url}
      </p>
      <div className="ah-terminal-paste-actions">
        <ControlButton
          data-testid="terminal-url-dismiss"
          size="row"
          variant="secondary"
          onPress={onDismiss}
        >
          {txt.urlDismiss}
        </ControlButton>
        <a
          data-testid="terminal-url-open"
          className={`ah-terminal-url-open ${controlClassName({ variant: "primary", size: "row", text: true })}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onDismiss}
        >
          <Icon name="external" />
          {txt.urlOpen}
        </a>
      </div>
    </section>
  );
}

const tip = (tab: TerminalTab) => {
  const txt = textNow(terminalPanelText);
  return tab.busy
    ? txt.running(tab.command)
    : tab.readOnly
      ? txt.taskfleetTip(tab.session ?? "")
      : txt.atPrompt;
};

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
  feedback,
  paste,
  selection,
  selectionCopied = false,
  urlOffer,
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
  onDismissUrl,
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
  /** Persistent feedback from a terminal action, outside the terminal surface. */
  feedback?: ReactNode;
  /** A multi-line paste waiting for a yes. */
  paste?: string[];
  selection?: TerminalSelection;
  /** The selection is already on the clipboard (copy on select). */
  selectionCopied?: boolean;
  /** An http(s) address a program in the terminal asked to open. */
  urlOffer?: string;
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
  /** The address card goes away: opened or dismissed. */
  onDismissUrl?: () => void;
  onFocusTerminal: () => void;
}) {
  const txt = useText(terminalPanelText);
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
      data-testid="terminal-panel"
      className="ah-terminal-dock"
      aria-label={txt.panel}
      data-max={maximized || undefined}
      style={{ "--ah-terminal-height": `${height}px` } as CSSProperties}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: a focusable separator is the ARIA pattern for a resize grip. */}
      <div
        data-testid="resize-terminal"
        className="ah-terminal-grip"
        role="separator"
        aria-orientation="horizontal"
        aria-label={txt.height}
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
          data-testid="terminal-back"
          type="button"
          className="ah-terminal-back"
          aria-label={txt.back}
          onClick={onHide}
        >
          <Icon name="back" />
          <span>{txt.conversation}</span>
        </button>
        <span className="ah-terminal-ws ah-mono" title={workspaceLabel}>
          {workspaceLabel}
        </span>
        <div className="ah-terminal-tabs" ref={setTabs}>
          {/* Own only the tab buttons: the adjacent close actions must remain
              separate buttons, not children of a tablist (or of a tab). */}
          <div
            role="tablist"
            aria-label={txt.tabs(workspaceLabel)}
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
                        data-testid="terminal-busy"
                        className="ah-terminal-busy"
                        role="img"
                        aria-label={txt.running(tab.command)}
                      />
                    ) : (
                      <span
                        data-testid="terminal-prompt"
                        className="ah-terminal-prompt"
                        role="img"
                        aria-label={txt.atPrompt}
                      >
                        $
                      </span>
                    )}
                  </span>
                  <span className="ah-mono">{tab.name}</span>
                  {tab.readOnly ? (
                    <span className="ah-terminal-ro">{txt.readOnly}</span>
                  ) : null}
                </button>
                <TooltipButton
                  data-testid="close-terminal"
                  data-tab={tab.key}
                  type="button"
                  className="ah-terminal-x"
                  tabIndex={-1}
                  aria-label={
                    tab.readOnly ? txt.detach(tab.name) : txt.end(tab.name)
                  }
                  title={tab.readOnly ? txt.detachTitle : txt.endTitle}
                  onClick={() => onCloseTab(tab.key)}
                >
                  <Icon name={tab.readOnly ? "external" : "cross"} />
                </TooltipButton>
              </div>
            );
          })}
        </div>
        <div className="ah-terminal-tools">
          {tabs.length ? (
            <IconButton
              data-testid="new-terminal"
              size="row"
              variant="quiet"
              aria-label={txt.newIn(workspaceLabel)}
              title={txt.new}
              onPress={onNew}
            >
              <Icon name="plus" />
            </IconButton>
          ) : null}
          {attachable.length ? (
            <Menu
              label={txt.windows}
              triggerLabel={txt.attach(attachable.length)}
              triggerClassName="ah-terminal-attach"
              trigger={
                <>
                  <Icon name="link" />
                  <span>tmux</span>
                  <span className="ah-terminal-n">{attachable.length}</span>
                </>
              }
              heading={txt.windowsHeading}
              placement="bottom end"
              items={attachable.map((a) => ({
                id: a.token,
                label: a.name,
                description: `${a.session}${a.busy && a.command ? txt.runs(a.command) : ""}`,
              }))}
              onAction={onAttach}
            />
          ) : null}
          <IconButton
            data-testid="maximize-terminal"
            size="row"
            variant="quiet"
            className="ah-terminal-maxbtn"
            aria-label={maximized ? txt.restore : txt.maximize}
            title={maximized ? txt.restore : txt.maximize}
            aria-pressed={maximized}
            onPress={onToggleMax}
          >
            <Icon name={maximized ? "edges" : "expand"} />
          </IconButton>
          <IconButton
            data-testid="hide-terminal"
            size="row"
            variant="quiet"
            aria-label={txt.hide}
            title={txt.hide}
            onPress={onHide}
          >
            <Icon name="down" />
          </IconButton>
        </div>
      </div>
      {feedback}
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
            <p data-testid="terminal-empty">
              {txt.empty(<span className="ah-mono">{workspaceLabel}</span>)}
            </p>
            <p className="ah-terminal-sub">{txt.emptySub(volatile)}</p>
            <ControlButton size="row" variant="primary" onPress={onNew}>
              <Icon name="terminal" />
              {txt.open}
            </ControlButton>
          </div>
        )}
        {offline ? (
          <p data-testid="terminal-offline" className="ah-terminal-offline">
            {txt.offline}
          </p>
        ) : null}
        {notice ? (
          <div data-testid="terminal-notice" className="ah-terminal-notice">
            {notice}
          </div>
        ) : null}
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
              data-testid="copy-selection"
              data-copied={selectionCopied || undefined}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onCopySelection}
            >
              <Icon name={selectionCopied ? "check" : "copy"} />
              <span>{selectionCopied ? txt.copied : txt.copy}</span>
            </button>
            {onSendSelection ? (
              <button
                data-testid="selection-to-composer"
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onSendSelection}
              >
                <Icon name="message" />
                <span>{txt.toConversation}</span>
              </button>
            ) : null}
          </div>
        ) : null}
        {urlOffer ? <UrlOffer url={urlOffer} onDismiss={onDismissUrl} /> : null}
        {paste ? (
          // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Escape answers the paste question without leaving the panel.
          <fieldset
            data-testid="terminal-paste"
            data-lines={paste.length}
            className="ah-terminal-paste"
            aria-label={txt.paste}
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
                <strong>{txt.pasteQuestion(paste.length)}</strong>{" "}
                {txt.pasteWhy}
              </span>
            </p>
            <pre className="ah-mono">
              {paste.slice(0, 4).join("\n")}
              {paste.length > 4 ? `\n${txt.pasteMore(paste.length - 4)}` : ""}
            </pre>
            <div className="ah-terminal-paste-actions">
              <ControlButton
                data-testid="cancel"
                size="row"
                variant="secondary"
                onPress={() => onPasteAnswer(false)}
              >
                {txt.cancel}
              </ControlButton>
              <ControlButton
                data-testid="confirm-paste"
                size="row"
                variant="primary"
                autoFocus
                onPress={() => onPasteAnswer(true)}
              >
                {txt.pasteConfirm}
              </ControlButton>
            </div>
          </fieldset>
        ) : null}
      </div>
      {tabs.length ? (
        <>
          <div
            data-testid="terminal-keys"
            className="ah-terminal-keys"
            role="toolbar"
            aria-label={txt.keyRow}
          >
            {keyRow.map((k) => (
              <button
                data-testid={`terminal-key-${k.key}`}
                type="button"
                key={k.key}
                className="ah-terminal-key"
                data-wide={k.key.length > 3 || undefined}
                aria-label={k.name ? txt.keys[k.name] : k.label}
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
              aria-label={txt.pasteClipboard}
              onPointerDown={(e) => e.preventDefault()}
              onClick={onClipboardPaste}
            >
              <Icon name="copy" />
              <span>{txt.pasteConfirm}</span>
            </button>
          </div>
          <p className="ah-terminal-hint">{txt.hint(volatile)}</p>
        </>
      ) : null}
    </section>
  );
}
