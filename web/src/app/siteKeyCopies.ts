import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import accessSchema from "../../../contracts/v1/server-access.schema.json";
import integrationsSchema from "../../../contracts/v1/integrations.schema.json";
import serverSchema from "../../../contracts/v1/server-onboarding.schema.json";
import { bounded } from "./integrations";
import { mutationFetch, writeOutcome } from "./mutations";
import type { KeyProvider, SiteKey } from "./onboardingConfig";

// Giving the site AI key to people who joined before it (ADR 0030; Jari
// 2026-10-24). The gateway's own record says which key it gave whom; a
// check asks the person's own daemon for one word about their Pi, and the
// write is decided again by that daemon under Pi's lock. The administrator
// never learns what kind of credential a person has. Every reply is checked
// against the contract.

const ajv = new Ajv({ strict: false });
addFormats(ajv);
ajv.addSchema(integrationsSchema);
ajv.addSchema(accessSchema);
ajv.addSchema(serverSchema);
const def = (name: string) =>
  ajv.compile({
    $ref: `https://open-habitat.invalid/contracts/v1/server-onboarding.schema.json#/$defs/${name}`,
  });
const validCopies = def("copies");
const validCheck = def("check_reply");
const validSeed = def("seed_reply");

/** A copy the site gave, from its own record: not what the Pi holds now. */
export type SiteKeyCopy = {
  provider: KeyProvider;
  suffix: string;
  at: string;
  /** The copy is of the key the site stores now. */
  current: boolean;
};
export type JoinedPerson = {
  id: string;
  login_hint?: string;
  username?: string;
  copy?: SiteKeyCopy;
};
export type SiteKeyCopies = {
  schema_version: 1;
  site_key?: SiteKey;
  people: JoinedPerson[];
  /** Allowed people who have not signed in; they get it at first sign-in. */
  waiting: number;
};
/** The person's daemon's one word; unknown when it did not answer. */
export type CopyCheck = "absent" | "current" | "earlier" | "own" | "unknown";
/** The write's outcome: not_reached sent nothing, unknown may have written. */
export type GiveOutcome =
  | "seeded"
  | "replaced"
  | "already_current"
  | "kept"
  | "not_reached"
  | "unknown";
export type RotationResult = { subject: string; outcome: GiveOutcome };

export const writable = (c?: CopyCheck) => c === "absent" || c === "earlier";

export async function readSiteKeyCopies(
  signal?: AbortSignal,
): Promise<SiteKeyCopies> {
  const r = await fetch("/api/v1/server/onboarding/ai-key/copies", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!r.ok) throw new Error("Copies unavailable");
  const value = await bounded(r, 1 << 20);
  if (!validCopies(value)) throw new Error("Invalid copies");
  return value as SiteKeyCopies;
}

async function post(
  csrf: string,
  verb: "check" | "seed",
  body: object,
): Promise<
  | { kind: "ok"; value: unknown }
  | { kind: "refused"; code: string }
  | { kind: "uncertain" }
> {
  let response: Response;
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
  if (outcome.kind !== "ok") return { kind: "uncertain" };
  try {
    return { kind: "ok", value: await bounded(outcome.response, 4096) };
  } catch {
    return { kind: "uncertain" };
  }
}

/** What the person's Pi holds for the site key's provider, in one word. A
 * refusal (the person is not joined, the key is gone) is its code. */
export async function checkCopy(
  csrf: string,
  subject: string,
): Promise<CopyCheck | { refused: string }> {
  const r = await post(csrf, "check", { subject });
  if (r.kind === "refused") return { refused: r.code };
  if (r.kind === "ok" && validCheck(r.value))
    return (r.value as { state: CopyCheck }).state;
  return "unknown";
}

/** Has the person's daemon write the reviewed key. An answer that cannot be
 * read is unknown: the write may have happened, and nothing retries. */
export async function giveCopy(
  csrf: string,
  subject: string,
  key: SiteKey,
): Promise<GiveOutcome | { refused: string }> {
  const r = await post(csrf, "seed", {
    subject,
    provider: key.provider,
    suffix: key.suffix,
    set_at: key.set_at,
  });
  if (r.kind === "refused") return { refused: r.code };
  if (r.kind === "ok" && validSeed(r.value))
    return (r.value as { outcome: GiveOutcome }).outcome;
  return "unknown";
}
