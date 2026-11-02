import schema from "../../../contracts/v1/attachments.schema.json";
import { liveText } from "../i18n";
import { attachmentsText } from "../text/attachments";
import { LazyAjv } from "./lazyAjv";
import { mutationFetch, writeOutcome } from "./mutations";

const txt = liveText(attachmentsText);

type UploadedAttachment = {
  schema_version: 1;
  id: string;
  path: string;
  content_type: string;
  size: number;
};
const ajv = new LazyAjv({ strict: false, addFormats: true });
const valid = ajv.compile<UploadedAttachment>(schema);

/** The host's upload cap, which also bounds what a preview reads. */
const attachmentLimit = 20 * 1024 * 1024;

export const attachmentURL =
  /^\/api\/v1\/attachments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function uploadAttachment(
  file: File,
  csrf: string,
  signal: AbortSignal,
) {
  if (!file.size || file.size > attachmentLimit) throw new Error(txt.size);
  const response = await mutationFetch(
    "attachment.upload",
    "/api/v1/attachments",
    {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal,
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Agent-Host-CSRF": csrf,
      },
      body: file,
    },
  );
  const outcome = await writeOutcome(response);
  if (outcome.kind !== "ok")
    throw new Error(outcome.kind === "refused" ? txt.refused : txt.uncertain);
  if (
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error(txt.badReply);
  const reader = response.body?.getReader();
  if (!reader) throw new Error(txt.badReply);
  const bytes = new Uint8Array(4096);
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (size + value.byteLength > bytes.length) {
        await reader.cancel();
        throw new Error(txt.badReply);
      }
      bytes.set(value, size);
      size += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  let data: unknown;
  try {
    data = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, size)),
    );
  } catch {
    throw new Error(txt.badReply);
  }
  if (
    !valid(data) ||
    !attachmentURL.test(`/api/v1/attachments/${data.id}`) ||
    !data.path.startsWith("/") ||
    data.size !== file.size
  )
    throw new Error(txt.badReply);
  const name = file.name.replace(/[[\]\\\r\n]/g, "_") || txt.unnamed;
  const image = ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
    data.content_type,
  );
  return {
    ...data,
    reference: `${image ? "!" : ""}[${name}](/api/v1/attachments/${data.id})`,
  };
}

/**
 * An attachment's bytes, read with the person's own session like any other
 * request. The host serves a non-image as `application/octet-stream` without
 * a length it promises, so the body is read under the upload cap.
 */
export async function readAttachment(url: string, signal: AbortSignal) {
  if (!attachmentURL.test(url)) throw new Error(txt.invalid);
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  const reader = response.ok ? response.body?.getReader() : undefined;
  if (!reader) throw new Error(txt.unread);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > attachmentLimit) {
      await reader.cancel();
      throw new Error(txt.tooLarge);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}

/**
 * Which in-app preview an attachment gets. The name's extension says what the
 * person meant and the bytes must agree, so a renamed file falls back to the
 * name, type and size view instead of feeding the wrong parser.
 */
export type PreviewKind = "pdf" | "markdown" | "docx" | "xlsx" | "pptx";

/** Markdown is rendered whole into the page; a longer text keeps the facts view. */
export const markdownLimit = 1024 * 1024;

const startsWith = (bytes: Uint8Array, prefix: number[]) =>
  prefix.every((byte, index) => bytes[index] === byte);

export function previewKind(
  name: string,
  bytes: Uint8Array,
): PreviewKind | null {
  const extension = /\.([A-Za-z0-9]{1,8})$/.exec(name)?.[1].toLowerCase();
  switch (extension) {
    case "pdf":
      // `%PDF-`
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]) ? "pdf" : null;
    case "md":
    case "markdown":
      return bytes.length <= markdownLimit && utf8(bytes) !== null
        ? "markdown"
        : null;
    case "docx":
    case "xlsx":
    case "pptx":
      // A zip local file header, `PK\x03\x04`.
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ? extension : null;
    default:
      return null;
  }
}

export function utf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}
