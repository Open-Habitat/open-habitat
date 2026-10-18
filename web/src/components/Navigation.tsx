import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Input, Label, TextField } from "react-aria-components";
import { useLocation } from "react-router";
import type { AgentPresentation } from "./agentPresentation";
import { ControlButton, ExternalLink, LinkRow } from "./ControlElements";
import { Icon } from "./Icon";
import { Button, ListRow, RefreshIconButton } from "./Primitives";
import type { StatusKind } from "./Status";
import { Badge, StatusMark } from "./Status";
import type { Action, AsyncState, Availability, Tone } from "./types";

export function AppShell({
  className,
  connection,
  rail,
  main,
  overlays,
  toast,
  mobileTitle,
  fallbackAccount,
}: {
  className?: string;
  connection?: ReactNode;
  mobileTitle?: string;
  fallbackAccount?: ReactNode;
  rail?: ReactNode;
  main: ReactNode;
  overlays?: ReactNode;
  toast?: ReactNode;
}) {
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
    <div className={`ah-app-shell${className ? ` ${className}` : ""}`}>
      <ExternalLink
        className="ah-skip"
        href="#main"
        onClick={() => document.getElementById("main")?.focus()}
      >
        Siirry sisältöön
      </ExternalLink>
      {connection}
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
                  size="row"
                  variant="quiet"
                  ref={mobileTrigger}
                  aria-label="Avaa navigaatio"
                  aria-expanded={drawerActive}
                  onPress={() => {
                    setOpenedAtKey(location.key);
                    setMobileOpen(true);
                  }}
                >
                  <Icon name="menu" />
                </ControlButton>
              ) : null}
              <span className="ah-mobile-title" title={mobileTitle}>
                {mobileTitle ?? "Etusivu"}
              </span>
              {rail &&
              location.pathname !== "/workspaces" &&
              (!/^\/workspaces\/ws_/.test(location.pathname) ||
                new URLSearchParams(location.search).has("conversation")) ? (
                <LinkRow href="/workspaces" aria-label="Etusivu">
                  <Icon name="home" />
                </LinkRow>
              ) : null}
            </div>
          ) : null}
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
}) {
  const statusId = useId();
  return (
    <LinkRow
      current={Boolean(current)}
      kind="agent"
      aria-label={label}
      aria-describedby={statusText ? statusId : undefined}
      className="ah-nav-link"
      href={href}
    >
      {leading}
      <span className="ah-nav-label">{label}</span>
      {statusText ? (
        <span id={statusId}>
          {displayStatusText !== undefined ? (
            <>
              {displayStatusText ? (
                compactMark && displayStatusText === "◌" ? (
                  // Working is the draft's pulsing accent dot, not a glyph.
                  <span
                    className="ah-nav-mark ah-nav-working"
                    aria-hidden="true"
                    title={activityLabelForMark(displayStatusText)}
                  />
                ) : compactMark ? (
                  <span
                    className="ah-nav-mark"
                    aria-hidden="true"
                    title={activityLabelForMark(displayStatusText)}
                  >
                    {displayStatusText}
                  </span>
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
      {badgeText ? <Badge label={badgeText} tone="warning" /> : null}
    </LinkRow>
  );
}
function activityLabelForMark(mark: string) {
  return (
    (
      {
        "●": "Uusi vastaus",
        "◌": "Pi työskentelee",
        "○": "Odottaa",
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
  relativeTime?: string;
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
}
export function AgentNavItem({
  href,
  title,
  activity,
  activityLabel,
  controlLabel,
  attentionLabel,
  operationLabel,
  historyLabel,
  relativeTime,
  selected = false,
  depth = 0,
  presence = "present",
  stale = false,
  spinoffWorking = false,
  pendingLabel,
  worktree,
}: AgentNavModel) {
  const statusParts = [
    worktree
      ? worktree.merged
        ? "Worktree-agentti, työ yhdistetty"
        : "Worktree-agentti"
      : null,
    spinoffWorking && !/odottaa spinoffia/i.test(activityLabel)
      ? "Spinoff työskentelee"
      : null,
    controlLabel,
    operationLabel,
    historyLabel,
    stale ? "Tieto vanhentunut" : null,
    presence === "absent" ? "Ei enää löydy" : null,
  ].filter(Boolean);
  // A pending command is the first thing said about the row.
  const status = [pendingLabel, activityLabel, ...statusParts]
    .filter(Boolean)
    .join(" · ");
  const mark = pendingLabel
    ? "…"
    : attentionLabel
      ? "●"
      : activity
        ? (
            {
              working: "◌",
              waiting: "○",
              waiting_process: "○",
              waiting_spinoff: "○",
              closed: "✓",
              unknown: "–",
            } as const
          )[activity]
        : /työ|käynnissä|working/i.test(activityLabel)
          ? "◌"
          : /odot|waiting/i.test(activityLabel)
            ? "○"
            : /valmis|päättynyt|finished/i.test(activityLabel)
              ? "✓"
              : "–";
  return (
    <li
      className={`ah-agent-item${spinoffWorking ? " ah-waiting-spinoff" : ""}${pendingLabel ? " ah-pending-item" : ""}`}
      style={{ "--ah-depth": depth } as React.CSSProperties}
    >
      <ListRow
        className="ah-sidebar-agent-row"
        trailing={
          relativeTime || spinoffWorking ? (
            <>
              {relativeTime ? <time>{relativeTime}</time> : null}
              {spinoffWorking ? <SpinoffWorkingMark /> : null}
            </>
          ) : undefined
        }
      >
        <NavLink
          href={href}
          label={title}
          current={selected ? "page" : false}
          statusText={status || undefined}
          displayStatusText={mark}
          compactMark
          leading={
            worktree ? (
              <Icon
                name={worktree.merged ? "merge" : "worktree"}
                className={`ah-nav-worktree${worktree.merged ? " merged" : ""}`}
                aria-hidden="true"
              />
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
export function WorkspaceSection({
  name,
  href,
  expanded,
  selected = false,
  summary,
  mutationState,
  agents,
  actions = [],
  workspaceMenu,
  onToggle,
}: {
  workspaceId: string;
  name: string;
  href: string;
  expanded: boolean;
  selected?: boolean;
  summary?: string;
  mutationState?: string;
  agents: AgentNavModel[];
  actions?: Action[];
  workspaceMenu?: ReactNode;
  onToggle: () => void;
}) {
  const summaryId = useId();
  const [showFinished, setShowFinished] = useState(false);
  const active = agents
    .filter((agent) => !agent.finished)
    .sort((a, b) => (a.priority ?? 4) - (b.priority ?? 4));
  const finished = agents.filter((agent) => agent.finished);
  const expandedFinished =
    showFinished || finished.some((agent) => agent.selected);
  return (
    <section className="ah-workspace">
      <div
        className="ah-workspace-row"
        data-selected={selected || undefined}
        title={summary ? `${name} · ${summary}` : name}
      >
        <ListRow
          className="ah-sidebar-row"
          indicator={
            <ControlButton
              size="inline"
              aria-expanded={expanded}
              aria-label={`${expanded ? "Sulje" : "Avaa"} ${name}`}
              className="ah-workspace-toggle"
              variant="quiet"
              onPress={onToggle}
            >
              <span aria-hidden="true" className="ah-disclosure-chevron" />
            </ControlButton>
          }
          trailing={
            <>
              {mutationState ? (
                <StatusMark label={mutationState} tone="warning" />
              ) : null}
              {workspaceMenu}
            </>
          }
        >
          <LinkRow
            current={selected}
            kind="workspace"
            aria-describedby={summary ? summaryId : undefined}
            className="ah-workspace-link"
            href={href}
          >
            {name}
          </LinkRow>
        </ListRow>
        {summary ? (
          <span className="ah-visually-hidden" id={summaryId}>
            {summary}
          </span>
        ) : null}
      </div>
      {expanded ? (
        <>
          {agents.length ? (
            <ul>
              {active.map((agent) => (
                <AgentNavItem key={agent.agentId} {...agent} />
              ))}
              {finished.length ? (
                <li>
                  <ControlButton
                    size="inline"
                    className="ah-finished-toggle"
                    variant="quiet"
                    aria-expanded={expandedFinished}
                    onPress={() => setShowFinished(!expandedFinished)}
                  >
                    Valmiit {finished.length}
                  </ControlButton>
                </li>
              ) : null}
              {expandedFinished
                ? finished.map((agent) => (
                    <AgentNavItem key={agent.agentId} {...agent} />
                  ))
                : null}
            </ul>
          ) : (
            <p className="ah-workspace-empty">Ei keskusteluja.</p>
          )}
          {actions.length ? (
            <div className="ah-actions">
              {actions.map((action) => (
                <Button
                  key={action.label}
                  label={action.label}
                  size="row"
                  variant="quiet"
                  availability={action.availability}
                  onPress={action.onPress}
                />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
export function WorkspaceRail({
  collapsed,
  serverLabel,
  connectionLabel,
  connectionTone,
  attentionCount,
  homeCurrent = false,
  runningCount,
  filterValue,
  resultSummary,
  summaryAction,
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
  attentionCount?: number;
  homeCurrent?: boolean;
  runningCount?: number;
  filterValue: string;
  resultSummary: string;
  summaryAction?: ReactNode;
  onCreateWorkspace?: () => void;
  listState: AsyncState | "source-absent" | "filtered-empty";
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
          kind="home"
          current={homeCurrent}
          className="ah-rail-home"
        >
          <Icon name="home" />
          <span className="ah-rail-home-label">Etusivu</span>
          {runningCount !== undefined && runningCount > 0 ? (
            <Badge label={`${runningCount} käynnissä`} tone="info" />
          ) : null}
        </LinkRow>
        {attentionCount ? (
          <Badge label="Uutta" tone="warning" count={attentionCount} />
        ) : null}
        {collapsed ? null : (
          <>
            <div className="ah-rail-filter">
              <TextField
                className="ah-rail-search"
                value={filterValue}
                onChange={onFilter}
              >
                <Label className="ah-visually-hidden">Suodata työtiloja</Label>
                <Input placeholder="Suodata" />
              </TextField>
              {filterValue ? (
                <Button
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
            <div className="ah-rail-section-head">
              <strong>Työtilat</strong>
              {onCreateWorkspace ? (
                <ControlButton
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
            <div className="ah-rail-summary">
              <span role="status">{resultSummary}</span>
              {summaryAction}
            </div>
          </>
        )}
      </header>
      {collapsed ? null : (
        <div className="ah-rail-content">
          {clones}
          {listState === "loading" ? <p>Ladataan työtiloja…</p> : null}
          {listState === "empty" ? <p>Työtiloja ei ole.</p> : null}
          {listState === "filtered-empty" ? (
            <p>Hakua vastaavia kohteita ei ole.</p>
          ) : null}
          {listState === "source-absent" ? (
            <p>Työtilakansiota ei löydy.</p>
          ) : null}
          {listState === "error" || listState === "unknown" ? (
            <p>Työtiloja ei voitu näyttää.</p>
          ) : (
            children
          )}
          {listState === "error" || listState === "loading" ? null : archived}
        </div>
      )}
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
}) {
  const [show, setShow] = useState(false);
  if (!workspaces.length && !problem) return null;
  const open = show || workspaces.some((w) => w.selected);
  return (
    <section className="ah-rail-archived" aria-label="Arkistoidut työtilat">
      {workspaces.length ? (
        <ControlButton
          size="inline"
          className="ah-rail-group-toggle"
          variant="quiet"
          aria-expanded={open}
          onPress={() => setShow(!open)}
        >
          <span aria-hidden="true" className="ah-disclosure-chevron" />
          Arkistoidut
        </ControlButton>
      ) : null}
      {open && workspaces.length ? (
        <ul>
          {workspaces.map((w) => (
            <li key={w.id} className="ah-archived-row">
              <LinkRow
                current={w.selected}
                kind="workspace"
                className="ah-workspace-link"
                href={w.href}
              >
                {w.name}
              </LinkRow>
              <ControlButton
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
  activityLabel,
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
  archiveControl,
  settings,
  modelPicker,
  gitStatus,
  detailsFacts,
  detailsExtra,
}: {
  title: string;
  titleState?: string;
  activityLabel: string;
  activityControl?: ReactNode;
  activityAnimated?: boolean;
  activityKind?: StatusKind;
  controlKind?: StatusKind;
  controlLabel: string;
  workspaceLabel: string;
  workspaceHref: string;
  detailsExpanded: boolean;
  onToggleDetails: () => void;
  archiveControl?: ReactNode;
  archiveReason?: string;
  settings?: { model?: string; thinking?: string };
  modelPicker?: ReactNode;
  /** The workspace's Git status chip, beside the model (Yläpalkissa). */
  gitStatus?: ReactNode;
  detailsFacts?: { label: string; value: string; copy?: boolean }[];
  detailsExtra?: ReactNode;
  titleAction?: {
    label: string;
    availability?: Availability;
    pending?: boolean;
    failureNotice?: string;
    onPress: () => void;
  };
}) {
  const titleReasonId = useId();
  // An empty label means no state to show (for example while messages wait
  // for Pi to start); the header then carries no mark at all.
  const visibleActivity = !!activityLabel || !!activityControl;
  const visibleControl = controlKind === "read-only";
  return (
    <header className="ah-agent-header">
      <div className="ah-agent-topline">
        <div className="ah-title-row">
          <h1 title={title}>{title}</h1>
        </div>
        <LinkRow
          kind="header"
          className="ah-header-workspace"
          href={workspaceHref}
        >
          {workspaceLabel}
        </LinkRow>
        {visibleActivity
          ? (activityControl ?? (
              <StatusMark
                label={activityLabel}
                tone="info"
                animated={activityAnimated ? "running" : false}
                kind={activityKind}
              />
            ))
          : null}
        {visibleControl ? (
          <StatusMark label="Vain luku" tone="neutral" kind="read-only" />
        ) : null}
        {gitStatus}
        {modelPicker ??
          (settings?.model || settings?.thinking ? (
            <ControlButton
              size="inline"
              presentation="pill"
              className="ah-set-chip"
              aria-label="Malli ja ajattelutaso · avaa tiedot"
              title="Malli ja ajattelutaso · avaa tiedot"
              aria-expanded={detailsExpanded}
              onPress={onToggleDetails}
            >
              <span className="ah-set-model">
                {settings.model ?? "Malli ei tiedossa"}
              </span>
              <span className="ah-set-separator" aria-hidden="true">
                {" "}
                ·{" "}
              </span>
              <span>{settings.thinking ?? "Pi"}</span>
            </ControlButton>
          ) : null)}
        {titleAction ? (
          <ControlButton
            size="row"
            className="ah-topbar-icon ah-retitle"
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
            isDisabled={
              titleAction.availability?.state !== "enabled" ||
              titleAction.pending
            }
            onPress={titleAction.onPress}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M0.5 13.5 0.61 12.87 2.12 12.64 3.84 2.86 2.41 2.63 2.52 2H8L7.89 2.63L6.37 2.86L5.63 7.11H9.81L10.56 2.86L9.13 2.63L9.24 2H14.74L14.62 2.63L13.1 2.86L11.37 12.64L12.81 12.87L12.7 13.5H7.21L7.32 12.87L8.84 12.64L9.64 8.05H5.46L4.65 12.64L6.08 12.87L5.97 13.5Z"
              />
              <g
                className={titleAction.pending ? "ah-retitle-spin" : ""}
                transform="translate(12.5 12) scale(.5)"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" />
              </g>
            </svg>
          </ControlButton>
        ) : null}
        {titleAction?.availability && "reason" in titleAction.availability ? (
          <span id={titleReasonId} className="ah-visually-hidden">
            {titleAction.availability.reason}
          </span>
        ) : null}
        {archiveControl}
        <ControlButton
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
      </div>
      {titleState ? <StatusMark label={titleState} tone="info" /> : null}
      {titleAction?.failureNotice ? (
        <p className="ah-inline-error">{titleAction.failureNotice}</p>
      ) : null}
      {detailsExpanded ? (
        <section className="ah-details-popover" aria-label="Tiedot">
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
