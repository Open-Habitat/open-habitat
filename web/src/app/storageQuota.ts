import { formatNumber } from "../i18n";
import { mutationFetch } from "./mutations";
export type Quota = { usage_bytes: number; limit_bytes: number };
export type Disk = { capacity_bytes: number; free_bytes: number };
/** The person's own storage: a native quota, or on an installation without
 * per-user limits only the home filesystem everyone shares. */
export type OwnStorage =
  | ({ limits: "enforced" } & Quota)
  | { limits: "not_in_use"; filesystem: Disk };
export type StorageAdministration = {
  schema_version: 1;
  limits: "enforced" | "not_in_use";
  users: (Quota & {
    id: string;
    username: string;
    administrator: boolean;
    unavailable: boolean;
  })[];
  filesystem: { capacity_bytes: number; free_bytes: number };
  overcommitted: boolean | null;
};
const size = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
const quota = (v: unknown): v is Quota =>
  !!v &&
  typeof v === "object" &&
  "usage_bytes" in v &&
  size(v.usage_bytes) &&
  "limit_bytes" in v &&
  size(v.limit_bytes) &&
  v.limit_bytes > 0;
const disk = (v: unknown): v is Disk =>
  !!v &&
  typeof v === "object" &&
  "capacity_bytes" in v &&
  size(v.capacity_bytes) &&
  v.capacity_bytes > 0 &&
  "free_bytes" in v &&
  size(v.free_bytes) &&
  v.free_bytes <= v.capacity_bytes;
export const bytes = (n: number) =>
  n < 1024 ** 3
    ? `${formatNumber(n / 1024 ** 2, { maximumFractionDigits: 2 })} MiB`
    : `${formatNumber(n / 1024 ** 3, { maximumFractionDigits: 2 })} GiB`;
export async function ownStorage(signal?: AbortSignal): Promise<OwnStorage> {
  const r = await fetch("/api/v1/account/storage", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!r.ok) throw new Error("Storage unavailable");
  const v: unknown = await r.json();
  if (!v || typeof v !== "object" || !("schema_version" in v))
    throw new Error("Invalid storage response");
  if (v.schema_version !== 1) throw new Error("Invalid storage response");
  if ("limits" in v && v.limits === "not_in_use") {
    if (!("filesystem" in v) || !disk(v.filesystem))
      throw new Error("Invalid storage response");
    return { limits: "not_in_use", filesystem: v.filesystem };
  }
  if (("limits" in v && v.limits !== "enforced") || !quota(v))
    throw new Error("Invalid storage response");
  return {
    limits: "enforced",
    usage_bytes: v.usage_bytes,
    limit_bytes: v.limit_bytes,
  };
}
export async function storageAdministration(
  signal?: AbortSignal,
): Promise<StorageAdministration> {
  const r = await fetch("/api/v1/server/storage", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!r.ok) throw new Error("Storage unavailable");
  const v: unknown = await r.json();
  if (
    !v ||
    typeof v !== "object" ||
    !("schema_version" in v) ||
    v.schema_version !== 1 ||
    ("limits" in v && v.limits !== "enforced" && v.limits !== "not_in_use") ||
    !("users" in v) ||
    !Array.isArray(v.users) ||
    !v.users.every(
      (u: unknown) =>
        !!u &&
        typeof u === "object" &&
        "unavailable" in u &&
        typeof u.unavailable === "boolean" &&
        (u.unavailable
          ? "usage_bytes" in u &&
            u.usage_bytes === 0 &&
            "limit_bytes" in u &&
            u.limit_bytes === 0
          : quota(u)) &&
        "id" in u &&
        typeof u.id === "string" &&
        "username" in u &&
        typeof u.username === "string" &&
        "administrator" in u &&
        typeof u.administrator === "boolean",
    ) ||
    !("filesystem" in v) ||
    !v.filesystem ||
    typeof v.filesystem !== "object" ||
    !("capacity_bytes" in v.filesystem) ||
    !size(v.filesystem.capacity_bytes) ||
    !("free_bytes" in v.filesystem) ||
    !size(v.filesystem.free_bytes) ||
    v.filesystem.free_bytes > v.filesystem.capacity_bytes ||
    !("overcommitted" in v) ||
    (v.overcommitted !== null && typeof v.overcommitted !== "boolean") ||
    ("limits" in v &&
      v.limits === "not_in_use" &&
      (v.users.length !== 0 || v.overcommitted !== null))
  )
    throw new Error("Invalid storage response");
  // The schema makes limits optional; its absence is the quota mode.
  return {
    limits: "enforced",
    ...v,
  } as StorageAdministration;
}
export async function changeStorage(
  csrf: string,
  subject: string,
  limit: number,
): Promise<void> {
  const r = await mutationFetch("server.storage", "/api/v1/server/storage", {
    method: "PUT",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "X-Agent-Host-CSRF": csrf },
    body: JSON.stringify({ subject, limit_bytes: limit }),
  });
  if (!r.ok) throw new Error("Storage change unavailable");
  storageAdministrationChanges.dispatchEvent(new Event("change"));
}
/** Fires after a confirmed limit change, so the bell rereads overcommit. */
export const storageAdministrationChanges = new EventTarget();
