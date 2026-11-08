import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
  useMemo,
} from "react";
import {
  downloadURL,
  type FileOfferItem,
  type FileOfferSummary,
  inlineURL,
  type OfferState,
  readOfferedFile,
} from "../app/fileOffers";
import { liveText } from "../i18n";
import { offerPanelText } from "../text/offerPanel";
import { usePreview } from "./AttachmentPreview";
import {
  fileFacts,
  formatOfferSize,
  OfferThumb,
  offerDownload,
  offerFacts,
  offerKind,
  singleItem,
} from "./FileOffer";
import { Icon } from "./Icon";
import { OfferActions, OfferSeen } from "./OfferCard";
import { ViewHeader } from "./ViewPanel";

// A file offer opened beside the conversation, in the same right-hand panel
// a view opens in (proto-offer-cards-consistent, A Viereen): a table, an
// image, a document or a player in place of the old preview dialog, and a
// folder as its list of files, each of which opens in the same panel. The
// bytes come from the offer's own inline and download routes.

const txt = liveText(offerPanelText);

const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** One offered file's content, as far as the browser can show it, and its
 * facts. The panel and the offer's own tab both show a file this way. */
export function OfferedFileView({
  offerId,
  item,
}: {
  offerId: string;
  item: FileOfferItem;
}) {
  const attachment = useMemo(
    () => ({
      image: item.kind === "image" || item.kind === "svg",
      name: baseName(item.path),
      url: inlineURL(offerId, item.path),
      source: "",
    }),
    [offerId, item],
  );
  const { content, facts } = usePreview({
    attachment,
    read: (_url, signal) =>
      readOfferedFile(downloadURL(offerId, item.path), signal),
    offered: { item, download: downloadURL(offerId, item.path) },
  });
  return (
    <div
      className="ah-offer-file"
      data-testid="offer-file"
      data-kind={item.kind}
      data-path={item.path}
    >
      {content}
      {facts}
    </div>
  );
}

/** A folder offer's files: a press opens one in the same panel. */
export function OfferFolder({
  offer,
  items,
  onOpen,
  onTab,
}: {
  offer: FileOfferSummary;
  items: FileOfferItem[];
  onOpen: (path: string) => void;
  onTab?: (path: string) => void;
}) {
  return (
    <ul className="ah-offer-folder" data-testid="offer-folder">
      {items.map((item) => (
        <li key={item.path} className="ah-offer-folder-row">
          <button
            type="button"
            className="ah-offer-folder-open"
            data-testid="offer-folder-row"
            data-path={item.path}
            onClick={() => onOpen(item.path)}
          >
            <OfferThumb
              offerId={offer.offer_id}
              item={item}
              className="ah-offer-folder-thumb"
            />
            <span className="ah-offer-folder-text">
              <span className="ah-offer-folder-name">{item.path}</span>
              <span className="ah-offer-facts">
                {formatOfferSize(item.bytes)}
              </span>
            </span>
          </button>
          <OfferActions
            label={baseName(item.path)}
            onTab={onTab ? () => onTab(item.path) : undefined}
            download={offerDownload(offer, item)}
          />
        </li>
      ))}
    </ul>
  );
}

/** The right-hand panel for a file offer. */
export function OfferPanel({
  offer,
  state,
  path,
  expanded,
  titleRef,
  onToggleExpanded,
  onSub,
  onTab,
  onClose,
}: {
  offer: FileOfferSummary;
  state: OfferState;
  /** The file of a folder offer shown now; absent: the folder's list. */
  path?: string;
  expanded: boolean;
  titleRef?: Ref<HTMLHeadingElement>;
  onToggleExpanded: () => void;
  onSub: (path?: string) => void;
  onTab: (path?: string) => void;
  onClose: () => void;
}) {
  const manifest = state.state === "ready" ? state.manifest : undefined;
  const one = singleItem(manifest);
  const item = path
    ? manifest?.items.find((i) => i.path === path)
    : (one ?? undefined);
  const inFolder = !!path && !one;
  const title = inFolder && item ? baseName(item.path) : offer.title;
  const keyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      onClose();
    }
  };
  let body: ReactNode;
  if (state.state !== "ready")
    body = (
      <p className="ah-view-frame-status" role="status">
        {state.state === "loading"
          ? txt.loading
          : state.state === "removed"
            ? txt.removed
            : txt.unavailable}
      </p>
    );
  else if (item)
    body = <OfferedFileView offerId={offer.offer_id} item={item} />;
  else
    body = (
      <OfferFolder
        offer={offer}
        items={state.manifest.items}
        onOpen={onSub}
        onTab={onTab}
      />
    );
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Escape from the panel's own controls closes it, as in the view panel.
    <section
      className="ah-view-pane ah-offer-pane"
      aria-label={txt.panel(title)}
      data-testid="offer-panel"
      data-offer-id={offer.offer_id}
      onKeyDown={keyDown}
    >
      {inFolder ? (
        <button
          type="button"
          className="ah-offer-pane-back"
          data-testid="offer-panel-back"
          aria-label={txt.back(offer.folder ? `${offer.folder}/` : offer.title)}
          onClick={() => onSub(undefined)}
        >
          <Icon name="back" /> {offer.folder ? `${offer.folder}/` : offer.title}
        </button>
      ) : null}
      <ViewHeader
        kind={item ? item.kind : offerKind(offer, state)}
        title={title}
        facts={
          <>
            {(item ? fileFacts(item) : offerFacts(offer, state)).join(" · ")}
            {" · "}
            <OfferSeen words />
          </>
        }
        expanded={expanded}
        titleRef={titleRef}
        onToggleExpanded={onToggleExpanded}
        actions={
          manifest ? (
            <OfferActions
              label={title}
              onTab={() => onTab(inFolder ? path : undefined)}
              download={offerDownload(offer, item)}
            />
          ) : null
        }
        closeLabel={txt.close}
        onClose={onClose}
      />
      <div className="ah-offer-pane-body">{body}</div>
    </section>
  );
}
