import changeSchema from "../../../contracts/v1/gitlab-connection-change.schema.json";
import reposSchema from "../../../contracts/v1/gitlab-repos.schema.json";
import tokensSchema from "../../../contracts/v1/gitlab-tokens.schema.json";
import listSchema from "../../../contracts/v1/integrations.schema.json";
import { formatDate } from "../i18n";
import type { GiteaGit } from "./gitea";
import { bounded, Refused } from "./integrations";
import { LazyAjv } from "./lazyAjv";
import { mutationFetch } from "./mutations";

// GitLab connections are glab's own host logins in the person's home
// (research gitlab-integration, recommendation A): the page sends an address
// and a personal access token once, to the person's daemon, and never keeps
// the token. glab keeps one account per server. Every reply is validated
// against the contract before the page sees it.

const ajv = new LazyAjv({ strict: false, addFormats: true });
ajv.addSchema(listSchema);
ajv.addSchema(changeSchema);
const validChange = ajv.compile(changeSchema);
const validRepos = ajv.compile(reposSchema);
const validTokens = ajv.compile(tokensSchema);

export type GitLabConnection = {
  id: string;
  base_url?: string;
  user?: string;
  kind: "pat" | "oauth" | "keyring" | "insecure" | "invalid";
  ambiguous: boolean;
  git: GiteaGit;
};
export type GitLabConnections = {
  state: "ok" | "unavailable";
  connections: GitLabConnection[];
};
export type GitLabAPI =
  | "ok"
  | "token_rejected"
  | "token_expired"
  | "insufficient_scope"
  | "account_mismatch"
  | "unreachable"
  | "tls_untrusted"
  | "redirect_refused"
  | "forbidden_destination"
  | "not_gitlab";
/** What GitLab says about a token now. scopes, expires_at and fine are
 * present only when GitLab described the token. */
export type GitLabToken = {
  push: "yes" | "no" | "unknown";
  scopes?: string[];
  expires_at?: string | null;
  fine?: boolean;
};
export type GitLabChange = {
  schema_version: 1;
  outcome: "written" | "unchanged" | "absent" | "checked";
  connection?: GitLabConnection;
  api?: GitLabAPI;
  token?: GitLabToken;
  removed?: { id: string };
};
export type GitLabTokenState = {
  connection_id: string;
  api: GitLabAPI | "native_unavailable";
  token?: GitLabToken;
};
export type GitLabRepository = {
  id: number;
  /** The whole project path, group/subgroup/.../project. */
  full_name: string;
  visibility: "private" | "internal" | "public";
  description: string;
  html_url: string;
  activity_at: string | null;
  size_kib: number | null;
  default_branch: string | null;
  empty: boolean;
  archived: boolean;
  personal: boolean;
  own: boolean;
};
export type GitLabSource = {
  connection_id: string;
  base_url: string;
  user: string;
  state: "ok" | "failed";
  failure?: string;
  complete: boolean;
  incomplete?: "limit" | "interrupted" | "inconsistent";
  elsewhere?: { count: number; origin?: string };
  repositories: GitLabRepository[];
};

/** A connection the connector can use: a token login nothing duplicates. */
export const usableGitLab = (c: GitLabConnection) =>
  c.kind === "pat" && !c.ambiguous && !!c.base_url && !!c.user;

/** The address the form starts from. */
export const defaultGitLab = "https://gitlab.com";

/** GitLab's own page for a new personal access token, filled in with the
 * name and the two scopes the connection needs; the person picks the
 * expiry. */
export const tokenPage = (base: string) =>
  `${base.replace(/\/$/, "")}/-/user_settings/personal_access_tokens?name=Open+Habitat&scopes=read_api,write_repository`;

const day = 86400000;
/** Whole days from now to the end of an expiry date (GitLab's tokens stop
 * working at the start of that day, UTC); negative once it has passed. */
export function daysLeft(expires: string, now: number): number {
  return Math.ceil((Date.parse(`${expires}T00:00:00Z`) - now) / day);
}
/** From this many days left the card warns and offers a new token. */
export const expirySoonDays = 30;

/** 27.10.2027 for 2027-10-27. */
export function fiDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return formatDate(new Date(y, m - 1, d), {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

async function write(
  method: "POST" | "DELETE",
  csrf: string,
  body: unknown,
): Promise<GitLabChange> {
  const response = await mutationFetch(
    "integrations.gitlab",
    "/api/v1/integrations/gitlab",
    {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Host-CSRF": csrf,
        Origin: window.location.origin,
      },
      body: JSON.stringify(body),
    },
  );
  if (response.status >= 400 && response.status < 500) {
    let code = "";
    try {
      const value = (await bounded(response, 4096)) as {
        error?: { code?: unknown };
      };
      if (typeof value?.error?.code === "string") code = value.error.code;
    } catch {}
    throw new Refused(response.status, /^[a-z_]{1,64}$/.test(code) ? code : "");
  }
  // A 5xx, a lost reply or an unreadable one is uncertain: the page reads
  // glab's state again and never repeats the write.
  if (!response.ok) throw Error("uncertain");
  const value = await bounded(response, 64 * 1024);
  if (!validChange(value)) throw Error("uncertain");
  return value as GitLabChange;
}

export function connectGitLab(
  csrf: string,
  baseURL: string,
  token: string,
): Promise<GitLabChange> {
  return write("POST", csrf, { action: "connect", base_url: baseURL, token });
}

export function replaceGitLabToken(
  csrf: string,
  connectionID: string,
  token: string,
): Promise<GitLabChange> {
  return write("POST", csrf, {
    action: "replace",
    connection_id: connectionID,
    token,
  });
}

export function gitlabAction(
  csrf: string,
  action: "check" | "repair" | "disconnect",
  connectionID: string,
): Promise<GitLabChange> {
  return write(action === "disconnect" ? "DELETE" : "POST", csrf, {
    action,
    connection_id: connectionID,
  });
}

async function read<T>(
  path: string,
  limit: number,
  valid: (v: unknown) => boolean,
  signal?: AbortSignal,
): Promise<T | undefined> {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (response.status === 409 || response.status === 404) return undefined;
  if (!response.ok) throw Error("unavailable");
  const value = await bounded(response, limit);
  if (!valid(value)) throw Error("invalid");
  return value as T;
}

/** Each connection's projects as its own source. A GitLab the installation
 * does not offer answers no sources, not a failure. */
export async function gitlabRepos(
  signal?: AbortSignal,
): Promise<GitLabSource[]> {
  const value = await read<{ sources: GitLabSource[] }>(
    "/api/v1/integrations/gitlab/repos",
    4 * 1024 * 1024,
    validRepos,
    signal,
  );
  return value?.sources ?? [];
}

/** What GitLab says about each usable connection's token now. */
export async function gitlabTokens(
  signal?: AbortSignal,
): Promise<GitLabTokenState[]> {
  const value = await read<{ connections: GitLabTokenState[] }>(
    "/api/v1/integrations/gitlab/tokens",
    64 * 1024,
    validTokens,
    signal,
  );
  return value?.connections ?? [];
}
