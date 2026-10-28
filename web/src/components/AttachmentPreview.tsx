import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { previewKind, readAttachment, utf8 } from "../app/attachments";
import type { FileOfferItem } from "../app/fileOffers";
import type { Attachment } from "./AttachmentChips";
import { ControlButton, controlClassName } from "./ControlElements";
import { Icon } from "./Icon";

// The renderers and their libraries load only when a document is opened.
const DocumentPreview = lazy(() => import("./DocumentPreview"));

const sizeLabel = (bytes: number) =>
  bytes < 1024
    ? `${bytes} t`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1).replace(".", ",")} kt`
      : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mt`;

/** The file type a person recognises: the name's extension, if it has one. */
const typeLabel = (name: string) =>
  /\.([A-Za-z0-9]{1,8})$/.exec(name)?.[1].toUpperCase() ?? "Tiedosto";

/** Text, tables and code are shown up to this many bytes. */
const textPreviewLimit = 1024 * 1024;

/** A file an agent offered: its frozen facts and where it downloads. The
 * dialog plays media from the host's inline route, lists a zip from its
 * facts, and reads text and documents from their bytes. */
export type OfferedFile = {
  item: FileOfferItem;
  download: string;
};

/** The first rows and columns of a CSV (or TSV) as cells; quotes may hold
 * separators, doubled quotes and line breaks. Cells past the column limit
 * are left out, so one long row cannot build an unbounded table. */
export function tableRows(
  text: string,
  tabs: boolean,
  limit = 60,
  columns = 50,
) {
  const sep = tabs ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length && rows.length < limit; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      if (row.length < columns) row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (row.length < columns) row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if ((cell || row.length) && rows.length < limit)
    rows.push(row.length < columns ? [...row, cell] : row);
  return rows;
}

function OfferedText({
  kind,
  name,
  bytes,
}: {
  kind: "csv" | "code" | "text";
  name: string;
  bytes: Uint8Array;
}) {
  const text = utf8(bytes);
  if (text === null)
    return (
      <p
        className="ah-attachment-preview-note"
        data-testid="attachment-preview-unavailable"
      >
        Tiedosto ei ole UTF-8-tekstiä. Lataa se ja avaa omalla ohjelmalla.
      </p>
    );
  if (kind === "csv") {
    const rows = tableRows(text, name.toLowerCase().endsWith(".tsv"));
    return (
      <section
        className="ah-attachment-document ah-offered-table"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the region scrolls.
        tabIndex={0}
        data-testid="attachment-preview-table"
        aria-label={name}
      >
        <table>
          <tbody>
            {rows.map((row, r) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity beyond their place.
              <tr key={r}>
                {row.map((cell, c) =>
                  r === 0 ? (
                    // biome-ignore lint/suspicious/noArrayIndexKey: cells have no identity beyond their place.
                    <th key={c}>{cell}</th>
                  ) : (
                    // biome-ignore lint/suspicious/noArrayIndexKey: cells have no identity beyond their place.
                    <td key={c}>{cell}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }
  return (
    <section
      className="ah-attachment-document ah-offered-text"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the region scrolls.
      tabIndex={0}
      data-testid="attachment-preview-text"
      aria-label={name}
    >
      <pre>{text}</pre>
    </section>
  );
}

/**
 * An attachment in Open Habitat's own dialog: an image at a size that fits,
 * a PDF, Markdown or Office document rendered from its bytes, another file by
 * its name, type and size. Opening the original is secondary.
 *
 * `read` is the host fetch; Storybook, which has no host, supplies bytes.
 */
export function AttachmentPreview({
  attachment,
  onClose,
  read = readAttachment,
  offered,
}: {
  attachment: Attachment;
  onClose: () => void;
  read?: (url: string, signal: AbortSignal) => Promise<Uint8Array>;
  /** Set for a file an agent offered (agent file offers). */
  offered?: OfferedFile;
}) {
  const [bytes, setBytes] = useState<Uint8Array | "unknown">();
  // The bytes are read once per file. A caller's `read` is usually a new
  // function on every render, and reading again on each would empty the
  // dialog and refill it, shrinking and growing it for as long as the
  // conversation behind it renders.
  const reader = useRef(read);
  reader.current = read;
  const offeredKind = offered?.item.kind;
  // Media plays from the host, a zip is listed from its facts and an
  // unknown kind has nothing to show: none of them is read here.
  const unread =
    offeredKind === "video" ||
    offeredKind === "audio" ||
    offeredKind === "zip" ||
    offeredKind === "file" ||
    ((offeredKind === "csv" ||
      offeredKind === "code" ||
      offeredKind === "text") &&
      (offered?.item.bytes ?? 0) > textPreviewLimit);
  useEffect(() => {
    if (attachment.image || unread) return;
    const controller = new AbortController();
    setBytes(undefined);
    reader.current(attachment.url, controller.signal).then(
      (data) => setBytes(data),
      () => {
        if (!controller.signal.aborted) setBytes("unknown");
      },
    );
    return () => controller.abort();
  }, [attachment.url, attachment.image, unread]);
  const loaded = typeof bytes === "object" ? bytes : null;
  const textKind =
    offeredKind === "csv" || offeredKind === "code" || offeredKind === "text"
      ? offeredKind
      : null;
  const kind =
    loaded && !textKind ? previewKind(attachment.name, loaded) : null;
  const size = offered ? offered.item.bytes : loaded?.byteLength;
  const archive = offeredKind === "zip" ? offered?.item.archive : undefined;
  const filled =
    !!kind || (!!textKind && !!loaded) || !!archive || offeredKind === "video";
  const facts = (
    <dl className="ah-attachment-preview-facts">
      <dt>Tyyppi</dt>
      <dd>{typeLabel(attachment.name)}</dd>
      <dt>Koko</dt>
      <dd data-testid="attachment-size" data-bytes={size}>
        {size !== undefined
          ? sizeLabel(size)
          : bytes === undefined
            ? "Lasketaan…"
            : "Ei tiedossa"}
      </dd>
    </dl>
  );
  return (
    <ModalOverlay
      className="ah-overlay"
      isDismissable
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal
        className={`ah-modal ah-attachment-preview${filled ? " ah-attachment-preview-document" : ""}`}
      >
        <AriaDialog
          data-testid="attachment-preview"
          data-attachment-url={attachment.url}
          className="ah-dialog"
          aria-label={attachment.name}
        >
          <div className="ah-attachment-preview-head">
            <Heading slot="title" className="ah-attachment-preview-title">
              {attachment.name}
            </Heading>
            <ControlButton
              data-testid="attachment-preview-close"
              size="inline"
              variant="quiet"
              presentation="icon"
              slot="close"
              aria-label="Sulje"
            >
              <Icon name="cross" />
            </ControlButton>
          </div>
          {attachment.image ? (
            <img
              className="ah-attachment-preview-image"
              src={attachment.url}
              alt={attachment.name}
            />
          ) : offeredKind === "video" ? (
            // biome-ignore lint/a11y/useMediaCaption: An agent's file has no captions to offer.
            <video
              className="ah-attachment-preview-media"
              data-testid="attachment-preview-video"
              src={attachment.url}
              controls
              preload="metadata"
            />
          ) : offeredKind === "audio" ? (
            // biome-ignore lint/a11y/useMediaCaption: An agent's file has no captions to offer.
            <audio
              className="ah-attachment-preview-audio"
              data-testid="attachment-preview-audio"
              src={attachment.url}
              controls
              preload="metadata"
            />
          ) : archive ? (
            <section
              className="ah-attachment-document ah-offered-archive"
              // biome-ignore lint/a11y/noNoninteractiveTabindex: the region scrolls.
              tabIndex={0}
              data-testid="attachment-preview-archive"
              aria-label={attachment.name}
            >
              <ul>
                {archive.names.map((entry) => (
                  <li key={entry.path}>
                    <span>{entry.path}</span>
                    <span>{sizeLabel(entry.bytes)}</span>
                  </li>
                ))}
              </ul>
              {archive.entries > archive.names.length ? (
                <p className="ah-attachment-preview-note">
                  ja {archive.entries - archive.names.length} muuta tiedostoa.
                  Yksittäistä tiedostoa ei voi avata paketista.
                </p>
              ) : (
                <p className="ah-attachment-preview-note">
                  Yksittäistä tiedostoa ei voi avata paketista.
                </p>
              )}
            </section>
          ) : textKind && loaded ? (
            <OfferedText
              kind={textKind}
              name={attachment.name}
              bytes={loaded}
            />
          ) : kind && loaded ? (
            <Suspense
              fallback={
                <p className="ah-attachment-preview-note" role="status">
                  Avataan esikatselua…
                </p>
              }
            >
              <DocumentPreview
                kind={kind}
                bytes={loaded}
                name={attachment.name}
              />
            </Suspense>
          ) : (
            facts
          )}
          <div className="ah-dialog-actions">
            {filled || offeredKind === "audio" || (offered && attachment.image)
              ? facts
              : null}
            {offered ? (
              <a
                data-testid="attachment-original"
                className={controlClassName({
                  variant: "primary",
                  size: "row",
                  text: true,
                })}
                href={offered.download}
                download={attachment.name}
              >
                <Icon name="download" /> Lataa
              </a>
            ) : (
              <a
                data-testid="attachment-original"
                className={controlClassName({
                  variant: "secondary",
                  size: "row",
                  text: true,
                })}
                href={attachment.url}
                download={attachment.image ? undefined : attachment.name}
                target="_blank"
                rel="noopener noreferrer"
              >
                {attachment.image ? "Avaa alkuperäinen" : "Lataa"}
              </a>
            )}
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
