import { mutationFetch } from "./mutations";

// Limits on conversations working at once (live-conversation-limit-admin).
// The administrator's view reads and writes the installation's limit and the
// per-person exceptions; the root broker keeps them where each person's
// daemon reads its own. The person refused at the limit reads only their
// own daemon's capacity: their limit and which of their conversations hold a
// place.

export type LiveLimitsView = {
  schema_version: 1;
  default_limit: number | null;
  host_default: number;
  max_limit: number;
  child_bytes: number;
  memory: { total_bytes: number; available_bytes: number } | null;
  people: { id: string; limit: number }[];
};

export type Holder = {
  agent_id: string;
  workspace_id: string;
  activity: "turn" | "question" | "processes" | "unknown";
};
export type Capacity = {
  schema_version: 1;
  limit: number;
  source: "default" | "installation" | "own";
  holding: Holder[];
};

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const whole = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
const limit = (v: unknown): v is number => whole(v, 1, 128);
const subject = (v: unknown): v is string =>
  typeof v === "string" && /^[1-9][0-9]*$/.test(v);

export function validLiveLimits(v: unknown): v is LiveLimitsView {
  if (!object(v) || v.schema_version !== 1) return false;
  const memory = v.memory;
  return (
    (v.default_limit === null || limit(v.default_limit)) &&
    limit(v.host_default) &&
    limit(v.max_limit) &&
    whole(v.child_bytes, 1, Number.MAX_SAFE_INTEGER) &&
    (memory === null ||
      (object(memory) &&
        whole(memory.total_bytes, 1, Number.MAX_SAFE_INTEGER) &&
        whole(memory.available_bytes, 0, Number.MAX_SAFE_INTEGER))) &&
    Array.isArray(v.people) &&
    v.people.length <= 100 &&
    v.people.every(
      (p: unknown) =>
        object(p) &&
        Object.keys(p).length === 2 &&
        subject(p.id) &&
        limit(p.limit),
    )
  );
}

export function validCapacity(v: unknown): v is Capacity {
  return (
    object(v) &&
    v.schema_version === 1 &&
    limit(v.limit) &&
    (v.source === "default" ||
      v.source === "installation" ||
      v.source === "own") &&
    Array.isArray(v.holding) &&
    v.holding.length <= 128 &&
    v.holding.every(
      (h: unknown) =>
        object(h) &&
        typeof h.agent_id === "string" &&
        /^pi:[0-9a-fA-F-]{36}$/.test(h.agent_id) &&
        typeof h.workspace_id === "string" &&
        (h.workspace_id === "" ||
          /^ws_[A-Za-z0-9_-]{8,64}$/.test(h.workspace_id)) &&
        (h.activity === "turn" ||
          h.activity === "question" ||
          h.activity === "processes" ||
          h.activity === "unknown"),
    )
  );
}

async function read<T>(
  url: string,
  valid: (v: unknown) => v is T,
  signal?: AbortSignal,
): Promise<T> {
  const r = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!r.ok) throw new Error("unavailable");
  const v: unknown = await r.json();
  if (!valid(v)) throw new Error("invalid");
  return v;
}

export const liveLimits = (signal?: AbortSignal) =>
  read("/api/v1/server/conversations", validLiveLimits, signal);

export const capacity = (signal?: AbortSignal) =>
  read("/api/v1/conversations/capacity", validCapacity, signal);

/** A write's outcome: the confirmed view, or why it did not happen. A lost
 * reply or a 5xx is uncertain: the change may already be in effect. */
export type LimitChange =
  | { ok: true; view: LiveLimitsView }
  | { ok: false; uncertain: boolean };

/** Sets (or with null removes) the installation's limit, or one person's
 * exception when `person` names them. */
export async function changeLiveLimit(
  csrf: string,
  person: string | undefined,
  value: number | null,
): Promise<LimitChange> {
  let r: Response;
  try {
    r = await mutationFetch(
      "server.live_limits",
      "/api/v1/server/conversations",
      {
        method: "PUT",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Host-CSRF": csrf,
        },
        body: JSON.stringify(
          person ? { subject: person, limit: value } : { limit: value },
        ),
      },
    );
  } catch {
    return { ok: false, uncertain: true };
  }
  if (!r.ok) return { ok: false, uncertain: r.status >= 500 };
  const v: unknown = await r.json().catch(() => undefined);
  return validLiveLimits(v)
    ? { ok: true, view: v }
    : { ok: false, uncertain: true };
}
