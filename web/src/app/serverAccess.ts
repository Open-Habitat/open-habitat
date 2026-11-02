import accessSchema from "../../../contracts/v1/server-access.schema.json";
import { liveText } from "../i18n";
import { serverAccessText } from "../text/serverAccess";
import { bounded } from "./integrations";
import { LazyAjv } from "./lazyAjv";
import { mutationFetch, writeOutcome } from "./mutations";

const txt = liveText(serverAccessText);

// Who may sign in (ADR 0030). The broker owns admission; the gateway joins
// administrators, denies and last use. The browser only asks, and shows a
// change as in force once the reply that confirms it has arrived.

const ajv = new LazyAjv({ strict: false, addFormats: true });
ajv.addSchema(accessSchema);
const def = (name: string) =>
  ajv.compile({
    $ref: `https://open-habitat.invalid/contracts/v1/server-access.schema.json#/$defs/${name}`,
  });
const validList = def("list");
const validLookup = def("lookup");
const validChanged = def("changed");
const validTeamsChanged = def("teams_changed");

/** What the sign-in that created the account did with the site's own
 * defaults, recorded then and never updated: a clone handed over, not one
 * finished. Only administrators' reads carry it. */
export type OnboardingReceipt = {
  at: string;
  mode: "preselected" | "auto" | "skip";
  defaults: {
    repository: string;
    outcome:
      | "no_access"
      | "check_failed"
      | "queued"
      | "already_present"
      | "unknown"
      | "preselected";
  }[];
  ai_key: "seeded" | "already_present" | "failed" | "unknown" | "not_offered";
};

/** An id's administrator role: root's from site.json (operator) or an
 * administrator's designation here (site_admin), held now or from the sign-in
 * that binds the id. */
export type AdministratorRole = {
  source: "operator" | "site_admin";
  state: "pending" | "granted";
  actor?: string;
  at?: string;
};

export type AccessEntry = {
  id: string;
  source: "operator" | "site_admin" | "team" | "none";
  state:
    | "allowed"
    | "joined"
    | "withdrawn"
    | "removed"
    | "denied"
    | "unlisted"
    | "left"
    | "unconfirmed";
  username?: string;
  login_hint?: string;
  actor?: string;
  at?: string;
  last_seen?: string;
  administrator: boolean;
  denied: boolean;
  onboarding?: OnboardingReceipt;
  /** The site AI key copy the site gave this person, from its own record. */
  site_key_copy?: {
    provider: "openai" | "anthropic" | "deepseek";
    suffix: string;
    at: string;
    current: boolean;
  };
  administrator_role?: AdministratorRole;
  /** The latest sign-in's team answer and the teams (organisation/slug) the
   * person was last confirmed in; for left, the teams left. */
  team_state?: "member" | "left" | "unconfirmed";
  teams?: string[];
};
/** A listed GitHub team whose active members may sign in. */
export type AccessTeam = {
  org_id: string;
  org: string;
  slug: string;
  /** A member check has bound the slug to the team's own id; nobody is
   * admitted through it before that. */
  pinned: boolean;
  actor: string;
  at: string;
  /** GitHub did not answer the membership question at the latest sign-in
   * that asked it. */
  unavailable_at?: string;
};
export type AccessView = {
  schema_version: 1;
  mode: "allowlist" | "any";
  runtime_admission: boolean;
  teams: AccessTeam[];
  entries: AccessEntry[];
};
export type GitHubAccount = { id: string; login: string; name: string };

export type LookupResult =
  | { kind: "found"; user: GitHubAccount }
  | { kind: "refused"; code: string }
  | { kind: "unavailable" };
export type ChangeResult =
  | { kind: "changed"; entry: AccessEntry }
  | { kind: "refused"; code: string }
  | { kind: "uncertain" }
  | { kind: "login" };
export type TeamsResult =
  | { kind: "changed"; teams: AccessTeam[] }
  | { kind: "refused"; code: string }
  | { kind: "uncertain" }
  | { kind: "login" };

const path = "/api/v1/server/access";

export async function readAccess(signal?: AbortSignal): Promise<AccessView> {
  const r = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!r.ok) throw new Error("Access list unavailable");
  // Rows carry sign-in receipts: up to 20 defaults each.
  const value = await bounded(r, 4 * 1024 * 1024);
  if (!validList(value)) throw new Error("Invalid access list");
  return value as AccessView;
}

const post = (url: string, body: unknown, csrf: string, change: boolean) => {
  const init = {
    method: "POST" as const,
    credentials: "same-origin" as const,
    cache: "no-store" as const,
    headers: {
      "Content-Type": "application/json",
      "X-Agent-Host-CSRF": csrf,
    },
    body: JSON.stringify(body),
  };
  // A lookup reads GitHub and changes nothing; every other post is a write.
  return change ? mutationFetch("server.access", url, init) : fetch(url, init);
};

export async function lookupLogin(
  csrf: string,
  login: string,
): Promise<LookupResult> {
  let response: Response | undefined;
  try {
    response = await post(`${path}/lookup`, { login }, csrf, false);
  } catch {
    return { kind: "unavailable" };
  }
  const outcome = await writeOutcome(response);
  if (outcome.kind === "refused")
    return { kind: "refused", code: outcome.code };
  if (outcome.kind !== "ok") return { kind: "unavailable" };
  try {
    const value = await bounded(outcome.response, 4096);
    if (validLookup(value)) {
      const { id, login, name } = value as GitHubAccount;
      return { kind: "found", user: { id, login, name } };
    }
  } catch {}
  return { kind: "unavailable" };
}

/** add admits a new id or restores a withdrawn one; remove withdraws web
 * access; forget dismisses a leaver's notice; grant and revoke designate an
 * administrator or undo that designation. Nothing is retried: a lost reply
 * is reported as uncertain. */
export async function changeAccess(
  csrf: string,
  action: "add" | "remove" | "forget" | "grant" | "revoke",
  id: string,
): Promise<ChangeResult> {
  let response: Response | undefined;
  try {
    response =
      action === "grant" || action === "revoke"
        ? await post(
            `${path}/role`,
            { id, administrator: action === "grant" },
            csrf,
            true,
          )
        : await post(`${path}/${action}`, { id }, csrf, true);
  } catch {
    return { kind: "uncertain" };
  }
  const outcome = await writeOutcome(response);
  if (outcome.kind === "refused")
    return { kind: "refused", code: outcome.code };
  if (outcome.kind !== "ok") return outcome;
  try {
    const value = await bounded(outcome.response, 4096);
    if (validChanged(value))
      return {
        kind: "changed",
        entry: (value as { entry: AccessEntry }).entry,
      };
  } catch {}
  return { kind: "uncertain" };
}

/** Lists organisation/team as an admission source, or removes one. The reply
 * is the teams as the broker now keeps them. */
export async function changeTeams(
  csrf: string,
  change: { add: string } | { remove: { org_id: string; slug: string } },
): Promise<TeamsResult> {
  let response: Response | undefined;
  try {
    response =
      "add" in change
        ? await post(`${path}/teams/add`, { team: change.add }, csrf, true)
        : await post(`${path}/teams/remove`, change.remove, csrf, true);
  } catch {
    return { kind: "uncertain" };
  }
  const outcome = await writeOutcome(response);
  if (outcome.kind === "refused")
    return { kind: "refused", code: outcome.code };
  if (outcome.kind !== "ok") return outcome;
  try {
    const value = await bounded(outcome.response, 16384);
    if (validTeamsChanged(value))
      return {
        kind: "changed",
        teams: (value as { teams: AccessTeam[] }).teams,
      };
  } catch {}
  return { kind: "uncertain" };
}

/** organisation/team as typed, or the team's GitHub address; the slug is
 * lowercase on GitHub. Anything else is not a team. */
export function teamInput(raw: string): string | undefined {
  let s = raw.trim().replace(/^@/, "");
  const address = s.match(
    /^https?:\/\/(?:www\.)?github\.com\/orgs\/([^/]+)\/teams\/([^/]+)\/?$/i,
  );
  if (address) s = `${address[1]}/${address[2]}`;
  const [org, slug, ...rest] = s.split("/");
  if (rest.length || !org || !slug || !loginShape.test(org)) return undefined;
  const lower = slug.toLowerCase();
  return /^[a-z0-9_](?:[a-z0-9_-]{0,62}[a-z0-9_])?$/.test(lower)
    ? `${org}/${lower}`
    : undefined;
}

/** Accepts @name and a pasted profile address as well as the bare login. */
export const normalizeLogin = (raw: string) =>
  raw
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\/+$/, "")
    .replace(/^@/, "");

export const loginShape = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/** The logins in a field that may hold several, separated by commas,
 * spaces or newlines; each normalized, a repeat (GitHub logins ignore case)
 * dropped. */
export function splitLogins(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    const login = normalizeLogin(part);
    if (!login || seen.has(login.toLowerCase())) continue;
    seen.add(login.toLowerCase());
    out.push(login);
  }
  return out;
}

/** A refusal in words the administrator can act on. */
export function accessRefusal(code: string): string {
  return txt.refusals[code] ?? txt.refused;
}
