import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import integrationsSchema from "../../../contracts/v1/integrations.schema.json";
import serverSchema from "../../../contracts/v1/server-onboarding.schema.json";
import siteSchema from "../../../contracts/v1/site-onboarding.schema.json";
import { bounded, type ProviderId } from "./integrations";
import { mutationFetch, writeOutcome } from "./mutations";

// The site onboarding configuration (ADR 0030) lives in the gateway's
// administration state. An administrator reads and replaces it whole under a
// version; a signed-in person reads only the steps and the offer, never the
// default repositories. Every reply is checked against the contract.

const ajv = new Ajv({ strict: false });
addFormats(ajv);
ajv.addSchema(integrationsSchema);
ajv.addSchema(serverSchema);
const validServer = ajv.compile({
  $ref: "https://open-habitat.invalid/contracts/v1/server-onboarding.schema.json#/$defs/configuration",
});
const validSite = ajv.compile(siteSchema);

export type RepositoryMode = "preselected" | "auto" | "skip";
export type AIOffer =
  | "all"
  | "chatgpt"
  | "claude"
  | "openai_key"
  | "anthropic_key"
  | "deepseek_key"
  | "site_key";
export type OnboardingIntegration = { provider: ProviderId; required: boolean };
export type OnboardingDocument = {
  repositories: { mode: RepositoryMode; defaults: string[] };
  integrations: OnboardingIntegration[];
  ai_account: { offer: AIOffer };
};
export type OnboardingConfig = OnboardingDocument & {
  schema_version: 1;
  version: number;
};
export type SiteOnboarding = {
  schema_version: 1;
  repositories: { mode: RepositoryMode };
  integrations: OnboardingIntegration[];
  ai_account: { offer: AIOffer };
};

export const maxDefaults = 20;
/** The integrations catalog's order, which the route's steps follow. */
export const providerOrder: ProviderId[] = [
  "google",
  "microsoft",
  "imap",
  "caldav",
  "carddav",
  "dropbox",
];
/** GitHub's owner/repo grammar, as the contract states it. */
export const repositoryName =
  /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/;
export const validRepositoryName = (name: string) =>
  repositoryName.test(name) && !/\/\.{1,2}$/.test(name);

/** The parts of a configuration an administrator edits, in canonical order. */
export function documentOf(c: OnboardingDocument): OnboardingDocument {
  return {
    repositories: {
      mode: c.repositories.mode,
      defaults: [...c.repositories.defaults],
    },
    integrations: providerOrder.flatMap((p) =>
      c.integrations.filter((i) => i.provider === p),
    ),
    ai_account: { offer: c.ai_account.offer },
  };
}
export const sameDocument = (a: OnboardingDocument, b: OnboardingDocument) =>
  JSON.stringify(documentOf(a)) === JSON.stringify(documentOf(b));

async function read<T>(
  url: string,
  valid: (v: unknown) => boolean,
  signal?: AbortSignal,
): Promise<T> {
  const r = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!r.ok) throw new Error("Onboarding unavailable");
  const value = await bounded(r, 16384);
  if (!valid(value)) throw new Error("Invalid onboarding");
  return value as T;
}

export const readServerOnboarding = (signal?: AbortSignal) =>
  read<OnboardingConfig>("/api/v1/server/onboarding", validServer, signal);

/** What a signed-in person's route is built from. */
export const readSiteOnboarding = (signal?: AbortSignal) =>
  read<SiteOnboarding>("/api/v1/onboarding/site", validSite, signal);

/** Why a save did not happen, or that it may have: a refusal wrote nothing,
 * an uncertain save must be read back before another attempt. */
export type SaveResult =
  | { kind: "saved"; config: OnboardingConfig }
  | { kind: "refused"; code: string }
  | { kind: "uncertain" }
  | { kind: "login" };

export async function saveServerOnboarding(
  csrf: string,
  expectedVersion: number,
  doc: OnboardingDocument,
): Promise<SaveResult> {
  let response: Response | undefined;
  try {
    response = await mutationFetch(
      "server.onboarding",
      "/api/v1/server/onboarding",
      {
        method: "PUT",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Host-CSRF": csrf,
        },
        body: JSON.stringify({
          expected_version: expectedVersion,
          ...documentOf(doc),
        }),
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
    if (validServer(value))
      return { kind: "saved", config: value as OnboardingConfig };
  } catch {}
  // Saved by the host's word, but its reply cannot be read: read it again.
  return { kind: "uncertain" };
}

/** A refusal in words the administrator can act on. */
export function refusalText(code: string): string {
  switch (code) {
    case "version_conflict":
      return "Käyttöönottoa on muutettu toisaalla sen jälkeen, kun avasit sen. Lataa nykyinen versio ja tee muutoksesi uudelleen.";
    case "too_many_defaults":
      return `Oletusrepoja voi olla enintään ${maxDefaults}.`;
    case "invalid_repository_name":
      return "Jokin oletusrepo ei ole muotoa omistaja/repo.";
    case "duplicate_default":
      return "Sama oletusrepo on listassa kahdesti.";
    case "unknown_provider":
    case "duplicate_provider":
      return "Integraatioiden lista ei kelpaa palvelimelle.";
    case "site_key_unavailable":
      return "Sivuston avainta ei ole tallennettu.";
    case "admin_required":
      return "Ylläpito-oikeutesi on poistettu.";
    case "csrf_denied":
    case "origin_denied":
      return "Istunto ei kelpaa enää. Lataa sivu uudelleen.";
    default:
      return "Palvelin ei hyväksynyt muutosta.";
  }
}
