// Agent file offers: the app reads the person's own offers and one offer's
// facts from the host, and builds the URLs its own elements and download
// links use. The host decides how the bytes are presented; nothing offered
// runs on this origin.
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { useEffect, useSyncExternalStore } from "react";
import common from "../../../contracts/v1/common.schema.json";
import schema from "../../../contracts/v1/file-offer.schema.json";
import { liveText } from "../i18n";
import { appMessagesText } from "../text/appMessages";

const ajv = new Ajv({ strict: false });
addFormats(ajv);
ajv.addSchema(common);
ajv.addSchema(schema);
const validList = ajv.getSchema(`${schema.$id}#/$defs/list`);
const validManifest = ajv.getSchema(`${schema.$id}#/$defs/manifest`);

/** One offer as its conversation's notice carries it. */
export type FileOfferSummary = {
  offer_id: string;
  title: string;
  folder?: string;
  files: number;
  bytes: number;
  created_at: string;
  conversation_id: string;
};

export type FileKind =
  | "image"
  | "svg"
  | "video"
  | "audio"
  | "markdown"
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "csv"
  | "code"
  | "text"
  | "zip"
  | "file";

export type FileOfferItem = {
  path: string;
  bytes: number;
  kind: FileKind;
  width?: number;
  height?: number;
  lines?: number;
  columns?: number;
  archive?: {
    entries: number;
    bytes: number;
    names: { path: string; bytes: number }[];
  };
};

export type FileOfferManifest = {
  offer: FileOfferSummary;
  items: FileOfferItem[];
};

/** What the app knows about one offer: its facts, that it is gone (the host
 * answered 404), or that it could not be read just now. */
export type OfferState =
  | { state: "loading" }
  | { state: "ready"; manifest: FileOfferManifest }
  | { state: "removed" }
  | { state: "unavailable" };

export const fileOfferIdPattern = /^f[a-z2-7]{26}$/;
const base = "/api/v1/file-offers";

async function boundedJSON(response: Response, max: number): Promise<unknown> {
  if (
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("unexpected file offer reply");
  const text = await response.text();
  if (text.length > max) throw new Error("unexpected file offer reply");
  return JSON.parse(text);
}

const encodePath = (path: string) =>
  path.split("/").map(encodeURIComponent).join("/");

/** The URL the app's own <img>, <video> and <audio> read; any other kind is
 * an attachment there too. */
export function inlineURL(offerId: string, path: string): string {
  return `${base}/${offerId}/inline/${encodePath(path)}`;
}

/** The URL that downloads the file under its own name. */
export function downloadURL(offerId: string, path: string): string {
  return `${base}/${offerId}/download/${encodePath(path)}`;
}

/** The whole offer as one zip; the link's download attribute names it. */
export function zipURL(offerId: string): string {
  return `${base}/${offerId}/zip`;
}

/** A zip's name from the offer's title, without separators. */
export function zipName(offer: FileOfferSummary): string {
  const name = (offer.folder ?? offer.title)
    .replace(/[/\\:*?"<>|\p{Cc}]/gu, "_")
    .trim();
  return `${name || liveText(appMessagesText).files}.zip`;
}

// One fetch per offer per page: every card and the panel share it. A
// removed offer stays removed; an unreadable one is asked again on the next
// subscription. A reset (another person signed in) starts a new epoch: the
// answers of the old one are dropped and every subscriber asks again.
const offers = new Map<string, OfferState>();
const pending = new Map<string, number>();
const listeners = new Set<() => void>();
let epoch = 0;
let version = 0;
const loading: OfferState = { state: "loading" };

function emit() {
  version++;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function fetchOffer(id: string) {
  if (pending.get(id) === epoch) return;
  const asked = epoch;
  pending.set(id, asked);
  let next: OfferState;
  try {
    const response = await fetch(`${base}/${id}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (response.status === 404) next = { state: "removed" };
    else if (!response.ok) next = { state: "unavailable" };
    else {
      const value = await boundedJSON(response, 4 << 20);
      if (!validManifest?.(value)) throw new Error("unexpected reply");
      const manifest = value as FileOfferManifest;
      next =
        manifest.offer.offer_id === id
          ? { state: "ready", manifest }
          : { state: "unavailable" };
    }
  } catch {
    next = { state: "unavailable" };
  }
  if (asked !== epoch) return;
  pending.delete(id);
  offers.set(id, next);
  emit();
}

/** Forget every offer: another person signed in. */
export function resetFileOffers() {
  offers.clear();
  pending.clear();
  lists.clear();
  listPending.clear();
  epoch++;
  emit();
}

const useEpoch = () => useSyncExternalStore(subscribe, () => epoch);

/** The facts of one offer, read once and shared. */
export function useFileOffer(id: string): OfferState {
  const state = useSyncExternalStore(
    subscribe,
    () => offers.get(id) ?? loading,
  );
  const current = useEpoch();
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new epoch asks again.
  useEffect(() => {
    const known = offers.get(id);
    if (!fileOfferIdPattern.test(id)) return;
    if (!known || known.state === "unavailable") void fetchOffer(id);
  }, [id, current]);
  return state;
}

/** The facts of several offers (the file panel's), read once and shared. */
export function useFileOffers(ids: string[]): OfferState[] {
  // Re-render on any change; the states are looked up below.
  useSyncExternalStore(subscribe, () => version);
  const current = useEpoch();
  const key = ids.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the joined key and the epoch are the dependencies.
  useEffect(() => {
    for (const id of ids) {
      const known = offers.get(id);
      if (
        fileOfferIdPattern.test(id) &&
        (!known || known.state === "unavailable")
      )
        void fetchOffer(id);
    }
  }, [key, current]);
  return ids.map((id) => offers.get(id) ?? loading);
}

// Each conversation's offers, read again whenever one of its cards names an
// offer the list does not have yet (a new offer arrived) and whenever the
// file panel opens.
type ListState = { offers: FileOfferSummary[] } | "unavailable";
const lists = new Map<string, ListState>();
const listPending = new Map<string, { epoch: number; again: boolean }>();
const listLimit = 200;

async function fetchList(conversationId: string) {
  const running = listPending.get(conversationId);
  if (running?.epoch === epoch) {
    running.again = true;
    return;
  }
  const asked = epoch;
  listPending.set(conversationId, { epoch: asked, again: false });
  let next: ListState;
  try {
    const response = await fetch(
      `${base}?${new URLSearchParams({ conversation_id: conversationId })}`,
      { credentials: "same-origin", cache: "no-store" },
    );
    if (!response.ok) throw new Error("file offers unavailable");
    const value = await boundedJSON(response, 1 << 20);
    if (!validList?.(value)) throw new Error("unexpected reply");
    next = { offers: (value as { offers: FileOfferSummary[] }).offers };
  } catch {
    next = "unavailable";
  }
  if (asked !== epoch) return;
  const again = listPending.get(conversationId)?.again;
  listPending.delete(conversationId);
  lists.set(conversationId, next);
  // An offer the agent removed is no longer listed: a complete list asks
  // again for the facts of each cached offer it lacks, and the host's 404
  // turns its card inert.
  if (typeof next === "object" && next.offers.length < listLimit) {
    const listed = new Set(next.offers.map((o) => o.offer_id));
    for (const [id, state] of offers)
      if (
        state.state === "ready" &&
        state.manifest.offer.conversation_id === conversationId &&
        !listed.has(id)
      )
        void fetchOffer(id);
  }
  emit();
  if (again) void fetchList(conversationId);
}

/** Note an offer a card shows; its conversation's list is read again if it
 * lacks it. */
export function noteOffer(offer: FileOfferSummary) {
  const list = lists.get(offer.conversation_id);
  if (
    list === undefined ||
    (typeof list === "object" &&
      !list.offers.some((o) => o.offer_id === offer.offer_id))
  )
    void fetchList(offer.conversation_id);
}

/** The offers of one conversation, newest first; undefined while unread. */
export function useConversationOffers(
  conversationId: string | undefined,
): FileOfferSummary[] | "unavailable" | undefined {
  const list = useSyncExternalStore(subscribe, () =>
    conversationId ? lists.get(conversationId) : undefined,
  );
  const current = useEpoch();
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new epoch asks again.
  useEffect(() => {
    if (conversationId && !lists.has(conversationId))
      void fetchList(conversationId);
  }, [conversationId, current]);
  if (!conversationId || list === undefined) return undefined;
  if (list === "unavailable") return "unavailable";
  return list.offers;
}

/** Read a conversation's list again (its file panel opened). */
export function refreshOffers(conversationId: string) {
  void fetchList(conversationId);
}

/** Text and documents are previewed from their bytes up to this size; a
 * larger file is offered for download only. */
export const offerPreviewLimit = 50 * 1024 * 1024;

/** An offered file's bytes, read with the person's own session. */
export async function readOfferedFile(
  url: string,
  signal: AbortSignal,
  limit = offerPreviewLimit,
): Promise<Uint8Array> {
  if (!url.startsWith(`${base}/`)) throw new Error("invalid file");
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  const reader = response.ok ? response.body?.getReader() : undefined;
  if (!reader) throw new Error("file unavailable");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("file too large to preview");
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
