import "./FileOffer.css";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
  useMemo,
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
  zipName,
  zipURL,
} from "../app/fileOffers";
import { AttachmentPreview } from "./AttachmentPreview";
import { ControlButton, controlClassName } from "./ControlElements";
import { Icon, type IconName } from "./Icon";

// Agent file offers (prototype rounds Kortti, Tunniste and Hylly): one file
// is a card that says what it is and what the person gets, a package is a
// compact card whose files live in the conversation's file panel. File
// names, titles and folders are agent data, shown as text, never markup.

type KindInfo = {
  icon: IconName;
  group: "media" | "document" | "data" | "other";
  /** What the second button gives; none for a kind the browser cannot show. */
  action?: string;
  type: (ext: string) => string;
};

const kinds: Record<FileKind, KindInfo> = {
  image: {
    icon: "image",
    group: "media",
    action: "Näytä isona",
    type: (e) => `${e}-kuva`,
  },
  svg: {
    icon: "image",
    group: "media",
    action: "Näytä isona",
    type: () => "SVG-kuva",
  },
  video: {
    icon: "film",
    group: "media",
    action: "Toista",
    type: (e) => `Video (${e})`,
  },
  audio: {
    icon: "music",
    group: "media",
    action: "Kuuntele",
    type: (e) => `Ääni (${e})`,
  },
  markdown: {
    icon: "file",
    group: "document",
    action: "Lue",
    type: () => "Markdown",
  },
  pdf: {
    icon: "file",
    group: "document",
    action: "Esikatsele",
    type: () => "PDF-asiakirja",
  },
  docx: {
    icon: "file",
    group: "document",
    action: "Esikatsele",
    type: () => "Word-asiakirja",
  },
  pptx: {
    icon: "file",
    group: "document",
    action: "Selaa dioja",
    type: () => "PowerPoint-esitys",
  },
  xlsx: {
    icon: "table",
    group: "data",
    action: "Näytä taulukko",
    type: () => "Excel-taulukko",
  },
  csv: {
    icon: "table",
    group: "data",
    action: "Näytä taulukko",
    type: (e) => `${e}-taulukko`,
  },
  code: {
    icon: "code",
    group: "data",
    action: "Näytä koodi",
    type: (e) => `${e}-koodi`,
  },
  text: {
    icon: "file",
    group: "data",
    action: "Lue",
    type: (e) => `Teksti (${e})`,
  },
  zip: {
    icon: "package",
    group: "other",
    action: "Näytä sisältö",
    type: () => "Zip-paketti",
  },
  file: { icon: "file", group: "other", type: () => "Tuntematon tyyppi" },
};

const extension = (path: string) => /\.([^./]{1,12})$/.exec(path)?.[1] ?? "";
const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const folderOf = (path: string) =>
  path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
const number = (n: number) => n.toLocaleString("fi-FI");

export function formatOfferSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} t`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kt`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toLocaleString("fi-FI", { maximumFractionDigits: 1 })} Mt`;
  return `${(bytes / 1024 / 1024 / 1024).toLocaleString("fi-FI", { maximumFractionDigits: 1 })} Gt`;
}

/** The facts line of one file: type, what is known of its content, size. */
export function fileFacts(item: FileOfferItem): string[] {
  const ext = extension(item.path);
  const facts = [kinds[item.kind].type(ext.toUpperCase() || "?")];
  if (item.kind === "file" && ext) facts.push(`.${ext}`);
  if (item.width && item.height)
    facts.push(`${number(item.width)} × ${number(item.height)}`);
  if (item.kind === "csv" && item.lines) {
    facts.push(`${number(Math.max(item.lines - 1, 0))} riviä`);
    if (item.columns) facts.push(`${number(item.columns)} saraketta`);
  } else if (item.lines) facts.push(`${number(item.lines)} riviä`);
  if (item.archive)
    facts.push(
      `${number(item.archive.entries)} tiedostoa`,
      `purettuna ${formatOfferSize(item.archive.bytes)}`,
    );
  facts.push(formatOfferSize(item.bytes));
  return facts;
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
  });

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
  label = "Lataa",
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
    <img
      className={className}
      src={inlineURL(offerId, item.path)}
      alt=""
      loading="lazy"
      decoding="async"
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
    ? "Agentti tarjosi ladattavaksi:"
    : offer.folder
      ? "Agentti tarjoaa ladattavaksi kansion:"
      : "Agentti tarjoaa ladattavaksi:";
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
  const info = kinds[kind];
  return (
    <aside
      className="ah-file-offer"
      role="note"
      aria-label={`Agentin tarjoama tiedosto: ${offer.title}`}
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
            Poistettu. Tiedosto ei ole enää ladattavissa.
          </span>
        ) : single ? (
          <span className="ah-file-offer-meta">
            {[...fileFacts(single), "Vain sinulle"].join(" · ")}
          </span>
        ) : (
          <span className="ah-file-offer-meta">
            {[
              offer.files === 1
                ? "1 tiedosto"
                : `${number(offer.files)} tiedostoa`,
              ...(folders.length
                ? [
                    folders.length === 1
                      ? "1 kansio"
                      : `${folders.length} kansiota`,
                  ]
                : []),
              formatOfferSize(offer.bytes),
              "Vain sinulle",
            ].join(" · ")}
          </span>
        )}
        {state.state === "unavailable" ? (
          <span className="ah-file-offer-meta" role="status">
            Tiedoston tietoja ei saatu juuri nyt. Lataa sivu uudelleen.
          </span>
        ) : null}
        {single && (single.kind === "image" || single.kind === "svg") ? (
          <button
            type="button"
            className="ah-file-offer-image"
            data-testid="file-offer-image"
            aria-label={`Näytä isona: ${baseName(single.path)}`}
            onClick={() => setPreviewing(single)}
          >
            <img
              src={inlineURL(offer.offer_id, single.path)}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </button>
        ) : null}
        {single && single.kind === "file" ? (
          <span className="ah-file-offer-meta">
            Selain ei osaa näyttää
            {extension(single.path) ? ` .${extension(single.path)}-` : " tätä "}
            tiedostoa. Lataa se ja avaa omalla ohjelmallasi.
          </span>
        ) : null}
        {manifest && !single && images.length ? (
          <span className="ah-file-offer-strip">
            {images.slice(0, 8).map((item) => (
              <button
                type="button"
                key={item.path}
                data-testid="file-offer-thumb"
                aria-label={`Näytä isona: ${item.path}`}
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
                  label="Lataa kaikki (.zip)"
                />
                {onShowFiles ? (
                  <ControlButton
                    size="row"
                    data-testid="file-offer-show-files"
                    onPress={() => onShowFiles(offer.offer_id)}
                  >
                    <Icon name="file" /> Näytä tiedostot
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
 * newest first and by folder, a search across them, and the selected file's
 * preview, facts and download. */
export function FileShelf({
  offers,
  unavailable,
  selected,
  titleRef,
  onSelect,
  onClose,
}: {
  offers: ShelfOffer[];
  unavailable?: boolean;
  selected?: { offerId: string; path?: string };
  titleRef?: Ref<HTMLHeadingElement>;
  onSelect: (selection: { offerId: string; path: string }) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [previewing, setPreviewing] = useState<{
    offerId: string;
    item: FileOfferItem;
  } | null>(null);
  const total = offers.reduce((n, o) => n + o.offer.files, 0);
  const needle = query.trim().toLocaleLowerCase("fi-FI");
  const chosen = useMemo(() => {
    if (!selected?.path) return undefined;
    const offer = offers.find((o) => o.offer.offer_id === selected.offerId);
    const item =
      offer?.state.state === "ready"
        ? offer.state.manifest.items.find((i) => i.path === selected.path)
        : undefined;
    return offer && item ? { offer: offer.offer, item } : undefined;
  }, [offers, selected]);
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
      aria-label="Keskustelun tiedostot"
      data-testid="file-shelf"
      onKeyDown={keyDown}
    >
      <header className="ah-editor-header">
        <h2 ref={titleRef} tabIndex={-1} className="ah-view-title">
          Tiedostot{" "}
          <span className="ah-file-offer-count" data-testid="file-shelf-count">
            {total}
          </span>
        </h2>
        <span className="ah-editor-controls">
          <ControlButton
            data-testid="close-file-shelf"
            size="row"
            variant="quiet"
            aria-label="Sulje tiedostot"
            title="Sulje tiedostot"
            onPress={onClose}
          >
            <Icon name="cross" />
          </ControlButton>
        </span>
      </header>
      <div className="ah-file-shelf-scroll">
        <label className="ah-file-shelf-search">
          <Icon name="search" />
          <input
            type="search"
            data-testid="file-shelf-search"
            placeholder="Etsi kaikista tarjouksista"
            aria-label="Etsi kaikista tarjouksista"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {chosen ? (
          <div className="ah-file-shelf-detail" data-testid="file-shelf-detail">
            {chosen.item.kind === "image" || chosen.item.kind === "svg" ? (
              <button
                type="button"
                className="ah-file-offer-image"
                aria-label={`Näytä isona: ${baseName(chosen.item.path)}`}
                onClick={() =>
                  setPreviewing({
                    offerId: chosen.offer.offer_id,
                    item: chosen.item,
                  })
                }
              >
                <img
                  src={inlineURL(chosen.offer.offer_id, chosen.item.path)}
                  alt=""
                  decoding="async"
                />
              </button>
            ) : (
              <KindMark kind={chosen.item.kind} />
            )}
            <strong className="ah-file-offer-name">
              {baseName(chosen.item.path)}
            </strong>
            {folderOf(chosen.item.path) || chosen.offer.folder ? (
              <span className="ah-file-offer-meta ah-file-offer-folder">
                {[chosen.offer.folder, folderOf(chosen.item.path)]
                  .filter(Boolean)
                  .join("/")}
                /
              </span>
            ) : null}
            <span className="ah-file-offer-meta">
              {fileFacts(chosen.item).join(" · ")}
            </span>
            <span className="ah-file-offer-meta">
              Tarjottu klo {time(chosen.offer.created_at)} · Vain sinulle
            </span>
            <span className="ah-file-offer-actions">
              <DownloadLink
                testId="file-shelf-download"
                href={downloadURL(chosen.offer.offer_id, chosen.item.path)}
                name={baseName(chosen.item.path)}
              />
              {kinds[chosen.item.kind].action ? (
                <ControlButton
                  size="row"
                  data-testid="file-shelf-preview"
                  onPress={() =>
                    setPreviewing({
                      offerId: chosen.offer.offer_id,
                      item: chosen.item,
                    })
                  }
                >
                  {chosen.item.kind === "image" || chosen.item.kind === "svg"
                    ? "Avaa isona"
                    : kinds[chosen.item.kind].action}
                </ControlButton>
              ) : null}
            </span>
          </div>
        ) : null}
        {unavailable ? (
          <p className="ah-file-offer-meta" role="status">
            Tiedostoja ei saatu juuri nyt.
          </p>
        ) : offers.length === 0 ? (
          <p className="ah-file-offer-meta" role="status">
            Tässä keskustelussa ei ole tarjottuja tiedostoja.
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
              aria-label={`klo ${time(offer.created_at)} · ${offer.title}`}
            >
              <h3>
                <span>
                  klo {time(offer.created_at)} · {offer.title}{" "}
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
                    aria-label={`Lataa kaikki zipinä: ${offer.title}`}
                  >
                    <Icon name="package" /> .zip
                  </a>
                ) : null}
              </h3>
              {state.state === "removed" ? (
                <p className="ah-file-offer-meta">Poistettu.</p>
              ) : state.state !== "ready" ? (
                <p className="ah-file-offer-meta" role="status">
                  {state.state === "loading"
                    ? "Ladataan…"
                    : "Tietoja ei saatu juuri nyt."}
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
                      const current =
                        selected?.offerId === offer.offer_id &&
                        selected.path === item.path;
                      return (
                        <li key={item.path}>
                          <button
                            type="button"
                            className="ah-file-shelf-row"
                            data-testid="file-shelf-row"
                            data-path={item.path}
                            aria-current={current ? "true" : undefined}
                            onClick={() =>
                              onSelect({
                                offerId: offer.offer_id,
                                path: item.path,
                              })
                            }
                          >
                            <Thumb
                              offerId={offer.offer_id}
                              item={item}
                              className="ah-file-shelf-thumb"
                            />
                            <span className="ah-file-shelf-name">
                              {baseName(item.path)}
                            </span>
                            <span className="ah-file-shelf-size">
                              {formatOfferSize(item.bytes)}
                            </span>
                          </button>
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
