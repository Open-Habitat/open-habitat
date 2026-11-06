import { Fragment, useId, useRef } from "react";
import { Dialog, DialogTrigger, Popover } from "react-aria-components";
import { useText } from "../i18n";
import { quietRailText } from "../text/quietRail";
import { ControlButton, Segmented } from "./ControlElements";
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
  type WorkspaceCardActions,
  WorkspaceIcon,
  type WorkspaceIconModel,
} from "./WorkspaceIcon";
import "./QuietSection.css";

export type QuietSort = "newest" | "workspace" | "name";

/** The person's order and workspace for Hiljaiset, kept in their account
 * preferences so they follow the person to every device. */
export interface QuietChoice {
  sort: QuietSort;
  /** The one workspace Hiljaiset is narrowed to; null for every one. */
  workspace: string | null;
  /** A choice is on its way to the account: the controls wait for it. */
  busy?: boolean;
  /** The last choice was not confirmed. */
  error?: boolean;
  /** Absent where the choice cannot be changed (no session, a story). */
  onSort?: (sort: QuietSort) => void;
  onWorkspace?: (workspaceId: string | null) => void;
}

export type QuietWorkspace = {
  id: string;
  name: string;
  icon?: WorkspaceIconModel;
};
type Place = QuietWorkspace & { count: number };

const byName = (a: AgentNavModel, b: AgentNavModel) =>
  a.title.localeCompare(b.title, "fi") ||
  (b.changedAt ?? 0) - (a.changedAt ?? 0);
// Display names need not be unique: the id keeps each workspace together.
const byWorkspace = (a: AgentNavModel, b: AgentNavModel) =>
  (a.workspaceName ?? "").localeCompare(b.workspaceName ?? "", "fi") ||
  (a.workspaceId ?? "").localeCompare(b.workspaceId ?? "") ||
  (b.changedAt ?? 0) - (a.changedAt ?? 0);

/** What Hiljaiset shows for a choice. With one workspace chosen there is
 * nothing to order by workspace, so the list is newest first then and the
 * stored order returns with every workspace. A workspace no longer listed
 * reads as every workspace; a listed one with no quiet conversation right
 * now stays chosen, with its tile at zero. The open conversation stays in
 * sight when the narrowing would hide it: last, marked kept. */
export function quietView(
  rows: AgentNavModel[],
  choice: QuietChoice,
  /** The listed workspaces; without them only the rows' own count. */
  known?: readonly QuietWorkspace[],
) {
  const places = new Map<string, Place>();
  for (const row of rows) {
    const id = row.workspaceId ?? "";
    const place = places.get(id) ?? {
      id,
      name: row.workspaceName ?? "",
      icon: row.workspaceIcon,
      count: 0,
    };
    place.count++;
    places.set(id, place);
  }
  const chosen =
    choice.workspace && !places.has(choice.workspace)
      ? known?.find((w) => w.id === choice.workspace)
      : undefined;
  if (chosen) places.set(chosen.id, { ...chosen, count: 0 });
  const workspace =
    choice.workspace && places.has(choice.workspace) ? choice.workspace : null;
  const sort =
    workspace && choice.sort === "workspace" ? "newest" : choice.sort;
  // rows arrive newest first.
  const ordered =
    sort === "name"
      ? [...rows].sort(byName)
      : sort === "workspace"
        ? [...rows].sort(byWorkspace)
        : rows;
  const shown: AgentNavModel[] = workspace
    ? ordered.filter((r) => r.workspaceId === workspace)
    : [...ordered];
  const open = rows.find((r) => r.selected);
  if (open && !shown.includes(open)) shown.push({ ...open, kept: true });
  return {
    workspace,
    sort,
    sorts: (workspace
      ? ["newest", "name"]
      : ["newest", "workspace", "name"]) as QuietSort[],
    shown,
    open,
    places: [...places.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "fi"),
    ),
  };
}

/** A workspace's mark: its icon, or without icons its initials. */
function PlaceMark({ place, size }: { place: Place; size: "s" | "m" }) {
  return place.icon ? (
    <WorkspaceIcon icon={place.icon} size={size} />
  ) : (
    <span className="ah-quiet-letters" data-size={size} aria-hidden="true">
      {initials(place.name)}
    </span>
  );
}
function initials(name: string) {
  const parts = name.split(/[-_.\s]+/).filter(Boolean);
  return (parts.length > 1 ? parts.map((p) => p[0]).join("") : name)
    .slice(0, 2)
    .toLocaleUpperCase("fi");
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
}) {
  const t = useText(quietRailText);
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
      detail={
        agent.kept
          ? [agent.detail, t.kept].filter(Boolean).join(" · ")
          : agent.detail
      }
      workspaceTag={!iconed}
      now={now}
      archive={archive}
      rename={rename}
      turn={turn}
      card={card}
    />
  );
  const shownCount = view.shown.filter((r) => !r.kept).length;
  const stack = view.workspace
    ? view.places.filter((p) => p.id === view.workspace)
    : view.places.slice(0, 3);
  return (
    <section
      className={`ah-now ah-quiet${iconed ? " ah-now-iconed" : ""}`}
      data-testid="rail-quiet"
      data-folded={folded || undefined}
      aria-labelledby={headId}
    >
      <h2 className="ah-rail-section-head ah-quiet-head" ref={head}>
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
          {rows.length ? (
            view.workspace ? (
              <span className="ah-rail-count" data-testid="rail-quiet-count">
                <span aria-hidden="true">
                  {shownCount}/{rows.length}
                </span>
                <span className="ah-visually-hidden">
                  {t.narrowed(shownCount, rows.length)}
                </span>
              </span>
            ) : (
              <span className="ah-rail-count" data-testid="rail-quiet-count">
                {rows.length}
              </span>
            )
          ) : null}
        </button>
        {!folded && rows.length ? (
          <DialogTrigger>
            <ControlButton
              data-testid="rail-quiet-menu"
              size="inline"
              variant="quiet"
              presentation="pill"
              className="ah-quiet-menu-button"
              data-narrowed={view.workspace ? true : undefined}
              aria-label={t.menu}
              title={t.menu}
            >
              <span className="ah-quiet-stack" aria-hidden="true">
                {stack.map((p) => (
                  <PlaceMark key={p.id} place={p} size="s" />
                ))}
              </span>
              {view.sort !== "newest" ? (
                <span className="ah-quiet-tag" aria-hidden="true">
                  {t.sorts[view.sort]}
                </span>
              ) : null}
              <Icon name="down" className="ah-quiet-caret" aria-hidden="true" />
            </ControlButton>
            <Popover
              triggerRef={head}
              placement="bottom"
              offset={2}
              className="ah-popover ah-quiet-popover"
            >
              <Dialog
                className="ah-quiet-menu"
                data-testid="rail-quiet-dialog"
                aria-label={t.menu}
              >
                {({ close }) => (
                  <>
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
                    <fieldset
                      className="ah-quiet-tiles"
                      aria-label={t.workspaces}
                    >
                      <button
                        type="button"
                        className="ah-quiet-tile"
                        data-testid="rail-quiet-tile-all"
                        aria-pressed={!view.workspace}
                        disabled={!ready || !choice.onWorkspace}
                        onClick={() => {
                          if (choice.workspace !== null)
                            choice.onWorkspace?.(null);
                        }}
                      >
                        <span className="ah-quiet-all" aria-hidden="true">
                          <Icon name="grid" />
                        </span>
                        <span className="ah-quiet-tile-name">{t.all}</span>
                        <span className="ah-quiet-tile-count">
                          {rows.length}
                        </span>
                      </button>
                      {view.places.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="ah-quiet-tile"
                          data-testid={`rail-quiet-tile-${p.id}`}
                          aria-pressed={view.workspace === p.id}
                          title={p.name}
                          disabled={!ready || !choice.onWorkspace}
                          onClick={() => {
                            if (choice.workspace !== p.id)
                              choice.onWorkspace?.(p.id);
                          }}
                        >
                          <PlaceMark place={p} size="m" />
                          <span className="ah-quiet-tile-name">{p.name}</span>
                          <span className="ah-quiet-tile-count">{p.count}</span>
                        </button>
                      ))}
                    </fieldset>
                    <div className="ah-quiet-foot">
                      {choice.error ? (
                        <p role="alert" data-testid="rail-quiet-error">
                          {t.notSaved}
                        </p>
                      ) : null}
                      <ControlButton
                        data-testid="rail-quiet-done"
                        size="inline"
                        variant="secondary"
                        onPress={close}
                      >
                        {t.done}
                      </ControlButton>
                    </div>
                  </>
                )}
              </Dialog>
            </Popover>
          </DialogTrigger>
        ) : null}
      </h2>
      {!rows.length ? (
        <p className="ah-now-empty">{t.empty}</p>
      ) : folded ? (
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
