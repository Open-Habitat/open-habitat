import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "../../../contracts/v1/account-keys.schema.json";

/** The account's public keys as the person's daemon read them from the
 * private files on the account. Nothing here is ever a private key. */
export type SSHKey = {
  kind: "ssh";
  file: string;
  algorithm: string;
  public_key: string;
  fingerprint: string;
  comment?: string;
  modified_at: string;
};
export type AgeKey = {
  kind: "age";
  file: string;
  algorithm: "X25519";
  public_key: string;
  modified_at: string;
};
export type AccountKey = SSHKey | AgeKey;
export type KeyKind = AccountKey["kind"];
export type MissingKey = { kind: KeyKind; file: string; can_create: boolean };
export type AccountKeys = {
  schema_version: 1;
  web_identity_id: string;
  keys: AccountKey[];
  missing: MissingKey[];
  /** In a creation's reply: the key that creation made. */
  created?: AccountKey;
};

const valid = addFormats(new Ajv({ strict: false })).compile<AccountKeys>(
  schema,
);
export const accountKeysPath = "/api/v1/account/keys";

export async function readAccountKeys(response: Response) {
  if (!response.ok) throw new Error("keys unavailable");
  const data: unknown = await response.json();
  if (!valid(data)) throw new Error("contract");
  return data;
}

/** What identifies a key across visits: the SSH fingerprint, the age
 * recipient itself. A key replaced under the same file name is a new key. */
export function keyId(key: AccountKey) {
  return key.kind === "ssh" ? key.fingerprint : key.public_key;
}

/** The fingerprint or recipient shortened for a table cell. */
export function shortKey(key: AccountKey) {
  return key.kind === "ssh"
    ? `${key.fingerprint.slice(0, 19)}…`
    : `${key.public_key.slice(0, 12)}…${key.public_key.slice(-4)}`;
}

/** An age recipient in groups of four for comparing by eye. The copied line
 * is always the unbroken recipient. */
export function recipientGroups(recipient: string) {
  return `age1 ${(recipient.slice(4).match(/.{1,4}/g) ?? []).join(" ")}`;
}

/** The keys this browser has seen on this page, by `keyId`, per web
 * identity. They live in the browser because the agent, as the same Unix
 * user, can write anything on the account: kept there, an agent could mark
 * its own key as seen. The cost is that a new key is marked once on each
 * device. */
const seenPrefix = "oh.account-keys.seen.";
const maxSeen = 256;

function storageOf(storage?: Storage) {
  try {
    return storage ?? window.localStorage;
  } catch {
    return undefined;
  }
}

function readSeen(identity: string, storage?: Storage) {
  try {
    const raw = storageOf(storage)?.getItem(seenPrefix + identity);
    if (raw === null || raw === undefined) return undefined;
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

function writeSeen(identity: string, ids: string[], storage?: Storage) {
  try {
    storageOf(storage)?.setItem(
      seenPrefix + identity,
      JSON.stringify(ids.slice(-maxSeen)),
    );
  } catch {
    // Storage may be full or refused; the mark then shows again next time.
  }
}

/** The keys the person has seen. On the first visit from this browser every
 * key already on the account counts as seen, so the page does not alarm
 * about keys the person made before it existed. */
export function seenKeys(
  identity: string,
  keys: AccountKey[],
  storage?: Storage,
): Set<string> {
  const stored = readSeen(identity, storage);
  if (stored !== undefined) return new Set(stored);
  const all = keys.map(keyId);
  writeSeen(identity, all, storage);
  return new Set(all);
}

export function markSeen(identity: string, ids: string[], storage?: Storage) {
  const stored = readSeen(identity, storage) ?? [];
  const next = [...stored.filter((id) => !ids.includes(id)), ...ids];
  writeSeen(identity, next, storage);
  return new Set(next);
}

/** A date as the page shows it: "tänään klo 14.12" or "12.10.2026". */
export function keyDate(iso: string, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (d.toDateString() === now.toDateString())
    return `tänään klo ${d.toLocaleTimeString("fi-FI", { hour: "numeric", minute: "2-digit" })}`;
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}
