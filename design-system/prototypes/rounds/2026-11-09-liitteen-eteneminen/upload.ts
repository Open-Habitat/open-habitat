import { catalog, formatNumber } from "../../../../web/src/i18n";
import { rememberAttachmentSize } from "../../../../web/src/app/largeContent";

// proto-attachment-upload-progress, round 1: what the three directions share.
// Production sends an attachment with `fetch`, which reports nothing until
// the host answers. XMLHttpRequest reports the bytes it has handed on
// (`upload.onprogress`), and that is all a progress view needs: no host
// change. A streamed `fetch` body is not an option, because it has no
// Content-Length and the gateway refuses a body without one.

/** One file of a batch, from choosing it to the host's answer. */
export type Upload = {
  key: string;
  file: File;
  /** queued: waits its turn; sending: bytes on the way; saving: every byte
   * sent, the host is writing and has not answered. */
  phase: "queued" | "sending" | "saving";
  sent: number;
  /** When sending began, and recent (time, bytes) samples for the speed. */
  started?: number;
  samples: [number, number][];
};

export type Presentation = "ring" | "bar" | "batch";

/** Why a save failed. Production's uploadAttachment throws a worded message
 * today; the refusal round (2026-11-08-liitteen-torjunta) keeps the code. */
export class UploadFailed extends Error {
  constructor(
    public reason: "network" | "refused",
    public sent = 0,
  ) {
    super(reason);
  }
}

/**
 * The production upload request over XMLHttpRequest, reporting progress.
 * Production's reply checks (schema, size, length bound) stay as they are in
 * `uploadAttachment` and are left out of the round. Production would add a
 * sibling of `mutationFetch` for this one write, because that is the only
 * place the browser sends a write (ADR 0023).
 */
export function uploadWithProgress(
  file: File,
  csrf: string,
  signal: AbortSignal,
  onProgress: (sent: number, at: number) => void,
  onSent: () => void,
) {
  return new Promise<{ reference: string; size: number }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let sent = 0;
    xhr.open("POST", "/api/v1/attachments");
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("X-Agent-Host-CSRF", csrf);
    xhr.upload.onprogress = (event) => {
      sent = event.loaded;
      onProgress(event.loaded, event.timeStamp);
    };
    // Every byte has left the browser; the host still writes and answers.
    xhr.upload.onload = () => onSent();
    xhr.onerror = () => reject(new UploadFailed("network", sent));
    xhr.ontimeout = xhr.onerror;
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    xhr.onload = () => {
      if (xhr.status !== 200) return reject(new UploadFailed(xhr.status >= 500 ? "network" : "refused", sent));
      const data = JSON.parse(xhr.responseText) as { id: string; content_type: string; size: number };
      const name = file.name.replace(/[[\]\\\r\n]/g, "_") || "file";
      const image = ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(data.content_type);
      rememberAttachmentSize(`/api/v1/attachments/${data.id}`, data.size);
      resolve({ size: data.size, reference: `${image ? "!" : ""}[${name}](/api/v1/attachments/${data.id})` });
    };
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

/** Megabytes as people say them: "18,6 Mt", "0,4 Mt". */
export const mt = (bytes: number, unit: string, digits?: number) => {
  const n = bytes / (1024 * 1024);
  return `${formatNumber(n, { maximumFractionDigits: digits ?? (n < 10 ? 1 : 0), minimumFractionDigits: digits ?? 0 })} ${unit}`;
};

/** Bytes a second over the last three seconds of samples. */
export function speed(u: Upload) {
  const s = u.samples;
  if (s.length < 2) return 0;
  const [t0, b0] = s[0];
  const [t1, b1] = s[s.length - 1];
  return t1 > t0 ? ((b1 - b0) * 1000) / (t1 - t0) : 0;
}

/** The batch as one figure: bytes sent of all bytes, files done of all. */
export function batch(uploads: Upload[], done: number, doneBytes: number, started?: number, last?: number) {
  const total = doneBytes + uploads.reduce((s, u) => s + u.file.size, 0);
  const sent = doneBytes + uploads.reduce((s, u) => s + (u.phase === "saving" ? u.file.size : u.sent), 0);
  const current = uploads.find((u) => u.phase !== "queued");
  // The batch's average speed, so a new small file does not reset it. Time
  // left is said once the speed has been seen for two seconds, so the first
  // jumpy samples do not promise anything.
  const elapsed = started !== undefined && last !== undefined ? last - started : 0;
  const left = elapsed >= 2000 && sent > 0 ? ((total - sent) * elapsed) / sent / 1000 : undefined;
  return { total, sent, files: done + uploads.length, done, left, current };
}

const fi = {
  unit: "Mt",
  percent: (n: number) => `${n} %`,
  queued: "odottaa",
  saving: "tallennetaan",
  of: (sent: string, total: string) => `${sent} / ${total}`,
  left: (s: number) =>
    s < 10 ? "hetki jäljellä" : s < 60 ? `noin ${Math.ceil(s / 5) * 5} s jäljellä` : `noin ${Math.round(s / 60)} min jäljellä`,
  attaching: (done: number, all: number) => (all === 1 ? "Liitetään tiedostoa" : `Liitetään tiedostoja ${done + 1}/${all}`),
  savingAll: "Tallennetaan…",
  waitingMore: (n: number) => (n === 1 ? "1 odottaa" : `${n} odottaa`),
  cancel: "Peru",
  cancelOne: (name: string) => `Peru tiedoston ${name} liittäminen`,
  cancelAll: "Peru liittäminen",
  progressOf: (name: string) => `Tiedoston ${name} lähetys`,
  progressAll: "Liitteiden lähetys",
  uploading: "Liitteet lähtevät",
  sendWaits: "Viesti lähtee, kun liitteet on tallennettu.",
  dontSend: "Älä lähetä vielä",
  failedOne: (name: string) => `${name} ei tallentunut`,
  failedWhy: (sent: string, total: string) => `Yhteys katkesi, kun ${sent} / ${total} oli lähetetty.`,
  failedRefused: "Palvelin ei ottanut tiedostoa vastaan.",
  failedRest: (n: number) => (n === 1 ? "Yksi tiedosto jäi odottamaan." : `${n} tiedostoa jäi odottamaan.`),
  failedSend: "Viestiä ei lähetetty.",
  retry: "Yritä uudelleen",
  dismiss: "Hylkää",
};

export const progressText = catalog(fi, {
  unit: "MB",
  percent: (n) => `${n}%`,
  queued: "waiting",
  saving: "saving",
  of: (sent, total) => `${sent} / ${total}`,
  left: (s) => (s < 10 ? "a moment left" : s < 60 ? `about ${Math.ceil(s / 5) * 5} s left` : `about ${Math.round(s / 60)} min left`),
  attaching: (done, all) => (all === 1 ? "Attaching the file" : `Attaching files ${done + 1}/${all}`),
  savingAll: "Saving…",
  waitingMore: (n) => `${n} waiting`,
  cancel: "Cancel",
  cancelOne: (name) => `Cancel attaching ${name}`,
  cancelAll: "Cancel attaching",
  progressOf: (name) => `Sending ${name}`,
  progressAll: "Sending the attachments",
  uploading: "Attachments on the way",
  sendWaits: "The message is sent once the attachments are saved.",
  dontSend: "Don't send yet",
  failedOne: (name) => `${name} was not saved`,
  failedWhy: (sent, total) => `The connection broke after ${sent} / ${total} had been sent.`,
  failedRefused: "The server did not accept the file.",
  failedRest: (n) => (n === 1 ? "One file is still waiting." : `${n} files are still waiting.`),
  failedSend: "The message was not sent.",
  retry: "Try again",
  dismiss: "Discard",
});
