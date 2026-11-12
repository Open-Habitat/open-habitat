# components/Navigation.tsx

Generated from web/src/components/Navigation.tsx; do not edit.

```tsx
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Input, Label, TextField } from "react-aria-components";
import { useLocation, useNavigate } from "react-router";
import { textNow, useText } from "../i18n";
import { navigationText } from "../text/navigation";
import { statusText } from "../text/status";
import {
  ArchiveControls,
  type ArchiveControlsProps,
  archiveAction,
} from "./ArchiveControls";
import type { AgentPresentation } from "./agentPresentation";
import { ControlButton, ExternalLink, LinkRow } from "./ControlElements";
import { ExplainToggle, useExplainEntry } from "./ExplainMode";
import { HeaderActivity, useHeaderShortening } from "./HeaderShortening";
import { Icon } from "./Icon";
import { NameEditor } from "./NameEditor";
import { NoticeAreaProvider, NoticeSlot } from "./NoticeArea";
import { Menu } from "./Overlays";
import {
  activateHeaderControl,
  PhoneHeaderFacts,
  usePhoneHeaderReadout,
} from "./PhoneHeaderFacts";
import { Button, ListRow, RefreshIconButton } from "./Primitives";
import { TooltipSide } from "./QuickTooltip";
import { relativeRecapAge, useMinuteNow } from "./RecapCard";
import type { StatusKind } from "./Status";
import { Badge, StatusMark } from "./Status";
import { StatusBell } from "./StatusBell";
import type { AsyncState, Availability, Tone } from "./types";
import { WorkerBranchMark } from "./WorkerMark";
import {
  type WorkspaceCardActions,
  WorkspaceIcon,
  WorkspaceIconButton,
  type WorkspaceIconModel,
} from "./WorkspaceIcon";

type AppShellProps = Parameters<typeof Shell>[0];

/** The authenticated frame. It holds the one notice area: the overlays'
 * notices and a page's own both reach the page's top bar through it. */
export function AppShell(props: AppShellProps) {
  return (
    <NoticeAreaProvider>
      <Shell {...props} />
    </NoticeAreaProvider>
  );
}

function Shell({
  className,
  modeBar,
  connection,
  rail,
  main,
  overlays,
  toast,
  mobileTitle,
  fallbackAccount,
  bell,
  navigationBadge = 0,
}: {
  className?: string;
  /** A mode's bar above everything else (the explain mode). */
  modeBar?: ReactNode;
  /** The status bell on a page without a top bar: the phone's toolbar, and
   * beside the fallback account. */
  bell?: ReactNode;
  /** How many conversations wait for the person (Sinun vuorosi), on the
   * phone's menu button while the rail is out of sight. */
  navigationBadge?: number;
  connection?: ReactNode;
  mobileTitle?: string;
  fallbackAccount?: ReactNode;
  rail?: ReactNode;
  main: ReactNode;
  overlays?: ReactNode;
  toast?: ReactNode;
}) {
  const shell = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    const element = shell.current;
    if (!viewport || !element) return;
    // The tallest visible height at this width is the screen without the
    // keyboard; browser chrome moves it far less than a keyboard does.
    let width = 0;
    let tallest = 0;
    const update = () => {
      // Pinch zoom must keep its native pan/zoom behavior. The keyboard and
      // browser chrome resize/pan the visual viewport without changing scale.
      if (viewport.scale !== 1) return;
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        tallest = 0;
      }
      tallest = Math.max(tallest, viewport.height);
      element.style.setProperty("--ah-visible-height", `${viewport.height}px`);
      element.style.setProperty("--ah-visible-top", `${viewport.offsetTop}px`);
      element.toggleAttribute("data-keyboard", tallest - viewport.height > 150);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openedAtKey, setOpenedAtKey] = useState("");
  const [mobileLayout, setMobileLayout] = useState(
    () => window.matchMedia?.("(max-width: 800px)").matches ?? false,
  );
  const location = useLocation();
  const drawerActive =
    mobileOpen && mobileLayout && openedAtKey === location.key;
  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 800px)");
    if (!query) return;
    const change = () => {
      setMobileLayout(query.matches);
      if (!query.matches) setMobileOpen(false);
    };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (location.key) setMobileOpen(false);
  }, [location.key]);
  useEffect(() => {
    if (!drawerActive) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        requestAnimationFrame(() => mobileTrigger.current?.focus());
      }
      if (event.key === "Tab") {
        const items = Array.from(
          mobileNav.current?.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled]), input:not([disabled])",
          ) ?? [],
        ).filter((item) => item.getClientRects().length > 0);
        const first = items[0];
        const last = items.at(-1);
        if (!first || !last) return;
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === mobileNav.current?.querySelector("nav"))
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [drawerActive]);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const mobileNav = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (drawerActive)
      mobileNav.current?.querySelector<HTMLElement>("nav")?.focus();
  }, [drawerActive]);
  const t = useText(navigationText);
  const closeMobile = () => {
    setMobileOpen(false);
    requestAnimationFrame(() => mobileTrigger.current?.focus());
  };
  return (
    <div
      ref={shell}
      className={`ah-app-shell${className ? ` ${className}` : ""}`}
    >
      <ExternalLink
        data-testid="skip-content"
        className="ah-skip"
        href="#main"
        onClick={() => document.getElementById("main")?.focus()}
      >
        {t.skip}
      </ExternalLink>
      {modeBar}
      {connection}
      <div
        className={`ah-shell-body${rail ? "" : " ah-shell-no-rail"}${drawerActive ? " ah-mobile-open" : ""}`}
      >
        {drawerActive ? (
          <ControlButton
            size="row"
            variant="quiet"
            className="ah-mobile-scrim"
            aria-label={t.closeMenu}
            onPress={closeMobile}
          />
        ) : null}
        {rail ? (
          <div className="ah-rail-slot" ref={mobileNav}>
            {rail}
            {drawerActive ? (
              <ControlButton
                data-testid="close-navigation"
                size="row"
                variant="quiet"
                className="ah-mobile-close"
                aria-label={t.closeNavigation}
                onPress={closeMobile}
              >
                <Icon name="back" />
              </ControlButton>
            ) : null}
          </div>
        ) : null}
        {fallbackAccount && !rail ? (
          <aside className="ah-fallback-account" aria-label={t.account}>
            {bell}
            {fallbackAccount}
          </aside>
        ) : null}
        <main id="main" tabIndex={-1} inert={drawerActive}>
          {rail || fallbackAccount ? (
            <div className="ah-mobile-toolbar">
              {rail ? (
                <ControlButton
                  data-testid="navigation-open"
                  size="row"
                  variant="quiet"
                  ref={mobileTrigger}
                  aria-label={
                    navigationBadge
                      ? t.openNavigationWaiting(navigationBadge)
                      : t.openNavigation
                  }
                  aria-expanded={drawerActive}
                  className="ah-navigation-open"
                  onPress={() => {
                    setOpenedAtKey(location.key);
                    setMobileOpen(true);
                  }}
                >
                  <Icon name="menu" />
                  {navigationBadge ? (
                    <span
                      data-testid="navigation-badge"
                      className="ah-navigation-badge"
                      aria-hidden="true"
                    >
                      {navigationBadge}
                    </span>
                  ) : null}
                </ControlButton>
              ) : null}
              <span className="ah-mobile-title" title={mobileTitle}>
                {mobileTitle ?? t.home}
              </span>
              {bell}
              {rail &&
              location.pathname !== "/workspaces" &&
              (!/^\/workspaces\/ws_/.test(location.pathname) ||
                new URLSearchParams(location.search).has("conversation")) ? (
                <LinkRow
                  data-testid="home-link"
                  href="/workspaces"
                  aria-label={t.home}
                >
                  <Icon name="home" />
                </LinkRow>
              ) : null}
            </div>
          ) : null}
          <NoticeSlot className="ah-notice-area-page" />
          {main}
        </main>
      </div>
      <div id="overlays">{overlays}</div>
      {toast}
    </div>
  );
}
/** Whether a status word, produced in either language, is one of these. */
const inLanguages = (
  text: string,
  words: (t: (typeof statusText)["fi"]) => string[],
) => [statusText.fi, statusText.en].some((t) => words(t).includes(text));
const uncertainStatus = (text: string) =>
  inLanguages(text, (t) => [t.control.unknown]) ||
  [navigationText.fi.stale, navigationText.en.stale].includes(text);
const readOnlyStatus = (text: string) =>
  inLanguages(text, (t) => [t.control.readOnly, t.readOnly]) ||
  text.toLowerCase() === statusText.fi.readOnly.toLowerCase() ||
  text.toLowerCase() === statusText.en.readOnly.toLowerCase();

export function NavLink({
  label,
  href,
  current = false,
  badgeText,
  statusText,
  displayStatusText,
  statusLabels,
  compactMark,
  leading,
  detail,
  oneLine = false,
  line,
  end,
}: {
  label: string;
  href: string;
  current?: "page" | false;
  badgeText?: string;
  statusText?: string;
  displayStatusText?: string;
  statusLabels?: string[];
  compactMark?: boolean;
  /** A decorative mark before the label; its meaning is in statusText. */
  leading?: ReactNode;
  /** A second line under the label: where the row lives and what it waits for. */
  detail?: string;
  /** Keep the row to one line: the detail is said, not shown. */
  oneLine?: boolean;
  /** A one-line row's short shown line under its label; decorative, as the
   * detail says the same. */
  line?: ReactNode;
  /** A short fact at the end of the line, such as the time. */
  end?: ReactNode;
}) {
  const statusId = useId();
  const detailId = useId();
  return (
    <LinkRow
      data-agent-title={label}
      current={Boolean(current)}
      kind="agent"
      aria-label={label}
      aria-describedby={
        [detail ? detailId : "", statusText ? statusId : ""]
          .filter(Boolean)
          .join(" ") || undefined
      }
      data-testid="agent-link"
      className="ah-nav-link"
      href={href}
    >
      {leading}
      {detail && oneLine ? (
        <>
          {line ? (
            <span className="ah-nav-text">
              <span className="ah-nav-label">{label}</span>
              <span className="ah-nav-detail" aria-hidden="true">
                {line}
              </span>
            </span>
          ) : (
            <span className="ah-nav-label">{label}</span>
          )}
          <span className="ah-visually-hidden" id={detailId}>
            {detail}
          </span>
        </>
      ) : detail ? (
        <span className="ah-nav-text">
          <span className="ah-nav-label">{label}</span>
          <span className="ah-nav-detail" id={detailId}>
            {detail}
          </span>
        </span>
      ) : (
        <span className="ah-nav-label">{label}</span>
      )}
      {statusText ? (
        <span id={statusId} className="ah-nav-status">
          {displayStatusText !== undefined ? (
            <>
              {displayStatusText ? (
                compactMark ? (
                  <NavMark mark={displayStatusText} />
                ) : (
                  <span aria-hidden="true">
                    <StatusMark
                      label={displayStatusText}
                      tone={
                        uncertainStatus(displayStatusText)
                          ? "warning"
                          : "neutral"
                      }
                      kind={
                        readOnlyStatus(displayStatusText)
                          ? "read-only"
                          : uncertainStatus(displayStatusText)
                            ? "unknown"
                            : "neutral"
                      }
                    />
                  </span>
                )
              ) : null}
              <span className="ah-visually-hidden">{statusText}</span>
            </>
          ) : (
            <StatusMark label={statusText} tone="neutral" />
          )}
        </span>
      ) : null}
      {statusLabels?.length ? (
        <span className="ah-nav-details">
          {statusLabels.map((text) => (
            <StatusMark
              key={text}
              label={text}
              tone={
                inLanguages(text, (t) => [
                  t.operation.disconnected,
                  t.rail.historyUnreadable,
                ])
                  ? "warning"
                  : "neutral"
              }
              kind={
                readOnlyStatus(text)
                  ? "read-only"
                  : inLanguages(text, (t) => [t.rail.historyUnreadable])
                    ? "error"
                    : "neutral"
              }
            />
          ))}
        </span>
      ) : null}
      {end}
      {badgeText ? <Badge label={badgeText} tone="warning" /> : null}
    </LinkRow>
  );
}
/** The rail's compact activity mark; its meaning is said in words beside it. */
function NavMark({ mark }: { mark: string }) {
  const title = activityLabelForMark(mark);
  // Working is the draft's pulsing accent dot, not a glyph. A background wait
  // is a still ring around a core, so it is neither the pulsing working dot
  // nor the open ring. A question asked of the person is the accent disc.
  const kind = (
    { "◌": "working", "◉": "background", "?": "question" } as Record<
      string,
      string
    >
  )[mark];
  return (
    <span
      className={`ah-nav-mark${kind ? ` ah-nav-${kind}` : ""}`}
      aria-hidden="true"
      title={title}
    >
      {kind === "working" || kind === "background" ? null : mark}
    </span>
  );
}
function activityLabelForMark(mark: string) {
  const t = textNow(navigationText).marks;
  return (
    (
      {
        "●": t.reply,
        "?": t.asks,
        "◌": t.working,
        "○": t.waiting,
        "◉": t.background,
        "✓": t.done,
        "–": t.unknown,
      } as Record<string, string>
    )[mark] ?? t.unknown
  );
}
export interface AgentNavModel {
  agentId: string;
  href: string;
  title: string;
  /** The observed activity; the mark follows it rather than the label. */
  activity?: AgentPresentation["activity"];
  activityLabel: string;
  activityShortLabel?: string;
  controlLabel: string;
  attentionLabel?: string;
  operationLabel?: string;
  historyLabel?: string;
  /** When the conversation last changed (the host's changed_at), Unix ms. */
  changedAt?: number;
  /** The work ended in a failure the person has to look at: Pi crashed, the
   * turn ended in an error, or a worker run failed. */
  failed?: boolean;
  selected?: boolean;
  /** Shown although Hiljaiset's narrowing hides it, because it is open. */
  kept?: boolean;
  priority?: number; // caller ranks native state; navigation only presents it
  finished?: boolean;
  depth?: number;
  presence?: "present" | "absent";
  stale?: boolean;
  spinoffWorking?: boolean;
  spinoffIdle?: boolean;
  spinoffWaited?: boolean;
  /** Processes the agent left running behind an ended turn (a file server,
   * a watcher): they run on, but the conversation does not wait for them. */
  backgroundService?: string;
  /** A pending command on this conversation (ADR 0023): dimmed, steady, marked. */
  pendingLabel?: string;
  /** A worktree agent (ADR 0025); merged when Git says its work is in the
   * base branch. */
  worktree?: {
    merged: boolean;
    /** What the worktree's work is, in words; absent after merging. */
    work?: { text: string; tone: "work" | "muted" };
  };
  /** The agent has asked the person something and waits for the answer. */
  question?: boolean;
  /** In Sinun vuorosi by the person's own hand: raised by them,
   * or a reply they have read and not yet
   * answered. */
  turnMark?: "raised" | "read";
  /** What the person can do with the conversation's place in Sinun vuorosi
   * now: raise it, lower a raise, or say Ei nyt to a reply. Absent while
   * the agent works or awaits an answer to a question. */
  turnAction?: "raise" | "lower" | "not_now";
  /** What the row says about itself beyond its title: workspace, state and
   * what it waits for. The one-line row says it but does not show it. */
  detail?: string;
  /** The workspace the row is grouped under in Käynnissä. */
  workspaceId?: string;
  /** The workspace's name, for the group heading and the narrow rail. */
  workspaceName?: string;
  /** The workspace's icon (workspace-icons, experimental): with it the row
   * leads with the icon's button and Käynnissä drops its group headings. */
  workspaceIcon?: WorkspaceIconModel;
}
/** Naming a conversation by hand. `onSave` resolves once the host has the
 * name and rejects when that is not known. */
export interface ConversationRename {
  availability?: Availability;
  onSave: (name: string) => Promise<void>;
}
/** The rail rows' rename: why a row cannot be renamed now ("" when it can)
 * and the save itself. */
export interface RailRename {
  reason: (agentId: string) => string;
  save: (agentId: string, name: string) => Promise<void>;
}
/** The rail rows' up and down (raise-to-your-turn): raise a
 * quiet row, lower a raised one, or say Ei nyt to one waiting on a reply. */
export interface RailTurn {
  run: (agentId: string, action: "raise" | "lower" | "not_now") => void;
}
/** The rail rows' archive button: why a row cannot be archived now ("" when
 * it can) and the archive itself. */
export interface RailArchive {
  /** An unwritten conversation closes rather than entering the archive. */
  closes?: (agentId: string) => boolean;
  reason: (agentId: string) => string;
  run: (agentId: string) => void;
}
/** The rail's state ball (research-workmux-sidebar round 3, Ryhmät tiiviinä):
 * working includes waiting on background work, your turn is a question or an
 * unread reply, done waits for a message, failed needs a look. */
export type BallKind = "work" | "you" | "done" | "fail" | "unknown";
const ballLabel = (kind: BallKind) => textNow(navigationText).balls[kind];
export function ballOf(
  agent: Pick<
    AgentNavModel,
    | "failed"
    | "attentionLabel"
    | "question"
    | "turnMark"
    | "activity"
    | "activityLabel"
    | "spinoffWorking"
    | "spinoffIdle"
  >,
): BallKind {
  if (agent.failed) return "fail";
  // A raise is the person's own act, not the agent's state: the row's mark
  // goes on saying what the agent does (Jari 7.11.2026).
  if (agent.attentionLabel || agent.question || agent.turnMark === "read")
    return "you";
  const activity =
    agent.activity ??
    (/työ|käynnissä|working/i.test(agent.activityLabel)
      ? "working"
      : /odot|waiting/i.test(agent.activityLabel)
        ? "waiting"
        : undefined);
  if (
    activity === "working" ||
    activity === "waiting_background" ||
    agent.spinoffWorking
  )
    return "work";
  if (agent.spinoffIdle) return "you";
  if (activity === "waiting" || activity === "closed") return "done";
  return "unknown";
}
/** A read reply's ball is a ring (raise-to-your-turn). */
function Ball({
  kind,
  turn,
}: {
  kind: BallKind;
  turn?: AgentNavModel["turnMark"];
}) {
  return (
    <span
      className={`ah-nav-mark ah-ball ah-ball-${kind}`}
      data-turn={turn === "read" ? turn : undefined}
      aria-hidden="true"
      title={ballLabel(kind)}
    />
  );
}
/** The row's short age of its last change: nyt, 4 min, 2 t, 3 pv. */
export function changeAge(at: number, now: number): string {
  const t = textNow(navigationText);
  const minutes = Math.max(0, Math.floor((now - at) / 60000));
  if (minutes < 1) return t.ageNow;
  if (minutes < 60) return t.ageMinutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t.ageHours(hours);
  return t.ageDays(Math.floor(hours / 24));
}
/** One line: the state ball, the title and the time since the last change.
 * Everything else about the row is in its description and tooltip. */
export function AgentNavItem({
  agentId,
  href,
  title,
  activity,
  activityLabel,
  controlLabel,
  attentionLabel,
  operationLabel,
  historyLabel,
  changedAt,
  failed,
  selected = false,
  kept = false,
  depth = 0,
  presence = "present",
  stale = false,
  spinoffWorking = false,
  spinoffIdle = false,
  spinoffWaited = false,
  backgroundService,
  pendingLabel,
  worktree,
  question = false,
  turnMark,
  turnAction,
  detail,
  workspaceId,
  workspaceName,
  workspaceIcon,
  workspaceTag = false,
  now = Date.now(),
  archive,
  rename,
  turn,
  card,
}: AgentNavModel & {
  /** Say the workspace's name quietly in the row (Hiljaiset without
   * icons, where no heading names it). */
  workspaceTag?: boolean;
  now?: number;
  archive?: RailArchive;
  rename?: RailRename;
  turn?: RailTurn;
  card?: WorkspaceCardActions;
}) {
  const t = useText(navigationText);
  const archiveReasonId = useId();
  // Up raises a quiet row; down lowers a raised one or says Ei nyt to a
  // reply. The rail is the only place for them (Jari 7.11.2026).
  const turnRow = turn ? turnAction : undefined;
  const archiveReason = archive?.reason(agentId);
  const closes = archive?.closes?.(agentId) ?? false;
  const renameReason = rename?.reason(agentId);
  const [editing, setEditing] = useState(false);
  // A saved name shows at once, until the snapshot's title changes.
  const [saved, setSaved] = useState<{ name: string; over: string }>();
  if (saved && saved.over !== title) setSaved(undefined);
  const shownTitle = saved && saved.over === title ? saved.name : title;
  const ball = ballOf({
    failed,
    attentionLabel,
    question,
    turnMark,
    activity,
    activityLabel,
    spinoffWorking,
    spinoffIdle,
  });
  const age = changedAt !== undefined ? changeAge(changedAt, now) : undefined;
  const said = [
    pendingLabel,
    detail ?? activityLabel,
    worktree ? (worktree.merged ? t.worktreeMerged : t.worktree) : null,
    worktree?.work?.text,
    spinoffWorking ? t.workerWorking : null,
    spinoffIdle ? textNow(statusText).rail.workerWaiting : null,
    controlLabel,
    detail ? null : operationLabel,
    historyLabel,
    stale ? t.stale : null,
    presence === "absent" ? t.gone : null,
    changedAt !== undefined ? relativeRecapAge(changedAt, now) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li
      data-testid={`agent-item-${agentId}`}
      data-ball={ball}
      data-kept={kept || undefined}
      title={`${shownTitle} · ${said}`}
      data-waiting={activity === "waiting_background"}
      data-has-history-warning={Boolean(historyLabel)}
      className={`ah-agent-item${spinoffWorking || spinoffIdle || spinoffWaited ? " ah-waiting-spinoff" : ""}${pendingLabel ? " ah-pending-item" : ""}`}
      style={{ "--ah-depth": depth } as React.CSSProperties}
    >
      <ListRow
        className="ah-sidebar-agent-row ah-now-row"
        indicator={
          workspaceIcon && workspaceId ? (
            <WorkspaceIconButton
              icon={workspaceIcon}
              workspaceId={workspaceId}
              actions={card}
            />
          ) : undefined
        }
        trailing={
          !editing &&
          (spinoffWorking ||
            spinoffIdle ||
            spinoffWaited ||
            archive ||
            rename ||
            turnRow) ? (
            <>
              {spinoffWorking || spinoffIdle || spinoffWaited ? (
                <span className="ah-worker-rail">
                  <WorkerBranchMark
                    kind={
                      // A worker waiting for the person outranks one at work:
                      // the conversation's own ball already says work goes on.
                      spinoffIdle
                        ? "idle"
                        : spinoffWorking
                          ? "working"
                          : "unknown"
                    }
                    waited={spinoffWaited}
                  />
                </span>
              ) : null}
              {archive || rename || turnRow ? (
                <span
                  className="ah-nav-archive"
                  // The row's own description is a native title; over its
                  // buttons it would open below them, on the next row.
                  title=""
                  data-actions={
                    [archive, rename, turnRow].filter(Boolean).length
                  }
                >
                  {turn && turnRow ? (
                    <span>
                      <ControlButton
                        title={
                          turnRow === "raise"
                            ? t.raise
                            : turnRow === "lower"
                              ? t.lower
                              : t.notNow
                        }
                        data-testid={`rail-${turnRow === "not_now" ? "not-now" : turnRow}-conversation`}
                        variant="quiet"
                        size="inline"
                        aria-label={
                          turnRow === "raise"
                            ? t.raiseNamed(shownTitle)
                            : turnRow === "lower"
                              ? t.lowerNamed(shownTitle)
                              : t.notNowNamed(shownTitle)
                        }
                        onPress={() => turn.run(agentId, turnRow)}
                      >
                        <Icon name={turnRow === "raise" ? "top" : "bottom"} />
                      </ControlButton>
                    </span>
                  ) : null}
                  {rename ? (
                    <span>
                      <ControlButton
                        title={renameReason || t.rename}
                        data-testid="rail-rename-conversation"
                        variant="quiet"
                        size="inline"
                        aria-label={t.renameNamed(shownTitle)}
                        isDisabled={!!renameReason}
                        onPress={() => setEditing(true)}
                      >
                        <Icon name="pencil" />
                      </ControlButton>
                    </span>
                  ) : null}
                  {archive ? (
                    <span>
                      <ControlButton
                        title={archiveReason || (closes ? t.close : t.archive)}
                        data-testid={
                          closes
                            ? "rail-close-conversation"
                            : "rail-archive-conversation"
                        }
                        data-archive-agent={agentId}
                        variant="quiet"
                        size="inline"
                        aria-label={
                          closes
                            ? t.closeNamed(shownTitle)
                            : t.archiveNamed(shownTitle)
                        }
                        aria-describedby={
                          archiveReason ? archiveReasonId : undefined
                        }
                        isDisabled={!!archiveReason}
                        onPress={(event) => {
                          // The row leaves the list at once; keep the keyboard in
                          // the rail on the next row rather than on the page.
                          const row = (event.target as HTMLElement).closest(
                            "li",
                          );
                          const rows = [
                            ...(row
                              ?.closest(".ah-now")
                              ?.querySelectorAll<HTMLElement>(
                                ".ah-agent-item .ah-nav-link",
                              ) ?? []),
                          ];
                          const here = rows.findIndex((r) => row?.contains(r));
                          if (row?.contains(document.activeElement))
                            (rows[here + 1] ?? rows[here - 1])?.focus();
                          archive.run(agentId);
                        }}
                      >
                        <Icon name={closes ? "cross" : "archive"} />
                      </ControlButton>
                    </span>
                  ) : null}
                  {archiveReason ? (
                    <span id={archiveReasonId} className="ah-visually-hidden">
                      {archiveReason}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </>
          ) : undefined
        }
      >
        {editing && rename ? (
          <NameEditor
            value={shownTitle}
            label={t.conversationName}
            onSave={(name) => rename.save(agentId, name)}
            onClose={(name) => {
              setEditing(false);
              if (name) setSaved({ name, over: title });
            }}
          />
        ) : (
          <NavLink
            href={href}
            label={shownTitle}
            current={selected ? "page" : false}
            detail={said}
            oneLine
            line={
              worktree?.work && !worktree.merged ? (
                <span
                  className="ah-nav-work"
                  data-testid="worktree-work"
                  data-tone={worktree.work.tone}
                >
                  {worktree.work.text}
                </span>
              ) : undefined
            }
            leading={
              <>
                <Ball kind={ball} turn={turnMark} />
                {worktree ? (
                  <Icon
                    name={worktree.merged ? "merge" : "worktree"}
                    className={`ah-nav-worktree${worktree.merged ? " merged" : ""}`}
                    aria-hidden="true"
                  />
                ) : null}
              </>
            }
            end={
              (workspaceTag && workspaceName) ||
              backgroundService ||
              (age !== undefined && changedAt !== undefined) ? (
                <>
                  {backgroundService ? (
                    <span
                      className="ah-nav-service"
                      data-testid="rail-background-service"
                      aria-hidden="true"
                      title={textNow(statusText).rail.backgroundService(
                        backgroundService,
                      )}
                    />
                  ) : null}
                  {workspaceTag && workspaceName ? (
                    <span
                      className="ah-nav-workspace"
                      data-testid="rail-row-workspace"
                      aria-hidden="true"
                    >
                      {workspaceName}
                    </span>
                  ) : null}
                  {age !== undefined && changedAt !== undefined ? (
                    <time
                      className="ah-nav-time"
                      dateTime={new Date(changedAt).toISOString()}
                    >
                      {age}
                    </time>
                  ) : null}
                </>
              ) : undefined
            }
          />
        )}
      </ListRow>
    </li>
  );
}
/** The strongest state among a workspace's agents, as one hint on its row. */
export interface WorkspaceHint {
  kind: "attention" | "working" | "background" | "waiting";
  count: number;
  /** The hint in words, for assistive technology and the pointer. */
  text: string;
}
function HintMark({ hint }: { hint: WorkspaceHint }) {
  return hint.kind === "attention" ? (
    <span className="ah-rail-count ah-rail-count-attention" aria-hidden="true">
      {hint.count}
    </span>
  ) : (
    <NavMark
      mark={
        hint.kind === "working" ? "◌" : hint.kind === "background" ? "◉" : "○"
      }
    />
  );
}
/** One workspace in the rail's alphabetical list. Its conversations are on
 * its own page; the row says only whether something there waits or runs. */
export function WorkspaceNavRow({
  name,
  href,
  selected = false,
  summary,
  hint,
  mutationState,
  workspaceMenu,
  icon,
}: {
  name: string;
  href: string;
  /** The workspace's icon in place of the folder (workspace-icons). */
  icon?: WorkspaceIconModel;
  selected?: boolean;
  summary?: string;
  hint?: WorkspaceHint;
  mutationState?: string;
  workspaceMenu?: ReactNode;
}) {
  const summaryId = useId();
  const description = [hint?.text, summary].filter(Boolean).join(" · ");
  return (
    <li
      className="ah-workspace ah-workspace-row"
      data-selected={selected || undefined}
      title={description ? `${name} · ${description}` : name}
    >
      <LinkRow
        data-workspace-name={name}
        current={selected}
        kind="nav"
        aria-describedby={description ? summaryId : undefined}
        data-testid={`workspace-${name}`}
        className="ah-workspace-link"
        href={href}
      >
        {icon ? (
          <WorkspaceIcon icon={icon} />
        ) : (
          <Icon
            name="folder"
            className="ah-workspace-icon"
            aria-hidden="true"
          />
        )}
        <span className="ah-nav-label">{name}</span>
        {hint ? <HintMark hint={hint} /> : null}
      </LinkRow>
      {description ? (
        <span className="ah-visually-hidden" id={summaryId}>
          {description}
        </span>
      ) : null}
      {mutationState ? (
        <StatusMark label={mutationState} tone="warning" />
      ) : null}
      {workspaceMenu}
    </li>
  );
}
function initials(name: string) {
  const parts = name.split(/[-_.\s]+/).filter(Boolean);
  return (parts.length > 1 ? parts.map((p) => p[0]).join("") : name)
    .slice(0, 2)
    .toLocaleUpperCase("fi");
}
/** A narrow rail's agent: its workspace's initials and its state ball. */
function NowDot(agent: AgentNavModel) {
  const ball = ballOf(agent);
  const status = [
    agent.pendingLabel,
    agent.detail ?? agent.activityLabel ?? ballLabel(ball),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li data-testid={`agent-item-${agent.agentId}`} data-ball={ball}>
      <LinkRow
        kind="nav"
        current={agent.selected}
        href={agent.href}
        title={`${agent.title} · ${status}`}
        data-testid="agent-link"
        className="ah-now-dot"
      >
        {agent.workspaceIcon ? (
          <WorkspaceIcon icon={agent.workspaceIcon} size="m" />
        ) : (
          <span className="ah-now-dot-letters" aria-hidden="true">
            {initials(agent.workspaceName ?? agent.title)}
          </span>
        )}
        <Ball kind={ball} turn={agent.turnMark} />
        <span className="ah-visually-hidden">
          {agent.title}: {status}
        </span>
      </LinkRow>
    </li>
  );
}
/** Flat with icons; otherwise grouped by workspace. */
function RunningGroups({
  running,
  iconed,
  now,
  archive,
  rename,
  card,
}: {
  running: AgentNavModel[];
  iconed: boolean;
  now: number;
  archive?: RailArchive;
  rename?: RailRename;
  card?: WorkspaceCardActions;
}) {
  const groups = new Map<string, { name: string; rows: AgentNavModel[] }>();
  for (const agent of running) {
    const key = agent.workspaceId ?? agent.workspaceName ?? "";
    const group = groups.get(key) ?? {
      name: agent.workspaceName ?? "",
      rows: [],
    };
    group.rows.push(agent);
    groups.set(key, group);
  }
  const ordered = [...groups.entries()].sort(([, a], [, b]) =>
    a.name.localeCompare(b.name, "fi"),
  );
  const row = (agent: AgentNavModel) => (
    <AgentNavItem
      key={agent.agentId}
      {...agent}
      now={now}
      archive={archive}
      rename={rename}
      card={card}
    />
  );
  if (iconed) return <ul>{running.map(row)}</ul>;
  return (
    <>
      {ordered.map(([key, g]) => {
        return (
          // biome-ignore lint/a11y/useSemanticElements: a list group, not a form fieldset.
          <div
            key={key}
            className="ah-now-group"
            data-testid={`rail-group-${g.name}`}
            role="group"
          >
            <h3 className="ah-now-group-head">
              <span className="ah-now-group-name">{g.name}</span>
              <span className="ah-rail-count">{g.rows.length}</span>
            </h3>
            <ul>{g.rows.map(row)}</ul>
          </div>
        );
      })}
    </>
  );
}
/** What needs the person and what runs now, across every workspace (the
 * accepted Nyt sidebar), then Hiljaiset. Workers are listed as themselves,
 * not nested. */
export function NowSections({
  yours,
  running,
  quiet,
  collapsed = false,
  archive,
  rename,
  turn,
  card,
}: {
  yours: AgentNavModel[];
  running: AgentNavModel[];
  /** Hiljaiset (QuietSection), under Käynnissä; the narrow rail leaves it
   * out. */
  quiet?: ReactNode;
  collapsed?: boolean;
  /** Absent where the rail offers no archive (a story). */
  archive?: RailArchive;
  /** Absent where the rail offers no renaming (a story). */
  rename?: RailRename;
  /** Lowering a raise from Sinun vuorosi; absent while the feature is off. */
  turn?: RailTurn;
  /** The workspace icon card's actions, where rows carry icons. */
  card?: WorkspaceCardActions;
}) {
  const t = useText(navigationText);
  const yoursId = useId();
  const runningId = useId();
  const now = useMinuteNow();
  const iconed = [...yours, ...running].some((a) => a.workspaceIcon);
  if (collapsed)
    return (
      <div className="ah-now-dots">
        <ul data-testid="rail-yours" aria-label={t.yourTurn}>
          {yours.map((agent) => (
            <NowDot key={agent.agentId} {...agent} />
          ))}
        </ul>
        {yours.length ? <hr /> : null}
        <ul data-testid="rail-running" aria-label={t.running}>
          {running.map((agent) => (
            <NowDot key={agent.agentId} {...agent} />
          ))}
        </ul>
        {running.length ? <hr /> : null}
      </div>
    );
  return (
    <>
      <section
        className={iconed ? "ah-now ah-now-iconed" : "ah-now"}
        data-testid="rail-yours"
        aria-labelledby={yoursId}
      >
        <h2 className="ah-rail-section-head" id={yoursId}>
          {t.yourTurn}
          {yours.length ? (
            <span className="ah-rail-count ah-rail-count-attention">
              {yours.length}
            </span>
          ) : null}
        </h2>
        {yours.length ? (
          <ul>
            {yours.map((agent) => (
              <AgentNavItem
                key={agent.agentId}
                {...agent}
                now={now}
                archive={archive}
                rename={rename}
                turn={turn}
                card={card}
              />
            ))}
          </ul>
        ) : (
          <p className="ah-now-empty">{t.nothingWaits}</p>
        )}
      </section>
      <section
        className={iconed ? "ah-now ah-now-iconed" : "ah-now"}
        data-testid="rail-running"
        aria-labelledby={runningId}
      >
        <h2 className="ah-rail-section-head" id={runningId}>
          {t.running}
          {running.length ? (
            <span className="ah-rail-count">{running.length}</span>
          ) : null}
        </h2>
        {running.length ? (
          <RunningGroups
            running={running}
            iconed={iconed}
            now={now}
            archive={archive}
            rename={rename}
            card={card}
          />
        ) : (
          <p className="ah-now-empty">{t.nothingRuns}</p>
        )}
      </section>
      {quiet}
    </>
  );
}
export function WorkspaceRail({
  bell,
  collapsed,
  serverLabel,
  connectionLabel,
  connectionTone,
  homeCurrent = false,
  now,
  pages,
  filterValue,
  resultSummary,
  onCreateWorkspace,
  listState,
  children,
  only,
  archived,
  clones,
  sessionActions,
  onToggle,
  onFilter,
  onRefresh,
}: {
  collapsed: boolean;
  serverLabel: string;
  connectionLabel: string;
  connectionTone?: Tone;
  homeCurrent?: boolean;
  /** Sinun vuorosi and Käynnissä, above the workspaces (NowSections). */
  now?: ReactNode;
  /** Rows under Etusivu that lead to pages of their own (Agentin käytössä). */
  pages?: ReactNode;
  filterValue: string;
  /** The number of listed workspaces, said beside the heading. */
  resultSummary: string;
  onCreateWorkspace?: () => void;
  listState: AsyncState | "source-absent" | "filtered-empty";
  /** WorkspaceNavRow items, alphabetically. */
  children?: ReactNode;
  /**
   * The person's only visible workspace (Jari 31.10.2026): a
   * list of one says nothing, so the rail names it quietly at its foot,
   * with the way to add more, instead of the Työtilat section. Adding is
   * offered while onCreateWorkspace is.
   */
  only?: { name: string; href: string; current: boolean; adding: boolean };
  archived?: ReactNode;
  /** Running and unfinished clones, above the workspaces. */
  clones?: ReactNode;
  sessionActions?: ReactNode;
  onToggle: () => void;
  onFilter: (value: string) => void;
  onRefresh: () => void;
  /** The status bell on a page without a top bar of its own. */
  bell?: ReactNode;
}) {
  const t = useText(navigationText);
  return (
    <nav
      data-testid="workspace-navigation"
      aria-label={t.railLabel}
      tabIndex={-1}
      className={collapsed ? "ah-rail ah-rail-collapsed" : "ah-rail"}
    >
      <TooltipSide.Provider value="end">
        <header className="ah-rail-head">
          <div className="ah-rail-title">
            {/* The server name is the way home, like Etusivu below it. */}
            <strong title={`${serverLabel} · ${t.home}`}>
              <LinkRow
                href="/workspaces"
                kind="header"
                data-testid="server-home"
                className="ah-rail-server"
              >
                {collapsed ? "NAH" : serverLabel}
              </LinkRow>
            </strong>
            {collapsed ? (
              <span className="ah-rail-mobile-label">{t.workspaces}</span>
            ) : null}
            <span title={connectionLabel}>
              <StatusMark
                label={connectionLabel}
                tone={
                  connectionTone ??
                  (listState === "stale" ? "warning" : "neutral")
                }
              />
            </span>
            <Button
              data-testid={collapsed ? "navigation-open" : "close-navigation"}
              ariaLabel={collapsed ? t.openNavigation : t.closeNavigation}
              label={collapsed ? t.openNavigation : t.closeNavigation}
              icon={collapsed ? "forward" : "back"}
              variant="secondary"
              size="row"
              onPress={onToggle}
            />
          </div>
          <div className="ah-rail-home-row">
            <LinkRow
              href="/workspaces"
              data-testid="home-link"
              kind="home"
              current={homeCurrent}
              className="ah-rail-home"
              aria-label={collapsed ? t.home : undefined}
            >
              <Icon name="home" />
              <span className="ah-rail-home-label">{t.home}</span>
            </LinkRow>
            {bell}
          </div>
          {pages}
        </header>
        <div className="ah-rail-content">
          {now}
          {only && !collapsed ? (
            <section
              data-testid="rail-only-workspace"
              className="ah-rail-only"
              aria-label={t.yourWorkspace}
            >
              {clones}
              <LinkRow
                href={only.href}
                data-testid="rail-only-workspace-link"
                current={only.current}
                className="ah-rail-only-link"
              >
                <Icon name="folder" aria-hidden="true" />
                <span>{only.name}</span>
              </LinkRow>
              {onCreateWorkspace ? (
                <LinkRow
                  href="/workspaces/new"
                  data-testid="workspace-create"
                  current={only.adding}
                  className="ah-rail-only-add"
                >
                  <Icon name="plus" aria-hidden="true" />
                  <span>{t.addWorkspaces}</span>
                </LinkRow>
              ) : null}
              {archived}
            </section>
          ) : only ? null : collapsed ? (
            <ControlButton
              data-testid="rail-all-workspaces"
              size="row"
              variant="quiet"
              className="ah-now-expand"
              aria-label={t.allWorkspaces}
              title={t.allWorkspaces}
              onPress={onToggle}
            >
              <Icon name="folder" />
            </ControlButton>
          ) : (
            <section className="ah-rail-workspaces" aria-labelledby="rail-ws">
              <div className="ah-rail-section-head">
                <h2 id="rail-ws">
                  {t.workspaces}
                  <span
                    data-testid="workspace-summary"
                    className="ah-rail-count"
                    role="status"
                  >
                    {resultSummary}
                  </span>
                </h2>
                {onCreateWorkspace ? (
                  <ControlButton
                    data-testid="workspace-create"
                    size="row"
                    variant="quiet"
                    aria-label={t.newWorkspace}
                    title={t.newWorkspace}
                    onPress={onCreateWorkspace}
                  >
                    <Icon name="folderPlus" />
                  </ControlButton>
                ) : null}
              </div>
              <div className="ah-rail-filter">
                <TextField
                  className="ah-rail-search"
                  value={filterValue}
                  onChange={onFilter}
                >
                  <Label className="ah-visually-hidden">
                    {t.filterWorkspaces}
                  </Label>
                  <Input
                    data-testid="workspace-filter"
                    placeholder={t.filterWorkspaces}
                    autoComplete="off"
                  />
                </TextField>
                {filterValue ? (
                  <Button
                    data-testid="clear-filter"
                    label="×"
                    ariaLabel={t.clearSearch}
                    variant="quiet"
                    size="row"
                    onPress={() => onFilter("")}
                  />
                ) : null}
                <span className="ah-rail-refresh">
                  <RefreshIconButton onPress={onRefresh} />
                </span>
              </div>
              {clones}
              {listState === "loading" ? <p>{t.loadingWorkspaces}</p> : null}
              {listState === "empty" ? <p>{t.noWorkspaces}</p> : null}
              {listState === "filtered-empty" ? (
                <p data-testid="filter-empty">{t.filterEmpty}</p>
              ) : null}
              {listState === "source-absent" ? <p>{t.folderMissing}</p> : null}
              {listState === "error" || listState === "unknown" ? (
                <p>{t.workspacesUnavailable}</p>
              ) : (
                <ul className="ah-workspace-list">{children}</ul>
              )}
              {listState === "error" || listState === "loading"
                ? null
                : archived}
            </section>
          )}
        </div>
        {sessionActions ? (
          <footer className="ah-rail-foot">{sessionActions}</footer>
        ) : null}
      </TooltipSide.Provider>
    </nav>
  );
}
/** Archived (hidden) workspaces, collapsed at the end of the rail like finished conversations. */
export function ArchivedWorkspaces({
  workspaces,
  onRestore,
  restoreReason,
  problem,
  forceOpen = false,
}: {
  workspaces: {
    id: string;
    name: string;
    href: string;
    selected?: boolean;
    pending?: boolean;
  }[];
  onRestore?: (id: string) => void;
  restoreReason?: string;
  problem?: string;
  /** Open while a filter is narrowing the list, so it finds them too. */
  forceOpen?: boolean;
}) {
  const [show, setShow] = useState(false);
  const t = useText(navigationText);
  if (!workspaces.length && !problem) return null;
  const open = show || forceOpen || workspaces.some((w) => w.selected);
  return (
    <section
      data-testid="archived-workspaces"
      className="ah-rail-archived"
      aria-label={t.archivedWorkspaces}
    >
      {workspaces.length ? (
        <ControlButton
          data-testid="toggle-archived"
          size="inline"
          className="ah-rail-group-toggle"
          variant="quiet"
          aria-expanded={open}
          onPress={() => setShow(!open)}
        >
          <span aria-hidden="true" className="ah-disclosure-chevron" />
          {t.archived}
          <span className="ah-rail-count">{workspaces.length}</span>
        </ControlButton>
      ) : null}
      {open && workspaces.length ? (
        <ul>
          {workspaces.map((w) => (
            <li key={w.id} className="ah-archived-row">
              <LinkRow
                data-workspace-name={w.name}
                current={w.selected}
                kind="workspace"
                data-testid={`workspace-${w.name}`}
                className="ah-workspace-link"
                href={w.href}
              >
                {w.name}
              </LinkRow>
              <ControlButton
                data-testid={`restore-workspace-${w.name}`}
                variant="quiet"
                size="inline"
                aria-label={t.restoreNamed(w.name)}
                title={restoreReason || t.restoreHint}
                isDisabled={!onRestore || !!restoreReason || w.pending}
                onPress={() => onRestore?.(w.id)}
              >
                {w.pending ? t.restoring : t.restore}
              </ControlButton>
            </li>
          ))}
        </ul>
      ) : null}
      {problem ? (
        <p className="ah-inline-error" role="alert">
          {problem}
        </p>
      ) : null}
    </section>
  );
}
export function AgentHeader({
  title,
  titleState,
  titlePending = false,
  activityLabel,
  activityDetail,
  activityControl,
  activityAnimated = false,
  activityKind = "neutral",
  controlKind = "neutral",
  controlLabel,
  workspaceLabel,
  workspaceHref,
  detailsExpanded,
  onToggleDetails,
  titleAction,
  rename,
  recapAction,
  archive,
  editorControl,
  guideControl,
  settings,
  contextIndicator,
  modelPicker,
  emptyConversation = false,
  gitStatus,
  openMachines,
  terminal,
  detailsFacts,
  detailsExtra,
}: {
  title: string;
  titleState?: string;
  titlePending?: boolean;
  activityLabel: string;
  /** The running turn's phase and duration, in the activity's tooltip. */
  activityDetail?: string;
  activityControl?: ReactNode;
  activityAnimated?: boolean;
  activityKind?: StatusKind;
  controlKind?: StatusKind;
  controlLabel: string;
  workspaceLabel: string;
  workspaceHref: string;
  detailsExpanded: boolean;
  onToggleDetails: () => void;
  /** The conversation's archive action; on a phone it moves into the menu. */
  archive?: ArchiveControlsProps;
  /** The workspace editor's controls (Rinnakkain), where it is offered. */
  editorControl?: ReactNode;
  /** The started goal's guide toggle (Opas), where the conversation has one. */
  guideControl?: ReactNode;
  archiveReason?: string;
  settings?: { model?: string; thinking?: string };
  /** How full the model's context is (Rengas), just before the model. */
  contextIndicator?: ReactNode;
  modelPicker?: ReactNode;
  emptyConversation?: boolean;
  /** The workspace's Git status chip, beside the model (Yläpalkissa). */
  gitStatus?: ReactNode;
  /** The person's own computers this conversation used that have an SSH
   * connection open now (Yhteys auki). */
  openMachines?: readonly string[];
  /** The browser shell's toggle (Paneeli), before the title action. */
  terminal?: ReactNode;
  detailsFacts?: { label: string; value: string; copy?: boolean }[];
  detailsExtra?: ReactNode;
  titleAction?: {
    label: string;
    availability?: Availability;
    pending?: boolean;
    onPress: () => void;
  };
  /** Name the conversation by hand: the title becomes a field. */
  rename?: ConversationRename;
  /** Make a recap now (Jari 29.10.2026: always in the header; recaps are
   * otherwise automatic). */
  recapAction?: {
    availability?: Availability;
    pending?: boolean;
    onPress: () => void;
  };
}) {
  const t = useText(navigationText);
  const titleReasonId = useId();
  const naming = titlePending || !!titleAction?.pending;
  const [editing, setEditing] = useState(false);
  // A saved name shows at once, until the host's title changes from what
  // it was when the name was saved.
  const [saved, setSaved] = useState<{ name: string; over: string }>();
  if (saved && saved.over !== title) setSaved(undefined);
  const shownTitle = saved && saved.over === title ? saved.name : title;
  const renameReason =
    rename?.availability && "reason" in rename.availability
      ? rename.availability.reason
      : undefined;
  const canRename = !!rename && !renameReason && !naming;
  // An empty label means no state to show (for example while messages wait
  // for Pi to start); the header then carries no mark at all.
  const visibleActivity = !!activityLabel || !!activityControl;
  const visibleControl = controlKind === "read-only";
  const navigate = useNavigate();
  const archiving = archive ? archiveAction(archive) : undefined;
  const topline = useRef<HTMLDivElement>(null);
  const hidden = useHeaderShortening(topline);
  const phoneReadout = usePhoneHeaderReadout(topline);
  const phone = hidden.workspace === undefined;
  const explain = useExplainEntry();
  const phoneActions = phone
    ? phoneReadout.actions.map((action) => ({
        id: action.id,
        label: action.label,
        availability: action.disabled
          ? { state: "disabled" as const, reason: action.label }
          : undefined,
        run: () => activateHeaderControl(topline, action.selector),
      }))
    : [];
  const fallbackModel =
    settings?.model || settings?.thinking
      ? t.modelSummary(
          settings.model ?? t.modelUnknown,
          settings.thinking ?? t.thinkingFallback,
        )
      : undefined;
  // On a phone panels and secondary actions leave room for the title/facts
  // block; on a desktop this menu appears once the row has had to
  // move the workspace there to keep the title readable, and lists only what
  // the row no longer shows (CSS shows the trigger, this decides the rows).
  const menuActions = hidden.actions !== false;
  const headerMenu = [
    ...phoneActions,
    // On a phone the menu also opens the explain mode (Selitä tämä näkymä).
    ...(phone && explain ? [explain] : []),
    ...(hidden.workspace !== false
      ? [
          {
            id: "workspace",
            label: phone ? t.openWorkspace : workspaceLabel,
            description: phone ? undefined : t.openWorkspace,
            run: () => navigate(workspaceHref),
          },
        ]
      : []),
    ...(rename
      ? [
          {
            id: "rename",
            label: t.rename,
            availability: naming
              ? {
                  state: "disabled" as const,
                  reason: t.titling,
                }
              : (rename.availability ?? { state: "enabled" as const }),
            // After the menu has closed and handed focus back to its
            // trigger, so the field keeps it.
            run: () => setTimeout(() => setEditing(true)),
          },
        ]
      : []),
    ...(menuActions && titleAction
      ? [
          {
            id: "retitle",
            label: titleAction.label,
            availability: naming
              ? {
                  state: "disabled" as const,
                  reason: t.titling,
                }
              : (titleAction.availability ?? { state: "enabled" as const }),
            run: titleAction.onPress,
          },
        ]
      : []),
    ...(menuActions && recapAction
      ? [
          {
            id: "recap",
            label: t.recapNow,
            availability: recapAction.pending
              ? {
                  state: "disabled" as const,
                  reason: t.recapping,
                }
              : (recapAction.availability ?? { state: "enabled" as const }),
            run: recapAction.onPress,
          },
        ]
      : []),
    ...(menuActions && archiving
      ? [
          {
            id: archiving.id,
            label: archiving.label,
            availability: archiving.reason
              ? { state: "disabled" as const, reason: archiving.reason }
              : undefined,
            run: archiving.run,
          },
        ]
      : []),
    ...(menuActions
      ? [{ id: "details", label: t.details, run: onToggleDetails }]
      : []),
    // What the shortened row no longer shows: the Git counts (the chip's
    // icon still opens its layer) and the model, whose level is in Tiedot.
    ...(hidden.git
      ? [
          {
            id: "git",
            label: "Git",
            description: hidden.git,
            run: () =>
              topline.current
                ?.querySelector<HTMLElement>(".ah-gs-chip")
                ?.click(),
          },
        ]
      : []),
    ...(hidden.model
      ? [
          {
            id: "model",
            label: t.model,
            description: hidden.model,
            run: onToggleDetails,
          },
        ]
      : []),
  ];
  return (
    <header
      data-activity={activityKind}
      data-control={controlKind}
      className="ah-agent-header"
    >
      <div className="ah-agent-topline" ref={topline}>
        <div
          className="ah-title-row"
          data-testid="conversation-title"
          aria-busy={naming}
        >
          {editing && rename ? (
            <NameEditor
              value={shownTitle}
              label={t.conversationName}
              onSave={rename.onSave}
              onClose={(name) => {
                setEditing(false);
                if (name) setSaved({ name, over: title });
              }}
            />
          ) : (
            <h1 data-testid="workspace-title" title={shownTitle}>
              {canRename ? (
                <button
                  type="button"
                  className="ah-title-rename"
                  data-testid="conversation-rename"
                  title={t.rename}
                  onClick={() => setEditing(true)}
                >
                  {shownTitle}
                </button>
              ) : (
                shownTitle
              )}
            </h1>
          )}
          <PhoneHeaderFacts
            row={topline}
            readout={phoneReadout}
            workspace={workspaceLabel}
            onWorkspace={() => navigate(workspaceHref)}
            showModel={!emptyConversation}
            onDetails={onToggleDetails}
            activity={
              visibleActivity ? (
                <StatusMark
                  label={activityLabel}
                  kind={activityKind}
                  tone="info"
                />
              ) : undefined
            }
          />
          <span
            className="ah-title-dots"
            data-testid="title-dots"
            data-busy={naming}
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
          </span>
        </div>
        <span
          className="ah-visually-hidden"
          role="status"
          data-testid="title-status"
        >
          {naming ? t.titling : ""}
        </span>
        <LinkRow
          kind="header"
          data-testid="conversation-workspace"
          className="ah-header-workspace"
          href={workspaceHref}
        >
          {workspaceLabel}
        </LinkRow>
        {visibleActivity
          ? (activityControl ?? (
              <HeaderActivity
                label={activityLabel}
                detail={activityDetail}
                animated={activityAnimated}
                kind={activityKind}
              />
            ))
          : null}
        {visibleControl ? (
          <StatusMark
            data-testid="read-only-indicator"
            label={t.readOnly}
            tone="neutral"
            kind="read-only"
          />
        ) : null}
        {openMachines?.length ? (
          <span
            className="ah-machine-open"
            data-testid="machine-open"
            title={t.machineOpen(openMachines.join(", "))}
          >
            <i className="ah-machine-open-dot" aria-hidden="true" />
            <span className="ah-visually-hidden">{t.machineOpenPrefix}</span>
            <span className="ah-machine-open-name">
              {openMachines.join(", ")}
            </span>
          </span>
        ) : null}
        {gitStatus}
        {contextIndicator}
        {modelPicker ??
          (settings?.model || settings?.thinking ? (
            <ControlButton
              data-testid="conversation-details"
              data-model={settings?.model}
              data-thinking={settings?.thinking}
              data-menu-summary={fallbackModel}
              size="inline"
              presentation="pill"
              className="ah-set-chip ah-set-compact"
              aria-label={t.openDetails(fallbackModel ?? "")}
              title={fallbackModel}
              aria-expanded={detailsExpanded}
              onPress={onToggleDetails}
            >
              <span className="ah-set-model">
                {settings.model ?? t.modelUnknown}
              </span>
            </ControlButton>
          ) : null)}
        <i className="ah-header-sep" aria-hidden="true" />
        {guideControl}
        {editorControl}
        {terminal}
        <ExplainToggle />
        {recapAction ? (
          <ControlButton
            data-testid="conversation-recap"
            size="row"
            className="ah-topbar-icon ah-header-recap"
            data-busy={recapAction.pending || undefined}
            variant="quiet"
            aria-label={t.recapNow}
            title={
              recapAction.availability && "reason" in recapAction.availability
                ? recapAction.availability.reason
                : t.recapNow
            }
            aria-description={
              recapAction.availability && "reason" in recapAction.availability
                ? recapAction.availability.reason
                : undefined
            }
            isDisabled={
              recapAction.availability?.state !== "enabled" ||
              !!recapAction.pending
            }
            onPress={recapAction.onPress}
          >
            <Icon name="recap" />
          </ControlButton>
        ) : null}
        {titleAction ? (
          <ControlButton
            data-testid="conversation-retitle"
            size="row"
            className="ah-topbar-icon ah-retitle"
            data-busy={naming}
            aria-describedby={
              titleAction.availability && "reason" in titleAction.availability
                ? titleReasonId
                : undefined
            }
            variant="quiet"
            aria-label={titleAction.label}
            title={
              titleAction.availability && "reason" in titleAction.availability
                ? titleAction.availability.reason
                : titleAction.label
            }
            aria-description={
              titleAction.availability && "reason" in titleAction.availability
                ? titleAction.availability.reason
                : undefined
            }
            isDisabled={titleAction.availability?.state !== "enabled" || naming}
            onPress={titleAction.onPress}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M0.5 13.5 0.61 12.87 2.12 12.64 3.84 2.86 2.41 2.63 2.52 2H8L7.89 2.63L6.37 2.86L5.63 7.11H9.81L10.56 2.86L9.13 2.63L9.24 2H14.74L14.62 2.63L13.1 2.86L11.37 12.64L12.81 12.87L12.7 13.5H7.21L7.32 12.87L8.84 12.64L9.64 8.05H5.46L4.65 12.64L6.08 12.87L5.97 13.5Z"
              />
              <g
                transform="translate(12.5 12) scale(.5)"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <g className="ah-retitle-arrow" data-testid="title-arrow">
                  <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" />
                </g>
              </g>
            </svg>
          </ControlButton>
        ) : null}
        {titleAction?.availability && "reason" in titleAction.availability ? (
          <span id={titleReasonId} className="ah-visually-hidden">
            {titleAction.availability.reason}
          </span>
        ) : null}
        {archive ? <ArchiveControls {...archive} /> : null}
        <StatusBell />
        <ControlButton
          data-testid="workspace-details"
          size="row"
          className="ah-details-toggle ah-topbar-icon"
          aria-label={t.details}
          title={t.details}
          aria-expanded={detailsExpanded}
          variant="quiet"
          onPress={onToggleDetails}
        >
          <Icon name="info" />
        </ControlButton>
        <Menu
          label={t.conversationActions}
          trigger={<Icon name="more" />}
          triggerPresentation="icon"
          triggerClassName="ah-header-more"
          triggerTestId="conversation-menu"
          placement="bottom end"
          heading={<p className="ah-header-full-title">{shownTitle}</p>}
          items={headerMenu}
          onAction={(id) => headerMenu.find((item) => item.id === id)?.run()}
        />
      </div>
      <NoticeSlot priority={1} className="ah-notice-area-header" />
      {titleState ? <StatusMark label={titleState} tone="info" /> : null}
      {detailsExpanded ? (
        <section
          data-testid="conversation-details"
          className="ah-details-popover"
          aria-label={t.details}
        >
          <h2>{t.details}</h2>
          {detailsExtra}
          <dl className="ah-facts">
            {(
              detailsFacts ?? [
                { label: t.factWorkspace, value: workspaceLabel },
                { label: t.factModel, value: settings?.model ?? t.unknown },
                {
                  label: t.factThinking,
                  value: settings?.thinking ?? t.unknown,
                },
                { label: t.factControl, value: controlLabel },
                { label: t.factStarted, value: t.unknown },
              ]
            ).map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>
                  <span>{fact.value}</span>
                  {fact.copy ? (
                    <ControlButton
                      variant="quiet"
                      size="inline"
                      aria-label={t.copy(fact.label)}
                      title={t.copy(fact.label)}
                      onPress={() =>
                        void navigator.clipboard?.writeText(fact.value)
                      }
                    >
                      <Icon name="copy" />
                    </ControlButton>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </header>
  );
}
export function AgentFacts({
  facts,
}: {
  facts: {
    label: string;
    value: string;
    state?: "confirmed" | "unknown" | "unavailable" | "conflicting";
    observedAt?: string;
    source?: string;
  }[];
}) {
  const t = useText(navigationText);
  return (
    <dl className="ah-facts">
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>
            <span>{fact.value}</span>
            {fact.state && fact.state !== "confirmed" ? (
              <StatusMark
                label={
                  fact.state === "unknown"
                    ? t.unknown
                    : fact.state === "unavailable"
                      ? t.unavailable
                      : t.conflicting
                }
                tone="warning"
              />
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

```
