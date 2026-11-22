import { type CSSProperties, type ReactNode, useEffect } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import type {
  BrowserPointer,
  BrowserStatus,
  BrowserSummary,
  BrowserWindow,
} from "../app/serverBrowser";
import { useText } from "../i18n";
import { serverBrowserText } from "../text/serverBrowser";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import "./ServerBrowser.css";

type Text = typeof serverBrowserText.fi;

function stateLine(txt: Text, summary: BrowserSummary, busy?: string) {
  if (busy === "start") return txt.state.starting;
  switch (summary.kind) {
    case "stopped":
    case "off":
      return txt.state.stopped;
    case "ask":
      return summary.window?.title
        ? txt.state.ask(summary.window.title)
        : txt.state.askUntitled;
    case "person":
      return txt.state.person;
    case "agent":
      return txt.state.agent;
    default:
      return txt.state.idle;
  }
}

/** The agent's pointer and recent presses over a window's picture. */
function PointerMarks({ pointer }: { pointer: BrowserPointer }) {
  const txt = useText(serverBrowserText);
  return (
    <span className="sb-ptr" aria-hidden="true" data-testid="browser-pointer">
      {pointer.clicks.map((c, i) => (
        <i
          // biome-ignore lint/suspicious/noArrayIndexKey: presses have no identity
          key={i}
          className="sb-click"
          style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
        />
      ))}
      <span
        className="sb-ptr-at"
        style={{ left: `${pointer.x * 100}%`, top: `${pointer.y * 100}%` }}
      >
        <svg className="sb-arrow" viewBox="0 0 16 22" aria-hidden="true">
          <path d="M1 1 L1 17 L5.5 13 L8.5 20.5 L11.5 19.2 L8.6 12 L14.5 12 Z" />
        </svg>
        <span className="sb-ptr-label">{txt.pointer}</span>
      </span>
    </span>
  );
}

/** One window's picture with who acts in it. */
function WindowPicture({
  window,
  picture,
  pointer,
  size,
  status,
  onLook,
}: {
  window: BrowserWindow;
  picture?: string;
  pointer?: BrowserPointer;
  size: "big" | "small";
  status: BrowserStatus;
  onLook: () => void;
}) {
  const txt = useText(serverBrowserText);
  const asks = status.request?.window === window.id;
  const mine = status.control === "person";
  return (
    <figure
      className={`sb-win sb-win-${size}`}
      data-testid="browser-window"
      data-window={window.id}
      data-ask={asks || undefined}
      data-active={window.agent || undefined}
    >
      <button
        type="button"
        className="sb-pic"
        aria-label={`${txt.lookBig}: ${window.title || window.origin}`}
        onClick={onLook}
      >
        {picture ? (
          <img src={picture} alt="" draggable={false} />
        ) : (
          <span className="sb-pic-empty">
            <Icon name="globe" />
          </span>
        )}
        {pointer && pointer.window === window.id && !mine ? (
          <PointerMarks pointer={pointer} />
        ) : null}
      </button>
      <figcaption>
        <span className="sb-win-title">{window.title || window.origin}</span>
        {mine ? (
          <span className="sb-who">
            <Icon name="user" />
            {txt.youDrive}
          </span>
        ) : asks ? (
          <span className="sb-who">
            <Icon name="user" />
            {txt.waitsYou}
          </span>
        ) : window.agent && status.agent_connected ? (
          <span className="sb-who sb-who-agent">
            <Icon name="agent" />
            {txt.agentHere}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}

/** The chip above the message field: the browser's windows and state; it
 * opens the strip, or starts a stopped browser. */
export function BrowserChip({
  status,
  summary,
  open,
  busy,
  onToggle,
  onStart,
}: {
  status?: BrowserStatus;
  summary: BrowserSummary;
  open: boolean;
  busy?: string;
  onToggle: () => void;
  onStart: () => void;
}) {
  const txt = useText(serverBrowserText);
  if (summary.kind === "off") return null;
  if (summary.kind === "stopped") {
    return (
      <button
        type="button"
        className="sb-chip"
        data-testid="browser-chip"
        data-state="stopped"
        disabled={busy === "start"}
        onClick={onStart}
        title={txt.openHint}
      >
        <Icon name="globe" />
        <b>{busy === "start" ? txt.state.starting : txt.open}</b>
      </button>
    );
  }
  const windows = status?.windows ?? [];
  return (
    <button
      type="button"
      className={`sb-chip${summary.kind === "ask" ? " sb-chip-ask" : ""}`}
      data-testid="browser-chip"
      data-state={summary.kind}
      aria-expanded={open}
      onClick={onToggle}
    >
      <Icon
        name={
          summary.kind === "person" || summary.kind === "ask" ? "user" : "globe"
        }
      />
      <b>{txt.name}</b>
      <span className="sb-chip-faces" aria-hidden="true">
        {windows.slice(0, 5).map((w) => (
          <i
            key={w.id}
            data-ask={status?.request?.window === w.id || undefined}
            data-active={w.agent || undefined}
          />
        ))}
      </span>
      <span className="sb-chip-n">{txt.windows(windows.length)}</span>
      <span className="sb-chip-state">{stateLine(txt, summary, busy)}</span>
      <Icon name="up" className="sb-chip-fold" />
    </button>
  );
}

/** The strip the chip opens: small live pictures of the windows. A window
 * that needs the person grows large with its request beside it. */
export function BrowserStrip({
  status,
  summary,
  pictures,
  busy,
  error,
  onLook,
  onTakeForRequest,
  onGiveBack,
}: {
  status: BrowserStatus;
  summary: BrowserSummary;
  pictures: Record<string, string>;
  busy?: string;
  error?: string;
  onLook: (window?: string) => void;
  onTakeForRequest: (window: string) => void;
  onGiveBack: () => void;
}) {
  const txt = useText(serverBrowserText);
  const lead =
    status.request &&
    status.windows.find((w) => w.id === status.request?.window);
  const rest = status.windows.filter((w) => w !== lead);
  let now: ReactNode = txt.now.idle;
  if (summary.kind === "agent") now = txt.now.agent;
  if (summary.kind === "ask") now = txt.now.ask;
  if (summary.kind === "person") now = txt.now.person;
  return (
    <section
      className={`sb-strip${lead ? " sb-strip-ask" : ""}`}
      data-testid="browser-strip"
      aria-label={txt.stripTitle}
    >
      {lead && status.request ? (
        <div className="sb-strip-lead">
          <WindowPicture
            window={lead}
            picture={pictures[lead.id]}
            pointer={status.pointer}
            size="big"
            status={status}
            onLook={() => onLook(lead.id)}
          />
          <div className="sb-ask" data-testid="browser-request">
            <h3>
              <Icon name="user" className="sb-ask-mark" />
              {/* The agent's own words, as text. */}
              <span data-testid="browser-request-text">
                {status.request.text}
              </span>
            </h3>
            <p>{txt.askLead}</p>
            {status.control !== "person" ? (
              <div className="sb-actions">
                <ControlButton
                  size="row"
                  variant="primary"
                  data-testid="browser-take-request"
                  isDisabled={!!busy}
                  onPress={() => onTakeForRequest(lead.id)}
                >
                  {txt.takeForRequest}
                </ControlButton>
                <ControlButton
                  size="row"
                  variant="quiet"
                  data-testid="browser-look-first"
                  onPress={() => onLook(lead.id)}
                >
                  <Icon name="eye" />
                  {txt.lookFirst}
                </ControlButton>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {status.windows.length === 0 ? (
        <p className="sb-strip-empty">{txt.noWindows}</p>
      ) : (
        <div className="sb-strip-pics">
          {rest.map((w) => (
            <WindowPicture
              key={w.id}
              window={w}
              picture={pictures[w.id]}
              pointer={status.pointer}
              size="small"
              status={status}
              onLook={() => onLook(w.id)}
            />
          ))}
        </div>
      )}
      {error ? (
        <p role="alert" className="sb-error" data-testid="browser-error">
          {error === "control" ? txt.errors.control : txt.errors.start}
        </p>
      ) : null}
      <div className="sb-strip-foot">
        <p className="sb-strip-now" data-testid="browser-now">
          {now}
        </p>
        {status.control === "person" ? (
          <ControlButton
            size="row"
            variant="primary"
            data-testid="browser-give-back"
            isDisabled={!!busy}
            onPress={onGiveBack}
          >
            {txt.giveBack}
          </ControlButton>
        ) : null}
        <ControlButton
          size="row"
          variant="quiet"
          data-testid="browser-look"
          onPress={() => onLook()}
        >
          <Icon name="eye" />
          {txt.lookBig}
        </ControlButton>
      </div>
    </section>
  );
}

/** The browser as one row at the top of the sidebar. */
export function BrowserRailRow({
  summary,
  windows,
  busy,
  onOpen,
}: {
  summary: BrowserSummary;
  windows: number;
  busy?: string;
  onOpen: () => void;
}) {
  const txt = useText(serverBrowserText);
  if (summary.kind === "off") return null;
  const line =
    summary.kind === "stopped"
      ? busy === "start"
        ? txt.state.starting
        : txt.state.stopped
      : `${stateLine(txt, summary, busy)} · ${txt.windows(windows)}`;
  return (
    <div className="sb-railrow-wrap">
      <button
        type="button"
        className="sb-railrow"
        data-testid="browser-rail-row"
        data-state={summary.kind}
        onClick={onOpen}
      >
        <span className="sb-railrow-mark" aria-hidden="true">
          <Icon
            name={
              summary.kind === "ask" || summary.kind === "person"
                ? "user"
                : "globe"
            }
          />
        </span>
        <span className="sb-railrow-text">
          <b>{txt.ownBrowser}</b>
          <small>{line}</small>
        </span>
      </button>
    </div>
  );
}

/** The sheet: the live view of the whole browser. The frame inside it
 * (BrowserFrame) says who drives and takes and gives back control. */
export function BrowserSheet({
  mode,
  running,
  busy,
  error,
  children,
  onClose,
  onStop,
}: {
  mode: "view" | "control";
  running: boolean;
  busy?: string;
  error?: string;
  children: ReactNode;
  onClose: () => void;
  onStop: () => void;
}) {
  const txt = useText(serverBrowserText);
  return (
    <ModalOverlay
      className="ah-overlay sb-sheet-overlay"
      isDismissable
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal className="ah-modal sb-sheet">
        <AriaDialog
          className="sb-sheet-dialog"
          data-testid="browser-sheet"
          data-mode={mode}
          aria-label={txt.ownBrowser}
        >
          <div className="sb-sheet-head">
            <Heading slot="title">{txt.ownBrowser}</Heading>
            {running ? (
              <ControlButton
                size="row"
                variant="quiet"
                data-testid="browser-stop"
                isDisabled={!!busy}
                onPress={onStop}
              >
                {txt.stop}
              </ControlButton>
            ) : null}
            <ControlButton
              size="row"
              presentation="icon"
              variant="quiet"
              aria-label={txt.sheet.close}
              data-testid="browser-sheet-close"
              onPress={onClose}
            >
              <Icon name="cross" />
            </ControlButton>
          </div>
          {error ? (
            <p
              role="alert"
              className="sb-error sb-sheet-error"
              data-testid="browser-error"
            >
              {error === "control"
                ? txt.errors.control
                : error === "stop"
                  ? txt.errors.stop
                  : txt.errors.start}
            </p>
          ) : null}
          <div className="sb-sheet-screen">{children}</div>
          <p className="sb-truth">{txt.truth}</p>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Who the agent is for the turn tab, as the app layer reads the host. */
export type FrameAgent = "idle" | "busy" | "waits";

/** The frame around the live picture (Kehys): its border is the turn
 * (solid accent: the person, dashed: the agent), a tab on the left holds
 * the turn and Done, a tab on the right opens the clipboard. The picture
 * itself is `children`; the app layer owns noVNC and every decision. */
export function BrowserFrame({
  control,
  agent,
  waiting,
  says,
  busy,
  clipOpen,
  clipboard,
  mid,
  idle,
  toast,
  children,
  onTake,
  onDone,
  onCancelWait,
  onClipToggle,
  onTakeNow,
  onTakeAfter,
  onMidCancel,
  onKeep,
  onClipClose,
}: {
  control: "person" | "agent";
  agent: FrameAgent;
  waiting: boolean;
  /** The agent's request, in its own words. */
  says?: string;
  busy?: boolean;
  clipOpen: boolean;
  clipboard: ReactNode;
  /** The mid-step question, where the click landed (fractions). */
  mid?: { x: number; y: number };
  /** Seconds before the browser goes back to the agent by itself. */
  idle?: number;
  toast?: string;
  children: ReactNode;
  onTake: () => void;
  onDone: () => void;
  onCancelWait: () => void;
  onClipToggle: () => void;
  onTakeNow: () => void;
  onTakeAfter: () => void;
  onMidCancel: () => void;
  onKeep: () => void;
  onClipClose: () => void;
}) {
  const txt = useText(serverBrowserText);
  // Escape closes the question or the popover before it closes the sheet.
  const dismiss = mid ? onMidCancel : clipOpen ? onClipClose : undefined;
  useEffect(() => {
    if (!dismiss) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      dismiss();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [dismiss]);
  const mine = control === "person";
  const turn = mine
    ? txt.frame.you
    : agent === "busy"
      ? txt.frame.agentBusy
      : agent === "waits"
        ? txt.frame.agentWaits
        : txt.frame.agent;
  return (
    <div
      className="sb-frame"
      data-testid="browser-frame"
      data-control={control}
      data-agent={agent}
      data-waiting={waiting || undefined}
    >
      <div className="sb-tab sb-tab-turn" data-testid="browser-turn">
        <Icon name={mine ? "user" : "agent"} />
        <strong>{waiting ? txt.frame.waiting : turn}</strong>
        {mine ? (
          <ControlButton
            size="inline"
            variant="primary"
            data-testid="browser-give-back"
            isDisabled={busy}
            onPress={onDone}
          >
            <Icon name="check" />
            {txt.frame.done}
          </ControlButton>
        ) : waiting ? (
          <ControlButton
            size="inline"
            data-testid="browser-cancel-wait"
            onPress={onCancelWait}
          >
            {txt.frame.cancel}
          </ControlButton>
        ) : (
          <ControlButton
            size="inline"
            data-testid="browser-take-control"
            isDisabled={busy}
            onPress={onTake}
          >
            {txt.takeControl}
          </ControlButton>
        )}
      </div>
      <div className="sb-tab sb-tab-clip">
        <ControlButton
          size="inline"
          variant="quiet"
          data-testid="browser-clip-toggle"
          aria-expanded={clipOpen}
          aria-controls="sb-clip-pop"
          onPress={onClipToggle}
        >
          <Icon name="copy" />
          {txt.clip.tab}
          <Icon name="down" />
        </ControlButton>
      </div>
      {clipOpen ? (
        <section
          className="sb-clip-pop"
          id="sb-clip-pop"
          data-testid="browser-clipboard"
          aria-label={txt.clip.tab}
        >
          {clipboard}
        </section>
      ) : null}
      {says ? (
        <p className="sb-says" data-testid="browser-says">
          <b>{txt.frame.says}:</b> <span>{says}</span>
        </p>
      ) : null}
      <div className="sb-frame-screen">
        {children}
        {!mine && !waiting && !mid ? (
          <div className="sb-canvas-hint" aria-hidden="true">
            <Icon name={agent === "busy" ? "agent" : "user"} />
            <span>
              {agent === "busy" ? txt.frame.hintBusy : txt.frame.hintAgent}
            </span>
          </div>
        ) : null}
        {mid ? (
          <div
            className="sb-mid"
            role="alertdialog"
            aria-labelledby="sb-mid-title"
            aria-describedby="sb-mid-text"
            data-testid="browser-mid-step"
            // Near the click, kept inside the picture.
            style={
              {
                "--sb-mid-x": `${Math.min(Math.max(mid.x, 0), 0.6) * 100}%`,
                "--sb-mid-y": `${Math.min(Math.max(mid.y, 0), 0.55) * 100}%`,
              } as CSSProperties
            }
          >
            <strong id="sb-mid-title">
              <Icon name="warning" />
              {txt.frame.midTitle}
            </strong>
            <p id="sb-mid-text">{txt.frame.midText}</p>
            <div className="sb-actions">
              <ControlButton
                size="row"
                variant="primary"
                data-testid="browser-take-now"
                autoFocus
                onPress={onTakeNow}
              >
                {txt.frame.takeNow}
              </ControlButton>
              <ControlButton
                size="row"
                data-testid="browser-take-after"
                onPress={onTakeAfter}
              >
                {txt.frame.takeAfter}
              </ControlButton>
              <ControlButton
                size="row"
                variant="quiet"
                data-testid="browser-mid-cancel"
                onPress={onMidCancel}
              >
                {txt.frame.cancel}
              </ControlButton>
            </div>
          </div>
        ) : null}
      </div>
      <div className="sb-frame-foot">
        {idle !== undefined && mine ? (
          <div className="sb-idle" data-testid="browser-idle">
            <span>{txt.frame.idle(idle)}</span>
            <ControlButton
              size="row"
              data-testid="browser-keep"
              onPress={onKeep}
            >
              {txt.frame.keep}
            </ControlButton>
          </div>
        ) : null}
        <p
          className="sb-toast"
          role="status"
          aria-live="polite"
          data-testid="browser-toast"
        >
          {toast ?? ""}
        </p>
      </div>
    </div>
  );
}

/** The clipboard popover's content: a paste field for when the shortcut
 * does not reach the page (and for phones, whose keyboard the picture
 * cannot raise), typing as keystrokes, and a remote copy waiting for the
 * person's own press. */
export function BrowserClipboard({
  password,
  onPassword,
  onTypePassword,
  text,
  hidden,
  touch,
  enterWarn,
  remote,
  remoteShown,
  canCopy,
  onText,
  onHidden,
  onPaste,
  onType,
  onCopySelection,
  onCopyLocal,
}: {
  password: string;
  onPassword: (password: string) => void;
  onTypePassword: () => void;
  text: string;
  hidden: boolean;
  touch: boolean;
  /** Line breaks waiting for a second press before they go as Enter. */
  enterWarn?: number;
  /** Text copied on the remote page that did not reach the person's
   * clipboard by itself. */
  remote?: string;
  remoteShown: boolean;
  canCopy: boolean;
  onText: (text: string) => void;
  onHidden: (hidden: boolean) => void;
  onPaste: () => void;
  onType: () => void;
  onCopySelection: () => void;
  onCopyLocal: () => void;
}) {
  const txt = useText(serverBrowserText);
  return (
    <>
      <div className="sb-paste">
        <label htmlFor="sb-password">{txt.clip.password}</label>
        <input
          id="sb-password"
          type="password"
          data-testid="browser-password"
          autoComplete="off"
          spellCheck={false}
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          aria-describedby="sb-password-note"
        />
        <div className="sb-paste-actions">
          <ControlButton
            size="row"
            variant="primary"
            data-testid="browser-password-send"
            isDisabled={!canCopy || !password}
            onPress={onTypePassword}
          >
            <Icon name="key" />
            {txt.clip.type}
          </ControlButton>
        </div>
        <small id="sb-password-note">{txt.clip.passwordNote}</small>
      </div>
      <div className="sb-paste">
        <label htmlFor="sb-paste-text">{txt.clip.label}</label>
        <textarea
          id="sb-paste-text"
          data-testid="browser-paste-text"
          rows={2}
          className={hidden ? "sb-masked" : undefined}
          placeholder={txt.clip.placeholder}
          autoComplete="off"
          spellCheck={false}
          value={text}
          onChange={(e) => onText(e.target.value)}
        />
        <small>{touch ? txt.clip.hintTouch : txt.clip.hintKeys}</small>
        <div className="sb-paste-actions">
          <ControlButton
            size="row"
            data-testid="browser-paste-send"
            isDisabled={!canCopy}
            onPress={onPaste}
          >
            {txt.clip.paste}
          </ControlButton>
          <ControlButton
            size="row"
            data-testid="browser-type-send"
            isDisabled={!canCopy}
            onPress={onType}
          >
            <Icon name="key" />
            {txt.clip.type}
          </ControlButton>
          <label className="sb-check">
            <input
              type="checkbox"
              data-testid="browser-paste-hide"
              checked={hidden}
              onChange={(e) => onHidden(e.target.checked)}
            />{" "}
            {txt.clip.hide}
          </label>
        </div>
        {enterWarn ? (
          <p className="sb-enter-warn" role="alert">
            <Icon name="warning" />
            {txt.clip.enterWarn(enterWarn)}
          </p>
        ) : null}
        <small>{txt.clip.keysNote}</small>
      </div>
      {remote !== undefined ? (
        <div className="sb-remote-clip" data-testid="browser-remote-clip">
          <span>{txt.clip.copied}</span>
          {remoteShown ? (
            <input
              readOnly
              value={remote}
              aria-label={txt.clip.copiedText}
              data-testid="browser-remote-text"
              onFocus={(e) => e.currentTarget.select()}
            />
          ) : null}
          <ControlButton
            size="row"
            data-testid="browser-copy-local"
            onPress={onCopyLocal}
          >
            <Icon name="copy" />
            {txt.clip.copyLocal}
          </ControlButton>
        </div>
      ) : null}
      <div className="sb-paste-actions">
        <ControlButton
          size="row"
          data-testid="browser-copy-selection"
          isDisabled={!canCopy}
          onPress={onCopySelection}
        >
          <Icon name="copy" />
          {txt.clip.copySelection}
        </ControlButton>
      </div>
      <small className="sb-clip-note">{txt.clip.note}</small>
    </>
  );
}
