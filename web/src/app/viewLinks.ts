// Shared view links (ADR 0033): anyone with a link opens one of the person's
// frozen views. Only this app, on the person's own press, creates, changes
// and revokes links; the agent has no part in it. The person's links are one
// small store here, so the view card, the panel and Settings show the same
// state, and a write updates it from the gateway's reply.
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { useSyncExternalStore } from "react";
import common from "../../../contracts/v1/common.schema.json";
import linkSchema from "../../../contracts/v1/view-link.schema.json";
import { formatDate, liveText } from "../i18n";
import { viewLinksText } from "../text/viewLinks";
import { jsonWrite, writeOutcome } from "./mutations";

const txt = liveText(viewLinksText);

const ajv = new Ajv({ strict: false });
addFormats(ajv);
ajv.addSchema(common);
ajv.addSchema(linkSchema);
const validList = ajv.getSchema(`${linkSchema.$id}#/$defs/list`);
const validReply = ajv.getSchema(`${linkSchema.$id}#/$defs/reply`);
const validAdminList = ajv.getSchema(`${linkSchema.$id}#/$defs/adminList`);

export type ViewLink = {
  link_id: string;
  view_id: string;
  title: string;
  url: string;
  created_at: string;
  expires_at: string;
};

export type AdminViewLink = {
  link_id: string;
  owner_id: string;
  username: string;
  title: string;
  created_at: string;
  expires_at: string;
};

/** "off": the operator offers no links; undefined: not read yet. */
export type ViewLinkState =
  | undefined
  | "off"
  | "unavailable"
  | { maxDays: number; links: ViewLink[] };

let state: ViewLinkState;
// A reset (another person) starts a new epoch; a reply from an older one is
// dropped, so a link URL never reaches the next person's list.
let epoch = 0;
const listeners = new Set<() => void>();
function publish(next: ViewLinkState) {
  state = next;
  for (const listener of listeners) listener();
}

export function useViewLinks(): ViewLinkState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

/** A new person never sees the previous person's links. */
export function resetViewLinks() {
  epoch++;
  publish(undefined);
}

async function boundedJSON(response: Response, max: number): Promise<unknown> {
  if (
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("unexpected link reply");
  const text = await response.text();
  if (text.length > max) throw new Error("unexpected link reply");
  return JSON.parse(text);
}

/** Reads the person's links into the store. */
export async function refreshViewLinks(signal?: AbortSignal): Promise<void> {
  const at = epoch;
  try {
    const response = await fetch("/api/v1/view-links", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (at !== epoch) return;
    if (response.status === 204) {
      publish("off");
      return;
    }
    if (!response.ok) throw new Error("links unavailable");
    const value = await boundedJSON(response, 128 << 10);
    if (!validList?.(value)) throw new Error("unexpected link reply");
    const list = value as { max_days: number; links: ViewLink[] };
    if (at !== epoch) return;
    publish({ maxDays: list.max_days, links: list.links });
  } catch (error) {
    if (signal?.aborted || at !== epoch) return;
    if (state === undefined) publish("unavailable");
    throw error;
  }
}

function remember(link: ViewLink, at: number) {
  if (at !== epoch || !state || typeof state === "string") return;
  const rest = state.links.filter((l) => l.link_id !== link.link_id);
  const index = state.links.findIndex((l) => l.link_id === link.link_id);
  rest.splice(index < 0 ? 0 : index, 0, link);
  publish({ ...state, links: rest });
}

function forget(linkId: string, at: number) {
  if (at !== epoch || !state || typeof state === "string") return;
  publish({
    ...state,
    links: state.links.filter((l) => l.link_id !== linkId),
  });
}

/** Why a link write failed, in words the person can act on. */
export function linkFailure(code: string | undefined): string {
  switch (code) {
    case "view_not_found":
      return txt.viewGone;
    case "view_link_not_found":
      return txt.linkGone;
    case "view_links_limited":
      return txt.tooMany;
    case "view_links_unavailable":
      return txt.unavailable;
    default:
      return txt.saveFailed;
  }
}

async function linkWrite(
  path: string,
  body: unknown,
  csrf: string,
): Promise<ViewLink | undefined> {
  const response = await jsonWrite("view.link", path, body, csrf).catch(
    () => undefined,
  );
  const outcome = await writeOutcome(response);
  if (outcome.kind === "refused") throw new Error(linkFailure(outcome.code));
  if (outcome.kind !== "ok") throw new Error(linkFailure(undefined));
  if (outcome.response.status === 204) return undefined;
  const value = await boundedJSON(outcome.response, 8192);
  if (!validReply?.(value)) throw new Error(linkFailure(undefined));
  const link = (value as { link: ViewLink }).link;
  // A link never points at the app's own host.
  if (new URL(link.url).host === window.location.host)
    throw new Error(linkFailure(undefined));
  return link;
}

export async function createViewLink(
  csrf: string,
  viewId: string,
  days: number,
): Promise<ViewLink> {
  const at = epoch;
  const link = await linkWrite(
    "/api/v1/view-links",
    { view_id: viewId, days },
    csrf,
  );
  if (!link) throw new Error(linkFailure(undefined));
  remember(link, at);
  return link;
}

export type ViewLinkChange =
  | { days: number }
  | { view_id: string }
  | { new_address: true };

export async function changeViewLink(
  csrf: string,
  linkId: string,
  change: ViewLinkChange,
): Promise<ViewLink> {
  const at = epoch;
  const link = await linkWrite(
    "/api/v1/view-links/change",
    { link_id: linkId, ...change },
    csrf,
  ).catch((error: Error) => {
    if (error.message === linkFailure("view_link_not_found"))
      forget(linkId, at);
    throw error;
  });
  if (!link) throw new Error(linkFailure(undefined));
  remember(link, at);
  return link;
}

export async function revokeViewLink(
  csrf: string,
  linkId: string,
): Promise<void> {
  const at = epoch;
  await linkWrite("/api/v1/view-links/revoke", { link_id: linkId }, csrf).catch(
    (error: Error) => {
      if (error.message !== linkFailure("view_link_not_found")) throw error;
    },
  );
  forget(linkId, at);
}

/** The administrator's list: metadata only, never a URL. */
export async function adminViewLinks(
  signal?: AbortSignal,
): Promise<{ enabled: boolean; links: AdminViewLink[] }> {
  const response = await fetch("/api/v1/server/view-links", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("links unavailable");
  // 4096 rows of escaped titles stay below 8 MiB.
  const value = await boundedJSON(response, 8 << 20);
  if (!validAdminList?.(value)) throw new Error("unexpected link reply");
  return value as { enabled: boolean; links: AdminViewLink[] };
}

export async function adminRevokeViewLink(
  csrf: string,
  linkId: string,
): Promise<void> {
  const response = await jsonWrite(
    "server.view_link",
    "/api/v1/server/view-links/revoke",
    { link_id: linkId },
    csrf,
  ).catch(() => undefined);
  const outcome = await writeOutcome(response);
  if (outcome.kind === "ok") return;
  if (outcome.kind === "refused" && outcome.code === "view_link_not_found")
    return;
  throw new Error(txt.removeFailed);
}

/** The expiry choices: 1, 7 and 30 days within the operator's maximum, and
 * the maximum itself. */
export function expiryChoices(maxDays: number): number[] {
  const choices = [1, 7, 30].filter((d) => d <= maxDays);
  if (!choices.includes(maxDays)) choices.push(maxDays);
  return choices;
}

export function defaultExpiry(maxDays: number): number {
  return Math.min(30, maxDays);
}

export function formatExpiry(iso: string): string {
  return formatDate(new Date(iso), {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

export function daysLabel(days: number): string {
  return txt.days(days);
}
