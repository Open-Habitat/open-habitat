import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button, SearchField } from "./Primitives";
import { Badge, StatusMark } from "./Status";
import type { Action, AsyncState, Availability } from "./types";

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
  return (
    <div className="ah-app-shell">
      <a className="ah-skip" href="#main">
        Siirry keskusteluun
      </a>
      {connection}
      <div className="ah-shell-body">
        {rail}
        <main id="main" tabIndex={-1}>
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
        statusText={status}
      />
      {relativeTime ? <time>{relativeTime}</time> : null}
    </li>
  );
}
export function WorkspaceSection({
  name,
  href,
  expanded,
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
  summary?: string;
  mutationState?: string;
  agents: AgentNavModel[];
  actions?: Action[];
  onToggle: () => void;
}) {
  return (
    <section className="ah-workspace">
      <header>
        <button
          aria-expanded={expanded}
          aria-label={`${expanded ? "Sulje" : "Avaa"} ${name}`}
          type="button"
          onClick={onToggle}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <Link to={href}>{name}</Link>
      </header>
      {summary ? <p>{summary}</p> : null}
      {mutationState ? (
        <StatusMark label={mutationState} tone="warning" />
      ) : null}
      {expanded ? (
        <>
          <ul>
            {agents.map((agent) => (
              <AgentNavItem key={agent.agentId} {...agent} />
            ))}
          </ul>
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
  attentionCount,
  filterValue,
  resultSummary,
  listState,
  children,
  createAvailability,
  onToggle,
  onFilter,
  onRefresh,
  onCreate,
}: {
  collapsed: boolean;
  serverLabel: string;
  connectionLabel: string;
  attentionCount?: number;
  filterValue: string;
  resultSummary: string;
  listState: AsyncState | "source-absent" | "filtered-empty";
  children?: ReactNode;
  createAvailability?: Availability;
  onToggle: () => void;
  onFilter: (value: string) => void;
  onRefresh: () => void;
  onCreate: () => void;
}) {
  return (
    <nav
      aria-label="Workspacet ja agentit"
      className={collapsed ? "ah-rail ah-rail-collapsed" : "ah-rail"}
    >
      <header>
        <strong>{collapsed ? "NAH" : serverLabel}</strong>
        <Button
          ariaLabel={collapsed ? "Avaa navigaatio" : "Sulje navigaatio"}
          label={collapsed ? "Avaa" : "Sulje"}
          variant="quiet"
          size="compact"
          onPress={onToggle}
        />
      </header>
      <StatusMark
        label={connectionLabel}
        tone={listState === "stale" ? "warning" : "neutral"}
      />
      {attentionCount ? (
        <p>
          <Badge
            label="Odottaa vastaustasi"
            tone="warning"
            count={attentionCount}
          />
        </p>
      ) : null}
      {collapsed ? null : (
        <>
          <SearchField
            label="Suodata workspaceja ja agentteja"
            value={filterValue}
            resultSummary={resultSummary}
            onChange={onFilter}
            onClear={() => onFilter("")}
          />
          <div className="ah-rail-content">
            {listState === "loading" ? <p>Ladataan workspaceja…</p> : null}
            {listState === "empty" ? <p>Workspaceja ei ole.</p> : null}
            {listState === "filtered-empty" ? (
              <p>Hakua vastaavia kohteita ei ole.</p>
            ) : null}
            {listState === "source-absent" ? (
              <p>Lähdettä ei löydy. Tätä ei tulkita tyhjäksi listaksi.</p>
            ) : null}
            {listState === "error" || listState === "unknown" ? (
              <p>Workspacejen tilaa ei saatu.</p>
            ) : (
              children
            )}
          </div>
          <div className="ah-actions">
            <Button
              label="Uusi workspace"
              availability={createAvailability}
              onPress={onCreate}
            />
            <Button label="Päivitä" variant="secondary" onPress={onRefresh} />
          </div>
        </>
      )}
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
  return (
    <header className="ah-agent-header">
      <p>
        <Link to={workspaceHref}>{workspaceLabel}</Link>
      </p>
      <div className="ah-title-row">
        <h1>{title}</h1>
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
      {titleState ? <StatusMark label={titleState} tone="info" /> : null}
      <p className="ah-actions">
        <StatusMark
          label={activityLabel}
          tone="info"
          animated={activityAnimated ? "running" : false}
        />
        <StatusMark label={controlLabel} tone="neutral" />
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
