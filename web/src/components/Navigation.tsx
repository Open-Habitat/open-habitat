import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Input, Label, TextField } from "react-aria-components";
import { Link, useLocation } from "react-router";
import { Button } from "./Primitives";
import { Badge, StatusMark } from "./Status";
import type { Action, AsyncState, Availability, Tone } from "./types";

export function AppShell({
  connection,
  rail,
  main,
  overlays,
  toast,
}: {
  connection?: ReactNode;
  rail?: ReactNode;
  main: ReactNode;
  overlays?: ReactNode;
  toast?: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    if (location.key) setMobileOpen(false);
  }, [location.key]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        mobileTrigger.current?.focus();
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [mobileOpen]);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const closeMobile = () => {
    setMobileOpen(false);
    requestAnimationFrame(() => mobileTrigger.current?.focus());
  };
  return (
    <div className="ah-app-shell">
      {/* biome-ignore lint/a11y/useValidAnchor: same-page skip link also focuses the tabIndex=-1 target. */}
      <a
        className="ah-skip"
        href="#main"
        onClick={() => document.getElementById("main")?.focus()}
      >
        Siirry sisältöön
      </a>
      {connection}
      <div
        className={`ah-shell-body${rail ? "" : " ah-shell-no-rail"}${mobileOpen ? " ah-mobile-open" : ""}`}
      >
        {mobileOpen ? (
          <button
            type="button"
            className="ah-mobile-scrim"
            aria-label="Sulje navigaatio"
            onClick={closeMobile}
          />
        ) : null}
        <div className="ah-rail-slot">{rail}</div>
        <main id="main" tabIndex={-1}>
          {rail ? (
            <div className="ah-mobile-toolbar">
              <button
                type="button"
                ref={mobileTrigger}
                aria-label="Avaa navigaatio"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
              >
                <Icon name="menu" />
              </button>
              <Link to="/workspaces" aria-label="Etusivu">
                <Icon name="home" />
              </Link>
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
}: {
  label: string;
  href: string;
  current?: "page" | false;
  badgeText?: string;
  statusText?: string;
}) {
  return (
    <Link aria-current={current} className="ah-nav-link" to={href}>
      <span className="ah-nav-label">{label}</span>
      {statusText ? <small>{statusText}</small> : null}
      {badgeText ? <Badge label={badgeText} tone="warning" /> : null}
    </Link>
  );
}
export interface AgentNavModel {
  agentId: string;
  href: string;
  title: string;
  activityLabel: string;
  controlLabel: string;
  attentionLabel?: string;
  relativeTime?: string;
  selected?: boolean;
  depth?: number;
  presence?: "present" | "absent";
  stale?: boolean;
}
export function AgentNavItem({
  href,
  title,
  activityLabel,
  controlLabel,
  attentionLabel,
  relativeTime,
  selected = false,
  depth = 0,
  presence = "present",
  stale = false,
}: AgentNavModel) {
  const status = [
    activityLabel,
    controlLabel,
    stale ? "Tieto vanhentunut" : null,
    presence === "absent" ? "Ei enää löydy" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li
      className="ah-agent-item"
      style={{ "--ah-depth": depth } as React.CSSProperties}
    >
      <NavLink
        href={href}
        label={title}
        current={selected ? "page" : false}
        badgeText={attentionLabel}
        statusText={status || undefined}
      />
      {relativeTime ? <time>{relativeTime}</time> : null}
    </li>
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
  onToggle: () => void;
}) {
  const summaryId = useId();
  return (
    <section className="ah-workspace">
      <div className="ah-workspace-row" data-selected={selected || undefined}>
        <button
          aria-expanded={expanded}
          aria-label={`${expanded ? "Sulje" : "Avaa"} ${name}`}
          className="ah-workspace-toggle"
          type="button"
          onClick={onToggle}
        >
          <span aria-hidden="true" className="ah-disclosure-chevron" />
        </button>
        <Link
          aria-current={selected ? "page" : undefined}
          aria-describedby={summary ? summaryId : undefined}
          className="ah-workspace-link"
          title={summary ? `${name} · ${summary}` : name}
          to={href}
        >
          {name}
        </Link>
        {mutationState ? (
          <StatusMark label={mutationState} tone="warning" />
        ) : null}
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
              {agents.map((agent) => (
                <AgentNavItem key={agent.agentId} {...agent} />
              ))}
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
                  size="compact"
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
  filterValue,
  resultSummary,
  summaryAction,
  listState,
  children,
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
  filterValue: string;
  resultSummary: string;
  summaryAction?: ReactNode;
  listState: AsyncState | "source-absent" | "filtered-empty";
  children?: ReactNode;
  sessionActions?: ReactNode;
  onToggle: () => void;
  onFilter: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <nav
      aria-label="Työtilat ja keskustelut"
      className={collapsed ? "ah-rail ah-rail-collapsed" : "ah-rail"}
    >
      <header className="ah-rail-head">
        <div className="ah-rail-title">
          <strong title={serverLabel}>{collapsed ? "NAH" : serverLabel}</strong>
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
            label={collapsed ? "›" : "‹"}
            variant="secondary"
            size="compact"
            onPress={onToggle}
          />
        </div>
        {attentionCount ? (
          <Badge
            label="Odottaa vastaustasi"
            tone="warning"
            count={attentionCount}
          />
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
                  size="compact"
                  onPress={() => onFilter("")}
                />
              ) : null}
              <span className="ah-rail-refresh">
                <Button
                  label="Päivitä"
                  variant="secondary"
                  size="compact"
                  onPress={onRefresh}
                />
              </span>
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
        </div>
      )}
      {sessionActions ? (
        <footer className="ah-rail-foot">{sessionActions}</footer>
      ) : null}
    </nav>
  );
}
export function AgentHeader({
  title,
  titleState,
  activityLabel,
  activityAnimated = false,
  controlLabel,
  workspaceLabel,
  workspaceHref,
  detailsExpanded,
  onToggleDetails,
  titleAction,
}: {
  title: string;
  titleState?: string;
  activityLabel: string;
  activityAnimated?: boolean;
  controlLabel: string;
  workspaceLabel: string;
  workspaceHref: string;
  detailsExpanded: boolean;
  onToggleDetails: () => void;
  titleAction?: {
    label: string;
    availability?: Availability;
    pending?: boolean;
    failureNotice?: string;
    onPress: () => void;
  };
}) {
  const [expandedTitle, setExpandedTitle] = useState(false);
  const [previousTitle, setPreviousTitle] = useState(title);
  if (previousTitle !== title) {
    setPreviousTitle(title);
    setExpandedTitle(false);
  }
  return (
    <header className="ah-agent-header">
      <p>
        <Link to={workspaceHref}>{workspaceLabel}</Link>
      </p>
      <div className="ah-title-row">
        <h1
          className={expandedTitle ? "ah-title-expanded" : undefined}
          title={title}
        >
          {title}
        </h1>
        {titleAction ? (
          <Button
            label={titleAction.label}
            ariaLabel={titleAction.label}
            variant="quiet"
            size="compact"
            pending={titleAction.pending}
            availability={titleAction.availability}
            onPress={titleAction.onPress}
          />
        ) : null}
      </div>
      {title.length > 65 ? (
        <button
          className="ah-title-toggle"
          type="button"
          aria-expanded={expandedTitle}
          onClick={() => setExpandedTitle(!expandedTitle)}
        >
          {expandedTitle ? "Tiivistä otsikko" : "Näytä koko otsikko"}
        </button>
      ) : null}
      {titleState ? <StatusMark label={titleState} tone="info" /> : null}
      <p className="ah-actions">
        <StatusMark
          label={activityLabel}
          tone="info"
          animated={activityAnimated ? "running" : false}
          kind={
            activityAnimated
              ? "working"
              : activityLabel.includes("tiedossa")
                ? "unknown"
                : "neutral"
          }
        />
        <StatusMark
          label={controlLabel}
          tone="neutral"
          kind={
            controlLabel.includes("käytettävissä") ? "read-only" : "neutral"
          }
        />
      </p>
      {titleAction?.failureNotice ? (
        <p className="ah-inline-error">{titleAction.failureNotice}</p>
      ) : null}
      <button
        aria-expanded={detailsExpanded}
        type="button"
        onClick={onToggleDetails}
      >
        Lisätiedot
      </button>
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
