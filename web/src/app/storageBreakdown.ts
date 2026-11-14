import schema from "../../../contracts/v1/account-storage-breakdown.schema.json";
import common from "../../../contracts/v1/common.schema.json";
import { LazyAjv } from "./lazyAjv";
import { mutationFetch } from "./mutations";

// What fills the person's home (storage-breakdown experiment). The person's
// daemon measures its own home and keeps the latest result; a read never
// waits for a measurement. Replies are validated against the contract.
const ajv = new LazyAjv({ strict: false, addFormats: true });
ajv.addSchema(common);
const validate = ajv.compile<StorageBreakdown>(schema);

export type BreakdownGroup =
  | "caches"
  | "finished"
  | "own"
  | "live"
  | "trash"
  | "workspaces"
  | "history";
export type BreakdownItem = {
  group: BreakdownGroup;
  kind: string;
  path: string;
  bytes: number;
  complete: boolean;
  workspace?: string;
  run_id?: string;
  title?: string;
  merged?: true;
};
export type StorageBreakdown = {
  schema_version: 1;
  measuring: boolean;
  measured_at?: string;
  complete: boolean;
  items: BreakdownItem[];
};

const path = "/api/v1/account/storage/breakdown";

async function read(response: Response): Promise<StorageBreakdown> {
  if (!response.ok) throw new Error("Breakdown unavailable");
  const value: unknown = await response.json();
  if (!validate(value)) throw new Error("Invalid breakdown");
  return value;
}

/** The latest result; the daemon starts a new measurement when it is stale. */
export async function readBreakdown(
  signal?: AbortSignal,
): Promise<StorageBreakdown> {
  return read(
    await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    }),
  );
}

/** Asks for a new measurement now; the reply says it is running. */
export async function measureBreakdown(
  csrf: string,
  signal?: AbortSignal,
): Promise<StorageBreakdown> {
  return read(
    await mutationFetch("account.storage_breakdown", path, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal,
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Host-CSRF": csrf,
        Origin: window.location.origin,
      },
      body: JSON.stringify({ measure: true }),
    }),
  );
}

/** Each tool's own clean command; the rest are removed as directories.
 * Go's module cache is read-only, so `rm` fails on it. */
export const cleanCommand: Record<string, string> = {
  "go-build": "go clean -cache",
  "go-mod": "go clean -modcache",
  npm: "npm cache clean --force",
  playwright: "npx playwright uninstall --all",
  uv: "uv cache clean",
  pip: "pip cache purge",
  target: "cargo clean",
};
