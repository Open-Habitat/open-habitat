import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "../../../contracts/v1/server-integrations.schema.json";
import type { ProviderId } from "./integrations";
import { bounded } from "./integrations";
import { mutationFetch, writeOutcome } from "./mutations";

// The providers' app credentials (server-integrations-admin). The root broker
// writes them into the installation's integrations file on the gateway's
// request; the browser asks and shows a change as in force once the reply
// that confirms it has arrived. A secret is sent once and never comes back.

const ajv = new Ajv({ strict: false });
addFormats(ajv);
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

export type IntegrationApp = {
  provider: AppProvider;
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
  provider: AppProvider,
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

/** Field errors for a section, keyed by field; empty when the broker would
 * accept it. Values are trimmed by the caller. */
export function appErrors(
  provider: AppProvider,
  f: AppFields,
): Partial<Record<string, string>> {
  const [first, second] = appFields[provider];
  const e: Partial<Record<string, string>> = {};
  const a = f[first] ?? "";
  const b = f[second] ?? "";
  if (provider === "google") {
    if (!googleID.test(a))
      e[first] = "Tarkista Client ID: se päättyy .apps.googleusercontent.com.";
    if (!googleValue.test(b)) e[second] = "Tarkista Client secret.";
  } else if (provider === "dropbox") {
    if (!dropboxValue.test(a)) e[first] = "Tarkista App key.";
    if (!dropboxValue.test(b)) e[second] = "Tarkista App secret.";
  } else {
    if (!guid.test(a))
      e[first] = "Tarkista sovelluksen (client) ID: muoto 8-4-4-4-12.";
    if (!(["organizations", "common", "consumers"].includes(b) || guid.test(b)))
      e[second] =
        "Anna organizations, common, consumers tai Directory (tenant) ID.";
  }
  if (!e[first] && !e[second] && a === b)
    e[second] = "Tämä on sama kuin ensimmäinen kenttä.";
  return e;
}

/** A refusal in words the administrator can act on. */
export function appRefusal(code: string): string {
  switch (code) {
    case "browser_setup_disabled":
      return "Tunnusten asetus selaimesta on poissa käytöstä palvelimen asetuksissa.";
    case "host_busy":
      return "Palvelinta huolletaan juuri nyt. Mitään ei muutettu; yritä hetken päästä uudelleen.";
    case "integrations_file_invalid":
      return "Palvelimen integraatiotiedosto vaatii ylläpitoa komentoriviltä. Mitään ei muutettu.";
    case "login":
      return "Istunto on päättynyt. Kirjaudu uudelleen.";
    case "admin_required":
      return "Vain ylläpitäjä voi asettaa tunnuksia.";
    case "invalid_request":
      return "Palvelin ei hyväksynyt tunnuksia. Tarkista kentät.";
    default:
      return "Palvelin ei tehnyt muutosta.";
  }
}

/** The client id's recognisable start: a Google id always ends in the same
 * domain, so its project number is what the console also shows. */
export function shortClientID(provider: AppProvider, id?: string): string {
  if (!id) return "";
  if (provider === "google") return `${id.split("-")[0]}-…`;
  if (provider === "microsoft") return `${id.split("-")[0]}-…`;
  return id.length > 4 ? `${id.slice(0, 4)}…` : id;
}
