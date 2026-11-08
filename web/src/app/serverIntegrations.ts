import schema from "../../../contracts/v1/server-integrations.schema.json";
import { liveText } from "../i18n";
import { serverIntegrationsText } from "../text/serverIntegrations";
import type { Level, ProviderId } from "./integrations";
import { bounded } from "./integrations";
import { LazyAjv } from "./lazyAjv";
import { mutationFetch, writeOutcome } from "./mutations";

const txt = liveText(serverIntegrationsText);

// The providers' app credentials (server-integrations-admin). The root broker
// writes them into the installation's integrations file on the gateway's
// request; the browser asks and shows a change as in force once the reply
// that confirms it has arrived. A secret is sent once and never comes back.

const ajv = new LazyAjv({ strict: false, addFormats: true });
ajv.addSchema(schema);
const validList = ajv.compile({
  $ref: "https://open-habitat.invalid/contracts/v1/server-integrations.schema.json#/$defs/list",
});

export type AppProvider = Extract<
  ProviderId,
  "google" | "microsoft" | "dropbox"
>;
export const appProviders: AppProvider[] = ["google", "microsoft", "dropbox"];
export const isAppProvider = (p: ProviderId): p is AppProvider =>
  (appProviders as ProviderId[]).includes(p);

/** A section of root's file: a provider's own application, its full level,
 * or the separate application of one of its narrower account levels. */
export type AppSection =
  | AppProvider
  | "microsoft_nosend"
  | "microsoft_drafts"
  | "microsoft_read"
  | "dropbox_app_folder";
/** The narrower levels' sections of each provider, broadest first. */
export const levelSections: Partial<
  Record<AppProvider, { section: AppSection; level: Level }[]>
> = {
  microsoft: [
    { section: "microsoft_nosend", level: "nosend" },
    { section: "microsoft_drafts", level: "drafts" },
    { section: "microsoft_read", level: "read" },
  ],
  dropbox: [{ section: "dropbox_app_folder", level: "app_folder" }],
};
/** The provider a section registers an application for. */
export const sectionProvider = (section: AppSection): AppProvider =>
  section.split("_")[0] as AppProvider;

export type IntegrationApp = {
  provider: AppSection;
  client_id?: string;
  tenant_id?: string;
  usable: boolean;
  source: "site_admin" | "operator";
  actor?: string;
  at?: string;
};
export type IntegrationApps = {
  schema_version: 1;
  browser_setup: boolean;
  apps: IntegrationApp[];
};
export type AppFields = Record<string, string>;

export type AppChange =
  | { kind: "changed"; view: IntegrationApps }
  | { kind: "refused"; code: string }
  | { kind: "uncertain" }
  | { kind: "login" };

const path = "/api/v1/server/integrations";

export async function readIntegrationApps(
  signal?: AbortSignal,
): Promise<IntegrationApps> {
  const r = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!r.ok) throw new Error("Integration apps unavailable");
  const value = await bounded(r, 16384);
  if (!validList(value)) throw new Error("Invalid integration apps");
  return value as IntegrationApps;
}

/** set writes the provider's whole section, clear removes it. Nothing is
 * retried: a lost reply is reported as uncertain. */
export async function changeIntegrationApp(
  csrf: string,
  provider: AppSection,
  fields?: AppFields,
): Promise<AppChange> {
  let response: Response | undefined;
  try {
    response = await mutationFetch(
      "server.integrations",
      `${path}/${fields ? "set" : "clear"}`,
      {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Host-CSRF": csrf,
        },
        body: JSON.stringify(fields ? { provider, fields } : { provider }),
      },
    );
  } catch {
    return { kind: "uncertain" };
  }
  const outcome = await writeOutcome(response);
  if (outcome.kind === "refused")
    return { kind: "refused", code: outcome.code };
  if (outcome.kind !== "ok") return outcome;
  try {
    const value = await bounded(outcome.response, 16384);
    if (validList(value))
      return { kind: "changed", view: value as IntegrationApps };
  } catch {}
  return { kind: "uncertain" };
}

// The broker's own rule (internal/integrationapps.Valid), so that a value the
// broker would refuse is caught in its field before anything is sent.
const googleID = /^[0-9]{1,20}-[a-z0-9]{1,64}\.apps\.googleusercontent\.com$/;
const googleValue = /^[A-Za-z0-9._-]{1,256}$/;
const dropboxValue = /^[A-Za-z0-9_-]{1,256}$/;
const guid =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const appFields: Record<AppProvider, [string, string]> = {
  google: ["client_id", "client_secret"],
  microsoft: ["client_id", "tenant_id"],
  dropbox: ["client_id", "client_secret"],
};

/** Why every daemon ignores root's existing section, judged from its public
 * ids (the list never carries a secret): "audience" is a Microsoft section
 * written before the app became single tenant (common, organizations or
 * consumers), "tenant" and "client" a missing or malformed id, "other"
 * anything the browser cannot see, such as a secret. Undefined when usable. */
export type InvalidApp = "audience" | "tenant" | "client" | "other";
export function invalidApp(app: IntegrationApp): InvalidApp | undefined {
  if (app.usable) return undefined;
  if (sectionProvider(app.provider) === "microsoft") {
    const t = app.tenant_id?.toLowerCase() ?? "";
    if (["common", "organizations", "consumers"].includes(t)) return "audience";
    if (!guid.test(app.client_id ?? "")) return "client";
    if (!guid.test(t)) return "tenant";
  } else if (!app.client_id) return "client";
  return "other";
}

/** Field errors for a section, keyed by field; empty when the broker would
 * accept it. Values are trimmed by the caller. */
export function appErrors(
  section: AppSection,
  f: AppFields,
): Partial<Record<string, string>> {
  const provider = sectionProvider(section);
  const [first, second] = appFields[provider];
  const e: Partial<Record<string, string>> = {};
  const a = f[first] ?? "";
  const b = f[second] ?? "";
  if (provider === "google") {
    if (!googleID.test(a)) e[first] = txt.errors.googleId;
    if (!googleValue.test(b)) e[second] = txt.errors.googleSecret;
  } else if (provider === "dropbox") {
    if (!dropboxValue.test(a)) e[first] = txt.errors.dropboxKey;
    if (!dropboxValue.test(b)) e[second] = txt.errors.dropboxSecret;
  } else {
    // A single-tenant app: the tenant is the organisation's GUID, never an
    // audience such as common.
    if (!guid.test(a)) e[first] = txt.errors.microsoftClient;
    if (!guid.test(b)) e[second] = txt.errors.microsoftTenant;
  }
  // Both values sit on the same console page, so the same one pasted twice
  // is the likeliest mistake; the broker compares them without case.
  if (!e[first] && !e[second] && a.toLowerCase() === b.toLowerCase())
    e[second] = {
      google: txt.errors.sameGoogle,
      microsoft: txt.errors.sameMicrosoft,
      dropbox: txt.errors.sameDropbox,
    }[provider];
  return e;
}

/** A refusal in words the administrator can act on. */
export function appRefusal(code: string): string {
  return txt.refusals[code] ?? txt.refused;
}

/** The Google Cloud project number a Google client id starts with, or
 * undefined when the id is not of that shape. */
export function googleProject(id?: string): string | undefined {
  return /^(\d+)-[^/?#&]+\.apps\.googleusercontent\.com$/.exec(id ?? "")?.[1];
}

/** The client id's recognisable start: a Google id always ends in the same
 * domain, so its project number is what the console also shows; a Dropbox
 * App key has no structure, so four characters. */
export function shortClientID(section: AppSection, id?: string): string {
  if (!id) return "";
  const provider = sectionProvider(section);
  if (provider === "google") return `${id.split("-")[0]}-…`;
  if (provider === "microsoft") return `${id.split("-")[0]}-…`;
  return id.length > 4 ? `${id.slice(0, 4)}…` : id;
}
