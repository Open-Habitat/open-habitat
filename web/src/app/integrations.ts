import accountSchema from "../../../contracts/v1/integration-account.schema.json";
import changeSchema from "../../../contracts/v1/integration-change.schema.json";
import loginSchema from "../../../contracts/v1/integration-login.schema.json";
import listSchema from "../../../contracts/v1/integrations.schema.json";
import { currentLanguage, formatDate, formatNumber } from "../i18n";
import type { GiteaConnections } from "./gitea";
import type { GitLabConnections } from "./gitlab";
import { LazyAjv } from "./lazyAjv";
import { mutationFetch } from "./mutations";

// Asetukset › Tiedot agenteille reads and writes through the person's daemon
// (ADR 0026). Every reply is validated against the contract before the page
// sees it, under a size cap, and any failure is a generic error: native text
// never reaches the page.

const ajv = new LazyAjv({ strict: false, addFormats: true });
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
  | "dropbox"
  | "apple"
  | "gitea"
  | "gitlab"
  | "atlassian"
  | "trello";
export type ServiceId =
  | "mail"
  | "calendar"
  | "contacts"
  | "drive"
  | "onedrive"
  | "sharepoint"
  | "dropbox"
  | "git"
  | "jira"
  | "confluence"
  | "trello";
export type ServiceState =
  | "ok"
  | "syncing"
  | "sync_failed"
  | "credentials_rejected"
  | "login_expired"
  | "unreachable"
  | "sync_restarting"
  | "quota_full"
  | "unknown"
  | "pending_first_sync";
export type LoginKind =
  | "app_password"
  | "pasted_redirect"
  | "device_code"
  | "personal_token";
export type SkillState = "current" | "none" | "blocked" | "failed";

export type Provider = {
  id: ProviderId;
  available: boolean;
  unavailable_reason?: "app_credentials_required" | "tool_unavailable";
  /** With tool_unavailable: the catalog's tools the installation lacks. */
  missing_tools?: string[];
  /** The tool's own account files could not be read safely, so its
   * accounts are missing from the list rather than absent. */
  accounts_unreadable?: true;
  login: LoginKind;
  services: ServiceId[];
  /** The account levels a sign-in chooses from, broadest first; only for
   * a provider that offers a choice. reason says why a level cannot be
   * chosen: the administrator has not registered its application, or the
   * provider has no such boundary. */
  levels?: {
    id: Level;
    available: boolean;
    reason?: "application_missing" | "not_offered";
  }[];
};
/** An account level the provider itself enforces. */
export type Level = "full" | "nosend" | "drafts" | "read" | "app_folder";
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
  /** With quota_insufficient: the counted size of the chosen files and the
   * room they did not fit, when known. */
  needed_bytes?: number;
  free_bytes?: number;
  /** What the provider's grant lets the service do, read from the grant;
   * absent when it cannot be read. */
  access?: Access;
};
export type Access = "full" | "drafts" | "read" | "none";
/** The provider's grant in its own scope names. */
export type Grant = { granted: string[]; not_granted: string[] };
export type SyncFailure =
  | "quota_insufficient"
  | "quota_unavailable"
  | "initial_sync_incomplete"
  // A working login whose files never had a first pass: left out, or
  // refused before anything was copied.
  | "not_chosen"
  | "initial_sync_resume_failed"
  | "delete_limit"
  | "all_changed"
  | "needs_resync"
  | "remote_unreachable"
  | "pass_failed"
  // login_expired on every service: the account's native configuration could
  // not follow the server's current application.
  | "app_changed"
  | "tenant_changed"
  | "outside_tenant";
export type Account = {
  provider: ProviderId;
  address: string;
  services: Service[];
  checked_at: string;
  /** Set when the account's stored server is Apple's iCloud: the Apple ID
   * whose card shows it. */
  apple_id?: string;
  grant?: Grant;
  /** The level the grant amounts to, read from the grant; absent when it
   * cannot be read or is none of the levels. */
  level?: Level;
};
export type IntegrationList = {
  schema_version: 1;
  providers: Provider[];
  accounts: Account[];
  /** tea's Gitea logins, read from its file alone (ADR 0031). */
  gitea?: GiteaConnections;
  /** glab's GitLab host logins, read from its file alone. */
  gitlab?: GitLabConnections;
  skill: SkillState;
};
export type IntegrationChange = {
  schema_version: 1;
  account?: Account;
  removed?: { provider: ProviderId; address: string };
  /** An Apple write: the accounts it connected or renewed. */
  accounts?: Account[];
  /** An Apple write: the chosen services it could not connect. */
  failed?: { service: AppleService; failure: string }[];
  kept_directories?: string[];
  trashed_directories?: string[];
  skill: SkillState;
};
export type Folder = {
  id: string;
  name: string;
  bytes?: number;
  /** bytes is the provider's own accounting, not a count of the files. */
  estimated?: true;
  /** The size is being counted while the person chooses. */
  measuring?: true;
  /** The whole drive, which holds every other folder; chosen alone. */
  whole?: true;
  suggested: boolean;
};
export type LoginFailure =
  | "expired"
  | "permission_refused"
  | "redirect_rejected"
  | "consent_required"
  | "device_code_blocked"
  | "account_mismatch"
  | "tool_failed"
  | "cancelled"
  | "quota_insufficient"
  | "quota_unavailable"
  | "nothing_granted"
  | "final_sync_failed"
  | "revoke_failed"
  | "already_connected";
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
  teams_left_out?:
    | "not_granted"
    | "refused"
    | "channels_not_granted"
    | "too_many";
  /** With too_many: the teams left out whole, by name. */
  teams_not_offered?: string[];
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

/** The session's sign-in for provider, or its latest one without. Each
 * provider has its own attempt, so a dialog reads only its own. */
export async function readLogin(
  signal?: AbortSignal,
  provider?: ProviderId,
): Promise<LoginView> {
  const query = provider ? `?provider=${encodeURIComponent(provider)}` : "";
  const response = await fetch(`/api/v1/integrations/login${query}`, {
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

/** The provider whose card shows an account: an account on Apple's
 * servers belongs to the Apple card whatever form connected it. */
export const listedProvider = (a: Account): ProviderId =>
  a.apple_id ? "apple" : a.provider;

export type AppleService = "mail" | "calendar" | "contacts";
export const appleServices: AppleService[] = ["mail", "calendar", "contacts"];
const appleServiceProvider: Record<AppleService, ProviderId> = {
  mail: "imap",
  calendar: "caldav",
  contacts: "carddav",
};
export const appleServiceOf = (a: Account): AppleService | undefined =>
  appleServices.find((s) => appleServiceProvider[s] === a.provider);

/** One card per Apple ID, with its services in the page's order. */
export function appleGroups(
  accounts: Account[],
): { appleId: string; accounts: Account[] }[] {
  const groups = new Map<string, Account[]>();
  for (const a of accounts)
    if (a.apple_id)
      groups.set(a.apple_id, [...(groups.get(a.apple_id) ?? []), a]);
  return [...groups].map(([appleId, list]) => ({
    appleId,
    accounts: appleServices.flatMap((s) =>
      list.filter((a) => appleServiceOf(a) === s),
    ),
  }));
}

/** The addresses iCloud Mail signs in with (Apple: a custom-domain address
 * still signs in with the primary @icloud.com one). */
export const iCloudMail = (address: string) =>
  /^[a-z0-9._%+-]{1,64}@(icloud|me|mac)\.com$/.test(address);

/** Connect Apple services with one app-specific password; without a
 * password the daemon reuses the one stored in that Apple ID's own
 * accounts, which the browser never sees. */
export async function connectApple(
  csrf: string,
  appleId: string,
  services: AppleService[],
  password?: string,
  mailAddress?: string,
): Promise<IntegrationChange> {
  const response = await write(
    "integrations.account",
    "/api/v1/integrations/accounts",
    "POST",
    csrf,
    {
      action: password === undefined ? "add" : "connect",
      provider: "apple",
      address: appleId,
      services,
      ...(password === undefined ? {} : { password }),
      ...(mailAddress ? { mail_address: mailAddress } : {}),
    },
  );
  return readReply(response, validChange, 32 * 1024);
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
  | { action: "start"; provider: ProviderId; address?: string; level?: Level }
  | { action: "redirect"; attempt_id: string; redirect_url: string }
  | { action: "folders"; attempt_id: string; folders: string[] }
  | { action: "skip_folders"; attempt_id: string }
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

/** Gigabytes as the person reads them: "4,3 Gt", "4.3 GB". */
export function gigabytes(bytes: number): string {
  const gb = formatNumber(bytes / 1024 ** 3, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${gb} ${currentLanguage() === "fi" ? "Gt" : "GB"}`;
}

export function selectedBytes(folders: Folder[], selected: string[]): number {
  return folders
    .filter((f) => selected.includes(f.id))
    .reduce((sum, f) => sum + (f.bytes ?? 0), 0);
}

/** The clock time of a status check: "9.38" in Finnish, "09:38" in English. */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDate(d, { hour: "numeric", minute: "2-digit" });
}

/** "klo 9.38" today, "23.10. klo 4.20" on an earlier day (in English
 * "at 09:38", "23/10 at 04:20"). */
export function syncedTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const at = `${currentLanguage() === "fi" ? "klo" : "at"} ${clockTime(iso)}`;
  return today
    ? at
    : `${formatDate(d, { day: "numeric", month: "numeric" })} ${at}`;
}

/** Minutes and seconds left, "14.59" ("14:59" in English). */
export function minutesLeft(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const separator = currentLanguage() === "fi" ? "." : ":";
  return `${Math.floor(s / 60)}${separator}${String(s % 60).padStart(2, "0")}`;
}

/** Services whose tool says the sign-in no longer works. */
export function needsSignIn(account: Account): boolean {
  return account.services.some(
    (s) =>
      s.state === "credentials_rejected" ||
      // An account outside the application's tenant cannot sign in to it.
      (s.state === "login_expired" && s.failure !== "outside_tenant") ||
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
