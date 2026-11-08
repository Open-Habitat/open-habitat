import type { ReactNode } from "react";
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

/** The sheet: the live view of the whole browser. Looking (view) sends
 * nothing to the browser; only the named button takes control. */
export function BrowserSheet({
  mode,
  running,
  busy,
  error,
  children,
  onClose,
  onTakeControl,
  onGiveBack,
  onStop,
}: {
  mode: "view" | "control";
  running: boolean;
  busy?: string;
  error?: string;
  children: ReactNode;
  onClose: () => void;
  onTakeControl: () => void;
  onGiveBack: () => void;
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
          {running ? (
            <div className="sb-band" data-mode={mode}>
              <Icon name={mode === "control" ? "user" : "eye"} />
              <p data-testid="browser-band">
                {mode === "control" ? txt.sheet.control : txt.sheet.viewing}
              </p>
              {mode === "control" ? (
                <ControlButton
                  size="row"
                  variant="primary"
                  data-testid="browser-give-back"
                  isDisabled={!!busy}
                  onPress={onGiveBack}
                >
                  {txt.giveBack}
                </ControlButton>
              ) : (
                <ControlButton
                  size="row"
                  data-testid="browser-take-control"
                  isDisabled={!!busy}
                  onPress={onTakeControl}
                >
                  {txt.takeControl}
                </ControlButton>
              )}
            </div>
          ) : null}
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
