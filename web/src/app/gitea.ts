import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import changeSchema from "../../../contracts/v1/gitea-connection-change.schema.json";
import reposSchema from "../../../contracts/v1/gitea-repos.schema.json";
import listSchema from "../../../contracts/v1/integrations.schema.json";
import { bounded, Refused } from "./integrations";
import { mutationFetch } from "./mutations";

// Gitea connections are tea's own logins in the person's home (ADR 0031):
// the page sends an address and a personal access token once, to the
// person's daemon, and never keeps the token. Every reply is validated
// against the contract before the page sees it.

const ajv = new Ajv({ strict: false });
addFormats(ajv);
ajv.addSchema(listSchema);
const validChange = ajv.compile(changeSchema);
const validRepos = ajv.compile(reposSchema);

export type GiteaGit =
  | "registered"
  | "absent"
  | "foreign"
  | "shadowed"
  | "unknown";
export type GiteaConnection = {
  id: string;
  base_url?: string;
  user?: string;
  kind: "pat" | "oauth" | "ssh" | "insecure" | "invalid";
  owned: boolean;
  ambiguous: boolean;
  git: GiteaGit;
};
export type GiteaConnections = {
  state: "ok" | "unavailable";
  connections: GiteaConnection[];
};
export type GiteaAPI =
  | "ok"
  | "token_rejected"
  | "insufficient_scope"
  | "account_mismatch"
  | "unreachable"
  | "tls_untrusted"
  | "redirect_refused"
  | "forbidden_destination"
  | "not_gitea";
export type GiteaChange = {
  schema_version: 1;
  outcome: "written" | "unchanged" | "absent" | "checked";
  connection?: GiteaConnection;
  api?: GiteaAPI;
  removed?: { id: string };
};
export type GiteaRepository = {
  id: number;
  full_name: string;
  private: boolean;
  description: string;
  html_url: string;
  updated_at: string | null;
  size_kib: number;
  default_branch: string | null;
  empty: boolean;
  archived: boolean;
  /** Gitea's owner id is the connected account's. */
  owned: boolean;
};
export type GiteaSource = {
  connection_id: string;
  base_url: string;
  user: string;
  state: "ok" | "failed";
  failure?: string;
  complete: boolean;
  incomplete?: "limit" | "interrupted" | "inconsistent";
  repositories: GiteaRepository[];
};

/** A connection the connector can use: a PAT login nothing duplicates. */
export const usable = (c: GiteaConnection) =>
  c.kind === "pat" && !c.ambiguous && !!c.base_url && !!c.user;

/** Git can use the connection's token for clone and fetch. */
export const gitReady = (c: GiteaConnection) => c.git === "registered";

/** "git.example.org/gitea" for a base URL: what the person typed. */
export const host = (baseURL: string) => baseURL.replace(/^https:\/\//, "");

/** The address as the form sends it: https:// is added only when the
 * person gave no scheme (a host:port is not a scheme), and nothing else is
 * corrected (connect-riff round 2, Jari's address feedback). */
export function giteaAddress(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  if (/^(?:[\w.-]+|\[[\da-fA-F:]+\]):\d+(?:\/|$)/.test(value))
    return `https://${value}`;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return value;
  return `https://${value}`;
}

async function write(
  method: "POST" | "DELETE",
  csrf: string,
  body: unknown,
): Promise<GiteaChange> {
  const response = await mutationFetch(
    "integrations.gitea",
    "/api/v1/integrations/gitea",
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
  // tea's state again and never repeats the write.
  if (!response.ok) throw Error("uncertain");
  const value = await bounded(response, 64 * 1024);
  if (!validChange(value)) throw Error("uncertain");
  return value as GiteaChange;
}

export function connectGitea(
  csrf: string,
  baseURL: string,
  token: string,
): Promise<GiteaChange> {
  return write("POST", csrf, {
    action: "connect",
    base_url: giteaAddress(baseURL),
    token,
  });
}

export function replaceGiteaToken(
  csrf: string,
  connectionID: string,
  token: string,
): Promise<GiteaChange> {
  return write("POST", csrf, {
    action: "replace",
    connection_id: connectionID,
    token,
  });
}

export function giteaAction(
  csrf: string,
  action: "check" | "repair" | "disconnect",
  connectionID: string,
): Promise<GiteaChange> {
  return write(action === "disconnect" ? "DELETE" : "POST", csrf, {
    action,
    connection_id: connectionID,
  });
}

/** Each connection's repositories as its own source. A Gitea the
 * installation does not offer answers no sources, not a failure. */
export async function giteaRepos(signal?: AbortSignal): Promise<GiteaSource[]> {
  const response = await fetch("/api/v1/integrations/gitea/repos", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (response.status === 409 || response.status === 404) return [];
  if (!response.ok) throw Error("unavailable");
  const value = await bounded(response, 4 * 1024 * 1024);
  if (!validRepos(value)) throw Error("invalid");
  return (value as { sources: GiteaSource[] }).sources;
}
