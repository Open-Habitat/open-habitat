import "./ViewPanel.css";
import type { Ref } from "react";
import { viewZipURL } from "../app/views";
import { formatDate, formatNumber, liveText } from "../i18n";
import { fileOfferText } from "../text/fileOffer";
import { offerCardText } from "../text/offerCard";
import { viewOfferText } from "../text/viewOffer";
import { OfferActions, OfferCard, type OfferDownload } from "./OfferCard";

const txt = liveText(viewOfferText);
const cardTxt = liveText(offerCardText);
const fileTxt = liveText(fileOfferText);

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

/** Where a view downloads: its frozen files as one zip. */
export function viewDownload(view: ViewSummary): OfferDownload {
  const name = view.title.replace(/[/\\:*?"<>|\p{Cc}]/gu, "_").trim();
  return {
    href: viewZipURL(view.view_id),
    name: `${name || "view"}.zip`,
    label: cardTxt.downloadZip,
  };
}

/** A view's facts on its card, in the list and in the panel. */
export function viewFacts(view: ViewSummary): string[] {
  return [
    cardTxt.view,
    ...(view.files > 1
      ? [fileTxt.files(view.files, formatNumber(view.files))]
      : []),
    formatViewSize(view.bytes),
  ];
}

/** One view offer in the conversation, on the one offer card
 * (proto-offer-cards-consistent). Agent text (the title) is data, never
 * markup or a link. */
export function ViewOfferCard({
  view,
  state = "idle",
  open = false,
  onToggle,
  onOpenTab,
  visibility,
  problem,
  hitRef,
}: {
  view: ViewSummary;
  state?: ViewOfferState;
  open?: boolean;
  /** Open in the panel, or close it when it is the open one; the pressed
   * card receives focus back on close. */
  onToggle: (opener: HTMLElement | null) => void;
  onOpenTab: () => void;
  /** Absent where the site shares nothing publicly. */
  visibility?: ViewVisibility;
  /** Why the last change of visibility did not go through. */
  problem?: string;
  hitRef?: Ref<HTMLButtonElement>;
}) {
  const shown = visibility?.public && !visibility.unknown;
  return (
    <OfferCard
      data-testid="view-offer"
      data-view-id={view.view_id}
      data-state={state}
      data-public={visibility ? String(!!visibility.public) : undefined}
      aria-label={txt.label(view.title)}
      kind="view"
      title={view.title}
      facts={viewFacts(view)}
      until={shown ? visibility?.until : undefined}
      open={open}
      onToggle={onToggle}
      hitRef={hitRef}
      actions={
        <OfferActions
          label={view.title}
          publish={visibility}
          onTab={onOpenTab}
          download={viewDownload(view)}
        />
      }
      status={
        state === "failed" || problem ? (
          <span className="ah-offer-facts" role="status">
            {state === "failed" ? txt.failed : problem}
          </span>
        ) : null
      }
    />
  );
}
