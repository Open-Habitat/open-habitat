import type { ReactNode, RefObject } from "react";
import { Dialog, DialogTrigger, Popover } from "react-aria-components";
import { useText } from "../i18n";
import { sectionFilterText } from "../text/sectionFilter";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import type { AgentNavModel } from "./Navigation";
import { WorkspaceIcon, type WorkspaceIconModel } from "./WorkspaceIcon";
import "./QuietSection.css";

/** The one workspace a rail section is narrowed to, kept in the person's
 * account preferences so it follows them to every device. Sinun vuorosi,
 * Käynnissä and Hiljaiset each keep their own. */
export interface SectionChoice {
  /** The one workspace the section is narrowed to; null for every one. */
  workspace: string | null;
  /** A choice is on its way to the account: the controls wait for it. */
  busy?: boolean;
  /** The last choice was not confirmed. */
  error?: boolean;
  /** Absent where the choice cannot be changed (no session, a story). */
  onWorkspace?: (workspaceId: string | null) => void;
}

export type SectionWorkspace = {
  id: string;
  name: string;
  icon?: WorkspaceIconModel;
};
export type Place = SectionWorkspace & { count: number };

/** What a section shows for its workspace. A workspace no longer listed
 * reads as every workspace; a listed one with nothing in the section right
 * now stays chosen, with its tile at zero. The open conversation stays in
 * sight when the narrowing would hide it: last, marked kept. */
export function sectionView(
  /** Every row of the section, in the section's own order. */
  rows: AgentNavModel[],
  chosen: string | null,
  /** The listed workspaces; without them only the rows' own count. */
  known?: readonly SectionWorkspace[],
  /** The rows in the order to show, when it differs from rows'. */
  ordered: AgentNavModel[] = rows,
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
  const listed =
    chosen && !places.has(chosen)
      ? known?.find((w) => w.id === chosen)
      : undefined;
  if (listed) places.set(listed.id, { ...listed, count: 0 });
  const workspace = chosen && places.has(chosen) ? chosen : null;
  const shown: AgentNavModel[] = workspace
    ? ordered.filter((r) => r.workspaceId === workspace)
    : [...ordered];
  const open = rows.find((r) => r.selected);
  if (open && !shown.includes(open)) shown.push({ ...open, kept: true });
  return {
    workspace,
    shown,
    open,
    /** The rows of the chosen workspace, the kept open row not counted. */
    count: shown.filter((r) => !r.kept).length,
    places: [...places.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "fi"),
    ),
  };
}
export type SectionView = ReturnType<typeof sectionView>;

/** A kept row says why it is shown. */
export function keptDetail(agent: AgentNavModel, kept: string) {
  return agent.kept
    ? [agent.detail, kept].filter(Boolean).join(" · ")
    : agent.detail;
}

/** A workspace's mark: its icon, or without icons its initials. */
export function PlaceMark({ place, size }: { place: Place; size: "s" | "m" }) {
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

/** The section heading's count: all of them, or shown of all while one
 * workspace is chosen. */
export function SectionCount({
  testId,
  view,
  total,
  className = "ah-rail-count",
}: {
  testId: string;
  view: SectionView;
  total: number;
  className?: string;
}) {
  const t = useText(sectionFilterText);
  if (!total) return null;
  return view.workspace ? (
    <span className={className} data-testid={testId} data-narrowed="true">
      <span aria-hidden="true">
        {view.count}/{total}
      </span>
      <span className="ah-visually-hidden">
        {t.narrowed(view.count, total)}
      </span>
    </span>
  ) : (
    <span className={className} data-testid={testId}>
      {total}
    </span>
  );
}

/** The heading's workspace filter (rail-quiet-all-flat's Ruudut menu): the
 * workspaces' stacked marks open a grid of tiles, Kaikki and one per
 * workspace with its count. Hiljaiset adds its order above the tiles. */
export function SectionFilterMenu({
  testId,
  label,
  head,
  view,
  total,
  choice,
  tag,
  children,
}: {
  /** The test id stem: `${testId}-menu`, `-dialog`, `-tile-…`, `-done`. */
  testId: string;
  label: string;
  /** The heading the popover lies under, as wide as the rail. */
  head: RefObject<HTMLElement | null>;
  view: SectionView;
  total: number;
  choice: SectionChoice;
  /** Beside the stack, such as Hiljaiset's order when not the default. */
  tag?: ReactNode;
  /** Above the tiles, such as Hiljaiset's order. */
  children?: ReactNode;
}) {
  const t = useText(sectionFilterText);
  const ready = !choice.busy;
  const stack = view.workspace
    ? view.places.filter((p) => p.id === view.workspace)
    : view.places.slice(0, 3);
  return (
    <DialogTrigger>
      <ControlButton
        data-testid={`${testId}-menu`}
        size="inline"
        variant="quiet"
        presentation="pill"
        className="ah-quiet-menu-button"
        data-narrowed={view.workspace ? true : undefined}
        aria-label={label}
        title={label}
      >
        <span className="ah-quiet-stack" aria-hidden="true">
          {stack.map((p) => (
            <PlaceMark key={p.id} place={p} size="s" />
          ))}
        </span>
        {tag}
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
          data-testid={`${testId}-dialog`}
          aria-label={label}
        >
          {({ close }) => (
            <>
              {children}
              <fieldset className="ah-quiet-tiles" aria-label={t.workspaces}>
                <button
                  type="button"
                  className="ah-quiet-tile"
                  data-testid={`${testId}-tile-all`}
                  aria-pressed={!view.workspace}
                  disabled={!ready || !choice.onWorkspace}
                  onClick={() => {
                    if (choice.workspace !== null) choice.onWorkspace?.(null);
                  }}
                >
                  <span className="ah-quiet-all" aria-hidden="true">
                    <Icon name="grid" />
                  </span>
                  <span className="ah-quiet-tile-name">{t.all}</span>
                  <span className="ah-quiet-tile-count">{total}</span>
                </button>
                {view.places.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="ah-quiet-tile"
                    data-testid={`${testId}-tile-${p.id}`}
                    aria-pressed={view.workspace === p.id}
                    title={p.name}
                    disabled={!ready || !choice.onWorkspace}
                    onClick={() => {
                      if (choice.workspace !== p.id) choice.onWorkspace?.(p.id);
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
                  <p role="alert" data-testid={`${testId}-error`}>
                    {t.notSaved}
                  </p>
                ) : null}
                <ControlButton
                  data-testid={`${testId}-done`}
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
  );
}

/** A section narrowed to a workspace with nothing in it right now says so
 * and offers every workspace back, rather than looking empty. */
export function NarrowedEmpty({
  testId,
  view,
  total,
  choice,
}: {
  testId: string;
  view: SectionView;
  total: number;
  choice: SectionChoice;
}) {
  const t = useText(sectionFilterText);
  const place = view.places.find((p) => p.id === view.workspace);
  if (!place || view.count) return null;
  return (
    <p className="ah-now-empty ah-section-narrowed-empty">
      <span>{t.emptyNarrowed(place.name)}</span>{" "}
      <button
        type="button"
        className="ah-section-show-all"
        data-testid={`${testId}-show-all`}
        disabled={!!choice.busy || !choice.onWorkspace}
        onClick={() => choice.onWorkspace?.(null)}
      >
        {t.showAll(total)}
      </button>
    </p>
  );
}
