import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Input, Label, TextField } from "react-aria-components";
import { useLocation, useNavigate } from "react-router";
import {
  ArchiveControls,
  type ArchiveControlsProps,
  archiveAction,
} from "./ArchiveControls";
import type { AgentPresentation } from "./agentPresentation";
import { ControlButton, ExternalLink, LinkRow } from "./ControlElements";
import { HeaderActivity, useHeaderShortening } from "./HeaderShortening";
import { Icon } from "./Icon";
import { NoticeAreaProvider, NoticeSlot } from "./NoticeArea";
import { Menu } from "./Overlays";
import { Button, ListRow, RefreshIconButton } from "./Primitives";
import { relativeRecapAge, useMinuteNow } from "./RecapCard";
import type { StatusKind } from "./Status";
import { Badge, StatusMark } from "./Status";
import type { AsyncState, Availability, Tone } from "./types";

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
  connection,
  rail,
  main,
  overlays,
  toast,
  mobileTitle,
  fallbackAccount,
  topBar,
  navigationBadge = 0,
}: {
  className?: string;
  /** How many conversations wait for the person (Sinun vuorosi), on the
   * phone's menu button while the rail is out of sight. */
  navigationBadge?: number;
  connection?: ReactNode;
  /** Single-workspace mode's top bar, in place of the sidebar. */
  topBar?: ReactNode;
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
        Siirry sisältöön
      </ExternalLink>
      {connection}
      {rail ? null : topBar}
      <div
        className={`ah-shell-body${rail ? "" : " ah-shell-no-rail"}${drawerActive ? " ah-mobile-open" : ""}`}
      >
        {drawerActive ? (
          <ControlButton
            size="row"
            variant="quiet"
            className="ah-mobile-scrim"
            aria-label="Sulje valikko"
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
                aria-label="Sulje navigaatio"
                onPress={closeMobile}
              >
                <Icon name="back" />
              </ControlButton>
            ) : null}
          </div>
        ) : null}
        {fallbackAccount && !rail ? (
          <aside className="ah-fallback-account" aria-label="Tili">
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
                      ? `Avaa navigaatio, ${navigationBadge} odottaa sinua`
                      : "Avaa navigaatio"
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
                {mobileTitle ?? "Etusivu"}
              </span>
              {rail &&
              location.pathname !== "/workspaces" &&
              (!/^\/workspaces\/ws_/.test(location.pathname) ||
                new URLSearchParams(location.search).has("conversation")) ? (
                <LinkRow
                  data-testid="home-link"
                  href="/workspaces"
                  aria-label="Etusivu"
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
          <span className="ah-nav-label">{label}</span>
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
                        displayStatusText === "Tieto vanhentunut" ||
                        displayStatusText === "Ohjaus ei tiedossa"
                          ? "warning"
                          : "neutral"
                      }
                      kind={
                        displayStatusText === "vain luku"
                          ? "read-only"
                          : displayStatusText === "Tieto vanhentunut" ||
                              displayStatusText === "Ohjaus ei tiedossa"
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
                text === "Yhteys poikki" || text === "Historia ei luettavissa"
                  ? "warning"
                  : "neutral"
              }
              kind={
                text === "Vain luku"
                  ? "read-only"
                  : text === "Historia ei luettavissa"
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
  return (
    (
      {
        "●": "Uusi vastaus",
        "?": "Kysyy sinulta",
        "◌": "Agentti työskentelee",
        "○": "Odottaa",
        "◉": "Odottaa taustatyötä",
        "✓": "Valmis",
        "–": "Tila ei tiedossa",
      } as Record<string, string>
    )[mark] ?? "Tila ei tiedossa"
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
  /** The turn ended in a failure the person has to look at (Pi crashed). */
  failed?: boolean;
  selected?: boolean;
  priority?: number; // caller ranks native state; navigation only presents it
  finished?: boolean;
  depth?: number;
  presence?: "present" | "absent";
  stale?: boolean;
  spinoffWorking?: boolean;
  /** A pending command on this conversation (ADR 0023): dimmed, steady, marked. */
  pendingLabel?: string;
  /** A worktree agent (ADR 0025); merged when Git says its work is in the
   * base branch. */
  worktree?: { merged: boolean };
  /** The agent has asked the person something and waits for the answer. */
  question?: boolean;
  /** What the row says about itself beyond its title: workspace, state and
   * what it waits for. The one-line row says it but does not show it. */
  detail?: string;
  /** The workspace the row is grouped under in Käynnissä. */
  workspaceId?: string;
  /** The workspace's name, for the group heading and the narrow rail. */
  workspaceName?: string;
}
/** The rail's state ball (research-workmux-sidebar round 3, Ryhmät tiiviinä):
 * working includes waiting on background work, your turn is a question or an
 * unread reply, done waits for a message, failed needs a look. */
export type BallKind = "work" | "you" | "done" | "fail" | "unknown";
const ballLabels: Record<BallKind, string> = {
  work: "Työskentelee",
  you: "Sinun vuorosi",
  done: "Valmis",
  fail: "Epäonnistui",
  unknown: "Tila ei tiedossa",
};
export function ballOf(
  agent: Pick<
    AgentNavModel,
    | "failed"
    | "attentionLabel"
    | "question"
    | "activity"
    | "activityLabel"
    | "spinoffWorking"
  >,
): BallKind {
  if (agent.failed) return "fail";
  if (agent.attentionLabel || agent.question) return "you";
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
  if (activity === "waiting" || activity === "closed") return "done";
  return "unknown";
}
function Ball({ kind }: { kind: BallKind }) {
  return (
    <span
      className={`ah-nav-mark ah-ball ah-ball-${kind}`}
      aria-hidden="true"
      title={ballLabels[kind]}
    />
  );
}
/** The row's short age of its last change: nyt, 4 min, 2 t, 3 pv. */
export function changeAge(at: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - at) / 60000));
  if (minutes < 1) return "nyt";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} t`;
  return `${Math.floor(hours / 24)} pv`;
}
/** Done and untouched for over an hour: nobody is on it right now. */
const quietAfter = 60 * 60 * 1000;
function quiet(agent: AgentNavModel, now: number) {
  return (
    ballOf(agent) === "done" &&
    agent.changedAt !== undefined &&
    now - agent.changedAt >= quietAfter &&
    !agent.selected
  );
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
  depth = 0,
  presence = "present",
  stale = false,
  spinoffWorking = false,
  pendingLabel,
  worktree,
  question = false,
  detail,
  now = Date.now(),
}: AgentNavModel & { now?: number }) {
  const ball = ballOf({
    failed,
    attentionLabel,
    question,
    activity,
    activityLabel,
    spinoffWorking,
  });
  const age = changedAt !== undefined ? changeAge(changedAt, now) : undefined;
  const said = [
    pendingLabel,
    detail ?? activityLabel,
    worktree
      ? worktree.merged
        ? "Worktree-agentti, työ yhdistetty"
        : "Worktree-agentti"
      : null,
    spinoffWorking ? "Worker työskentelee" : null,
    controlLabel,
    detail ? null : operationLabel,
    historyLabel,
    stale ? "Tieto vanhentunut" : null,
    presence === "absent" ? "Ei enää löydy" : null,
    changedAt !== undefined ? relativeRecapAge(changedAt, now) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li
      data-testid={`agent-item-${agentId}`}
      data-ball={ball}
      title={`${title} · ${said}`}
      data-waiting={activity === "waiting_background"}
      data-has-history-warning={Boolean(historyLabel)}
      className={`ah-agent-item${spinoffWorking ? " ah-waiting-spinoff" : ""}${pendingLabel ? " ah-pending-item" : ""}`}
      style={{ "--ah-depth": depth } as React.CSSProperties}
    >
      <ListRow
        className="ah-sidebar-agent-row ah-now-row"
        trailing={spinoffWorking ? <SpinoffWorkingMark /> : undefined}
      >
        <NavLink
          href={href}
          label={title}
          current={selected ? "page" : false}
          detail={said}
          oneLine
          leading={
            <>
              <Ball kind={ball} />
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
            age !== undefined && changedAt !== undefined ? (
              <time
                className="ah-nav-time"
                dateTime={new Date(changedAt).toISOString()}
              >
                {age}
              </time>
            ) : undefined
          }
        />
      </ListRow>
    </li>
  );
}
/** A sub-agent at work: the trunk stays, only the branch and its end pulse. */
function SpinoffWorkingMark() {
  return (
    <svg
      className="ah-nav-spinoff"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="6" r="2" />
      <path d="M7 8v10" />
      <g className="ah-nav-spinoff-branch">
        <path d="M7 12c0 3 3 4 7 4" />
        <circle cx="17" cy="16" r="2" />
      </g>
    </svg>
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
}: {
  name: string;
  href: string;
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
        <Icon name="folder" className="ah-workspace-icon" aria-hidden="true" />
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
    agent.detail ?? agent.activityLabel ?? ballLabels[ball],
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
        <span className="ah-now-dot-letters" aria-hidden="true">
          {initials(agent.workspaceName ?? agent.title)}
        </span>
        <Ball kind={ball} />
        <span className="ah-visually-hidden">
          {agent.title}: {status}
        </span>
      </LinkRow>
    </li>
  );
}
const quietWord = (n: number) => `${n} ${n === 1 ? "hiljainen" : "hiljaista"}`;
/** Opens and closes a folded part of Käynnissä; the fold is the tab's view. */
function FoldToggle({
  testId,
  open,
  onToggle,
  label,
  count,
  workspace = false,
}: {
  testId: string;
  open: boolean;
  onToggle: () => void;
  label: string;
  count?: number;
  workspace?: boolean;
}) {
  return (
    <li>
      <ControlButton
        data-testid={testId}
        size="inline"
        variant="quiet"
        className={`ah-now-fold${workspace ? " ah-now-fold-workspace" : ""}`}
        aria-expanded={open}
        onPress={onToggle}
      >
        <span aria-hidden="true" className="ah-disclosure-chevron" />
        <span className="ah-now-fold-label">{label}</span>
        {count !== undefined ? (
          <span className="ah-rail-count">{count}</span>
        ) : null}
      </ControlButton>
    </li>
  );
}
/** Käynnissä grouped by workspace (Ryhmät): done rows quiet for over an hour
 * fold to the end of their group, and a workspace where everything is quiet
 * sinks under Hiljaiset. The open conversation and a failed one never fold. */
function RunningGroups({
  running,
  now,
}: {
  running: AgentNavModel[];
  now: number;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));
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
  const live = ordered.filter(([, g]) => g.rows.some((a) => !quiet(a, now)));
  const dormant = ordered.filter(([, g]) => g.rows.every((a) => quiet(a, now)));
  const row = (agent: AgentNavModel) => (
    <AgentNavItem key={agent.agentId} {...agent} now={now} />
  );
  return (
    <>
      {live.map(([key, g]) => {
        const shown = g.rows.filter((a) => !quiet(a, now));
        const hidden = g.rows.filter((a) => quiet(a, now));
        const fold = `q:${key}`;
        return (
          <div
            key={key}
            className="ah-now-group"
            data-testid={`rail-group-${g.name}`}
          >
            <h3 className="ah-now-group-head">
              <span className="ah-now-group-name">{g.name}</span>
              <span className="ah-rail-count">{g.rows.length}</span>
            </h3>
            <ul>
              {shown.map(row)}
              {hidden.length ? (
                <FoldToggle
                  testId={`rail-fold-quiet-${g.name}`}
                  open={!!open[fold]}
                  onToggle={() => toggle(fold)}
                  label={quietWord(hidden.length)}
                />
              ) : null}
              {hidden.length && open[fold] ? hidden.map(row) : null}
            </ul>
          </div>
        );
      })}
      {dormant.length ? (
        <>
          <p className="ah-now-rule" data-testid="rail-quiet-rule">
            <span>Hiljaiset · yli tunnin</span>
          </p>
          <ul data-testid="rail-quiet">
            {dormant.map(([key, g]) => {
              const fold = `d:${key}`;
              return (
                <li key={key} className="ah-now-dormant">
                  <ul>
                    <FoldToggle
                      testId={`rail-fold-dormant-${g.name}`}
                      open={!!open[fold]}
                      onToggle={() => toggle(fold)}
                      label={g.name}
                      count={g.rows.length}
                      workspace
                    />
                    {open[fold] ? g.rows.map(row) : null}
                  </ul>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </>
  );
}
/** What needs the person and what runs now, across every workspace (the
 * accepted Nyt sidebar). Workers are listed as themselves, not nested. */
export function NowSections({
  yours,
  running,
  collapsed = false,
}: {
  yours: AgentNavModel[];
  running: AgentNavModel[];
  collapsed?: boolean;
}) {
  const yoursId = useId();
  const runningId = useId();
  const now = useMinuteNow();
  if (collapsed)
    return (
      <div className="ah-now-dots">
        <ul data-testid="rail-yours" aria-label="Sinun vuorosi">
          {yours.map((agent) => (
            <NowDot key={agent.agentId} {...agent} />
          ))}
        </ul>
        {yours.length ? <hr /> : null}
        <ul data-testid="rail-running" aria-label="Käynnissä">
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
        className="ah-now"
        data-testid="rail-yours"
        aria-labelledby={yoursId}
      >
        <h2 className="ah-rail-section-head" id={yoursId}>
          Sinun vuorosi
          {yours.length ? (
            <span className="ah-rail-count ah-rail-count-attention">
              {yours.length}
            </span>
          ) : null}
        </h2>
        {yours.length ? (
          <ul>
            {yours.map((agent) => (
              <AgentNavItem key={agent.agentId} {...agent} now={now} />
            ))}
          </ul>
        ) : (
          <p className="ah-now-empty">Mikään ei odota sinua.</p>
        )}
      </section>
      <section
        className="ah-now"
        data-testid="rail-running"
        aria-labelledby={runningId}
      >
        <h2 className="ah-rail-section-head" id={runningId}>
          Käynnissä
          {running.length ? (
            <span className="ah-rail-count">{running.length}</span>
          ) : null}
        </h2>
        {running.length ? (
          <RunningGroups running={running} now={now} />
        ) : (
          <p className="ah-now-empty">Mikään ei ole käynnissä.</p>
        )}
      </section>
    </>
  );
}
export function WorkspaceRail({
  collapsed,
  serverLabel,
  connectionLabel,
  connectionTone,
  homeCurrent = false,
  now,
  filterValue,
  resultSummary,
  onCreateWorkspace,
  listState,
  children,
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
  filterValue: string;
  /** The number of listed workspaces, said beside the heading. */
  resultSummary: string;
  onCreateWorkspace?: () => void;
  listState: AsyncState | "source-absent" | "filtered-empty";
  /** WorkspaceNavRow items, alphabetically. */
  children?: ReactNode;
  archived?: ReactNode;
  /** Running and unfinished clones, above the workspaces. */
  clones?: ReactNode;
  sessionActions?: ReactNode;
  onToggle: () => void;
  onFilter: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <nav
      data-testid="workspace-navigation"
      aria-label="Työtilat ja keskustelut"
      tabIndex={-1}
      className={collapsed ? "ah-rail ah-rail-collapsed" : "ah-rail"}
    >
      <header className="ah-rail-head">
        <div className="ah-rail-title">
          {/* The server name is the way home, like Etusivu below it. */}
          <strong title={`${serverLabel} · Etusivu`}>
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
            <span className="ah-rail-mobile-label">Työtilat</span>
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
            ariaLabel={collapsed ? "Avaa navigaatio" : "Sulje navigaatio"}
            label={collapsed ? "Avaa navigaatio" : "Sulje navigaatio"}
            icon={collapsed ? "forward" : "back"}
            variant="secondary"
            size="row"
            onPress={onToggle}
          />
        </div>
        <LinkRow
          href="/workspaces"
          data-testid="home-link"
          kind="home"
          current={homeCurrent}
          className="ah-rail-home"
        >
          <Icon name="home" />
          <span className="ah-rail-home-label">Etusivu</span>
        </LinkRow>
      </header>
      <div className="ah-rail-content">
        {now}
        {collapsed ? (
          <ControlButton
            data-testid="rail-all-workspaces"
            size="row"
            variant="quiet"
            className="ah-now-expand"
            aria-label="Kaikki työtilat"
            title="Kaikki työtilat"
            onPress={onToggle}
          >
            <Icon name="folder" />
          </ControlButton>
        ) : (
          <section className="ah-rail-workspaces" aria-labelledby="rail-ws">
            <div className="ah-rail-section-head">
              <h2 id="rail-ws">
                Työtilat
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
                  aria-label="Uusi työtila"
                  title="Uusi työtila"
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
                <Label className="ah-visually-hidden">Suodata työtiloja</Label>
                <Input
                  data-testid="workspace-filter"
                  placeholder="Suodata työtiloja"
                  autoComplete="off"
                />
              </TextField>
              {filterValue ? (
                <Button
                  data-testid="clear-filter"
                  label="×"
                  ariaLabel="Tyhjennä haku"
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
            {listState === "loading" ? <p>Ladataan työtiloja…</p> : null}
            {listState === "empty" ? <p>Työtiloja ei ole.</p> : null}
            {listState === "filtered-empty" ? (
              <p data-testid="filter-empty">Hakua vastaavia kohteita ei ole.</p>
            ) : null}
            {listState === "source-absent" ? (
              <p>Työtilakansiota ei löydy.</p>
            ) : null}
            {listState === "error" || listState === "unknown" ? (
              <p>Työtiloja ei voitu näyttää.</p>
            ) : (
              <ul className="ah-workspace-list">{children}</ul>
            )}
            {listState === "error" || listState === "loading" ? null : archived}
          </section>
        )}
      </div>
      {sessionActions ? (
        <footer className="ah-rail-foot">{sessionActions}</footer>
      ) : null}
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
  if (!workspaces.length && !problem) return null;
  const open = show || forceOpen || workspaces.some((w) => w.selected);
  return (
    <section
      data-testid="archived-workspaces"
      className="ah-rail-archived"
      aria-label="Arkistoidut työtilat"
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
          Arkistoidut
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
                aria-label={`Palauta ${w.name}`}
                title={restoreReason || "Palauta työtilaksi sivupalkkiin"}
                isDisabled={!onRestore || !!restoreReason || w.pending}
                onPress={() => onRestore?.(w.id)}
              >
                {w.pending ? "Palautetaan…" : "Palauta"}
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
  archive,
  editorControl,
  filesControl,
  guideControl,
  settings,
  contextIndicator,
  modelPicker,
  gitStatus,
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
  /** The conversation's file panel toggle, where it has offered files. */
  filesControl?: ReactNode;
  /** The started goal's guide toggle (Opas), where the conversation has one. */
  guideControl?: ReactNode;
  archiveReason?: string;
  settings?: { model?: string; thinking?: string };
  /** How full the model's context is (Rengas), just before the model. */
  contextIndicator?: ReactNode;
  modelPicker?: ReactNode;
  /** The workspace's Git status chip, beside the model (Yläpalkissa). */
  gitStatus?: ReactNode;
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
}) {
  const titleReasonId = useId();
  const naming = titlePending || !!titleAction?.pending;
  // An empty label means no state to show (for example while messages wait
  // for Pi to start); the header then carries no mark at all.
  const visibleActivity = !!activityLabel || !!activityControl;
  const visibleControl = controlKind === "read-only";
  const navigate = useNavigate();
  const archiving = archive ? archiveAction(archive) : undefined;
  const topline = useRef<HTMLDivElement>(null);
  const hidden = useHeaderShortening(topline);
  const fallbackModel =
    settings?.model || settings?.thinking
      ? `${settings.model ?? "Malli ei tiedossa"} · ajattelutaso ${settings.thinking ?? "Agentti"}`
      : undefined;
  // On a phone the secondary actions leave the top bar for this menu, so the
  // header stays two rows; on a desktop it appears once the row has had to
  // move the workspace there to keep the title readable, and lists only what
  // the row no longer shows (CSS shows the trigger, this decides the rows).
  const menuActions = hidden.actions !== false;
  const headerMenu = [
    ...(hidden.workspace !== false
      ? [
          {
            id: "workspace",
            label: workspaceLabel,
            description: "Avaa työtila",
            run: () => navigate(workspaceHref),
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
                  reason: "Otsikkoa luodaan…",
                }
              : (titleAction.availability ?? { state: "enabled" as const }),
            run: titleAction.onPress,
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
      ? [{ id: "details", label: "Tiedot", run: onToggleDetails }]
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
            label: "Malli",
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
          <h1 data-testid="workspace-title" title={title}>
            {title}
          </h1>
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
          {naming ? "Otsikkoa luodaan…" : ""}
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
            label="Vain luku"
            tone="neutral"
            kind="read-only"
          />
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
              aria-label={`${fallbackModel} · avaa tiedot`}
              title={fallbackModel}
              aria-expanded={detailsExpanded}
              onPress={onToggleDetails}
            >
              <span className="ah-set-model">
                {settings.model ?? "Malli ei tiedossa"}
              </span>
            </ControlButton>
          ) : null)}
        <i className="ah-header-sep" aria-hidden="true" />
        {guideControl}
        {filesControl}
        {editorControl}
        {terminal}
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
        <ControlButton
          data-testid="workspace-details"
          size="row"
          className="ah-details-toggle ah-topbar-icon"
          aria-label="Tiedot"
          title="Tiedot"
          aria-expanded={detailsExpanded}
          variant="quiet"
          onPress={onToggleDetails}
        >
          <Icon name="info" />
        </ControlButton>
        <Menu
          label="Keskustelun toiminnot"
          trigger={<Icon name="more" />}
          triggerPresentation="icon"
          triggerClassName="ah-header-more"
          triggerTestId="conversation-menu"
          placement="bottom end"
          heading={<p className="ah-header-full-title">{title}</p>}
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
          aria-label="Tiedot"
        >
          <h2>Tiedot</h2>
          {detailsExtra}
          <dl className="ah-facts">
            {(
              detailsFacts ?? [
                { label: "Työtila", value: workspaceLabel },
                { label: "Malli", value: settings?.model ?? "Ei tiedossa" },
                {
                  label: "Ajattelutaso",
                  value: settings?.thinking ?? "Ei tiedossa",
                },
                { label: "Ohjaus", value: controlLabel },
                { label: "Aloitettu", value: "Ei tiedossa" },
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
                      aria-label={`Kopioi ${fact.label.toLowerCase()}`}
                      title={`Kopioi ${fact.label.toLowerCase()}`}
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
                    ? "Ei tiedossa"
                    : fact.state === "unavailable"
                      ? "Ei saatavilla"
                      : "Ristiriita"
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
