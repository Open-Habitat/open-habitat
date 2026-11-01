import "./ViewPanel.css";
import { Menu, MenuTrigger, Popover, Switch } from "react-aria-components";
import { daysLabel, expiryChoices } from "../app/viewLinks";
import { formatDate, formatNumber, liveText } from "../i18n";
import { viewLinksText } from "../text/viewLinks";
import { viewOfferText } from "../text/viewOffer";
import { ControlButton, ControlMenuItem } from "./ControlElements";
import { Icon } from "./Icon";
import { CopyButton } from "./ViewLink";

const txt = liveText(viewOfferText);
const linkTxt = liveText(viewLinksText);

/** One frozen export an agent offered (contracts/v1/view.schema.json). */
export type ViewSummary = {
  view_id: string;
  title: string;
  entry: string;
  files: number;
  bytes: number;
  created_at: string;
  conversation_id?: string;
};

/** What the person's last press on this card did. A tab is only requested:
 * the browser may block it, and nothing reports back. */
export type ViewOfferState =
  | "idle"
  | "opening"
  | "open"
  | "tab_requested"
  | "failed";

/** Whether anyone with the view's address may open it, as far as the
 * person's address store knows (ADR 0035). */
export type ViewVisibility = {
  public: boolean;
  /** The end of the current publication, while public. */
  until?: string;
  /** The stable address Kopioi linkki copies, while public. */
  url?: string;
  maxDays: number;
  /** A write is on its way, or its outcome or the list is not known. */
  pending?: boolean;
  unknown?: boolean;
  onPublic: (on: boolean) => void;
  onDuration: (days: number) => void;
};

export function formatViewSize(bytes: number): string {
  if (bytes < 1024) return txt.bytes(bytes);
  if (bytes < 1024 * 1024) return txt.kilobytes(Math.round(bytes / 1024));
  return txt.megabytes(
    formatNumber(bytes / 1024 / 1024, { maximumFractionDigits: 1 }),
  );
}

/** A day of a publication's end, with the year only when it is not this
 * year's. */
export function formatUntil(iso: string | Date, now = new Date()): string {
  const date = new Date(iso);
  return formatDate(date, {
    day: "numeric",
    month: "numeric",
    ...(date.getFullYear() === now.getFullYear()
      ? {}
      : { year: "numeric" as const }),
  });
}

const day = 24 * 60 * 60 * 1000;

/** The publication's end as a control: it opens the lengths the site
 * allows, each with the day it would end. A choice applies at once and
 * counts from now (proto-view-offer-card-r3, riff A). */
function DurationMenu({ visibility }: { visibility: ViewVisibility }) {
  const until = visibility.until ?? "";
  const now = Date.now();
  const choices = expiryChoices(visibility.maxDays).map((days) => ({
    days,
    label:
      days === visibility.maxDays && days > 30
        ? linkTxt.atMost(daysLabel(days))
        : daysLabel(days),
    ends: formatUntil(new Date(now + days * day)),
  }));
  const current = choices.find((c) => c.ends === formatUntil(until));
  return (
    <MenuTrigger>
      <ControlButton
        size="row"
        variant="quiet"
        className="ah-view-offer-until"
        data-testid="view-public-until"
        title={txt.untilHint(formatUntil(until))}
        isPending={visibility.pending || visibility.unknown}
      >
        {txt.until(formatUntil(until))}
        <span aria-hidden="true" className="ah-menu-chevron" />
      </ControlButton>
      <Popover
        placement="bottom end"
        className="ah-popover ah-view-offer-durations"
      >
        <p className="ah-view-offer-durations-head">
          {txt.durationHead(formatUntil(until))}
        </p>
        <Menu
          aria-label={txt.duration}
          selectionMode="single"
          selectedKeys={current ? [String(current.days)] : []}
          onAction={(key) => visibility.onDuration(Number(key))}
        >
          {choices.map((c) => (
            <ControlMenuItem
              key={c.days}
              id={String(c.days)}
              data-testid={`view-duration-${c.days}`}
              textValue={c.label}
            >
              {({ isSelected }) => (
                <>
                  <span className="ah-choice-check" aria-hidden="true">
                    {isSelected ? "✓" : ""}
                  </span>
                  <span className="ah-view-offer-duration">{c.label}</span>
                  <span className="ah-view-offer-duration-ends">
                    {txt.until(c.ends)}
                  </span>
                </>
              )}
            </ControlMenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

/** The accepted card (proto-view-offer-card-r2 riff B, r3 riff A): the
 * title with the Julkinen switch at its right, and the view's own places
 * to open it. One press makes the view public; while it is, the card
 * offers its link and the date it stops. Agent text (the title) is data,
 * never markup or a link. */
export function ViewOfferCard({
  view,
  state = "idle",
  onOpen,
  onOpenTab,
  visibility,
  problem,
}: {
  view: ViewSummary;
  state?: ViewOfferState;
  /** Open in the panel; the pressed button receives focus back on close. */
  onOpen: (opener: HTMLElement | null) => void;
  onOpenTab: () => void;
  /** Absent where the site shares nothing publicly. */
  visibility?: ViewVisibility;
  /** Why the last change of visibility did not go through. */
  problem?: string;
}) {
  const shown = visibility?.public && !visibility.unknown;
  return (
    <aside
      className="ah-view-offer"
      role="note"
      aria-label={txt.label(view.title)}
      data-testid="view-offer"
      data-view-id={view.view_id}
      data-state={state}
      data-public={visibility ? String(!!visibility.public) : undefined}
    >
      <span className="ah-view-offer-mark" aria-hidden="true">
        {"</>"}
      </span>
      <div className="ah-view-offer-body">
        <div className="ah-view-offer-head">
          <strong className="ah-view-offer-title">{view.title}</strong>
          {visibility && (
            <span className="ah-view-offer-controls">
              {visibility.public && visibility.until && (
                <DurationMenu visibility={visibility} />
              )}
              <Switch
                className="ah-view-offer-switch"
                data-testid="view-public"
                isSelected={visibility.public}
                isReadOnly={visibility.pending || visibility.unknown}
                data-pending={visibility.pending || undefined}
                data-unknown={visibility.unknown || undefined}
                onChange={(on) => visibility.onPublic(on)}
              >
                <span
                  title={
                    visibility.unknown
                      ? txt.unknownHint
                      : visibility.public
                        ? txt.publicHint
                        : txt.privateHint
                  }
                >
                  {txt.public}
                </span>
                <span className="ah-view-offer-track" aria-hidden="true" />
              </Switch>
            </span>
          )}
        </div>
        <span className="ah-view-offer-actions">
          <ControlButton
            size="row"
            variant="primary"
            data-testid="view-open"
            isDisabled={state === "opening"}
            onPress={(event) =>
              onOpen(event.target instanceof HTMLElement ? event.target : null)
            }
          >
            {txt.open}
          </ControlButton>
          <ControlButton
            size="row"
            data-testid="view-open-tab"
            onPress={onOpenTab}
          >
            {txt.openTab} <Icon name="external" />
          </ControlButton>
          {shown && visibility?.url && (
            <CopyButton text={visibility.url} data-testid="view-copy-link" />
          )}
        </span>
        {state === "failed" ? (
          <span className="ah-view-offer-status" role="status">
            {txt.failed}
          </span>
        ) : null}
        {problem ? (
          <span className="ah-view-offer-status" role="status">
            {problem}
          </span>
        ) : null}
      </div>
    </aside>
  );
}
