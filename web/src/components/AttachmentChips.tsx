import { useEffect, useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { attachmentSize } from "../app/attachments";
import { ControlButton, controlClassName } from "./ControlElements";
import { Icon } from "./Icon";

const reference =
  "(!?)\\[([^\\]\\n]*)\\]\\((\\/api\\/v1\\/attachments\\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\)";

/** One attachment reference as the agent reads it, `![name](url)` for an image. */
export type Attachment = {
  image: boolean;
  name: string;
  url: string;
  /** The reference text exactly as it stands in the message. */
  source: string;
};

const attachment = (match: RegExpMatchArray): Attachment => ({
  image: match[1] === "!",
  name: match[2] || "Liite",
  url: match[3],
  source: match[0],
});

/** Every attachment reference in a message, wherever it stands. */
export function attachmentsIn(text: string): Attachment[] {
  return Array.from(text.matchAll(new RegExp(reference, "g")), attachment);
}

/**
 * A draft is the person's text followed by one reference per line, which is
 * what the agent receives. The field shows only the text; a line that is a
 * whole reference is an attachment and shows as a chip.
 */
export function splitAttachments(value: string): {
  text: string;
  attachments: Attachment[];
} {
  const whole = new RegExp(`^${reference}$`);
  const text: string[] = [];
  const attachments: Attachment[] = [];
  for (const line of value.split("\n")) {
    const match = whole.exec(line);
    if (match) attachments.push(attachment(match));
    else text.push(line);
  }
  return { text: text.join("\n"), attachments };
}

/**
 * A sent message as the person wrote it. Besides the reference lines, the
 * host adds an `Attachment path:` line per attachment for the agent; those
 * are the attachments too, shown by the chips.
 */
export function messageText(value: string): string {
  const { text, attachments } = splitAttachments(value);
  const ids = new Set(attachments.map((a) => a.url.split("/").at(-1)));
  return text
    .split("\n")
    .filter((line) => {
      const id = /^Attachment path: \/.*\/attachments\/([0-9a-f-]{36})$/.exec(
        line,
      )?.[1];
      return !id || !ids.has(id);
    })
    .join("\n");
}

/** The draft for `text` with `attachments` on their own lines after it. */
export function joinAttachments(text: string, attachments: Attachment[]) {
  const refs = attachments.map((a) => a.source).join("\n");
  return refs ? `${text}${text ? "\n" : ""}${refs}` : text;
}

/**
 * Attachments as chips. A draft's chips are compact and can be removed; a
 * sent message shows images as thumbnails. Either opens the preview.
 */
export function AttachmentChips({
  attachments,
  onRemove,
}: {
  attachments: Attachment[];
  /** Given for a draft: removes the attachment at this index. */
  onRemove?: (index: number) => void;
}) {
  const [open, setOpen] = useState<Attachment | null>(null);
  if (!attachments.length) return null;
  const draft = !!onRemove;
  return (
    <>
      <ul
        data-testid="attachment-chips"
        className={`ah-attachment-chips${draft ? " ah-attachment-chips-draft" : ""}`}
        aria-label="Liitteet"
      >
        {attachments.map((item, index) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: the same file may be attached twice.
            key={`${item.url}:${index}`}
            data-testid="attachment-chip"
            data-attachment-url={item.url}
            data-attachment-kind={item.image ? "image" : "file"}
            className={`ah-attachment-chip${item.image && !draft ? " ah-attachment-thumb" : ""}`}
          >
            <ControlButton
              data-testid="attachment-open"
              className="ah-attachment-open"
              variant="quiet"
              size="inline"
              aria-label={`Avaa liite ${item.name}`}
              onPress={() => setOpen(item)}
            >
              {item.image ? (
                <img src={item.url} alt="" loading="lazy" />
              ) : (
                <Icon name="file" />
              )}
              {item.image && !draft ? null : (
                <span className="ah-attachment-name">{item.name}</span>
              )}
            </ControlButton>
            {onRemove ? (
              <ControlButton
                data-testid="attachment-remove"
                className="ah-attachment-remove"
                variant="quiet"
                size="inline"
                presentation="icon"
                aria-label={`Poista liite ${item.name}`}
                onPress={() => onRemove(index)}
              >
                <Icon name="cross" />
              </ControlButton>
            ) : null}
          </li>
        ))}
      </ul>
      {open ? (
        <AttachmentPreview attachment={open} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}

const sizeLabel = (bytes: number) =>
  bytes < 1024
    ? `${bytes} t`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1).replace(".", ",")} kt`
      : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mt`;

/** The file type a person recognises: the name's extension, if it has one. */
const typeLabel = (name: string) =>
  /\.([A-Za-z0-9]{1,8})$/.exec(name)?.[1].toUpperCase() ?? "Tiedosto";

/**
 * An attachment in Open Habitat's own dialog: an image at a size that fits,
 * another file by its name, type and size. Opening the original is secondary.
 */
export function AttachmentPreview({
  attachment,
  onClose,
}: {
  attachment: Attachment;
  onClose: () => void;
}) {
  const [size, setSize] = useState<number | "unknown">();
  useEffect(() => {
    if (attachment.image) return;
    const controller = new AbortController();
    attachmentSize(attachment.url, controller.signal).then(
      (bytes) => setSize(bytes),
      () => {
        if (!controller.signal.aborted) setSize("unknown");
      },
    );
    return () => controller.abort();
  }, [attachment]);
  return (
    <ModalOverlay
      className="ah-overlay"
      isDismissable
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal className="ah-modal ah-attachment-preview">
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
          ) : (
            <dl className="ah-attachment-preview-facts">
              <dt>Tyyppi</dt>
              <dd>{typeLabel(attachment.name)}</dd>
              <dt>Koko</dt>
              <dd data-testid="attachment-size">
                {size === undefined
                  ? "Lasketaan…"
                  : size === "unknown"
                    ? "Ei tiedossa"
                    : sizeLabel(size)}
              </dd>
            </dl>
          )}
          <div className="ah-dialog-actions">
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
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
