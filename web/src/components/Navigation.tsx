import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Input, Label, TextField } from "react-aria-components";
import { useLocation } from "react-router";
import { ControlButton, ExternalLink, LinkRow } from "./ControlElements";
import { Icon } from "./Icon";
import { Button, ListRow, RefreshIconButton } from "./Primitives";
import type { StatusKind } from "./Status";
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
    <div className="ah-app-shell">
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
        <main id="main" tabIndex={-1} inert={drawerActive}>
          {rail ? (
            <div className="ah-mobile-toolbar">
              <ControlButton
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
              <LinkRow href="/workspaces" aria-label="Etusivu">
                <Icon name="home" />
              </LinkRow>
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
}: {
  label: string;
  href: string;
  current?: "page" | false;
  badgeText?: string;
  statusText?: string;
  displayStatusText?: string;
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
      <span className="ah-nav-label">{label}</span>
      {statusText ? (
        <span id={statusId}>
          {displayStatusText !== undefined ? (
            <>
              {displayStatusText ? (
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
              ) : null}
              <span className="ah-visually-hidden">{statusText}</span>
            </>
          ) : (
            <StatusMark label={statusText} tone="neutral" />
          )}
        </span>
      ) : null}
      {badgeText ? <Badge label={badgeText} tone="warning" /> : null}
    </LinkRow>
  );
}
export interface AgentNavModel {
  agentId: string;
  href: string;
  title: string;
  activityLabel: string;
  activityShortLabel?: string;
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
  activityShortLabel,
  controlLabel,
  attentionLabel,
  relativeTime,
  selected = false,
  depth = 0,
  presence = "present",
  stale = false,
}: AgentNavModel) {
  const statusParts = [
    controlLabel,
    stale ? "Tieto vanhentunut" : null,
    presence === "absent" ? "Ei enää löydy" : null,
  ].filter(Boolean);
  const status = [activityLabel, ...statusParts].filter(Boolean).join(" · ");
  return (
    <li
      className="ah-agent-item"
      style={{ "--ah-depth": depth } as React.CSSProperties}
    >
      <ListRow
        className="ah-sidebar-agent-row"
        trailing={relativeTime ? <time>{relativeTime}</time> : undefined}
      >
        <NavLink
          href={href}
          label={title}
          current={selected ? "page" : false}
          badgeText={attentionLabel}
          statusText={status || undefined}
          displayStatusText={
            stale || presence === "absent"
              ? stale
                ? "Tieto vanhentunut"
                : "Ei enää löydy"
              : controlLabel === "Ohjaus ei tiedossa" ||
                  controlLabel === "Ohjaus ei saatavilla"
                ? controlLabel
                : controlLabel === "Vain luku"
                  ? "vain luku"
                  : activityLabel === "Prosessi käynnissä"
                    ? "työssä"
                    : activityLabel === "Käynnissä terminaalissa"
                      ? "terminaalissa"
                      : activityShortLabel &&
                          activityShortLabel !== "Tila ei tiedossa"
                        ? activityShortLabel
                        : ""
          }
        />
      </ListRow>
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
      <div
        className="ah-workspace-row"
        data-selected={selected || undefined}
        title={summary ? `${name} · ${summary}` : name}
      >
        <ListRow
          className="ah-sidebar-row"
          indicator={
            <ControlButton
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
            mutationState ? (
              <StatusMark label={mutationState} tone="warning" />
            ) : undefined
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
  homeCurrent = false,
  runningCount,
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
  homeCurrent?: boolean;
  runningCount?: number;
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
      tabIndex={-1}
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
            label={collapsed ? "Avaa navigaatio" : "Sulje navigaatio"}
            icon={collapsed ? "forward" : "back"}
            variant="secondary"
            size="compact"
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
                <RefreshIconButton onPress={onRefresh} />
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
  activityKind = "neutral",
  controlKind = "neutral",
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
  activityKind?: StatusKind;
  controlKind?: StatusKind;
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
  const visibleActivity =
    activityLabel !== "Valmis" &&
    activityLabel !== "Odottaa viestiä" &&
    !(controlKind === "read-only" && activityKind === "unknown");
  const visibleControl = controlKind === "read-only";
  return (
    <header className="ah-agent-header">
      <div className="ah-agent-topline">
        <div className="ah-title-row">
          <h1 title={title}>{title}</h1>
          {titleAction?.availability?.state === "enabled" ? (
            <Button
              label={titleAction.label}
              ariaLabel={titleAction.label}
              variant="quiet"
              size="compact"
              pending={titleAction.pending}
              onPress={titleAction.onPress}
            />
          ) : null}
        </div>
        {visibleActivity ? (
          <StatusMark
            label={activityLabel}
            tone="info"
            animated={activityAnimated ? "running" : false}
            kind={activityKind}
          />
        ) : visibleControl ? (
          <StatusMark label="Vain luku" tone="neutral" kind="read-only" />
        ) : null}
        <ControlButton
          className="ah-details-toggle"
          aria-expanded={detailsExpanded}
          variant="quiet"
          onPress={onToggleDetails}
        >
          Tiedot <Icon name="down" />
        </ControlButton>
      </div>
      <LinkRow
        kind="header"
        className="ah-header-workspace"
        href={workspaceHref}
      >
        {workspaceLabel}
      </LinkRow>
      {titleState ? <StatusMark label={titleState} tone="info" /> : null}
      {titleAction?.failureNotice ? (
        <p className="ah-inline-error">{titleAction.failureNotice}</p>
      ) : null}
      {detailsExpanded ? (
        <div className="ah-header-facts">
          <p className="ah-header-full-title">{title}</p>
          <StatusMark label={controlLabel} tone="neutral" kind={controlKind} />
          {titleAction?.availability?.state !== "enabled" &&
          titleAction?.availability?.reason ? (
            <p className="ah-control-reason">
              {titleAction.availability.reason}
            </p>
          ) : null}
        </div>
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
