import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import cloneSchema from "../../../contracts/v1/github-clone.schema.json";
import cloneProgressSchema from "../../../contracts/v1/github-clone-progress.schema.json";
import integrationsSchema from "../../../contracts/v1/integrations.schema.json";
import serverSchema from "../../../contracts/v1/server-onboarding.schema.json";
import siteSchema from "../../../contracts/v1/site-onboarding.schema.json";
import { bounded, type IntegrationList, type ProviderId } from "./integrations";
import { mutationFetch, writeOutcome } from "./mutations";

// The site onboarding configuration (ADR 0030) lives in the gateway's
// administration state. An administrator reads and replaces it whole under a
// version; a signed-in person reads only the steps and the offer, never the
// default repositories. Every reply is checked against the contract.

const ajv = new Ajv({ strict: false });
addFormats(ajv);
ajv.addSchema(integrationsSchema);
ajv.addSchema(cloneSchema);
ajv.addSchema(cloneProgressSchema);
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
export type KeyProvider = "openai" | "anthropic" | "deepseek";
/** The stored site AI key as it is ever read back. */
export type SiteKey = { provider: KeyProvider; suffix: string; set_at: string };
export type OnboardingConfig = OnboardingDocument & {
  schema_version: 1;
  version: number;
  /** Present exactly while the site holds an AI key (offer site_key). */
  site_key?: SiteKey;
};
export type SiteOnboarding = {
  schema_version: 1;
  /** imports: the defaults the site fetches for this person, only their own
   * readable ones, from the sign-in that created their account. */
  repositories: { mode: RepositoryMode; imports?: string[] };
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
/** Whether this installation has each provider ready (its catalog entry is
 * Available); a provider missing here is not known to be ready. */
export type ProviderReadiness = Partial<Record<ProviderId, boolean>>;
export const readinessOf = (list: IntegrationList): ProviderReadiness =>
  Object.fromEntries(list.providers.map((p) => [p.id, p.available]));

/** The integration steps of a person's route: each integration the site
 * added whose provider is ready, in the catalog's order. One that is not
 * ready, or whose readiness is unknown, is hidden but stays in the
 * configuration, so it returns when the provider is ready again (Jari
 * 2026-10-24). The person's route and the administrator's preview both
 * take their steps from here. */
export function routeIntegrations(
  integrations: OnboardingIntegration[],
  ready: ProviderReadiness,
): OnboardingIntegration[] {
  return providerOrder.flatMap((p) =>
    integrations.filter((i) => i.provider === p && ready[p] === true),
  );
}

/** Whether the person's route has a Repot step: not when the site fetches
 * nothing and shows no chooser. */
export const hasRepositoryStep = (mode: RepositoryMode, siteRepos: number) =>
  mode !== "skip" || siteRepos > 0;

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

/** The gateway's literal-key rule: Pi runs `!…` values and expands `$NAME`,
 * so only sk-… is stored, and sk-ant-… is Anthropic's alone. */
export const validSiteKey = (provider: KeyProvider, key: string) =>
  /^sk-[A-Za-z0-9_-]{20,200}$/.test(key) &&
  key.startsWith("sk-ant-") === (provider === "anthropic");

async function siteKeyWrite(
  csrf: string,
  verb: "set" | "delete",
  body: object,
): Promise<SaveResult> {
  let response: Response | undefined;
  try {
    response = await mutationFetch(
      "server.onboarding.ai-key",
      `/api/v1/server/onboarding/ai-key/${verb}`,
      {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Host-CSRF": csrf,
        },
        body: JSON.stringify(body),
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
  return { kind: "uncertain" };
}

/** Stores the site AI key and makes the offer site_key. The key is sent once
 * and never comes back. */
export const setSiteKey = (csrf: string, provider: KeyProvider, key: string) =>
  siteKeyWrite(csrf, "set", { provider, key });

/** Removes the site AI key; offer is what new people get instead. */
export const deleteSiteKey = (
  csrf: string,
  offer: Exclude<AIOffer, "site_key">,
) => siteKeyWrite(csrf, "delete", { offer });

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
    case "duplicate_destination":
      return "Kahdella oletusrepolla on sama nimi eri omistajilla. Henkilölle voi hakea niistä vain yhden.";
    case "unknown_provider":
    case "duplicate_provider":
      return "Integraatioiden lista ei kelpaa palvelimelle.";
    case "site_key_unavailable":
      return "Sivuston avainta ei ole tallennettu.";
    case "site_key_stored":
      return "Sivuston avain on käytössä. Poista avain ennen kuin vaihdat tapaa.";
    case "invalid_key":
      return "Avain ei kelpaa valitulle palvelulle.";
    case "admin_required":
      return "Ylläpito-oikeutesi on poistettu.";
    case "csrf_denied":
    case "origin_denied":
      return "Istunto ei kelpaa enää. Lataa sivu uudelleen.";
    default:
      return "Palvelin ei hyväksynyt muutosta.";
  }
}
