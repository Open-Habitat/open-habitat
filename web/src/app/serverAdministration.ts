export type ServerInfo = {
  schema_version: 1;
  name: string;
  administrator: boolean;
};
export type BoundUser = {
  id: string;
  username: string;
  administrator: boolean;
};
export type Administration = {
  schema_version: 1;
  name: string;
  users: BoundUser[];
};

export async function serverInfo(signal?: AbortSignal): Promise<ServerInfo> {
  const r = await fetch("/api/v1/server", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!r.ok) throw new Error("Server information unavailable");
  const v: unknown = await r.json();
  if (
    !v ||
    typeof v !== "object" ||
    !("schema_version" in v) ||
    v.schema_version !== 1 ||
    !("name" in v) ||
    typeof v.name !== "string" ||
    !("administrator" in v) ||
    typeof v.administrator !== "boolean"
  )
    throw new Error("Invalid server information");
  return v as ServerInfo;
}
export async function administration(
  signal?: AbortSignal,
): Promise<Administration> {
  const r = await fetch("/api/v1/server/administration", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!r.ok) throw new Error("Administrator information unavailable");
  const v: unknown = await r.json();
  if (
    !v ||
    typeof v !== "object" ||
    !("schema_version" in v) ||
    v.schema_version !== 1 ||
    !("name" in v) ||
    typeof v.name !== "string" ||
    !("users" in v) ||
    !Array.isArray(v.users) ||
    !v.users.every(
      (u: unknown) =>
        !!u &&
        typeof u === "object" &&
        "id" in u &&
        typeof u.id === "string" &&
        "username" in u &&
        typeof u.username === "string" &&
        "administrator" in u &&
        typeof u.administrator === "boolean",
    )
  )
    throw new Error("Invalid administrator information");
  return v as Administration;
}
export async function changeAdministration(
  csrf: string,
  change: { name: string } | { subject: string; administrator: boolean },
): Promise<void> {
  const r = await fetch("/api/v1/server/administration", {
    method: "PUT",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "X-Agent-Host-CSRF": csrf },
    body: JSON.stringify(change),
  });
  if (!r.ok) throw new Error("Change could not be saved");
}
