import "./FileOffer.css";
import type { Ref } from "react";
import {
  downloadURL,
  type FileKind,
  type FileOfferItem,
  type FileOfferManifest,
  type FileOfferSummary,
  type OfferState,
  thumbnailURL,
  zipName,
  zipURL,
} from "../app/fileOffers";
import { formatNumber, liveText } from "../i18n";
import { fileOfferText, type KindText } from "../text/fileOffer";
import { offerCardText } from "../text/offerCard";
import { ImageThumbnail } from "./ImageThumbnail";
import {
  OfferActions,
  OfferCard,
  type OfferDownload,
  type OfferKind,
} from "./OfferCard";

// Agent file offers on the one offer card (proto-offer-cards-consistent):
// a file, a table, an image, a document or a folder opens beside the
// conversation like a view. File names, titles and folders are agent data,
// shown as text, never markup.

const txt = liveText(fileOfferText);
const cardTxt = liveText(offerCardText);

const kindText = (kind: FileKind): KindText => txt.kinds[kind];

const extension = (path: string) => /\.([^./]{1,12})$/.exec(path)?.[1] ?? "";
const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const number = (n: number) => formatNumber(n);

export function formatOfferSize(bytes: number): string {
  const one = (n: number) => formatNumber(n, { maximumFractionDigits: 1 });
  if (bytes < 1024) return txt.bytes(bytes);
  if (bytes < 1024 * 1024) return txt.kilobytes(Math.round(bytes / 1024));
  if (bytes < 1024 * 1024 * 1024)
    return txt.megabytes(one(bytes / 1024 / 1024));
  return txt.gigabytes(one(bytes / 1024 / 1024 / 1024));
}

/** The facts line of one file: type, what is known of its content, size. */
export function fileFacts(item: FileOfferItem): string[] {
  const ext = extension(item.path);
  const facts = [kindText(item.kind).type(ext.toUpperCase() || "?")];
  if (item.kind === "file" && ext) facts.push(`.${ext}`);
  if (item.width && item.height)
    facts.push(`${number(item.width)} × ${number(item.height)}`);
  if (item.kind === "csv" && item.lines) {
    facts.push(txt.rows(number(Math.max(item.lines - 1, 0))));
    if (item.columns) facts.push(txt.columns(number(item.columns)));
  } else if (item.lines) facts.push(txt.rows(number(item.lines)));
  if (item.archive)
    facts.push(
      txt.files(item.archive.entries, number(item.archive.entries)),
      txt.unpacked(formatOfferSize(item.archive.bytes)),
    );
  facts.push(formatOfferSize(item.bytes));
  return facts;
}

/** The one file of a single-file offer, if it is one. */
export function singleItem(
  manifest: FileOfferManifest | undefined,
): FileOfferItem | undefined {
  return manifest?.items.length === 1 ? manifest.items[0] : undefined;
}

/** The mark an offer shows: its one file's kind, or a folder. */
export function offerKind(
  offer: FileOfferSummary,
  state: OfferState,
): OfferKind {
  const one = singleItem(state.state === "ready" ? state.manifest : undefined);
  if (one) return one.kind;
  return offer.files > 1 || offer.folder ? "folder" : "file";
}

/** An offer's facts on its card, in the list and in the panel: the one
 * file's, or the folder's name, file count and size. */
export function offerFacts(
  offer: FileOfferSummary,
  state: OfferState,
): string[] {
  const one = singleItem(state.state === "ready" ? state.manifest : undefined);
  if (one) return fileFacts(one);
  return [
    ...(offer.folder ? [cardTxt.folder(offer.folder)] : []),
    txt.files(offer.files, number(offer.files)),
    formatOfferSize(offer.bytes),
  ];
}

/** Where an offer, or one file of it, downloads. */
export function offerDownload(
  offer: FileOfferSummary,
  item?: FileOfferItem,
): OfferDownload {
  return item
    ? {
        href: downloadURL(offer.offer_id, item.path),
        name: baseName(item.path),
        label: cardTxt.download,
      }
    : {
        href: zipURL(offer.offer_id),
        name: zipName(offer),
        label: cardTxt.downloadAll,
      };
}

/** A small picture of an offered image (the host's bounded thumbnail), or
 * its extension. */
export function OfferThumb({
  offerId,
  item,
  className,
}: {
  offerId: string;
  item: FileOfferItem;
  className?: string;
}) {
  return item.kind === "image" || item.kind === "svg" ? (
    <ImageThumbnail
      className={className}
      src={thumbnailURL(offerId, item.path)}
    />
  ) : (
    <span className={`${className ?? ""} ah-file-offer-ext`}>
      {extension(item.path).toUpperCase().slice(0, 4) || "?"}
    </span>
  );
}

/** One file offer in the conversation, on the one offer card. */
export function FileOfferCard({
  offer,
  state,
  open,
  onToggle,
  onTab,
  hitRef,
}: {
  offer: FileOfferSummary;
  state: OfferState;
  open?: boolean;
  onToggle?: (opener: HTMLElement | null) => void;
  onTab?: () => void;
  hitRef?: Ref<HTMLButtonElement>;
}) {
  const manifest = state.state === "ready" ? state.manifest : undefined;
  const one = singleItem(manifest);
  const removed = state.state === "removed";
  const images = (manifest?.items ?? []).filter(
    (i) => i.kind === "image" || i.kind === "svg",
  );
  const media =
    one && images.length === 1 ? (
      <span className="ah-file-offer-image" data-testid="file-offer-image">
        <ImageThumbnail src={thumbnailURL(offer.offer_id, one.path)} />
      </span>
    ) : !one && images.length ? (
      <span className="ah-file-offer-strip">
        {images.slice(0, 8).map((item) => (
          <span key={item.path} data-testid="file-offer-thumb">
            <OfferThumb offerId={offer.offer_id} item={item} />
          </span>
        ))}
        {images.length > 8 ? (
          <span className="ah-file-offer-more">+{images.length - 8}</span>
        ) : null}
      </span>
    ) : null;
  const status = removed ? (
    <span className="ah-offer-facts" data-testid="file-offer-removed">
      {cardTxt.removed}
    </span>
  ) : state.state === "unavailable" ? (
    <span className="ah-offer-facts" role="status">
      {cardTxt.unavailable}
    </span>
  ) : one?.kind === "file" ? (
    <span className="ah-offer-facts">
      {txt.cannotShow(extension(one.path))}
    </span>
  ) : null;
  return (
    <OfferCard
      data-testid="file-offer"
      data-offer-id={offer.offer_id}
      data-state={state.state}
      data-kind={one ? one.kind : manifest ? "package" : undefined}
      aria-label={txt.label(offer.title)}
      kind={offerKind(offer, state)}
      title={offer.title}
      facts={removed ? [] : offerFacts(offer, state)}
      open={open}
      inert={removed}
      onToggle={manifest ? onToggle : undefined}
      hitRef={hitRef}
      media={media}
      status={status}
      actions={
        manifest ? (
          <OfferActions
            label={offer.title}
            onTab={onTab}
            download={offerDownload(offer, one)}
          />
        ) : null
      }
    />
  );
}
