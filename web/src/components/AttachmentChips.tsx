import { useState } from "react";
import { textNow, useText } from "../i18n";
import { attachmentChipsText } from "../text/attachmentChips";
import { AttachmentPreview } from "./AttachmentPreview";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { ImageThumbnail } from "./ImageThumbnail";

const reference =
  "(!?)\\[([^\\]\\n]*)\\]\\((\\/api\\/v1\\/attachments\\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\)";

/** One attachment reference as the agent reads it, `![name](url)` for an image. */
export type Attachment = {
  image: boolean;
  name: string;
  url: string;
  /** The reference text exactly as it stands in the message. */
  source: string;
  pending?: boolean;
  blocked?: boolean;
};

const attachment = (match: RegExpMatchArray): Attachment => ({
  image: match[1] === "!",
  name: match[2] || textNow(attachmentChipsText).attachment,
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
export function messageText(value: string, hasImage = false): string {
  // Pi's _prepareRun appends these model-coordinate hints to the same text
  // block, not a marked metadata block. Keep native bytes; hide only the exact
  // trailing form in the person's image message, including multiple images.
  const dimensionNote =
    "\\[Image: original [1-9][0-9]*x[1-9][0-9]*, displayed at [1-9][0-9]*x[1-9][0-9]*\\. Multiply coordinates by [0-9]+\\.[0-9]{2} to map to original image\\.\\]";
  if (hasImage || attachmentsIn(value).some((a) => a.image)) {
    value = value.replace(
      new RegExp(`\\n\\n${dimensionNote}(?:\\n${dimensionNote})*$`),
      "",
    );
  }
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
  const t = useText(attachmentChipsText);
  const [open, setOpen] = useState<Attachment | null>(null);
  if (!attachments.length) return null;
  const draft = !!onRemove;
  return (
    <>
      <ul
        data-testid="attachment-chips"
        className={`ah-attachment-chips${draft ? " ah-attachment-chips-draft" : ""}`}
        aria-label={t.attachments}
      >
        {attachments.map((item, index) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: the same file may be attached twice.
            key={`${item.url}:${index}`}
            data-testid="attachment-chip"
            data-attachment-url={item.pending ? undefined : item.url}
            data-blocked={item.blocked || undefined}
            data-attachment-kind={item.image ? "image" : "file"}
            className={`ah-attachment-chip${item.image && !draft ? " ah-attachment-thumb" : ""}`}
          >
            <ControlButton
              data-testid="attachment-open"
              className="ah-attachment-open"
              variant="quiet"
              size="inline"
              aria-label={t.open(item.name)}
              isDisabled={item.pending}
              onPress={() => setOpen(item)}
            >
              {item.image ? (
                <ImageThumbnail src={`${item.url}/thumbnail`} />
              ) : (
                <Icon name="file" />
              )}
              {item.image && !draft ? null : (
                <span className="ah-attachment-name">{item.name}</span>
              )}
            </ControlButton>
            {item.pending ? (
              <span>{item.blocked ? t.overLimit : t.waiting}</span>
            ) : null}
            {onRemove ? (
              <ControlButton
                data-testid="attachment-remove"
                className="ah-attachment-remove"
                variant="quiet"
                size="inline"
                presentation="icon"
                aria-label={t.remove(item.name)}
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
