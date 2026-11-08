import "./FileOffer.css";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  downloadURL,
  type FileKind,
  type FileOfferItem,
  type FileOfferSummary,
  inlineURL,
  type OfferState,
  readOfferedFile,
  thumbnailURL,
  zipName,
  zipURL,
} from "../app/fileOffers";
import { formatDate, formatNumber, liveText } from "../i18n";
import { fileOfferText, type KindText } from "../text/fileOffer";
import { AttachmentPreview } from "./AttachmentPreview";
import { ControlButton, controlClassName } from "./ControlElements";
import { Icon, type IconName } from "./Icon";
import { ImageThumbnail } from "./ImageThumbnail";
import { TooltipLink } from "./QuickTooltip";

// Agent file offers (prototype rounds Kortti, Tunniste and Hylly): one file
// is a card that says what it is and what the person gets, a package is a
// compact card whose files live in the conversation's file panel. File
// names, titles and folders are agent data, shown as text, never markup.

const txt = liveText(fileOfferText);

type KindInfo = {
  icon: IconName;
  group: "media" | "document" | "data" | "other";
};

const kinds: Record<FileKind, KindInfo> = {
  image: { icon: "image", group: "media" },
  svg: { icon: "image", group: "media" },
  video: { icon: "film", group: "media" },
  audio: { icon: "music", group: "media" },
  markdown: { icon: "file", group: "document" },
  pdf: { icon: "file", group: "document" },
  docx: { icon: "file", group: "document" },
  pptx: { icon: "file", group: "document" },
  xlsx: { icon: "table", group: "data" },
  csv: { icon: "table", group: "data" },
  code: { icon: "code", group: "data" },
  text: { icon: "file", group: "data" },
  zip: { icon: "package", group: "other" },
  file: { icon: "file", group: "other" },
};
const kindText = (kind: FileKind): KindText => txt.kinds[kind];

const extension = (path: string) => /\.([^./]{1,12})$/.exec(path)?.[1] ?? "";
const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const folderOf = (path: string) =>
  path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
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

const time = (iso: string) =>
  formatDate(new Date(iso), { hour: "2-digit", minute: "2-digit" });

function KindMark({ kind }: { kind: FileKind }) {
  return (
    <span
      className="ah-file-offer-mark"
      data-group={kinds[kind].group}
      aria-hidden="true"
    >
      <Icon name={kinds[kind].icon} />
    </span>
  );
}

function DownloadLink({
  href,
  name,
  label = txt.download,
  variant = "primary",
  testId,
}: {
  href: string;
  name: string;
  label?: string;
  variant?: "primary" | "secondary";
  testId: string;
}) {
  return (
    <a
      data-testid={testId}
      className={controlClassName({ variant, size: "row", text: true })}
      href={href}
      download={name}
    >
      <Icon name="download" /> {label}
    </a>
  );
}

/** The preview dialog for one offered file: the attachments' dialog, fed
 * from the offer's routes. */
export function OfferedFilePreview({
  offerId,
  item,
  onClose,
}: {
  offerId: string;
  item: FileOfferItem;
  onClose: () => void;
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
  return (
    <AttachmentPreview
      attachment={attachment}
      onClose={onClose}
      read={(_url, signal) =>
        readOfferedFile(downloadURL(offerId, item.path), signal)
      }
      offered={{ item, download: downloadURL(offerId, item.path) }}
    />
  );
}

function Thumb({
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

/** One offer in the conversation. */
export function FileOfferCard({
  offer,
  state,
  onShowFiles,
}: {
  offer: FileOfferSummary;
  state: OfferState;
  /** Open the conversation's file panel at this offer. */
  onShowFiles?: (offerId: string) => void;
}) {
  const [previewing, setPreviewing] = useState<FileOfferItem | null>(null);
  const manifest = state.state === "ready" ? state.manifest : undefined;
  const single = manifest?.items.length === 1 ? manifest.items[0] : undefined;
  const removed = state.state === "removed";
  const label = removed
    ? txt.offered
    : offer.folder
      ? txt.offersFolder
      : txt.offers;
  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of manifest?.items ?? []) {
      const top = item.path.includes("/") ? item.path.split("/")[0] : "";
      if (top) counts.set(top, (counts.get(top) ?? 0) + 1);
    }
    return [...counts];
  }, [manifest]);
  const images = (manifest?.items ?? []).filter(
    (i) => i.kind === "image" || i.kind === "svg",
  );
  const kind = single?.kind ?? "file";
  const info = kindText(kind);
  return (
    <aside
      className="ah-file-offer"
      role="note"
      aria-label={txt.label(offer.title)}
      data-testid="file-offer"
      data-offer-id={offer.offer_id}
      data-state={state.state}
      data-kind={single ? single.kind : manifest ? "package" : undefined}
    >
      {single ? (
        <KindMark kind={kind} />
      ) : (
        <span
          className="ah-file-offer-mark"
          data-group="other"
          aria-hidden="true"
        >
          <Icon name={offer.folder ? "folder" : "file"} />
        </span>
      )}
      <div className="ah-file-offer-body">
        <span className="ah-file-offer-label">{label}</span>
        <strong className="ah-file-offer-title">
          {removed ? <s>{offer.title}</s> : offer.title}
          {offer.folder && !removed && !single ? (
            <span className="ah-file-offer-folder"> {offer.folder}/</span>
          ) : null}
        </strong>
        {removed ? (
          <span className="ah-file-offer-meta" data-testid="file-offer-removed">
            {txt.removed}
          </span>
        ) : single ? (
          <span className="ah-file-offer-meta">
            {[...fileFacts(single), txt.onlyYou].join(" · ")}
          </span>
        ) : (
          <span className="ah-file-offer-meta">
            {[
              txt.files(offer.files, number(offer.files)),
              ...(folders.length ? [txt.folders(folders.length)] : []),
              formatOfferSize(offer.bytes),
              txt.onlyYou,
            ].join(" · ")}
          </span>
        )}
        {state.state === "unavailable" ? (
          <span className="ah-file-offer-meta" role="status">
            {txt.unavailable}
          </span>
        ) : null}
        {single && (single.kind === "image" || single.kind === "svg") ? (
          <button
            type="button"
            className="ah-file-offer-image"
            data-testid="file-offer-image"
            aria-label={txt.showLarge(baseName(single.path))}
            onClick={() => setPreviewing(single)}
          >
            <ImageThumbnail src={thumbnailURL(offer.offer_id, single.path)} />
          </button>
        ) : null}
        {single && single.kind === "file" ? (
          <span className="ah-file-offer-meta">
            {txt.cannotShow(extension(single.path))}
          </span>
        ) : null}
        {manifest && !single && images.length ? (
          <span className="ah-file-offer-strip">
            {images.slice(0, 8).map((item) => (
              <button
                type="button"
                key={item.path}
                data-testid="file-offer-thumb"
                aria-label={txt.showLarge(item.path)}
                onClick={() => setPreviewing(item)}
              >
                <Thumb offerId={offer.offer_id} item={item} />
              </button>
            ))}
            {images.length > 8 ? (
              <span className="ah-file-offer-more">+{images.length - 8}</span>
            ) : null}
          </span>
        ) : null}
        {manifest && !single && folders.length ? (
          <span className="ah-file-offer-folders">
            {folders.map(([name, count]) => (
              <span key={name}>
                <Icon name="folder" /> {name}{" "}
                <span className="ah-file-offer-count">{count}</span>
              </span>
            ))}
          </span>
        ) : null}
        {manifest && !removed ? (
          <span className="ah-file-offer-actions">
            {single ? (
              <>
                <DownloadLink
                  testId="file-offer-download"
                  href={downloadURL(offer.offer_id, single.path)}
                  name={baseName(single.path)}
                />
                {info.action ? (
                  <ControlButton
                    size="row"
                    data-testid="file-offer-preview"
                    onPress={() => setPreviewing(single)}
                  >
                    {info.action}
                  </ControlButton>
                ) : null}
              </>
            ) : (
              <>
                <DownloadLink
                  testId="file-offer-zip"
                  href={zipURL(offer.offer_id)}
                  name={zipName(offer)}
                  label={txt.downloadAll}
                />
                {onShowFiles ? (
                  <ControlButton
                    size="row"
                    data-testid="file-offer-show-files"
                    onPress={() => onShowFiles(offer.offer_id)}
                  >
                    <Icon name="file" /> {txt.showFiles}
                  </ControlButton>
                ) : null}
              </>
            )}
          </span>
        ) : null}
      </div>
      {previewing ? (
        <OfferedFilePreview
          offerId={offer.offer_id}
          item={previewing}
          onClose={() => setPreviewing(null)}
        />
      ) : null}
    </aside>
  );
}

/** One offer as the shelf lists it, with its facts when they are known. */
export type ShelfOffer = { offer: FileOfferSummary; state: OfferState };

/** The conversation's file panel (Hylly): every offer of the conversation,
 * newest first and by folder, and a search across them. A row opens its
 * file's preview; its own preview and download buttons show on hover and
 * focus, and always on touch (prototype round proto-folder-offer-file-rows,
 * direction Leijuva). */
export function FileShelf({
  offers,
  unavailable,
  scrollTo,
  titleRef,
  onClose,
}: {
  offers: ShelfOffer[];
  unavailable?: boolean;
  /** The offer the panel was opened at from its card. */
  scrollTo?: string;
  titleRef?: Ref<HTMLHeadingElement>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [previewing, setPreviewing] = useState<{
    offerId: string;
    item: FileOfferItem;
  } | null>(null);
  const total = offers.reduce((n, o) => n + o.offer.files, 0);
  const needle = query.trim().toLocaleLowerCase("fi-FI");
  // Opened from a card, the panel brings that offer into view once, after
  // the offers above it have their rows; the newest is already at the top.
  const scroll = useRef<HTMLDivElement>(null);
  const scrolled = useRef<string>(undefined);
  const listed = offers.some((o) => o.offer.offer_id === scrollTo);
  const settled = offers.every((o) => o.state.state !== "loading");
  useEffect(() => {
    if (!scrollTo || !listed || !settled || scrolled.current === scrollTo)
      return;
    scrolled.current = scrollTo;
    const section = [
      ...(scroll.current?.querySelectorAll<HTMLElement>(
        "[data-testid='file-shelf-offer']",
      ) ?? []),
    ].find((el) => el.dataset.offerId === scrollTo);
    section?.scrollIntoView({ block: "start" });
  }, [scrollTo, listed, settled]);
  const keyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !previewing) {
      event.preventDefault();
      onClose();
    }
  };
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Escape from the panel's own controls closes it, as in the view panel.
    <section
      className="ah-view-pane ah-file-shelf"
      aria-label={txt.shelf}
      data-testid="file-shelf"
      onKeyDown={keyDown}
    >
      <header className="ah-editor-header">
        <h2 ref={titleRef} tabIndex={-1} className="ah-view-title">
          {txt.shelfTitle}{" "}
          <span className="ah-file-offer-count" data-testid="file-shelf-count">
            {total}
          </span>
        </h2>
        <span className="ah-editor-controls">
          <ControlButton
            data-testid="close-file-shelf"
            size="row"
            variant="quiet"
            aria-label={txt.closeShelf}
            title={txt.closeShelf}
            onPress={onClose}
          >
            <Icon name="cross" />
          </ControlButton>
        </span>
      </header>
      <div className="ah-file-shelf-scroll" ref={scroll}>
        <label className="ah-file-shelf-search">
          <Icon name="search" />
          <input
            type="search"
            data-testid="file-shelf-search"
            placeholder={txt.search}
            aria-label={txt.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {unavailable ? (
          <p className="ah-file-offer-meta" role="status">
            {txt.shelfUnavailable}
          </p>
        ) : offers.length === 0 ? (
          <p className="ah-file-offer-meta" role="status">
            {txt.shelfEmpty}
          </p>
        ) : null}
        {offers.map(({ offer, state }) => {
          const items =
            state.state === "ready"
              ? state.manifest.items.filter(
                  (i) =>
                    !needle ||
                    i.path.toLocaleLowerCase("fi-FI").includes(needle),
                )
              : [];
          if (needle && items.length === 0) return null;
          const groups = new Map<string, FileOfferItem[]>();
          for (const item of items) {
            const folder = folderOf(item.path);
            groups.set(folder, [...(groups.get(folder) ?? []), item]);
          }
          return (
            <section
              key={offer.offer_id}
              className="ah-file-shelf-offer"
              data-testid="file-shelf-offer"
              data-offer-id={offer.offer_id}
              aria-label={`${txt.at(time(offer.created_at))} · ${offer.title}`}
            >
              <h3>
                <span>
                  {txt.at(time(offer.created_at))} · {offer.title}{" "}
                  <span className="ah-file-offer-count">{offer.files}</span>
                </span>
                {offer.files > 1 ? (
                  <a
                    className={controlClassName({
                      variant: "quiet",
                      size: "inline",
                      text: true,
                    })}
                    href={zipURL(offer.offer_id)}
                    download={zipName(offer)}
                    data-testid="file-shelf-zip"
                    aria-label={txt.zipAll(offer.title)}
                  >
                    <Icon name="package" /> .zip
                  </a>
                ) : null}
              </h3>
              {state.state === "removed" ? (
                <p className="ah-file-offer-meta">{txt.removedShort}</p>
              ) : state.state !== "ready" ? (
                <p className="ah-file-offer-meta" role="status">
                  {state.state === "loading"
                    ? txt.loading
                    : txt.factsUnavailable}
                </p>
              ) : null}
              {[...groups].map(([folder, list]) => (
                <div key={folder} className="ah-file-shelf-group">
                  {folder ? (
                    <span className="ah-file-shelf-folder">
                      <Icon name="folder" /> {folder}/
                      <span className="ah-file-offer-count">{list.length}</span>
                    </span>
                  ) : null}
                  <ul>
                    {list.map((item) => {
                      const name = baseName(item.path);
                      const action = kindText(item.kind).action;
                      const open = () =>
                        setPreviewing({ offerId: offer.offer_id, item });
                      return (
                        <li key={item.path} className="ah-file-shelf-item">
                          <button
                            type="button"
                            className="ah-file-shelf-row"
                            data-testid="file-shelf-row"
                            data-path={item.path}
                            onClick={open}
                          >
                            <Thumb
                              offerId={offer.offer_id}
                              item={item}
                              className="ah-file-shelf-thumb"
                            />
                            <span className="ah-file-shelf-text">
                              <span className="ah-file-shelf-name">{name}</span>
                              <span className="ah-file-shelf-size">
                                {formatOfferSize(item.bytes)}
                              </span>
                            </span>
                          </button>
                          <span className="ah-file-shelf-actions">
                            {action ? (
                              <ControlButton
                                size="row"
                                variant="quiet"
                                data-testid="file-shelf-preview"
                                aria-label={`${action}: ${name}`}
                                title={action}
                                onPress={open}
                              >
                                <Icon name="eye" />
                              </ControlButton>
                            ) : (
                              <span className="ah-file-shelf-gap" />
                            )}
                            <TooltipLink
                              data-testid="file-shelf-download"
                              className={controlClassName({
                                variant: "quiet",
                                size: "row",
                                presentation: "icon",
                              })}
                              href={downloadURL(offer.offer_id, item.path)}
                              download={name}
                              aria-label={txt.downloadNamed(name)}
                              title={txt.download}
                            >
                              <Icon name="download" />
                            </TooltipLink>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>
          );
        })}
      </div>
      {previewing ? (
        <OfferedFilePreview
          offerId={previewing.offerId}
          item={previewing.item}
          onClose={() => setPreviewing(null)}
        />
      ) : null}
    </section>
  );
}
