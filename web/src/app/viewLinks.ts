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
import { jsonWrite, writeOutcome } from "./mutations";

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
  try {
    const response = await fetch("/api/v1/view-links", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (response.status === 204) {
      publish("off");
      return;
    }
    if (!response.ok) throw new Error("links unavailable");
    const value = await boundedJSON(response, 128 << 10);
    if (!validList?.(value)) throw new Error("unexpected link reply");
    const list = value as { max_days: number; links: ViewLink[] };
    publish({ maxDays: list.max_days, links: list.links });
  } catch (error) {
    if (signal?.aborted) return;
    if (state === undefined) publish("unavailable");
    throw error;
  }
}

function remember(link: ViewLink) {
  if (!state || typeof state === "string") return;
  const rest = state.links.filter((l) => l.link_id !== link.link_id);
  const at = state.links.findIndex((l) => l.link_id === link.link_id);
  rest.splice(at < 0 ? 0 : at, 0, link);
  publish({ ...state, links: rest });
}

function forget(linkId: string) {
  if (!state || typeof state === "string") return;
  publish({
    ...state,
    links: state.links.filter((l) => l.link_id !== linkId),
  });
}

/** Why a link write failed, in words the person can act on. */
export function linkFailure(code: string | undefined): string {
  switch (code) {
    case "view_not_found":
      return "Näkymää ei enää ole. Agentti on ehkä poistanut sen.";
    case "view_link_not_found":
      return "Linkkiä ei enää ole: se on vanhentunut tai poistettu.";
    case "view_links_limited":
      return "Sinulla on jo enimmäismäärä linkkejä. Poista jokin vanha ensin.";
    case "view_links_unavailable":
      return "Tällä palvelimella ei voi jakaa linkkejä.";
    default:
      return "Linkkiä ei voitu tallentaa. Yritä uudelleen.";
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
  const link = await linkWrite(
    "/api/v1/view-links",
    { view_id: viewId, days },
    csrf,
  );
  if (!link) throw new Error(linkFailure(undefined));
  remember(link);
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
  const link = await linkWrite(
    "/api/v1/view-links/change",
    { link_id: linkId, ...change },
    csrf,
  ).catch((error: Error) => {
    if (error.message === linkFailure("view_link_not_found")) forget(linkId);
    throw error;
  });
  if (!link) throw new Error(linkFailure(undefined));
  remember(link);
  return link;
}

export async function revokeViewLink(
  csrf: string,
  linkId: string,
): Promise<void> {
  await linkWrite("/api/v1/view-links/revoke", { link_id: linkId }, csrf).catch(
    (error: Error) => {
      if (error.message !== linkFailure("view_link_not_found")) throw error;
    },
  );
  forget(linkId);
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
  const value = await boundedJSON(response, 2 << 20);
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
  throw new Error("Linkkiä ei voitu poistaa. Yritä uudelleen.");
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
  return new Date(iso).toLocaleDateString("fi-FI", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

export function daysLabel(days: number): string {
  return days === 1 ? "1 päivä" : `${days} päivää`;
}
