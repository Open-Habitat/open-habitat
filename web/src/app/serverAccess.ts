import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import accessSchema from "../../../contracts/v1/server-access.schema.json";
import { bounded } from "./integrations";
import { mutationFetch, writeOutcome } from "./mutations";

// Who may sign in (ADR 0030). The broker owns admission; the gateway joins
// administrators, denies and last use. The browser only asks, and shows a
// change as in force once the reply that confirms it has arrived.

const ajv = new Ajv({ strict: false });
addFormats(ajv);
ajv.addSchema(accessSchema);
const def = (name: string) =>
  ajv.compile({
    $ref: `https://open-habitat.invalid/contracts/v1/server-access.schema.json#/$defs/${name}`,
  });
const validList = def("list");
const validLookup = def("lookup");
const validChanged = def("changed");

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

export type AccessEntry = {
  id: string;
  source: "operator" | "site_admin" | "none";
  state: "allowed" | "joined" | "withdrawn" | "removed" | "denied";
  username?: string;
  login_hint?: string;
  actor?: string;
  at?: string;
  last_seen?: string;
  administrator: boolean;
  denied: boolean;
  onboarding?: OnboardingReceipt;
};
export type AccessView = {
  schema_version: 1;
  mode: "allowlist" | "any";
  runtime_admission: boolean;
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

const path = "/api/v1/server/access";

export async function readAccess(signal?: AbortSignal): Promise<AccessView> {
  const r = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!r.ok) throw new Error("Access list unavailable");
  const value = await bounded(r, 512 * 1024);
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
  // A lookup reads GitHub and changes nothing; only add and remove are writes.
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
 * access. Nothing is retried: a lost reply is reported as uncertain. */
export async function changeAccess(
  csrf: string,
  action: "add" | "remove",
  id: string,
): Promise<ChangeResult> {
  let response: Response | undefined;
  try {
    response = await post(`${path}/${action}`, { id }, csrf, true);
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

/** Accepts @name and a pasted profile address as well as the bare login. */
export const normalizeLogin = (raw: string) =>
  raw
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\/+$/, "")
    .replace(/^@/, "");

export const loginShape = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/** A refusal in words the administrator can act on. */
export function accessRefusal(code: string): string {
  switch (code) {
    case "github_user_not_found":
      return "GitHub-käyttäjää ei löydy.";
    case "github_not_user":
      return "Tunnus ei ole henkilön GitHub-tili.";
    case "runtime_admission_disabled":
      return "Lisäys selaimesta on poissa käytöstä.";
    case "runtime_admission_full":
      return "Sallittujen lista on täynnä.";
    case "admission_open":
      return "Pääsy on avoin kaikille.";
    case "operator_owned":
      return "Tämä pääsy tulee palvelimen asetuksista.";
    case "binding_drift":
      return "Palvelin ei voinut vahvistaa käyttäjätiliä. Tarkista se komentorivillä.";
    case "admin_required":
      return "Vain ylläpitäjä voi muuttaa pääsyä.";
    default:
      return "Palvelin ei tehnyt muutosta.";
  }
}
