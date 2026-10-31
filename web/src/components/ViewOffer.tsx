import "./ViewPanel.css";
import { formatDate, formatNumber, liveText } from "../i18n";
import { viewOfferText } from "../text/viewOffer";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";

const txt = liveText(viewOfferText);

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

export function formatViewSize(bytes: number): string {
  if (bytes < 1024) return txt.bytes(bytes);
  if (bytes < 1024 * 1024) return txt.kilobytes(Math.round(bytes / 1024));
  return txt.megabytes(
    formatNumber(bytes / 1024 / 1024, { maximumFractionDigits: 1 }),
  );
}

/** Suora (agent-html-artifacts, round 2): every offer has both places, the
 * panel beside the conversation and an own browser tab, chosen per press.
 * Agent text (the title) is data, never markup or a link. */
export function ViewOfferCard({
  view,
  state = "idle",
  onOpen,
  onOpenTab,
  onShare,
  sharedUntil,
}: {
  view: ViewSummary;
  state?: ViewOfferState;
  /** Open in the panel; the pressed button receives focus back on close. */
  onOpen: (opener: HTMLElement | null) => void;
  onOpenTab: () => void;
  /** Jaa linkillä (ADR 0033); absent where the site offers no links. */
  onShare?: () => void;
  /** The expiry of the link that shows this view, when there is one. */
  sharedUntil?: string;
}) {
  return (
    <aside
      className="ah-view-offer"
      role="note"
      aria-label={txt.label(view.title)}
      data-testid="view-offer"
      data-view-id={view.view_id}
      data-state={state}
    >
      <span className="ah-view-offer-mark" aria-hidden="true">
        {"</>"}
      </span>
      <div className="ah-view-offer-body">
        <span className="ah-view-offer-label">{txt.offers}</span>
        <strong className="ah-view-offer-title">{view.title}</strong>
        <span className="ah-view-offer-meta">
          {txt.frozen} · {txt.files(view.files)} · {formatViewSize(view.bytes)}{" "}
          ·{" "}
          {sharedUntil ? (
            <span data-testid="view-shared">
              {txt.sharedUntil(
                formatDate(new Date(sharedUntil), { dateStyle: "short" }),
              )}
            </span>
          ) : (
            txt.onlyYou
          )}
        </span>
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
          {onShare && (
            <ControlButton
              size="row"
              data-testid="view-share"
              onPress={onShare}
            >
              <Icon name="link" /> {txt.share}
            </ControlButton>
          )}
        </span>
        {state === "tab_requested" || state === "failed" ? (
          <span className="ah-view-offer-status" role="status">
            {state === "tab_requested" ? txt.tabRequested : txt.failed}
          </span>
        ) : null}
      </div>
    </aside>
  );
}
