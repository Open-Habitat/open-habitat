import { Fragment, useId, useRef } from "react";
import { useText } from "../i18n";
import { quietRailText } from "../text/quietRail";
import { sectionFilterText } from "../text/sectionFilter";
import { Segmented } from "./ControlElements";
import { Icon } from "./Icon";
import {
  AgentNavItem,
  type AgentNavModel,
  type RailArchive,
  type RailRename,
  type RailTurn,
} from "./Navigation";
import { useMinuteNow } from "./RecapCard";
import {
  keptDetail,
  NarrowedEmpty,
  PlaceMark,
  type SectionChoice,
  SectionCount,
  SectionFilterMenu,
  type SectionWorkspace,
  sectionView,
} from "./SectionFilter";
import type { WorkspaceCardActions } from "./WorkspaceIcon";
import "./QuietSection.css";

export type QuietSort = "newest" | "workspace" | "name";

/** The person's order and workspace for Hiljaiset, kept in their account
 * preferences so they follow the person to every device. */
export interface QuietChoice extends SectionChoice {
  sort: QuietSort;
  onSort?: (sort: QuietSort) => void;
}

export type QuietWorkspace = SectionWorkspace;

const byName = (a: AgentNavModel, b: AgentNavModel) =>
  a.title.localeCompare(b.title, "fi") ||
  (b.changedAt ?? 0) - (a.changedAt ?? 0);
// Display names need not be unique: the id keeps each workspace together.
const byWorkspace = (a: AgentNavModel, b: AgentNavModel) =>
  (a.workspaceName ?? "").localeCompare(b.workspaceName ?? "", "fi") ||
  (a.workspaceId ?? "").localeCompare(b.workspaceId ?? "") ||
  (b.changedAt ?? 0) - (a.changedAt ?? 0);

/** What Hiljaiset shows for a choice: the section's narrowing (sectionView)
 * in the chosen order. With one workspace chosen there is nothing to order
 * by workspace, so the list is newest first then and the stored order
 * returns with every workspace. */
export function quietView(
  rows: AgentNavModel[],
  choice: QuietChoice,
  /** The listed workspaces; without them only the rows' own count. */
  known?: readonly QuietWorkspace[],
) {
  const narrowed = sectionView(rows, choice.workspace, known);
  const sort =
    narrowed.workspace && choice.sort === "workspace" ? "newest" : choice.sort;
  // rows arrive newest first.
  const ordered =
    sort === "name"
      ? [...rows].sort(byName)
      : sort === "workspace"
        ? [...rows].sort(byWorkspace)
        : rows;
  return {
    ...sectionView(rows, choice.workspace, known, ordered),
    sort,
    sorts: (narrowed.workspace
      ? ["newest", "name"]
      : ["newest", "workspace", "name"]) as QuietSort[],
  };
}

/** Hiljaiset (rail-quiet-all-flat, Jari 1.11.2026): every listed
 * conversation that neither waits for the person nor runs, as one flat list
 * without workspace headings. The header's icon grid narrows it to one
 * workspace and orders it. Folded, it keeps the open conversation's row and
 * the workspaces as pills that open it narrowed to one. The open row is
 * ringed (round 5's Rengas); the rail draws no edge stripe. */
export function QuietSection({
  rows,
  workspaces,
  choice,
  folded = false,
  onFold,
  archive,
  rename,
  turn,
  card,
  workspaceNames = false,
}: {
  /** Every quiet conversation, newest first. */
  rows: AgentNavModel[];
  /** The listed workspaces, so a chosen one with nothing quiet stays chosen. */
  workspaces?: readonly QuietWorkspace[];
  choice: QuietChoice;
  /** Folded on this device. */
  folded?: boolean;
  onFold?: (folded: boolean) => void;
  archive?: RailArchive;
  rename?: RailRename;
  /** Raising a row to Sinun vuorosi; absent while the feature is off. */
  turn?: RailTurn;
  card?: WorkspaceCardActions;
  /** Every row names its workspace, icon or not (the adaptive rail). */
  workspaceNames?: boolean;
}) {
  const t = useText(quietRailText);
  const shared = useText(sectionFilterText);
  const headId = useId();
  const head = useRef<HTMLHeadingElement>(null);
  const now = useMinuteNow();
  const view = quietView(rows, choice, workspaces);
  const iconed = rows.some((r) => r.workspaceIcon);
  const ready = !choice.busy;
  const row = (agent: AgentNavModel) => (
    <AgentNavItem
      key={agent.agentId}
      {...agent}
      detail={keptDetail(agent, shared.kept)}
      workspaceTag={!iconed || workspaceNames}
      now={now}
      archive={archive}
      rename={rename}
      turn={turn}
      card={card}
    />
  );
  return (
    <section
      className={`ah-now ah-quiet${iconed ? " ah-now-iconed" : ""}`}
      data-testid="rail-quiet"
      data-folded={folded || undefined}
      // What a folded Hiljaiset out of sight hides (the rail's edge chips).
      data-rows={view.shown.length}
      aria-labelledby={headId}
    >
      <h2
        className={`ah-rail-section-head ${rows.length ? "ah-quiet-head" : "ah-section-filter-head"}`}
        ref={head}
      >
        {!rows.length ? (
          <span id={headId}>{t.title}</span>
        ) : (
          <button
            type="button"
            className="ah-quiet-fold"
            data-testid="rail-quiet-fold"
            aria-expanded={!folded}
            title={folded ? t.unfold : t.fold}
            onClick={() => onFold?.(!folded)}
            disabled={!onFold}
          >
            <Icon name="down" className="ah-quiet-chevron" aria-hidden="true" />
            <span id={headId}>{t.title}</span>
            <SectionCount
              testId="rail-quiet-count"
              view={view}
              total={rows.length}
            />
          </button>
        )}
        {!rows.length ? (
          <span
            className="ah-rail-empty"
            role="status"
            data-testid="rail-quiet-empty"
          >
            {t.empty}
          </span>
        ) : null}
        {!folded && rows.length ? (
          <SectionFilterMenu
            testId="rail-quiet"
            label={t.menu}
            head={head}
            view={view}
            total={rows.length}
            choice={choice}
            tag={
              view.sort !== "newest" ? (
                <span className="ah-quiet-tag" aria-hidden="true">
                  {t.sorts[view.sort]}
                </span>
              ) : null
            }
          >
            <Segmented
              data-testid="rail-quiet-sort"
              className="ah-quiet-sorts"
              label={t.order}
              options={view.sorts.map((id) => ({
                id,
                label: t.sorts[id],
              }))}
              value={view.sort}
              isDisabled={!ready || !choice.onSort}
              onChange={(sort) => {
                if (sort !== choice.sort) choice.onSort?.(sort);
              }}
            />
          </SectionFilterMenu>
        ) : null}
      </h2>
      {!folded ? (
        <NarrowedEmpty
          testId="rail-quiet"
          view={view}
          total={rows.length}
          choice={choice}
        />
      ) : null}
      {!rows.length ? null : folded ? (
        <>
          {view.open ? <ul>{row(view.open)}</ul> : null}
          <ul className="ah-quiet-pills" aria-label={t.pills}>
            {view.places.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="ah-quiet-pill"
                  data-testid={`rail-quiet-pill-${p.id}`}
                  aria-label={t.pill(p.name, p.count)}
                  title={t.pill(p.name, p.count)}
                  // Unfolding without the workspace would drop the choice.
                  disabled={!ready || !choice.onWorkspace}
                  onClick={() => {
                    onFold?.(false);
                    if (choice.workspace !== p.id) choice.onWorkspace?.(p.id);
                  }}
                >
                  <PlaceMark place={p} size="s" />
                  <span aria-hidden="true">{p.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : view.sort === "workspace" ? (
        // Grouped without headings: a thin gap between workspaces.
        <ul>
          {view.shown.map((agent, i) => (
            <Fragment key={agent.agentId}>
              {i > 0 &&
              !agent.kept &&
              agent.workspaceId !== view.shown[i - 1].workspaceId ? (
                <li className="ah-quiet-gap" aria-hidden="true" />
              ) : null}
              {row(agent)}
            </Fragment>
          ))}
        </ul>
      ) : (
        <ul>{view.shown.map(row)}</ul>
      )}
    </section>
  );
}
