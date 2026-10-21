import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "../../../contracts/v1/attachments.schema.json";
import { mutationFetch, writeOutcome } from "./mutations";

type UploadedAttachment = {
  schema_version: 1;
  id: string;
  path: string;
  content_type: string;
  size: number;
};
const ajv = new Ajv({ strict: false });
addFormats(ajv);
const valid = ajv.compile<UploadedAttachment>(schema);

export const attachmentURL =
  /^\/api\/v1\/attachments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function uploadAttachment(
  file: File,
  csrf: string,
  signal: AbortSignal,
) {
  if (!file.size || file.size > 20 * 1024 * 1024)
    throw new Error("Valitse 1 tavun – 20 MiB:n tiedosto.");
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
    throw new Error(
      outcome.kind === "refused"
        ? "Liitettä ei tallennettu. Tarkista koko ja vapaa tila."
        : "Liitteen tallennusta ei voitu vahvistaa. Älä lähetä viestiä ennen tarkistusta.",
    );
  if (
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("Liitteen vastaus ei kelpaa.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Liitteen vastaus ei kelpaa.");
  const bytes = new Uint8Array(4096);
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (size + value.byteLength > bytes.length) {
        await reader.cancel();
        throw new Error("Liitteen vastaus ei kelpaa.");
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
    throw new Error("Liitteen vastaus ei kelpaa.");
  }
  if (
    !valid(data) ||
    !attachmentURL.test(`/api/v1/attachments/${data.id}`) ||
    !data.path.startsWith("/") ||
    data.size !== file.size
  )
    throw new Error("Liitteen vastaus ei kelpaa.");
  const name = file.name.replace(/[[\]\\\r\n]/g, "_") || "Liite";
  const image = ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
    data.content_type,
  );
  return {
    ...data,
    reference: `${image ? "!" : ""}[${name}](/api/v1/attachments/${data.id})`,
  };
}
