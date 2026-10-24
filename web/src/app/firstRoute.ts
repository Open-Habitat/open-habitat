import Ajv from "ajv/dist/2020.js";
import schema from "../../../contracts/v1/first-route.schema.json";
import { bounded } from "./integrations";
import { jsonWrite } from "./mutations";
import { readSiteOnboarding } from "./onboardingConfig";

// The first-login route ends when Pi is usable, except for a person whose
// account-creating sign-in seeded the site AI key: their Pi was usable before
// they walked the route. For them the route lasts until their own daemon
// holds the first-route mark; the host keeps no onboarding record.

const validate = new Ajv({ strict: false }).compile<{
  schema_version: 1;
  web_identity_id: string;
  finished: boolean;
}>(schema);
const url = "/api/v1/account/first-route";

async function finishedOf(response: Response, identity: string) {
  if (!response.ok) throw new Error("first route unavailable");
  const value = await bounded(response, 4096);
  if (!validate(value) || value.web_identity_id !== identity)
    throw new Error("first route unavailable");
  return value.finished;
}

/** Whether this seeded person's route is still to be walked. An unreadable
 * answer is not a reason to hold anyone in onboarding: it answers false. */
export async function seededRouteOpen(
  identity: string,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const site = await readSiteOnboarding(signal);
    if (!site.ai_key_seeded) return false;
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    return !(await finishedOf(response, identity));
  } catch {
    return false;
  }
}

/** Marks the route walked. Not retried: a lost answer shows the route once
 * more on the next load, where it is walked again. */
export async function finishFirstRoute(csrf: string): Promise<void> {
  const response = await jsonWrite(
    "account.first_route",
    url,
    { finished: true },
    csrf,
    { method: "PUT" },
  );
  if (!response.ok) throw new Error("first route unavailable");
}
