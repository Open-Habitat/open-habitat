// Size limits the person can meet in a conversation, and what the browser
// knows about them before the host has to refuse anything. The host's
// numbers are the authority (internal/daemon/attachments_linux.go); these
// copies let the browser say exactly what stopped, at the point it stops,
// without a standing meter (Jari 8.11.2026, direction C with A's pre-send
// check).

/** One attachment, as the host's upload accepts it. */
export const attachmentBytesLimit = 20 * 1024 * 1024;
/** One message's attachments: files and their combined size. */
export const messageAttachmentCount = 30;
export const messageAttachmentBytes = 100 * 1024 * 1024;

/** A conversation's Pi session only grows, and every picture stays in it.
 * Nothing stops at these sizes: past `conversationHeavyBytes` a history page
 * and the agent's every turn read hundreds of megabytes, so the browser
 * advises a new conversation, and it warns once at `conversationNearBytes`. */
export const conversationNearBytes = 384 * 1024 * 1024;
export const conversationHeavyBytes = 512 * 1024 * 1024;

export type ConversationWeight = "near" | "heavy";
export function conversationWeight(
  bytes: number | undefined,
): ConversationWeight | undefined {
  if (!bytes || bytes < conversationNearBytes) return;
  return bytes >= conversationHeavyBytes ? "heavy" : "near";
}

/** Pictures in one history entry that show collapsed until opened: twenty
 * screenshots of a few megabytes each, not one large picture. */
export const collapsedImageBytes = 16 * 1024 * 1024;
export const collapsedImageCount = 2;

// An uploaded attachment's size, by its URL, for the pre-send check. Only
// this tab's uploads are known; a draft restored from an earlier page load
// counts its unknown files by number alone, and the host's own refusal
// still names the limit.
const sizes = new Map<string, number>();

export function rememberAttachmentSize(url: string, bytes: number) {
  sizes.set(url, bytes);
}

export type AttachmentOverflow = {
  count: number;
  /** The combined size of the files whose size this tab knows. */
  bytes: number;
  reason: "count" | "bytes";
};

/** Whether one message's attachments fit, counted as the host counts them:
 * a file attached twice counts once. */
export function attachmentOverflow(
  urls: readonly string[],
): AttachmentOverflow | undefined {
  const distinct = [...new Set(urls)];
  const bytes = distinct.reduce((sum, url) => sum + (sizes.get(url) ?? 0), 0);
  if (distinct.length > messageAttachmentCount)
    return { count: distinct.length, bytes, reason: "count" };
  if (bytes > messageAttachmentBytes)
    return { count: distinct.length, bytes, reason: "bytes" };
  return;
}
