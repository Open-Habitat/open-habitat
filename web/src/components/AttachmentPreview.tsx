import { lazy, Suspense, useEffect, useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { previewKind, readAttachment } from "../app/attachments";
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
  const [bytes, setBytes] = useState<Uint8Array | "unknown">();
  useEffect(() => {
    if (attachment.image) return;
    const controller = new AbortController();
    setBytes(undefined);
    read(attachment.url, controller.signal).then(
      (data) => setBytes(data),
      () => {
        if (!controller.signal.aborted) setBytes("unknown");
      },
    );
    return () => controller.abort();
  }, [attachment, read]);
  const loaded = typeof bytes === "object" ? bytes : null;
  const kind = loaded ? previewKind(attachment.name, loaded) : null;
  const facts = (
    <dl className="ah-attachment-preview-facts">
      <dt>Tyyppi</dt>
      <dd>{typeLabel(attachment.name)}</dd>
      <dt>Koko</dt>
      <dd
        data-testid="attachment-size"
        data-bytes={loaded?.byteLength}
      >
        {loaded
          ? sizeLabel(loaded.byteLength)
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
        className={`ah-modal ah-attachment-preview${kind ? " ah-attachment-preview-document" : ""}`}
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
            {kind ? facts : null}
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
