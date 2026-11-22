# components/ServerBrowser.tsx

Generated from web/src/components/ServerBrowser.tsx; do not edit.

```tsx
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useState,
} from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { createPortal } from "react-dom";
import type { BrowserRowState } from "../app/browserConversations";
import type { BrowserSummary } from "../app/serverBrowser";
import type { BrowserVisits } from "../app/turnBrowserVisits";
import { formatDate, useText } from "../i18n";
import { serverBrowserText } from "../text/serverBrowser";
import { ControlButton } from "./ControlElements";
import controls from "./Controls.module.css";
import { Icon } from "./Icon";
import "./Multiplayer.css";
import "./ServerBrowser.css";
import "./TurnChanges.css";

type Text = typeof serverBrowserText.fi;

// The person's server browser in three places (server-browser-entry-points
// round 3, direction 2 Kortti, Jari 22.11.2026): the rail's Oma selain row,
// the browser mark on the row of the conversation the browser works for, and
// one Selain card under the turn that used it, which changes state in place
// and becomes the visit record. Another conversation shows nothing of the
// browser. Every icon here is the `browser` window of Icon.tsx.

const clock = (at: number) =>
  formatDate(at, { hour: "numeric", minute: "2-digit" });

/** The rail's Oma selain: a plain row like Tuotokset, with the browser's
 * short state at its end. It opens the live view rather than a page, so it
 * is a button with the home row's look. */
export function BrowserRailRow({
  summary,
  windows,
  busy,
  conversation,
  onOpen,
}: {
  summary: BrowserSummary;
  windows: number;
  busy?: string;
  /** The conversation the open request belongs to, when one is known. */
  conversation?: string;
  onOpen: () => void;
}) {
  const txt = useText(serverBrowserText);
  if (summary.kind === "off") return null;
  const count = txt.windows(windows);
  let shown: ReactNode;
  let said: string;
  switch (summary.kind) {
    case "stopped":
      shown = busy === "start" ? txt.rail.starting : txt.rail.stopped;
      said = busy === "start" ? txt.rail.said.starting : txt.rail.said.stopped;
      break;
    case "agent":
      shown = (
        <>
          <Icon name="agent" />
          {`${txt.rail.agent} · ${count}`}
        </>
      );
      said = txt.rail.said.agent(count);
      break;
    case "ask":
      shown = txt.rail.ask;
      said = conversation
        ? txt.rail.said.ask(conversation)
        : txt.rail.said.askUnknown;
      break;
    case "person":
      shown = (
        <>
          <Icon name="user" />
          {txt.rail.control}
        </>
      );
      said = txt.rail.said.control;
      break;
    default:
      shown = count;
      said = txt.rail.said.idle(count);
  }
  return (
    <div className="ah-rail-home-row">
      <button
        type="button"
        className={`${controls.link} ${controls.home} ah-rail-home sb-rail-item`}
        data-testid="browser-rail-row"
        data-state={summary.kind}
        aria-label={said}
        onClick={onOpen}
      >
        <Icon name="browser" />
        <span className="ah-rail-home-label">{txt.ownBrowser}</span>
        <span
          className="sb-rail-state"
          data-testid="browser-rail-state"
          aria-hidden="true"
        >
          {shown}
        </span>
      </button>
    </div>
  );
}

/** Each conversation's browser state for its row in the rail, by agent id. */
export const BrowserRowMarks = createContext<
  ReadonlyMap<string, BrowserRowState>
>(new Map());

/** The words a conversation row adds to its description. */
export function browserRowSaid(txt: Text, state: BrowserRowState) {
  return txt.row.said[state];
}

/** The mark at the end of a conversation's row, in the place of its time: a
 * quiet window while its agent works in the browser; bordered with the word
 * when the conversation waits for the person there. The row's description
 * says it in words. */
export function BrowserRowMark({ state }: { state: BrowserRowState }) {
  const txt = useText(serverBrowserText);
  return (
    <span
      className="sb-rowmark"
      data-testid="row-browser"
      data-state={state}
      aria-hidden="true"
    >
      <Icon name={state === "control" ? "user" : "browser"} />
      {state === "ask"
        ? txt.row.ask
        : state === "control"
          ? txt.row.control
          : null}
    </span>
  );
}

const host = (origin: string) => {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
};

function Sites({ sites }: { sites: string[] }) {
  return (
    <span className="sb-card-sites">
      {sites.map((o) => (
        <code key={o}>{host(o)}</code>
      ))}
    </span>
  );
}

function counts(txt: Text, v: BrowserVisits, live: boolean) {
  const s = v.summary;
  const parts = [txt.card.pages(s.pageCount)];
  if (s.downloadCount) parts.push(txt.card.downloads(s.downloadCount));
  if (!live && s.actionCount) parts.push(txt.card.actions(s.actionCount));
  const line = parts.join(" · ");
  return live ? txt.card.soFar(line) : line;
}

/** The opened card: the accepted visit-record list (pages by site, downloads,
 * actions) and the span the person controlled the browser. Owner only. */
function VisitDetail({
  visits,
  live,
  agentWindow,
  tabsClosed,
  you,
}: {
  visits: BrowserVisits;
  live: boolean;
  agentWindow?: string;
  tabsClosed?: boolean;
  you?: { from: number; to?: number };
}) {
  const txt = useText(serverBrowserText);
  const d = visits.detail;
  if (!d) return null;
  const bySite = new Map<string, typeof d.pages>();
  for (const p of d.pages)
    bySite.set(p.origin, [...(bySite.get(p.origin) ?? []), p]);
  const folders = [...new Set(d.downloads.map((x) => x.targetFolder))];
  return (
    <div className="sb-card-detail" data-testid="browser-card-detail">
      {live && agentWindow ? (
        <p className="sb-card-tab">
          <Icon name="agent" />
          {txt.card.inWindow(agentWindow)}
        </p>
      ) : !live && tabsClosed ? (
        <p className="sb-card-tab">
          <Icon name="check" />
          {txt.card.tabsClosed}
        </p>
      ) : null}
      {d.pages.length ? (
        <section>
          <h4 className="sb-card-h">
            <Icon name="browser" />
            {txt.card.sectionPages}{" "}
            <span className="sb-card-n">{d.pages.length}</span>
          </h4>
          {[...bySite.entries()].map(([origin, pages]) => (
            <div key={origin} className="sb-card-site">
              <p className="sb-card-site-head">
                <code>{host(origin)}</code>{" "}
                <span className="sb-card-n">
                  {txt.card.pages(pages.length)}
                </span>
              </p>
              <ol className="sb-card-rows">
                {pages.map((p, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a revisit repeats the call's page
                  <li key={`${p.callId}-${i}`}>
                    <time>{p.at !== undefined ? clock(p.at) : ""}</time>
                    <span className="sb-card-title">{p.title || p.path}</span>
                    <code className="sb-card-path">{p.path}</code>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      ) : null}
      {d.downloads.length ? (
        <section>
          <h4 className="sb-card-h">
            <Icon name="download" />
            {txt.card.sectionDownloads}{" "}
            <span className="sb-card-n">{d.downloads.length}</span>
          </h4>
          {folders.map((folder) => (
            <div key={folder} className="sb-card-site">
              <p className="sb-card-saved">{txt.card.savedTo(folder)}</p>
              <ul className="sb-card-files">
                {d.downloads
                  .filter((x) => x.targetFolder === folder)
                  .map((x, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a name may repeat across calls
                    <li key={`${x.callId}-${i}`}>
                      <Icon name="file" />
                      <code>{x.fileName}</code>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
      {d.actions.length ? (
        <section>
          <h4 className="sb-card-h">
            <Icon name="pencil" />
            {txt.card.sectionActions}{" "}
            <span className="sb-card-n">{d.actions.length}</span>
          </h4>
          <ol className="sb-card-rows">
            {d.actions.map((a, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: one call is one action
              <li key={`${a.callId}-${i}`}>
                <time>{a.at !== undefined ? clock(a.at) : ""}</time>
                <span className="sb-card-title">{txt.card.action[a.kind]}</span>
                <code className="sb-card-path">
                  {a.selector ??
                    (a.page ? host(a.page.origin) + a.page.path : "")}
                </code>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {you ? (
        <section>
          <h4 className="sb-card-h">
            <Icon name="user" />
            {txt.card.sectionYou}
          </h4>
          <p className="sb-card-saved" data-testid="browser-card-you">
            {you.to !== undefined
              ? txt.card.youSpan(clock(you.from), clock(you.to))
              : txt.card.youNow(clock(you.from))}
          </p>
        </section>
      ) : null}
      <p className="sb-card-coverage">{txt.card.coverage}</p>
    </div>
  );
}

export type BrowserCardState = "working" | "ask" | "control" | "done";

/** The Selain card under the turn that used the browser, the size of
 * Muutokset. Live, it is *Selain nyt* while the agent works, highlighted
 * with the agent's request and Ota ohjaus ja hoida when it asks, and carries
 * Anna takaisin while the person controls; finished, it is the visit record.
 * It opens to the visit so far. A participant sees the summary only: the
 * browser and its sign-ins are the owner's. */
export function BrowserTurnCard({
  state,
  visits,
  request,
  agentWindow,
  tabsClosed,
  you,
  busy,
  onLook,
  onTake,
  onGiveBack,
}: {
  state: BrowserCardState;
  visits: BrowserVisits;
  /** The agent's request, in its own words. */
  request?: string;
  /** The title of the window the agent works in. */
  agentWindow?: string;
  tabsClosed?: boolean;
  you?: { from: number; to?: number };
  busy?: boolean;
  onLook?: () => void;
  onTake?: () => void;
  onGiveBack?: () => void;
}) {
  const txt = useText(serverBrowserText);
  const [open, setOpen] = useState(false);
  const body = useId();
  const s = visits.summary;
  const live = state !== "done";
  const owner = !!visits.detail;
  const title =
    state === "working"
      ? txt.card.live
      : state === "ask"
        ? txt.card.ask
        : state === "control"
          ? txt.card.control
          : txt.card.record;
  const meta = (
    <span className="ah-tc-meta sb-card-meta" data-testid="browser-card-meta">
      {state === "ask" && request ? (
        // The agent's own words, as text.
        <span className="sb-card-says" data-testid="browser-card-request">
          {request}
        </span>
      ) : state === "control" ? (
        <span className="sb-card-says">{txt.card.controlMeta}</span>
      ) : (
        <>
          {s.sites.length ? <Sites sites={s.sites} /> : null}
          <span>{counts(txt, visits, live)}</span>
          {s.startedAt !== undefined ? (
            <span className="sb-card-when">
              {clock(s.startedAt)}–
              {!live && s.endedAt !== undefined ? clock(s.endedAt) : ""}
            </span>
          ) : null}
        </>
      )}
    </span>
  );
  const head = (
    <>
      <Icon name={state === "control" ? "user" : "browser"} />
      <span className="ah-tc-line">
        <span className="ah-tc-title">{title}</span>
        {meta}
      </span>
    </>
  );
  return (
    <section
      className="ah-turn-changes sb-card"
      data-testid="browser-card"
      data-state={state}
      data-open={open || undefined}
      aria-label={title}
    >
      <div className="ah-tc-head sb-card-head">
        {owner ? (
          <button
            type="button"
            className="ah-tc-toggle"
            data-testid="browser-card-toggle"
            aria-expanded={open}
            aria-controls={open ? body : undefined}
            aria-label={`${txt.card.show}: ${title}`}
            onClick={() => setOpen(!open)}
          >
            <span aria-hidden="true" className="ah-disclosure-chevron" />
            {head}
          </button>
        ) : (
          <div className="ah-tc-toggle sb-card-plain">{head}</div>
        )}
        {owner && live ? (
          <span className="sb-card-actions">
            {state === "working" ? (
              <ControlButton
                size="inline"
                data-testid="browser-card-look"
                onPress={onLook}
              >
                <Icon name="eye" />
                {txt.card.look}
              </ControlButton>
            ) : state === "ask" ? (
              <>
                <ControlButton
                  size="inline"
                  variant="primary"
                  data-testid="browser-card-take"
                  isDisabled={busy}
                  onPress={onTake}
                >
                  <Icon name="user" />
                  {txt.card.take}
                </ControlButton>
                <ControlButton
                  size="inline"
                  data-testid="browser-card-look"
                  onPress={onLook}
                >
                  <Icon name="eye" />
                  {txt.card.lookFirst}
                </ControlButton>
              </>
            ) : (
              <>
                <ControlButton
                  size="inline"
                  data-testid="browser-card-open"
                  onPress={onLook}
                >
                  {txt.card.open}
                </ControlButton>
                <ControlButton
                  size="inline"
                  variant="primary"
                  data-testid="browser-card-give-back"
                  isDisabled={busy}
                  onPress={onGiveBack}
                >
                  <Icon name="agent" />
                  {txt.card.giveBack}
                </ControlButton>
              </>
            )}
          </span>
        ) : null}
      </div>
      {open && owner ? (
        <div id={body} className="ah-tc-body sb-card-body">
          <VisitDetail
            visits={visits}
            live={live}
            agentWindow={agentWindow}
            tabsClosed={tabsClosed}
            you={you}
          />
        </div>
      ) : null}
    </section>
  );
}

/** Habitat's line in the conversation when the person gives the browser
 * back after the agent's request. */
export function BrowserGaveBackLine({ at }: { at: number }) {
  const txt = useText(serverBrowserText);
  return (
    <p
      className="ah-mp-line sb-gave-back"
      role="note"
      data-testid="browser-gave-back"
    >
      <span className="ah-mp-line-mark" aria-hidden="true" />
      {txt.card.gaveBack(clock(at))}
    </p>
  );
}

// The viewer owns its controls; the sheet supplies their place in the one header.
const BrowserBarTarget = createContext<HTMLElement | null>(null);

/** The sheet: the live view of the whole browser. */
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
  const [barTarget, setBarTarget] = useState<HTMLDivElement | null>(null);
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
          <div className="sb-sheet-head" data-testid="browser-top-bar">
            <Heading slot="title">{txt.ownBrowser}</Heading>
            <div className="sb-bar-slot" ref={setBarTarget} />
            {running ? (
              <ControlButton
                size="row"
                variant="quiet"
                data-testid="browser-stop"
                aria-label={txt.stop}
                title={txt.stop}
                isDisabled={!!busy}
                onPress={onStop}
              >
                <Icon name="stop" />
                <span className="sb-bar-label">{txt.stop}</span>
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
          <BrowserBarTarget.Provider value={barTarget}>
            <div className="sb-sheet-screen">{children}</div>
          </BrowserBarTarget.Provider>
          <p className="sb-truth">{txt.truth}</p>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Who the agent is for the turn controls, as the app layer reads the host. */
export type FrameAgent = "idle" | "busy" | "waits";

/** The frame around the live picture (Kehys): its border is the turn
 * (solid accent: the person, dashed: the agent). Turn and clipboard controls
 * appear in the sheet's top bar. The picture
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
  const barTarget = useContext(BrowserBarTarget);
  const mine = control === "person";
  const turn = mine
    ? txt.frame.you
    : agent === "busy"
      ? txt.frame.agentBusy
      : agent === "waits"
        ? txt.frame.agentWaits
        : txt.frame.agent;
  const controls = (
    <div className="sb-bar-controls">
      <div className="sb-bar-turn" data-testid="browser-turn">
        <Icon name={mine ? "user" : "agent"} />
        <strong title={waiting ? txt.frame.waiting : turn}>
          {waiting ? txt.frame.waiting : turn}
        </strong>
        {mine ? (
          <ControlButton
            size="inline"
            variant="primary"
            data-testid="browser-give-back"
            aria-label={txt.frame.done}
            title={txt.frame.done}
            isDisabled={busy}
            onPress={onDone}
          >
            <Icon name="check" />
            <span className="sb-bar-label">{txt.frame.done}</span>
          </ControlButton>
        ) : waiting ? (
          <ControlButton
            size="inline"
            data-testid="browser-cancel-wait"
            aria-label={txt.frame.cancel}
            title={txt.frame.cancel}
            onPress={onCancelWait}
          >
            <Icon name="cross" />
            <span className="sb-bar-label">{txt.frame.cancel}</span>
          </ControlButton>
        ) : (
          <ControlButton
            size="inline"
            data-testid="browser-take-control"
            aria-label={txt.takeControl}
            title={txt.takeControl}
            isDisabled={busy}
            onPress={onTake}
          >
            <Icon name="user" />
            <span className="sb-bar-label">{txt.takeControl}</span>
          </ControlButton>
        )}
      </div>
      {says ? (
        <section
          className="sb-says"
          data-testid="browser-says"
          aria-label={txt.frame.says}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the bounded request region must be keyboard-scrollable
          tabIndex={0}
        >
          <b>{txt.frame.says}:</b> <span>{says}</span>
        </section>
      ) : null}
      <div className="sb-bar-clip">
        <ControlButton
          size="inline"
          variant="quiet"
          data-testid="browser-clip-toggle"
          aria-label={txt.clip.tab}
          title={txt.clip.tab}
          aria-expanded={clipOpen}
          aria-controls="sb-clip-pop"
          onPress={onClipToggle}
        >
          <Icon name="copy" />
          <span className="sb-bar-label">{txt.clip.tab}</span>
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
    </div>
  );
  return (
    <div
      className="sb-frame"
      data-testid="browser-frame"
      data-control={control}
      data-agent={agent}
      data-waiting={waiting || undefined}
    >
      {barTarget ? createPortal(controls, barTarget) : controls}
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

```
