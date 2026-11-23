import serverSchema from "../../../contracts/v1/server-search-key.schema.json";
import schema from "../../../contracts/v1/web-search-key.schema.json";
import { LazyAjv } from "./lazyAjv";
import { hostRequest, jsonWrite, mutationFetch } from "./mutations";
import { boundedJSON, errorCode } from "./speech";

/** The search services a key may be for. Staan is reserved until its
 * coverage has been checked: the host accepts only Brave keys. */
export type SearchBackend = "brave" | "staan";

/** The services offered on the pages, one row or tile each. */
export const shownBackends: SearchBackend[] = ["brave"];

export const backendName: Record<SearchBackend, string> = {
  brave: "Brave",
  staan: "Staan",
};

export type WebSearchKeyState = {
  schema_version: 1;
  present: boolean;
  backend: SearchBackend | null;
  suffix: string | null;
  /** own: the person saved it; site: a copy of the site's key. */
  source: "own" | "site" | null;
  /** When the search extension last saw the service refuse exactly this key. */
  refused_at: string | null;
  /** The Pi providers the installed search extension serves with their own
   * search; null when the daemon could not read its list. */
  native_providers: string[] | null;
};

export type SiteSearchKey = {
  schema_version: 1;
  site_key?: { backend: SearchBackend; suffix: string; set_at: string };
  given?: Partial<
    Record<
      | "seeded"
      | "replaced"
      | "already_current"
      | "kept"
      | "not_reached"
      | "unknown",
      number
    >
  >;
};

const ajv = new LazyAjv({ strict: false, addFormats: true });
ajv.addSchema(schema);
ajv.addSchema(serverSchema);
const validKeyState = ajv.compile<WebSearchKeyState>({
  $ref: `${schema.$id}#/$defs/key_state`,
});
const validSiteKey = ajv.compile<SiteSearchKey>({
  $ref: `${serverSchema.$id}#/$defs/read`,
});

/** The daemon's literal-key rule. */
export const validSearchKey = (key: string): boolean =>
  /^[A-Za-z0-9_-]{16,256}$/.test(key);

/** The contract's refusal codes for a key that was not saved. */
export type SearchRefusal =
  | "search_key_rejected"
  | "search_limit_reached"
  | "search_unavailable";

export const refusalCodes: SearchRefusal[] = [
  "search_key_rejected",
  "search_limit_reached",
  "search_unavailable",
];

async function keyReply(response: Response): Promise<WebSearchKeyState> {
  if (!response.ok) throw Error((await errorCode(response)) || "unavailable");
  const data = await boundedJSON(response);
  if (!validKeyState(data)) throw Error("contract");
  return data;
}

export async function readWebSearchKey(signal?: AbortSignal) {
  return keyReply(
    await hostRequest("web_search.key", "/api/v1/web-search/key", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
    }),
  );
}

/** Saves the person's own key. Their daemon tries it with one search
 * first; a refused key, a reached limit or an unreachable service saves
 * nothing and throws the contract's code. */
export async function saveWebSearchKey(
  csrf: string,
  backend: SearchBackend,
  key: string,
) {
  return keyReply(
    await jsonWrite(
      "web_search.key",
      "/api/v1/web-search/key",
      { backend, key },
      csrf,
    ),
  );
}

export async function removeWebSearchKey(csrf: string) {
  return keyReply(
    await mutationFetch("web_search.key", "/api/v1/web-search/key", {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "X-Agent-Host-CSRF": csrf, Origin: window.location.origin },
    }),
  );
}

async function siteReply(response: Response): Promise<SiteSearchKey> {
  if (!response.ok) throw Error((await errorCode(response)) || "unavailable");
  const data = await boundedJSON(response);
  if (!validSiteKey(data)) throw Error("contract");
  return data;
}

export async function readSiteSearchKey(signal?: AbortSignal) {
  return siteReply(
    await fetch("/api/v1/server/search-key", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    }),
  );
}

export async function setSiteSearchKey(
  csrf: string,
  backend: SearchBackend,
  key: string,
) {
  return siteReply(
    await jsonWrite(
      "server.search_key",
      "/api/v1/server/search-key/set",
      { backend, key },
      csrf,
    ),
  );
}

export async function deleteSiteSearchKey(csrf: string) {
  return siteReply(
    await jsonWrite(
      "server.search_key",
      "/api/v1/server/search-key/delete",
      {},
      csrf,
    ),
  );
}

/** Display names of the person's Pi providers, as the rows name models. */
const providerModels: Record<string, string> = {
  "openai-codex": "ChatGPT",
  "claude-bridge": "Claude",
  openai: "OpenAI",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
};

/** Which of the person's providers search on their own and which need the
 * key, from the extension's list and the providers the person has models
 * for. undefined when either is unknown. */
export function searchCoverage(
  nativeProviders: string[] | null | undefined,
  providers: string[] | undefined,
): { natives: string[]; needers: string[] } | undefined {
  if (!nativeProviders || !providers) return undefined;
  const names = (list: string[]) => [
    ...new Set(list.map((p) => providerModels[p] ?? p)),
  ];
  return {
    natives: names(providers.filter((p) => nativeProviders.includes(p))),
    needers: names(providers.filter((p) => !nativeProviders.includes(p))),
  };
}
