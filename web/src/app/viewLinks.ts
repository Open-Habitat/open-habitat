// Stable view addresses (ADR 0035): one address per view, reserved when the
// browser first needs it, private until the person publishes it. Only this
// app, on the person's own press, reserves, publishes, changes and deletes;
// the agent has no part in it. The person's addresses are one small store
// here, so the view card, the panel and Settings show the same state, and a
// write updates it from the gateway's reply.
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { useSyncExternalStore } from "react";
import common from "../../../contracts/v1/common.schema.json";
import addressSchema from "../../../contracts/v1/view-address.schema.json";
import { formatDate, liveText } from "../i18n";
import { viewLinksText } from "../text/viewLinks";
import { jsonWrite, writeOutcome } from "./mutations";

const txt = liveText(viewLinksText);

const ajv = new Ajv({ strict: false });
addFormats(ajv);
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

/** A new person never sees the previous person's addresses. */
export function resetViewLinks() {
  epoch++;
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
  try {
    const response = await fetch("/api/v1/view-addresses", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (at !== epoch) return;
    if (response.status === 204) {
      publish("off");
      return;
    }
    if (!response.ok) throw new Error("addresses unavailable");
    // 1000 addresses with escaped titles stay below 2 MiB.
    const value = await boundedJSON(response, 2 << 20);
    if (!validList?.(value)) throw new Error("unexpected address reply");
    const list = value as { max_days: number; addresses: ViewAddress[] };
    if (!list.addresses.every(trustedAddress))
      throw new Error("unexpected address reply");
    if (at !== epoch) return;
    publish({ maxDays: list.max_days, addresses: list.addresses });
  } catch (error) {
    if (signal?.aborted || at !== epoch) return;
    if (state === undefined) publish("unavailable");
    throw error;
  }
}

function remember(address: ViewAddress, at: number) {
  if (at !== epoch || !state || typeof state === "string") return;
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
  if (at !== epoch || !state || typeof state === "string") return;
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
  if (outcome.kind !== "ok") throw new AddressRefusal(undefined);
  if (outcome.response.status === 204) return undefined;
  const value = await boundedJSON(outcome.response, 8192);
  if (!validReply?.(value)) throw new AddressRefusal(undefined);
  const address = (value as { address: ViewAddress }).address;
  if (!trustedAddress(address)) throw new AddressRefusal(undefined);
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
  if (!validAdminList?.(value)) throw new Error("unexpected address reply");
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
