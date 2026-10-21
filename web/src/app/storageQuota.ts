import { mutationFetch } from "./mutations";
export type Quota = { usage_bytes: number; limit_bytes: number };
export type StorageAdministration = {
  schema_version: 1;
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
export const bytes = (n: number) =>
  n < 1024 ** 3
    ? `${(n / 1024 ** 2).toLocaleString("fi-FI", { maximumFractionDigits: 2 })} MiB`
    : `${(n / 1024 ** 3).toLocaleString("fi-FI", { maximumFractionDigits: 2 })} GiB`;
export async function ownStorage(signal?: AbortSignal): Promise<Quota> {
  const r = await fetch("/api/v1/account/storage", {
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
    !quota(v)
  )
    throw new Error("Invalid storage response");
  return v;
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
    (v.overcommitted !== null && typeof v.overcommitted !== "boolean")
  )
    throw new Error("Invalid storage response");
  return v as StorageAdministration;
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
}
