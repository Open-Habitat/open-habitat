import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import accountSchema from "../../../contracts/v1/integration-account.schema.json";
import changeSchema from "../../../contracts/v1/integration-change.schema.json";
import loginSchema from "../../../contracts/v1/integration-login.schema.json";
import listSchema from "../../../contracts/v1/integrations.schema.json";
import { mutationFetch } from "./mutations";

// Asetukset › Integraatiot reads and writes through the person's daemon
// (ADR 0026). Every reply is validated against the contract before the page
// sees it, under a size cap, and any failure is a generic error: native text
// never reaches the page.

const ajv = new Ajv({ strict: false });
addFormats(ajv);
ajv.addSchema(listSchema);
ajv.addSchema(accountSchema);
const validList = ajv.compile(listSchema);
const validChange = ajv.compile(changeSchema);
const validLogin = ajv.compile(loginSchema);

export type ProviderId =
  | "imap"
  | "caldav"
  | "carddav"
  | "google"
  | "microsoft"
  | "dropbox";
export type ServiceId =
  | "mail"
  | "calendar"
  | "contacts"
  | "drive"
  | "onedrive"
  | "sharepoint"
  | "dropbox";
export type ServiceState =
  | "ok"
  | "syncing"
  | "sync_failed"
  | "credentials_rejected"
  | "login_expired"
  | "unreachable"
  | "sync_restarting"
  | "quota_full"
  | "unknown";
export type LoginKind = "app_password" | "pasted_redirect" | "device_code";
export type SkillState = "current" | "none" | "blocked" | "failed";

export type Provider = {
  id: ProviderId;
  available: boolean;
  unavailable_reason?: "app_credentials_required" | "tool_unavailable";
  login: LoginKind;
  services: ServiceId[];
};
export type SyncProgress = {
  service?: ServiceId;
  phase: "inventory" | "preparing" | "transferring";
  elapsed_seconds: number;
  bytes: number;
  total_bytes: number;
  files: number;
  total_files: number;
};
export type Service = {
  id: ServiceId;
  state: ServiceState;
  directory?: string;
  progress?: SyncProgress;
  failure?: SyncFailure;
  /** When the latest successful pass ended, from the tool's own listings. */
  last_synced_at?: string;
};
export type SyncFailure =
  | "quota_insufficient"
  | "quota_unavailable"
  | "initial_sync_incomplete"
  | "initial_sync_resume_failed"
  | "delete_limit"
  | "needs_resync"
  | "remote_unreachable"
  | "pass_failed";
export type Account = {
  provider: ProviderId;
  address: string;
  services: Service[];
  checked_at: string;
};
export type IntegrationList = {
  schema_version: 1;
  providers: Provider[];
  accounts: Account[];
  skill: SkillState;
};
export type IntegrationChange = {
  schema_version: 1;
  account?: Account;
  removed?: { provider: ProviderId; address: string };
  kept_directories?: string[];
  trashed_directories?: string[];
  skill: SkillState;
};
export type Folder = {
  id: string;
  name: string;
  bytes?: number;
  suggested: boolean;
};
export type LoginFailure =
  | "expired"
  | "redirect_rejected"
  | "consent_required"
  | "device_code_blocked"
  | "account_mismatch"
  | "tool_failed"
  | "cancelled"
  | "quota_insufficient"
  | "quota_unavailable";
export type LoginView = {
  schema_version: 1;
  state:
    | "none"
    | "starting"
    | "device_code"
    | "open_url"
    | "completing"
    | "choose_folders"
    | "completed"
    | "failed";
  attempt_id?: string;
  provider?: ProviderId;
  address?: string;
  relogin?: boolean;
  expires_at?: string;
  verification_uri?: string;
  user_code?: string;
  login_phase?: "files" | "files_discovery" | "outlook" | "outlook_finishing";
  authorization_url?: string;
  redirect_prefix?: string;
  folders?: Folder[];
  unavailable_sites?: string[];
  directory?: string;
  progress?: SyncProgress;
  free_bytes?: number;
  quota_bytes?: number;
  failure?: LoginFailure;
  consent_url?: string;
};

export async function bounded(
  response: Response,
  limit: number,
): Promise<unknown> {
  if (
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw Error("unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw Error("invalid");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw Error("invalid");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(text);
}

/** A refusal the host gave with a fixed code; nothing was written. */
export class Refused extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

async function readReply<T>(
  response: Response,
  valid: (value: unknown) => boolean,
  limit: number,
): Promise<T> {
  if (response.status >= 400 && response.status < 500) {
    let code = "";
    try {
      const body = (await bounded(response, 4096)) as {
        error?: { code?: unknown };
      };
      if (typeof body?.error?.code === "string") code = body.error.code;
    } catch {}
    throw new Refused(response.status, /^[a-z_]{1,64}$/.test(code) ? code : "");
  }
  // A 5xx, a lost reply or an unreadable one is uncertain, never a refusal.
  if (!response.ok) throw Error("uncertain");
  const value = await bounded(response, limit);
  if (!valid(value)) throw Error("invalid");
  return value as T;
}

export async function readIntegrations(
  signal?: AbortSignal,
): Promise<IntegrationList> {
  const response = await fetch("/api/v1/integrations", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  return readReply(response, validList, 256 * 1024);
}

export async function readLogin(signal?: AbortSignal): Promise<LoginView> {
  const response = await fetch("/api/v1/integrations/login", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  return readReply(response, validLogin, 64 * 1024);
}

function write(
  command: "integrations.account" | "integrations.login",
  url: string,
  method: "POST" | "PUT" | "DELETE",
  csrf: string,
  body: unknown,
) {
  return mutationFetch(command, url, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Agent-Host-CSRF": csrf,
      Origin: window.location.origin,
    },
    body: JSON.stringify(body),
  });
}

export type PasswordAccount = {
  address: string;
  server: string;
  port: number;
  security: "tls" | "starttls";
  username: string;
  password: string;
  url?: string;
  smtp_server?: string;
  smtp_port?: number;
  smtp_security?: "tls" | "starttls";
};

export async function connectPasswordAccount(
  csrf: string,
  account: PasswordAccount,
  provider: ProviderId = "imap",
): Promise<IntegrationChange> {
  const response = await write(
    "integrations.account",
    "/api/v1/integrations/accounts",
    "POST",
    csrf,
    provider === "caldav" || provider === "carddav"
      ? {
          action: "connect",
          provider,
          address: account.address,
          url: account.url,
          username: account.username,
          password: account.password,
        }
      : { action: "connect", provider, ...account },
  );
  return readReply(response, validChange, 16 * 1024);
}

export async function changePassword(
  csrf: string,
  address: string,
  password: string,
  provider: ProviderId = "imap",
): Promise<IntegrationChange> {
  const response = await write(
    "integrations.account",
    "/api/v1/integrations/accounts",
    "POST",
    csrf,
    { action: "password", provider, address, password },
  );
  return readReply(response, validChange, 16 * 1024);
}

export async function removeAccount(
  csrf: string,
  provider: ProviderId,
  address: string,
  deleteDirectories: boolean,
): Promise<IntegrationChange> {
  const response = await write(
    "integrations.account",
    "/api/v1/integrations/accounts",
    "DELETE",
    csrf,
    {
      action: "remove",
      provider,
      address,
      delete_directories: deleteDirectories,
    },
  );
  return readReply(response, validChange, 16 * 1024);
}

type LoginControl =
  | { action: "start"; provider: ProviderId; address?: string }
  | { action: "redirect"; attempt_id: string; redirect_url: string }
  | { action: "folders"; attempt_id: string; folders: string[] }
  | { action: "cancel"; attempt_id: string };

export async function controlLogin(
  csrf: string,
  control: LoginControl,
): Promise<LoginView> {
  const method =
    control.action === "start"
      ? "POST"
      : control.action === "cancel"
        ? "DELETE"
        : "PUT";
  const response = await write(
    "integrations.login",
    "/api/v1/integrations/login",
    method,
    csrf,
    control,
  );
  return readReply(response, validLogin, 64 * 1024);
}

/** The person pasted the provider's own page, or something else, instead of
 * the loopback address the sign-in ended on. Checked before sending; the
 * daemon checks again and the tool checks the state. */
export function redirectMatches(prefix: string, raw: string): boolean {
  const value = raw.trim();
  if (!value.startsWith(prefix.replace(/\/$/, ""))) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      url.search.length > 1
    );
  } catch {
    return false;
  }
}

/** Gigabytes as the person reads them: "4,3 Gt". */
export function gigabytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  return `${gb.toLocaleString("fi-FI", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Gt`;
}

export function selectedBytes(folders: Folder[], selected: string[]): number {
  return folders
    .filter((f) => selected.includes(f.id))
    .reduce((sum, f) => sum + (f.bytes ?? 0), 0);
}

/** "9.38", the Finnish clock time of a status check. */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getHours()}.${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "klo 9.38" today, "23.10. klo 4.20" on an earlier day. */
export function syncedTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return `${today ? "" : `${d.getDate()}.${d.getMonth() + 1}. `}klo ${clockTime(iso)}`;
}

/** Minutes and seconds left, "14.59". */
export function minutesLeft(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}.${String(s % 60).padStart(2, "0")}`;
}

/** Services whose tool says the sign-in no longer works. */
export function needsSignIn(account: Account): boolean {
  return account.services.some(
    (s) =>
      s.state === "credentials_rejected" ||
      s.state === "login_expired" ||
      // A critical abort is not a sign-in problem: signing in again would
      // resync, which can bring back files deleted meanwhile.
      (s.state === "sync_failed" && s.failure !== "needs_resync"),
  );
}

/** A safe https link from the host, or nothing. The host already checked;
 * the page checks again before making it a link. */
export function safeHttps(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
