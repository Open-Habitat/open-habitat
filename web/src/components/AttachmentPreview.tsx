import {
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { previewKind, readAttachment, utf8 } from "../app/attachments";
import type { FileOfferItem } from "../app/fileOffers";
import { liveText, useLanguage } from "../i18n";
import { attachmentPreviewText } from "../text/attachmentPreview";
import type { Attachment } from "./AttachmentChips";
import { ControlButton, controlClassName } from "./ControlElements";
import { tableRows } from "./csvTable";
import { Icon } from "./Icon";

// The renderers and their libraries load only when a document is opened.
const DocumentPreview = lazy(() => import("./DocumentPreview"));

const txt = liveText(attachmentPreviewText);
const sizeLabel = (bytes: number) => txt.size(bytes);

/** The file type a person recognises: the name's extension, if it has one. */
const typeLabel = (name: string) =>
  /\.([A-Za-z0-9]{1,8})$/.exec(name)?.[1].toUpperCase() ?? txt.file;

/** Text, tables and code are shown up to this many bytes. */
const textPreviewLimit = 1024 * 1024;

/** A file an agent offered: its frozen facts and where it downloads. The
 * dialog plays media from the host's inline route, lists a zip from its
 * facts, and reads text and documents from their bytes. */
export type OfferedFile = {
  item: FileOfferItem;
  download: string;
};

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
        {txt.notUtf8}
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

/** What a preview shows of one file: its content where the browser can
 * show it, its facts (type and size), and whether content fills the view.
 * The dialog and the offer panel share it. */
export function usePreview({
  attachment,
  read = readAttachment,
  offered,
}: {
  attachment: Attachment;
  read?: (url: string, signal: AbortSignal) => Promise<Uint8Array>;
  offered?: OfferedFile;
}): { content: ReactNode; facts: ReactNode; filled: boolean } {
  useLanguage();
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
      <dt>{txt.type}</dt>
      <dd>{typeLabel(attachment.name)}</dd>
      <dt>{txt.sizeLabel}</dt>
      <dd data-testid="attachment-size" data-bytes={size}>
        {size !== undefined
          ? sizeLabel(size)
          : bytes === undefined
            ? txt.counting
            : txt.unknown}
      </dd>
    </dl>
  );
  const content = attachment.image ? (
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
          {txt.moreInArchive(archive.entries - archive.names.length)}
        </p>
      ) : (
        <p className="ah-attachment-preview-note">{txt.notFromArchive}</p>
      )}
    </section>
  ) : textKind && loaded ? (
    <OfferedText kind={textKind} name={attachment.name} bytes={loaded} />
  ) : kind && loaded ? (
    <Suspense
      fallback={
        <p className="ah-attachment-preview-note" role="status">
          {txt.opening}
        </p>
      }
    >
      <DocumentPreview kind={kind} bytes={loaded} name={attachment.name} />
    </Suspense>
  ) : null;
  return {
    content,
    facts,
    filled: filled || !!attachment.image || offeredKind === "audio",
  };
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
}: {
  attachment: Attachment;
  onClose: () => void;
  read?: (url: string, signal: AbortSignal) => Promise<Uint8Array>;
}) {
  const { content, facts } = usePreview({ attachment, read });
  const filled = !!content && !attachment.image;
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
              aria-label={txt.close}
            >
              <Icon name="cross" />
            </ControlButton>
          </div>
          {content ?? facts}
          <div className="ah-dialog-actions">
            {filled ? facts : null}
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
              {attachment.image ? txt.openOriginal : txt.download}
            </a>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
