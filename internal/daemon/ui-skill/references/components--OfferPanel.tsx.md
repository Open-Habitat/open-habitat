# components/OfferPanel.tsx

Generated from web/src/components/OfferPanel.tsx; do not edit.

```tsx
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  downloadURL,
  type FileOfferItem,
  type FileOfferSummary,
  inlineURL,
  type OfferState,
  readOfferedFile,
} from "../app/fileOffers";
import { accountSession } from "../app/pi";
import {
  mintOfferPageURL,
  offeredPagePattern,
  ViewsUnavailable,
} from "../app/views";
import { liveText } from "../i18n";
import { offerPanelText } from "../text/offerPanel";
import { viewPanelText } from "../text/viewPanel";
import { usePreview } from "./AttachmentPreview";
import { Segmented } from "./ControlElements";
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
import type { ViewVisibility } from "./ViewOffer";
import { ViewFrame, ViewHeader } from "./ViewPanel";

// A file offer opened beside the conversation, in the same right-hand panel
// a view opens in (proto-offer-cards-consistent, A Viereen): a table, an
// image, a document or a player in place of the old preview dialog, and a
// folder as its list of files, each of which opens in the same panel. The
// bytes come from the offer's own inline and download routes.

const txt = liveText(offerPanelText);
const viewTxt = liveText(viewPanelText);

const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** One offered file's content, as far as the browser can show it, else its
 * facts. The panel and the offer's own tab both show a file this way. An
 * HTML file opens as the page, in the view sandbox on its offer's own host,
 * with its source and facts one press away. */
export function OfferedFileView({
  offerId,
  item,
}: {
  offerId: string;
  item: FileOfferItem;
}) {
  return offeredPagePattern.test(item.path) ? (
    <OfferedPage offerId={offerId} item={item} />
  ) : (
    <div
      className="ah-offer-file"
      data-testid="offer-file"
      data-kind={item.kind}
      data-path={item.path}
    >
      <OfferedFileContent offerId={offerId} item={item} />
    </div>
  );
}

function OfferedFileContent({
  offerId,
  item,
  withFacts = false,
}: {
  offerId: string;
  item: FileOfferItem;
  /** Show the facts under the content too, not only in its place. */
  withFacts?: boolean;
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
    <>
      {content && withFacts ? facts : null}
      {content ?? facts}
    </>
  );
}

/** An offered HTML file as its page. The app origin never presents the
 * file's bytes as HTML: the frame is the view host's, minted for this one
 * offer and file, and confined as a view is. Where the page cannot open (no
 * view origin on this installation, or the session ended) the source and
 * facts are shown instead. */
function OfferedPage({
  offerId,
  item,
}: {
  offerId: string;
  item: FileOfferItem;
}) {
  // "plain": this site opens no pages, so the source is all there is.
  const [mode, setMode] = useState<"page" | "source" | "plain">("page");
  const [src, setSrc] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    // Each reopen (attempt) mints a fresh single-use URL.
    if (mode !== "page" || attempt < 0) return;
    let alive = true;
    setSrc(undefined);
    accountSession()
      .then((session) => {
        if (session === "login") throw new Error("signed out");
        return mintOfferPageURL(session.csrf, offerId, item.path);
      })
      .then(
        (url) => {
          if (alive) setSrc(url);
        },
        (error) => {
          if (!alive) return;
          const plain = error instanceof ViewsUnavailable;
          setFailed(!plain);
          setMode(plain ? "plain" : "source");
        },
      );
    return () => {
      alive = false;
    };
  }, [offerId, item.path, mode, attempt]);
  const name = baseName(item.path);
  if (mode === "plain")
    return (
      <div
        className="ah-offer-file"
        data-testid="offer-file"
        data-kind={item.kind}
        data-path={item.path}
      >
        <OfferedFileContent offerId={offerId} item={item} />
      </div>
    );
  return (
    <div
      className="ah-offer-file ah-offer-page"
      data-testid="offer-file"
      data-kind={item.kind}
      data-path={item.path}
      data-mode={mode}
    >
      <div className="ah-offer-page-bar">
        <Segmented
          data-testid="offer-page-mode"
          label={txt.show}
          options={[
            { id: "page", label: txt.page },
            { id: "source", label: txt.source },
          ]}
          value={mode}
          onChange={(next) => {
            setFailed(false);
            setMode(next);
          }}
        />
      </div>
      {mode === "page" ? (
        <>
          <div className="ah-view-frame ah-offer-page-frame">
            {src ? (
              <ViewFrame
                key={src}
                src={src}
                title={name}
                onReopen={() => setAttempt((n) => n + 1)}
              />
            ) : (
              <p className="ah-view-frame-status" role="status">
                {txt.opening}
              </p>
            )}
          </div>
          <p className="ah-view-note">{viewTxt.isolated}</p>
        </>
      ) : (
        <div className="ah-offer-page-source" data-testid="offer-page-source">
          {failed ? (
            <p
              className="ah-attachment-preview-note"
              data-testid="offer-page-failed"
              role="status"
            >
              {txt.pageFailed}
            </p>
          ) : null}
          <OfferedFileContent offerId={offerId} item={item} withFacts />
        </div>
      )}
    </div>
  );
}

/** A folder offer's files: a press opens one in the same panel. */
export function OfferFolder({
  offer,
  items,
  onOpen,
  onTab,
  rowReply,
}: {
  offer: FileOfferSummary;
  items: FileOfferItem[];
  onOpen: (path: string) => void;
  onTab?: (path: string) => void;
  /** Each row's reply control after its own icons (reply-view-file). */
  rowReply?: (item: FileOfferItem) => ReactNode;
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
          >
            {rowReply?.(item)}
          </OfferActions>
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
  visibility,
  problem,
  rowReply,
}: {
  offer: FileOfferSummary;
  state: OfferState;
  /** Absent where the site shares nothing publicly. The whole offer is
   * published, so a folder's file shows its state but no switch. */
  visibility?: ViewVisibility;
  /** Why the last change of visibility did not go through. */
  problem?: string;
  /** The file of a folder offer shown now; absent: the folder's list. */
  path?: string;
  expanded: boolean;
  titleRef?: Ref<HTMLHeadingElement>;
  onToggleExpanded: () => void;
  onSub: (path?: string) => void;
  onTab: (path?: string) => void;
  onClose: () => void;
  /** A folder row's reply control (reply-view-file). */
  rowReply?: (item: FileOfferItem) => ReactNode;
}) {
  const manifest = state.state === "ready" ? state.manifest : undefined;
  const one = singleItem(manifest);
  const item = path
    ? manifest?.items.find((i) => i.path === path)
    : (one ?? undefined);
  const inFolder = !!path && !one;
  const title = inFolder && item ? baseName(item.path) : offer.title;
  const shown = !!visibility?.public && !visibility.unknown;
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
        rowReply={rowReply}
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
            <OfferSeen words until={shown ? visibility?.until : undefined} />
            {problem ? (
              <span role="status">
                {" · "}
                {problem}
              </span>
            ) : null}
          </>
        }
        expanded={expanded}
        titleRef={titleRef}
        onToggleExpanded={onToggleExpanded}
        actions={
          manifest ? (
            <OfferActions
              label={title}
              publish={inFolder ? undefined : visibility}
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

```
