// Stable view addresses (ADR 0035): one address per view, reserved when the
// browser first needs it, private until the person publishes it. Only this
// app, on the person's own press, reserves, publishes, changes and deletes;
// the agent has no part in it. The person's addresses are one small store
// here, so the view card, the panel and Settings show the same state, and a
// write updates it from the gateway's reply.

import { useEffect, useState, useSyncExternalStore } from "react";
import common from "../../../contracts/v1/common.schema.json";
import addressSchema from "../../../contracts/v1/view-address.schema.json";
import { formatDate, liveText } from "../i18n";
import { viewLinksText } from "../text/viewLinks";
import { LazyAjv } from "./lazyAjv";
import { jsonWrite, writeOutcome } from "./mutations";

const txt = liveText(viewLinksText);

const ajv = new LazyAjv({ strict: false, addFormats: true });
ajv.addSchema(common);
ajv.addSchema(addressSchema);
const validList = ajv.getSchema(`${addressSchema.$id}#/$defs/list`);
const validReply = ajv.getSchema(`${addressSchema.$id}#/$defs/reply`);
const validAdminList = ajv.getSchema(`${addressSchema.$id}#/$defs/adminList`);

export type ViewAddress = {
  address_id: string;
  view_id: string;
  title: string;
  /** The stable entry address on this app's origin. */
  url: string;
  /** The content host's address, readable by anyone while public. */
  content_url: string;
  state: "private" | "public" | "expired";
  created_at: string;
  public_until?: string;
};

export type AdminViewPublication = {
  address_id: string;
  owner_id: string;
  username: string;
  title: string;
  created_at: string;
  public_until: string;
};

/** "off": the installation offers no views; undefined: not read yet.
 * maxDays 0: the site shares nothing publicly now. */
export type ViewLinkState =
  | undefined
  | "off"
  | "unavailable"
  | { maxDays: number; addresses: ViewAddress[] };

let state: ViewLinkState;
// A reset (another person) starts a new epoch; a reply from an older one is
// dropped, so an address never reaches the next person's list.
let epoch = 0;
// Every landed write takes the next number; a list read that started before
// it keeps the written address, not the older one it read (ADR 0035: a stale
// observation never undoes a newer write).
let written = 0;
const writtenAt = new Map<string, number>();
const listeners = new Set<() => void>();
function publish(next: ViewLinkState) {
  state = next;
  notify();
}
function notify() {
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useViewLinks(): ViewLinkState {
  return useSyncExternalStore(subscribe, () => state);
}

/** What the person's cards know about one view's address beyond the list:
 * a write on its way (every card waits for it), or a write whose outcome
 * was lost, which only a fresh read settles. Nothing is ever resent. */
export type AddressMark = "busy" | "uncertain";
let marks: Record<string, AddressMark> = {};
// Which list read an uncertain mark waits for: only a read started after the
// write was lost can settle it.
let reads = 0;
const uncertainAt = new Map<string, number>();
// The last list read failed: what the store shows may no longer be true.
let unknown = false;
function mark(viewId: string, value: AddressMark | undefined) {
  const next = { ...marks };
  if (value) next[viewId] = value;
  else delete next[viewId];
  marks = next;
  notify();
}

export function useViewAddressMark(viewId: string): AddressMark | undefined {
  return useSyncExternalStore(subscribe, () => marks[viewId]);
}

/** Whether the last read of the list failed, so the shown state is unknown. */
export function useViewLinksUnknown(): boolean {
  return useSyncExternalStore(subscribe, () => unknown);
}

/** A new person never sees the previous person's addresses. */
export function resetViewLinks() {
  epoch++;
  writtenAt.clear();
  uncertainAt.clear();
  marks = {};
  unknown = false;
  publish(undefined);
}

async function boundedJSON(response: Response, max: number): Promise<unknown> {
  if (
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("unexpected address reply");
  const text = await response.text();
  if (text.length > max) throw new Error("unexpected address reply");
  return JSON.parse(text);
}

/** The entry address is this app's own; the content address never is. */
function trustedAddress(address: ViewAddress): boolean {
  const here = window.location.host;
  return (
    new URL(address.url).host === here &&
    new URL(address.content_url).host !== here
  );
}

/** Reads the person's addresses into the store. */
export async function refreshViewLinks(signal?: AbortSignal): Promise<void> {
  const at = epoch;
  const since = written;
  const started = ++reads;
  try {
    const response = await fetch("/api/v1/view-addresses", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (at !== epoch) return;
    if (response.status === 204) {
      unknown = false;
      settleUncertain(started);
      publish("off");
      return;
    }
    if (!response.ok) throw new Error("addresses unavailable");
    // 1000 addresses with escaped titles stay below 2 MiB.
    const value = await boundedJSON(response, 2 << 20);
    if (!validList(value)) throw new Error("unexpected address reply");
    const list = value as { max_days: number; addresses: ViewAddress[] };
    if (!list.addresses.every(trustedAddress))
      throw new Error("unexpected address reply");
    if (at !== epoch) return;
    unknown = false;
    settleUncertain(started);
    publish({
      maxDays: list.max_days,
      addresses: newerThan(list.addresses, since),
    });
  } catch (error) {
    if (signal?.aborted || at !== epoch) return;
    if (state === undefined) publish("unavailable");
    else if (!unknown) {
      unknown = true;
      notify();
    }
    throw error;
  }
}

function settleUncertain(started: number) {
  let changed = false;
  const next = { ...marks };
  for (const [viewId, at] of uncertainAt) {
    if (at >= started) continue;
    uncertainAt.delete(viewId);
    if (next[viewId] === "uncertain") {
      delete next[viewId];
      changed = true;
    }
  }
  if (changed) marks = next;
}

/** The list as read, except addresses written since the read started: for
 * those the store's own copy (or its absence, when deleted) is newer. */
function newerThan(read: ViewAddress[], since: number): ViewAddress[] {
  const newer = (id: string) => (writtenAt.get(id) ?? 0) > since;
  const local = state && typeof state === "object" ? state.addresses : [];
  const kept = local.filter((a) => newer(a.address_id));
  const result = read.map(
    (a) => kept.find((k) => k.address_id === a.address_id) ?? a,
  );
  const fresh = result.filter(
    (a) =>
      !newer(a.address_id) || kept.some((k) => k.address_id === a.address_id),
  );
  const added = kept.filter(
    (k) => !read.some((a) => a.address_id === k.address_id),
  );
  return [...added, ...fresh];
}

function remember(address: ViewAddress, at: number) {
  if (at !== epoch) return;
  writtenAt.set(address.address_id, ++written);
  if (!state || typeof state === "string") return;
  const rest = state.addresses.filter(
    (a) => a.address_id !== address.address_id,
  );
  const index = state.addresses.findIndex(
    (a) => a.address_id === address.address_id,
  );
  rest.splice(index < 0 ? 0 : index, 0, address);
  publish({ ...state, addresses: rest });
}

function forget(addressId: string, at: number) {
  if (at !== epoch) return;
  writtenAt.set(addressId, ++written);
  if (!state || typeof state === "string") return;
  publish({
    ...state,
    addresses: state.addresses.filter((a) => a.address_id !== addressId),
  });
}

/** Why an address write failed, in words the person can act on. */
export function linkFailure(code: string | undefined): string {
  switch (code) {
    case "view_not_found":
      return txt.viewGone;
    case "view_address_not_found":
      return txt.linkGone;
    case "view_addresses_limited":
      return txt.tooManyAddresses;
    case "view_publications_limited":
      return txt.tooMany;
    case "view_sharing_off":
    case "view_addresses_unavailable":
      return txt.unavailable;
    case "view_address_not_public":
      return txt.notPublic;
    default:
      return txt.saveFailed;
  }
}

class AddressRefusal extends Error {
  constructor(readonly code: string | undefined) {
    super(linkFailure(code));
  }
}

/** The write may or may not have happened: the reply was lost, a server
 * error, or unreadable. Only a fresh read tells which. */
export class AddressUncertain extends Error {
  constructor() {
    super(txt.uncertain);
  }
}

async function addressWrite(
  path: string,
  body: unknown,
  csrf: string,
): Promise<ViewAddress | undefined> {
  const response = await jsonWrite("view.address", path, body, csrf).catch(
    () => undefined,
  );
  const outcome = await writeOutcome(response);
  if (outcome.kind === "refused") throw new AddressRefusal(outcome.code);
  if (outcome.kind === "uncertain") throw new AddressUncertain();
  if (outcome.kind !== "ok") throw new AddressRefusal(undefined);
  if (outcome.response.status === 204) return undefined;
  const value = await boundedJSON(outcome.response, 8192).catch(() => {
    throw new AddressUncertain();
  });
  if (!validReply(value)) throw new AddressUncertain();
  const address = (value as { address: ViewAddress }).address;
  if (!trustedAddress(address)) throw new AddressUncertain();
  return address;
}

/** One change to an address the store knows; a vanished one is forgotten. */
async function addressChange(
  path: string,
  body: { address_id: string; days?: number },
  csrf: string,
): Promise<ViewAddress | undefined> {
  const at = epoch;
  try {
    const address = await addressWrite(path, body, csrf);
    if (address) remember(address, at);
    else forget(body.address_id, at);
    return address;
  } catch (error) {
    if (
      error instanceof AddressRefusal &&
      error.code === "view_address_not_found"
    )
      forget(body.address_id, at);
    throw error;
  }
}

/** The view's one address, reserved private on first need. */
export async function ensureViewAddress(
  csrf: string,
  viewId: string,
): Promise<ViewAddress> {
  const at = epoch;
  const address = await addressWrite(
    "/api/v1/view-addresses",
    { view_id: viewId },
    csrf,
  );
  if (!address) throw new Error(linkFailure(undefined));
  remember(address, at);
  return address;
}

/** Which of the person's addresses an entry secret names (`/n/<entry>`),
 * or "not_found" when it is no address of theirs. The secret goes in the
 * body, never a URL. */
export async function openViewEntry(
  csrf: string,
  entry: string,
): Promise<ViewAddress | "not_found"> {
  try {
    const address = await addressWrite(
      "/api/v1/view-addresses/open",
      { entry },
      csrf,
    );
    if (!address) throw new Error(linkFailure(undefined));
    return address;
  } catch (error) {
    if (
      error instanceof AddressRefusal &&
      error.code === "view_address_not_found"
    )
      return "not_found";
    throw error;
  }
}

/** Public for days from now; earlier copies of the address work again. */
export async function publishViewAddress(
  csrf: string,
  addressId: string,
  days: number,
): Promise<ViewAddress> {
  const address = await addressChange(
    "/api/v1/view-addresses/publish",
    { address_id: addressId, days },
    csrf,
  );
  if (!address) throw new Error(linkFailure(undefined));
  return address;
}

/** A new end for the current publication; never publishes. */
export async function changeViewAddressDuration(
  csrf: string,
  addressId: string,
  days: number,
): Promise<ViewAddress> {
  const address = await addressChange(
    "/api/v1/view-addresses/duration",
    { address_id: addressId, days },
    csrf,
  );
  if (!address) throw new Error(linkFailure(undefined));
  return address;
}

/** Ends the publication; the address stays for the next one. */
export async function makeViewAddressPrivate(
  csrf: string,
  addressId: string,
): Promise<ViewAddress> {
  const address = await addressChange(
    "/api/v1/view-addresses/private",
    { address_id: addressId },
    csrf,
  );
  if (!address) throw new Error(linkFailure(undefined));
  return address;
}

/** Ends both URLs for good; the view's next address is a new one. */
export async function deleteViewAddress(
  csrf: string,
  addressId: string,
): Promise<void> {
  await addressChange(
    "/api/v1/view-addresses/delete",
    { address_id: addressId },
    csrf,
  ).catch((error: unknown) => {
    if (
      !(error instanceof AddressRefusal) ||
      error.code !== "view_address_not_found"
    )
      throw error;
  });
}

/** One press on a view's address. Every card of the view waits for it,
 * and a second press meanwhile is refused, never queued. A lost outcome is settled by
 * reading the list again, never by sending the write again. */
async function pressed(viewId: string, write: () => Promise<unknown>) {
  if (marks[viewId] === "busy") throw new Error(txt.busy);
  const at = epoch;
  uncertainAt.delete(viewId);
  mark(viewId, "busy");
  try {
    await write();
    if (at === epoch) mark(viewId, undefined);
  } catch (error) {
    if (at !== epoch) throw error;
    if (error instanceof AddressUncertain) {
      uncertainAt.set(viewId, reads);
      mark(viewId, "uncertain");
      await refreshViewLinks().catch(() => {
        // The mark stays until a later read settles it.
      });
    } else mark(viewId, undefined);
    throw error;
  }
}

/** The view's address in any state, when it has one. */
export function addressOf(
  links: ViewLinkState,
  viewId: string,
): ViewAddress | undefined {
  if (!links || typeof links === "string") return undefined;
  return links.addresses.find((a) => a.view_id === viewId);
}

/** The card's switch. On publishes the view's address (reserving it first
 * if needed) for the default length, always counted again from now; off
 * makes it private. */
export function setViewPublic(
  csrf: string,
  viewId: string,
  on: boolean,
  days: number,
): Promise<void> {
  return pressed(viewId, async () => {
    const known = addressOf(state, viewId);
    if (on) {
      const address = known ?? (await ensureViewAddress(csrf, viewId));
      await publishViewAddress(csrf, address.address_id, days);
    } else if (known) await makeViewAddressPrivate(csrf, known.address_id);
  });
}

/** A new length for the view's current publication, from now. */
export function setViewDuration(
  csrf: string,
  viewId: string,
  days: number,
): Promise<void> {
  return pressed(viewId, async () => {
    const known = addressOf(state, viewId);
    if (!known) throw new AddressRefusal("view_address_not_public");
    await changeViewAddressDuration(csrf, known.address_id, days);
  });
}

/** Settings' Lopeta: the address stays for the next publication. */
export function stopViewSharing(
  csrf: string,
  address: ViewAddress,
): Promise<void> {
  return pressed(address.view_id, () =>
    makeViewAddressPrivate(csrf, address.address_id),
  );
}

/** Settings' permanent deletion of the address, never of the view. */
export function deleteViewAddressForGood(
  csrf: string,
  address: ViewAddress,
): Promise<void> {
  return pressed(address.view_id, () =>
    deleteViewAddress(csrf, address.address_id),
  );
}

let lastRead = 0;
/** Keeps the shown addresses true while cards are on screen: read again
 * when the person comes back to the tab, and when a publication ends. A
 * publication ending also redraws when the read fails, so an expired view
 * never shows as public. Mounted once, by the view host. */
export function useViewLinksFreshness(active: boolean) {
  const links = useViewLinks();
  const unknownNow = useViewLinksUnknown();
  const [retries, setRetries] = useState(0);
  // A list that could not be read is read again by itself, sooner first.
  useEffect(() => {
    if (!active || !unknownNow) {
      setRetries(0);
      return;
    }
    const timer = window.setTimeout(
      () => void refreshViewLinks().catch(() => setRetries((n) => n + 1)),
      Math.min(5000 * 2 ** retries, 60_000),
    );
    return () => window.clearTimeout(timer);
  }, [active, unknownNow, retries]);
  useEffect(() => {
    if (!active) return;
    const again = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastRead < 2000) return;
      lastRead = now;
      void refreshViewLinks().catch(() => {});
    };
    window.addEventListener("focus", again);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.removeEventListener("focus", again);
      document.removeEventListener("visibilitychange", again);
    };
  }, [active]);
  useEffect(() => {
    if (!active || !links || typeof links === "string") return;
    const now = Date.now();
    let next = Number.POSITIVE_INFINITY;
    for (const a of links.addresses) {
      const until = a.public_until ? Date.parse(a.public_until) : Number.NaN;
      if (a.state === "public" && until > now && until < next) next = until;
    }
    if (!Number.isFinite(next)) return;
    const timer = window.setTimeout(
      () => {
        const at = epoch;
        void refreshViewLinks()
          .catch(() => {})
          .finally(() => {
            // Redraw even when nothing new was read: isPublic looks at the
            // clock.
            if (at === epoch && state && typeof state === "object")
              publish({ ...state });
          });
      },
      // Past the end, and never beyond what a timer can wait.
      Math.min(next - now + 1000, 2 ** 31 - 1),
    );
    return () => window.clearTimeout(timer);
  }, [active, links]);
}

/** Whether anyone with the address reads the view now. */
export function isPublic(address: ViewAddress, now = Date.now()): boolean {
  return (
    address.state === "public" &&
    !!address.public_until &&
    Date.parse(address.public_until) > now
  );
}

/** The address the view is public at now, if any. */
export function publicAddress(
  links: ViewLinkState,
  viewId: string,
): ViewAddress | undefined {
  if (!links || typeof links === "string") return undefined;
  return links.addresses.find((a) => a.view_id === viewId && isPublic(a));
}

/** The administrator's list: current publications' metadata, never an
 * address. */
export async function adminViewPublications(
  signal?: AbortSignal,
): Promise<{ enabled: boolean; publications: AdminViewPublication[] }> {
  const response = await fetch("/api/v1/server/view-publications", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("publications unavailable");
  // 4096 rows of escaped titles stay below 8 MiB.
  const value = await boundedJSON(response, 8 << 20);
  if (!validAdminList(value)) throw new Error("unexpected address reply");
  return value as { enabled: boolean; publications: AdminViewPublication[] };
}

export async function adminDeleteViewAddress(
  csrf: string,
  addressId: string,
): Promise<void> {
  const response = await jsonWrite(
    "server.view_address",
    "/api/v1/server/view-publications/delete",
    { address_id: addressId },
    csrf,
  ).catch(() => undefined);
  const outcome = await writeOutcome(response);
  if (outcome.kind === "ok") return;
  if (outcome.kind === "refused" && outcome.code === "view_address_not_found")
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
